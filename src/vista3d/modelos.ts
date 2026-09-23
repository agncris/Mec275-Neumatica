/**
 * Modelos 3D de los componentes del banco, construidos con primitivas y
 * materiales físicos (PBR): aluminio anodizado, cromo, latón, plástico técnico
 * y poliuretano. No son archivos importados: se generan en el momento, así que
 * sirven para cualquier circuito sin descargar nada.
 *
 * Cada modelo devuelve su grupo, los racores de sus puertos (en coordenadas
 * locales) y una función que lo pone al día con el estado de la simulación.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Params } from '../engine'
import type { Pieza } from '../store'
import { DESCRIPTORES, VECTOR_DIR } from '../components/descriptores'

/** Metros por píxel del plano: una ficha de 190 px es una válvula de ~13 cm. */
export const ESCALA = 0.0007

export interface EstadoPieza {
  posicion?: number
  accionada?: boolean
  encendida?: boolean
  /** Válvulas «O» / «Y»: entrada que está pasando a la salida. */
  lado?: 'X' | 'Y' | null
  /** Escape rápido: el obturador ha abierto el escape. */
  purgando?: boolean
  /** Temporizador: segundos que lleva llenándose el depósito. */
  acumulado?: number
  /** Parámetros vigentes de la pieza (apertura, retardo…), por si cambian al simular. */
  params?: Params
}

export interface Racor {
  /** Punto de salida de la manguera, en coordenadas locales. */
  punto: THREE.Vector3
  /** Hacia dónde sale la manguera. */
  dir: THREE.Vector3
}

export interface Modelo3D {
  grupo: THREE.Group
  racores: Record<string, Racor>
  /** Partes que se pueden pulsar con el ratón (pulsadores, biestables…). */
  pulsables: THREE.Object3D[]
  actualizar: (estado: EstadoPieza, presion: number) => void
  /** Semiancho y semialto del cuerpo, para colocar lo que va alrededor. */
  medio: { x: number; y: number }
}

// ---------------------------------------------------------------------------
// Materiales
// ---------------------------------------------------------------------------
export const MAT = {
  aluminio: new THREE.MeshStandardMaterial({ color: 0xc4cad2, metalness: 0.85, roughness: 0.36 }),
  aluminioOscuro: new THREE.MeshStandardMaterial({ color: 0x8d949c, metalness: 0.8, roughness: 0.45 }),
  cromo: new THREE.MeshStandardMaterial({ color: 0xf1f4f7, metalness: 1, roughness: 0.07 }),
  laton: new THREE.MeshStandardMaterial({ color: 0xc9a54c, metalness: 1, roughness: 0.28 }),
  negro: new THREE.MeshStandardMaterial({ color: 0x1b1f24, metalness: 0.1, roughness: 0.55 }),
  grafito: new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.3, roughness: 0.5 }),
  azul: new THREE.MeshStandardMaterial({ color: 0x1d5ea8, metalness: 0.2, roughness: 0.42 }),
  verde: new THREE.MeshPhysicalMaterial({ color: 0x19a34e, roughness: 0.3, clearcoat: 0.8 }),
  rojo: new THREE.MeshPhysicalMaterial({ color: 0xc62828, roughness: 0.3, clearcoat: 0.8 }),
  vidrio: new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.05,
    transmission: 0.92,
    thickness: 0.004,
    transparent: true,
    opacity: 0.35,
  }),
  esfera: new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.6 }),
}

export const caja = (w: number, h: number, d: number, mat: THREE.Material, radio = 0.0025) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(radio, w / 3, h / 3, d / 3)), mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

export const cilindro = (r: number, largo: number, mat: THREE.Material, segmentos = 28) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, largo, segmentos), mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** Pegatina con el nombre de la pieza, como las del laboratorio. */
export function etiqueta(texto: string, ancho = 0.034): THREE.Mesh {
  const plano = new THREE.PlaneGeometry(ancho, ancho * 0.375)
  if (typeof document === 'undefined') return new THREE.Mesh(plano, MAT.esfera)
  const lienzo = document.createElement('canvas')
  lienzo.width = 256
  lienzo.height = 96
  const c = lienzo.getContext('2d')!
  c.fillStyle = '#f7f7f2'
  c.fillRect(0, 0, 256, 96)
  c.strokeStyle = '#9aa3ad'
  c.lineWidth = 6
  c.strokeRect(3, 3, 250, 90)
  c.fillStyle = '#15191e'
  c.font = 'bold 62px system-ui, sans-serif'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(texto, 128, 52)
  const tex = new THREE.CanvasTexture(lienzo)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return new THREE.Mesh(plano, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }))
}

/** Racor instantáneo: cuerpo de latón con la pinza azul donde entra el tubo. */
function racor(dir: THREE.Vector3): THREE.Group {
  const g = new THREE.Group()
  const cuerpo = cilindro(0.0042, 0.006, MAT.laton, 20)
  const pinza = cilindro(0.0036, 0.003, MAT.azul, 20)
  pinza.position.y = 0.0045
  g.add(cuerpo, pinza)
  // El cilindro nace en +Y: se gira para que apunte hacia `dir`.
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  return g
}

/**
 * Coloca los racores sobre las caras del cuerpo siguiendo la posición de cada
 * puerto en su ficha del esquema, así las mangueras del banco conectan lo
 * mismo que en el plano.
 */
function racoresDesdeFicha(
  tipo: string,
  grupo: THREE.Group,
  ancho: number,
  alto: number,
  fondo: number,
): Record<string, Racor> {
  const desc = DESCRIPTORES[tipo]
  const out: Record<string, Racor> = {}
  if (!desc) return out
  for (const p of desc.puertos) {
    const [vx, vy] = VECTOR_DIR[p.dir]
    const dir = new THREE.Vector3(vx, -vy, 0)
    let x = (p.x / desc.ancho - 0.5) * ancho
    let y = (0.5 - p.y / desc.alto) * alto
    if (p.dir === 'N') y = alto / 2
    if (p.dir === 'S') y = -alto / 2
    if (p.dir === 'O') x = -ancho / 2
    if (p.dir === 'E') x = ancho / 2
    x = THREE.MathUtils.clamp(x, -ancho / 2, ancho / 2)
    y = THREE.MathUtils.clamp(y, -alto / 2, alto / 2)
    const base = new THREE.Vector3(x, y, fondo / 2)
    const r = racor(dir)
    r.position.copy(base).addScaledVector(dir, 0.003)
    grupo.add(r)
    out[p.id] = { punto: base.clone().addScaledVector(dir, 0.009), dir }
  }
  return out
}

// ---------------------------------------------------------------------------
// Actuadores
// ---------------------------------------------------------------------------
/** Carrera del vástago en metros. */
export const CARRERA = 0.08
const SALIDA_VASTAGO = 0.018

export function modeloCilindro(tipo: string, id: string): Modelo3D & { puntaVastago: (pos: number) => number } {
  const grupo = new THREE.Group()
  const largo = tipo === 'cilindroSimpleEfecto' ? 0.12 : 0.15
  const lado = 0.034
  const fondo = 0.034
  // Camisa de perfil anodizado con sus dos culatas.
  const camisa = caja(largo - 0.02, lado * 0.92, fondo * 0.92, MAT.aluminio, 0.004)
  camisa.position.z = fondo / 2
  const culataT = caja(0.014, lado, fondo, MAT.aluminioOscuro, 0.003)
  culataT.position.set(-largo / 2 + 0.007, 0, fondo / 2)
  const culataD = culataT.clone()
  culataD.position.x = largo / 2 - 0.007
  grupo.add(camisa, culataT, culataD)
  // Tornillos de las culatas.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const lado2 of [-1, 1]) {
        const t = cilindro(0.0016, 0.002, MAT.cromo, 12)
        t.rotation.x = Math.PI / 2
        t.position.set(lado2 * (largo / 2 - 0.007) + sx * 0.0, sy * 0.011, fondo + 0.0005)
        t.position.x += sx * 0.0035
        grupo.add(t)
      }
    }
  }
  // Vástago cromado con tuerca y leva: la leva es la que pisa los rodillos.
  const vastago = new THREE.Group()
  // La barra sólo es tan larga como para quedar dentro de la camisa en las
  // dos posiciones: si no, asomaría por la culata trasera.
  const barra = cilindro(0.0055, 0.11, MAT.cromo)
  barra.rotation.z = Math.PI / 2
  barra.position.x = -0.055
  const tuerca = cilindro(0.0085, 0.008, MAT.negro, 6)
  tuerca.rotation.z = Math.PI / 2
  tuerca.position.x = -0.004
  const leva = caja(0.008, 0.03, 0.012, MAT.azul, 0.0015)
  leva.position.set(-0.004, 0.018, 0)
  vastago.add(barra, tuerca, leva)
  vastago.position.set(largo / 2 + SALIDA_VASTAGO, 0, fondo / 2)
  grupo.add(vastago)

  const sello = etiqueta(id)
  sello.position.set(-0.01, 0, fondo + 0.0012)
  grupo.add(sello)

  const racores = racoresDesdeFicha(tipo, grupo, largo, lado, fondo)
  const puntaVastago = (pos: number) => largo / 2 + SALIDA_VASTAGO + pos * CARRERA
  return {
    grupo,
    racores,
    pulsables: [],
    medio: { x: largo / 2, y: lado / 2 },
    puntaVastago,
    actualizar: (e) => {
      vastago.position.x = puntaVastago(e.posicion ?? 0)
    },
  }
}

export function modeloGiratorio(id: string, params: Params): Modelo3D & { radioBrazo: number } {
  const grupo = new THREE.Group()
  const fondo = 0.036
  const cuerpo = caja(0.07, 0.06, fondo, MAT.aluminio, 0.004)
  cuerpo.position.z = fondo / 2
  grupo.add(cuerpo)
  // Brida giratoria con un brazo que pisa los finales de carrera.
  const brida = new THREE.Group()
  const disco = cilindro(0.02, 0.008, MAT.grafito, 36)
  disco.rotation.x = Math.PI / 2
  const brazo = caja(0.05, 0.009, 0.006, MAT.azul, 0.0015)
  brazo.position.x = -0.025
  brazo.position.z = 0.004
  brida.add(disco, brazo)
  brida.position.set(0, 0, fondo + 0.004)
  grupo.add(brida)
  const sello = etiqueta(id, 0.026)
  sello.position.set(0, -0.022, fondo + 0.0012)
  grupo.add(sello)
  const angulo = Number(params.angulo ?? 180)
  return {
    grupo,
    racores: racoresDesdeFicha('actuadorGiratorio', grupo, 0.07, 0.06, fondo),
    pulsables: [],
    medio: { x: 0.035, y: 0.03 },
    radioBrazo: 0.05,
    actualizar: (e) => {
      // El brazo sale hacia la izquierda y gira en sentido horario.
      brida.rotation.z = -THREE.MathUtils.degToRad((e.posicion ?? 0) * angulo)
    },
  }
}

export function modeloMotor(id: string): Modelo3D & { radioLeva: number; frenteEje: number } {
  const grupo = new THREE.Group()
  const fondo = 0.04
  const cuerpo = caja(0.06, 0.05, fondo, MAT.grafito, 0.004)
  cuerpo.position.z = fondo / 2
  const eje = new THREE.Group()
  const disco = cilindro(0.014, 0.006, MAT.cromo, 32)
  disco.rotation.x = Math.PI / 2
  const marca = caja(0.012, 0.004, 0.002, MAT.rojo, 0.001)
  marca.position.set(0.006, 0, 0.004)
  // Leva que sobresale del disco: es la que pisa el sensor de paso en cada vuelta.
  const leva = caja(0.008, 0.007, 0.005, MAT.azul, 0.0015)
  leva.position.set(0.0155, 0, 0)
  eje.add(disco, marca, leva)
  eje.position.set(0, 0, fondo + 0.003)
  grupo.add(cuerpo, eje)
  const sello = etiqueta(id, 0.024)
  sello.position.set(0, -0.019, fondo + 0.0012)
  grupo.add(sello)
  return {
    grupo,
    racores: racoresDesdeFicha('motorNeumatico', grupo, 0.06, 0.05, fondo),
    pulsables: [],
    medio: { x: 0.03, y: 0.025 },
    radioLeva: 0.0195,
    frenteEje: fondo + 0.003,
    actualizar: (e) => {
      eje.rotation.z = -(e.posicion ?? 0) * Math.PI * 2
    },
  }
}

// ---------------------------------------------------------------------------
// Válvulas
// ---------------------------------------------------------------------------
function pulsador(color: THREE.Material): { grupo: THREE.Group; boton: THREE.Mesh } {
  const grupo = new THREE.Group()
  const casquillo = cilindro(0.008, 0.008, MAT.negro, 24)
  casquillo.rotation.z = Math.PI / 2
  const boton = new THREE.Mesh(new THREE.SphereGeometry(0.011, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), color)
  boton.castShadow = true
  boton.rotation.z = Math.PI / 2
  boton.position.x = -0.006
  grupo.add(casquillo, boton)
  return { grupo, boton }
}

/** Válvula distribuidora 5/2, 4/2 o 3/2, con sus accionamientos. */
export function modeloValvula(tipo: string, id: string, params: Params): Modelo3D {
  const grupo = new THREE.Group()
  const es32 = tipo === 'valvula32'
  const ancho = es32 ? 0.055 : 0.1
  const alto = es32 ? 0.036 : 0.04
  const fondo = 0.03
  const cuerpo = caja(ancho, alto, fondo, MAT.aluminio, 0.003)
  cuerpo.position.z = fondo / 2
  grupo.add(cuerpo)
  // Tapa superior azul, como las electroválvulas de laboratorio.
  const tapa = caja(ancho * 0.94, 0.004, fondo * 0.9, MAT.azul, 0.0015)
  tapa.position.set(0, alto / 2 - 0.001, fondo / 2)
  grupo.add(tapa)
  const pulsables: THREE.Object3D[] = []

  const biestable = params.modo === 'biestable'
  const pilotaje = biestable || params.accionamiento === 'pilotaje'
  let boton: THREE.Mesh | null = null
  // Accionamiento izquierdo: pulsador o cabeza de pilotaje.
  if (!pilotaje) {
    const p = pulsador(es32 && params.reposo === 'NA' ? MAT.rojo : MAT.verde)
    p.grupo.position.set(-ancho / 2 - 0.004, 0, fondo / 2)
    grupo.add(p.grupo)
    boton = p.boton
    pulsables.push(p.grupo, cuerpo)
  } else {
    const cabeza = caja(0.014, alto * 0.8, fondo * 0.8, MAT.grafito, 0.002)
    cabeza.position.set(-ancho / 2 - 0.006, 0, fondo / 2)
    grupo.add(cabeza)
    if (biestable) pulsables.push(cuerpo)
  }
  // Accionamiento derecho: la otra cabeza de pilotaje o la tapa del muelle.
  const derecha = caja(0.012, alto * 0.8, fondo * 0.8, biestable ? MAT.grafito : MAT.negro, 0.002)
  derecha.position.set(ancho / 2 + 0.005, 0, fondo / 2)
  grupo.add(derecha)
  // Indicador de corredera: una marca que se desplaza al conmutar.
  const indicador = caja(0.012, 0.004, 0.002, MAT.rojo, 0.001)
  indicador.position.set(0, -alto / 2 + 0.006, fondo + 0.0012)
  grupo.add(indicador)

  const sello = etiqueta(id, es32 ? 0.026 : 0.032)
  sello.position.set(0, 0.002, fondo + 0.0012)
  grupo.add(sello)

  return {
    grupo,
    racores: racoresDesdeFicha(tipo, grupo, ancho, alto, fondo),
    pulsables,
    medio: { x: ancho / 2 + 0.01, y: alto / 2 },
    actualizar: (e) => {
      const accionada = !!e.accionada
      indicador.position.x = accionada ? -ancho * 0.22 : ancho * 0.22
      if (boton) boton.position.x = accionada ? -0.001 : -0.006
    },
  }
}

/** Final de carrera de rodillo: palanca que se inclina cuando la pisa la leva. */
export function modeloFinalCarrera(
  id: string,
  boca: 'abajo' | 'arriba' = 'abajo',
  tipo: 'finalCarrera' | 'sensorGiro' = 'finalCarrera',
): Modelo3D & { sello: THREE.Object3D } {
  const grupo = new THREE.Group()
  const ancho = 0.05
  const alto = 0.03
  const fondo = 0.026
  const cuerpo = caja(ancho, alto, fondo, MAT.aluminio, 0.003)
  cuerpo.position.z = fondo / 2
  grupo.add(cuerpo)
  const s = boca === 'abajo' ? -1 : 1
  const palanca = new THREE.Group()
  const brazo = caja(0.004, 0.022, 0.004, MAT.cromo, 0.001)
  brazo.position.y = s * 0.011
  const rueda = cilindro(0.0055, 0.004, MAT.negro, 24)
  rueda.rotation.x = Math.PI / 2
  rueda.position.y = s * 0.022
  palanca.add(brazo, rueda)
  palanca.position.set(0, s * alto / 2, fondo / 2 + 0.006)
  grupo.add(palanca)
  const sello = etiqueta(id, 0.022)
  sello.position.set(0.008, 0, fondo + 0.0012)
  grupo.add(sello)
  return {
    grupo,
    sello,
    racores: racoresDesdeFicha(tipo, grupo, ancho, alto, fondo),
    pulsables: [],
    medio: { x: ancho / 2, y: alto / 2 + 0.028 },
    actualizar: (e) => {
      palanca.rotation.z = e.accionada ? s * 0.45 : 0
    },
  }
}

// ---------------------------------------------------------------------------
// Alimentación y medida
// ---------------------------------------------------------------------------
function esfera(): { grupo: THREE.Group; aguja: THREE.Mesh } {
  const grupo = new THREE.Group()
  const aro = cilindro(0.02, 0.008, MAT.cromo, 40)
  aro.rotation.x = Math.PI / 2
  grupo.add(aro)
  const aguja = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.014, 0.0005), MAT.rojo)
  aguja.geometry.translate(0, 0.006, 0)
  aguja.position.z = 0.0045
  grupo.add(aguja)
  if (typeof document === 'undefined') return { grupo, aguja }
  const lienzo = document.createElement('canvas')
  lienzo.width = lienzo.height = 256
  const c = lienzo.getContext('2d')!
  c.fillStyle = '#f7f5ee'
  c.beginPath()
  c.arc(128, 128, 126, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = '#1a1d22'
  c.fillStyle = '#1a1d22'
  c.font = 'bold 26px system-ui, sans-serif'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  for (let b = 0; b <= 10; b++) {
    const a = ((-135 + b * 27) * Math.PI) / 180
    c.lineWidth = b % 2 === 0 ? 5 : 3
    c.beginPath()
    c.moveTo(128 + Math.sin(a) * 104, 128 - Math.cos(a) * 104)
    c.lineTo(128 + Math.sin(a) * (b % 2 === 0 ? 84 : 92), 128 - Math.cos(a) * (b % 2 === 0 ? 84 : 92))
    c.stroke()
    if (b % 2 === 0) c.fillText(String(b), 128 + Math.sin(a) * 66, 128 - Math.cos(a) * 66)
  }
  c.font = '20px system-ui, sans-serif'
  c.fillText('bar', 128, 176)
  const tex = new THREE.CanvasTexture(lienzo)
  tex.colorSpace = THREE.SRGBColorSpace
  const cara = new THREE.Mesh(new THREE.CircleGeometry(0.0175, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }))
  cara.position.z = 0.0042
  grupo.add(cara)
  const cristal = new THREE.Mesh(new THREE.CircleGeometry(0.0178, 48), MAT.vidrio)
  cristal.position.z = 0.0048
  grupo.add(cristal)
  return { grupo, aguja }
}

const anguloAguja = (bar: number) => -THREE.MathUtils.degToRad(-135 + THREE.MathUtils.clamp(bar, 0, 10) * 27)

/** Unidad de mantenimiento: filtro con vaso transparente, regulador y manómetro. */
export function modeloFRL(id: string): Modelo3D {
  const grupo = new THREE.Group()
  const fondo = 0.04
  const cuerpo = caja(0.05, 0.04, fondo, MAT.grafito, 0.004)
  cuerpo.position.set(0, 0.01, fondo / 2)
  grupo.add(cuerpo)
  const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.05, 36, 1, true), MAT.vidrio)
  vaso.position.set(0, -0.034, fondo / 2)
  const cartucho = cilindro(0.009, 0.04, MAT.esfera, 24)
  cartucho.position.copy(vaso.position)
  const purga = cilindro(0.004, 0.008, MAT.negro, 16)
  purga.position.set(0, -0.063, fondo / 2)
  grupo.add(cartucho, vaso, purga)
  const pomo = cilindro(0.014, 0.014, MAT.negro, 32)
  pomo.position.set(0, 0.037, fondo / 2)
  grupo.add(pomo)
  const m = esfera()
  m.grupo.position.set(0, 0.012, fondo + 0.001)
  grupo.add(m.grupo)
  const sello = etiqueta(id, 0.024)
  sello.position.set(0, -0.008, fondo + 0.0012)
  grupo.add(sello)
  return {
    grupo,
    racores: racoresDesdeFicha('fuente', grupo, 0.05, 0.04, fondo),
    pulsables: [cuerpo, pomo],
    medio: { x: 0.025, y: 0.07 },
    actualizar: (_e, presion) => {
      m.aguja.rotation.z = anguloAguja(presion)
    },
  }
}

export function modeloManometro(id: string): Modelo3D {
  const grupo = new THREE.Group()
  const m = esfera()
  m.grupo.scale.setScalar(1.3)
  m.grupo.position.z = 0.012
  const base = cilindro(0.006, 0.02, MAT.laton, 16)
  base.position.set(0, -0.03, 0.006)
  grupo.add(m.grupo, base)
  const sello = etiqueta(id, 0.02)
  sello.position.set(0, -0.045, 0.004)
  grupo.add(sello)
  return {
    grupo,
    racores: racoresDesdeFicha('manometro', grupo, 0.04, 0.07, 0.012),
    pulsables: [],
    medio: { x: 0.026, y: 0.036 },
    actualizar: (_e, presion) => {
      m.aguja.rotation.z = anguloAguja(presion)
    },
  }
}

// ---------------------------------------------------------------------------
// Regulación, lógica y temporización
// ---------------------------------------------------------------------------
/** Escribe un texto centrado, reduciendo la letra hasta que quepa en `ancho` px. */
function textoAjustado(c: CanvasRenderingContext2D, texto: string, x: number, y: number, ancho: number, tam: number) {
  let t = tam
  do {
    c.font = `bold ${t}px system-ui, sans-serif`
    t -= 2
  } while (c.measureText(texto).width > ancho && t > 10)
  c.fillText(texto, x, y)
}

/** Lienzo 2D para las serigrafías (escalas, flechas); null fuera del navegador. */
function serigrafia(
  ancho: number,
  alto: number,
  dibujar: (c: CanvasRenderingContext2D) => void,
  lado: [number, number],
): THREE.Mesh | null {
  if (typeof document === 'undefined') return null
  const lienzo = document.createElement('canvas')
  lienzo.width = lado[0]
  lienzo.height = lado[1]
  dibujar(lienzo.getContext('2d')!)
  const tex = new THREE.CanvasTexture(lienzo)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return new THREE.Mesh(
    new THREE.PlaneGeometry(ancho, alto),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, transparent: true }),
  )
}

/** Ángulo de la perilla del regulador: de cerrado (−135°) a abierto del todo (+135°). */
export const anguloPerilla = (apertura: number) =>
  -THREE.MathUtils.degToRad(-135 + THREE.MathUtils.clamp(apertura, 0, 1) * 270)

/**
 * Regulador de caudal unidireccional: cuerpo de aluminio con la perilla de
 * ajuste al frente. La raya blanca de la perilla marca la apertura sobre la
 * escala; la flecha serigrafiada dice en qué sentido estrangula.
 */
export function modeloRegulador(id: string, params: Params): Modelo3D & { perilla: THREE.Object3D } {
  const grupo = new THREE.Group()
  const ancho = 0.05
  const alto = 0.03
  const fondo = 0.026
  const cuerpo = caja(ancho, alto, fondo, MAT.aluminio, 0.003)
  cuerpo.position.z = fondo / 2
  grupo.add(cuerpo)
  // Escala 0…máx alrededor de la perilla.
  const escala = serigrafia(0.026, 0.026, (c) => {
    c.strokeStyle = '#1a1d22'
    c.fillStyle = '#1a1d22'
    for (let i = 0; i <= 10; i++) {
      const a = ((-135 + i * 27) * Math.PI) / 180
      c.lineWidth = i % 5 === 0 ? 7 : 4
      c.beginPath()
      c.moveTo(128 + Math.sin(a) * 124, 128 - Math.cos(a) * 124)
      c.lineTo(128 + Math.sin(a) * (i % 5 === 0 ? 96 : 106), 128 - Math.cos(a) * (i % 5 === 0 ? 96 : 106))
      c.stroke()
    }
    c.font = 'bold 44px system-ui, sans-serif'
    c.textAlign = 'center'
    c.fillText('−', 40, 236)
    c.fillText('+', 216, 236)
  }, [256, 256])
  if (escala) {
    escala.position.set(-0.008, 0.001, fondo + 0.0008)
    grupo.add(escala)
  }
  const perilla = new THREE.Group()
  const moleteado = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.008, 18), MAT.negro)
  moleteado.rotation.x = Math.PI / 2
  moleteado.castShadow = true
  const raya = caja(0.0014, 0.0075, 0.001, MAT.esfera, 0.0003)
  raya.position.set(0, 0.0045, 0.0042)
  const contratuerca = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.002, 6), MAT.laton)
  contratuerca.rotation.x = Math.PI / 2
  contratuerca.position.z = -0.004
  perilla.add(contratuerca, moleteado, raya)
  perilla.position.set(-0.008, 0.001, fondo + 0.005)
  grupo.add(perilla)
  // Flecha del sentido estrangulado (1→2) y la del antirretorno, más fina.
  const flecha = serigrafia(0.016, 0.02, (c) => {
    c.strokeStyle = '#1a1d22'
    c.fillStyle = '#1a1d22'
    c.lineWidth = 8
    c.beginPath()
    c.moveTo(10, 40)
    c.lineTo(100, 40)
    c.stroke()
    c.beginPath()
    c.moveTo(118, 40)
    c.lineTo(92, 24)
    c.lineTo(92, 56)
    c.fill()
    c.lineWidth = 4
    c.setLineDash([10, 8])
    c.beginPath()
    c.moveTo(118, 100)
    c.lineTo(20, 100)
    c.stroke()
    c.font = 'bold 26px system-ui, sans-serif'
    c.fillText(id, 16, 150)
  }, [128, 160])
  if (flecha) {
    flecha.position.set(0.0155, 0, fondo + 0.0008)
    grupo.add(flecha)
  }
  perilla.rotation.z = anguloPerilla(Number(params.apertura ?? 0.5))
  return {
    grupo,
    racores: racoresDesdeFicha('reguladorCaudal', grupo, ancho, alto, fondo),
    pulsables: [],
    medio: { x: ancho / 2, y: alto / 2 },
    perilla,
    actualizar: (e) => {
      const apertura = e.params?.apertura ?? params.apertura
      perilla.rotation.z = anguloPerilla(Number(apertura ?? 0.5))
    },
  }
}

/**
 * Temporizador neumático: una 3/2 pilotada con su depósito. El depósito es
 * transparente y se ve llenarse mientras dura el pilotaje; al llenarse, la
 * válvula conmuta (el indicador rojo salta).
 */
export function modeloTemporizador(
  id: string,
  params: Params,
): Modelo3D & { relleno: THREE.Object3D } {
  const grupo = new THREE.Group()
  const ancho = 0.068
  const alto = 0.036
  const fondo = 0.03
  const cuerpo = caja(ancho, alto, fondo, MAT.grafito, 0.003)
  cuerpo.position.z = fondo / 2
  grupo.add(cuerpo)
  // Depósito: cápsula de policarbonato apoyada en el frente, a la izquierda.
  const largoDep = 0.03
  const xDep = -ancho / 2 + 0.004 + largoDep / 2
  const deposito = new THREE.Mesh(new THREE.CapsuleGeometry(0.0075, largoDep - 0.015, 6, 24), MAT.vidrio)
  deposito.rotation.z = Math.PI / 2
  deposito.position.set(xDep, 0.004, fondo + 0.008)
  const relleno = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0062, 0.0062, largoDep - 0.004, 20),
    new THREE.MeshStandardMaterial({ color: 0x49a6ff, emissive: 0x0a4fb0, emissiveIntensity: 0.4, roughness: 0.4 }),
  )
  // Crece desde la izquierda: el origen de la geometría va a su extremo.
  relleno.geometry.translate(0, (largoDep - 0.004) / 2, 0)
  relleno.rotation.z = -Math.PI / 2
  relleno.position.set(xDep - (largoDep - 0.004) / 2, 0.004, fondo + 0.008)
  relleno.scale.y = 0.001
  const abrazadera = caja(0.004, 0.02, 0.012, MAT.aluminioOscuro, 0.001)
  const abrazadera2 = abrazadera.clone()
  abrazadera.position.set(xDep - 0.01, 0.004, fondo + 0.004)
  abrazadera2.position.set(xDep + 0.01, 0.004, fondo + 0.004)
  grupo.add(relleno, deposito, abrazadera, abrazadera2)
  // Tornillo de ajuste del tiempo, arriba a la izquierda.
  const tornillo = cilindro(0.005, 0.008, MAT.laton, 20)
  tornillo.position.set(xDep, alto / 2 + 0.004, fondo / 2)
  grupo.add(tornillo)
  const retardo = Number(params.retardo ?? 2)
  const rotulo = serigrafia(0.026, 0.009, (c) => {
    c.fillStyle = '#f7f7f2'
    c.fillRect(0, 0, 256, 88)
    c.fillStyle = '#15191e'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    textoAjustado(c, `${id} · ${retardo.toFixed(1)} s`, 128, 46, 236, 54)
  }, [256, 88])
  if (rotulo) {
    rotulo.position.set(0.017, 0.006, fondo + 0.0012)
    grupo.add(rotulo)
  }
  const indicador = caja(0.01, 0.004, 0.002, MAT.rojo, 0.001)
  indicador.position.set(0.017, -alto / 2 + 0.007, fondo + 0.0012)
  grupo.add(indicador)
  return {
    grupo,
    racores: racoresDesdeFicha('temporizador', grupo, ancho, alto, fondo),
    pulsables: [],
    medio: { x: ancho / 2, y: alto / 2 },
    relleno,
    actualizar: (e) => {
      const r = Math.max(0.1, Number(e.params?.retardo ?? retardo))
      const lleno = e.accionada ? 1 : THREE.MathUtils.clamp((e.acumulado ?? 0) / r, 0, 1)
      relleno.scale.y = Math.max(0.001, lleno)
      relleno.visible = lleno > 0.002
      indicador.position.x = e.accionada ? 0.017 - 0.008 : 0.017 + 0.008
    },
  }
}

/**
 * Válvula de escape rápido: cuerpo redondo con una mirilla por la que se ve
 * el obturador (disco rojo). Con aire en 1, tapa el escape y deja pasar a 2;
 * al caer la presión en 1, salta, tapa la entrada y vacía 2 directo por el
 * escape de arriba, que lleva un silenciador grande.
 */
export function modeloEscapeRapido(id: string): Modelo3D & { obturador: THREE.Object3D } {
  const grupo = new THREE.Group()
  const ancho = 0.05
  const alto = 0.03
  const fondo = 0.028
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(alto / 2, alto / 2, ancho - 0.008, 32), MAT.aluminio)
  cuerpo.rotation.z = Math.PI / 2
  cuerpo.position.z = fondo / 2
  cuerpo.castShadow = cuerpo.receiveShadow = true
  grupo.add(cuerpo)
  for (const sx of [-1, 1]) {
    const hexagono = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.006, 6), MAT.aluminioOscuro)
    hexagono.rotation.z = Math.PI / 2
    hexagono.position.set(sx * (ancho / 2 - 0.003), 0, fondo / 2)
    hexagono.castShadow = true
    grupo.add(hexagono)
  }
  const cupula = cilindro(0.008, 0.008, MAT.aluminio, 24)
  cupula.position.set(0, alto / 2 - 0.001, fondo / 2)
  grupo.add(cupula)
  // Mirilla con el obturador.
  const marco = new THREE.Mesh(new THREE.TorusGeometry(0.0075, 0.0012, 10, 32), MAT.cromo)
  marco.position.set(0, -0.002, fondo / 2 + alto / 2)
  const fondoMirilla = new THREE.Mesh(new THREE.CircleGeometry(0.0072, 32), MAT.grafito)
  fondoMirilla.position.set(0, -0.002, fondo / 2 + alto / 2 - 0.0012)
  const obturador = cilindro(0.0042, 0.0016, MAT.rojo, 24)
  obturador.rotation.z = Math.PI / 2
  obturador.position.set(0.003, -0.002, fondo / 2 + alto / 2 - 0.0004)
  const cristal = new THREE.Mesh(new THREE.CircleGeometry(0.0074, 32), MAT.vidrio)
  cristal.position.set(0, -0.002, fondo / 2 + alto / 2 + 0.0006)
  grupo.add(fondoMirilla, obturador, marco, cristal)
  const sello = etiqueta(id, 0.018)
  sello.position.set(0, -0.0125, fondo / 2 + alto / 2 - 0.004)
  sello.rotation.x = -0.5
  grupo.add(sello)
  return {
    grupo,
    racores: racoresDesdeFicha('escapeRapido', grupo, ancho, alto, fondo),
    pulsables: [],
    medio: { x: ancho / 2, y: alto / 2 },
    obturador,
    actualizar: (e) => {
      // Alimentando: el disco está contra el escape (derecha, lado de 2).
      // Purgando: salta contra la entrada 1 (izquierda) y 2 sale por arriba.
      const destino = e.purgando ? -0.003 : 0.003
      obturador.position.x += (destino - obturador.position.x) * 0.5
    },
  }
}

/**
 * Válvulas lógicas con mirilla: en la «O» se ve la bola de acero, en la «Y»
 * la corredera, que se va al lado de la entrada que queda cerrada.
 */
export function modeloLogica(tipo: string, id: string): Modelo3D & { movil: THREE.Object3D } {
  const grupo = new THREE.Group()
  const esY = tipo === 'valvulaY'
  const ancho = 0.05
  const alto = 0.042
  const fondo = 0.026
  const yCanal = -0.007
  const cuerpo = caja(ancho, alto, fondo, MAT.aluminio, 0.003)
  cuerpo.position.z = fondo / 2
  grupo.add(cuerpo)
  // Canal X ↔ Y visto por la mirilla, con la salida A hacia arriba.
  const canal = caja(0.034, 0.008, 0.001, MAT.grafito, 0.0008)
  canal.position.set(0, yCanal, fondo + 0.0006)
  const subida = caja(0.004, alto / 2 - yCanal - 0.002, 0.001, MAT.grafito, 0.0008)
  subida.position.set(0, (alto / 2 + yCanal) / 2, fondo + 0.0006)
  grupo.add(canal, subida)
  const movil = esY
    ? (() => {
        const g = new THREE.Group()
        const vastago = cilindro(0.0016, 0.024, MAT.cromo, 12)
        vastago.rotation.z = Math.PI / 2
        const platoA = cilindro(0.0036, 0.002, MAT.negro, 20)
        platoA.rotation.z = Math.PI / 2
        platoA.position.x = -0.011
        const platoB = platoA.clone()
        platoB.position.x = 0.011
        g.add(vastago, platoA, platoB)
        return g
      })()
    : new THREE.Mesh(new THREE.SphereGeometry(0.0036, 24, 16), MAT.cromo)
  movil.position.set(0, yCanal, fondo + 0.0035)
  grupo.add(movil)
  const cristal = caja(0.04, 0.016, 0.001, MAT.vidrio, 0.0005)
  cristal.position.set(0, yCanal, fondo + 0.0065)
  grupo.add(cristal)
  // Arriba: el nombre a la izquierda de la salida A y la función a la derecha.
  const sello = etiqueta(id, 0.019)
  sello.position.set(-0.0125, 0.012, fondo + 0.0012)
  grupo.add(sello)
  const funcion = serigrafia(0.016, 0.012, (c) => {
    c.fillStyle = '#15191e'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    textoAjustado(c, esY ? '«Y»' : '«O»', 64, 50, 124, 80)
  }, [128, 96])
  if (funcion) {
    funcion.position.set(0.0125, 0.012, fondo + 0.0008)
    grupo.add(funcion)
  }
  // Las entradas, rotuladas junto a sus racores de abajo.
  const entradas = serigrafia(0.044, 0.006, (c) => {
    c.fillStyle = '#15191e'
    c.font = 'bold 44px system-ui, sans-serif'
    c.textBaseline = 'middle'
    c.textAlign = 'center'
    c.fillText('X', 36, 30)
    c.fillText('Y', 220, 30)
  }, [256, 60])
  if (entradas) {
    entradas.position.set(0, -alto / 2 + 0.003, fondo + 0.0008)
    grupo.add(entradas)
  }
  return {
    grupo,
    racores: racoresDesdeFicha(tipo, grupo, ancho, alto, fondo),
    pulsables: [],
    medio: { x: ancho / 2, y: alto / 2 },
    movil,
    actualizar: (e) => {
      // Pasa X → el elemento tapa Y (derecha); pasa Y → tapa X (izquierda).
      const tope = esY ? 0.004 : 0.012
      const destino = e.lado === 'X' ? tope : e.lado === 'Y' ? -tope : 0
      movil.position.x += (destino - movil.position.x) * 0.5
    },
  }
}

/** Bloque genérico, por si aparece una ficha sin modelo propio. */
export function modeloBloque(tipo: string, id: string): Modelo3D {
  const grupo = new THREE.Group()
  const desc = DESCRIPTORES[tipo]
  const ancho = Math.max(0.035, (desc?.ancho ?? 100) * ESCALA * 0.5)
  const alto = 0.03
  const fondo = 0.026
  const cuerpo = caja(ancho, alto, fondo, tipo === 'temporizador' ? MAT.grafito : MAT.aluminio, 0.003)
  cuerpo.position.z = fondo / 2
  grupo.add(cuerpo)
  if (tipo === 'reguladorCaudal' || tipo === 'temporizador') {
    const tornillo = cilindro(0.006, 0.012, MAT.negro, 20)
    tornillo.position.set(0, alto / 2 + 0.006, fondo / 2)
    grupo.add(tornillo)
  }
  const sello = etiqueta(id, 0.022)
  sello.position.set(0, 0, fondo + 0.0012)
  grupo.add(sello)
  return {
    grupo,
    racores: racoresDesdeFicha(tipo, grupo, ancho, alto, fondo),
    pulsables: [],
    medio: { x: ancho / 2, y: alto / 2 },
    actualizar: () => {},
  }
}

/** Crea el modelo que corresponde a cada tipo de ficha. */
export function crearModelo(p: Pieza): Modelo3D {
  switch (p.tipo) {
    case 'cilindroDobleEfecto':
    case 'cilindroSimpleEfecto':
      return modeloCilindro(p.tipo, p.id)
    case 'actuadorGiratorio':
      return modeloGiratorio(p.id, p.params)
    case 'motorNeumatico':
      return modeloMotor(p.id)
    case 'valvula32':
    case 'valvula42':
    case 'valvula52':
      return modeloValvula(p.tipo, p.id, p.params)
    case 'finalCarrera':
      return modeloFinalCarrera(p.id)
    case 'sensorGiro':
      return modeloFinalCarrera(p.id, 'abajo', 'sensorGiro')
    case 'reguladorCaudal':
      return modeloRegulador(p.id, p.params)
    case 'temporizador':
      return modeloTemporizador(p.id, p.params)
    case 'escapeRapido':
      return modeloEscapeRapido(p.id)
    case 'valvulaO':
    case 'valvulaY':
      return modeloLogica(p.tipo, p.id)
    case 'fuente':
      return modeloFRL(p.id)
    case 'manometro':
      return modeloManometro(p.id)
    default:
      return modeloBloque(p.tipo, p.id)
  }
}
