/**
 * Vista 3D de la máquina CNC: el centro de torneado o la fresadora, con el
 * bruto que se va mecanizando a medida que corre el programa, la herramienta
 * montada, la viruta, el refrigerante y la trayectoria programada.
 *
 * La escena se arma en milímetros. En el torno el eje Z de la máquina va
 * hacia la derecha y el X (radio) hacia arriba, como en los planos; en la
 * fresadora X va a la derecha, Y hacia el fondo y Z hacia arriba.
 */
import { BotonPlayEscena, type PlayEscena } from '../components/PlayEscena'
import { aplicarModoArrastre, type ModoArrastre } from '../components/mandoCamara'
import BotonPantallaCompleta, { usePantallaCompleta } from '../components/PantallaCompleta'
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { sombraContacto, solSuave } from '../vista3d/realista'
import { crearEscena } from '../vista3d/escena'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Vec3 } from './gcode'
import {
  envolventeTorno,
  herramientaFresa,
  herramientaTorno,
  material as materialDe,
  rangoTorno,
  torretaDe,
  type HerramientaFresa,
  type HerramientaTorno,
} from './maquinas'
import { ALTO_GARRA, ESPESOR_MORDAZA, SOBRA_MORDAZA, PiezaFresa, PiezaTorno, altoMordaza, contrapuntoDe, type SimuladorCNC } from './simulador'
import { SonidoCNC } from './sonidoCNC'

export interface VistaCNC {
  sim: SimuladorCNC
  trayectoria: boolean
  sonido: boolean
  /** Torno: pieza cortada por la mitad para ver su interior. */
  corte?: boolean
  /** Línea del programa (desde 0) cuya trayectoria se marca en la máquina. */
  linea?: number | null
}

/** Plano de la vista en corte: deja la mitad trasera de la pieza (z ≤ 0). */
const PLANO_CORTE = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)

type Vista = 'iso' | 'frente' | 'arriba' | 'lado'

const M = {
  pintura: new THREE.MeshPhysicalMaterial({ color: 0x929dab, metalness: 0.14, roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
  pinturaOscura: new THREE.MeshPhysicalMaterial({ color: 0x3a444d, metalness: 0.34, roughness: 0.4, clearcoat: 0.22 }),
  acero: new THREE.MeshPhysicalMaterial({ color: 0xc5ccd4, metalness: 0.96, roughness: 0.18, clearcoat: 0.28, envMapIntensity: 1.25 }),
  aceroOscuro: new THREE.MeshPhysicalMaterial({ color: 0x4e585f, metalness: 0.88, roughness: 0.3, envMapIntensity: 1.1 }),
  fundicion: new THREE.MeshPhysicalMaterial({ color: 0x343c44, metalness: 0.42, roughness: 0.46, clearcoat: 0.18, clearcoatRoughness: 0.45, envMapIntensity: 0.85 }),
  inserto: new THREE.MeshPhysicalMaterial({ color: 0xe2c15a, metalness: 0.88, roughness: 0.18, clearcoat: 0.35, envMapIntensity: 1.3 }),
  negro: new THREE.MeshStandardMaterial({ color: 0x1c2126, metalness: 0.25, roughness: 0.5 }),
  naranja: new THREE.MeshPhysicalMaterial({ color: 0xe8792b, metalness: 0.15, roughness: 0.38, clearcoat: 0.4 }),
}

/** Cielo neutro y más claro que la bancada, para que la máquina se separe del fondo. */
function fondoMaquina(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#c4d8ec')
  grad.addColorStop(0.5, '#e1e9f0')
  grad.addColorStop(1, '#e3e6ea')
  g.fillStyle = grad
  g.fillRect(0, 0, 2, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function caja(w: number, h: number, d: number, mat: THREE.Material, r = 2): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)), mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function cil(r: number, largo: number, mat: THREE.Material, seg = 40, r2 = r): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, largo, seg), mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** Textura de rayado fino: deja ver que la pieza gira. */
function texturaRayada(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 16
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 256, 16)
  for (let i = 0; i < 18; i++) {
    g.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.07})`
    g.fillRect(Math.random() * 256, 0, 2 + Math.random() * 6, 16)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * Sólido de revolución alrededor del eje X de la escena a partir de un
 * perfil (r, x). Cada tramo del perfil lleva su propia normal, así los
 * resaltes quedan con aristas vivas.
 */
export function geometriaRevolucion(perfil: Array<[number, number]>, seg = 56): THREE.BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let v = 0
  for (let k = 0; k < perfil.length - 1; k++) {
    const [r0, x0] = perfil[k]
    const [r1, x1] = perfil[k + 1]
    const dx = x1 - x0
    const dr = r1 - r0
    const l = Math.hypot(dx, dr)
    if (l < 1e-6) continue
    // Normal hacia fuera del tramo en el plano (x, r).
    const nx = -dr / l
    const nr = dx / l
    const base = v
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2
      const c = Math.cos(a)
      const sn = Math.sin(a)
      pos.push(x0, r0 * c, r0 * sn, x1, r1 * c, r1 * sn)
      nor.push(nx, nr * c, nr * sn, nx, nr * c, nr * sn)
      uv.push(s / seg, x0 / 8, s / seg, x1 / 8)
      v += 2
    }
    for (let s = 0; s < seg; s++) {
      const a = base + s * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/**
 * Perfil (r, z) de la pieza de torno, sin puntos repetidos en los tramos rectos.
 *
 * Las celdas sin material (exterior = interior) en los extremos se descartan: tras refrentar o tronzar
 * quedan en cero, y si se dibujaran, el exterior cerraría con un disco la boca del agujero. Así la cara
 * termina en la última celda con material y es una corona entre el agujero y el borde.
 */
export function perfilTorno(ext: Float32Array, int: Float32Array, z0: number, paso: number): Array<[number, number]> {
  let ini = 0
  let fin = ext.length - 1
  while (ini < fin && ext[ini] - int[ini] <= 1e-4) ini++
  while (fin > ini && ext[fin] - int[fin] <= 1e-4) fin--
  const n = fin - ini + 1
  const fuera: Array<[number, number]> = []
  const dentro: Array<[number, number]> = []
  const agregar = (arr: Array<[number, number]>, val: Float32Array) => {
    for (let k = 0; k < n; k++) {
      const i = ini + k
      const cambia = k === 0 || k === n - 1 || Math.abs(val[i] - val[i - 1]) > 1e-4 || Math.abs(val[i] - val[i + 1]) > 1e-4
      if (cambia) arr.push([val[i], z0 + i * paso])
    }
  }
  agregar(fuera, ext)
  agregar(dentro, int)
  const perfil: Array<[number, number]> = [[int[ini], z0 + ini * paso], ...fuera, [int[fin], z0 + fin * paso]]
  for (let k = dentro.length - 1; k >= 0; k--) perfil.push(dentro[k])
  perfil.push([int[ini], z0 + ini * paso])
  return perfil
}

// ---------------------------------------------------------------------------
// Herramientas
// ---------------------------------------------------------------------------
const ARRIBA = new THREE.Vector3(0, 1, 0)

function nombrar<T extends THREE.Object3D>(o: T, nombre: string): T {
  o.name = nombre
  return o
}

/** Barra que une los puntos a y b, con la sección ancho × grueso (el largo sigue la dirección a → b). */
function barra(a: THREE.Vector3, b: THREE.Vector3, ancho: number, grueso: number, mat: THREE.Material, nombre: string): THREE.Mesh {
  const dir = b.clone().sub(a)
  const largo = dir.length()
  const m = nombrar(caja(ancho, largo, grueso, mat, 1.4), nombre)
  m.position.copy(a).addScaledVector(dir, 0.5)
  m.quaternion.setFromUnitVectors(ARRIBA, dir.normalize())
  return m
}

/** Medidas de la torreta respecto de la punta de la herramienta (la torreta va por encima y por detrás del bruto). */
export function medidasTorreta(R: number) {
  const y = Math.max(128, R + 78)
  return { y, z: -R * 0.35 - 22, radio: 58, grueso: 40 }
}

/** Cuánto sobresale hacia la cara el cuerpo de la broca, hasta el fin de su portabrocas y su columna (mm desde la punta). */
export function alcanceBroca(h: HerramientaTorno, profundidad: number): number {
  const r = (h.medida ?? 8) / 2
  const punta = r * Math.tan((31 * Math.PI) / 180)
  return punta + largoBroca(profundidad) + 14 + 7
}

/** Largo libre de la broca: pasa por sobre la cara con el portabrocas fuera del agujero más 24 mm de holgura. */
export function largoBroca(profundidad: number): number {
  return Math.max(58, profundidad + 24)
}

/**
 * Herramienta del torno con su portaherramientas. El origen es el punto programado (el filo).
 * `torreta` son las medidas de la torreta respecto de la punta: el porta sube hasta ella, para que
 * la herramienta no quede flotando. `profundidad` es lo más hondo que taladra el programa con esta broca.
 *
 * Inserto: contorno inferior según la envolvente, arriba plano. El inserto sí llega al material;
 * el cuello es angosto y queda por el lado ya mecanizado. Desde el cuello sube una barra hasta el
 * centro de la torreta, siempre por encima del bruto. La broca va en el eje con el portabrocas fuera
 * del agujero; una columna lo une con un brazo que llega a la torreta.
 */
export function modeloHerramientaTorno(h: HerramientaTorno, radioBruto: number, torreta: { y: number; z: number }, profundidad = 0): THREE.Group {
  const g = new THREE.Group()
  g.name = 'herramienta'
  const color = new THREE.MeshStandardMaterial({ color: h.color, metalness: 0.48, roughness: 0.38 })
  // Punto dentro del disco de la torreta, un poco por debajo de su centro, en el plano medio.
  const aTorreta = (x: number, bajo: number) => new THREE.Vector3(x, torreta.y - bajo, torreta.z)
  if (h.forma === 'broca') {
    const r = (h.medida ?? 8) / 2
    const punta = r * Math.tan((31 * Math.PI) / 180)
    // Saliente largo: el portabrocas queda fuera de la cara, no dentro del agujero.
    const salida = largoBroca(profundidad)
    const cono = nombrar(new THREE.Mesh(new THREE.ConeGeometry(r, punta, 24), M.acero), 'broca-punta')
    cono.rotation.z = Math.PI / 2
    cono.position.x = punta / 2
    cono.castShadow = true
    const cuerpo = nombrar(cil(r * 0.96, salida, M.acero, 24), 'broca-cuerpo')
    cuerpo.rotation.z = Math.PI / 2
    cuerpo.position.x = punta + salida / 2
    const porta = nombrar(cil(r + 3, 14, color, 24, r + 5.5), 'broca-portabrocas')
    porta.rotation.z = Math.PI / 2
    porta.position.x = punta + salida + 7
    const xc = punta + salida + 7
    // Columna desde el portabrocas hasta el nivel del brazo, y brazo en diagonal hasta la torreta.
    const yBrazo = torreta.y - 8
    const columna = barra(new THREE.Vector3(xc, 0, 0), new THREE.Vector3(xc, yBrazo, 0), 14, 14, M.aceroOscuro, 'broca-columna')
    const brazo = barra(new THREE.Vector3(xc, yBrazo, 0), new THREE.Vector3(0, yBrazo, torreta.z), 14, 14, M.aceroOscuro, 'broca-brazo')
    g.add(cono, cuerpo, porta, columna, brazo)
    return g
  }
  // Inserto: contorno inferior según la envolvente, arriba plano.
  const [a, b] = rangoTorno(h)
  const forma = new THREE.Shape()
  const alto = 7
  const pts: Array<[number, number]> = []
  const n = 24
  for (let i = 0; i <= n; i++) {
    const dz = a + ((b - a) * i) / n
    const e = envolventeTorno(h, dz)
    if (e !== null) pts.push([dz, Math.min(e, alto)])
  }
  forma.moveTo(pts[0][0], pts[0][1])
  for (const [x, y] of pts.slice(1)) forma.lineTo(x, y)
  forma.lineTo(pts[pts.length - 1][0], alto)
  forma.lineTo(pts[0][0], alto)
  forma.closePath()
  const geo = new THREE.ExtrudeGeometry(forma, { depth: 4.2, bevelEnabled: false })
  geo.translate(0, 0, -2.1)
  const inserto = new THREE.Mesh(geo, h.forma === 'ranurado' ? M.acero : M.inserto)
  inserto.name = 'inserto'
  inserto.castShadow = true
  const ranura = h.forma === 'ranurado'
  const rosca = h.forma === 'roscado'
  const anchoCuello = ranura ? Math.max(0.8, (h.medida ?? 4) * 0.8) : rosca ? 2.8 : 4.6
  const profCuello = ranura ? Math.min(2.6, anchoCuello + 0.3) : 3.6
  // El cuello no cruza la punta hacia el resalte sin mecanizar.
  const xCuello = h.forma === 'izquierda' ? anchoCuello / 2 + 0.5 : h.forma === 'derecha' ? -(anchoCuello / 2 + 0.5) : ranura ? (a + b) / 2 : 0
  // Sin tope: en un bruto grande el mango también queda por fuera del material.
  const despeje = Math.max(30, radioBruto + 18)
  const altoCuello = despeje - alto
  const cuello = nombrar(caja(anchoCuello, altoCuello, profCuello, color, 0.2), 'cuello')
  cuello.position.set(xCuello, alto + altoCuello / 2, 0)
  // Portaherramientas: una barra del color de la herramienta, del extremo del cuello hasta dentro de la torreta.
  const porta = barra(new THREE.Vector3(xCuello, despeje - 4, 0), aTorreta(xCuello * 0.3, 30), 15, 13, color, 'porta')
  g.add(inserto, cuello, porta)
  return g
}

/**
 * Herramienta de la fresadora con su vástago y su portaherramientas. El origen es la punta. Las piezas
 * que cortan se llaman «filo…»; el vástago, el porta y el cuello que sube a la nariz del husillo no
 * cortan: no pueden entrar en la pieza. `despeje` es la altura del centro de la nariz sobre la punta.
 */
export function modeloHerramientaFresa(h: HerramientaFresa, altoBruto: number, despeje = 100): THREE.Group {
  const g = new THREE.Group()
  g.name = 'herramienta'
  const r = h.diametro / 2
  const color = new THREE.MeshStandardMaterial({ color: h.color, metalness: 0.5, roughness: 0.4 })
  const largo = h.diametro >= 30 ? 25 : 32
  let cuerpo: THREE.Object3D
  if (h.forma === 'bola') {
    const esf = nombrar(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), M.acero), 'filo-bola')
    esf.position.y = r
    const c = nombrar(cil(r, largo - r, M.acero, 24), 'filo')
    c.position.y = r + (largo - r) / 2
    cuerpo = new THREE.Group().add(esf, c)
  } else if (h.forma === 'broca' || h.forma === 'grabado') {
    const ang = h.forma === 'broca' ? 31 : 45
    const punta = r * Math.tan((ang * Math.PI) / 180)
    const cono = nombrar(new THREE.Mesh(new THREE.ConeGeometry(r, punta, 24), M.acero), 'filo-punta')
    cono.rotation.x = Math.PI
    cono.position.y = punta / 2
    const c = nombrar(cil(r, largo, M.acero, 24), 'filo')
    c.position.y = punta + largo / 2
    cuerpo = new THREE.Group().add(cono, c)
  } else {
    const c = nombrar(cil(r, largo, M.acero, 32), 'filo')
    c.position.y = largo / 2
    // Filos helicoidales sugeridos con franjas.
    const filos = new THREE.Group()
    for (let k = 0; k < 4; k++) {
      const f = nombrar(new THREE.Mesh(new THREE.BoxGeometry(0.6, largo * 0.9, Math.max(1, r * 0.35)), M.aceroOscuro), 'filo-franja')
      f.position.set(Math.cos((k * Math.PI) / 2) * r, largo / 2, Math.sin((k * Math.PI) / 2) * r)
      f.rotation.y = (-k * Math.PI) / 2
      f.rotation.z = 0.35
      filos.add(f)
    }
    cuerpo = new THREE.Group().add(c, filos)
  }
  // El vástago sigue el diámetro de la fresa; el porta queda por encima del bruto.
  const salida = Math.max(largo + 18, altoBruto + 24)
  const vastago = nombrar(cil(Math.max(1.2, r * 0.92), Math.max(8, salida - largo), M.acero, 24), 'vastago')
  vastago.position.y = largo + Math.max(8, salida - largo) / 2
  const radioPorta = Math.min(18, Math.max(r + 2.2, 7))
  const porta = nombrar(cil(radioPorta, 16, color, 28, radioPorta + 1.5), 'porta')
  porta.position.y = salida + 8
  g.add(cuerpo, vastago, porta)
  // El porta se prolonga hasta la nariz del husillo: sin este cuello, la herramienta colgaba en el aire.
  const yCuello = salida + 16
  const altoCuello = despeje - yCuello
  if (altoCuello > 0) {
    const cuello = nombrar(cil(radioPorta + 1.5, altoCuello, color, 28, radioPorta + 1.5), 'cuello')
    cuello.position.y = yCuello + altoCuello / 2
    g.add(cuello)
  }
  return g
}

// ---------------------------------------------------------------------------
// Escenas
// ---------------------------------------------------------------------------
export interface EscenaMaquina {
  raiz: THREE.Group
  caja: THREE.Box3
  punta: () => THREE.Vector3
  trazo: Trazo
  actualizar: (sim: SimuladorCNC, dt: number, trayectoria: boolean, corte?: boolean, linea?: number | null, ancho?: number, alto?: number) => void
}

interface Trazo extends THREE.Group {
  /** Marca el recorrido de una línea y deja el resto más suave. */
  marcar: (linea: number | null, trayectoria: boolean, ancho: number, alto: number) => void
}

/** Líneas de la trayectoria: rápidos en naranja discontinuo, cortes en azul. */
function lineasTrayectoria(sim: SimuladorCNC, aEscena: (p: Vec3) => THREE.Vector3): Trazo {
  const rap: number[] = []
  const cor: number[] = []
  for (const p of sim.programa.pasos) {
    if (p.puntos.length < 2) continue
    const arr = p.tipo === 'rapido' ? rap : cor
    for (let i = 1; i < p.puntos.length; i++) {
      const a = aEscena(p.puntos[i - 1])
      const b = aEscena(p.puntos[i])
      arr.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }
  const g = new THREE.Group() as Trazo
  const base = new THREE.Group()
  const matRap = new THREE.LineDashedMaterial({ color: 0xff7a00, dashSize: 2.2, gapSize: 1.6, depthTest: false, transparent: true, opacity: 0.58 })
  const matCor = new THREE.LineBasicMaterial({ color: 0x1668c7, depthTest: false, transparent: true, opacity: 0.5 })
  const hacer = (arr: number[], mat: THREE.LineBasicMaterial | THREE.LineDashedMaterial) => {
    if (!arr.length) return
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
    const l = new THREE.LineSegments(geo, mat)
    l.computeLineDistances()
    l.renderOrder = 10
    base.add(l)
  }
  hacer(rap, matRap)
  hacer(cor, matCor)
  const destaque = new THREE.Group()
  g.add(base, destaque)
  let puesta: number | null | undefined
  const materiales: LineMaterial[] = []
  g.marcar = (linea, trayectoria, ancho, alto) => {
    base.visible = trayectoria
    const tenue = trayectoria && linea != null
    matRap.opacity = tenue ? 0.16 : 0.58
    matCor.opacity = tenue ? 0.14 : 0.5
    if (linea === puesta) {
      for (const m of materiales) m.resolution.set(ancho, alto)
      destaque.visible = linea != null
      return
    }
    puesta = linea
    for (const m of materiales) m.dispose()
    materiales.length = 0
    for (const child of [...destaque.children]) {
      const linea2 = child as Line2
      linea2.geometry.dispose()
      destaque.remove(linea2)
    }
    if (linea == null) {
      destaque.visible = false
      g.userData.tramos = 0
      return
    }
    destaque.visible = true
    let tramos = 0
    for (const p of sim.programa.pasos) {
      if (p.linea !== linea || p.puntos.length < 2) continue
      const flat: number[] = []
      for (const q of p.puntos) {
        const v = aEscena(q)
        flat.push(v.x, v.y, v.z)
      }
      const geo = new LineGeometry()
      geo.setPositions(flat)
      const mat = new LineMaterial({
        color: p.tipo === 'rapido' ? 0xff7a00 : 0xff2d55,
        linewidth: 1.25,
        depthTest: false,
        transparent: true,
        opacity: 0.72,
        dashed: p.tipo === 'rapido',
        dashSize: 3,
        gapSize: 1.8,
        resolution: new THREE.Vector2(ancho, alto),
      })
      materiales.push(mat)
      const trazo = new Line2(geo, mat)
      trazo.computeLineDistances()
      trazo.renderOrder = 12
      destaque.add(trazo)
      tramos++
    }
    g.userData.tramos = tramos
  }
  return g
}

/** Viruta: pequeñas espirales que saltan de la punta y caen. */
class Viruta {
  readonly malla: THREE.InstancedMesh
  private vivos: Array<{ p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: number; vida: number }> = []
  private tmp = new THREE.Object3D()
  constructor(
    color: number,
    private piso: number,
    escala: number,
  ) {
    const geo = new THREE.TorusGeometry(1.1 * escala, 0.3 * escala, 4, 8, Math.PI * 1.4)
    this.malla = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.35 }), 220)
    this.malla.count = 0
    this.malla.frustumCulled = false
  }
  emitir(en: THREE.Vector3, cantidad: number, dir: THREE.Vector3) {
    for (let i = 0; i < cantidad && this.vivos.length < 220; i++) {
      this.vivos.push({
        p: en.clone(),
        v: new THREE.Vector3(dir.x * 40 + (Math.random() - 0.5) * 60, dir.y * 40 + 30 + Math.random() * 60, dir.z * 40 + (Math.random() - 0.3) * 80),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: 5 + Math.random() * 10,
        vida: 2.5,
      })
    }
  }
  actualizar(dt: number) {
    let k = 0
    for (const c of this.vivos) {
      c.vida -= dt
      c.v.y -= 400 * dt
      c.p.addScaledVector(c.v, dt)
      if (c.p.y < this.piso) {
        c.p.y = this.piso
        c.v.set(0, 0, 0)
        c.w = 0
      }
      c.r.x += c.w * dt
      c.r.y += c.w * dt * 0.7
      this.tmp.position.copy(c.p)
      this.tmp.rotation.copy(c.r)
      this.tmp.updateMatrix()
      this.malla.setMatrixAt(k++, this.tmp.matrix)
    }
    this.vivos = this.vivos.filter((c) => c.vida > 0)
    this.malla.count = k
    this.malla.instanceMatrix.needsUpdate = true
  }
}

/** Chorro de refrigerante: gotas que van de la boquilla a la punta. */
class Refrigerante {
  readonly puntos: THREE.Points
  private t = 0
  constructor(private n = 60) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3))
    this.puntos = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x5fb6ff, size: 2.2, transparent: true, opacity: 0.75, depthWrite: false }))
    this.puntos.frustumCulled = false
    this.puntos.visible = false
  }
  actualizar(dt: number, activo: boolean, desde: THREE.Vector3, hasta: THREE.Vector3) {
    this.puntos.visible = activo
    if (!activo) return
    this.t += dt * 2.2
    const attr = this.puntos.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < this.n; i++) {
      const f = (i / this.n + this.t) % 1
      const x = desde.x + (hasta.x - desde.x) * f
      const y = desde.y + (hasta.y - desde.y) * f - 6 * f * f
      const z = desde.z + (hasta.z - desde.z) * f
      attr.setXYZ(i, x + Math.sin(i * 7.1) * 0.6, y, z + Math.cos(i * 3.3) * 0.6)
    }
    attr.needsUpdate = true
  }
}

export function escenaTorno(sim: SimuladorCNC): EscenaMaquina {
  const pz = sim.pieza as PiezaTorno
  const raiz = new THREE.Group()
  const R = pz.bruto.diametro / 2
  const mat = materialDe(sim.config.material)
  const tex = texturaRayada()
  const matPieza = new THREE.MeshPhysicalMaterial({
    color: mat.color,
    metalness: mat.metal,
    roughness: mat.metal > 0.4 ? 0.18 : 0.42,
    clearcoat: mat.metal > 0.4 ? 0.42 : 0.08,
    clearcoatRoughness: 0.28,
    envMapIntensity: mat.metal > 0.4 ? 1.45 : 0.6,
    map: tex,
    side: THREE.DoubleSide,
  })
  const contra = contrapuntoDe(pz)
  const tor = medidasTorreta(R)
  const ySoporte = tor.y + 48
  const zSoporte = -R * 0.45 - 30
  const zFondo = -140

  // Hasta dónde llega el programa: la bancada, el fondo y el contrapunto retirado se arman a esa medida,
  // para que nada quede sin apoyo aunque el carro vaya lejos. Las brocas también dicen cuán hondo taladran.
  let zMin = Math.min(sim.casa.z, pz.z0)
  let zMax = sim.casa.z
  let rMax = Math.max(R + 30, sim.casa.x / 2)
  const hondo = new Map<number, number>()
  const zMaxBroca = new Map<number, number>()
  for (const p of sim.programa.pasos) {
    const hp = herramientaTorno(p.herramienta)
    for (const q of p.puntos) {
      zMin = Math.min(zMin, q.z)
      zMax = Math.max(zMax, q.z)
      rMax = Math.max(rMax, Math.abs(q.x) / 2)
      if (hp?.forma === 'broca') {
        zMaxBroca.set(hp.t, Math.max(zMaxBroca.get(hp.t) ?? sim.casa.z, q.z))
        if (Math.abs(q.x) < 0.2) hondo.set(hp.t, Math.min(Math.max(hondo.get(hp.t) ?? 0, pz.z1 - q.z), pz.bruto.largo))
      }
    }
  }
  // Con una broca en el eje el contrapunto se retira hacia la derecha: el cuerpo de la broca y su
  // columna ocupan el sitio donde estaba. Cuánto, depende de lo largo que sea esa broca.
  const retiroDe = (t: number): number => {
    const h = herramientaTorno(t)
    if (!h || h.forma !== 'broca') return 0
    return Math.max(0, (zMaxBroca.get(t) ?? sim.casa.z) + alcanceBroca(h, hondo.get(t) ?? 0) + 8 - contra.z0)
  }
  let retiroMax = 0
  for (const h of torretaDe(sim.config)) retiroMax = Math.max(retiroMax, retiroDe(h.t))

  // Bancada inclinada, cabezal y bandeja de viruta.
  const xIzq = Math.min(pz.z0 - 150, zMin - 70)
  const xDer = Math.max(contra.z1 + retiroMax + 40, zMax + 70)
  const largoBanco = xDer - xIzq
  const xMedio = (xIzq + xDer) / 2
  const bancada = nombrar(caja(largoBanco, 40, 140, M.fundicion, 4), 'bancada')
  bancada.position.set(xMedio, -R - 95, -30)
  bancada.rotation.x = -0.35
  const cabezal = nombrar(caja(150, 2 * R + 160, 150, M.pintura, 8), 'cabezal')
  cabezal.position.set(pz.z0 - 45 - 75, 10, -20)
  const bandeja = nombrar(caja(largoBanco - 60, 6, 110, M.pinturaOscura, 2), 'bandeja')
  bandeja.position.set(xMedio + 30, -R - 62, 25)
  // El fondo cubre todo el recorrido del carro (también hacia arriba) y se apoya en un zócalo que lo une a la bancada.
  const yFondoBajo = -R - 110
  const yFondoAlto = rMax + ySoporte + 44
  const fondo = nombrar(caja(largoBanco + 80, yFondoAlto - yFondoBajo, 8, M.pintura, 3), 'fondo')
  fondo.position.set(xMedio, (yFondoAlto + yFondoBajo) / 2, zFondo)
  const zocalo = nombrar(caja(largoBanco + 80, 30, 50, M.fundicion, 3), 'zocalo')
  zocalo.position.set(xMedio, -R - 118, -122)
  raiz.add(bancada, cabezal, bandeja, fondo, zocalo)

  // Plato y garras (giran con la pieza).
  const giro = new THREE.Group()
  const plato = nombrar(cil(R + 42, 45, M.acero, 48), 'plato')
  plato.rotation.z = Math.PI / 2
  plato.position.x = pz.z0 - 22.5
  giro.add(plato)
  for (let k = 0; k < 3; k++) {
    const a = (k * 2 * Math.PI) / 3
    const garra = nombrar(caja(pz.bruto.agarre, ALTO_GARRA, 16, M.aceroOscuro, 1.5), 'garra')
    garra.position.set(pz.z0 + pz.bruto.agarre / 2, (R + ALTO_GARRA / 2) * Math.cos(a), (R + ALTO_GARRA / 2) * Math.sin(a))
    garra.rotation.x = a
    const base = nombrar(caja(20, 28, 18, M.aceroOscuro, 2), 'garra')
    base.position.set(pz.z0 - 4, (R + 22) * Math.cos(a), (R + 22) * Math.sin(a))
    base.rotation.x = a
    giro.add(garra, base)
  }
  // Pieza.
  const pieza = nombrar(new THREE.Mesh(new THREE.BufferGeometry(), matPieza), 'pieza')
  pieza.castShadow = true
  pieza.receiveShadow = true
  giro.add(pieza)
  raiz.add(giro)
  // Contrapunto: el cuerpo queda en la bancada y el punto, en el eje. Se desliza por la bancada.
  const contraGrupo = new THREE.Group()
  const quill = nombrar(cil(contra.radio, contra.z1 - contra.z0, M.acero, 40), 'quill')
  quill.rotation.z = Math.PI / 2
  quill.position.x = (contra.z0 + contra.z1) / 2
  // El cuerpo sube desde la base hasta pasar el eje, para que el punto siempre salga de él.
  const baseContra = nombrar(caja(90, 36, 110, M.fundicion, 3), 'baseContra')
  baseContra.position.set(contra.z1 - 10, -R - 58, 0)
  const yTopeBase = -R - 58 + 18
  const altoCuerpo = 12 - yTopeBase + 4
  const cuerpoContra = nombrar(caja(70, altoCuerpo, 90, M.pinturaOscura, 4), 'cuerpoContra')
  cuerpoContra.position.set(contra.z1 - 20, yTopeBase - 4 + altoCuerpo / 2, 0)
  contraGrupo.add(quill, cuerpoContra, baseContra)
  raiz.add(contraGrupo)
  let versionPieza = -1
  let retiro = 0

  // Parte tronzada que cae a la bandeja.
  let caida: { malla: THREE.Mesh; vy: number; vx: number; listo: boolean } | null = null

  // Torreta y herramienta. El carro cuelga del fondo por un brazo (el ram) y se mueve con la punta.
  const carro = new THREE.Group()
  carro.name = 'carro'
  const torreta = new THREE.Group()
  // Torreta oscura y tapa de acero: se separa del carenado gris y del fondo.
  const disco = nombrar(cil(tor.radio, tor.grueso, M.fundicion, 12), 'disco')
  disco.rotation.x = Math.PI / 2
  const tapa = nombrar(cil(30, 44, M.acero, 24), 'tapa')
  tapa.rotation.x = Math.PI / 2
  torreta.add(disco, tapa)
  // La torreta queda detrás y por encima del bruto: el disco no baja al cilindro.
  torreta.position.set(0, tor.y, tor.z)
  const soporte = nombrar(caja(64, 44, 52, M.pinturaOscura, 4), 'soporte')
  soporte.position.set(0, ySoporte, zSoporte)
  const zRamFondo = zFondo + 4
  const zRamSoporte = zSoporte - 26 + 2
  const ram = nombrar(caja(40, 30, zRamSoporte - zRamFondo, M.pinturaOscura, 3), 'ram')
  ram.position.set(0, ySoporte, (zRamFondo + zRamSoporte) / 2)
  carro.add(torreta, soporte, ram)
  raiz.add(carro)
  let herr: THREE.Group | null = null
  let tHerr = -1
  let hHerr: unknown = null
  let giroTorreta = 0

  // Boquilla de refrigerante: sale de la torreta por una manguera y apunta a la punta.
  const posBoq = new THREE.Vector3(24, Math.max(48, R + 18), -16)
  const dirBoq = new THREE.Vector3(0.4, 1.2, 1).sub(posBoq).normalize()
  const boquilla = nombrar(cil(2.2, 20, M.naranja, 12), 'boquilla')
  boquilla.position.copy(posBoq)
  boquilla.quaternion.setFromUnitVectors(ARRIBA, dirBoq)
  const salidaBoq = posBoq.clone().addScaledVector(dirBoq, 10)
  const manguera = barra(posBoq.clone().addScaledVector(dirBoq, -9), new THREE.Vector3(24, tor.y - 45, tor.z), 5, 5, M.negro, 'manguera')
  carro.add(boquilla, manguera)

  const viruta = new Viruta(mat.color, -R - 58, 1)
  const refri = new Refrigerante()
  const contacto = nombrar(sombraContacto(Math.max(78, R + 36)), 'contacto')
  contacto.rotation.x = -Math.PI / 2
  contacto.position.set(pz.z0 + pz.bruto.largo * 0.32, -R - 58.4, 18)
  raiz.add(viruta.malla, refri.puntos, contacto)

  const aEscena = (p: Vec3) => new THREE.Vector3(p.z, p.x / 2, 0.5)
  const tray = lineasTrayectoria(sim, aEscena)
  raiz.add(tray)
  const marca = nombrar(new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2d55, depthTest: false })), 'marca')
  marca.renderOrder = 11
  raiz.add(marca)

  const caja3 = new THREE.Box3(new THREE.Vector3(pz.z0 - 60, -R - 40, -R - 20), new THREE.Vector3(contra.z1 + 20, R + 70, R + 20))
  let angulo = 0

  return {
    raiz,
    caja: caja3,
    trazo: tray,
    punta: () => new THREE.Vector3(sim.pos.z, sim.pos.x / 2, 0),
    actualizar(s, dt, trayectoria, enCorte, linea = null, ancho = 800, alto = 600) {
      tray.marcar(linea, trayectoria, ancho, alto)
      marca.visible = trayectoria || linea != null
      const planos = enCorte ? [PLANO_CORTE] : []
      if (matPieza.clippingPlanes?.length !== planos.length) {
        matPieza.clippingPlanes = planos
        matPieza.needsUpdate = true
      }
      // La pieza se reconstruye en el mismo fotograma en que el filo arranca material.
      if (pz.version !== versionPieza) {
        versionPieza = pz.version
        pieza.geometry.dispose()
        pieza.geometry = geometriaRevolucion(perfilTorno(pz.ext, pz.int, pz.z0, 0.1))
      }
      if (pz.tronzada && !caida) {
        const t = pz.tronzada
        const malla = nombrar(new THREE.Mesh(geometriaRevolucion(perfilTorno(t.ext, t.int, t.z0, 0.1)), matPieza), 'tronzada')
        malla.castShadow = true
        raiz.add(malla)
        caida = { malla, vy: 0, vx: 20, listo: false }
      }
      if (caida && !caida.listo) {
        caida.vy -= 600 * dt
        caida.malla.position.y += caida.vy * dt
        caida.malla.position.x += caida.vx * dt
        const rMaxT = Math.max(...Array.from(pz.tronzada!.ext))
        const suelo = -R - 59 + rMaxT
        if (caida.malla.position.y < suelo) {
          caida.malla.position.y = suelo
          caida.listo = true
        }
      }
      // Giro.
      const paso = s.terminado ? undefined : s.programa.pasos[s.indice]
      const rpm = paso && paso.husillo !== 'off' && !s.alarma ? paso.rpm : 0
      const sentido = paso?.husillo === 'ccw' ? -1 : 1
      angulo += Math.min(rpm, 600) * 0.1 * dt * sentido
      giro.rotation.x = angulo
      // Herramienta.
      const t = s.herramienta
      const hNueva = herramientaTorno(t)
      if (t !== tHerr || hNueva !== hHerr) {
        tHerr = t
        hHerr = hNueva
        if (herr) carro.remove(herr)
        const h = hNueva
        herr = h ? modeloHerramientaTorno(h, R, { y: tor.y, z: tor.z }, hondo.get(h.t) ?? 0) : new THREE.Group()
        herr.name = 'herramienta'
        carro.add(herr)
        giroTorreta += Math.PI / 6
      }
      torreta.rotation.z += (giroTorreta - torreta.rotation.z) * Math.min(1, dt * 6)
      // El contrapunto se retira para la broca; si hay alarma por chocar con él, se queda en su sitio y el choque se ve.
      const choqueContra = !!s.alarma && /contrapunto/i.test(s.alarma.texto)
      const metaRetiro = !choqueContra && hNueva?.forma === 'broca' ? retiroDe(hNueva.t) : 0
      retiro += (metaRetiro - retiro) * Math.min(1, dt * 8)
      if (Math.abs(retiro - metaRetiro) < 0.01) retiro = metaRetiro
      contraGrupo.position.x = retiro
      const p = aEscena(s.pos)
      carro.position.set(p.x, p.y, 0)
      marca.position.copy(p)
      // Viruta y refrigerante.
      const corte = s.cortando
      if (corte > 0) viruta.emitir(new THREE.Vector3(p.x, p.y, 2), Math.min(4, 1 + Math.floor(corte)), new THREE.Vector3(0.5, 0.2, 1))
      viruta.actualizar(dt)
      refri.actualizar(dt, !!paso?.refrigerante && !s.terminado, new THREE.Vector3(p.x + salidaBoq.x, p.y + salidaBoq.y, salidaBoq.z), new THREE.Vector3(p.x + 0.4, p.y + 1.2, 1))
    },
  }
}

/** Mapa de alturas de la fresadora como malla: cara superior, costados y fondo. */
function mallaFresa(pz: PiezaFresa, mat: THREE.Material): { malla: THREE.Mesh; actualizar: () => void } {
  const { nx, ny, celda } = pz
  const H = pz.bruto.alto
  const nTop = nx * ny
  // Borde: recorrido perimetral de índices de la grilla.
  const borde: number[] = []
  for (let i = 0; i < nx; i++) borde.push(i)
  for (let j = 1; j < ny; j++) borde.push(j * nx + nx - 1)
  for (let i = nx - 2; i >= 0; i--) borde.push((ny - 1) * nx + i)
  for (let j = ny - 2; j > 0; j--) borde.push(j * nx)
  const nB = borde.length
  const total = nTop + nB * 2 + 4
  const pos = new Float32Array(total * 3)
  const col = new Float32Array(total * 3)
  const xy = (k: number) => [(k % nx) * celda, Math.floor(k / nx) * celda]
  for (let k = 0; k < nTop; k++) {
    const [x, y] = xy(k)
    pos.set([x, 0, -y], k * 3)
  }
  for (let b = 0; b < nB; b++) {
    const [x, y] = xy(borde[b])
    pos.set([x, 0, -y], (nTop + b) * 3)
    pos.set([x, -H, -y], (nTop + nB + b) * 3)
  }
  const L = (nx - 1) * celda
  const W = (ny - 1) * celda
  const f0 = nTop + nB * 2
  pos.set([0, -H, 0, L, -H, 0, L, -H, -W, 0, -H, -W], f0 * 3)
  const idx: number[] = []
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i
      idx.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx)
    }
  }
  for (let b = 0; b < nB; b++) {
    const b2 = (b + 1) % nB
    const t1 = nTop + b
    const t2 = nTop + b2
    const d1 = nTop + nB + b
    const d2 = nTop + nB + b2
    idx.push(t1, d1, t2, t2, d1, d2)
  }
  idx.push(f0, f0 + 2, f0 + 1, f0, f0 + 3, f0 + 2)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.setIndex(idx)
  const malla = new THREE.Mesh(geo, mat)
  malla.castShadow = true
  malla.receiveShadow = true
  const crudo = new THREE.Color(0xffffff)
  const mecanizado = new THREE.Color(0xb4bec9)
  const fondo = new THREE.Color(0x8d97a2)
  const actualizar = () => {
    for (let k = 0; k < nTop; k++) {
      const h = pz.h[k]
      pos[k * 3 + 1] = h
      const c = h > -1e-4 ? crudo : h <= -H + 1e-3 ? fondo : mecanizado
      col.set([c.r, c.g, c.b], k * 3)
    }
    for (let b = 0; b < nB; b++) {
      pos[(nTop + b) * 3 + 1] = pz.h[borde[b]]
      col.set([crudo.r * 0.92, crudo.g * 0.92, crudo.b * 0.92], (nTop + b) * 3)
      col.set([crudo.r * 0.92, crudo.g * 0.92, crudo.b * 0.92], (nTop + nB + b) * 3)
    }
    for (let q = 0; q < 4; q++) col.set([0.8, 0.8, 0.8], (f0 + q) * 3)
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
    geo.computeVertexNormals()
  }
  actualizar()
  return { malla, actualizar }
}

export function escenaFresa(sim: SimuladorCNC): EscenaMaquina {
  const pz = sim.pieza as PiezaFresa
  const raiz = new THREE.Group()
  const { largo: L, ancho: W, alto: H } = pz.bruto
  const mat = materialDe(sim.config.material)
  const matPieza = new THREE.MeshPhysicalMaterial({
    color: mat.color,
    metalness: mat.metal * 0.9,
    roughness: mat.metal > 0.4 ? 0.22 : 0.45,
    clearcoat: mat.metal > 0.4 ? 0.32 : 0.06,
    clearcoatRoughness: 0.32,
    envMapIntensity: mat.metal > 0.4 ? 1.3 : 0.5,
    vertexColors: true,
    side: THREE.DoubleSide,
  })
  const { malla, actualizar: actualizarMalla } = mallaFresa(pz, matPieza)
  nombrar(malla, 'pieza')
  raiz.add(malla)
  let versionPieza = pz.version

  // Hasta dónde llega el programa: la columna, el bastidor y la altura del cabezal se arman a esa medida,
  // para que el cabezal siempre cuelgue de la columna.
  const despejeHusillo = Math.max(100, H + 46)
  let xMin = Math.min(0, sim.casa.x)
  let xMax = Math.max(L, sim.casa.x)
  let yMax = Math.max(W, sim.casa.y)
  let zMax = sim.casa.z
  for (const p of sim.programa.pasos) {
    for (const q of p.puntos) {
      xMin = Math.min(xMin, q.x)
      xMax = Math.max(xMax, q.x)
      yMax = Math.max(yMax, q.y)
      zMax = Math.max(zMax, q.z)
    }
  }
  const xA = xMin - 90
  const xB = xMax + 90
  const xMedio = (xA + xB) / 2
  // Cara delantera de la columna: deja 30 mm entre ella y la espalda del cabezal en el punto más lejano.
  const ESPALDA_CABEZAL = -143
  const zColumna = -yMax + ESPALDA_CABEZAL - 30
  const yAltoColumna = zMax + despejeHusillo + 72 + 70
  const yBajoColumna = -H - 90

  // Mesa con ranuras en T, prensa y columna.
  const mesa = nombrar(caja(L + 160, 30, W + 110, M.fundicion, 3), 'mesa')
  mesa.position.set(L / 2, -H - 30 - 15, -W / 2)
  raiz.add(mesa)
  for (let k = -1; k <= 1; k++) {
    const ranura = nombrar(new THREE.Mesh(new THREE.BoxGeometry(L + 160, 1, 8), M.negro), 'ranura')
    ranura.position.set(L / 2, -H - 29.5, -W / 2 + k * 35)
    raiz.add(ranura)
  }
  // El bastidor une la mesa con la columna.
  const zFrenteBastidor = 55
  const bastidor = nombrar(caja(xB - xA, 30, zFrenteBastidor - (zColumna - 55), M.fundicion, 3), 'bastidor')
  bastidor.position.set(xMedio, -H - 75, (zFrenteBastidor + zColumna - 55) / 2)
  const baseTornillo = nombrar(caja(L + 40, 30, W + 60, M.aceroOscuro, 3), 'baseTornillo')
  baseTornillo.position.set(L / 2, -H - 15, -W / 2)
  // Las mismas medidas que usa el simulador para avisar del choque con la prensa: las mordazas llegan
  // hasta donde toman el bruto (altoM desde su base) y no más.
  const altoM = altoMordaza(H)
  const mordaza1 = nombrar(caja(L + SOBRA_MORDAZA * 2, altoM + 5, ESPESOR_MORDAZA, M.acero, 2), 'mordaza')
  mordaza1.position.set(L / 2, -H + (altoM - 5) / 2, ESPESOR_MORDAZA / 2)
  const mordaza2 = mordaza1.clone()
  mordaza2.position.z = -W - ESPESOR_MORDAZA / 2
  raiz.add(bastidor, baseTornillo, mordaza1, mordaza2)
  const columna = nombrar(caja(xB - xA, yAltoColumna - yBajoColumna, 110, M.pintura, 6), 'columna')
  columna.position.set(xMedio, (yAltoColumna + yBajoColumna) / 2, zColumna - 55)
  raiz.add(columna)
  const contacto = nombrar(sombraContacto(Math.max(L, W) * 0.55), 'contacto')
  contacto.rotation.x = -Math.PI / 2
  contacto.position.set(L / 2, -H - 29.2, -W / 2)
  raiz.add(contacto)

  // Cabezal (sube y baja con Z). La nariz queda por encima del bruto aunque la fresa baje al fondo.
  // Cuelga de la columna por un brazo (el ram) que se alarga o se acorta según el cabezal avance en Y.
  const cabezal = new THREE.Group()
  cabezal.name = 'carro'
  const caja1 = nombrar(caja(90, 110, 130, M.pintura, 6), 'cabezal')
  caja1.position.set(0, despejeHusillo + 72, -78)
  // La nariz sube hasta meterse en el cuerpo del cabezal (4 mm), si no, queda separada de él.
  const nariz = nombrar(cil(26, 34, M.pinturaOscura, 40), 'nariz')
  nariz.position.set(0, despejeHusillo + 4, 0)
  const ram = nombrar(new THREE.Mesh(new THREE.BoxGeometry(60, 50, 10), M.pinturaOscura), 'ram')
  ram.castShadow = true
  ram.receiveShadow = true
  let largoRam = -1
  cabezal.add(caja1, nariz, ram)
  const husillo = new THREE.Group()
  husillo.position.y = 0
  cabezal.add(husillo)
  raiz.add(cabezal)
  let herr: THREE.Group | null = null
  let tHerr = -1
  let hHerr: unknown = null
  let angulo = 0

  // Boquilla de refrigerante: sale del cabezal por una manguera y apunta a la punta.
  const posBoq = new THREE.Vector3(30, despejeHusillo - 8, 16)
  const dirBoq = new THREE.Vector3(-0.35, -0.88, -0.15).normalize()
  const boquilla = nombrar(cil(2.2, 24, M.naranja, 12), 'boquilla')
  boquilla.position.copy(posBoq)
  boquilla.quaternion.setFromUnitVectors(ARRIBA, dirBoq)
  const salidaBoq = posBoq.clone().addScaledVector(dirBoq, 12)
  const manguera = barra(posBoq.clone().addScaledVector(dirBoq, -11), new THREE.Vector3(30, despejeHusillo + 40, -30), 5, 5, M.negro, 'manguera')
  cabezal.add(boquilla, manguera)

  const viruta = new Viruta(mat.color, -H - 30, 0.8)
  const refri = new Refrigerante()
  raiz.add(viruta.malla, refri.puntos)

  const aEscena = (p: Vec3) => new THREE.Vector3(p.x, p.z, -p.y)
  const tray = lineasTrayectoria(sim, aEscena)
  raiz.add(tray)

  // Ejes del cero pieza.
  const ejes = nombrar(new THREE.Group(), 'ejes')
  const flecha = (dir: THREE.Vector3, color: number) => new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0.3, 0), 18, color, 5, 3)
  ejes.add(flecha(new THREE.Vector3(1, 0, 0), 0xd62828), flecha(new THREE.Vector3(0, 0, -1), 0x2a9d38), flecha(new THREE.Vector3(0, 1, 0), 0x1668c7))
  raiz.add(ejes)

  const caja3 = new THREE.Box3(new THREE.Vector3(-30, -H - 45, -W - 40), new THREE.Vector3(L + 30, 70, 30))

  return {
    raiz,
    caja: caja3,
    trazo: tray,
    punta: () => aEscena(sim.pos),
    actualizar(s, dt, trayectoria, _corte, linea = null, ancho = 800, alto = 600) {
      tray.marcar(linea, trayectoria, ancho, alto)
      ejes.visible = trayectoria
      if (pz.version !== versionPieza) {
        versionPieza = pz.version
        actualizarMalla()
      }
      const paso = s.terminado ? undefined : s.programa.pasos[s.indice]
      const rpm = paso && paso.husillo !== 'off' && !s.alarma ? paso.rpm : 0
      angulo += Math.min(rpm, 900) * 0.1 * dt * (paso?.husillo === 'ccw' ? 1 : -1)
      const t = s.herramienta
      const hNueva = herramientaFresa(t)
      if (t !== tHerr || hNueva !== hHerr) {
        tHerr = t
        hHerr = hNueva
        if (herr) husillo.remove(herr)
        const h = hNueva
        herr = h ? modeloHerramientaFresa(h, H, despejeHusillo) : new THREE.Group()
        herr.name = 'herramienta'
        husillo.add(herr)
      }
      if (herr) herr.rotation.y = angulo
      const p = aEscena(s.pos)
      cabezal.position.copy(p)
      // El ram va de la espalda del cabezal hasta dentro de la columna (2 mm).
      const zEspalda = ESPALDA_CABEZAL + 2
      const zColumnaLocal = zColumna - p.z - 2
      const largo = zEspalda - zColumnaLocal
      if (Math.abs(largo - largoRam) > 0.05) {
        largoRam = largo
        ram.geometry.dispose()
        ram.geometry = new THREE.BoxGeometry(60, 50, largo)
        ram.position.set(0, despejeHusillo + 72, (zEspalda + zColumnaLocal) / 2)
      }
      const corte = s.cortando
      if (corte > 0) viruta.emitir(new THREE.Vector3(p.x, p.y + 1, p.z), Math.min(4, 1 + Math.floor(corte / 4)), new THREE.Vector3(0, 0.5, 0.5))
      viruta.actualizar(dt)
      refri.actualizar(dt, !!paso?.refrigerante && !s.terminado, new THREE.Vector3(p.x + salidaBoq.x, p.y + salidaBoq.y, p.z + salidaBoq.z), new THREE.Vector3(p.x + 2, p.y + 2, p.z + 1))
    },
  }
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export default function Maquina3D({
  vista,
  alto = 440,
  onCanvas,
  play,
}: {
  vista: MutableRefObject<VistaCNC>
  /** En píxeles, o '100%' para llenar el área. */
  alto?: number | string
  onCanvas?: (c: HTMLCanvasElement | null) => void
  /** El play dentro de la escena (siempre visible). */
  play?: PlayEscena
}) {
  const contRef = useRef<HTMLDivElement>(null)
  const envolturaRef = useRef<HTMLDivElement>(null)
  const [pantalla, alternarPantalla] = usePantallaCompleta(envolturaRef)
  const [sinWebGL, setSinWebGL] = useState(false)
  const accionRef = useRef<((v: Vista) => void) | null>(null)
  const [, setVistaActual] = useState<Vista>('iso')
  const [modoArrastre, setModoArrastre] = useState<ModoArrastre>('girar')
  const controlesRef = useRef<OrbitControls | null>(null)
  useEffect(() => {
    if (!pantalla) setModoArrastre('girar')
  }, [pantalla])
  useEffect(() => {
    if (controlesRef.current) aplicarModoArrastre(controlesRef.current, modoArrastre)
  }, [modoArrastre])

  useEffect(() => {
    const cont = contRef.current
    if (!cont) return
    const base = crearEscena(cont, {
      preserveDrawingBuffer: true,
      camara: { fov: 35, near: 1, far: 6000 },
      controles: { enableDamping: true, dampingFactor: 0.08, zoomToCursor: true },
      modoArrastre,
      viewCube: { id: 'viewcube-cnc', alInicio: () => accionRef.current?.('iso') },
      // Fuera de pantalla o con la pestaña oculta no se dibuja ni suena.
      alOcultar: () => sonido.callar(),
    })
    if (!base) {
      setSinWebGL(true)
      return
    }
    const { renderer, escena, camara, controles } = base
    renderer.outputColorSpace = THREE.SRGBColorSpace
    // Neutral conserva los colores de la pintura y del plástico. ACES los lavaba.
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 0.94
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.localClippingEnabled = true
    renderer.domElement.style.display = 'block'
    renderer.domElement.dataset.cnc3d = 'si'
    onCanvas?.(renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(renderer)
    escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    escena.environmentIntensity = 0.95
    escena.background = fondoMaquina()
    const sol = solSuave(0xfff3e4, 2.8)
    sol.shadow.normalBias = 2.2
    sol.shadow.bias = -0.0006
    sol.shadow.radius = 2.5
    escena.add(sol, sol.target, new THREE.HemisphereLight(0xf7f8fa, 0x8a9099, 0.62))

    controlesRef.current = controles

    let actual: { sim: SimuladorCNC; esc: EscenaMaquina; maquina: string } | null = null
    const encuadrar = (v: Vista) => {
      if (!actual) return
      const b = actual.esc.caja
      const c = b.getCenter(new THREE.Vector3())
      const t = b.getSize(new THREE.Vector3())
      const aspecto = cont.clientWidth / Math.max(1, cont.clientHeight)
      const vfov = THREE.MathUtils.degToRad(camara.fov)
      const d = Math.max((t.y * 0.62) / Math.tan(vfov / 2), (t.x * 0.62) / Math.tan(vfov / 2) / aspecto) + t.z * 0.5
      const torno = actual.maquina === 'torno'
      if (v === 'frente') camara.position.set(c.x, c.y, c.z + d)
      else if (v === 'arriba') camara.position.set(c.x, c.y + d, c.z + (torno ? 0.01 : 0.01))
      else if (v === 'lado') camara.position.set(c.x + d, c.y, c.z + 0.01)
      else camara.position.set(c.x + d * 0.35, c.y + d * (torno ? 0.35 : 0.6), c.z + d * 0.85)
      controles.target.copy(c)
      controles.update()
      sol.position.set(c.x - 150, c.y + 400, c.z + 250)
      sol.target.position.copy(c)
      const s = Math.max(t.x, t.z, 200)
      Object.assign(sol.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 10, far: 1500 })
      sol.shadow.camera.updateProjectionMatrix()
    }
    accionRef.current = (v) => {
      setVistaActual(v)
      encuadrar(v)
    }

    const sonido = new SonidoCNC()
    const activarSonido = () => {
      if (vista.current.sonido) sonido.activar()
    }
    renderer.domElement.addEventListener('pointerdown', activarSonido)

    const tam = new THREE.Vector2()
    base.alCuadro((dt) => {
      const v = vista.current
      if (!actual || actual.sim !== v.sim) {
        const maquina = v.sim.config.maquina
        if (actual) escena.remove(actual.esc.raiz)
        const esc = maquina === 'torno' ? escenaTorno(v.sim) : escenaFresa(v.sim)
        escena.add(esc.raiz)
        const reencuadrar = !actual || actual.maquina !== maquina || !actual.esc.caja.equals(esc.caja)
        actual = { sim: v.sim, esc, maquina }
        cont.dataset.maquina = maquina
        if (reencuadrar) encuadrar('iso')
      }
      renderer.getSize(tam)
      actual.esc.actualizar(v.sim, dt, v.trayectoria, v.corte, v.linea ?? null, tam.x, tam.y)
      cont.dataset.trazo = String(actual.esc.trazo.userData.tramos ?? 0)
      const s = v.sim
      const paso = s.terminado ? undefined : s.programa.pasos[s.indice]
      if (v.sonido) sonido.actualizar(paso && paso.husillo !== 'off' && !s.alarma ? paso.rpm : 0, Math.min(1, s.cortando / 3), paso?.tipo === 'rapido' && !s.parado && s.t > 0)
      else sonido.callar()
      cont.dataset.linea = String(s.linea ?? '')
    })

    return () => {
      base.destruir()
      renderer.domElement.removeEventListener('pointerdown', activarSonido)
      sonido.cerrar()
      controlesRef.current = null
      onCanvas?.(null)
      pmrem.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (sinWebGL) {
    return <p style={{ padding: 20, color: 'var(--naranjo-aviso)' }}>Este navegador no tiene WebGL: la vista 3D no está disponible. El editor y la vista 2D siguen funcionando.</p>
  }
  return (
    <div ref={envolturaRef} style={{ position: 'relative', height: pantalla ? '100%' : typeof alto === 'string' ? alto : undefined, background: 'var(--fondo-gris)' }}>
      <div ref={contRef} style={{ width: '100%', height: pantalla ? '100%' : alto, borderRadius: 8, overflow: 'hidden', background: 'var(--fondo-gris)' }} />
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
        {/* Las vistas (3D, frente, arriba) están en el cubo de vistas. */}
        <BotonPantallaCompleta activa={pantalla} onAlternar={alternarPantalla} estilo={{ border: '1px solid #c6ced6', background: 'rgba(255,255,255,0.9)', color: '#33475c', borderRadius: 6, padding: '2px 8px', fontSize: '0.78rem', cursor: 'pointer' }} />
      </div>
      {play && <BotonPlayEscena play={play} />}
    </div>
  )
}
