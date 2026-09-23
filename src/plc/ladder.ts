/**
 * Motor del PLC: el programa Ladder y su ciclo de scan.
 *
 * Un programa es una lista de escalones (rungs). Cada escalón es una rejilla:
 * filas (la principal y sus ramas en paralelo) × columnas de contactos, más
 * una columna final de bobinas. Las ramas se unen con enlaces verticales en
 * los nodos que hay entre columnas, como en el papel.
 *
 * El ciclo de scan es el de un PLC de verdad:
 *   1. lee las entradas (I) y las copia en la imagen de memoria;
 *   2. resuelve los escalones de arriba abajo; lo que escribe un escalón ya lo
 *      ve el siguiente dentro del mismo barrido;
 *   3. las salidas (Q) quedan como las dejó el último escalón que las escribe.
 *
 * No depende del navegador: se prueba con vitest y lo usan el editor y la
 * planta 3D por igual.
 */

/** Columnas de contactos de cada escalón (la de bobinas va aparte). */
export const COLUMNAS = 7

export type ModoContacto = 'NA' | 'NC'

export type Comparador = 'EQU' | 'NEQ' | 'GRT' | 'LES' | 'GEQ' | 'LEQ'

export type Celda =
  | { tipo: 'vacio' }
  | { tipo: 'cable' }
  | { tipo: 'contacto'; modo: ModoContacto; dir: string }
  /** ONS (one shot): deja pasar la corriente un solo barrido cuando llega. */
  | { tipo: 'ons' }
  /** Comparación: pasa corriente si «fuente op valor» es verdadero (T0.ACC, C0.ACC). */
  | { tipo: 'comparar'; op: Comparador; fuente: string; valor: number }

export const SIMBOLO_COMPARADOR: Record<Comparador, string> = {
  EQU: '=',
  NEQ: '≠',
  GRT: '>',
  LES: '<',
  GEQ: '≥',
  LEQ: '≤',
}

export type TipoBobina =
  | 'normal'
  | 'negada'
  | 'flancoP'
  | 'flancoN'
  | 'set'
  | 'reset'
  | 'TON'
  | 'TOF'
  | 'RTO'
  | 'CTU'
  | 'CTD'

export interface Bobina {
  tipo: TipoBobina
  dir: string
  /** Temporizadores: segundos. Contadores: cuentas. */
  preset?: number
}

export interface Escalon {
  /** filas × COLUMNAS */
  celdas: Celda[][]
  /** (filas − 1) × (COLUMNAS + 1): enlace entre la fila f y la f+1 en el nodo c. */
  enlaces: boolean[][]
  /** Una bobina (o ninguna) por fila, en la columna final. */
  bobinas: Array<Bobina | null>
  comentario?: string
}

export interface Simbolo {
  dir: string
  nombre: string
  descripcion: string
}

export type IdPlanta = 'tablero' | 'estanque' | 'elevador' | 'silo' | 'semaforo' | 'porton'

export interface ProgramaPLC {
  version: 1
  tipo: 'programa-plc'
  nombre?: string
  planta: IdPlanta
  simbolos: Simbolo[]
  escalones: Escalon[]
}

// ---------------------------------------------------------------------------
// Direcciones
// ---------------------------------------------------------------------------
export const ENTRADAS = Array.from({ length: 8 }, (_, i) => `I0.${i}`)
export const SALIDAS = Array.from({ length: 8 }, (_, i) => `Q0.${i}`)
export const MARCAS = [...Array.from({ length: 8 }, (_, i) => `M0.${i}`), ...Array.from({ length: 8 }, (_, i) => `M1.${i}`)]
export const TEMPORIZADORES = Array.from({ length: 8 }, (_, i) => `T${i}`)
export const CONTADORES = Array.from({ length: 8 }, (_, i) => `C${i}`)
export const DIRECCIONES = [...ENTRADAS, ...SALIDAS, ...MARCAS, ...TEMPORIZADORES, ...CONTADORES]

export type Area = 'I' | 'Q' | 'M' | 'T' | 'C'
export const areaDe = (dir: string): Area | null => {
  if (/^I0\.[0-7]$/.test(dir)) return 'I'
  if (/^Q0\.[0-7]$/.test(dir)) return 'Q'
  if (/^M[01]\.[0-7]$/.test(dir)) return 'M'
  if (/^T[0-7](\.(DN|TT|EN|ACC))?$/.test(dir)) return 'T'
  if (/^C[0-7](\.(DN|CU|ACC))?$/.test(dir)) return 'C'
  return null
}

/** Bits de estado que se pueden leer de un temporizador y de un contador. */
export const BITS_TEMPORIZADOR = ['DN', 'TT', 'EN'] as const
export const BITS_CONTADOR = ['DN', 'CU'] as const
/** Contactos posibles sobre temporizadores y contadores (T0.DN, T0.TT…). */
export const BITS_TC = [
  ...Array.from({ length: 8 }, (_, i) => BITS_TEMPORIZADOR.map((b) => `T${i}.${b}`)).flat(),
  ...Array.from({ length: 8 }, (_, i) => BITS_CONTADOR.map((b) => `C${i}.${b}`)).flat(),
]
/** Valores numéricos que se pueden comparar: el acumulado de cada T y C. */
export const VALORES = [
  ...Array.from({ length: 8 }, (_, i) => `T${i}.ACC`),
  ...Array.from({ length: 8 }, (_, i) => `C${i}.ACC`),
]
/** La palabra base de una dirección: «T0.DN» → «T0». */
export const baseDe = (dir: string) => (/^[TC]\d/.test(dir) ? dir.split('.')[0] : dir)

export const esTemporizador = (t: TipoBobina) => t === 'TON' || t === 'TOF' || t === 'RTO'
export const esContador = (t: TipoBobina) => t === 'CTU' || t === 'CTD'

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------
export const celdaVacia = (): Celda => ({ tipo: 'vacio' })

export function escalonVacio(filas = 1): Escalon {
  return {
    celdas: Array.from({ length: filas }, () => Array.from({ length: COLUMNAS }, celdaVacia)),
    enlaces: Array.from({ length: Math.max(0, filas - 1) }, () => Array(COLUMNAS + 1).fill(false)),
    bobinas: Array(filas).fill(null),
  }
}

export function programaVacio(planta: IdPlanta = 'tablero', simbolos: Simbolo[] = []): ProgramaPLC {
  return { version: 1, tipo: 'programa-plc', planta, simbolos, escalones: [escalonVacio()] }
}

// ---------------------------------------------------------------------------
// Estado del PLC
// ---------------------------------------------------------------------------
export interface Temporizador {
  tipo?: 'TON' | 'TOF' | 'RTO'
  acumulado: number
  preset?: number
  /** DN: terminó. */
  hecho: boolean
  /** EN: la instrucción tiene corriente. */
  activo: boolean
  /** TT: está contando el tiempo. */
  contando?: boolean
}

export interface Contador {
  tipo: 'CTU' | 'CTD'
  valor: number
  preset: number
  hecho: boolean
  /** Corriente en el barrido anterior (se cuenta en el flanco de subida). */
  anterior: boolean
}

export interface EstadoPLC {
  /** Imagen de memoria: entradas, salidas y marcas. */
  bits: Record<string, boolean>
  temporizadores: Record<string, Temporizador>
  contadores: Record<string, Contador>
  /** Para los flancos: si la bobina tenía corriente en el barrido anterior. */
  previo: Record<string, boolean>
  /** Segundos de funcionamiento (suma de los dt de cada scan). */
  t: number
}

export function estadoInicial(): EstadoPLC {
  const bits: Record<string, boolean> = {}
  for (const d of [...ENTRADAS, ...SALIDAS, ...MARCAS]) bits[d] = false
  return { bits, temporizadores: {}, contadores: {}, previo: {}, t: 0 }
}

/** Valor lógico de una dirección tal como la lee un contacto. */
export function leer(estado: EstadoPLC, dir: string): boolean {
  const area = areaDe(dir)
  const [base, bit = 'DN'] = dir.split('.')
  if (area === 'T') {
    const tm = estado.temporizadores[base]
    if (!tm) return false
    if (bit === 'EN') return tm.activo
    if (bit === 'TT') return !!tm.contando
    return tm.hecho
  }
  if (area === 'C') {
    const ct = estado.contadores[base]
    if (!ct) return false
    if (bit === 'CU') return ct.anterior
    return ct.hecho
  }
  return estado.bits[dir] ?? false
}

/** Valor numérico de T0.ACC (segundos) o C0.ACC (cuenta). */
export function valorDe(estado: EstadoPLC, fuente: string): number {
  const base = baseDe(fuente)
  if (areaDe(base) === 'T') return estado.temporizadores[base]?.acumulado ?? 0
  if (areaDe(base) === 'C') return estado.contadores[base]?.valor ?? 0
  return 0
}

export function comparar(op: Comparador, a: number, b: number): boolean {
  const eps = 1e-9
  switch (op) {
    case 'EQU':
      return Math.abs(a - b) < eps
    case 'NEQ':
      return Math.abs(a - b) >= eps
    case 'GRT':
      return a > b + eps
    case 'LES':
      return a < b - eps
    case 'GEQ':
      return a >= b - eps
    case 'LEQ':
      return a <= b + eps
  }
}

// ---------------------------------------------------------------------------
// Flujo de corriente en un escalón
// ---------------------------------------------------------------------------
export interface FlujoEscalon {
  /** filas × (COLUMNAS + 1): nodos con corriente. */
  nodos: boolean[][]
  /** filas × COLUMNAS: celdas que dejan pasar corriente ahora. */
  conducen: boolean[][]
  /** Por fila: la bobina recibe corriente. */
  bobinas: boolean[]
}

/**
 * En las filas que tienen bobina, lo que queda vacío a la derecha del último
 * elemento se entiende como cable hasta la bobina (así se dibuja y así lo
 * entienden los editores de Ladder).
 */
export function colaCableada(escalon: Escalon, fila: number): number {
  if (!escalon.bobinas[fila]) return COLUMNAS
  const celdas = escalon.celdas[fila]
  let ultimo = -1
  for (let c = 0; c < COLUMNAS; c++) if (celdas[c].tipo !== 'vacio') ultimo = c
  if (fila === 0) return ultimo + 1
  // Una rama con bobina empieza donde entra en ella la corriente: en su primer
  // elemento o en el primer enlace que la une a otra fila. Antes de eso, lo
  // vacío no conduce (si no, la rama tomaría tensión directo de la barra).
  let entrada = ultimo >= 0 ? celdas.findIndex((c) => c.tipo !== 'vacio') : COLUMNAS + 1
  for (let n = 0; n <= COLUMNAS; n++) {
    if (escalon.enlaces[fila - 1]?.[n] || escalon.enlaces[fila]?.[n]) {
      entrada = Math.min(entrada, n)
      break
    }
  }
  return Math.max(ultimo + 1, entrada)
}

/** Lo que un escalón necesita saber de la memoria para resolverse. */
export interface Lector {
  (dir: string): boolean
  /** Valor numérico para las comparaciones (T0.ACC, C0.ACC). */
  valor?: (fuente: string) => number
  /** ONS: si su entrada tenía corriente en el barrido anterior. */
  onsPrevio?: (fila: number, col: number) => boolean
}

export function conduce(escalon: Escalon, fila: number, col: number, lee: Lector): boolean {
  const celda = escalon.celdas[fila][col]
  if (celda.tipo === 'cable') return true
  if (celda.tipo === 'contacto') {
    if (!celda.dir) return false
    const v = lee(celda.dir)
    return celda.modo === 'NA' ? v : !v
  }
  if (celda.tipo === 'comparar') {
    if (!celda.fuente) return false
    return comparar(celda.op, lee.valor?.(celda.fuente) ?? 0, celda.valor)
  }
  // El ONS depende de su propia entrada: se resuelve durante el flujo.
  if (celda.tipo === 'ons') return !(lee.onsPrevio?.(fila, col) ?? false)
  return col >= colaCableada(escalon, fila)
}

export function resolverEscalon(escalon: Escalon, lee: Lector): FlujoEscalon {
  const filas = escalon.celdas.length
  const nodos = Array.from({ length: filas }, () => Array(COLUMNAS + 1).fill(false) as boolean[])
  const conducen = Array.from({ length: filas }, (_, f) =>
    Array.from({ length: COLUMNAS }, (_, c) => conduce(escalon, f, c, lee)),
  )
  // Barra izquierda: tensión en todas las filas.
  for (let f = 0; f < filas; f++) nodos[f][0] = true
  // La corriente avanza de izquierda a derecha por los contactos cerrados y
  // sube o baja por los enlaces; se repite hasta que nada cambia.
  let cambio = true
  let vueltas = 0
  while (cambio && vueltas++ < 4 * (filas + 1) * (COLUMNAS + 1)) {
    cambio = false
    for (let c = 0; c < COLUMNAS; c++) {
      for (let f = 0; f < filas; f++) {
        if (nodos[f][c] && conducen[f][c] && !nodos[f][c + 1]) {
          nodos[f][c + 1] = true
          cambio = true
        }
      }
      for (let f = 0; f < filas - 1; f++) {
        const n = c + 1
        if (!escalon.enlaces[f]?.[n]) continue
        if (nodos[f][n] !== nodos[f + 1][n]) {
          nodos[f][n] = nodos[f + 1][n] = true
          cambio = true
        }
      }
    }
  }
  // Un ONS sólo «conduce» (en el dibujo) si de verdad pasó el pulso.
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < COLUMNAS; c++) {
      if (escalon.celdas[f][c].tipo === 'ons') conducen[f][c] = conducen[f][c] && nodos[f][c]
    }
  }
  return { nodos, conducen, bobinas: nodos.map((fila, f) => !!escalon.bobinas[f] && fila[COLUMNAS]) }
}

// ---------------------------------------------------------------------------
// Ciclo de scan
// ---------------------------------------------------------------------------
export interface ResultadoScan {
  flujos: FlujoEscalon[]
}

/**
 * Un barrido completo del programa. `entradas` es el estado de los bornes de
 * entrada en este instante; `dt` los segundos desde el barrido anterior.
 */
export function scan(
  programa: ProgramaPLC,
  estado: EstadoPLC,
  entradas: Record<string, boolean>,
  dt: number,
): ResultadoScan {
  for (const d of ENTRADAS) estado.bits[d] = !!entradas[d]
  estado.t += dt
  const flujos: FlujoEscalon[] = []
  programa.escalones.forEach((escalon, i) => {
    const lee: Lector = Object.assign((dir: string) => leer(estado, dir), {
      valor: (fuente: string) => valorDe(estado, fuente),
      onsPrevio: (f: number, c: number) => estado.previo[`ons:${i}.${f}.${c}`] ?? false,
    })
    const flujo = resolverEscalon(escalon, lee)
    flujos.push(flujo)
    // Cada ONS recuerda si su entrada tenía corriente en este barrido.
    escalon.celdas.forEach((fila, f) =>
      fila.forEach((celda, c) => {
        if (celda.tipo === 'ons') estado.previo[`ons:${i}.${f}.${c}`] = flujo.nodos[f][c]
      }),
    )
    escalon.bobinas.forEach((bobina, f) => {
      if (!bobina?.dir) return
      ejecutarBobina(estado, bobina, flujo.bobinas[f], `${i}.${f}`, dt)
    })
  })
  return { flujos }
}

function ejecutarBobina(estado: EstadoPLC, b: Bobina, corriente: boolean, clave: string, dt: number) {
  const area = areaDe(b.dir)
  const antes = estado.previo[clave] ?? false
  estado.previo[clave] = corriente
  // Una entrada no se puede escribir: la impone el mundo exterior.
  if (area === 'I') return

  if (esTemporizador(b.tipo)) {
    if (area !== 'T') return
    const preset = Math.max(0, b.preset ?? 1)
    const tm = (estado.temporizadores[b.dir] ??= { acumulado: 0, hecho: false, activo: false })
    tm.tipo = b.tipo as Temporizador['tipo']
    tm.preset = preset
    tm.activo = corriente
    if (b.tipo === 'TON') {
      // Retardo a la conexión: cuenta mientras hay corriente; al soltar se reinicia.
      if (corriente) {
        tm.acumulado = Math.min(preset, tm.acumulado + dt)
        tm.hecho = tm.acumulado >= preset
      } else {
        tm.acumulado = 0
        tm.hecho = false
      }
      tm.contando = corriente && !tm.hecho
    } else if (b.tipo === 'RTO') {
      // Retentivo: acumula mientras hay corriente y guarda lo contado al
      // perderla; sólo un Reset (RES) lo vuelve a cero.
      if (corriente) tm.acumulado = Math.min(preset, tm.acumulado + dt)
      tm.hecho = tm.acumulado >= preset
      tm.contando = corriente && !tm.hecho
    } else {
      // Retardo a la desconexión: sigue activo un tiempo después de perder la corriente.
      if (corriente) {
        tm.hecho = true
        tm.acumulado = 0
      } else if (tm.hecho) {
        tm.acumulado = Math.min(preset, tm.acumulado + dt)
        if (tm.acumulado >= preset) tm.hecho = false
      }
      tm.contando = !corriente && tm.hecho
    }
    return
  }

  if (esContador(b.tipo)) {
    if (area !== 'C') return
    const preset = Math.max(0, Math.round(b.preset ?? 1))
    const ct = (estado.contadores[b.dir] ??= {
      tipo: b.tipo as 'CTU' | 'CTD',
      valor: b.tipo === 'CTD' ? preset : 0,
      preset,
      hecho: false,
      anterior: false,
    })
    ct.tipo = b.tipo as 'CTU' | 'CTD'
    ct.preset = preset
    // Cuenta en el flanco de subida de la corriente, no mientras dura.
    if (corriente && !ct.anterior) ct.valor += b.tipo === 'CTU' ? 1 : -1
    ct.anterior = corriente
    ct.hecho = b.tipo === 'CTU' ? ct.valor >= preset : ct.valor <= 0
    return
  }

  switch (b.tipo) {
    case 'normal':
      if (area === 'Q' || area === 'M') estado.bits[b.dir] = corriente
      break
    case 'negada':
      if (area === 'Q' || area === 'M') estado.bits[b.dir] = !corriente
      break
    case 'flancoP':
      if (area === 'Q' || area === 'M') estado.bits[b.dir] = corriente && !antes
      break
    case 'flancoN':
      if (area === 'Q' || area === 'M') estado.bits[b.dir] = !corriente && antes
      break
    case 'set':
      if (corriente && (area === 'Q' || area === 'M')) estado.bits[b.dir] = true
      break
    case 'reset':
      if (!corriente) break
      if (area === 'T') {
        const tm = estado.temporizadores[b.dir]
        if (tm) Object.assign(tm, { acumulado: 0, hecho: false, contando: false })
      } else if (area === 'C') {
        const ct = estado.contadores[b.dir]
        if (ct) {
          // Un CTU vuelve a cero; un CTD se recarga con su valor inicial.
          ct.valor = ct.tipo === 'CTD' ? ct.preset : 0
          ct.hecho = ct.tipo === 'CTD' ? ct.preset <= 0 : false
        }
      } else {
        estado.bits[b.dir] = false
      }
      break
  }
}

// ---------------------------------------------------------------------------
// Revisión del programa: los errores típicos, explicados al alumno
// ---------------------------------------------------------------------------
export function revisarPrograma(programa: ProgramaPLC): string[] {
  const avisos: string[] = []
  const nombre = (dir: string) => {
    const s = programa.simbolos.find((x) => x.dir === dir)
    return s?.nombre ? `${s.nombre} (${dir})` : dir
  }
  const normales = new Map<string, number[]>()
  programa.escalones.forEach((e, i) => {
    const n = i + 1
    const hayBobina = e.bobinas.some(Boolean)
    const hayContacto = e.celdas.some((fila) => fila.some((c) => c.tipo !== 'vacio'))
    if (hayContacto && !hayBobina) avisos.push(`Escalón ${n}: tiene contactos pero ninguna bobina; no hace nada.`)
    e.celdas.forEach((fila) =>
      fila.forEach((c) => {
        if (c.tipo === 'contacto' && !c.dir) avisos.push(`Escalón ${n}: hay un contacto sin dirección asignada.`)
        if (c.tipo === 'comparar' && !c.fuente) avisos.push(`Escalón ${n}: hay una comparación sin elegir qué comparar.`)
      }),
    )
    e.bobinas.forEach((b) => {
      if (!b) return
      if (!b.dir) {
        avisos.push(`Escalón ${n}: hay una bobina sin dirección asignada.`)
        return
      }
      const area = areaDe(b.dir)
      if (area === 'I') avisos.push(`Escalón ${n}: ${nombre(b.dir)} es una entrada; una bobina no puede escribirla.`)
      if (esTemporizador(b.tipo) && area !== 'T') avisos.push(`Escalón ${n}: un ${b.tipo} necesita una dirección de temporizador (T0…T7).`)
      if (esContador(b.tipo) && area !== 'C') avisos.push(`Escalón ${n}: un ${b.tipo} necesita una dirección de contador (C0…C7).`)
      if (b.tipo === 'normal' || b.tipo === 'negada') {
        normales.set(b.dir, [...(normales.get(b.dir) ?? []), n])
      }
    })
  })
  for (const [dir, escalones] of normales) {
    if (escalones.length > 1) {
      avisos.push(
        `${nombre(dir)} tiene bobina en los escalones ${escalones.join(' y ')}: en cada barrido manda sólo la última. Junta las condiciones en un escalón (en paralelo) o usa Set/Reset.`,
      )
    }
  }
  return avisos
}

/** Copia profunda (los escalones se editan como datos inmutables). */
export const clonarPrograma = (p: ProgramaPLC): ProgramaPLC => JSON.parse(JSON.stringify(p)) as ProgramaPLC

/** Comprueba que un JSON leído de un archivo es un programa válido. */
export function esProgramaPLC(x: unknown): x is ProgramaPLC {
  const p = x as ProgramaPLC
  return (
    !!p &&
    p.tipo === 'programa-plc' &&
    Array.isArray(p.escalones) &&
    Array.isArray(p.simbolos) &&
    p.escalones.every(
      (e) =>
        Array.isArray(e.celdas) &&
        e.celdas.length >= 1 &&
        e.celdas.every((f) => Array.isArray(f) && f.length === COLUMNAS) &&
        Array.isArray(e.bobinas) &&
        e.bobinas.length === e.celdas.length &&
        Array.isArray(e.enlaces),
    )
  )
}
