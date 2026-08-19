/**
 * Válvula 4/2: como la 5/2 pero con un único escape compartido.
 * Reposo 1→2 y 4→3; accionada 1→4 y 2→3.
 */
import { describe, expect, it } from 'vitest'
import { Motor } from '../motor'
import type { Circuito, RefPuerto } from '../tipos'
import type { EstadoCilindroDoble, EstadoValvula52 } from '../componentes'

const ref = (componente: string, puerto: string): RefPuerto => ({ componente, puerto })

function circuito42(params: Record<string, string> = {}): Circuito {
  return {
    componentes: [
      { id: 'F1', tipo: 'fuente', params: { presion: 6 } },
      { id: 'V1', tipo: 'valvula42', params: { modo: 'monoestable', accionamiento: 'pulsador', ...params } },
      { id: 'C1', tipo: 'cilindroDobleEfecto' },
    ],
    mangueras: [
      { id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') },
      { id: 'm2', a: ref('V1', '4'), b: ref('C1', 'A') },
      { id: 'm3', a: ref('V1', '2'), b: ref('C1', 'B') },
    ],
  }
}

const cilindro = (motor: Motor) => motor.estadoDe<EstadoCilindroDoble>('C1')

describe('válvula 4/2 con cilindro de doble efecto', () => {
  it('en reposo alimenta 1→2 (cámara B) y el vástago queda retraído', () => {
    const motor = new Motor(circuito42())
    motor.simular(1)
    expect(motor.presionEn('C1', 'B')).toBe(6)
    expect(motor.presionEn('C1', 'A')).toBe(0)
    expect(cilindro(motor).posicion).toBe(0)
  })

  it('accionada alimenta 1→4 (cámara A) y el vástago avanza', () => {
    const motor = new Motor(circuito42())
    motor.accionar('V1', true)
    motor.simular(2)
    expect(motor.presionEn('C1', 'A')).toBe(6)
    expect(cilindro(motor).posicion).toBe(1)
  })

  it('al soltar, el muelle la devuelve a reposo y el vástago retorna', () => {
    const motor = new Motor(circuito42())
    motor.accionar('V1', true)
    motor.simular(2)
    motor.accionar('V1', false)
    motor.simular(2)
    expect(cilindro(motor).posicion).toBe(0)
  })

  it('el escape 3 es común a las dos vías: siempre hay camino a la atmósfera', () => {
    const motor = new Motor(circuito42())
    // En reposo, el aire de la cámara A sale por 4→3
    motor.simular(0.5)
    expect(motor.presionEn('C1', 'A')).toBe(0)
    // Accionada, el aire de la cámara B sale por 2→3
    motor.accionar('V1', true)
    motor.simular(0.5)
    expect(motor.presionEn('C1', 'B')).toBe(0)
  })

  it('en versión biestable conserva la posición tras un pulso de pilotaje', () => {
    const circuito = circuito42({ modo: 'biestable' })
    circuito.componentes.push({ id: 'P14', tipo: 'valvula32', params: { reposo: 'NC' } })
    circuito.mangueras.push(
      { id: 'm4', a: ref('F1', '1'), b: ref('P14', '1') },
      { id: 'm5', a: ref('P14', '2'), b: ref('V1', '14') },
    )
    const motor = new Motor(circuito)
    motor.accionar('P14', true)
    motor.simular(0.2)
    motor.accionar('P14', false)
    motor.simular(2)
    expect(motor.estadoDe<EstadoValvula52>('V1').accionada).toBe(true)
    expect(cilindro(motor).posicion).toBe(1)
  })
})
