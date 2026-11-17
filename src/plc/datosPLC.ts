import { EJEMPLOS_PLC } from './ejemplos'
import { clonarPrograma, programaVacio, type IdPlanta, type ProgramaPLC } from './ladder'
import { PLANTAS } from './plantas'
import { esProgramaPLC as esProgramaBase } from './ladder'
import { CLAVES, guardarJson, leerJson as leerJsonGuardado } from '../persistencia'

export const CLAVE = CLAVES.plcPrograma

/** Un programa de PLC, con una planta que esta versión conoce (un guardado de otra versión no debe romper la unidad). */
export const esProgramaPLC = (x: unknown): x is ProgramaPLC => esProgramaBase(x) && (x as ProgramaPLC).planta in PLANTAS
export const DT = 0.02

/**
 * La Tarea 2 se trabaja en su propia sección, con su planta (el silo) y su
 * programa guardado aparte. El enunciado lo entrega el profesor: la app sólo
 * pone la planta.
 */
export const CLAVE_TAREA = CLAVES.plcTarea
export const PLANTA_TAREA: IdPlanta = 'silo'
export const NOMBRE_TAREA = 'Tarea 2'

export function leerJson(clave: string): ProgramaPLC | null {
  const p = leerJsonGuardado(clave)
  if (esProgramaPLC(p)) return p
  return null
}

export function tareaVacia(): ProgramaPLC {
  // La tabla de entradas y salidas la completa el alumno: parte vacía (las direcciones están rotuladas en la planta).
  return { ...programaVacio(PLANTA_TAREA, []), nombre: NOMBRE_TAREA }
}

export function leerGuardado(): ProgramaPLC {
  const p = leerJson(CLAVE)
  if (p && p.planta !== PLANTA_TAREA) return p
  // Quien ya trabajaba el silo en el laboratorio lo encuentra ahora en la sección de la tarea.
  if (p && !leerJson(CLAVE_TAREA)) {
    guardarJson(CLAVE_TAREA, p)
  }
  return clonarPrograma(EJEMPLOS_PLC[0].programa)
}

export function leerTarea(): ProgramaPLC {
  const p = leerJson(CLAVE_TAREA)
  return p && p.planta === PLANTA_TAREA ? p : tareaVacia()
}

export interface Evento {
  t: number
  mensaje: string
  aviso?: boolean
}
