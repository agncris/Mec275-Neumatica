/**
 * Análisis de secuencias neumáticas escritas en notación de movimientos
 * (A+ B+ B− A−) y división en grupos para el método cascada.
 *
 * Regla de agrupación: se recorre la secuencia de izquierda a derecha y se
 * cierra el grupo justo antes de que un actuador se repita dentro de él. Así
 * se obtiene el número mínimo de grupos, y con n grupos hacen falta n−1
 * válvulas de cascada.
 */

export interface Movimiento {
  /** Actuador: A, B, C… */
  actuador: string
  /** true = sale el vástago (+), false = entra (−) */
  sale: boolean
  /** Texto normalizado, p. ej. "A+" */
  texto: string
}

export interface AnalisisSecuencia {
  movimientos: Movimiento[]
  grupos: Movimiento[][]
  /** Válvulas de cascada necesarias: número de grupos menos uno. */
  valvulasCascada: number
  error: string | null
}

/** Acepta +, - y los guiones tipográficos − – —. */
const SIGNO_MENOS = /[-−–—]/

/**
 * Divide el texto en movimientos. Tolera comas, espacios, minúsculas y que se
 * escriban pegados ("A+B+B-A-"), que es como suelen teclearlo los alumnos.
 */
export function leerSecuencia(texto: string): { movimientos: Movimiento[]; error: string | null } {
  const limpio = texto.replace(/[,;.]/g, ' ').trim()
  if (!limpio) return { movimientos: [], error: null }

  const movimientos: Movimiento[] = []
  const fichas = limpio.match(/[A-Za-z]\s*[-+−–—]?/g) ?? []
  const reconstruido = fichas.join('').replace(/\s+/g, '')
  const original = limpio.replace(/\s+/g, '')

  if (reconstruido.length !== original.length) {
    return {
      movimientos: [],
      error: 'Sólo se entienden movimientos del tipo A+ B− : una letra y un signo.',
    }
  }

  for (const ficha of fichas) {
    const compacta = ficha.replace(/\s+/g, '')
    const actuador = compacta[0].toUpperCase()
    const signo = compacta.slice(1)
    if (!signo) {
      return { movimientos: [], error: `A «${actuador}» le falta el signo + o −.` }
    }
    const sale = signo === '+'
    if (!sale && !SIGNO_MENOS.test(signo)) {
      return { movimientos: [], error: `Signo no reconocido en «${compacta}».` }
    }
    movimientos.push({ actuador, sale, texto: `${actuador}${sale ? '+' : '−'}` })
  }

  return { movimientos, error: null }
}

/** Divide una lista de movimientos en grupos de cascada. */
export function agruparMovimientos(movimientos: Movimiento[]): Movimiento[][] {
  const grupos: Movimiento[][] = []
  let actual: Movimiento[] = []
  let letras = new Set<string>()

  for (const mov of movimientos) {
    if (letras.has(mov.actuador)) {
      grupos.push(actual)
      actual = []
      letras = new Set()
    }
    actual.push(mov)
    letras.add(mov.actuador)
  }
  if (actual.length > 0) grupos.push(actual)
  return grupos
}

export function analizarSecuencia(texto: string): AnalisisSecuencia {
  const { movimientos, error } = leerSecuencia(texto)
  if (error || movimientos.length === 0) {
    return { movimientos: [], grupos: [], valvulasCascada: 0, error }
  }
  const grupos = agruparMovimientos(movimientos)
  return {
    movimientos,
    grupos,
    valvulasCascada: Math.max(0, grupos.length - 1),
    error: null,
  }
}
