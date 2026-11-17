/**
 * Celda robótica en 3D: el brazo KUKA articulado eje por eje, su pedestal,
 * el mesón con la plancha, la herramienta montada, la vista previa de la
 * geometría de la definición (curvas, puntos y planos, como en Rhino), la
 * trayectoria coloreada según el análisis y la huella que deja la
 * herramienta sobre la plancha.
 *
 * La escena está en milímetros; el robot usa Z hacia arriba (como KUKA y
 * Rhino) y se gira para three.js, que usa Y hacia arriba.
 */
import { type PlayEscena } from '../components/HudEscena'
import { aplicarModoArrastre, girarCuadrante, zoomCamara, type LadoCubo, type ModoArrastre } from '../components/mandoCamara'
import BotonPantallaCompleta, { usePantallaCompleta } from '../components/PantallaCompleta'
import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react'
import { ViewportGizmo } from 'three-viewport-gizmo'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { aMundo, aplicar, matrizPlano, rad, type Plano, type V3 } from './matematica'
import type { Simulacion } from './movimiento'
import type { Herramienta } from './nodos'
import type { ModeloRobot } from './robots'

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
  husillo: boolean
  alcance: boolean
  /** Puntos enseñados con el mando (mundo). */
  marcas: V3[]
}

const NARANJA = new THREE.MeshPhysicalMaterial({ color: 0xf15a12, metalness: 0.12, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.28 })
const NEGRO = new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.2, roughness: 0.62 })
const GRIS = new THREE.MeshStandardMaterial({ color: 0xc5ccd4, metalness: 0.92, roughness: 0.22 })
const MESON = new THREE.MeshStandardMaterial({ color: 0x8b939c, metalness: 0.35, roughness: 0.48 })
const ACERO = new THREE.MeshStandardMaterial({ color: 0xd5dae0, metalness: 0.95, roughness: 0.18 })
const PLANCHA = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.72, roughness: 0.38 })
const HUSILLO = new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.82, roughness: 0.28 })

/** Fondo claro, el mismo tono que el resto de la app. */
function fondoClaro(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#f7f8fa')
  grad.addColorStop(1, '#e4e8ee')
  g.fillStyle = grad
  g.fillRect(0, 0, 2, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

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

const tv = (p: V3) => new THREE.Vector3(p.x, p.y, p.z)

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
  g0.add(pie)
  // A1
  const g1 = new THREE.Group()
  g0.add(g1)
  const torre = cil(95 * s, m.d1 - 110 * s, NARANJA, 'z', 40)
  torre.position.z = 40 * s + (m.d1 - 110 * s) / 2
  const hombro = caja(Math.max(m.a1 * 2 + 150 * s, 170 * s), 150 * s, 150 * s, NARANJA)
  hombro.position.set(m.a1 / 2, 0, m.d1 - 20 * s)
  hombro.rotation.x = Math.PI / 2
  g1.add(torre, hombro)
  const motor1 = cil(45 * s, 90 * s, NEGRO, 'z')
  motor1.position.set(-80 * s, 0, m.d1 * 0.55)
  g1.add(motor1)
  // A2
  const g2 = new THREE.Group()
  g2.position.set(m.a1, 0, m.d1)
  g1.add(g2)
  const eje2 = cil(80 * s, 190 * s, NARANJA, 'y')
  const brazo = caja(m.a2, 110 * s, 90 * s, NARANJA, 14 * s)
  brazo.position.set(m.a2 / 2, -60 * s, 0)
  brazo.rotation.x = Math.PI / 2
  const motor2 = cil(48 * s, 90 * s, NEGRO, 'y')
  motor2.position.set(0, 120 * s, 0)
  g2.add(eje2, brazo, motor2)
  // A3
  const g3 = new THREE.Group()
  g3.position.set(m.a2, 0, 0)
  g2.add(g3)
  const codo = cil(70 * s, 170 * s, NARANJA, 'y')
  const caja3 = caja(170 * s, 130 * s, 150 * s, NARANJA)
  caja3.position.set(-30 * s, 0, m.a3)
  caja3.rotation.x = Math.PI / 2
  g3.add(codo, caja3)
  // A4 (antebrazo)
  const g4 = new THREE.Group()
  g4.position.set(0, 0, m.a3)
  g3.add(g4)
  const antebrazo = cil(55 * s, m.d4 - 60 * s, NARANJA, 'x', 32, 45 * s)
  antebrazo.position.x = (m.d4 - 60 * s) / 2
  g4.add(antebrazo)
  // A5 (muñeca)
  const g5 = new THREE.Group()
  g5.position.set(m.d4, 0, 0)
  g4.add(g5)
  const muneca = cil(42 * s, 110 * s, NARANJA, 'y')
  g5.add(muneca)
  // A6 (flange)
  const g6 = new THREE.Group()
  g5.add(g6)
  const cuello = cil(34 * s, m.d6 - 10 * s, NARANJA, 'x')
  cuello.position.x = (m.d6 - 10 * s) / 2
  const flange = cil(32 * s, 12 * s, GRIS, 'x')
  flange.position.x = m.d6 - 6 * s
  g6.add(cuello, flange)
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
    return new THREE.Vector3(base.o.x + r.x, base.o.y + r.y, base.o.z + r.z)
  }
  const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 })
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
}: {
  vista: MutableRefObject<VistaRobot>
  alto?: number | string
  onCanvas?: (c: HTMLCanvasElement | null) => void
  /** Play dentro de la escena, cuando está a pantalla completa. */
  play?: PlayEscena
  /** Título y avisos, a la izquierda de los controles de vista. */
  encabezado?: ReactNode
}) {
  const contRef = useRef<HTMLDivElement>(null)
  const envolturaRef = useRef<HTMLDivElement>(null)
  const [pantalla, alternarPantalla] = usePantallaCompleta(envolturaRef)
  const [sinWebGL, setSinWebGL] = useState(false)
  const accion = useRef<((v: Vista) => void) | null>(null)
  const [vistaActual, setVistaActual] = useState<Vista>('iso')
  const [modoArrastre, setModoArrastre] = useState<ModoArrastre>('girar')
  const controlesRef = useRef<OrbitControls | null>(null)
  const gizmoRef = useRef<ViewportGizmo | null>(null)
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
    renderer.toneMappingExposure = 1.08
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.display = 'block'
    renderer.domElement.dataset.robot3d = 'si'
    cont.appendChild(renderer.domElement)
    onCanvas?.(renderer.domElement)

    const escena = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const fondo = fondoClaro()
    escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    escena.environmentIntensity = 0.55
    escena.background = fondo
    // Mundo con Z hacia arriba.
    const mundo = new THREE.Group()
    mundo.rotation.x = -Math.PI / 2
    escena.add(mundo)
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: 0xe7ebf0, roughness: 0.92, metalness: 0.02 }))
    piso.receiveShadow = true
    mundo.add(piso)
    const grilla = new THREE.GridHelper(6000, 40, 0x9aa3ad, 0xb7c0c9)
    grilla.rotation.x = Math.PI / 2
    grilla.position.z = 1
    for (const m of Array.isArray(grilla.material) ? grilla.material : [grilla.material]) {
      m.transparent = true
      m.opacity = 0.85
    }
    mundo.add(grilla)
    const ejesMundo = new THREE.AxesHelper(250)
    ejesMundo.position.z = 1
    mundo.add(ejesMundo)
    const sol = new THREE.DirectionalLight(0xfff3e4, 2.6)
    sol.castShadow = true
    sol.shadow.mapSize.set(2048, 2048)
    sol.shadow.bias = -0.0002
    sol.shadow.normalBias = 0.04
    sol.shadow.radius = 3
    Object.assign(sol.shadow.camera, { left: -1600, right: 1800, top: 1800, bottom: -1400, near: 400, far: 6000 })
    sol.position.set(1100, 2400, 1600)
    const relleno = new THREE.DirectionalLight(0xc5d4e8, 0.55)
    relleno.position.set(-1400, 900, -400)
    const contra = new THREE.DirectionalLight(0xffd2a8, 0.7)
    contra.position.set(-500, 1400, -2000)
    escena.add(sol, relleno, contra, new THREE.HemisphereLight(0xf4f7fb, 0xd5dbe3, 0.65))

    const camara = new THREE.PerspectiveCamera(40, cont.clientWidth / Math.max(1, cont.clientHeight), 5, 30000)
    const controles = new OrbitControls(camara, renderer.domElement)
    // El botón del medio (la rueda apretada) también gira la cámara, sin el autodesplazamiento del navegador.
    controles.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE
    renderer.domElement.addEventListener('mousedown', (e) => e.button === 1 && e.preventDefault())
    controles.enableDamping = true
    controles.dampingFactor = 0.08
    controles.zoomToCursor = true
    controlesRef.current = controles
    aplicarModoArrastre(controles, modoArrastre)

    // Gris con contraste sobre el fondo claro. Al pasar el mouse la cara se oscurece.
    const cara = {
      color: '#6d737b',
      labelColor: '#ffffff',
      opacity: 0.82,
      border: { size: 1.5, color: '#3a3a3a' },
      hover: { color: '#3a3e44', labelColor: '#ffffff', opacity: 0.96, border: { size: 1.5, color: '#2a2a2a' } },
    }
    const gizmo = new ViewportGizmo(camara, renderer, {
      container: cont,
      type: 'cube',
      placement: 'top-left',
      size: 100,
      offset: { top: 16, left: 16, right: 12, bottom: 12 },
      animated: true,
      speed: 1,
      radius: 0.08,
      resolution: 256,
      id: 'viewcube-robot',
      background: { enabled: false },
      font: { family: 'system-ui, sans-serif', weight: 600 },
      corners: {
        enabled: true,
        color: '#8d939b',
        opacity: 0,
        scale: 0.18,
        radius: 0.2,
        hover: { color: '#3a3e44', opacity: 0.95, scale: 0.22 },
      },
      edges: {
        enabled: true,
        color: '#5c6168',
        opacity: 0.75,
        scale: 0.7,
        radius: 0.12,
        hover: { color: '#3a3e44', opacity: 0.95, scale: 0.85 },
      },
      front: { ...cara, label: 'Frente' },
      top: { ...cara, label: 'Arriba' },
      right: { ...cara, label: 'Derecha' },
      left: { ...cara, label: 'Izquierda' },
      bottom: { ...cara, label: 'Abajo' },
      back: { ...cara, label: 'Atrás' },
    })
    gizmo.attachControls(controles as Parameters<ViewportGizmo['attachControls']>[0])
    gizmoRef.current = gizmo

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
    let huella: THREE.LineSegments | null = null
    let huellaIdx: number[] = []
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
    }
    encuadrar('iso')

    const observador = new ResizeObserver(() => {
      renderer.setSize(cont.clientWidth, cont.clientHeight)
      camara.aspect = cont.clientWidth / Math.max(1, cont.clientHeight)
      camara.updateProjectionMatrix()
      gizmo.domUpdate()
    })
    observador.observe(cont)

    let vivo = true
    let antes = performance.now()
    const bucle = () => {
      if (!vivo) return
      requestAnimationFrame(bucle)
      const ahora = performance.now()
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      const V = vista.current
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
      const kM = `${V.base.o.x}|${V.base.o.y}|${V.base.o.z}|${V.base.x.x}|${V.base.x.y}|${V.espesor}|${pl.x0}|${pl.y0}|${pl.x1}|${pl.y1}`
      if (kM !== claveMesa) {
        if (mesa) mundo.remove(mesa)
        mesa = new THREE.Group()
        const ang = Math.atan2(V.base.x.y, V.base.x.x)
        const g = new THREE.Group()
        g.position.set(V.base.o.x, V.base.o.y, 0)
        g.rotation.z = ang
        const w = pl.x1 - pl.x0
        const h = pl.y1 - pl.y0
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
            const pata = caja(40, 40, Math.max(1, zTop - 30), NEGRO, 3)
            pata.position.set(pl.x0 + w / 2 + sx * (w / 2 + 50), pl.y0 + h / 2 + sy * (h / 2 + 50), (zTop - 30) / 2)
            g.add(pata)
          }
        }
        if (V.espesor > 0) {
          const plancha = caja(w, h, V.espesor, PLANCHA, 1)
          plancha.position.set(pl.x0 + w / 2, pl.y0 + h / 2, V.base.o.z - V.espesor / 2)
          g.add(plancha)
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
      // Trayectoria simulada y huella sobre la plancha.
      if (V.sim !== simObj) {
        if (camino) mundo.remove(camino)
        if (huella) mundo.remove(huella)
        camino = null
        huella = null
        huellaIdx = []
        if (V.sim && V.sim.muestras.length > 1) {
          const ms = V.sim.muestras
          const geo = new THREE.BufferGeometry().setFromPoints(ms.map((m) => tv(m.tcp)))
          const col: number[] = []
          for (const m of ms) col.push(...(m.estado === 'error' ? [0.85, 0.1, 0.1] : m.estado === 'aviso' ? [0.95, 0.55, 0.05] : [0.12, 0.62, 0.3]))
          geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
          camino = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthTest: false }))
          camino.renderOrder = 4
          mundo.add(camino)
          const pos: number[] = []
          for (let i = 1; i < ms.length; i++) {
            if (ms[i].enPieza && ms[i - 1].enPieza) {
              pos.push(ms[i - 1].tcp.x, ms[i - 1].tcp.y, V.base.o.z + 0.6, ms[i].tcp.x, ms[i].tcp.y, V.base.o.z + 0.6)
              huellaIdx.push(i)
            }
          }
          if (pos.length) {
            const hg = new THREE.BufferGeometry()
            hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
            huella = new THREE.LineSegments(hg, new THREE.LineBasicMaterial({ color: 0x1b1f24 }))
            mundo.add(huella)
          }
        }
        simObj = V.sim
      }
      if (huella) {
        // Sólo lo ya recorrido.
        let k = 0
        while (k < huellaIdx.length && huellaIdx[k] <= V.indice) k++
        huella.geometry.setDrawRange(0, k * 2)
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
      controles.update()
      renderer.render(escena, camara)
      gizmo.render()
    }
    requestAnimationFrame(bucle)

    return () => {
      vivo = false
      observador.disconnect()
      controlesRef.current = null
      gizmoRef.current = null
      onCanvas?.(null)
      gizmo.dispose()
      controles.dispose()
      renderer.dispose()
      pmrem.dispose()
      fondo.dispose()
      cont.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const gizmo = gizmoRef.current
    if (!gizmo) return
    const id = requestAnimationFrame(() => gizmo.domUpdate())
    return () => cancelAnimationFrame(id)
  }, [pantalla])

  if (sinWebGL) return <p style={{ padding: 20, color: '#8a5b00' }}>Este navegador no tiene WebGL: la vista 3D no está disponible.</p>
  const llena = pantalla || alto === '100%'
  return (
    <div ref={envolturaRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: llena ? '100%' : undefined, minHeight: 0, background: pantalla ? '#eef1f4' : undefined }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8, flex: 'none' }}>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{encabezado}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, flex: '1 1 240px' }} role="toolbar" aria-label="Vistas de la simulación">
          {!pantalla &&
            (
              [
                ['iso', '3D'],
                ['frente', 'Frente'],
                ['lado', 'Lado'],
                ['arriba', 'Arriba'],
              ] as Array<[Vista, string]>
            ).map(([v, t]) => (
              <button
                key={v}
                onClick={() => accion.current?.(v)}
                aria-pressed={vistaActual === v}
                style={{
                  border: '1px solid #e0e5eb',
                  background: vistaActual === v ? '#33475c' : '#fff',
                  color: vistaActual === v ? '#fff' : '#51606f',
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {t}
              </button>
            ))}
          <BotonPantallaCompleta activa={pantalla} onAlternar={alternarPantalla} estilo={{ border: '1px solid #e0e5eb', background: '#fff', color: '#51606f', borderRadius: 8, padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }} />
        </div>
      </div>
      <div style={{ position: 'relative', flex: llena ? 1 : undefined, height: llena ? undefined : alto, minHeight: llena ? 0 : undefined, display: 'flex' }}>
        <div ref={contRef} style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, borderRadius: 8, overflow: 'hidden', background: '#e7ebf0' }} />
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
              background: play.corriendo ? '#ffa726' : '#0e7a43',
              color: play.corriendo ? '#1c2733' : '#fff',
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
