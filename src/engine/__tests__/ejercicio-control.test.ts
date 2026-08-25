/**
 * El circuito de la Actividad 2 / Evaluación N.º 1 del curso, tal como se carga
 * en la aplicación: secuencia A+B+ | B−A−C+ | C− resuelta por cascada.
 */
import { describe, expect, it } from 'vitest'
import { Motor } from '../motor'
import { validarCircuito } from '../validacion'
import { CIRCUITO_TRES_GRUPOS } from '../../circuitos/ejercicios'

const circuito = () => ({
  componentes: CIRCUITO_TRES_GRUPOS.piezas.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    params: { ...p.params },
  })),
  mangueras: CIRCUITO_TRES_GRUPOS.mangueras.map((m) => ({ ...m })),
})

const pos = (m: Motor, id: string) => m.estadoDe<{ posicion: number }>(id).posicion

describe('ejercicio del curso: A+B+ | B−A−C+ | C−', () => {
  it('el circuito no tiene errores de montaje', () => {
    expect(validarCircuito(circuito())).toEqual([])
  })

  it('ejecuta la secuencia completa en el orden pedido', () => {
    const motor = new Motor(circuito())
    const seq: string[] = []
    let a = 0, b = 0, c = 0
    motor.accionar('M', true)
    for (let i = 0; i < 500; i++) {
      motor.tick()
      const na = pos(motor, 'CA'), nb = pos(motor, 'CB'), nc = pos(motor, 'CC')
      if (na === 1 && a < 1) seq.push('A+')
      if (na === 0 && a > 0) seq.push('A−')
      if (nb === 1 && b < 1) seq.push('B+')
      if (nb === 0 && b > 0) seq.push('B−')
      if (nc === 1 && c < 1) seq.push('C+')
      if (nc === 0 && c > 0) seq.push('C−')
      a = na; b = nb; c = nc
    }
    expect(seq.slice(0, 6)).toEqual(['A+', 'B+', 'B−', 'A−', 'C+', 'C−'])
  })

  it('no aparece ningún conflicto de pilotajes', () => {
    const motor = new Motor(circuito())
    motor.accionar('M', true)
    motor.simular(20)
    expect(motor.eventos.filter((e) => e.tipo === 'conflicto')).toEqual([])
  })

  it('sólo una de las tres líneas de grupo tiene presión en cada instante', () => {
    const motor = new Motor(circuito())
    motor.accionar('M', true)
    for (let i = 0; i < 400; i++) {
      motor.tick()
      const vivas = [
        motor.presionEn('K1', '2'),
        motor.presionEn('K1', '4'),
        motor.presionEn('K2', '4'),
      ].filter((p) => p > 0.1).length
      expect(vivas).toBeLessThanOrEqual(1)
    }
  })

  it('el ciclo se repite mientras se mantenga la marcha, y se detiene al soltarla', () => {
    const motor = new Motor(circuito())
    motor.accionar('M', true)
    let ciclos = 0
    let a = 0
    for (let i = 0; i < 900; i++) {
      motor.tick()
      const na = pos(motor, 'CA')
      if (na === 1 && a < 1) ciclos++
      a = na
    }
    expect(ciclos).toBeGreaterThanOrEqual(3)

    motor.accionar('M', false)
    motor.simular(15)
    const eventosAntes = motor.eventos.length
    motor.simular(10)
    expect(motor.eventos.length).toBe(eventosAntes)
  })
})
