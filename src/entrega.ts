/**
 * Entrega del alumno: un único archivo que reúne todo lo que pide el enunciado
 * —identificación, las respuestas escritas, el diagrama VDI y el circuito— y
 * que el profesor puede volver a abrir en la aplicación para revisarlo.
 *
 * Sustituye al par PDF + .ct/.bak de FluidSim: el circuito sigue siendo
 * ejecutable, así que la corrección puede comprobarse simulando.
 */
import type { Manguera } from './engine'
import type { Pieza } from './store'
import { esCircuitoValido } from './persistencia'

export const FORMATO_ENTREGA = 'neumalab-entrega'

/** Un paso del diagrama de funcionamiento VDI 2860. */
export interface PasoVDI {
  /** Número de función VDI 2860 (1–24). */
  n: number
  /** Anotación del alumno: a qué elemento del proceso corresponde. */
  nota: string
}

export interface Respuestas {
  /** 1 · Diagrama de funcionamiento según VDI 2860. */
  vdi: PasoVDI[]
  /** 2 · Secuencia de automatización, p. ej. "A+ B+ B- A-". */
  secuencia: string
  /** 2 · Activadores (finales de carrera y marcha) que gobiernan cada movimiento. */
  activadores: string
  /** 3 · Elementos necesarios para el circuito. */
  elementos: string
  /** Observaciones libres del alumno. */
  comentarios: string
}

export interface Entrega {
  formato: typeof FORMATO_ENTREGA
  version: 1
  alumno: { nombre: string; rol: string }
  ejercicio: string
  respuestas: Respuestas
  circuito: { piezas: Pieza[]; mangueras: Manguera[] }
  fecha: string
}

export const RESPUESTAS_VACIAS: Respuestas = {
  vdi: [],
  secuencia: '',
  activadores: '',
  elementos: '',
  comentarios: '',
}

export function crearEntrega(
  alumno: { nombre: string; rol: string },
  ejercicio: string,
  respuestas: Respuestas,
  circuito: { piezas: Pieza[]; mangueras: Manguera[] },
): Entrega {
  return {
    formato: FORMATO_ENTREGA,
    version: 1,
    alumno,
    ejercicio,
    respuestas,
    circuito,
    fecha: new Date().toISOString(),
  }
}

/**
 * Comprueba que un archivo abierto es una entrega completa y no, por ejemplo,
 * un circuito suelto o un JSON de otra cosa.
 */
export function esEntrega(dato: unknown): dato is Entrega {
  if (typeof dato !== 'object' || dato === null) return false
  const d = dato as Partial<Entrega>
  if (d.formato !== FORMATO_ENTREGA) return false
  if (typeof d.alumno?.nombre !== 'string' || typeof d.alumno?.rol !== 'string') return false
  const r = d.respuestas
  if (typeof r !== 'object' || r === null) return false
  if (!Array.isArray(r.vdi)) return false
  if (!r.vdi.every((p) => typeof p?.n === 'number' && typeof p?.nota === 'string')) return false
  for (const campo of ['secuencia', 'activadores', 'elementos', 'comentarios'] as const) {
    if (typeof r[campo] !== 'string') return false
  }
  return esCircuitoValido({ piezas: d.circuito?.piezas, mangueras: d.circuito?.mangueras })
}

/** Rellena los huecos de una entrega antigua o incompleta sin romper nada. */
export function normalizarRespuestas(r: Partial<Respuestas> | undefined): Respuestas {
  return {
    vdi: Array.isArray(r?.vdi) ? r!.vdi.filter((p) => typeof p?.n === 'number') : [],
    secuencia: typeof r?.secuencia === 'string' ? r.secuencia : '',
    activadores: typeof r?.activadores === 'string' ? r.activadores : '',
    elementos: typeof r?.elementos === 'string' ? r.elementos : '',
    comentarios: typeof r?.comentarios === 'string' ? r.comentarios : '',
  }
}
