import { CONFIG_INICIAL, type ConfigCNC, type TipoMaquina } from './maquinas'
import { EJEMPLOS_CNC, programaNuevo } from './ejemplos'
import { CLAVES, leerJson } from '../persistencia'

export const CLAVE = CLAVES.cnc

/**
 * La Tarea 3 se trabaja en su propia sección: centro de torneado, latón y un
 * programa en blanco guardado aparte. El enunciado (la pieza) lo entrega el
 * profesor: la app sólo pone la máquina. «Entregar» aparece sólo ahí.
 */
export const CLAVE_TAREA = CLAVES.cncTarea
export const NOMBRE_TAREA = 'Tarea 3'

export type Estado = 'listo' | 'corriendo' | 'bloque' | 'pausa' | 'parada' | 'alarma' | 'fin'

export interface Guardado {
  config: ConfigCNC
  codigos: Record<TipoMaquina, string>
  nombres: Record<TipoMaquina, string>
}

export function leerGuardado(): Guardado {
  const base: Guardado = {
    config: CONFIG_INICIAL,
    codigos: { torno: EJEMPLOS_CNC[0].codigo, fresadora: EJEMPLOS_CNC.find((e) => e.maquina === 'fresadora')!.codigo },
    nombres: { torno: EJEMPLOS_CNC[0].titulo, fresadora: EJEMPLOS_CNC.find((e) => e.maquina === 'fresadora')!.titulo },
  }
  try {
    const g = leerJson(CLAVE) as Partial<Guardado> | null
    if (g && g.config && g.codigos && typeof g.codigos.torno === 'string' && typeof g.codigos.fresadora === 'string') {
      return {
        config: { ...CONFIG_INICIAL, ...g.config, torno: { ...CONFIG_INICIAL.torno, ...g.config.torno }, fresa: { ...CONFIG_INICIAL.fresa, ...g.config.fresa } },
        codigos: g.codigos as Guardado['codigos'],
        nombres: { ...base.nombres, ...(g.nombres ?? {}) },
      }
    }
  } catch {
    // Dato guardado con una forma inesperada: se parte de lo inicial.
  }
  return base
}

export function tareaVacia(): Guardado {
  return {
    config: { ...CONFIG_INICIAL, maquina: 'torno', material: 'laton' },
    codigos: { torno: programaNuevo('torno'), fresadora: programaNuevo('fresadora') },
    nombres: { torno: NOMBRE_TAREA, fresadora: NOMBRE_TAREA },
  }
}

export function leerTarea(): Guardado {
  try {
    const g = leerJson(CLAVE_TAREA) as Partial<Guardado> | null
    if (g && g.config && g.codigos && typeof g.codigos.torno === 'string') {
      const base = tareaVacia()
      return {
        config: { ...base.config, ...g.config, maquina: 'torno', torno: { ...base.config.torno, ...g.config.torno } },
        codigos: { ...base.codigos, torno: g.codigos.torno },
        nombres: { ...base.nombres, ...(g.nombres ?? {}) },
      }
    }
  } catch {
    // Dato guardado con una forma inesperada: se parte de la tarea en blanco.
  }
  return tareaVacia()
}
