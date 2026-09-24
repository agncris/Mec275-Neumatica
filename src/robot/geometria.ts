/**
 * Curvas planas para la programación de trayectorias: polilíneas (los arcos
 * se guardan ya divididos), lectura de planos DXF y las operaciones de
 * Grasshopper que se usan en la unidad (dividir por largo o en partes,
 * discontinuidades, desfase para el radio de la herramienta, mover).
 */
import { dist, lerp, resta, suma, unit, v, type V3 } from './matematica'

export interface Curva {
  pts: V3[]
  cerrada: boolean
  /** Índices de los vértices donde la curva hace una esquina (no los de los arcos). */
  esquinas: number[]
  capa?: string
}

const PASO_ARCO = (5 * Math.PI) / 180

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------
export function polilinea(pts: V3[], cerrada = false, esquinas?: number[]): Curva {
  return { pts, cerrada, esquinas: esquinas ?? pts.map((_, i) => i) }
}

/** Puntos de un arco (sin el primero), de a1 a a2 en sentido antihorario si ccw. */
function arco(c: V3, r: number, a1: number, a2: number, ccw = true): V3[] {
  let barrido = a2 - a1
  if (ccw) while (barrido <= 0) barrido += 2 * Math.PI
  else while (barrido >= 0) barrido -= 2 * Math.PI
  const n = Math.max(2, Math.ceil(Math.abs(barrido) / PASO_ARCO))
  const out: V3[] = []
  for (let i = 1; i <= n; i++) {
    const a = a1 + (barrido * i) / n
    out.push(v(c.x + r * Math.cos(a), c.y + r * Math.sin(a), c.z))
  }
  return out
}

export function rectangulo(ancho: number, alto: number, radio = 0, origen: V3 = v()): Curva {
  const r = Math.max(0, Math.min(radio, ancho / 2 - 1e-6, alto / 2 - 1e-6))
  const { x, y, z } = origen
  if (r <= 0) {
    return polilinea([v(x, y, z), v(x + ancho, y, z), v(x + ancho, y + alto, z), v(x, y + alto, z)], true)
  }
  const pts: V3[] = []
  const esq: number[] = []
  const tramo = (c: V3, a1: number) => {
    const inicio = v(c.x + r * Math.cos(a1), c.y + r * Math.sin(a1), z)
    esq.push(pts.length)
    pts.push(inicio)
    pts.push(...arco(c, r, a1, a1 + Math.PI / 2))
    esq.push(pts.length - 1)
  }
  tramo(v(x + ancho - r, y + r, z), -Math.PI / 2)
  tramo(v(x + ancho - r, y + alto - r, z), 0)
  tramo(v(x + r, y + alto - r, z), Math.PI / 2)
  tramo(v(x + r, y + r, z), Math.PI)
  return { pts, cerrada: true, esquinas: esq }
}

export function circulo(centro: V3, radio: number): Curva {
  const pts = [v(centro.x + radio, centro.y, centro.z), ...arco(centro, radio, 0, 2 * Math.PI)]
  pts.pop() // el último repite el primero
  return { pts, cerrada: true, esquinas: [] }
}

export function poligono(lados: number, radio: number, centro: V3 = v()): Curva {
  const n = Math.max(3, Math.round(lados))
  const pts = Array.from({ length: n }, (_, i) => {
    const a = Math.PI / 2 + (2 * Math.PI * i) / n
    return v(centro.x + radio * Math.cos(a), centro.y + radio * Math.sin(a), centro.z)
  })
  return polilinea(pts, true)
}

export function mover(c: Curva, d: V3): Curva {
  return { ...c, pts: c.pts.map((p) => suma(p, d)) }
}

// ---------------------------------------------------------------------------
// Medir y dividir
// ---------------------------------------------------------------------------
function tramos(c: Curva): Array<[V3, V3]> {
  const t: Array<[V3, V3]> = []
  for (let i = 1; i < c.pts.length; i++) t.push([c.pts[i - 1], c.pts[i]])
  if (c.cerrada && c.pts.length > 1) t.push([c.pts[c.pts.length - 1], c.pts[0]])
  return t
}

export function largoCurva(c: Curva): number {
  return tramos(c).reduce((s, [a, b]) => s + dist(a, b), 0)
}

/** Punto y tangente a la distancia s medida sobre la curva. */
export function enLargo(c: Curva, s: number): { p: V3; t: V3 } {
  let acum = 0
  const ts = tramos(c)
  for (const [a, b] of ts) {
    const l = dist(a, b)
    if (acum + l >= s - 1e-9 && l > 0) {
      const f = Math.max(0, Math.min(1, (s - acum) / l))
      return { p: lerp(a, b, f), t: unit(resta(b, a)) }
    }
    acum += l
  }
  const [a, b] = ts[ts.length - 1] ?? [c.pts[0], c.pts[0]]
  return { p: c.cerrada ? c.pts[0] : b, t: unit(resta(b, a)) }
}

/** Divide Length: puntos cada `paso` mm desde el inicio. */
export function dividirLargo(c: Curva, paso: number): Array<{ p: V3; t: V3 }> {
  const L = largoCurva(c)
  if (paso <= 0 || L <= 0) return []
  const out: Array<{ p: V3; t: V3 }> = []
  for (let s = 0; s <= L + 1e-6; s += paso) {
    if (c.cerrada && s >= L - 1e-6) break
    out.push(enLargo(c, s))
  }
  return out
}

/** Divide Curve: la curva en n partes iguales. */
export function dividirPartes(c: Curva, n: number): Array<{ p: V3; t: V3 }> {
  const L = largoCurva(c)
  const k = Math.max(1, Math.round(n))
  const out: Array<{ p: V3; t: V3 }> = []
  const ultimo = c.cerrada ? k - 1 : k
  for (let i = 0; i <= ultimo; i++) out.push(enLargo(c, (L * i) / k))
  return out
}

/** Discontinuity: los puntos donde la curva cambia bruscamente de dirección (y sus extremos). */
export function discontinuidades(c: Curva): V3[] {
  const idx = new Set(c.esquinas)
  if (!c.cerrada && c.pts.length) {
    idx.add(0)
    idx.add(c.pts.length - 1)
  }
  return [...idx].sort((a, b) => a - b).map((i) => c.pts[i])
}

// ---------------------------------------------------------------------------
// Desfase (para compensar el radio de la herramienta)
// ---------------------------------------------------------------------------
function areaFirmada(pts: V3[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

/**
 * Offset Curve en el plano XY. En curvas cerradas, distancia positiva =
 * hacia fuera; en abiertas, hacia la izquierda del sentido de avance.
 */
export function desfasar(c: Curva, d: number): Curva {
  const n = c.pts.length
  if (n < 2 || d === 0) return { ...c, pts: [...c.pts] }
  // Normal "izquierda" de cada tramo.
  let signo = 1
  if (c.cerrada) signo = areaFirmada(c.pts) > 0 ? -1 : 1 // CCW: fuera = derecha
  const dd = d * signo
  const nrm = (a: V3, b: V3): V3 => {
    const t = unit(resta(b, a))
    return v(-t.y, t.x, 0)
  }
  const out: V3[] = []
  for (let i = 0; i < n; i++) {
    const p = c.pts[i]
    const prev = i > 0 ? c.pts[i - 1] : c.cerrada ? c.pts[n - 1] : null
    const next = i < n - 1 ? c.pts[i + 1] : c.cerrada ? c.pts[0] : null
    if (!prev && next) {
      const m = nrm(p, next)
      out.push(suma(p, v(m.x * dd, m.y * dd, 0)))
      continue
    }
    if (prev && !next) {
      const m = nrm(prev, p)
      out.push(suma(p, v(m.x * dd, m.y * dd, 0)))
      continue
    }
    const n1 = nrm(prev as V3, p)
    const n2 = nrm(p, next as V3)
    const bis = unit(v(n1.x + n2.x, n1.y + n2.y, 0))
    const cos = bis.x * n1.x + bis.y * n1.y
    // Inglete limitado para ángulos muy agudos.
    const k = dd / Math.max(0.25, cos)
    out.push(suma(p, v(bis.x * k, bis.y * k, 0)))
  }
  return { ...c, pts: out }
}

// ---------------------------------------------------------------------------
// Lectura de DXF (ASCII)
// ---------------------------------------------------------------------------
export interface DibujoDXF {
  curvas: Curva[]
  avisos: string[]
  capas: string[]
  unidades: string
}

interface Pieza {
  pts: V3[]
  cerrada: boolean
  esquinas: number[]
  capa: string
}

/** Agrega el arco definido por un «bulge» entre a y b (sin a). */
function bulgeA(a: V3, b: V3, bulge: number): V3[] {
  if (Math.abs(bulge) < 1e-9) return [b]
  const ang = 4 * Math.atan(bulge)
  const d = dist(a, b)
  const r = d / (2 * Math.sin(Math.abs(ang) / 2))
  const m = lerp(a, b, 0.5)
  const h = Math.sqrt(Math.max(0, r * r - (d / 2) ** 2))
  const t = unit(resta(b, a))
  const izq = v(-t.y, t.x, 0)
  // Con bulge positivo el arco va antihorario: el centro queda a la izquierda si |ang| < π.
  const lado = (bulge > 0 ? 1 : -1) * (Math.abs(ang) < Math.PI ? 1 : -1)
  const c = suma(m, v(izq.x * h * lado, izq.y * h * lado, 0))
  const a1 = Math.atan2(a.y - c.y, a.x - c.x)
  const a2 = Math.atan2(b.y - c.y, b.x - c.x)
  const pts = arco(c, r, a1, a2, bulge > 0)
  pts[pts.length - 1] = b
  return pts
}

export function leerDXF(texto: string): DibujoDXF {
  const lineas = texto.replace(/\r/g, '').split('\n')
  const pares: Array<[number, string]> = []
  for (let i = 0; i + 1 < lineas.length; i += 2) {
    const cod = parseInt(lineas[i].trim(), 10)
    if (Number.isNaN(cod)) {
      i -= 1
      continue
    }
    pares.push([cod, lineas[i + 1].trim()])
  }
  const avisos: string[] = []
  // Unidades del encabezado.
  let escala = 1
  let unidades = 'mm'
  for (let i = 0; i < pares.length; i++) {
    if (pares[i][0] === 9 && pares[i][1] === '$INSUNITS') {
      const u = Number(pares[i + 1]?.[1])
      const tabla: Record<number, [number, string]> = { 1: [25.4, 'pulgadas'], 4: [1, 'mm'], 5: [10, 'cm'], 6: [1000, 'm'] }
      if (tabla[u]) [escala, unidades] = tabla[u]
    }
  }
  // Entidades.
  const ini = pares.findIndex(([c, val], i) => c === 2 && val === 'ENTITIES' && pares[i - 1]?.[1] === 'SECTION')
  if (ini < 0) return { curvas: [], avisos: ['El archivo no tiene sección ENTITIES: ¿es un DXF de texto (ASCII)?'], capas: [], unidades }
  const entidades: Array<{ tipo: string; datos: Array<[number, string]> }> = []
  for (let i = ini + 1; i < pares.length; i++) {
    const [c, val] = pares[i]
    if (c === 0) {
      if (val === 'ENDSEC') break
      entidades.push({ tipo: val, datos: [] })
    } else entidades[entidades.length - 1]?.datos.push([c, val])
  }
  const piezas: Pieza[] = []
  const num = (d: Array<[number, string]>, c: number, def = 0) => {
    const x = d.find(([k]) => k === c)
    return x ? Number(x[1]) * escala : def
  }
  const capaDe = (d: Array<[number, string]>) => d.find(([k]) => k === 8)?.[1] ?? '0'
  const ignoradas = new Set<string>()
  for (let k = 0; k < entidades.length; k++) {
    const { tipo, datos } = entidades[k]
    const capa = capaDe(datos)
    if (tipo === 'LINE') {
      piezas.push({ pts: [v(num(datos, 10), num(datos, 20)), v(num(datos, 11), num(datos, 21))], cerrada: false, esquinas: [0, 1], capa })
    } else if (tipo === 'CIRCLE') {
      const c = circulo(v(num(datos, 10), num(datos, 20)), num(datos, 40))
      piezas.push({ ...c, capa })
    } else if (tipo === 'ARC') {
      const c = v(num(datos, 10), num(datos, 20))
      const r = num(datos, 40)
      const a1 = (Number(datos.find(([q]) => q === 50)?.[1] ?? 0) * Math.PI) / 180
      const a2 = (Number(datos.find(([q]) => q === 51)?.[1] ?? 0) * Math.PI) / 180
      const pts = [v(c.x + r * Math.cos(a1), c.y + r * Math.sin(a1)), ...arco(c, r, a1, a2)]
      piezas.push({ pts, cerrada: false, esquinas: [0, pts.length - 1], capa })
    } else if (tipo === 'LWPOLYLINE') {
      const cerrada = (Number(datos.find(([q]) => q === 70)?.[1] ?? 0) & 1) === 1
      const verts: Array<{ p: V3; b: number }> = []
      for (const [q, val] of datos) {
        if (q === 10) verts.push({ p: v(Number(val) * escala, 0), b: 0 })
        else if (q === 20 && verts.length) verts[verts.length - 1].p.y = Number(val) * escala
        else if (q === 42 && verts.length) verts[verts.length - 1].b = Number(val)
      }
      piezas.push({ ...conBulges(verts, cerrada), capa })
    } else if (tipo === 'POLYLINE') {
      const cerrada = (Number(datos.find(([q]) => q === 70)?.[1] ?? 0) & 1) === 1
      const verts: Array<{ p: V3; b: number }> = []
      while (entidades[k + 1]?.tipo === 'VERTEX') {
        k++
        const d = entidades[k].datos
        verts.push({ p: v(num(d, 10), num(d, 20)), b: Number(d.find(([q]) => q === 42)?.[1] ?? 0) })
      }
      if (entidades[k + 1]?.tipo === 'SEQEND') k++
      piezas.push({ ...conBulges(verts, cerrada), capa })
    } else if (tipo === 'SPLINE') {
      const pts: V3[] = []
      const ajuste = datos.some(([q]) => q === 11)
      for (const [q, val] of datos) {
        if (q === (ajuste ? 11 : 10)) pts.push(v(Number(val) * escala, 0))
        else if (q === (ajuste ? 21 : 20) && pts.length) pts[pts.length - 1].y = Number(val) * escala
      }
      if (pts.length > 1) {
        piezas.push({ pts, cerrada: false, esquinas: [0, pts.length - 1], capa })
        avisos.push('Las curvas SPLINE se leen de forma aproximada (por sus puntos).')
      }
    } else if (!['VERTEX', 'SEQEND', 'TEXT', 'MTEXT', 'DIMENSION', 'HATCH', 'POINT', 'INSERT', 'SOLID', 'ATTRIB'].includes(tipo)) {
      ignoradas.add(tipo)
    }
  }
  if (ignoradas.size) avisos.push(`Se ignoraron entidades ${[...ignoradas].join(', ')}.`)
  const curvas = encadenar(piezas)
  const capas = [...new Set(curvas.map((c) => c.capa ?? '0'))]
  if (!curvas.length) avisos.push('No se encontraron líneas, arcos, círculos ni polilíneas.')
  return { curvas, avisos: [...new Set(avisos)], capas, unidades }
}

function conBulges(verts: Array<{ p: V3; b: number }>, cerrada: boolean): { pts: V3[]; cerrada: boolean; esquinas: number[] } {
  if (!verts.length) return { pts: [], cerrada, esquinas: [] }
  const pts: V3[] = [verts[0].p]
  const esquinas = [0]
  const n = verts.length
  for (let i = 0; i < (cerrada ? n : n - 1); i++) {
    const a = verts[i]
    const b = verts[(i + 1) % n]
    const nuevos = bulgeA(a.p, b.p, a.b)
    if (cerrada && i === n - 1) nuevos.pop() // vuelve al primero
    pts.push(...nuevos)
    if (!(cerrada && i === n - 1)) esquinas.push(pts.length - 1)
  }
  return { pts, cerrada, esquinas: esquinas.filter((e) => e < pts.length) }
}

/** Une tramos sueltos (líneas y arcos) que comparten extremos en polilíneas continuas. */
function encadenar(piezas: Pieza[]): Curva[] {
  const tol = 0.01
  const cerca = (a: V3, b: V3) => dist(a, b) < tol
  const libres = piezas.filter((p) => !p.cerrada && p.pts.length > 1)
  const out: Curva[] = piezas.filter((p) => p.cerrada && p.pts.length > 1).map((p) => ({ pts: p.pts, cerrada: true, esquinas: p.esquinas, capa: p.capa }))
  const usado = new Array(libres.length).fill(false)
  for (let i = 0; i < libres.length; i++) {
    if (usado[i]) continue
    usado[i] = true
    let pts = [...libres[i].pts]
    let esq = new Set(libres[i].esquinas)
    let seguir = true
    while (seguir) {
      seguir = false
      for (let j = 0; j < libres.length; j++) {
        if (usado[j] || libres[j].capa !== libres[i].capa) continue
        const q = libres[j].pts
        const fin = pts[pts.length - 1]
        const ini = pts[0]
        let agregar: V3[] | null = null
        let alInicio = false
        if (cerca(fin, q[0])) agregar = q
        else if (cerca(fin, q[q.length - 1])) agregar = [...q].reverse()
        else if (cerca(ini, q[q.length - 1])) {
          agregar = q
          alInicio = true
        } else if (cerca(ini, q[0])) {
          agregar = [...q].reverse()
          alInicio = true
        }
        if (!agregar) continue
        usado[j] = true
        seguir = true
        if (alInicio) {
          const n = agregar.length - 1
          pts = [...agregar.slice(0, -1), ...pts]
          esq = new Set([...[...esq].map((e) => e + n), 0, n])
        } else {
          const base = pts.length - 1
          esq.add(base)
          pts = [...pts, ...agregar.slice(1)]
          esq.add(pts.length - 1)
        }
      }
    }
    let cerrada = false
    if (pts.length > 2 && cerca(pts[0], pts[pts.length - 1])) {
      pts.pop()
      cerrada = true
      esq = new Set([...esq].map((e) => (e >= pts.length ? 0 : e)))
    }
    out.push({ pts, cerrada, esquinas: [...esq].sort((a, b) => a - b), capa: libres[i].capa })
  }
  return out
}

/** Caja que contiene las curvas (en XY). */
export function cajaCurvas(cs: Curva[]): { min: V3; max: V3 } {
  const min = v(Infinity, Infinity, Infinity)
  const max = v(-Infinity, -Infinity, -Infinity)
  for (const c of cs)
    for (const p of c.pts) {
      min.x = Math.min(min.x, p.x)
      min.y = Math.min(min.y, p.y)
      min.z = Math.min(min.z, p.z)
      max.x = Math.max(max.x, p.x)
      max.y = Math.max(max.y, p.y)
      max.z = Math.max(max.z, p.z)
    }
  return { min, max }
}

/** Área (valor absoluto) y centroide de una curva cerrada en XY. */
export function areaCentro(c: Curva): { area: number; centro: V3 } {
  const pts = c.pts
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    const k = p.x * q.y - q.x * p.y
    a += k
    cx += (p.x + q.x) * k
    cy += (p.y + q.y) * k
  }
  a /= 2
  const z = pts.reduce((s, p) => s + p.z, 0) / Math.max(1, pts.length)
  if (Math.abs(a) < 1e-9) {
    const m = pts.reduce((s, p) => suma(s, p), v())
    return { area: 0, centro: v(m.x / pts.length, m.y / pts.length, z) }
  }
  return { area: Math.abs(a), centro: v(cx / (6 * a), cy / (6 * a), z) }
}

/** Plano de ejemplo en DXF (texto), para probar la lectura de planos. */
export function dxfDeEjemplo(): string {
  const L: string[] = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES']
  // Contorno 180 x 120 con esquinas de R10 (polilínea con arcos «bulge»).
  const r = 10
  const w = 180
  const h = 120
  const b = Math.tan(Math.PI / 8) // cuarto de círculo
  const vs: Array<[number, number, number]> = [
    [r, 0, 0],
    [w - r, 0, b],
    [w, r, 0],
    [w, h - r, b],
    [w - r, h, 0],
    [r, h, b],
    [0, h - r, 0],
    [0, r, b],
  ]
  L.push('0', 'LWPOLYLINE', '8', 'CONTORNO', '90', String(vs.length), '70', '1')
  for (const [x, y, bu] of vs) {
    L.push('10', String(x), '20', String(y))
    if (bu) L.push('42', bu.toFixed(6))
  }
  for (const [x, y] of [
    [15, 15],
    [165, 15],
    [165, 105],
    [15, 105],
  ])
    L.push('0', 'CIRCLE', '8', 'AGUJEROS', '10', String(x), '20', String(y), '30', '0', '40', '3')
  // Ranura central: dos líneas y dos arcos.
  L.push('0', 'LINE', '8', 'RANURA', '10', '70', '20', '52', '11', '110', '21', '52')
  L.push('0', 'ARC', '8', 'RANURA', '10', '110', '20', '60', '40', '8', '50', '270', '51', '90')
  L.push('0', 'LINE', '8', 'RANURA', '10', '110', '20', '68', '11', '70', '21', '68')
  L.push('0', 'ARC', '8', 'RANURA', '10', '70', '20', '60', '40', '8', '50', '90', '51', '270')
  L.push('0', 'ENDSEC', '0', 'EOF')
  return L.join('\n')
}
