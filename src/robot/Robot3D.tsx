/**
 * Celda robótica en 3D: el brazo KUKA articulado eje por eje, su pedestal,
 * el mesón con la plancha, la herramienta montada, la vista previa de la
 * geometría de la definición (curvas, puntos y planos, como en Rhino), la
 * trayectoria coloreada según el análisis y el desbaste de la plancha:
 * el volumen por donde pasó la fresa desaparece y, al cortar, sale viruta.
 *
 * La escena está en milímetros; el robot usa Z hacia arriba (como KUKA y
 * Rhino) y se gira para three.js, que usa Y hacia arriba.
 */
import { type PlayEscena } from '../components/HudEscena'
import { aplicarModoArrastre, girarCuadrante, zoomCamara, type LadoCubo, type ModoArrastre } from '../components/mandoCamara'
import BotonPantallaCompleta, { usePantallaCompleta } from '../components/PantallaCompleta'
import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react'
import { crearEscena } from '../vista3d/escena'
import { type ViewCube } from '../vista3d/viewcube'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { entornoEstudio, sombraContacto } from '../vista3d/realista'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { aMundo, aplicar, matrizPlano, rad, type Plano, type V3 } from './matematica'
import type { Simulacion } from './movimiento'
import type { Herramienta } from './nodos'
import type { ModeloRobot } from './robots'
import { StockPlancha, Virutas } from './stock'

export interface Previa {
  curvas: V3[][]
  puntos: V3[]
  planos: Plano[]
}

export interface VistaRobot {
  modelo: ModeloRobot
  pedestal: number
  herramienta: Herramienta
  /** Cero de la pieza en el mundo. */
  base: Plano
  espesor: number
  /** Tamaño de la plancha en coordenadas de la base (o null: por omisión). */
  placa: { x0: number; y0: number; x1: number; y1: number } | null
  q: number[]
  /** Geometría de la definición (coordenadas de la base). */
  previa: Previa
  seleccion: Previa
  sim: Simulacion | null
  /** Índice de la muestra actual de la simulación. */
  indice: number
  /** ▶ en marcha. En pausa la viruta se apaga. */
  corriendo: boolean
  husillo: boolean
  alcance: boolean
  /** Puntos enseñados con el mando (mundo). */
  marcas: V3[]
}

/** Fondo con más contraste que el de las otras escenas: gris azulado que se oscurece hacia el piso. */
function fondoContraste(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#bcd3ea')
  grad.addColorStop(0.55, '#d9e4ee')
  grad.addColorStop(1, '#e6e8ea')
  g.fillStyle = grad
  g.fillRect(0, 0, 2, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const NARANJA = new THREE.MeshPhysicalMaterial({ color: 0xf26a18, metalness: 0.1, roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.28 })
// Tapas, motores y juntas: grafito, para que el brazo no sea un solo bloque naranjo.
const GRAFITO = new THREE.MeshPhysicalMaterial({ color: 0x343b45, metalness: 0.3, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.5 })
const ALUMINIO = new THREE.MeshStandardMaterial({ color: 0xb4bcc5, metalness: 0.88, roughness: 0.34 })
const NEGRO = new THREE.MeshPhysicalMaterial({ color: 0x1a1d22, metalness: 0.35, roughness: 0.46, clearcoat: 0.3, clearcoatRoughness: 0.4 })
const GRIS = new THREE.MeshPhysicalMaterial({ color: 0xd7dde4, metalness: 0.96, roughness: 0.16, clearcoat: 0.25 })
const MESON = new THREE.MeshStandardMaterial({ color: 0x2c3a4c, metalness: 0.55, roughness: 0.34, envMapIntensity: 1.2 })
const ACERO = new THREE.MeshPhysicalMaterial({ color: 0xf4f1ea, metalness: 1, roughness: 0.12, clearcoat: 0.2 })
const HUSILLO = new THREE.MeshPhysicalMaterial({ color: 0x2a323d, metalness: 0.75, roughness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.2 })

function caja(w: number, h: number, d: number, mat: THREE.Material, r = 6): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)), mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}
/** Cilindro a lo largo del eje indicado del grupo. */
function cil(r: number, l: number, mat: THREE.Material, eje: 'x' | 'y' | 'z', seg = 32, r2 = r): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, l, seg), mat)
  if (eje === 'x') m.rotation.z = -Math.PI / 2
  if (eje === 'z') m.rotation.x = Math.PI / 2
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** Rótulo del modelo pintado en el brazo. Una textura por texto. */
const rotulos = new Map<string, THREE.CanvasTexture>()
function rotuloModelo(texto: string): THREE.CanvasTexture {
  let t = rotulos.get(texto)
  if (!t) {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#ffffff'
    g.font = '700 84px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(texto, 256, 68, 492)
    t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    rotulos.set(texto, t)
  }
  return t
}

const tv = (p: V3) => new THREE.Vector3(p.x, p.y, p.z)

/** Índice de muestra, con la fracción entre dos poses, para abrir el surco junto a la punta. */
function indiceVisual(sim: Simulacion, q: number[], i: number): number {
  const m = sim.muestras
  const lo = Math.max(0, Math.min(m.length - 1, i | 0))
  const hi = Math.min(m.length - 1, lo + 1)
  if (hi === lo) return lo
  const a = m[lo]
  const b = m[hi]
  let num = 0
  let den = 0
  const n = Math.min(q.length, a.q.length, b.q.length)
  for (let k = 0; k < n; k++) {
    const d = b.q[k] - a.q[k]
    den += d * d
    num += d * (q[k] - a.q[k])
  }
  const f = den > 1e-8 ? Math.max(0, Math.min(1, num / den)) : 0
  return lo + f
}

/** LIN/CIR con la punta bajo la cara superior. Un PTP, aunque baje, no corta. */
function cortandoAhora(sim: Simulacion, indice: number, zCara: number): boolean {
  const m = sim.muestras
  const lo = Math.max(0, Math.min(m.length - 1, Math.floor(indice)))
  const hi = Math.min(m.length - 1, lo + 1)
  if (hi === lo || !m[hi].corta) return false
  const f = indice - lo
  const z = m[lo].tcp.z + (m[hi].tcp.z - m[lo].tcp.z) * f
  return zCara - z > 0.2
}

interface ModeloArmado {
  raiz: THREE.Group
  g: THREE.Group[]
  punta: THREE.Group
  giroHerramienta: THREE.Object3D | null
}

/** Arma el brazo como una cadena de grupos que giran igual que los ejes. */
function armarRobot(m: ModeloRobot, pedestal: number, h: Herramienta): ModeloArmado {
  const s = m.a2 / 455 // escala de los volúmenes respecto del KR 6
  const raiz = new THREE.Group()
  const contacto = sombraContacto(220 * s + 80)
  contacto.position.z = 1.5
  raiz.add(contacto)
  if (pedestal > 0) {
    const ped = caja(260 * s + 60, pedestal, 260 * s + 60, NEGRO, 8)
    ped.position.set(0, 0, pedestal / 2)
    ped.rotation.x = Math.PI / 2
    raiz.add(ped)
  }
  const g0 = new THREE.Group()
  g0.position.set(0, 0, pedestal)
  raiz.add(g0)
  const pie = cil(120 * s, 40 * s, NEGRO, 'z', 40, 135 * s)
  pie.position.z = 20 * s
  // Placa de anclaje con sus cuatro pernos.
  const placa = caja(320 * s, 320 * s, 10 * s, GRAFITO, 3 * s)
  placa.position.z = 5 * s
  g0.add(pie, placa)
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const perno = cil(10 * s, 8 * s, ACERO, 'z', 6)
    perno.position.set(sx * 135 * s, sy * 135 * s, 13 * s)
    g0.add(perno)
  }
  const junta1 = cil(101 * s, 10 * s, ALUMINIO, 'z', 40)
  junta1.position.z = 45 * s
  g0.add(junta1)
  // A1
  const g1 = new THREE.Group()
  g0.add(g1)
  const torre = cil(95 * s, m.d1 - 110 * s, NARANJA, 'z', 40)
  torre.position.z = 40 * s + (m.d1 - 110 * s) / 2
  const hombro = caja(Math.max(m.a1 * 2 + 150 * s, 170 * s), 150 * s, 150 * s, NARANJA)
  hombro.position.set(m.a1 / 2, 0, m.d1 - 20 * s)
  hombro.rotation.x = Math.PI / 2
  g1.add(torre, hombro)
  const motor1 = cil(45 * s, 90 * s, GRAFITO, 'z')
  motor1.position.set(-80 * s, 0, m.d1 * 0.55)
  const tapa1 = cil(47 * s, 10 * s, NEGRO, 'z')
  tapa1.position.set(-80 * s, 0, m.d1 * 0.55 + 50 * s)
  g1.add(motor1, tapa1)
  // A2
  const g2 = new THREE.Group()
  g2.position.set(m.a1, 0, m.d1)
  g1.add(g2)
  const eje2 = cil(80 * s, 190 * s, NARANJA, 'y')
  const brazo = caja(m.a2, 110 * s, 90 * s, NARANJA, 14 * s)
  brazo.position.set(m.a2 / 2, -60 * s, 0)
  brazo.rotation.x = Math.PI / 2
  const motor2 = cil(48 * s, 90 * s, GRAFITO, 'y')
  motor2.position.set(0, 120 * s, 0)
  const tapa2 = cil(40 * s, 6 * s, ALUMINIO, 'y')
  tapa2.position.set(0, 168 * s, 0)
  g2.add(eje2, brazo, motor2, tapa2)
  // Tapas de las articulaciones A2 y A3 en la cara de afuera del brazo.
  for (const [x, r] of [
    [0, 56],
    [m.a2, 46],
  ]) {
    const tapa = cil(r * s, 8 * s, GRAFITO, 'y', 40)
    tapa.position.set(x, -108 * s, 0)
    const centro = cil(r * 0.36 * s, 6 * s, ALUMINIO, 'y', 24)
    centro.position.set(x, -113 * s, 0)
    g2.add(tapa, centro)
  }
  // Rótulo del modelo, en blanco, entre las dos tapas.
  const rotulo = new THREE.Mesh(
    new THREE.PlaneGeometry(m.a2 * 0.5, m.a2 * 0.125),
    new THREE.MeshStandardMaterial({ map: rotuloModelo(m.nombre.replace(/ sixx.*| \(.*/, '')), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
  )
  rotulo.rotation.x = Math.PI / 2
  rotulo.position.set(m.a2 / 2, -105.6 * s, 0)
  g2.add(rotulo)
  // A3
  const g3 = new THREE.Group()
  g3.position.set(m.a2, 0, 0)
  g2.add(g3)
  const codo = cil(70 * s, 170 * s, NARANJA, 'y')
  const caja3 = caja(170 * s, 130 * s, 150 * s, NARANJA)
  caja3.position.set(-30 * s, 0, m.a3)
  caja3.rotation.x = Math.PI / 2
  const tapa3 = cil(52 * s, 8 * s, GRAFITO, 'y', 40)
  tapa3.position.set(0, 88 * s, 0)
  const centro3 = cil(19 * s, 6 * s, ALUMINIO, 'y', 24)
  centro3.position.set(0, 93 * s, 0)
  // Motor de la muñeca, detrás del codo.
  const motor4 = cil(40 * s, 70 * s, GRAFITO, 'x')
  motor4.position.set(-150 * s, 0, m.a3)
  g3.add(codo, caja3, tapa3, centro3, motor4)
  // A4 (antebrazo)
  const g4 = new THREE.Group()
  g4.position.set(0, 0, m.a3)
  g3.add(g4)
  // El antebrazo llega hasta la horquilla de la muñeca: entre los dos no queda aire.
  const largoAnte = m.d4 - 70 * s
  const antebrazo = cil(55 * s, largoAnte, NARANJA, 'x', 32, 45 * s)
  antebrazo.position.x = largoAnte / 2
  // Junta de giro del antebrazo (A4).
  const junta4 = cil(59 * s, 12 * s, GRAFITO, 'x', 40)
  junta4.position.x = 61 * s
  // Horquilla: un puente detrás de la muñeca y dos placas a los lados, como en un KUKA real.
  const puente = caja(44 * s, 150 * s, 76 * s, NARANJA, 8 * s)
  puente.position.x = m.d4 - 62 * s
  g4.add(antebrazo, junta4, puente)
  for (const lado of [-1, 1]) {
    const placaM = caja(96 * s, 14 * s, 84 * s, NARANJA, 6 * s)
    placaM.position.set(m.d4 - 30 * s, lado * 68 * s, 0)
    g4.add(placaM)
  }
  // A5 (muñeca)
  const g5 = new THREE.Group()
  g5.position.set(m.d4, 0, 0)
  g4.add(g5)
  const muneca = cil(42 * s, 110 * s, NARANJA, 'y')
  g5.add(muneca)
  for (const lado of [-1, 1]) {
    const tapa = cil(31 * s, 6 * s, GRAFITO, 'y', 32)
    tapa.position.y = lado * 58 * s
    g5.add(tapa)
  }
  // A6 (flange)
  const g6 = new THREE.Group()
  g5.add(g6)
  const cuello = cil(34 * s, m.d6 - 10 * s, NARANJA, 'x')
  cuello.position.x = (m.d6 - 10 * s) / 2
  const flange = cil(32 * s, 12 * s, GRIS, 'x')
  flange.position.x = m.d6 - 6 * s
  const junta6 = cil(36 * s, 5 * s, GRAFITO, 'x')
  junta6.position.x = m.d6 - 15 * s
  g6.add(cuello, flange, junta6)
  // Herramienta: desde el flange (x = d6) hasta el TCP (x = d6 + largo).
  const herr = new THREE.Group()
  herr.position.x = m.d6
  g6.add(herr)
  let giro: THREE.Object3D | null = null
  const L = h.largo
  if (h.tipo === 'fresa' || h.tipo === 'taladro') {
    const cuerpo = cil(38, L * 0.55, h.tipo === 'fresa' ? HUSILLO : NEGRO, 'x')
    cuerpo.position.x = L * 0.3
    const nariz = cil(22, L * 0.12, GRIS, 'x', 24, 30)
    nariz.position.x = L * 0.63
    giro = new THREE.Group()
    const filo = cil(h.diametro / 2, L * 0.28, ACERO, 'x', 16)
    filo.position.x = L * 0.86
    const vastago = cil(Math.max(3, h.diametro / 2), L * 0.08, ACERO, 'x')
    vastago.position.x = L * 0.71
    giro.add(filo, vastago)
    herr.add(cuerpo, nariz, giro)
  } else if (h.tipo === 'ventosa') {
    const vara = cil(12, L * 0.8, GRIS, 'x')
    vara.position.x = L * 0.4
    const copa = cil(h.diametro / 2, L * 0.2, NEGRO, 'x', 32, 10)
    copa.position.x = L * 0.9
    herr.add(vara, copa)
  } else if (h.tipo === 'lapiz') {
    const soporte = caja(40, 60, 60, NEGRO)
    soporte.position.x = 20
    const lapiz = cil(h.diametro / 2, L * 0.85, new THREE.MeshStandardMaterial({ color: 0x1f6fb2, roughness: 0.5 }), 'x')
    lapiz.position.x = L * 0.5
    const punta = cil(0.5, L * 0.1, NEGRO, 'x', 16, h.diametro / 2)
    punta.position.x = L * 0.95
    herr.add(soporte, lapiz, punta)
  } else {
    const c = cil(h.diametro / 2, L, GRIS, 'x')
    c.position.x = L / 2
    herr.add(c)
  }
  const punta = new THREE.Group()
  punta.position.x = m.d6 + L
  g6.add(punta)
  return { raiz, g: [g1, g2, g3, g4, g5, g6], punta, giroHerramienta: giro }
}

function ponerEjes(a: ModeloArmado, q: number[]) {
  a.g[0].rotation.set(0, 0, rad(q[0]))
  a.g[1].rotation.set(0, rad(q[1]), 0)
  a.g[2].rotation.set(0, rad(q[2]), 0)
  a.g[3].rotation.set(rad(q[3]), 0, 0)
  a.g[4].rotation.set(0, rad(q[4]), 0)
  a.g[5].rotation.set(rad(q[5]), 0, 0)
}

/** Previa (curvas, puntos, planos) como líneas, en coordenadas del mundo. */
function lineasPrevia(p: Previa, base: Plano, color: number, tamPlano: number): THREE.Group {
  const g = new THREE.Group()
  const M = matrizPlano(base)
  const w = (q: V3) => {
    const r = aplicar(M, q)
    return new THREE.Vector3(base.o.x + r.x, base.o.y + r.y, base.o.z + r.z + 0.35)
  }
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
  for (const c of p.curvas) {
    if (c.length < 2) continue
    const geo = new THREE.BufferGeometry().setFromPoints([...c.map(w), w(c[0])])
    const l = new THREE.Line(geo, mat)
    l.renderOrder = 5
    g.add(l)
  }
  if (p.puntos.length) {
    const pts: THREE.Vector3[] = []
    const s = tamPlano * 0.25
    for (const q of p.puntos) {
      const c = w(q)
      pts.push(c.clone().add(new THREE.Vector3(-s, 0, 0)), c.clone().add(new THREE.Vector3(s, 0, 0)), c.clone().add(new THREE.Vector3(0, -s, 0)), c.clone().add(new THREE.Vector3(0, s, 0)))
    }
    const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat)
    l.renderOrder = 5
    g.add(l)
  }
  if (p.planos.length) {
    const pos: number[] = []
    const col: number[] = []
    const ejes: Array<[keyof Plano, [number, number, number]]> = [
      ['x', [0.85, 0.15, 0.15]],
      ['y', [0.15, 0.65, 0.2]],
      ['z', [0.1, 0.35, 0.9]],
    ]
    const paso = Math.max(1, Math.floor(p.planos.length / 300))
    for (let i = 0; i < p.planos.length; i += paso) {
      const pl = aMundo(base, p.planos[i])
      for (const [k, c] of ejes) {
        const d = pl[k] as V3
        pos.push(pl.o.x, pl.o.y, pl.o.z, pl.o.x + d.x * tamPlano, pl.o.y + d.y * tamPlano, pl.o.z + d.z * tamPlano)
        col.push(...c, ...c)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.9 }))
    l.renderOrder = 6
    g.add(l)
  }
  return g
}

type Vista = 'iso' | 'frente' | 'arriba' | 'lado'

export default function Robot3D({
  vista,
  alto = 480,
  onCanvas,
  play,
  encabezado,
  sinDetalle = false,
  grabando = false,
}: {
  vista: MutableRefObject<VistaRobot>
  alto?: number | string
  onCanvas?: (c: HTMLCanvasElement | null) => void
  /** Play dentro de la escena, cuando está a pantalla completa. */
  play?: PlayEscena
  /** Título y avisos, a la izquierda de los controles de vista. */
  encabezado?: ReactNode
  /** Sin el botón «Seguir el corte» (en Estudiar no hay corte). */
  sinDetalle?: boolean
  /** Mientras se graba video del lienzo (`captureStream`) se dibuja en cada cuadro, aunque nada cambie. */
  grabando?: boolean
}) {
  const contRef = useRef<HTMLDivElement>(null)
  const envolturaRef = useRef<HTMLDivElement>(null)
  const [pantalla, alternarPantalla] = usePantallaCompleta(envolturaRef)
  const [sinWebGL, setSinWebGL] = useState(false)
  const accion = useRef<((v: Vista) => void) | null>(null)
  const [, setVistaActual] = useState<Vista>('iso')
  const [detalle, setDetalle] = useState(false)
  const [hayCorte, setHayCorte] = useState(false)
  const detalleRef = useRef(false)
  detalleRef.current = detalle
  const grabandoRef = useRef(false)
  grabandoRef.current = grabando
  const [modoArrastre, setModoArrastre] = useState<ModoArrastre>('girar')
  const controlesRef = useRef<OrbitControls | null>(null)
  const gizmoRef = useRef<ViewCube | null>(null)
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
      camara: { fov: 40, near: 5, far: 30000 },
      controles: { enableDamping: true, dampingFactor: 0.08, zoomToCursor: true },
      modoArrastre,
      viewCube: { id: 'viewcube-robot', alInicio: () => accion.current?.('iso') },
      // Dibujar solo cuando algo cambia: con todo quieto, la escena no llama a render.
      // Se enciende con la cámara, el puntero, el tamaño y cualquier cambio de
      // `vista.current` (ver `cambioVista`).
      soloSiCambia: true,
    })
    if (!base) {
      setSinWebGL(true)
      return
    }
    const { renderer, escena, camara, controles, cubo: gizmo, marcarSucio } = base
    renderer.outputColorSpace = THREE.SRGBColorSpace
    // Neutral conserva el color de la pintura. ACES lavaba el naranjo hacia el salmón.
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 0.92
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.display = 'block'
    renderer.domElement.dataset.robot3d = 'si'
    onCanvas?.(renderer.domElement)

    const pmrem = entornoEstudio(renderer, escena, 0.8)
    const fondo = fondoContraste()
    escena.background = fondo
    // Mundo con Z hacia arriba.
    const mundo = new THREE.Group()
    mundo.rotation.x = -Math.PI / 2
    escena.add(mundo)
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: 0xaab2bc, roughness: 0.86, metalness: 0.02, envMapIntensity: 0.5 }))
    piso.receiveShadow = true
    mundo.add(piso)
    const grilla = new THREE.GridHelper(6000, 40, 0x8f99a6, 0xaab2bc)
    grilla.rotation.x = Math.PI / 2
    grilla.position.z = 1
    for (const m of Array.isArray(grilla.material) ? grilla.material : [grilla.material]) {
      m.transparent = true
      m.opacity = 0.35
    }
    mundo.add(grilla)
    const ejesMundo = new THREE.AxesHelper(250)
    ejesMundo.position.z = 1
    mundo.add(ejesMundo)
    const sol = new THREE.DirectionalLight(0xfff6ec, 2.7)
    sol.castShadow = true
    // Mapa de sombras según el equipo: 4096 solo en pantallas densas y lienzos anchos.
    const lado = sinDetalle ? 1024 : window.devicePixelRatio < 2 || cont.clientWidth < 700 ? 2048 : 4096
    sol.shadow.mapSize.set(lado, lado)
    sol.shadow.bias = -0.00015
    sol.shadow.normalBias = 0.05
    sol.shadow.radius = 2.2
    Object.assign(sol.shadow.camera, { left: -1600, right: 1800, top: 1800, bottom: -1400, near: 400, far: 6000 })
    sol.position.set(1100, 2400, 1600)
    const relleno = new THREE.DirectionalLight(0xbfd0e6, 0.45)
    relleno.position.set(-1400, 900, -400)
    const contra = new THREE.DirectionalLight(0xffd2a8, 0.7)
    contra.position.set(-500, 1400, -2000)
    escena.add(sol, relleno, contra, new THREE.HemisphereLight(0xeaf0f7, 0x8d98a6, 0.4))

    controlesRef.current = controles

    // Partes que se rehacen al cambiar el robot, la herramienta o la definición.
    let robot: ModeloArmado | null = null
    let claveRobot = ''
    let mesa: THREE.Group | null = null
    let claveMesa = ''
    let previa: THREE.Group | null = null
    let prevObj: Previa | null = null
    let selObj: Previa | null = null
    let simObj: Simulacion | null = null
    let camino: THREE.Line | null = null
    // El recorrido de corte sobre la plancha: lo ya cortado en línea llena y lo que falta en línea cortada.
    let corteHecho: LineSegments2 | null = null
    let corteFalta: LineSegments2 | null = null
    const tamLienzo = new THREE.Vector2()
    let finTramo: number[] = []
    const soltarCorte = () => {
      for (const l of [corteHecho, corteFalta]) {
        if (!l) continue
        mundo.remove(l)
        l.geometry.dispose()
        ;(l.material as THREE.Material).dispose()
      }
      corteHecho = null
      corteFalta = null
      finTramo = []
    }
    let stock: StockPlancha | null = null
    let claveCorte = ''
    const virutas = new Virutas()
    mundo.add(virutas.malla)
    const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)')
    const puntaLocal = new THREE.Vector3()
    let esperaViruta = 0
    let puntaAntes: THREE.Vector3 | null = null
    const avanceMm = new THREE.Vector3()
    const objetivoDetalle = new THREE.Vector3()
    let alcance: THREE.Mesh | null = null
    let marcas: THREE.Group | null = null
    let marcasObj: V3[] | null = null
    let angHusillo = 0

    const encuadrar = (v: Vista) => {
      const V = vista.current
      const R = V.modelo.alcance + V.pedestal * 0.3
      const c = new THREE.Vector3(V.base.o.x * 0.38, V.pedestal + V.modelo.d1 + V.modelo.a2 * 0.28, -V.base.o.y * 0.38)
      const d = R * 2.05
      if (v === 'frente') camara.position.set(c.x, c.y + d * 0.08, c.z + d)
      else if (v === 'arriba') camara.position.set(c.x, c.y + d * 0.95, c.z + d * 0.06)
      else if (v === 'lado') camara.position.set(c.x + d, c.y + d * 0.12, c.z)
      else camara.position.set(c.x + d * 0.7, c.y + d * 0.46, c.z + d * 0.58)
      controles.target.copy(c)
      controles.update()
    }
    accion.current = (v) => {
      setVistaActual(v)
      encuadrar(v)
      marcarSucio()
    }
    encuadrar('iso')
    gizmoRef.current = gizmo

    const prev = { q: '', V: null as null | Record<string, unknown> }
    const claves = ['modelo', 'pedestal', 'herramienta', 'base', 'espesor', 'placa', 'previa', 'seleccion', 'sim', 'indice', 'corriendo', 'husillo', 'alcance', 'marcas'] as const
    const cambioVista = (V: VistaRobot) => {
      const q = V.q.join(',')
      let cambio = q !== prev.q || prev.V === null
      if (prev.V) for (const k of claves) if (prev.V[k] !== V[k]) cambio = true
      prev.q = q
      prev.V = Object.fromEntries(claves.map((k) => [k, V[k]]))
      return cambio
    }

    base.alCuadro((dt, ahora) => {
      const V = vista.current
      if (cambioVista(V)) marcarSucio()
      const hayViruta = virutas.malla.count > 0
      // Robot y herramienta.
      const kR = `${V.modelo.id}|${V.pedestal}|${V.herramienta.tipo}|${V.herramienta.largo}|${V.herramienta.diametro}`
      if (kR !== claveRobot) {
        if (robot) mundo.remove(robot.raiz)
        robot = armarRobot(V.modelo, V.pedestal, V.herramienta)
        mundo.add(robot.raiz)
        claveRobot = kR
        cont.dataset.modelo = V.modelo.id
      }
      ponerEjes(robot!, V.q)
      if (robot!.giroHerramienta) {
        if (V.husillo) angHusillo += dt * 40
        robot!.giroHerramienta.rotation.x = angHusillo
      }
      // Mesón y plancha.
      const pl = V.placa ?? { x0: -20, y0: -20, x1: 220, y1: 170 }
      const w = pl.x1 - pl.x0
      const h = pl.y1 - pl.y0
      const kM = `${V.base.o.x}|${V.base.o.y}|${V.base.o.z}|${V.base.x.x}|${V.base.x.y}|${V.espesor}|${pl.x0}|${pl.y0}|${pl.x1}|${pl.y1}`
      if (kM !== claveMesa) {
        if (mesa) {
          if (stock) {
            stock.malla.removeFromParent()
            stock.dispose()
            stock = null
          }
          mesa.traverse((o) => {
            const m = o as THREE.Mesh
            if (m.geometry) m.geometry.dispose()
          })
          mundo.remove(mesa)
        }
        claveCorte = ''
        mesa = new THREE.Group()
        const ang = Math.atan2(V.base.x.y, V.base.x.x)
        const g = new THREE.Group()
        g.position.set(V.base.o.x, V.base.o.y, 0)
        g.rotation.z = ang
        const zTop = V.base.o.z - V.espesor
        if (zTop > 15) {
          const tapa = caja(w + 160, h + 160, 30, MESON, 4)
          tapa.position.set(pl.x0 + w / 2, pl.y0 + h / 2, zTop - 15)
          g.add(tapa)
          for (const [sx, sy] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ]) {
            const pata = caja(40, 40, Math.max(1, zTop - 42), GRAFITO, 3)
            pata.position.set(pl.x0 + w / 2 + sx * (w / 2 + 50), pl.y0 + h / 2 + sy * (h / 2 + 50), 12 + (zTop - 42) / 2)
            // Pata niveladora de acero.
            const nivel = cil(26, 12, ACERO, 'z', 24, 30)
            nivel.position.set(pata.position.x, pata.position.y, 6)
            g.add(pata, nivel)
          }
          // Travesaños del bastidor, a un tercio de la altura.
          if (zTop > 200) {
            const zT = zTop * 0.3
            for (const sy of [-1, 1]) {
              const t = caja(w + 100, 26, 26, GRAFITO, 3)
              t.position.set(pl.x0 + w / 2, pl.y0 + h / 2 + sy * (h / 2 + 50), zT)
              g.add(t)
            }
            for (const sx of [-1, 1]) {
              const t = caja(26, h + 100, 26, GRAFITO, 3)
              t.position.set(pl.x0 + w / 2 + sx * (w / 2 + 50), pl.y0 + h / 2, zT)
              g.add(t)
            }
          }
        }
        if (V.espesor > 0) {
          // Sólida al empezar. El surco se abre después, vértice a vértice.
          stock = new StockPlancha(pl, V.espesor, V.base.o.z)
          g.add(stock.malla)
        }
        const ejesBase = new THREE.AxesHelper(80)
        ejesBase.position.set(0, 0, V.base.o.z + 0.5)
        g.add(ejesBase)
        mesa.add(g)
        mundo.add(mesa)
        claveMesa = kM
      }
      // Vista previa de la definición.
      if (V.previa !== prevObj || V.seleccion !== selObj || kM !== claveMesa) {
        if (previa) mundo.remove(previa)
        previa = new THREE.Group()
        previa.add(lineasPrevia(V.previa, V.base, 0xb3262b, 18))
        previa.add(lineasPrevia(V.seleccion, V.base, 0x2e9d3a, 26))
        mundo.add(previa)
        prevObj = V.previa
        selObj = V.seleccion
      }
      // Trayectoria en el aire (análisis) y ranura en la plancha.
      if (V.sim !== simObj) {
        if (camino) {
          mundo.remove(camino)
          camino.geometry.dispose()
          ;(camino.material as THREE.Material).dispose()
        }
        camino = null
        soltarCorte()
        if (V.sim && V.sim.muestras.length > 1) {
          const ms = V.sim.muestras
          const corta = V.herramienta.tipo === 'fresa' || V.herramienta.tipo === 'taladro'
          const enAire = (z: number) => V.base.o.z - z < 0.12
          const pts: THREE.Vector3[] = []
          const col: number[] = []
          const ptsCorte: THREE.Vector3[] = []
          const tono = (estado: string) => (estado === 'error' ? [0.85, 0.1, 0.1] : estado === 'aviso' ? [0.95, 0.55, 0.05] : [0.12, 0.62, 0.3])
          for (let i = 1; i < ms.length; i++) {
            const a = ms[i - 1]
            const b = ms[i]
            // Dentro del material la marca es el surco y la línea de corte. Un PTP no se esconde.
            if (b.corta && corta && !enAire(a.tcp.z) && !enAire(b.tcp.z)) {
              // Sobre la cara de la plancha, para que se vea desde cualquier ángulo.
              const zc = V.base.o.z + 0.6
              ptsCorte.push(new THREE.Vector3(a.tcp.x, a.tcp.y, zc), new THREE.Vector3(b.tcp.x, b.tcp.y, zc))
              finTramo.push(i)
              continue
            }
            pts.push(tv(a.tcp), tv(b.tcp))
            col.push(...tono(a.estado), ...tono(b.estado))
          }
          if (pts.length > 1) {
            const geo = new THREE.BufferGeometry().setFromPoints(pts)
            geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
            camino = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7 }))
            camino.renderOrder = 4
            mundo.add(camino)
          }
          if (ptsCorte.length > 1) {
            // Líneas gruesas (en píxeles), sin trazos: los tramos son cortos y los trazos se verían como ruido. Lo que falta va al revés, para dibujar solo «los últimos n» tramos.
            const plano = (v: THREE.Vector3[]) => v.flatMap((q) => [q.x, q.y, q.z])
            const alReves: THREE.Vector3[] = []
            for (let t = ptsCorte.length - 2; t >= 0; t -= 2) alReves.push(ptsCorte[t], ptsCorte[t + 1])
            const gFalta = new LineSegmentsGeometry().setPositions(plano(alReves))
            corteFalta = new LineSegments2(gFalta, new LineMaterial({ color: 0x1668c7, linewidth: 2, transparent: true, opacity: 0.6 }))
            corteFalta.renderOrder = 6
            const gHecho = new LineSegmentsGeometry().setPositions(plano(ptsCorte))
            corteHecho = new LineSegments2(gHecho, new LineMaterial({ color: 0xff7a14, linewidth: 3.5 }))
            corteHecho.renderOrder = 7
            mundo.add(corteFalta, corteHecho)
          }
          setHayCorte(!!corteFalta)
        }
        simObj = V.sim
        claveCorte = ''
      }
      const kC = `${claveMesa}|${V.herramienta.tipo}|${V.herramienta.diametro}|${V.espesor}`
      if (stock && kC !== claveCorte) {
        const ang = Math.atan2(V.base.x.y, V.base.x.x)
        const ca = Math.cos(ang)
        const sa = Math.sin(ang)
        const localDe = (p: V3) => {
          const dx = p.x - V.base.o.x
          const dy = p.y - V.base.o.y
          return { x: ca * dx + sa * dy, y: -sa * dx + ca * dy, z: p.z }
        }
        const corta = V.herramienta.tipo === 'fresa' || V.herramienta.tipo === 'taladro'
        stock.cargar(V.sim?.muestras ?? [], Math.max(0.4, V.herramienta.diametro / 2), V.base.o.z, localDe, !!(corta && V.sim))
        claveCorte = kC
      }
      // En el modo detalle se ve el corte limpio: sin la previa ni la línea del centro.
      const limpio = detalleRef.current && !!V.corriendo
      if (previa) previa.visible = !limpio
      if (camino) camino.visible = !limpio
      const iVis = V.sim ? indiceVisual(V.sim, V.q, V.indice) : 0
      if (corteHecho && corteFalta) {
        // Los tramos van en orden: los que ya terminaron se dibujan llenos y el resto cortado.
        let k = 0
        let hi = finTramo.length
        while (k < hi) {
          const m = (k + hi) >> 1
          if (finTramo[m] <= iVis) k = m + 1
          else hi = m
        }
        corteHecho.geometry.instanceCount = k
        corteFalta.geometry.instanceCount = finTramo.length - k
        renderer.getSize(tamLienzo)
        corteHecho.material.resolution.copy(tamLienzo)
        corteFalta.material.resolution.copy(tamLienzo)
        corteHecho.visible = !limpio
        // Con el recorrido a la vista, las líneas del dibujo estorban: se esconden al empezar a cortar.
        if (previa && k > 0) previa.visible = false
      }
      if (stock) stock.aplicar(iVis, ahora / 1000, !V.corriendo)
      const enCorte = !!(V.corriendo && V.sim && cortandoAhora(V.sim, iVis, V.base.o.z) && !menosMovimiento.matches && (V.herramienta.tipo === 'fresa' || V.herramienta.tipo === 'taladro'))
      if (enCorte && robot) {
        virutas.piso = V.base.o.z
        robot.punta.getWorldPosition(puntaLocal)
        mundo.worldToLocal(puntaLocal)
        if (!puntaAntes) puntaAntes = puntaLocal.clone()
        avanceMm.copy(puntaLocal).sub(puntaAntes).divideScalar(Math.max(dt, 1e-3))
        puntaAntes.copy(puntaLocal)
        esperaViruta += dt
        // Más viruta cuanto más gruesa es la fresa y más hondo el corte.
        const prof = Math.max(0, Math.min(V.espesor || 5, V.base.o.z - puntaLocal.z))
        const escala = Math.max(0.5, Math.min(2.6, (V.herramienta.diametro / 5) * (0.55 + prof / Math.max(1, V.espesor || 5) * 0.75)))
        const cada = 0.03 / Math.max(0.6, V.herramienta.diametro / 5)
        while (esperaViruta > cada) {
          esperaViruta -= cada
          virutas.emitir(puntaLocal, avanceMm, escala)
        }
        virutas.actualizar(dt)
      } else {
        esperaViruta = 0
        puntaAntes = null
        virutas.apagar(dt)
      }
      // Alcance máximo aproximado (esfera centrada en el hombro).
      if (V.alcance && !alcance) {
        alcance = new THREE.Mesh(
          new THREE.SphereGeometry(1, 48, 24),
          new THREE.MeshBasicMaterial({ color: 0x1668c7, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }),
        )
        mundo.add(alcance)
      }
      if (alcance) {
        alcance.visible = V.alcance
        alcance.scale.setScalar(V.modelo.alcance + V.modelo.d6 + V.herramienta.largo)
        alcance.position.set(0, 0, V.pedestal + V.modelo.d1)
      }
      // Puntos enseñados con el mando.
      if (V.marcas !== marcasObj) {
        if (marcas) mundo.remove(marcas)
        marcas = new THREE.Group()
        V.marcas.forEach((p, i) => {
          const esf = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 10), new THREE.MeshBasicMaterial({ color: i === V.marcas.length - 1 ? 0xff2d55 : 0x1668c7, depthTest: false }))
          esf.position.copy(tv(p))
          esf.renderOrder = 7
          marcas!.add(esf)
        })
        if (V.marcas.length > 1) {
          const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(V.marcas.map(tv)), new THREE.LineBasicMaterial({ color: 0x1668c7, depthTest: false }))
          l.renderOrder = 6
          marcas.add(l)
        }
        mundo.add(marcas)
        marcasObj = V.marcas
      }
      if (detalleRef.current && robot) {
        robot.punta.getWorldPosition(objetivoDetalle)
        const ant = controles.target.clone()
        controles.target.lerp(objetivoDetalle, 1 - Math.pow(0.001, dt))
        camara.position.add(controles.target.clone().sub(ant))
        const dir = camara.position.clone().sub(controles.target)
        const d = dir.length()
        const meta = 520
        if (Math.abs(d - meta) > 4) camara.position.copy(controles.target).addScaledVector(dir.normalize(), d + (meta - d) * (1 - Math.pow(0.002, dt)))
      }
      // Lo que se mueve solo (reproducción, husillo, viruta, cámara de detalle) dibuja siempre
      // (la base se ocupa de los controles y del cubo de vistas).
      // Grabando video también: captureStream solo toma cuadros cuando el lienzo se vuelve a dibujar.
      if (V.corriendo || V.husillo || detalleRef.current || grabandoRef.current || hayViruta || virutas.malla.count > 0) marcarSucio()
    })

    return () => {
      base.destruir()
      virutas.dispose()
      stock?.dispose()
      soltarCorte()
      controlesRef.current = null
      gizmoRef.current = null
      onCanvas?.(null)
      pmrem.dispose()
      fondo.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const gizmo = gizmoRef.current
    if (!gizmo) return
    const id = requestAnimationFrame(() => gizmo.actualizar())
    return () => cancelAnimationFrame(id)
  }, [pantalla])

  if (sinWebGL) return <p style={{ padding: 20, color: 'var(--naranjo-aviso)' }}>Este navegador no tiene WebGL: la vista 3D no está disponible.</p>
  const llena = pantalla || alto === '100%'
  return (
    <div ref={envolturaRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: llena ? '100%' : undefined, minHeight: 0, background: pantalla ? 'var(--fondo-gris)' : undefined }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8, flex: 'none' }}>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{encabezado}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, flex: '1 1 240px' }} role="toolbar" aria-label="Vistas de la simulación">
          {/* Las vistas (3D, frente, lado, arriba) están en el cubo de vistas. */}
          {!sinDetalle && (
          <button
            type="button"
            onClick={() => setDetalle((d) => !d)}
            aria-pressed={detalle}
            title="La cámara sigue a la herramienta y se acerca al corte"
            data-detalle-corte="si"
            style={{ border: '1px solid var(--borde-suave)', background: detalle ? 'var(--tinta)' : '#fff', color: detalle ? '#fff' : 'var(--tinta-suave)', borderRadius: 8, padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
          >
            Seguir el corte
          </button>
          )}
          <BotonPantallaCompleta activa={pantalla} onAlternar={alternarPantalla} estilo={{ border: '1px solid #e0e5eb', background: '#fff', color: '#51606f', borderRadius: 8, padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }} />
        </div>
      </div>
      <div style={{ position: 'relative', flex: llena ? 1 : undefined, height: llena ? undefined : alto, minHeight: llena ? 0 : undefined, display: 'flex' }}>
        <div ref={contRef} style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, borderRadius: 8, overflow: 'hidden', background: '#e7ebf0' }} />
        {hayCorte && (
          <p className="leyenda-corte" aria-label="Leyenda del corte">
            <span><i className="leyenda-corte__hecho" aria-hidden="true" />Ya cortado</span>
            <span><i className="leyenda-corte__falta" aria-hidden="true" />Por cortar</span>
          </p>
        )}
        <div className="flechas-cubo" role="group" aria-label="Girar la vista 90 grados">
          {(
            [
              ['arriba', 'Vista de arriba', '↑'],
              ['abajo', 'Vista de abajo', '↓'],
              ['izquierda', 'Vista de la izquierda', '←'],
              ['derecha', 'Vista de la derecha', '→'],
            ] as Array<[LadoCubo, string, string]>
          ).map(([lado, titulo, simbolo]) => (
            <button key={lado} type="button" className={`flecha-cubo flecha-cubo--${lado}`} title={titulo} aria-label={titulo} onClick={() => controlesRef.current && girarCuadrante(controlesRef.current, lado)}>
              {simbolo}
            </button>
          ))}
        </div>
        {play && (
          <button
            type="button"
            onClick={play.onClick}
            disabled={play.deshabilitado}
            title={play.titulo ?? play.etiqueta}
            aria-label={play.corriendo ? 'Pausa' : 'Reproducir'}
            data-play-escena="si"
            data-play="si"
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              zIndex: 4,
              width: 46,
              height: 46,
              borderRadius: 12,
              border: 'none',
              background: play.corriendo ? '#ffa726' : 'var(--verde)',
              color: play.corriendo ? 'var(--texto)' : '#fff',
              fontSize: '1.15rem',
              lineHeight: 1,
              cursor: play.deshabilitado ? 'default' : 'pointer',
              opacity: play.deshabilitado ? 0.45 : 1,
              boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
            }}
          >
            {play.corriendo ? '❚❚' : '▶'}
          </button>
        )}
        {pantalla && (
          <div style={barraNav} data-mando-camara="si" role="toolbar" aria-label="Navegación de la cámara">
            <button type="button" aria-pressed={modoArrastre === 'girar'} title="Girar la vista" onClick={() => setModoArrastre('girar')} style={chipNav(modoArrastre === 'girar')}>
              Girar
            </button>
            <button type="button" aria-pressed={modoArrastre === 'mover'} title="Desplazar la vista" onClick={() => setModoArrastre('mover')} style={chipNav(modoArrastre === 'mover')}>
              Mover
            </button>
            <button type="button" title="Acercar" aria-label="Acercar" onClick={() => controlesRef.current && zoomCamara(controlesRef.current, true)} style={chipNav(false)}>
              +
            </button>
            <button type="button" title="Alejar" aria-label="Alejar" onClick={() => controlesRef.current && zoomCamara(controlesRef.current, false)} style={chipNav(false)}>
              −
            </button>
            <button type="button" title="Vista inicial" onClick={() => accion.current?.('iso')} style={chipNav(false)}>
              Inicio
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const barraNav: CSSProperties = {
  position: 'absolute',
  top: 140,
  left: 16,
  zIndex: 5,
  display: 'flex',
  gap: 6,
  padding: 6,
  borderRadius: 10,
  background: 'rgba(30,30,30,0.7)',
  border: '1px solid rgba(255,255,255,0.08)',
}

function chipNav(activo: boolean): CSSProperties {
  return {
    border: '1px solid rgba(255,255,255,0.12)',
    background: activo ? '#3a3a3a' : 'transparent',
    color: '#e0e0e0',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    minWidth: 36,
  }
}
