/**
 * Álgebra mínima para la unidad de robótica: vectores, matrices de rotación
 * 3×3 y planos (origen + ejes), en milímetros y radianes.
 */

export interface V3 {
  x: number
  y: number
  z: number
}

/** Matriz 3×3 por filas: m[f][c]. Sus columnas son los ejes X, Y, Z del marco. */
export type M3 = [[number, number, number], [number, number, number], [number, number, number]]

/** Plano: origen y ejes (como los planos de Grasshopper). */
export interface Plano {
  o: V3
  x: V3
  y: V3
  z: V3
}

export const v = (x = 0, y = 0, z = 0): V3 => ({ x, y, z })
export const suma = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
export const resta = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
export const escalar = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k })
export const punto = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z
export const cruz = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
export const largo = (a: V3) => Math.hypot(a.x, a.y, a.z)
export const dist = (a: V3, b: V3) => largo(resta(a, b))
export const unit = (a: V3): V3 => {
  const l = largo(a)
  return l < 1e-12 ? { x: 0, y: 0, z: 0 } : escalar(a, 1 / l)
}
export const lerp = (a: V3, b: V3, t: number): V3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })

export const rad = (g: number) => (g * Math.PI) / 180
export const grados = (r: number) => (r * 180) / Math.PI

export function rotX(a: number): M3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ]
}
export function rotY(a: number): M3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ]
}
export function rotZ(a: number): M3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ]
}

export function mul(a: M3, b: M3): M3 {
  const r = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ] as M3
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]
  return r
}

export function trasp(a: M3): M3 {
  return [
    [a[0][0], a[1][0], a[2][0]],
    [a[0][1], a[1][1], a[2][1]],
    [a[0][2], a[1][2], a[2][2]],
  ]
}

export function aplicar(m: M3, p: V3): V3 {
  return {
    x: m[0][0] * p.x + m[0][1] * p.y + m[0][2] * p.z,
    y: m[1][0] * p.x + m[1][1] * p.y + m[1][2] * p.z,
    z: m[2][0] * p.x + m[2][1] * p.y + m[2][2] * p.z,
  }
}

export const col = (m: M3, j: 0 | 1 | 2): V3 => ({ x: m[0][j], y: m[1][j], z: m[2][j] })

export function deColumnas(x: V3, y: V3, z: V3): M3 {
  return [
    [x.x, y.x, z.x],
    [x.y, y.y, z.y],
    [x.z, y.z, z.z],
  ]
}

/**
 * Ángulos A, B, C de KUKA (Z-Y'-X''): A gira alrededor de Z, luego B
 * alrededor del nuevo Y y C alrededor del nuevo X. En grados.
 */
export function aABC(m: M3): { a: number; b: number; c: number } {
  const b = Math.atan2(-m[2][0], Math.hypot(m[0][0], m[1][0]))
  let a: number
  let c: number
  if (Math.abs(Math.cos(b)) < 1e-9) {
    a = 0
    c = Math.atan2(-m[1][2], m[1][1]) * (b > 0 ? 1 : -1)
  } else {
    a = Math.atan2(m[1][0], m[0][0])
    c = Math.atan2(m[2][1], m[2][2])
  }
  return { a: grados(a), b: grados(b), c: grados(c) }
}

export function deABC(a: number, b: number, c: number): M3 {
  return mul(mul(rotZ(rad(a)), rotY(rad(b))), rotX(rad(c)))
}

/** Matriz del plano (columnas = ejes). */
export const matrizPlano = (p: Plano): M3 => deColumnas(p.x, p.y, p.z)

export function planoXY(o: V3): Plano {
  return { o, x: v(1, 0, 0), y: v(0, 1, 0), z: v(0, 0, 1) }
}

/** Plano a partir de un origen, un eje X aproximado y una normal Z. */
export function planoDe(o: V3, x: V3, z: V3): Plano {
  const zz = unit(z)
  const xx = unit(resta(x, escalar(zz, punto(x, zz))))
  const xs = largo(xx) < 1e-9 ? unit(Math.abs(zz.x) < 0.9 ? cruz(v(0, 1, 0), zz) : cruz(v(0, 0, 1), zz)) : xx
  return { o, x: xs, y: cruz(zz, xs), z: zz }
}

/** Lleva un plano dado en coordenadas de `base` a coordenadas del mundo. */
export function aMundo(base: Plano, p: Plano): Plano {
  const m = matrizPlano(base)
  return { o: suma(base.o, aplicar(m, p.o)), x: aplicar(m, p.x), y: aplicar(m, p.y), z: aplicar(m, p.z) }
}

/** Interpolación esférica de orientaciones (por cuaterniones). */
export function slerpM(a: M3, b: M3, t: number): M3 {
  const qa = aCuat(a)
  let qb = aCuat(b)
  let d = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3]
  if (d < 0) {
    qb = [-qb[0], -qb[1], -qb[2], -qb[3]]
    d = -d
  }
  let q: number[]
  if (d > 0.9995) q = qa.map((x, i) => x + (qb[i] - x) * t)
  else {
    const th = Math.acos(d)
    const s = Math.sin(th)
    const wa = Math.sin((1 - t) * th) / s
    const wb = Math.sin(t * th) / s
    q = qa.map((x, i) => x * wa + qb[i] * wb)
  }
  const n = Math.hypot(...q)
  return deCuat(q.map((x) => x / n) as [number, number, number, number])
}

function aCuat(m: M3): [number, number, number, number] {
  const tr = m[0][0] + m[1][1] + m[2][2]
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    return [0.25 * s, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s]
  }
  if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2
    return [(m[2][1] - m[1][2]) / s, 0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s]
  }
  if (m[1][1] > m[2][2]) {
    const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2
    return [(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s]
  }
  const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2
  return [(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s]
}

function deCuat([w, x, y, z]: [number, number, number, number]): M3 {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ]
}

/** Ángulo entre dos orientaciones, en radianes. */
export function anguloEntre(a: M3, b: M3): number {
  const r = mul(trasp(a), b)
  const c = (r[0][0] + r[1][1] + r[2][2] - 1) / 2
  return Math.acos(Math.max(-1, Math.min(1, c)))
}
