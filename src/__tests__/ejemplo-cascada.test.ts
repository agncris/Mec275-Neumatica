/**
 * Ejemplo 7 · cascada de tres grupos: al pulsar la marcha hace el ciclo
 * completo A+ B+ | B− A− C+ | C− y vuelve a reposo.
 */
import { describe, expect, it } from 'vitest'
import { Motor } from '../engine'
import { EJEMPLOS } from '../circuitos/ejemplos'
import { circuitoDesdeStore } from '../store'

describe('ejemplo 7 · cascada de 3 grupos', () => {
  it('con un pulso de marcha hace A+ B+ B− A− C+ C− y se detiene', () => {
    const e = EJEMPLOS[7]
    const motor = new Motor(circuitoDesdeStore(structuredClone(e.piezas), structuredClone(e.mangueras)))
    motor.simular(1)
    motor.accionar('M', true)
    motor.simular(0.3)
    motor.accionar('M', false)
    motor.simular(25)
    const nombres: Record<string, string> = { CA: 'A', CB: 'B', CC: 'C' }
    const pasos = motor.eventos
      .filter((ev) => nombres[ev.componente] && (ev.tipo === 'extendido' || ev.tipo === 'reposo'))
      .map((ev) => `${nombres[ev.componente]}${ev.tipo === 'extendido' ? '+' : '−'}`)
    expect(pasos).toEqual(['A+', 'B+', 'B−', 'A−', 'C+', 'C−'])
  })
})
