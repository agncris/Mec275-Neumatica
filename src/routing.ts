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
function prepararRejilla(piezas: Pieza[], origenId: string, destinoId: string, colchonBase = COLCHON_OBSTACULO): Rejilla {
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
    const colchon = esExtremo ? 4 : colchonBase
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


  // El A* busca entre las *salidas* de los puertos, no entre los puertos: así
  // el trazado nunca tiene que entrar en la ficha para alcanzar su propio
  // puerto (que está pegado al borde del símbolo).
  const [v1x, v1y] = VECTOR_DIR[g1.dir]
  const [v2x, v2y] = VECTOR_DIR[g2.dir]
  const salida1 = { x: g1.x + v1x * RABO, y: g1.y + v1y * RABO }
  const salida2 = { x: g2.x + v2x * RABO, y: g2.y + v2y * RABO }
  // Si con el colchón normal no hay paso (pasillos estrechos), se reintenta
  // con menos holgura antes de rendirse: más vale un trazado apretado que uno
  // recto que cruce por encima de los símbolos.
  let rej = prepararRejilla(piezas, pieza1.id, pieza2.id)
  let ruta: Ojo[] | null = null
  for (const colchon of [COLCHON_OBSTACULO, 6, 2]) {
    rej = prepararRejilla(piezas, pieza1.id, pieza2.id, colchon)
    abrirSalida(rej, pieza1, ref1.puerto)
    abrirSalida(rej, pieza2, ref2.puerto)
    const de2 = { x: Math.floor((salida1.x - rej.minX) / CELDA), y: Math.floor((salida1.y - rej.minY) / CELDA) }
    const a2 = { x: Math.floor((salida2.x - rej.minX) / CELDA), y: Math.floor((salida2.y - rej.minY) / CELDA) }
    ruta = astar(rej, de2, a2)
    if (ruta && ruta.length >= 2) break
  }
  if (!ruta || ruta.length < 2) return rutaSimple(g1, g2)

  const puntos = ruta.map((c) => ({
    x: rej.minX + (c.x + 0.5) * CELDA,
    y: rej.minY + (c.y + 0.5) * CELDA,
  }))
  // Los extremos se clavan en el puerto exacto, con su tramo perpendicular.
  puntos.splice(0, 1, { x: g1.x, y: g1.y }, salida1)
  puntos.splice(puntos.length - 1, 1, salida2, { x: g2.x, y: g2.y })
  ortogonalizarIntermedios(puntos)
  return aPath(simplificar(puntos))
}

/**
 * Inserta los vértices que hagan falta para que todos los tramos sean
 * horizontales o verticales. Hace falta porque los puertos no caen en el
 * centro de las celdas del enrutado, así que las uniones con la rejilla
 * quedarían en diagonal.
 */
function ortogonalizarIntermedios(pts: Punto[]): void {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    if (Math.abs(a.x - b.x) > 0.1 && Math.abs(a.y - b.y) > 0.1) {
      // Se dobla primero en el eje por el que ya venía el tramo anterior.
      const anterior = i >= 2 ? pts[i - 2] : null
      const veniaEnVertical = anterior ? Math.abs(anterior.x - a.x) < 0.1 : false
      pts.splice(i, 0, veniaEnVertical ? { x: b.x, y: a.y } : { x: a.x, y: b.y })
      i++
    }
  }
}

// ---------------------------------------------------------------------------
// Enrutado por carril (línea de grupo)
//
// Cuando una manguera pertenece a una barra horizontal —una línea de grupo o
// la de presión— no se enruta «a su aire»: baja en vertical desde su puerto
// hasta la barra, recorre la barra y sube al otro puerto. Como todas las
// mangueras de la barra comparten esa altura, sus trazados se superponen y en
// pantalla se ve una única línea, igual que en el plano de clase.
// ---------------------------------------------------------------------------

/** Holgura que se le deja a los cuerpos de las piezas al buscar un canal. */
const HOLGURA_CANAL = 10
/** Tramo recto con el que una manguera sale del puerto antes de girar. */
const RABO = 18
/** Hasta dónde se busca un canal vertical libre a los lados del puerto. */
const BUSQUEDA_CANAL = 260

interface CajaPieza {
  x: number
  y: number
  w: number
  h: number
}

function cajasDe(piezas: Pieza[], excepto: Set<string>): CajaPieza[] {
  const out: CajaPieza[] = []
  for (const p of piezas) {
    if (excepto.has(p.id)) continue
    const d = DESCRIPTORES[p.tipo]
    if (!d) continue
    out.push({ x: p.x - HOLGURA_CANAL, y: p.y - HOLGURA_CANAL, w: d.ancho + HOLGURA_CANAL * 2, h: d.alto + HOLGURA_CANAL * 2 })
  }
  return out
}

const cortaVertical = (c: CajaPieza, x: number, y0: number, y1: number) =>
  x > c.x && x < c.x + c.w && Math.max(y0, y1) > c.y && Math.min(y0, y1) < c.y + c.h

const cortaHorizontal = (c: CajaPieza, y: number, x0: number, x1: number) =>
  y > c.y && y < c.y + c.h && Math.max(x0, x1) > c.x && Math.min(x0, x1) < c.x + c.w

/**
 * Lleva un puerto hasta la altura de la barra: sale por su lado, busca un
 * canal vertical libre y baja (o sube) hasta el carril. Devuelve los vértices
 * desde el puerto hasta el punto de empalme, o null si no hay paso limpio.
 *
 * El canal tiene que esquivar también el cuerpo de la propia pieza: un puerto
 * que mira hacia abajo y una barra que va por arriba obligan a rodear la
 * ficha, no a atravesarla.
 */
function ramalHastaCarril(
  pieza: Pieza,
  puerto: string,
  yCarril: number,
  cajas: CajaPieza[],
): Punto[] | null {
  const geo = puertoGeom(pieza, puerto)
  if (!geo) return null
  const [vx, vy] = VECTOR_DIR[geo.dir]
  const salida = { x: geo.x + vx * RABO, y: geo.y + vy * RABO }
  // Si el puerto mira hacia el carril y ya está alineado, basta con bajar.
  const candidatos: number[] = [salida.x]
  for (let d = CELDA; d <= BUSQUEDA_CANAL; d += CELDA) {
    candidatos.push(salida.x + d, salida.x - d)
  }
  for (const xc of candidatos) {
    const tramoH = cajas.some((c) => cortaHorizontal(c, salida.y, salida.x, xc))
    if (tramoH) continue
    const tramoV = cajas.some((c) => cortaVertical(c, xc, salida.y, yCarril))
    if (tramoV) continue
    const pts: Punto[] = [{ x: geo.x, y: geo.y }]
    if (salida.x !== geo.x || salida.y !== geo.y) pts.push({ x: salida.x, y: salida.y })
    if (Math.abs(xc - salida.x) > 0.1) pts.push({ x: xc, y: salida.y })
    pts.push({ x: xc, y: yCarril })
    return pts
  }
  return null
}

export interface RutaCarril {
  d: string
  /** Puntos donde la manguera se empalma a la barra (se dibujan como nudos). */
  empalmes: Punto[]
}

/**
 * Enruta una manguera apoyándose en la barra horizontal de su línea de grupo.
 * Devuelve null si alguno de los dos extremos no puede llegar limpiamente a la
 * barra; en ese caso el llamador se queda con el enrutado normal.
 */
export function enrutarPorCarril(
  piezas: Pieza[],
  pieza1: Pieza,
  ref1: RefPuerto,
  pieza2: Pieza,
  ref2: RefPuerto,
  yCarril: number,
): RutaCarril | null {
  const cajas = cajasDe(piezas, new Set())
  const r1 = ramalHastaCarril(pieza1, ref1.puerto, yCarril, cajas)
  const r2 = ramalHastaCarril(pieza2, ref2.puerto, yCarril, cajas)
  if (!r1 || !r2) return null
  const fin1 = r1[r1.length - 1]
  const fin2 = r2[r2.length - 1]
  // El tramo de barra entre los dos empalmes tiene que estar despejado.
  if (cajas.some((c) => cortaHorizontal(c, yCarril, fin1.x, fin2.x))) return null
  const puntos = [...r1, ...r2.slice().reverse()]
  return { d: aPath(simplificar(puntos)), empalmes: [fin1, fin2] }
}
