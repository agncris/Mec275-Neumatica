/**
 * Robots KUKA de 6 ejes (antropomórficos) y su cinemática.
 *
 * Geometría: A1 gira alrededor del eje vertical; el hombro está desplazado
 * a1 hacia delante y d1 hacia arriba; el brazo mide a2; el antebrazo tiene un
 * pequeño desnivel a3 y mide d4 hasta el centro de la muñeca; de ahí al
 * flange hay d6. La muñeca es esférica (A4, A5, A6 se cruzan en un punto),
 * así que la posición y la orientación se pueden resolver por separado.
 *
 * Convención de ángulos (como en los robots KUKA): en la posición de
 * referencia A2 = −90° deja el brazo vertical y A3 = +90° deja el antebrazo
 * horizontal; A5 positivo inclina la herramienta hacia abajo.
 *
 * Carga, alcance, repetibilidad, peso, rangos y velocidades son los de las
 * fichas técnicas publicadas de cada modelo (revisadas en 2026). Las medidas
 * de los eslabones (d1, a1…) son las de los modelos cinemáticos habituales;
 * el alcance real puede diferir unos milímetros.
 */
import {
  aplicar,
  col,
  deColumnas,
  escalar,
  grados,
  mul,
  rad,
  resta,
  rotX,
  rotY,
  rotZ,
  suma,
  trasp,
  unit,
  v,
  type M3,
  type Plano,
  type V3,
} from './matematica'

export interface ModeloRobot {
  id: string
  nombre: string
  familia: string
  carga: number // kg
  alcance: number // mm (al centro de la muñeca)
  repetibilidad: number // ± mm
  peso: number // kg
  montaje: string
  descripcion: string
  d1: number
  a1: number
  a2: number
  a3: number
  d4: number
  d6: number
  /** Límites [mín, máx] de A1…A6 en grados. */
  limites: Array<[number, number]>
  /** Velocidad máxima de cada eje, °/s. */
  velocidades: number[]
}

export const ROBOTS: ModeloRobot[] = [
  {
    id: 'kr6r900',
    nombre: 'KR 6 R900 sixx (KR AGILUS)',
    familia: 'Carga baja',
    carga: 6,
    alcance: 901,
    repetibilidad: 0.03,
    peso: 52,
    montaje: 'Suelo, techo, pared',
    descripcion: 'Pequeño y rápido: manipulación, ensamblaje y mecanizado liviano en celdas compactas.',
    d1: 400,
    a1: 25,
    a2: 455,
    a3: 35,
    d4: 420,
    d6: 80,
    limites: [
      [-170, 170],
      [-190, 45],
      [-120, 156],
      [-185, 185],
      [-120, 120],
      [-350, 350],
    ],
    velocidades: [360, 300, 360, 381, 388, 615],
  },
  {
    id: 'kr10r1100',
    nombre: 'KR 10 R1100 sixx (KR AGILUS)',
    familia: 'Carga baja',
    carga: 10,
    alcance: 1101,
    repetibilidad: 0.03,
    peso: 55,
    montaje: 'Suelo, techo, pared',
    descripcion: 'Como el KR 6 pero con más alcance y carga: fresado liviano, pegado, ensamblaje.',
    d1: 400,
    a1: 25,
    a2: 560,
    a3: 25,
    d4: 515,
    d6: 80,
    limites: [
      [-170, 170],
      [-190, 45],
      [-120, 156],
      [-185, 185],
      [-120, 120],
      [-350, 350],
    ],
    velocidades: [300, 225, 225, 381, 311, 492],
  },
  {
    id: 'kr16',
    nombre: 'KR 16-2',
    familia: 'Carga baja',
    carga: 16,
    alcance: 1611,
    repetibilidad: 0.05,
    peso: 235,
    montaje: 'Suelo, techo',
    descripcion: 'Clásico para soldadura por arco, manipulación y mecanizado de piezas medianas.',
    d1: 675,
    a1: 260,
    a2: 680,
    a3: 35,
    d4: 670,
    d6: 115,
    limites: [
      [-185, 185],
      [-155, 35],
      [-130, 154],
      [-350, 350],
      [-130, 130],
      [-350, 350],
    ],
    velocidades: [156, 156, 156, 330, 330, 615],
  },
  {
    id: 'kr50r2100',
    nombre: 'KR 50 R2100',
    familia: 'Carga media',
    carga: 50,
    alcance: 2101,
    repetibilidad: 0.05,
    peso: 533,
    montaje: 'Suelo, pared, techo, ángulo',
    descripcion: 'El del apunte: carga media para fresado, manipulación y procesos con piezas grandes.',
    d1: 575,
    a1: 175,
    a2: 890,
    a3: 50,
    d4: 1035,
    d6: 185,
    limites: [
      [-185, 185],
      [-140, -5],
      [-120, 168],
      [-350, 350],
      [-125, 125],
      [-350, 350],
    ],
    velocidades: [140, 126, 140, 260, 245, 322],
  },
  {
    id: 'kr120r2700',
    nombre: 'KR 120 R2700-2',
    familia: 'Carga alta',
    carga: 120,
    alcance: 2701,
    repetibilidad: 0.05,
    peso: 1069,
    montaje: 'Suelo',
    descripcion: 'Carga alta: paletizado, manipulación de piezas pesadas y fresado de gran formato.',
    d1: 675,
    a1: 350,
    a2: 1150,
    a3: 41,
    d4: 1200,
    d6: 215,
    limites: [
      [-185, 185],
      [-140, -5],
      [-120, 168],
      [-350, 350],
      [-125, 125],
      [-350, 350],
    ],
    velocidades: [120, 115, 120, 190, 180, 260],
  },
]

export function robotPorId(id: string): ModeloRobot {
  return ROBOTS.find((r) => r.id === id) ?? ROBOTS[0]
}

/** Posición de inicio habitual de KUKA|prc. */
export const HOME = [0, -90, 90, 0, 0, 0]

export interface Pose {
  /** Punto de trabajo de la herramienta (TCP). */
  tcp: V3
  /** Orientación del TCP: su eje X es la dirección de la herramienta. */
  R: M3
  /** Puntos de la cadena, para dibujarla: base, hombro, codo, muñeca, flange, TCP. */
  cadena: V3[]
}

/** Cinemática directa: ejes (grados) → posición y orientación del TCP. */
export function directa(m: ModeloRobot, q: number[], herramienta: number, base: V3 = v()): Pose {
  const t1 = rad(q[0])
  const phi2 = -rad(q[1])
  const phi3 = phi2 - rad(q[2])
  const Rz = rotZ(t1)
  const S = suma(base, aplicar(Rz, v(m.a1, 0, m.d1)))
  const E = suma(S, aplicar(Rz, v(m.a2 * Math.cos(phi2), 0, m.a2 * Math.sin(phi2))))
  const R03 = mul(Rz, rotY(-phi3))
  const W = suma(E, aplicar(R03, v(m.d4, 0, m.a3)))
  const R06 = mul(mul(mul(R03, rotX(rad(q[3]))), rotY(rad(q[4]))), rotX(rad(q[5])))
  const eje = col(R06, 0)
  const F = suma(W, escalar(eje, m.d6))
  const tcp = suma(F, escalar(eje, herramienta))
  return { tcp, R: R06, cadena: [base, S, E, W, F, tcp] }
}

export type Falla = 'alcance' | 'limite' | null

export interface SolucionIK {
  q: number[]
  falla: Falla
  /** Eje que se sale de su rango (0…5), si falla por límite. */
  eje?: number
  /** Cerca de una singularidad de muñeca (A5 ≈ 0). */
  singular: boolean
}

/**
 * Cinemática inversa: TCP deseado (posición y orientación) → ejes, eligiendo
 * la solución más cercana a `semilla` (codo arriba, muñeca que menos gira).
 */
export function inversa(m: ModeloRobot, tcp: V3, R: M3, herramienta: number, semilla: number[] = HOME, base: V3 = v()): SolucionIK {
  const eje = unit(col(R, 0))
  const W = resta(resta(tcp, escalar(eje, herramienta + m.d6)), base)
  const t1 = Math.atan2(W.y, W.x)
  // Plano del brazo.
  const r = Math.hypot(W.x, W.y) - m.a1
  const z = W.z - m.d1
  const D = Math.hypot(r, z)
  const L3 = Math.hypot(m.d4, m.a3)
  const delta = Math.atan2(m.a3, m.d4)
  const cosB = (m.a2 * m.a2 + D * D - L3 * L3) / (2 * m.a2 * D)
  if (D < 1e-6 || cosB > 1 || cosB < -1) {
    return { q: [...semilla], falla: 'alcance', singular: false }
  }
  const phi2 = Math.atan2(z, r) + Math.acos(cosB)
  const ex = m.a2 * Math.cos(phi2)
  const ez = m.a2 * Math.sin(phi2)
  const psi = Math.atan2(z - ez, r - ex)
  const phi3 = psi - delta
  const q1 = grados(t1)
  const q2 = -grados(phi2)
  const q3 = grados(phi2 - phi3)
  // Muñeca: R36 = Rx(A4)·Ry(A5)·Rx(A6).
  const R03 = mul(rotZ(t1), rotY(-phi3))
  const R36 = mul(trasp(R03), R)
  const cb = Math.max(-1, Math.min(1, R36[0][0]))
  let b = Math.acos(cb)
  let a: number
  let c: number
  const singular = Math.abs(Math.sin(b)) < Math.sin(rad(2))
  if (Math.abs(Math.sin(b)) < 1e-6) {
    // A4 y A6 se confunden: se deja A4 donde estaba.
    a = rad(semilla[3])
    const tot = Math.atan2(R36[2][1], R36[1][1])
    c = cb > 0 ? tot - a : a - tot
    b = cb > 0 ? 0 : Math.PI
  } else {
    a = Math.atan2(R36[1][0], -R36[2][0])
    c = Math.atan2(R36[0][1], R36[0][2])
  }
  // Dos soluciones de muñeca: (a, b, c) y (a+π, −b, c+π).
  const opciones = [
    [grados(a), grados(b), grados(c)],
    [grados(a + Math.PI), -grados(b), grados(c + Math.PI)],
  ].map(([A4, A5, A6]) => {
    const q = [cercano(q1, semilla[0]), q2, q3, cercano(A4, semilla[3]), A5, cercano(A6, semilla[5])]
    // Dentro de los límites, probar vueltas completas de A4/A6/A1.
    for (const k of [0, 3, 5]) q[k] = ajustarVuelta(q[k], m.limites[k], semilla[k])
    const fuera = q.findIndex((x, k) => x < m.limites[k][0] - 1e-6 || x > m.limites[k][1] + 1e-6)
    const costo = q.reduce((s, x, k) => s + Math.abs(x - semilla[k]) * (k >= 3 ? 1 : 2), 0) + (fuera >= 0 ? 1e6 : 0)
    return { q, fuera, costo }
  })
  opciones.sort((x, y) => x.costo - y.costo)
  const mejor = opciones[0]
  return {
    q: mejor.q,
    falla: mejor.fuera >= 0 ? 'limite' : null,
    eje: mejor.fuera >= 0 ? mejor.fuera : undefined,
    singular,
  }
}

/** Ángulo equivalente (±360) más cercano a la referencia. */
function cercano(x: number, ref: number): number {
  let y = x
  while (y - ref > 180) y -= 360
  while (y - ref < -180) y += 360
  return y
}

/** Si el ángulo se sale del rango, prueba ±360 para meterlo, lo más cerca de la semilla. */
function ajustarVuelta(x: number, [lo, hi]: [number, number], ref: number): number {
  const cand = [x - 720, x - 360, x, x + 360, x + 720].filter((y) => y >= lo - 1e-6 && y <= hi + 1e-6)
  if (!cand.length) return x
  return cand.reduce((b, y) => (Math.abs(y - ref) < Math.abs(b - ref) ? y : b))
}

/**
 * Orientación del TCP para un plano objetivo: la herramienta apunta en contra
 * de la Z del plano (hacia la pieza, si el plano mira hacia arriba) y la X del
 * plano fija el giro alrededor de la herramienta.
 */
export function orientacionDePlano(p: Plano): M3 {
  const xt = unit(escalar(p.z, -1))
  const zt = unit(p.x)
  const yt = unit({ x: zt.y * xt.z - zt.z * xt.y, y: zt.z * xt.x - zt.x * xt.z, z: zt.x * xt.y - zt.y * xt.x })
  return deColumnas(xt, yt, zt)
}

/** ¿Está el eje k cerca (a menos de `margen` grados) de su límite? */
export function cercaDelLimite(m: ModeloRobot, q: number[], margen = 5): number[] {
  const out: number[] = []
  q.forEach((x, k) => {
    if (x < m.limites[k][0] + margen || x > m.limites[k][1] - margen) out.push(k)
  })
  return out
}
