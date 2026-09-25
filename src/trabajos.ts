/**
 * «Mis trabajos»: varios trabajos guardados con nombre en cada unidad (el
 * ejercicio 1, el 2, la tarea…), en este navegador. Y un respaldo con todo,
 * en un solo archivo, para llevarlo a otro computador.
 */
export type UnidadTrabajo = 'neumatica' | 'plc' | 'cnc' | 'robotica'
export const UNIDADES_TRABAJO: UnidadTrabajo[] = ['neumatica', 'plc', 'cnc', 'robotica']

export interface TrabajoGuardado {
  id: string
  nombre: string
  /** Fecha de la última vez que se guardó (ISO). */
  fecha: string
  dato: unknown
}

const clave = (u: UnidadTrabajo) => `neumalab.trabajos.${u}`

export function listarTrabajos(u: UnidadTrabajo): TrabajoGuardado[] {
  try {
    const d = JSON.parse(localStorage.getItem(clave(u)) ?? '[]')
    return Array.isArray(d) ? d.filter((t) => t && typeof t.id === 'string' && typeof t.nombre === 'string') : []
  } catch {
    return []
  }
}

function escribir(u: UnidadTrabajo, lista: TrabajoGuardado[]): void {
  try {
    localStorage.setItem(clave(u), JSON.stringify(lista))
  } catch {
    throw new Error('No queda espacio en este navegador. Descarga un respaldo y borra trabajos que ya no uses.')
  }
}

/** Guarda (o reemplaza, si ya hay uno con ese nombre) un trabajo. */
export function guardarTrabajo(u: UnidadTrabajo, nombre: string, dato: unknown): TrabajoGuardado {
  const lista = listarTrabajos(u)
  const limpio = nombre.trim() || 'Sin nombre'
  const existente = lista.find((t) => t.nombre.toLowerCase() === limpio.toLowerCase())
  const t: TrabajoGuardado = { id: existente?.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, nombre: limpio, fecha: new Date().toISOString(), dato }
  escribir(u, [t, ...lista.filter((x) => x.id !== t.id)])
  return t
}

export function borrarTrabajo(u: UnidadTrabajo, id: string): void {
  escribir(
    u,
    listarTrabajos(u).filter((t) => t.id !== id),
  )
}

export function renombrarTrabajo(u: UnidadTrabajo, id: string, nombre: string): void {
  escribir(
    u,
    listarTrabajos(u).map((t) => (t.id === id ? { ...t, nombre: nombre.trim() || t.nombre } : t)),
  )
}

export const FORMATO_RESPALDO = 'neumalab-respaldo'

export interface Respaldo {
  formato: typeof FORMATO_RESPALDO
  version: 1
  fecha: string
  trabajos: Partial<Record<UnidadTrabajo, TrabajoGuardado[]>>
  /** El trabajo abierto de cada unidad (su copia automática). */
  abiertos: Record<string, string>
}

/** Claves de las copias automáticas del trabajo abierto de cada unidad. */
const CLAVES_ABIERTOS = ['neumalab.circuito-abierto', 'neumalab.circuito', 'neumalab.plc.programa', 'neumalab.cnc', 'neumalab.robot.definicion', 'neumalab.alumno']

export function crearRespaldo(): Respaldo {
  const abiertos: Record<string, string> = {}
  for (const k of CLAVES_ABIERTOS) {
    try {
      const v = localStorage.getItem(k)
      if (v !== null) abiertos[k] = v
    } catch {
      /* sin almacenamiento */
    }
  }
  return {
    formato: FORMATO_RESPALDO,
    version: 1,
    fecha: new Date().toISOString(),
    trabajos: Object.fromEntries(UNIDADES_TRABAJO.map((u) => [u, listarTrabajos(u)])),
    abiertos,
  }
}

export function esRespaldo(d: unknown): d is Respaldo {
  return typeof d === 'object' && d !== null && (d as Respaldo).formato === FORMATO_RESPALDO && typeof (d as Respaldo).trabajos === 'object'
}

/**
 * Suma los trabajos del respaldo a los de este navegador (no borra nada: si
 * un trabajo ya existe, se queda el más reciente). Devuelve cuántos trajo.
 */
export function restaurarRespaldo(r: Respaldo): number {
  let n = 0
  for (const u of UNIDADES_TRABAJO) {
    const traidos = r.trabajos[u] ?? []
    if (!traidos.length) continue
    const actuales = listarTrabajos(u)
    const porId = new Map(actuales.map((t) => [t.id, t]))
    for (const t of traidos) {
      const ya = porId.get(t.id)
      if (!ya || ya.fecha < t.fecha) porId.set(t.id, t)
      n++
    }
    escribir(
      u,
      [...porId.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
    )
  }
  return n
}
