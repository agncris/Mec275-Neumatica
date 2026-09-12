/**
 * Auto-layout de circuitos neumáticos.
 *
 * Convierte una lista plana de piezas + mangueras (en el orden en que se
 * crearon) en una disposición ordenada y espaciosa, siguiendo la jerarquía de
 * un plano técnico:
 *
 *   · actuadores arriba, cada uno en su propia columna, bien separados;
 *   · su válvula de potencia inmediatamente debajo (mismo eje X);
 *   · sensores y válvulas 3/2 de mando en la zona media, junto a su actuador;
 *   · manómetros debajo de su línea (fuera de las tuberías);
 *   · válvulas de cascada, START y fuente en la zona inferior.
 *
 * No mueve la lógica: sólo asigna coordenadas (x, y) con separaciones mínimas
 * y resuelve colisiones rectángulo–rectángulo. Es pura (no toca el store).
 */
import type { Manguera } from './engine'
import type { Pieza } from './store'
import { DESCRIPTORES } from './components/descriptores'

/** Separaciones mínimas recomendadas (px, en el espacio del circuito). */
export interface Separaciones {
  /** Entre actuadores (centros de columnas). */
  entreActuadores: number
  /** Entre válvulas de una misma fila. */
  entreValvulas: number
  /** Entre filas paralelas. */
  entreFilas: number
  /** Margen exterior alrededor del contenido. */
  margen: number
}

export const SEPARACIONES_DEFECTO: Separaciones = {
  entreActuadores: 240,
  entreValvulas: 80,
  entreFilas: 120,
  margen: 60,
}

export const esActuador = (tipo: string): boolean =>
  tipo.startsWith('cilindro') || tipo === 'actuadorGiratorio' || tipo === 'motorNeumatico'

/** Válvulas de potencia: las de corredera (4/2, 5/2). */
export const esValvulaPotencia = (tipo: string): boolean => tipo === 'valvula52' || tipo === 'valvula42'

export const esSensor = (tipo: string): boolean => tipo === 'finalCarrera' || tipo === 'sensorGiro'

export const esManometro = (tipo: string): boolean => tipo === 'manometro'

/** Válvula de potencia directamente unida a un actuador (por puertos A/B). */
export function valvulaDePotenciaDe(
  actuador: Pieza,
  piezas: Pieza[],
  mangueras: Manguera[],
): Pieza | null {
  const puertosActuador = new Set(['A', 'B'])
  const conManguera = new Set<string>()
  for (const m of mangueras) {
    // El actuador puede estar en cualquiera de los dos extremos; lo importante
    // es que el puerto del actuador sea A o B.
    if (m.a.componente === actuador.id && puertosActuador.has(m.a.puerto))
      conManguera.add(m.b.componente)
    if (m.b.componente === actuador.id && puertosActuador.has(m.b.puerto))
      conManguera.add(m.a.componente)
  }
  for (const id of conManguera) {
    const p = piezas.find((x) => x.id === id)
    if (p && esValvulaPotencia(p.tipo)) return p
  }
  return null
}

/** Anchura de una pieza según su descriptor (con un pequeño colchón). */
export function anchoDe(p: Pieza, colchon = 0): number {
  return (DESCRIPTORES[p.tipo]?.ancho ?? 100) + colchon
}
export function altoDe(p: Pieza, colchon = 0): number {
  return (DESCRIPTORES[p.tipo]?.alto ?? 80) + colchon
}

export interface ResultadoLayout {
  piezas: Pieza[]
  /** Bounding box del contenido + margen. */
  area: { x: number; y: number; ancho: number; alto: number }
  /** Nada llegó a traslaparse (aun así puede que el usuario lo mueva después). */
  ok: boolean
}

interface ReactSolo {
  x: number
  y: number
  w: number
  h: number
}

/** ¿Se superponen dos cajas? 0 de holgura = se tocan sin invadir. */
function seSuperponen(a: ReactSolo, b: ReactSolo, holgura = 0): boolean {
  return (
    a.x - holgura < b.x + b.w &&
    a.x + a.w + holgura > b.x &&
    a.y - holgura < b.y + b.h &&
    a.y + a.h + holgura > b.y
  )
}

/**
 * Auto-layout principal. Devuelve la lista de piezas reubicada (mismas ids y
 * mangueras; sólo cambian x e y) en una disposición de plano neumático.
 */
export function autoLayout(piezasOriginales: Pieza[], mangueras: Manguera[], sep: Separaciones = SEPARACIONES_DEFECTO): ResultadoLayout {
  const piezas = piezasOriginales.map((p) => ({ ...p, params: { ...p.params } }))
  const actuadores = piezas.filter((p) => esActuador(p.tipo)).sort((a, b) => a.x - b.x)
  const potencia = piezas
    .filter((p) => esValvulaPotencia(p.tipo))
    .sort((a, b) => a.x - b.x)
  const sensores = piezas.filter((p) => esSensor(p.tipo)).sort((a, b) => a.x - b.x)
  const manometros = piezas.filter((p) => esManometro(p.tipo)).sort((a, b) => a.x - b.x)
  const mando = piezas
    .filter((p) => !esActuador(p.tipo) && !esValvulaPotencia(p.tipo) && !esSensor(p.tipo) && !esManometro(p.tipo))
    .sort((a, b) => a.x - b.x)

  // Columna X de cada actuador (y de su válvula de potencia).
  const columnaDe = new Map<string, number>()
  const xInicio = sep.margen
  let cursor = xInicio
  actuadores.forEach((act) => {
    columnaDe.set(act.id, cursor)
    act.x = cursor
    cursor += anchoDe(act, 8) + sep.entreActuadores
  })

  // --- Fila 0 · actuadores ---------------------------------------------------
  const yAct = sep.margen
  const altoAct = Math.max(...piezas.map((p) => (esActuador(p.tipo) ? altoDe(p, 8) : 0)), 1)
  for (const act of actuadores) act.y = yAct

  // --- Fila 1 · válvulas de potencia ----------------------------------------
  const yPot = yAct + altoAct + sep.entreFilas
  const potenciaYaColocada = new Set<string>()
  for (const act of actuadores) {
    const v = valvulaDePotenciaDe(act, piezas, mangueras)
    if (v) {
      const cx = columnaDe.get(act.id) ?? 0
      // Centrar la válvula bajo el actuador
      v.x = cx + (anchoDe(act, 8) - anchoDe(v, 8)) / 2
      v.y = yPot
      potenciaYaColocada.add(v.id)
    }
  }
  // Válvulas de corredera que NO son potencia de un actuador (p. ej. las de
  // cascada K1/K2) van a la fila inferior, no a la de potencia.
  const sueltas = potencia.filter((v) => !potenciaYaColocada.has(v.id))
  for (const v of sueltas) if (!mando.includes(v)) mando.push(v)

  // --- Fila 2 · sensores y válvulas 3/2 de mando -----------------------------
  const altoPot = Math.max(...piezas.map((p) => (esValvulaPotencia(p.tipo) ? altoDe(p, 8) : 0)), 1)
  const ySens = yPot + altoPot + sep.entreFilas
  const grupoMando = [...sensores, ...mando.filter((p) => p.tipo === 'valvula32')]
  // Cada sensor se coloca cerca de la columna de su actuador, con un pequeño
  // desfase según cuántos sensores ya hemos puesto en esa columna (para no
  // apilarlos). Los que no tienen actuador van a la siguiente X libre.
  const usadosPorCol = new Map<number, number>()
  const colSens = grupoMando.map((s) => {
    const cil = typeof s.params.cilindro === 'string' ? s.params.cilindro : ''
    const act = actuadores.find((a) => a.id === cil)
    return { s, act }
  })
  // Ordenar: primero los asociados a un actuador (por columna), luego el resto.
  colSens.sort((a, b) => {
    const ca = a.act ? columnaDe.get(a.act.id) ?? 0 : Infinity
    const cb = b.act ? columnaDe.get(b.act.id) ?? 0 : Infinity
    return ca - cb
  })
  let filaSens = ySens
  let filaActiva = ySens
  colSens.forEach(({ s, act }, idx) => {
    const cxBase = act ? columnaDe.get(act.id) ?? xInicio : xInicio
    const ya = usadosPorCol.get(cxBase) ?? 0
    usadosPorCol.set(cxBase, ya + 1)
    // Desfase horizontal según el número de sensor en esa columna.
    s.x = cxBase + ya * (anchoDe(s, 8) + sep.entreValvulas)
    // Escalonar en vertical los segundos/terceros de una misma columna.
    s.y = idx % 2 === 1 ? filaActiva + sep.entreFilas * 0.55 : filaActiva
    filaActiva = idx % 2 === 1 ? filaActiva + sep.entreFilas * 0.55 : filaActiva
  })
  filaSens = filaActiva

  // --- Fila 3 · manómetros ---------------------------------------------------
  const yMano = filaSens + sep.entreFilas + 40
  manometros.forEach((m, i) => {
    m.x = xInicio + i * sep.entreActuadores
    m.y = yMano + (i % 2) * (sep.entreFilas * 0.5)
  })

  // --- Fila 4 · mando restante (cascada, START, fuente) ----------------------
  const altoMano = Math.max(...manometros.map((m) => altoDe(m, 8)), 1)
  const yRest = yMano + altoMano + sep.entreFilas
  // Colocar con evitación de colisiones y separación real según el ancho.
  let cxRest = xInicio
  for (const p of mando) {
    const libre = proximaPosicionLibre(p, piezas, cxRest, yRest, sep)
    p.x = libre.x
    p.y = yRest
    cxRest = libre.x + anchoDe(p, 8) + sep.entreValvulas
  }

  // --- 6 · red de seguridad contra colisiones --------------------------------
  const ok = resolverColisiones(piezas)

  // --- 7 · área total --------------------------------------------------------
  const area = calcularAreaConMargen(piezas, sep.margen)
  return { piezas, area, ok }
}

/** Busca la siguiente posición X libre (no solapada con las ya colocadas). */
export function proximaPosicionLibre(
  pieza: Pieza,
  piezasYaColocadas: Pieza[],
  desdeX: number,
  y: number,
  sep: Separaciones,
): { x: number; y: number } {
  const w = anchoDe(pieza, 8)
  const h = altoDe(pieza, 8)
  let x = desdeX
  const yaOcupa = (xx: number) =>
    piezasYaColocadas.some((o) => o.id !== pieza.id && seSuperponen({ x: xx, y, w, h }, cajaDe(o), sep.entreValvulas))
  while (yaOcupa(x)) x += sep.entreValvulas
  return { x, y }
}

function cajaDe(p: Pieza): ReactSolo {
  return { x: p.x, y: p.y, w: anchoDe(p, 8), h: altoDe(p, 8) }
}

/** Empuja piezas superpuestas según la dirección de menor desplazamiento. */
function resolverColisiones(piezas: Pieza[]): boolean {
  const cajas = piezas.map((p) => ({ p, ...cajaDe(p) }))
  let limpiado = true
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i]
      const b = cajas[j]
      if (!seSuperponen(a, b, 4)) continue
      limpiado = false
      const dx = (a.x + a.w / 2) - (b.x + b.w / 2)
      const dy = (a.y + a.h / 2) - (b.y + b.h / 2)
      const solapeX = Math.abs(dx) - (a.w + b.w) / 2
      const solapeY = Math.abs(dy) - (a.h + b.h) / 2
      if (Math.abs(dy) < Math.abs(dx) || (Math.abs(solapeX) <= Math.abs(solapeY) && Math.abs(dx) >= Math.abs(dy))) {
        // Empujar en X (menor solape horizontal)
        b.p.x += (dx >= 0 ? 1 : -1) * (Math.abs(solapeX) + 10)
      } else {
        b.p.y += (dy >= 0 ? 1 : -1) * (Math.abs(solapeY) + 10)
      }
    }
  }
  return limpiado
}

/** Bounding box del contenido + margen. */
export function calcularAreaConMargen(
  piezas: Pieza[],
  margen: number,
): { x: number; y: number; ancho: number; alto: number } {
  if (piezas.length === 0) return { x: 0, y: 0, ancho: 0, alto: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of piezas) {
    const w = anchoDe(p, 8)
    const h = altoDe(p, 8)
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x + w)
    maxY = Math.max(maxY, p.y + h)
  }
  return {
    x: minX - margen,
    y: minY - margen,
    ancho: Math.max(1, maxX - minX + margen * 2),
    alto: Math.max(1, maxY - minY + margen * 2),
  }
}
