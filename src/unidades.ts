/**
 * Qué unidades ven los alumnos. Las ocultas no aparecen en la barra ni se
 * abren con ?unidad= o con un enlace de trabajo; para publicar una, basta
 * sacarla de UNIDADES_OCULTAS.
 *
 * Para revisarlas antes de la clase: agrega ?ver=todas a la dirección
 * (p. ej. …/?unidad=cnc&ver=todas). Vale mientras la pestaña siga abierta.
 */
export type Unidad = 'neumatica' | 'plc' | 'cnc' | 'robotica'

export const UNIDADES_OCULTAS: Unidad[] = ['cnc', 'robotica']

const CLAVE_VISTA_PREVIA = 'neumalab.ver-todas'

/** ¿Se están viendo también las unidades ocultas (vista previa del profesor)? */
export function vistaPrevia(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (new URLSearchParams(window.location.search).get('ver') === 'todas') {
      sessionStorage.setItem(CLAVE_VISTA_PREVIA, 'si')
      return true
    }
    return sessionStorage.getItem(CLAVE_VISTA_PREVIA) === 'si'
  } catch {
    return false
  }
}

export function unidadVisible(u: Unidad): boolean {
  return !UNIDADES_OCULTAS.includes(u) || vistaPrevia()
}
