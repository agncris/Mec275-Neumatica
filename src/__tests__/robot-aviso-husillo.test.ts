import { describe, expect, it } from 'vitest'
import { EJEMPLOS_ROBOT } from '../robot/ejemplos'
import { leerDXF } from '../robot/geometria'
import { evaluar, type Definicion } from '../robot/nodos'
import { simular } from '../robot/movimiento'

const avisos = (d: Definicion) => {
  const ev = evaluar(d, d.dxf ? leerDXF(d.dxf.texto) : null)
  return simular(ev.programas[0], null, { avisoHusillo: true }).problemas.filter((p) => p.nivel === 'aviso').map((p) => p.texto)
}
const ejemplo = (id: string) => EJEMPLOS_ROBOT.find((e) => e.id === id)!.definicion()

describe('aviso del husillo (sólo en la tarea)', () => {
  it('sin la opción activada (laboratorio y fallas) no avisa nada del husillo', () => {
    const d = ejemplo('fresado')
    d.nodos = d.nodos.filter((n) => !['on', 'esp', 'off1'].includes(n.id))
    d.cables = d.cables.filter((c) => !['on', 'esp', 'off1'].includes(c.de))
    const ev = evaluar(d, d.dxf ? leerDXF(d.dxf.texto) : null)
    expect(simular(ev.programas[0]).problemas.filter((p) => /husillo/i.test(p.texto))).toEqual([])
  })

  it('el ejemplo de fresado, que enciende y apaga el husillo, no avisa de husillo', () => {
    expect(avisos(ejemplo('fresado')).filter((t) => /husillo/i.test(t))).toEqual([])
  })

  it('una fresa que corta sin salida digital avisa que el husillo no está encendido', () => {
    const d = ejemplo('fresado')
    d.nodos = d.nodos.filter((n) => !['on', 'esp', 'off1'].includes(n.id))
    d.cables = d.cables.filter((c) => !['on', 'esp', 'off1'].includes(c.de))
    expect(avisos(d).some((t) => /no está encendido/.test(t))).toBe(true)
  })

  it('si el husillo se enciende y no se apaga, avisa que queda encendido', () => {
    const d = ejemplo('fresado')
    d.nodos = d.nodos.filter((n) => n.id !== 'off1')
    d.cables = d.cables.filter((c) => c.de !== 'off1')
    expect(avisos(d).some((t) => /queda encendido/.test(t))).toBe(true)
  })

  it('con un portalápiz no avisa nada de husillo', () => {
    expect(avisos(ejemplo('basico')).filter((t) => /husillo/i.test(t))).toEqual([])
  })
})
