import { describe, expect, it } from 'vitest'
import { ANCLAS_ESTUDIAR_ROBOT } from '../robot/anclasEstudiar'
import { SECCIONES_ROBOT } from '../robot/EstudiarRobotica'
import { ANCLAS_ESTUDIAR_CNC } from '../cnc/anclasEstudiar'
import { SECCIONES_CNC } from '../cnc/EstudiarCNC'
import { ANCLAS_ESTUDIAR_PLC } from '../plc/anclasEstudiar'
import { SECCIONES_PLC } from '../plc/EstudiarPLC'

// La unidad usa la lista liviana (sin cargar la teoría); Estudiar usa las secciones reales.
describe('anclas de Estudiar', () => {
  it('Robótica: la lista liviana coincide con las secciones reales', () => {
    expect(ANCLAS_ESTUDIAR_ROBOT).toEqual(SECCIONES_ROBOT.map((x) => x.id))
  })
  it('CNC: la lista liviana coincide con las secciones reales', () => {
    expect(ANCLAS_ESTUDIAR_CNC).toEqual(SECCIONES_CNC.map((x) => x.id))
  })
  it('PLC: la lista liviana coincide con las secciones reales', () => {
    expect(ANCLAS_ESTUDIAR_PLC).toEqual(SECCIONES_PLC.map((x) => x.id))
  })
})
