import { useEffect, useState } from 'react'
import { leerAlumno } from '../entregar'
import type { Definicion } from './nodos'
import { analizarTarea4, revisarTarea4, type PuntoRevisionTarea } from './tarea4'

/** La revisión de la tarea contra lo que llevas armado, con medio segundo de espera para no recalcular en cada cambio. */
export function useChecklistTarea(def: Definicion, enTarea: boolean): PuntoRevisionTarea[] {
  const [checklistTarea, setChecklistTarea] = useState<PuntoRevisionTarea[]>([])
  useEffect(() => {
    if (!enTarea) return
    const id = window.setTimeout(() => {
      try {
        setChecklistTarea(revisarTarea4(analizarTarea4(def), leerAlumno().nombre))
      } catch {
        setChecklistTarea([])
      }
    }, 500)
    return () => window.clearTimeout(id)
  }, [enTarea, def])
  return checklistTarea
}
