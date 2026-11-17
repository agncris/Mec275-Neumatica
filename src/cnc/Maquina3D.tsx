/**
 * Vista 3D de la máquina CNC: el centro de torneado o la fresadora, con el
 * bruto que se va mecanizando a medida que corre el programa, la herramienta
 * montada, la viruta, el refrigerante y la trayectoria programada.
 *
 * La escena se arma en milímetros. En el torno el eje Z de la máquina va
 * hacia la derecha y el X (radio) hacia arriba, como en los planos; en la
 * fresadora X va a la derecha, Y hacia el fondo y Z hacia arriba.
 */
import HudEscena, { type PlayEscena } from '../components/HudEscena'
import { aplicarModoArrastre, cursoresCamara, zoomCamara, type ModoArrastre } from '../components/mandoCamara'
import BotonPantallaCompleta, { usePantallaCompleta } from '../components/PantallaCompleta'
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { sombraContacto, solSuave } from '../vista3d/realista'
import { crearViewCube } from '../vista3d/viewcube'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Vec3 } from './gcode'
import {
  envolventeTorno,
  herramientaFresa,
  herramientaTorno,
  material as materialDe,
  rangoTorno,
  type HerramientaFresa,
  type HerramientaTorno,
} from './maquinas'
import { ALTO_GARRA, PiezaFresa, PiezaTorno, contrapuntoDe, type SimuladorCNC } from './simulador'
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
  pintura: new THREE.MeshPhysicalMaterial({ color: 0x5e6b76, metalness: 0.22, roughness: 0.46, clearcoat: 0.28, clearcoatRoughness: 0.4 }),
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
  grad.addColorStop(0, '#fbfcfd')
  grad.addColorStop(0.5, '#f2f4f6')
  grad.addColorStop(1, '#e6eaee')
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
function geometriaRevolucion(perfil: Array<[number, number]>, seg = 56): THREE.BufferGeometry {
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

/** Perfil (r, z) de la pieza de torno, sin puntos repetidos en los tramos rectos. */
function perfilTorno(ext: Float32Array, int: Float32Array, z0: number, paso: number): Array<[number, number]> {
  const n = ext.length
  const fuera: Array<[number, number]> = []
  const dentro: Array<[number, number]> = []
  const agregar = (arr: Array<[number, number]>, val: Float32Array) => {
    for (let i = 0; i < n; i++) {
      const cambia = i === 0 || i === n - 1 || Math.abs(val[i] - val[i - 1]) > 1e-4 || Math.abs(val[i] - val[i + 1]) > 1e-4
      if (cambia) arr.push([val[i], z0 + i * paso])
    }
  }
  agregar(fuera, ext)
  agregar(dentro, int)
  const perfil: Array<[number, number]> = [[int[0], z0], ...fuera, [int[n - 1], z0 + (n - 1) * paso]]
  for (let k = dentro.length - 1; k >= 0; k--) perfil.push(dentro[k])
  perfil.push([int[0], z0])
  return perfil
}

// ---------------------------------------------------------------------------
// Herramientas
// ---------------------------------------------------------------------------
/**
 * Geometría visual del torno. El origen es el punto programado (el filo).
 * El inserto sí llega al material; el cuello es angosto y el mango queda
 * por encima del bruto, sesgado hacia el lado ya mecanizado y hacia la torreta.
 */
function modeloHerramientaTorno(h: HerramientaTorno, radioBruto: number): THREE.Group {
  const g = new THREE.Group()
  const color = new THREE.MeshStandardMaterial({ color: h.color, metalness: 0.48, roughness: 0.38 })
  if (h.forma === 'broca') {
    const r = (h.medida ?? 8) / 2
    const punta = r * Math.tan((31 * Math.PI) / 180)
    // Saliente largo: el portabrocas queda fuera de la cara, no dentro del agujero.
    const salida = Math.min(78, Math.max(58, radioBruto + 36))
    const cono = new THREE.Mesh(new THREE.ConeGeometry(r, punta, 24), M.acero)
    cono.rotation.z = Math.PI / 2
    cono.position.x = punta / 2
    cono.castShadow = true
    const cuerpo = cil(r * 0.96, salida, M.acero, 24)
    cuerpo.rotation.z = Math.PI / 2
    cuerpo.position.x = punta + salida / 2
    const porta = cil(r + 3, 12, color, 24, r + 5.5)
    porta.rotation.z = Math.PI / 2
    porta.position.x = punta + salida + 7
    const barra = caja(11, 58, 11, M.aceroOscuro, 1.4)
    barra.geometry.translate(0, 29, 0)
    barra.position.set(punta + salida + 7, radioBruto + 6, -8)
    g.add(cono, cuerpo, porta, barra)
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
  inserto.castShadow = true
  const ranura = h.forma === 'ranurado'
  const rosca = h.forma === 'roscado'
  const anchoCuello = ranura ? Math.max(0.8, (h.medida ?? 4) * 0.8) : rosca ? 2.8 : 4.6
  const profCuello = ranura ? Math.min(2.6, anchoCuello + 0.3) : 3.6
  // El cuello no cruza la punta hacia el resalte sin mecanizar.
  const xCuello = h.forma === 'izquierda' ? anchoCuello / 2 + 0.5 : h.forma === 'derecha' ? -(anchoCuello / 2 + 0.5) : ranura ? (a + b) / 2 : 0
  const despeje = Math.min(70, Math.max(28, radioBruto + 14))
  const altoCuello = despeje - alto
  const cuello = caja(anchoCuello, altoCuello, profCuello, color, 0.2)
  cuello.position.set(xCuello, alto + altoCuello / 2, 0)
  // El mango nace en el despeje (por encima del bruto) y se inclina hacia la torreta.
  const sesgo = h.forma === 'derecha' ? -1 : h.forma === 'izquierda' ? 1 : 0
  const mango = caja(13, 34, 11, color, 1.4)
  mango.geometry.translate(0, 17, 0)
  mango.position.set(xCuello, despeje - 0.4, 0)
  mango.rotation.z = -sesgo * 0.32
  mango.rotation.x = -0.48
  g.add(inserto, cuello, mango)
  return g
}

function modeloHerramientaFresa(h: HerramientaFresa, altoBruto: number): THREE.Group {
  const g = new THREE.Group()
  const r = h.diametro / 2
  const color = new THREE.MeshStandardMaterial({ color: h.color, metalness: 0.5, roughness: 0.4 })
  const largo = h.diametro >= 30 ? 25 : 32
  let cuerpo: THREE.Object3D
  if (h.forma === 'bola') {
    const esf = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), M.acero)
    esf.position.y = r
    const c = cil(r, largo - r, M.acero, 24)
    c.position.y = r + (largo - r) / 2
    cuerpo = new THREE.Group().add(esf, c)
  } else if (h.forma === 'broca' || h.forma === 'grabado') {
    const ang = h.forma === 'broca' ? 31 : 45
    const punta = r * Math.tan((ang * Math.PI) / 180)
    const cono = new THREE.Mesh(new THREE.ConeGeometry(r, punta, 24), M.acero)
    cono.rotation.x = Math.PI
    cono.position.y = punta / 2
    const c = cil(r, largo, M.acero, 24)
    c.position.y = punta + largo / 2
    cuerpo = new THREE.Group().add(cono, c)
  } else {
    const c = cil(r, largo, M.acero, 32)
    c.position.y = largo / 2
    // Filos helicoidales sugeridos con franjas.
    const filos = new THREE.Group()
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.6, largo * 0.9, Math.max(1, r * 0.35)), M.aceroOscuro)
      f.position.set(Math.cos((k * Math.PI) / 2) * r, largo / 2, Math.sin((k * Math.PI) / 2) * r)
      f.rotation.y = (-k * Math.PI) / 2
      f.rotation.z = 0.35
      filos.add(f)
    }
    cuerpo = new THREE.Group().add(c, filos)
  }
  // El vástago sigue el diámetro de la fresa; el porta queda por encima del bruto.
  const salida = Math.max(largo + 18, altoBruto + 24)
  const vastago = cil(Math.max(1.2, r * 0.92), Math.max(8, salida - largo), M.acero, 24)
  vastago.position.y = largo + Math.max(8, salida - largo) / 2
  const radioPorta = Math.min(18, Math.max(r + 2.2, 7))
  const porta = cil(radioPorta, 16, color, 28, radioPorta + 1.5)
  porta.position.y = salida + 8
  g.add(cuerpo, vastago, porta)
  return g
}

// ---------------------------------------------------------------------------
// Escenas
// ---------------------------------------------------------------------------
interface EscenaMaquina {
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

function escenaTorno(sim: SimuladorCNC): EscenaMaquina {
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

  // Bancada inclinada, cabezal y bandeja de viruta.
  const largoBanco = pz.bruto.largo + 260
  const xIzq = pz.z0 - 150
  const bancada = caja(largoBanco, 40, 140, M.fundicion, 4)
  bancada.position.set(xIzq + largoBanco / 2, -R - 95, -30)
  bancada.rotation.x = -0.35
  const cabezal = caja(150, 2 * R + 160, 150, M.pintura, 8)
  cabezal.position.set(pz.z0 - 45 - 75, 10, -20)
  const bandeja = caja(largoBanco - 60, 6, 110, M.pinturaOscura, 2)
  bandeja.position.set(xIzq + largoBanco / 2 + 30, -R - 62, 25)
  const fondo = caja(largoBanco + 80, 2 * R + 260, 8, M.pintura, 3)
  fondo.position.set(xIzq + largoBanco / 2, 20, -140)
  raiz.add(bancada, cabezal, bandeja, fondo)

  // Plato y garras (giran con la pieza).
  const giro = new THREE.Group()
  const plato = cil(R + 42, 45, M.acero, 48)
  plato.rotation.z = Math.PI / 2
  plato.position.x = pz.z0 - 22.5
  giro.add(plato)
  for (let k = 0; k < 3; k++) {
    const a = (k * 2 * Math.PI) / 3
    const garra = caja(pz.bruto.agarre, ALTO_GARRA, 16, M.aceroOscuro, 1.5)
    garra.position.set(pz.z0 + pz.bruto.agarre / 2, (R + ALTO_GARRA / 2) * Math.cos(a), (R + ALTO_GARRA / 2) * Math.sin(a))
    garra.rotation.x = a
    const base = caja(20, 28, 18, M.aceroOscuro, 2)
    base.position.set(pz.z0 - 4, (R + 22) * Math.cos(a), (R + 22) * Math.sin(a))
    base.rotation.x = a
    giro.add(garra, base)
  }
  // Pieza.
  const pieza = new THREE.Mesh(new THREE.BufferGeometry(), matPieza)
  pieza.castShadow = true
  pieza.receiveShadow = true
  giro.add(pieza)
  raiz.add(giro)
  // Contrapunto: el cuerpo queda en la bancada y el punto, en el eje.
  const contra = contrapuntoDe(pz)
  const quill = cil(contra.radio, contra.z1 - contra.z0, M.acero, 40)
  quill.rotation.z = Math.PI / 2
  quill.position.x = (contra.z0 + contra.z1) / 2
  const cuerpoContra = caja(70, contra.radio * 2 + 30, 90, M.pinturaOscura, 4)
  cuerpoContra.position.set(contra.z1 - 20, -R - 20, 0)
  const baseContra = caja(90, 36, 110, M.fundicion, 3)
  baseContra.position.set(contra.z1 - 10, -R - 55, 0)
  raiz.add(quill, cuerpoContra, baseContra)
  let versionPieza = -1

  // Parte tronzada que cae a la bandeja.
  let caida: { malla: THREE.Mesh; vy: number; vx: number; listo: boolean } | null = null

  // Torreta y herramienta.
  const carro = new THREE.Group()
  const torreta = new THREE.Group()
  const disco = cil(58, 40, M.pintura, 12)
  disco.rotation.x = Math.PI / 2
  const tapa = cil(30, 44, M.pinturaOscura, 24)
  tapa.rotation.x = Math.PI / 2
  torreta.add(disco, tapa)
  // La torreta queda detrás y por encima del bruto: el disco no baja al cilindro.
  torreta.position.set(0, Math.max(128, R + 78), -R * 0.35 - 22)
  const soporte = caja(64, 44, 52, M.pintura, 4)
  soporte.position.set(0, Math.max(176, R + 126), -R * 0.45 - 30)
  carro.add(torreta, soporte)
  raiz.add(carro)
  let herr: THREE.Group | null = null
  let tHerr = -1
  let hHerr: unknown = null
  let giroTorreta = 0

  const boquilla = cil(2.2, 20, M.naranja, 12)
  boquilla.position.set(12, Math.max(48, R + 18), -16)
  boquilla.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.22, -0.9, 0.32).normalize())
  carro.add(boquilla)

  const viruta = new Viruta(mat.color, -R - 58, 1)
  const refri = new Refrigerante()
  const contacto = sombraContacto(Math.max(78, R + 36))
  contacto.rotation.x = -Math.PI / 2
  contacto.position.set(pz.z0 + pz.bruto.largo * 0.32, -R - 58.4, 18)
  raiz.add(viruta.malla, refri.puntos, contacto)

  const aEscena = (p: Vec3) => new THREE.Vector3(p.z, p.x / 2, 0.5)
  const tray = lineasTrayectoria(sim, aEscena)
  raiz.add(tray)
  const marca = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2d55, depthTest: false }))
  marca.renderOrder = 11
  raiz.add(marca)

  const contraCaja = contrapuntoDe(pz)
  const caja3 = new THREE.Box3(new THREE.Vector3(pz.z0 - 60, -R - 40, -R - 20), new THREE.Vector3(contraCaja.z1 + 20, R + 70, R + 20))
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
        const malla = new THREE.Mesh(geometriaRevolucion(perfilTorno(t.ext, t.int, t.z0, 0.1)), matPieza)
        malla.castShadow = true
        raiz.add(malla)
        caida = { malla, vy: 0, vx: 20, listo: false }
      }
      if (caida && !caida.listo) {
        caida.vy -= 600 * dt
        caida.malla.position.y += caida.vy * dt
        caida.malla.position.x += caida.vx * dt
        const rMax = Math.max(...Array.from(pz.tronzada!.ext))
        const suelo = -R - 59 + rMax
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
        herr = h ? modeloHerramientaTorno(h, R) : new THREE.Group()
        carro.add(herr)
        giroTorreta += Math.PI / 6
      }
      torreta.rotation.z += (giroTorreta - torreta.rotation.z) * Math.min(1, dt * 6)
      const p = aEscena(s.pos)
      carro.position.set(p.x, p.y, 0)
      marca.position.copy(p)
      // Viruta y refrigerante.
      const corte = s.cortando
      if (corte > 0) viruta.emitir(new THREE.Vector3(p.x, p.y, 2), Math.min(4, 1 + Math.floor(corte)), new THREE.Vector3(0.5, 0.2, 1))
      viruta.actualizar(dt)
      refri.actualizar(dt, !!paso?.refrigerante && !s.terminado, new THREE.Vector3(p.x + 8, p.y + Math.max(36, R + 8), -10), new THREE.Vector3(p.x + 0.4, p.y + 1.2, 1))
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

function escenaFresa(sim: SimuladorCNC): EscenaMaquina {
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
  raiz.add(malla)
  let versionPieza = pz.version

  // Mesa con ranuras en T, prensa y columna.
  const mesa = caja(L + 160, 30, W + 110, M.fundicion, 3)
  mesa.position.set(L / 2, -H - 30 - 15, -W / 2)
  raiz.add(mesa)
  for (let k = -1; k <= 1; k++) {
    const ranura = new THREE.Mesh(new THREE.BoxGeometry(L + 160, 1, 8), M.negro)
    ranura.position.set(L / 2, -H - 29.5, -W / 2 + k * 35)
    raiz.add(ranura)
  }
  const baseTornillo = caja(L + 40, 30, W + 60, M.aceroOscuro, 3)
  baseTornillo.position.set(L / 2, -H - 15, -W / 2)
  const altoMordaza = Math.min(H * 0.6, H - 3)
  const mordaza1 = caja(L + 30, altoMordaza + 10, 18, M.acero, 2)
  mordaza1.position.set(L / 2, -H + (altoMordaza - 10) / 2, 9)
  const mordaza2 = mordaza1.clone()
  mordaza2.position.z = -W - 9
  raiz.add(baseTornillo, mordaza1, mordaza2)
  const columna = caja(120, 420, 110, M.pintura, 6)
  columna.position.set(L / 2, 60, -W - 170)
  raiz.add(columna)
  const contacto = sombraContacto(Math.max(L, W) * 0.55)
  contacto.rotation.x = -Math.PI / 2
  contacto.position.set(L / 2, -H - 29.2, -W / 2)
  raiz.add(contacto)

  // Cabezal (sube y baja con Z). La nariz queda por encima del bruto aunque la fresa baje al fondo.
  const cabezal = new THREE.Group()
  const despejeHusillo = Math.max(100, H + 46)
  const caja1 = caja(90, 110, 130, M.pintura, 6)
  caja1.position.set(0, despejeHusillo + 72, -78)
  const nariz = cil(26, 26, M.pinturaOscura, 40)
  nariz.position.set(0, despejeHusillo, 0)
  cabezal.add(caja1, nariz)
  const husillo = new THREE.Group()
  husillo.position.y = 0
  cabezal.add(husillo)
  raiz.add(cabezal)
  let herr: THREE.Group | null = null
  let tHerr = -1
  let hHerr: unknown = null
  let angulo = 0

  const boquilla = cil(2.2, 24, M.naranja, 12)
  boquilla.position.set(28, despejeHusillo - 8, 16)
  boquilla.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.35, -0.88, -0.15).normalize())
  cabezal.add(boquilla)

  const viruta = new Viruta(mat.color, -H - 30, 0.8)
  const refri = new Refrigerante()
  raiz.add(viruta.malla, refri.puntos)

  const aEscena = (p: Vec3) => new THREE.Vector3(p.x, p.z, -p.y)
  const tray = lineasTrayectoria(sim, aEscena)
  raiz.add(tray)

  // Ejes del cero pieza.
  const ejes = new THREE.Group()
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
        herr = h ? modeloHerramientaFresa(h, H) : new THREE.Group()
        husillo.add(herr)
      }
      if (herr) herr.rotation.y = angulo
      const p = aEscena(s.pos)
      cabezal.position.copy(p)
      const corte = s.cortando
      if (corte > 0) viruta.emitir(new THREE.Vector3(p.x, p.y + 1, p.z), Math.min(4, 1 + Math.floor(corte / 4)), new THREE.Vector3(0, 0.5, 0.5))
      viruta.actualizar(dt)
      refri.actualizar(dt, !!paso?.refrigerante && !s.terminado, new THREE.Vector3(p.x + 18, p.y + despejeHusillo - 16, p.z + 8), new THREE.Vector3(p.x + 2, p.y + 2, p.z + 1))
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
  /** Play dentro de la escena, cuando está a pantalla completa. */
  play?: PlayEscena
}) {
  const contRef = useRef<HTMLDivElement>(null)
  const envolturaRef = useRef<HTMLDivElement>(null)
  const [pantalla, alternarPantalla] = usePantallaCompleta(envolturaRef)
  const [sinWebGL, setSinWebGL] = useState(false)
  const accionRef = useRef<((v: Vista) => void) | null>(null)
  const [vistaActual, setVistaActual] = useState<Vista>('iso')
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
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    } catch {
      setSinWebGL(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(cont.clientWidth, cont.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.localClippingEnabled = true
    renderer.domElement.style.display = 'block'
    renderer.domElement.dataset.cnc3d = 'si'
    cont.appendChild(renderer.domElement)
    onCanvas?.(renderer.domElement)

    const escena = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    escena.environmentIntensity = 1.2
    escena.background = fondoMaquina()
    const sol = solSuave(0xfff6ec, 2.15)
    sol.shadow.normalBias = 2.2
    sol.shadow.bias = -0.0006
    sol.shadow.radius = 2.5
    escena.add(sol, sol.target, new THREE.HemisphereLight(0xf7f8fa, 0x8a8178, 0.62))

    const camara = new THREE.PerspectiveCamera(35, cont.clientWidth / Math.max(1, cont.clientHeight), 1, 6000)
    const controles = new OrbitControls(camara, renderer.domElement)
    // El botón del medio desplaza la vista. Lo engancha cursoresCamara.
    controles.enableDamping = true
    controles.dampingFactor = 0.08
    controles.zoomToCursor = true
    controlesRef.current = controles
    aplicarModoArrastre(controles, modoArrastre)
    const quitarCursores = cursoresCamara(controles, renderer.domElement)

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
    const cubo = crearViewCube(camara, renderer, controles, cont, 'viewcube-cnc', () => accionRef.current?.('iso'))

    const sonido = new SonidoCNC()
    const activarSonido = () => {
      if (vista.current.sonido) sonido.activar()
    }
    renderer.domElement.addEventListener('pointerdown', activarSonido)

    const observador = new ResizeObserver(() => {
      renderer.setSize(cont.clientWidth, cont.clientHeight)
      camara.aspect = cont.clientWidth / Math.max(1, cont.clientHeight)
      camara.updateProjectionMatrix()
      cubo.actualizar()
    })
    observador.observe(cont)

    let vivo = true
    let antes = performance.now()
    const tam = new THREE.Vector2()
    const bucle = () => {
      if (!vivo) return
      requestAnimationFrame(bucle)
      const ahora = performance.now()
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
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
      controles.update()
      renderer.render(escena, camara)
      cubo.render()
    }
    requestAnimationFrame(bucle)

    return () => {
      vivo = false
      observador.disconnect()
      renderer.domElement.removeEventListener('pointerdown', activarSonido)
      sonido.cerrar()
      controlesRef.current = null
      onCanvas?.(null)
      quitarCursores()
      controles.dispose()
      cubo.dispose()
      renderer.dispose()
      pmrem.dispose()
      cont.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (sinWebGL) {
    return <p style={{ padding: 20, color: '#8a5b00' }}>Este navegador no tiene WebGL: la vista 3D no está disponible. El editor y la vista 2D siguen funcionando.</p>
  }
  return (
    <div ref={envolturaRef} style={{ position: 'relative', height: pantalla ? '100%' : typeof alto === 'string' ? alto : undefined, background: '#eef1f4' }}>
      <div ref={contRef} style={{ width: '100%', height: pantalla ? '100%' : alto, borderRadius: 8, overflow: 'hidden', background: '#eef1f4' }} />
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
        {(
          [
            ['iso', '3D'],
            ['frente', 'Frente'],
            ['arriba', 'Arriba'],
          ] as Array<[Vista, string]>
        ).map(([v, t]) => (
          <button
            key={v}
            onClick={() => accionRef.current?.(v)}
            aria-pressed={vistaActual === v}
            style={{
              border: '1px solid #c6ced6',
              background: vistaActual === v ? '#33475c' : 'rgba(255,255,255,0.9)',
              color: vistaActual === v ? '#fff' : '#33475c',
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
        <BotonPantallaCompleta activa={pantalla} onAlternar={alternarPantalla} estilo={{ border: '1px solid #c6ced6', background: 'rgba(255,255,255,0.9)', color: '#33475c', borderRadius: 6, padding: '2px 8px', fontSize: '0.78rem', cursor: 'pointer' }} />
      </div>
      {pantalla && (
        <HudEscena
          play={play}
          vista={vistaActual}
          onVista={(v) => accionRef.current?.(v)}
          modo={modoArrastre}
          onModo={setModoArrastre}
          onZoom={(si) => controlesRef.current && zoomCamara(controlesRef.current, si)}
        />
      )}
    </div>
  )
}
