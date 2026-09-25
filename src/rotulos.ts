/**
 * Rótulos de las piezas de neumática: la letra de cada actuador en la
 * secuencia (A, B, C…), su nombre en la máquina («Elevador») y la señal que
 * da cada final de carrera (a0, a1…). Así el esquema, el diagrama de fase y
 * la secuencia hablan el mismo idioma que el método cascada.
 */
import { esActuador, letraActuador, type Params } from './engine'

interface PiezaRotulable {
  id: string
  tipo: string
  params?: Record<string, unknown>
}

/** Letra de un actuador: la que eligió el alumno o, si no, la que le toca por orden. */
export function letraDe(id: string, piezas: PiezaRotulable[]): string {
  return letraActuador(id, piezas as Array<{ id: string; tipo: string; params?: Params }>)
}

/** Nombre que el alumno le puso a la pieza (vacío si no le puso). */
export function nombreDe(p: PiezaRotulable): string {
  const n = p.params?.nombre
  return typeof n === 'string' ? n.trim() : ''
}

/** Señal de un final de carrera: letra del actuador que lo pisa + 0 (retraído) o 1 (extendido). */
export function senalFinalCarrera(p: PiezaRotulable, piezas: PiezaRotulable[]): string | null {
  const c = p.params?.cilindro
  const cil = typeof c === 'string' ? c : ''
  if (!cil || !piezas.some((x) => x.id === cil)) return null
  return `${letraDe(cil, piezas).toLowerCase()}${Number((p.params ?? {}).puntoDisparo ?? 1) >= 0.5 ? 1 : 0}`
}

/** Texto que va sobre la pieza en el esquema. */
export function rotuloPieza(p: PiezaRotulable, piezas: PiezaRotulable[]): string {
  const nombre = nombreDe(p)
  if (esActuador(p.tipo)) return `${letraDe(p.id, piezas)} · ${nombre || p.id}`
  if (p.tipo === 'finalCarrera') {
    const s = senalFinalCarrera(p, piezas)
    return [nombre || p.id, s].filter(Boolean).join(' · ')
  }
  return nombre ? `${p.id} · ${nombre}` : p.id
}
