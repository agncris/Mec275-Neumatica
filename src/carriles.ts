/**
 * Líneas de grupo («carriles»).
 *
 * En un plano de clase, la salida de una válvula de cascada no se dibuja como
 * un abanico de mangueras sueltas: se dibuja como una **barra horizontal** que
 * cruza el plano —la línea del grupo— de la que cuelgan, en vertical, todos los
 * elementos que alimenta. Lo mismo vale para la salida del FRL, que es la línea
 * de presión.
 *
 * Este módulo detecta esas barras a partir del circuito (sin que el alumno
 * tenga que declarar nada) y decide a qué altura va cada una. Es puro: se
 * calcula igual desde el auto-orden y desde la pizarra, así que ambos ven
 * exactamente las mismas barras.
 */
import type { Manguera } from './engine'
import type { Pieza } from './store'
import { DESCRIPTORES } from './components/descriptores'

/** Una barra horizontal compartida por varias mangueras. */
export interface Carril {
  /** Nodo que la alimenta, en forma "componente:puerto". */
  nodo: string
  componente: string
  puerto: string
  /** Rótulo que se dibuja al principio de la barra: G1, G2… o P (presión). */
  etiqueta: string
  /** Altura de la barra, en coordenadas del circuito. */
  y: number
  /** Ids de las mangueras que cuelgan de ella. */
  mangueras: string[]
}

export interface PlanCarriles {
  carriles: Carril[]
  /** id de manguera → carril al que pertenece. */
  porManguera: Map<string, Carril>
}

/** Mínimo de mangueras colgando de un puerto para que merezca una barra. */
const MINIMO_RAMALES = 2
/** Separación vertical entre dos barras apiladas en el mismo pasillo. */
export const PASO_CARRIL = 48
/** Altura del pasillo que hay que reservar para n barras. */
export const alturaPasillo = (n: number): number => (n + 1) * PASO_CARRIL

const clave = (componente: string, puerto: string) => `${componente}:${puerto}`

const esValvulaCorredera = (tipo: string) => tipo === 'valvula52' || tipo === 'valvula42'

const caja = (p: Pieza) => {
  const d = DESCRIPTORES[p.tipo]
  return { x: p.x, y: p.y, w: d?.ancho ?? 100, h: d?.alto ?? 80 }
}

/** ¿Esta válvula de corredera manda un actuador (puertos A/B)? */
function mandaUnActuador(v: Pieza, piezas: Pieza[], mangueras: Manguera[]): boolean {
  const actuadores = new Set(
    piezas
      .filter((p) => p.tipo.startsWith('cilindro') || p.tipo === 'actuadorGiratorio' || p.tipo === 'motorNeumatico')
      .map((p) => p.id),
  )
  return mangueras.some(
    (m) =>
      (m.a.componente === v.id && actuadores.has(m.b.componente)) ||
      (m.b.componente === v.id && actuadores.has(m.a.componente)),
  )
}

/**
 * Válvulas de cascada: válvulas de corredera que no mandan ningún actuador.
 * Son las que reparten el aire entre las líneas de grupo.
 */
export function valvulasDeCascada(piezas: Pieza[], mangueras: Manguera[]): Pieza[] {
  return piezas.filter((p) => esValvulaCorredera(p.tipo) && !mandaUnActuador(p, piezas, mangueras))
}

/**
 * Ordena la cadena de cascada: la válvula raíz (la que cuelga de la fuente)
 * primero y, detrás, la que alimenta por su salida, y así sucesivamente.
 */
function cadenaDeCascada(cascadas: Pieza[], mangueras: Manguera[]): Pieza[] {
  if (cascadas.length <= 1) return cascadas
  const ids = new Set(cascadas.map((p) => p.id))
  /** hija → madre, cuando el puerto 1 de la hija cuelga de una salida de la madre. */
  const madreDe = new Map<string, string>()
  for (const m of mangueras) {
    for (const [x, y] of [
      [m.a, m.b],
      [m.b, m.a],
    ] as const) {
      if (x.puerto === '1' && ids.has(x.componente) && ids.has(y.componente) && (y.puerto === '2' || y.puerto === '4')) {
        madreDe.set(x.componente, y.componente)
      }
    }
  }
  const raices = cascadas.filter((p) => !madreDe.has(p.id))
  const orden: Pieza[] = []
  const visto = new Set<string>()
  const hijasDe = (id: string) => cascadas.filter((p) => madreDe.get(p.id) === id)
  const recorrer = (p: Pieza) => {
    if (visto.has(p.id)) return
    visto.add(p.id)
    orden.push(p)
    for (const h of hijasDe(p.id)) recorrer(h)
  }
  for (const r of raices) recorrer(r)
  for (const p of cascadas) if (!visto.has(p.id)) orden.push(p)
  return orden
}

/**
 * Numera las líneas de grupo de una cadena de cascada al estilo del método:
 * la última válvula de la cadena da G1 (salida 4) y G2 (salida 2), y al
 * remontar la cadena cada válvula aporta su salida libre como grupo siguiente.
 */
function etiquetasDeGrupo(cadena: Pieza[], nodosBarra: Set<string>): Map<string, string> {
  const etiquetas = new Map<string, string>()
  if (cadena.length === 0) return etiquetas
  const orden: string[] = []
  const ultima = cadena[cadena.length - 1]
  // La última de la cadena no alimenta a ninguna otra: sus dos salidas son grupos.
  for (const puerto of ['4', '2']) {
    const k = clave(ultima.id, puerto)
    if (nodosBarra.has(k)) orden.push(k)
  }
  // Remontando, cada válvula aporta la salida que no continúa la cadena.
  for (let i = cadena.length - 2; i >= 0; i--) {
    for (const puerto of ['2', '4']) {
      const k = clave(cadena[i].id, puerto)
      if (nodosBarra.has(k) && !orden.includes(k)) orden.push(k)
    }
  }
  orden.forEach((k, i) => etiquetas.set(k, `G${i + 1}`))
  return etiquetas
}

/**
 * Calcula las barras de un circuito ya colocado: cuáles son, cómo se rotulan y
 * a qué altura van. La altura sale de la geometría: cada barra se tumba en el
 * pasillo libre que hay justo encima de la pieza que la alimenta, que es donde
 * el auto-orden deja sitio para ella.
 */
export function planificarCarriles(piezas: Pieza[], mangueras: Manguera[]): PlanCarriles {
  const porId = new Map(piezas.map((p) => [p.id, p]))
  const ramales = new Map<string, string[]>()
  for (const m of mangueras) {
    for (const ref of [m.a, m.b]) {
      const k = clave(ref.componente, ref.puerto)
      const lista = ramales.get(k)
      if (lista) lista.push(m.id)
      else ramales.set(k, [m.id])
    }
  }

  // Candidatos: las salidas de las que cuelga media instalación, que son las
  // que en el plano se dibujan como barra: las de las válvulas de cascada
  // (líneas de grupo) y la del compresor (línea de presión). Una señal que se
  // bifurca en dos pilotajes no es una línea de reparto: se enruta normal.
  const cascadas = valvulasDeCascada(piezas, mangueras)
  const idsCascada = new Set(cascadas.map((p) => p.id))
  const candidatos: Array<{ nodo: string; pieza: Pieza; puerto: string; mangueras: string[] }> = []
  for (const [nodo, ids] of ramales) {
    if (ids.length < MINIMO_RAMALES) continue
    const [idPieza, puerto] = [nodo.slice(0, nodo.lastIndexOf(':')), nodo.slice(nodo.lastIndexOf(':') + 1)]
    const pieza = porId.get(idPieza)
    if (!pieza) continue
    if (pieza.tipo !== 'fuente' && !idsCascada.has(pieza.id)) continue
    candidatos.push({ nodo, pieza, puerto, mangueras: ids })
  }
  if (candidatos.length === 0) return { carriles: [], porManguera: new Map() }

  // Rótulos: G1, G2… siguiendo la cadena de cascada; P para la línea de presión.
  const cadena = cadenaDeCascada(cascadas, mangueras)
  const etiquetas = etiquetasDeGrupo(cadena, new Set(candidatos.map((c) => c.nodo)))
  let sueltos = 0
  for (const c of candidatos) {
    if (etiquetas.has(c.nodo)) continue
    etiquetas.set(c.nodo, c.pieza.tipo === 'fuente' ? 'P' : `L${++sueltos}`)
  }

  // Orden de arriba abajo: primero los grupos (G1 arriba), la presión al fondo.
  const rango = (nodo: string) => {
    const e = etiquetas.get(nodo) ?? ''
    if (e === 'P') return 1000
    const n = parseInt(e.slice(1), 10)
    return Number.isFinite(n) ? n : 500
  }
  candidatos.sort((a, b) => rango(a.nodo) - rango(b.nodo))

  // Altura: cada barra va en el pasillo libre que hay encima de su pieza. Las
  // que comparten pasillo se reparten el hueco, en orden.
  const porPasillo = new Map<string, typeof candidatos>()
  for (const c of candidatos) {
    const k = String(Math.round(caja(c.pieza).y / 24))
    const lista = porPasillo.get(k)
    if (lista) lista.push(c)
    else porPasillo.set(k, [c])
  }

  const carriles: Carril[] = []
  for (const grupo of porPasillo.values()) {
    const techoPieza = caja(grupo[0].pieza).y
    const fuentes = new Set(grupo.map((c) => c.pieza.id))
    // Pieza más baja que queda por encima del pasillo.
    let techo = -Infinity
    for (const p of piezas) {
      if (fuentes.has(p.id)) continue
      const c = caja(p)
      if (c.y + c.h <= techoPieza + 1) techo = Math.max(techo, c.y + c.h)
    }
    if (!Number.isFinite(techo)) techo = techoPieza - alturaPasillo(grupo.length)
    const hueco = techoPieza - techo
    const paso = hueco / (grupo.length + 1)
    grupo.forEach((c, i) => {
      carriles.push({
        nodo: c.nodo,
        componente: c.pieza.id,
        puerto: c.puerto,
        etiqueta: etiquetas.get(c.nodo) ?? '',
        y: Math.round(techo + paso * (i + 1)),
        mangueras: c.mangueras,
      })
    })
  }

  const porManguera = new Map<string, Carril>()
  for (const c of carriles) for (const id of c.mangueras) porManguera.set(id, c)
  return { carriles, porManguera }
}
