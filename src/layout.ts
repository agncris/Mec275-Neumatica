/**
 * Auto-orden del plano.
 *
 * Convierte una lista plana de piezas + mangueras en la disposición de un plano
 * neumático de clase. Los criterios son los de la norma de dibujo, de arriba
 * abajo (la cadena de mando se lee hacia arriba):
 *
 *   1. Un actuador por columna, en el orden de la secuencia (A, B, C…).
 *   2. Debajo de cada actuador, y en su mismo eje, su válvula de potencia.
 *      Lo que va entre ambos (reguladores, escape rápido) se intercala ahí.
 *   3. Los emisores de señal (finales de carrera, pulsadores) en una banda
 *      común, cada uno bajo la válvula a la que manda: así su señal baja o
 *      sube en vertical y no cruza el plano.
 *   4. Un pasillo libre para las líneas de grupo (G1, G2, G3…), que se dibujan
 *      como barras horizontales.
 *   5. Las válvulas de cascada, encadenadas de izquierda a derecha.
 *   6. Otro pasillo para la línea de presión y, al pie, el compresor con su FRL.
 *
 * Entre columnas se deja siempre un canal vertical libre para que las
 * mangueras bajen sin atravesar símbolos.
 *
 * No toca la lógica: sólo asigna coordenadas (x, y). Es pura (no toca el store).
 */
import type { Manguera } from './engine'
import type { Pieza } from './store'
import { DESCRIPTORES } from './components/descriptores'
import { alturaPasillo, planificarCarriles, valvulasDeCascada, type Carril } from './carriles'

/** Separaciones mínimas recomendadas (px, en el espacio del circuito). */
export interface Separaciones {
  /** Canal libre entre dos columnas de actuadores. */
  entreActuadores: number
  /** Entre válvulas de una misma fila. */
  entreValvulas: number
  /** Entre bandas horizontales. */
  entreFilas: number
  /** Margen exterior alrededor del contenido. */
  margen: number
}

export const SEPARACIONES_DEFECTO: Separaciones = {
  entreActuadores: 110,
  entreValvulas: 60,
  entreFilas: 120,
  margen: 70,
}

export const esActuador = (tipo: string): boolean =>
  tipo.startsWith('cilindro') || tipo === 'actuadorGiratorio' || tipo === 'motorNeumatico'

/** Válvulas de potencia: las de corredera (4/2, 5/2). */
export const esValvulaPotencia = (tipo: string): boolean => tipo === 'valvula52' || tipo === 'valvula42'

export const esSensor = (tipo: string): boolean => tipo === 'finalCarrera' || tipo === 'sensorGiro'

export const esManometro = (tipo: string): boolean => tipo === 'manometro'

/** Emisores de señal: lo que produce una señal de mando (rodillos y pulsadores). */
export const esEmisor = (tipo: string): boolean => esSensor(tipo) || tipo === 'valvula32'

/** Cualquier distribuidora: 3/2, 4/2 o 5/2. */
const esDistribuidora = (tipo: string): boolean => esValvulaPotencia(tipo) || tipo === 'valvula32'

/** Piezas que se intercalan entre la válvula de potencia y su actuador. */
export const esAuxiliar = (tipo: string): boolean =>
  tipo === 'reguladorCaudal' || tipo === 'escapeRapido' || tipo === 'valvulaO' || tipo === 'valvulaY' || tipo === 'temporizador'

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
  /** Las líneas de grupo que han quedado dibujables, con su altura. */
  carriles: Carril[]
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

function cajaDe(p: Pieza): ReactSolo {
  return { x: p.x, y: p.y, w: anchoDe(p, 8), h: altoDe(p, 8) }
}

/** Vecinos de una pieza a través de las mangueras. */
function vecinos(id: string, mangueras: Manguera[]): string[] {
  const out: string[] = []
  for (const m of mangueras) {
    if (m.a.componente === id) out.push(m.b.componente)
    if (m.b.componente === id) out.push(m.a.componente)
  }
  return out
}

/**
 * La válvula que manda un actuador. Es de potencia por lo que hace, no por su
 * tipo: en un mando directo, la 3/2 de pulsador que alimenta el cilindro es su
 * válvula de potencia y va debajo de él, no en la banda de señales.
 */
export function valvulaDePotenciaDe(
  actuador: Pieza,
  piezas: Pieza[],
  mangueras: Manguera[],
): Pieza | null {
  const porId = new Map(piezas.map((p) => [p.id, p]))
  // Directa: el actuador cuelga de la válvula.
  for (const idVecino of vecinos(actuador.id, mangueras)) {
    const p = porId.get(idVecino)
    if (p && esDistribuidora(p.tipo)) return p
  }
  // A través de un auxiliar (un regulador de caudal en la línea, por ejemplo).
  for (const idVecino of vecinos(actuador.id, mangueras)) {
    const aux = porId.get(idVecino)
    if (!aux || !esAuxiliar(aux.tipo)) continue
    for (const id2 of vecinos(aux.id, mangueras)) {
      const p = porId.get(id2)
      if (p && esDistribuidora(p.tipo)) return p
    }
  }
  return null
}

/** A dónde manda un emisor: la pieza que recibe la señal de su puerto 2. */
function destinoDeSenal(emisor: Pieza, mangueras: Manguera[]): string | null {
  for (const m of mangueras) {
    if (m.a.componente === emisor.id && m.a.puerto === '2') return m.b.componente
    if (m.b.componente === emisor.id && m.b.puerto === '2') return m.a.componente
  }
  return null
}

/** Cuántas líneas de grupo va a haber (para reservar el pasillo antes de colocar). */
function contarCarrilesPrevistos(piezas: Pieza[], mangueras: Manguera[]): { grupos: number; presion: number } {
  const porId = new Map(piezas.map((p) => [p.id, p]))
  const cuenta = new Map<string, number>()
  for (const m of mangueras) {
    for (const ref of [m.a, m.b]) {
      const k = `${ref.componente}:${ref.puerto}`
      cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
    }
  }
  let grupos = 0
  let presion = 0
  for (const [k, n] of cuenta) {
    if (n < 2) continue
    const pieza = porId.get(k.slice(0, k.lastIndexOf(':')))
    if (!pieza) continue
    if (pieza.tipo === 'fuente') presion++
    else if (!esActuador(pieza.tipo)) grupos++
  }
  return { grupos, presion }
}

/** El emisor que pilota un puerto concreto de una válvula, si lo hay. */
function emisorQuePilota(
  valvula: Pieza,
  puerto: string,
  mangueras: Manguera[],
  porId: Map<string, Pieza>,
): Pieza | null {
  for (const m of mangueras) {
    for (const [x, y] of [
      [m.a, m.b],
      [m.b, m.a],
    ] as const) {
      if (x.componente === valvula.id && x.puerto === puerto) {
        const p = porId.get(y.componente)
        if (p && esEmisor(p.tipo)) return p
      }
    }
  }
  return null
}

/** Emisores encadenados por delante de uno dado (la marcha en serie con un rodillo). */
function cadenaDeEmisores(emisor: Pieza, mangueras: Manguera[], porId: Map<string, Pieza>): Pieza[] {
  const cadena: Pieza[] = []
  let actual = emisor
  for (let i = 0; i < 4; i++) {
    let anterior: Pieza | null = null
    for (const m of mangueras) {
      for (const [x, y] of [
        [m.a, m.b],
        [m.b, m.a],
      ] as const) {
        if (x.componente === actual.id && x.puerto === '1') {
          const p = porId.get(y.componente)
          if (p && esEmisor(p.tipo) && y.puerto === '2') anterior = p
        }
      }
    }
    if (!anterior || cadena.includes(anterior)) break
    cadena.unshift(anterior)
    actual = anterior
  }
  return cadena
}

/** Reparte un grupo de piezas en una fila centrada en `cx`, sin solaparse. */
function filaCentrada(grupo: Pieza[], cx: number, y: number, hueco: number): void {
  const total = grupo.reduce((s, p) => s + anchoDe(p), 0) + hueco * (grupo.length - 1)
  let x = cx - total / 2
  for (const p of grupo) {
    p.x = Math.round(x)
    p.y = y
    x += anchoDe(p) + hueco
  }
}

/**
 * Auto-orden principal. Devuelve la lista de piezas reubicada (mismas ids y
 * mangueras; sólo cambian x e y) y las líneas de grupo que se han podido
 * trazar.
 */
export function autoLayout(
  piezasOriginales: Pieza[],
  mangueras: Manguera[],
  sep: Separaciones = SEPARACIONES_DEFECTO,
): ResultadoLayout {
  const piezas = piezasOriginales.map((p) => ({ ...p, params: { ...p.params } }))
  if (piezas.length === 0) {
    return { piezas, area: calcularAreaConMargen(piezas, sep.margen), ok: true, carriles: [] }
  }
  const porId = new Map(piezas.map((p) => [p.id, p]))
  const ordenOriginal = new Map(piezas.map((p, i) => [p.id, i]))
  const porPlano = (a: Pieza, b: Pieza) =>
    a.x - b.x || (ordenOriginal.get(a.id) ?? 0) - (ordenOriginal.get(b.id) ?? 0)

  const actuadores = piezas.filter((p) => esActuador(p.tipo)).sort(porPlano)
  const cascadas = valvulasDeCascada(piezas, mangueras).sort(porPlano)
  const idsCascada = new Set(cascadas.map((p) => p.id))
  // Es «de potencia» la válvula que manda un actuador, sea 3/2, 4/2 o 5/2.
  const idsPotencia = new Set(
    actuadores
      .map((act) => valvulaDePotenciaDe(act, piezas, mangueras))
      .filter((v): v is Pieza => !!v && !idsCascada.has(v.id))
      .map((v) => v.id),
  )
  const potencia = piezas.filter((p) => idsPotencia.has(p.id)).sort(porPlano)
  const emisores = piezas.filter((p) => esEmisor(p.tipo) && !idsPotencia.has(p.id)).sort(porPlano)
  const auxiliares = piezas.filter((p) => esAuxiliar(p.tipo)).sort(porPlano)
  const manometros = piezas.filter((p) => esManometro(p.tipo)).sort(porPlano)
  const fuentes = piezas.filter((p) => p.tipo === 'fuente').sort(porPlano)
  const sinSitio = piezas.filter(
    (p) =>
      !esActuador(p.tipo) &&
      !esValvulaPotencia(p.tipo) &&
      !esEmisor(p.tipo) &&
      !esAuxiliar(p.tipo) &&
      !esManometro(p.tipo) &&
      p.tipo !== 'fuente',
  )

  // --- Columnas: una por actuador -------------------------------------------
  const potenciaDe = new Map<string, Pieza>()
  const columnaDe = new Map<string, number>() // id de actuador → centro X
  const anchoColumna = actuadores.map((act) => {
    const v = valvulaDePotenciaDe(act, piezas, mangueras)
    if (v && !potenciaDe.has(act.id) && ![...potenciaDe.values()].some((x) => x.id === v.id)) {
      potenciaDe.set(act.id, v)
    }
    const propia = potenciaDe.get(act.id)
    return Math.max(anchoDe(act), propia ? anchoDe(propia) : 0)
  })

  let cursor = sep.margen
  actuadores.forEach((act, i) => {
    const cx = cursor + anchoColumna[i] / 2
    columnaDe.set(act.id, cx)
    cursor += anchoColumna[i] + sep.entreActuadores
  })
  const anchoTotal = Math.max(cursor - sep.entreActuadores - sep.margen, 400)
  // El eje del plano es el de las columnas reales, no el del ancho mínimo: así
  // el compresor y la cascada quedan centrados bajo el circuito, no a un lado.
  const centrosColumna = [...columnaDe.values()]
  const centroPlano = centrosColumna.length
    ? (Math.min(...centrosColumna) + Math.max(...centrosColumna)) / 2
    : sep.margen + anchoTotal / 2

  // --- Banda 0 · actuadores --------------------------------------------------
  const yActuadores = sep.margen
  const altoActuadores = Math.max(...actuadores.map((a) => altoDe(a)), 0)
  for (const act of actuadores) {
    act.y = yActuadores
    act.x = Math.round((columnaDe.get(act.id) ?? centroPlano) - anchoDe(act) / 2)
  }

  // --- Banda 1 · auxiliares en línea (reguladores, escape rápido…) -----------
  // Sólo van entre el actuador y su válvula los auxiliares de la línea de
  // potencia (un regulador de caudal, un escape rápido): los que tocan al
  // actuador. Las válvulas lógicas «O» e «Y» pertenecen a la línea de señal y
  // se colocan más abajo, entre la válvula de potencia y los emisores.
  const auxDeColumna = new Map<string, Pieza[]>()
  const auxSenal: Pieza[] = []
  for (const aux of auxiliares) {
    const cercanos = vecinos(aux.id, mangueras)
      .map((id) => porId.get(id))
      .filter((p): p is Pieza => !!p)
    const act = cercanos.find((p) => esActuador(p.tipo))
    if (act) {
      const lista = auxDeColumna.get(act.id) ?? []
      lista.push(aux)
      auxDeColumna.set(act.id, lista)
    } else auxSenal.push(aux)
  }
  const hayAux = auxDeColumna.size > 0
  const yAuxiliares = yActuadores + altoActuadores + (hayAux ? sep.entreFilas * 0.6 : 0)
  const altoAuxiliares = hayAux ? Math.max(...auxiliares.map((a) => altoDe(a)), 0) : 0
  for (const [idAct, lista] of auxDeColumna) {
    filaCentrada(lista, columnaDe.get(idAct) ?? centroPlano, yAuxiliares, sep.entreValvulas)
  }

  // --- Banda 2 · válvulas de potencia ---------------------------------------
  const yPotencia = yAuxiliares + altoAuxiliares + sep.entreFilas * (hayAux ? 0.7 : 1)
  for (const act of actuadores) {
    const v = potenciaDe.get(act.id)
    if (!v) continue
    v.y = yPotencia
    v.x = Math.round((columnaDe.get(act.id) ?? centroPlano) - anchoDe(v) / 2)
  }
  // Válvulas de corredera sin actuador identificado: al centro de la banda.
  const huerfanas = piezas.filter(
    (p) => esValvulaPotencia(p.tipo) && !idsCascada.has(p.id) && ![...potenciaDe.values()].some((x) => x.id === p.id),
  )
  filaCentrada(huerfanas, centroPlano, yPotencia, sep.entreValvulas)
  const altoPotencia = Math.max(...potencia.map((v) => altoDe(v)), 0)

  // --- Banda 3 · emisores de señal de las válvulas de potencia --------------
  // Cada rodillo va bajo la válvula a la que manda: su señal sube en vertical
  // y no cruza el plano. Los que pilotan la cascada no van aquí, sino abajo,
  // junto a ella (igual que en los planos de clase).
  const destinoDe = new Map<string, Pieza | null>()
  for (const e of emisores) {
    const id = destinoDeSenal(e, mangueras)
    destinoDe.set(e.id, id ? porId.get(id) ?? null : null)
  }
  const mandaACascada = (e: Pieza, profundidad = 0): boolean => {
    if (profundidad > 4) return false
    const d = destinoDe.get(e.id)
    if (!d) return false
    if (idsCascada.has(d.id)) return true
    return esEmisor(d.tipo) ? mandaACascada(d, profundidad + 1) : false
  }
  const emisoresCascada = emisores.filter((e) => mandaACascada(e))
  const idsEmisorCascada = new Set(emisoresCascada.map((e) => e.id))
  const emisoresPotencia = emisores.filter((e) => !idsEmisorCascada.has(e.id))

  // Banda de lógica de señal («O», «Y», temporizadores): bajo la válvula que
  // pilotan y por encima de los emisores que las alimentan.
  const yLogica = yPotencia + altoPotencia + (auxSenal.length ? sep.entreFilas * 0.7 : 0)
  const altoLogica = auxSenal.length ? Math.max(...auxSenal.map((a) => altoDe(a))) : 0
  for (const aux of auxSenal) {
    const destinos = vecinos(aux.id, mangueras)
      .map((id) => porId.get(id))
      .filter((p): p is Pieza => !!p && esDistribuidora(p.tipo))
    const cx = destinos.length ? destinos[0].x + anchoDe(destinos[0]) / 2 : centroPlano
    aux.x = Math.round(cx - anchoDe(aux) / 2)
    aux.y = yLogica
  }
  if (auxSenal.length > 1) separarEnFila([...auxSenal].sort((a, b) => a.x - b.x), sep.margen, sep.entreValvulas)

  const yEmisores = yLogica + altoLogica + sep.entreFilas * (auxSenal.length ? 0.7 : 1)
  const xObjetivo = new Map<string, number>()
  const centroDe = (p: Pieza) => p.x + anchoDe(p) / 2
  for (const e of emisoresPotencia) {
    const d = destinoDe.get(e.id)
    if (d && (esDistribuidora(d.tipo) || esAuxiliar(d.tipo))) {
      xObjetivo.set(e.id, centroDe(d))
      continue
    }
    const idCil = typeof e.params.cilindro === 'string' ? e.params.cilindro : ''
    const act = porId.get(idCil)
    xObjetivo.set(e.id, act ? centroDe(act) : centroPlano)
  }
  const anchoUtil = anchoTotal + sep.entreActuadores
  colocarBandaEmisores(emisoresPotencia, xObjetivo, yEmisores, sep.margen, anchoUtil, sep)

  // --- Pasillo de las líneas de grupo ---------------------------------------
  // El pasillo sólo se reserva si de verdad va a haber barras; si no, las
  // bandas se juntan y el plano no queda con huecos muertos.
  const previstos = contarCarrilesPrevistos(piezas, mangueras)
  const fondoEmisores = emisoresPotencia.length
    ? Math.max(...emisoresPotencia.map((e) => e.y + altoDe(e)))
    : yPotencia + altoPotencia
  const yCascada =
    fondoEmisores +
    (previstos.grupos > 0 ? alturaPasillo(previstos.grupos) + sep.entreFilas * 0.3 : sep.entreFilas)

  // --- Banda 4 · cascada: cada válvula con sus emisores a los lados ---------
  // El emisor que pilota el 14 va a su izquierda y el que pilota el 12 a su
  // derecha, que es por donde entran esas señales en el símbolo. Un emisor
  // alimentado por otro (la marcha en serie con un rodillo) va pegado a él.
  const yaEnFila = new Set<string>()
  const fila: Pieza[] = []
  const anadir = (p: Pieza | null) => {
    if (!p || yaEnFila.has(p.id)) return
    yaEnFila.add(p.id)
    fila.push(p)
  }
  for (const k of cascadas) {
    const izquierda = emisorQuePilota(k, '14', mangueras, porId)
    if (izquierda) {
      for (const previo of cadenaDeEmisores(izquierda, mangueras, porId)) anadir(previo)
      anadir(izquierda)
    }
    anadir(k)
    const derecha = emisorQuePilota(k, '12', mangueras, porId)
    if (derecha) {
      for (const previo of cadenaDeEmisores(derecha, mangueras, porId)) anadir(previo)
      anadir(derecha)
    }
  }
  for (const e of emisoresCascada) anadir(e)
  filaCentrada(fila, centroPlano, yCascada, sep.entreValvulas + 20)
  const altoCascada = Math.max(...fila.map((c) => altoDe(c)), 0)
  const fondoCascada = fila.length ? yCascada + altoCascada : fondoEmisores

  // --- Banda 5 · fuente, manómetros y lo que no encaja ----------------------
  const yFuente =
    fondoCascada +
    (previstos.presion > 0 ? alturaPasillo(previstos.presion) + sep.entreFilas * 0.3 : sep.entreFilas)
  filaCentrada([...fuentes, ...manometros, ...sinSitio], centroPlano, yFuente, sep.entreValvulas)

  // --- Red de seguridad contra colisiones -----------------------------------
  const ok = resolverColisiones(piezas)

  // --- Carriles y área -------------------------------------------------------
  const { carriles } = planificarCarriles(piezas, mangueras)
  const area = calcularAreaConMargen(piezas, sep.margen)
  return { piezas, area, ok, carriles }
}

/**
 * Coloca los emisores en su banda. Cada uno quiere estar bajo la válvula a la
 * que manda; cuando no caben todos en una fila sin pisarse, se abren sub-filas
 * y en cada una se separan respetando el orden (así no se cruzan entre ellas).
 */
function colocarBandaEmisores(
  emisores: Pieza[],
  xObjetivo: Map<string, number>,
  yBanda: number,
  xMinimo: number,
  anchoUtil: number,
  sep: Separaciones,
): void {
  if (emisores.length === 0) return
  const hueco = sep.entreValvulas * 0.7
  const orden = [...emisores].sort(
    (a, b) => (xObjetivo.get(a.id) ?? 0) - (xObjetivo.get(b.id) ?? 0) || a.id.localeCompare(b.id),
  )
  // ¿Cuántas sub-filas hacen falta para que quepan sin apretujarse?
  const anchoNecesario = orden.reduce((s, p) => s + anchoDe(p) + hueco, 0) - hueco
  const filas = Math.max(1, Math.min(3, Math.ceil(anchoNecesario / Math.max(anchoUtil, 1))))
  const altoFila = Math.max(...emisores.map((e) => altoDe(e)), 0) + sep.entreFilas * 0.55

  // Reparto por sub-filas manteniendo el orden horizontal dentro de cada una.
  const grupos: Pieza[][] = Array.from({ length: filas }, () => [])
  orden.forEach((e, i) => grupos[i % filas].push(e))
  grupos.forEach((grupo, f) => {
    for (const e of grupo) {
      e.y = yBanda + f * altoFila
      e.x = Math.round((xObjetivo.get(e.id) ?? 0) - anchoDe(e) / 2)
    }
    separarEnFila(grupo, xMinimo, hueco)
  })
}

/**
 * Separa en horizontal las piezas de una fila que se pisan, conservando su
 * orden: primero empuja hacia la derecha y luego recentra el conjunto para que
 * no se desplace todo hacia un lado.
 */
function separarEnFila(fila: Pieza[], xMinimo: number, hueco: number): void {
  if (fila.length < 2) return
  const centroAntes = fila.reduce((s, p) => s + p.x + anchoDe(p) / 2, 0) / fila.length
  let x = Math.min(...fila.map((p) => p.x))
  for (const p of fila) {
    p.x = Math.max(p.x, x)
    x = p.x + anchoDe(p) + hueco
  }
  const centroDespues = fila.reduce((s, p) => s + p.x + anchoDe(p) / 2, 0) / fila.length
  const ajuste = centroAntes - centroDespues
  for (const p of fila) p.x = Math.round(Math.max(xMinimo, p.x + ajuste))
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

/**
 * Empuja piezas superpuestas. Sólo mueve en horizontal para no romper las
 * bandas (que son lo que da sentido al plano); repite hasta que no queda
 * ningún solape o hasta agotar las pasadas.
 */
function resolverColisiones(piezas: Pieza[]): boolean {
  for (let pasada = 0; pasada < 12; pasada++) {
    let limpio = true
    for (let i = 0; i < piezas.length; i++) {
      for (let j = i + 1; j < piezas.length; j++) {
        const a = cajaDe(piezas[i])
        const b = cajaDe(piezas[j])
        if (!seSuperponen(a, b, 10)) continue
        limpio = false
        const solapeX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + 20
        const izquierda = a.x + a.w / 2 <= b.x + b.w / 2
        const mover = solapeX / 2
        piezas[i].x += izquierda ? -mover : mover
        piezas[j].x += izquierda ? mover : -mover
      }
    }
    if (limpio) {
      for (const p of piezas) p.x = Math.round(p.x)
      return true
    }
  }
  for (const p of piezas) p.x = Math.round(p.x)
  return false
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
