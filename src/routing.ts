/**
 * Routing ortogonal de mangueras.
 *
 * Dado un par de puertos, encuentra un recorrido de líneas horizontales y
 * verticales a 90° que evita los cuerpos de los componentes (no atraviesa
 * símbolos), sale de cada puerto respetando su dirección (N/S/E/O) y prioriza
 * el camino más simple. El resultado es un `d` de SVG con segmentos H/V.
 *
 * Se resuelve con A* sobre una rejilla: cada celda ~16 px, los cuerpos de los
 * componentes son obstáculos (con colchón) y se penaliza cambiar de dirección
 * para que el trazado salga limpio y sin zigzag.
 */
import type { RefPuerto } from './engine'
import type { Pieza } from './store'
import { DESCRIPTORES, VECTOR_DIR, type Direccion } from './components/descriptores'

/** Tamaño de celda de la rejilla de enrutado (px). */
const CELDA = 16
/** Colchón alrededor de un componente que las líneas no deben cruzar. */
const COLCHON_OBSTACULO = 12
/** Penalización por cada giro (para rutas limpias). */
const PESO_GIRO = 4

export interface Punto {
  x: number
  y: number
}

interface GeoPuerto {
  x: number
  y: number
  dir: Direccion
}

interface Rejilla {
  ancho: number
  alto: number
  minX: number
  minY: number
  ocupados: Set<number>
}

interface Ojo {
  x: number
  y: number
}

function puertoGeom(pieza: Pieza, puerto: string): GeoPuerto | null {
  const desc = DESCRIPTORES[pieza.tipo]
  const p = desc?.puertos.find((pp) => pp.id === puerto)
  if (!p) return null
  return { x: pieza.x + p.x, y: pieza.y + p.y, dir: p.dir }
}

function enRejilla(ancho: number, alto: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < ancho && y < alto
}

/** Construye la rejilla con los cuerpos de los componentes como obstáculos. */
function prepararRejilla(piezas: Pieza[], origenId: string, destinoId: string): Rejilla {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const p of piezas) {
    const d = DESCRIPTORES[p.tipo]
    if (!d) continue
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x + d.ancho)
    maxY = Math.max(maxY, p.y + d.alto)
  }
  const EXT = 70
  minX -= EXT
  minY -= EXT
  maxX += EXT
  maxY += EXT
  const ancho = Math.max(1, Math.ceil((maxX - minX) / CELDA))
  const alto = Math.max(1, Math.ceil((maxY - minY) / CELDA))
  const ocupados = new Set<number>()

  for (const p of piezas) {
    const d = DESCRIPTORES[p.tipo]
    if (!d) continue
    const esExtremo = p.id === origenId || p.id === destinoId
    const colchon = esExtremo ? 4 : COLCHON_OBSTACULO
    const x0 = Math.floor((p.x - minX - colchon) / CELDA)
    const y0 = Math.floor((p.y - minY - colchon) / CELDA)
    const x1 = Math.floor((p.x + d.ancho + colchon - minX) / CELDA)
    const y1 = Math.floor((p.y + d.alto + colchon - minY) / CELDA)
    for (let cy = Math.max(0, y0); cy <= Math.min(alto - 1, y1); cy++)
      for (let cx = Math.max(0, x0); cx <= Math.min(ancho - 1, x1); cx++)
        ocupados.add(cy * ancho + cx)
  }
  return { ancho, alto, minX, minY, ocupados }
}

/** Abre un pequeño pasillo en la rejilla justo en la salida de un puerto. */
function abrirSalida(g: Rejilla, pieza: Pieza, puerto: string): void {
  const geo = puertoGeom(pieza, puerto)
  if (!geo) return
  const [vx, vy] = VECTOR_DIR[geo.dir]
  const px = geo.x + vx * CELDA
  const py = geo.y + vy * CELDA
  const cx = Math.floor((px - g.minX) / CELDA)
  const cy = Math.floor((py - g.minY) / CELDA)
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const ccx = cx + dx
      const ccy = cy + dy
      if (enRejilla(g.ancho, g.alto, ccx, ccy)) g.ocupados.delete(ccy * g.ancho + ccx)
    }
}

interface NodoA {
  n: Ojo
  f: number
  g: number
  padre: NodoA | null
  dir: number
}

/** A* con penalización por giros. Devuelve el camino de celdas (sin el destino vacío). */
function astar(g: Rejilla, de: Ojo, a: Ojo): Ojo[] | null {
  const id = (n: Ojo) => n.y * g.ancho + n.x
  if (!enRejilla(g.ancho, g.alto, de.x, de.y) || !enRejilla(g.ancho, g.alto, a.x, a.y)) return null

  const abierta: NodoA[] = [{ n: de, f: 0, g: 0, padre: null, dir: -1 }]
  const cerrada = new Set<number>()
  const costos = new Map<number, number>()
  const heur = (n: Ojo) => Math.abs(n.x - a.x) + Math.abs(n.y - a.y)

  while (abierta.length) {
    // Menor f (inserción ordenada para no ordenar cada vez)
    let mejorIdx = 0
    for (let i = 1; i < abierta.length; i++) if (abierta[i].f < abierta[mejorIdx].f) mejorIdx = i
    const actual = abierta.splice(mejorIdx, 1)[0]
    const cid = id(actual.n)
    if (cid === id(a)) {
      const camino: Ojo[] = [actual.n]
      let cur: NodoA | null = actual.padre
      while (cur) {
        camino.unshift(cur.n)
        cur = cur.padre
      }
      return camino
    }
    if (cerrada.has(cid)) continue
    cerrada.add(cid)

    const vecinos: Array<[number, Ojo]> = [
      [0, { x: actual.n.x + 1, y: actual.n.y }],
      [1, { x: actual.n.x - 1, y: actual.n.y }],
      [2, { x: actual.n.x, y: actual.n.y + 1 }],
      [3, { x: actual.n.x, y: actual.n.y - 1 }],
    ]
    for (const [d, nv] of vecinos) {
      const nid = id(nv)
      if (!enRejilla(g.ancho, g.alto, nv.x, nv.y) || g.ocupados.has(nid)) continue
      const giro = actual.dir !== -1 && actual.dir !== d ? PESO_GIRO : 0
      const tentativa = actual.g + 1 + giro
      const previo = costos.get(nid)
      if (previo !== undefined && previo <= tentativa) continue
      costos.set(nid, tentativa)
      abierta.push({ n: nv, f: tentativa + heur(nv), g: tentativa, padre: actual, dir: d })
    }
  }
  return null
}

/** Elimina puntos colineales consecutivos (H o V). */
function simplificar(pts: Punto[]): Punto[] {
  if (pts.length < 3) return pts
  const out: Punto[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    const ant = out[out.length - 1]
    const sig = pts[i + 1]
    if (!(ant.y === p.y && p.y === sig.y) && !(ant.x === p.x && p.x === sig.x)) out.push(p)
  }
  out.push(pts[pts.length - 1])
  return out
}

function aPath(pts: Punto[]): string {
  if (!pts.length) return ''
  const partes = [`M${pts[0].x},${pts[0].y}`]
  for (let i = 1; i < pts.length; i++) partes.push(`L${pts[i].x},${pts[i].y}`)
  return partes.join(' ')
}

/** Ruta ortogonal simple de respaldo (sin evitar obstáculos). */
function rutaSimple(g1: Punto, g2: Punto): string {
  return aPath(simplificar([g1, { x: g1.x, y: g2.y }, g2]))
}

/**
 * Enruta una manguera entre dos puertos. Devuelve un `d` de SVG ortogonal que
 * evita los cuerpos de todos los componentes.
 */
export function enrutarManguera(
  piezas: Pieza[],
  pieza1: Pieza,
  ref1: RefPuerto,
  pieza2: Pieza,
  ref2: RefPuerto,
): string {
  const g1 = puertoGeom(pieza1, ref1.puerto)
  const g2 = puertoGeom(pieza2, ref2.puerto)
  if (!g1 || !g2) return ''

  const rej = prepararRejilla(piezas, pieza1.id, pieza2.id)
  abrirSalida(rej, pieza1, ref1.puerto)
  abrirSalida(rej, pieza2, ref2.puerto)

  const de = { x: Math.floor((g1.x - rej.minX) / CELDA), y: Math.floor((g1.y - rej.minY) / CELDA) }
  const a = { x: Math.floor((g2.x - rej.minX) / CELDA), y: Math.floor((g2.y - rej.minY) / CELDA) }

  const ruta = astar(rej, de, a)
  if (!ruta || ruta.length < 2) return rutaSimple(g1, g2)

  const puntos = ruta.map((c) => ({
    x: rej.minX + (c.x + 0.5) * CELDA,
    y: rej.minY + (c.y + 0.5) * CELDA,
  }))
  // Ajustar extremos exactos a los puertos, garantizando tramos ortogonales.
  puntos[0] = { x: g1.x, y: g1.y }
  puntos[puntos.length - 1] = { x: g2.x, y: g2.y }
  ortogonalizarExtremos(puntos)
  return aPath(simplificar(puntos))
}

/**
 * Si el primer (o último) tramo entre el puerto y el siguiente punto no es
 * horizontal ni vertical, inserta un vértice auxiliar para que el trazado
 * siga siendo ortogonal (el problema aparece al usar el puerto exacto, que no
 * cae en el centro de las celdas del enrutado).
 */
function ortogonalizarExtremos(pts: Punto[]): void {
  if (pts.length < 2) return
  // Primer tramo
  let p0 = pts[0]
  const p1 = pts[1]
  if (Math.abs(p0.x - p1.x) > 0.1 && Math.abs(p0.y - p1.y) > 0.1) {
    pts.splice(1, 0, { x: p0.x, y: p1.y })
    p0 = pts[0]
  }
  // Último tramo (puede haberse desplazado el índice tras el splice anterior)
  const n = pts.length
  const pLast = pts[n - 1]
  const pPrev = pts[n - 2]
  if (Math.abs(pLast.x - pPrev.x) > 0.1 && Math.abs(pLast.y - pPrev.y) > 0.1) {
    pts.splice(n - 1, 0, { x: pLast.x, y: pPrev.y })
  }
}
