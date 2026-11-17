import { useMemo } from 'react'
import { BASE_DEFECTO, HERR_DEFECTO, previaDe } from './datosRobot'
import { cajaCurvas, leerDXF } from './geometria'
import { planoXY, v, type Plano } from './matematica'
import { simular } from './movimiento'
import { componente, evaluar, paramsIniciales, type Dato, type Definicion, type Herramienta, type Programa, type RobotVirtual } from './nodos'
import { robotPorId } from './robots'

/**
 * Lo que se deduce de la definición: el DXF leído, la evaluación de los nodos, el
 * programa del Core, la vista previa, la plancha, la simulación y el robot, la
 * herramienta y la base que se ven (aunque todavía no haya Core completo).
 */
export function useEvaluacionRobot(def: Definicion, seleccion: string | null, enTarea: boolean) {
  const dxf = useMemo(() => (def.dxf ? leerDXF(def.dxf.texto) : null), [def.dxf])
  const evaluacion = useMemo(() => evaluar(def, dxf), [def, dxf])
  const programa: Programa | null = evaluacion.programas[0] ?? null
  const previa = useMemo(() => {
    const todos: Dato[] = []
    for (const n of def.nodos) {
      const r = evaluacion.nodos[n.id]
      if (!r || r.estado === 'error' || n.tipo === 'core') continue
      for (const s of r.salidas) todos.push(...s)
    }
    return previaDe(todos)
  }, [def, evaluacion])
  const seleccionPrevia = useMemo(
    () => (seleccion ? previaDe((evaluacion.nodos[seleccion]?.salidas ?? []).flat()) : { curvas: [], puntos: [], planos: [] }),
    [evaluacion, seleccion],
  )
  // Plancha: el contorno de la geometría con 20 mm de margen.
  const placa = useMemo(() => {
    const curvas = previa.curvas.map((pts) => ({ pts, cerrada: true, esquinas: [] }))
    if (!curvas.length) return null
    const { min, max } = cajaCurvas(curvas)
    return Number.isFinite(min.x) ? { x0: min.x - 20, y0: min.y - 20, x1: max.x + 20, y1: max.y + 20 } : null
  }, [previa])
  // En la tarea, la simulación también avisa del husillo (en los ejercicios y fallas no: ahí se encuentra leyendo el KRL).
  const sim = useMemo(() => (programa ? simular(programa, placa, { avisoHusillo: enTarea }) : null), [programa, placa, enTarea])

  // Robot, herramienta y base que se ven (aunque todavía no haya Core completo).
  const robotVista: RobotVirtual = useMemo(() => {
    if (programa) return programa.robot
    for (const n of def.nodos) if (n.tipo === 'robot') {
      const r = evaluacion.nodos[n.id]?.salidas[0]?.[0] as RobotVirtual | undefined
      if (r) return r
    }
    return { modelo: robotPorId('kr6r900'), pedestal: 0 }
  }, [programa, def, evaluacion])
  const herrVista: Herramienta = useMemo(() => {
    if (programa) return programa.herramienta
    for (const n of def.nodos) if (n.tipo === 'herramienta') {
      const h = evaluacion.nodos[n.id]?.salidas[0]?.[0] as Herramienta | undefined
      if (h) return h
    }
    return HERR_DEFECTO
  }, [programa, def, evaluacion])
  const baseVista: Plano = useMemo(() => {
    if (programa) return programa.base
    const core = def.nodos.find((n) => n.tipo === 'core')
    if (!core) return BASE_DEFECTO
    const p = { ...paramsIniciales(componente('core')!), ...core.params }
    return planoXY(v(Number(p.bx), Number(p.by), Number(p.bz)))
  }, [programa, def])
  return { dxf, evaluacion, programa, previa, seleccionPrevia, placa, sim, robotVista, herrVista, baseVista }
}
