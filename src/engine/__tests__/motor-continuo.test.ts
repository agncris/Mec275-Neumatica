/**
 * Motor neumático de giro continuo y su sensor de paso: el motor gira sin
 * parar mientras reciba aire (no tiene "final de carrera" como un cilindro),
 * y el sensor debe detectar cada cruce del punto elegido aunque el motor gire
 * rápido y la posición nunca quede "cerca" del punto en un instante exacto.
 */
import { describe, expect, it } from 'vitest'
import { DT_POR_DEFECTO, Motor } from '../motor'
import type { Circuito, RefPuerto } from '../tipos'
import type { EstadoMotor, EstadoSensorGiro } from '../componentes'

const ref = (componente: string, puerto: string): RefPuerto => ({ componente, puerto })

function circuitoMotor(
  paramsMotor: Record<string, number> = {},
  paramsSensor: Record<string, unknown> = {},
): Circuito {
  return {
    componentes: [
      { id: 'F1', tipo: 'fuente', params: { presion: 6 } },
      { id: 'V1', tipo: 'valvula32', params: { reposo: 'NC', accionamiento: 'pulsador' } },
      { id: 'M1', tipo: 'motorNeumatico', params: { velocidad: 0.5, ...paramsMotor } },
      { id: 'S1', tipo: 'sensorGiro', params: { motor: 'M1', puntoDisparo: 0, duracionPulso: 0.3, ...paramsSensor } },
    ],
    mangueras: [
      { id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') },
      { id: 'm2', a: ref('V1', '2'), b: ref('M1', '1') },
    ],
  }
}

const motorEstado = (motor: Motor) => motor.estadoDe<EstadoMotor>('M1')
const sensorEstado = (motor: Motor) => motor.estadoDe<EstadoSensorGiro>('S1')

describe('motor neumático de giro continuo', () => {
  it('no gira sin aire', () => {
    const motor = new Motor(circuitoMotor())
    motor.simular(1)
    expect(motorEstado(motor).accionada).toBe(false)
    expect(motorEstado(motor).velocidad).toBe(0)
  })

  it('gira de forma continua mientras recibe aire, sin quedar clavado en un extremo', () => {
    const motor = new Motor(circuitoMotor())
    motor.accionar('V1', true)
    motor.simular(5) // a 0.5 vueltas/s, varias vueltas completas
    const estado = motorEstado(motor)
    expect(estado.accionada).toBe(true)
    expect(estado.velocidad).toBeGreaterThan(0)
    expect(estado.posicion).toBeGreaterThanOrEqual(0)
    expect(estado.posicion).toBeLessThan(1)
  })

  it('se detiene en cuanto se corta el aire, sin completar la vuelta', () => {
    const motor = new Motor(circuitoMotor())
    motor.accionar('V1', true)
    motor.simular(0.3)
    motor.accionar('V1', false)
    const posAlCortar = motorEstado(motor).posicion
    motor.simular(2)
    expect(motorEstado(motor).posicion).toBeCloseTo(posAlCortar, 6)
    expect(motorEstado(motor).accionada).toBe(false)
  })
})

describe('sensor de paso', () => {
  it('dispara un pulso separado en cada vuelta, incluso girando rápido', () => {
    // 2 vueltas/s con un pulso de 0.3 s: el pulso dura menos que media vuelta,
    // así que no se puede confundir con "queda encendido todo el rato".
    const motor = new Motor(circuitoMotor({ velocidad: 2 }))
    motor.accionar('V1', true)
    let vecesActivado = 0
    let anterior = false
    const ticks = Math.round(10 / DT_POR_DEFECTO) // 10 s ≈ 20 vueltas
    for (let i = 0; i < ticks; i++) {
      motor.tick()
      const activo = sensorEstado(motor).accionada
      if (activo && !anterior) vecesActivado++
      anterior = activo
    }
    // ~20 vueltas ⇒ ~20 pulsos; se deja margen amplio por el arranque.
    expect(vecesActivado).toBeGreaterThan(10)
    expect(vecesActivado).toBeLessThan(25)
  })

  it('sin motor asignado nunca se acciona', () => {
    const motor = new Motor(circuitoMotor({}, { motor: '' }))
    motor.accionar('V1', true)
    motor.simular(3)
    expect(sensorEstado(motor).accionada).toBe(false)
  })

  it('respeta el punto de disparo elegido (a mitad de vuelta) y no dispara dos veces por vuelta', () => {
    const motor = new Motor(circuitoMotor({ velocidad: 1 }, { puntoDisparo: 0.5 }))
    motor.accionar('V1', true)
    let vecesActivado = 0
    let anterior = false
    const ticks = Math.round(5 / DT_POR_DEFECTO) // 5 s a 1 vuelta/s ⇒ 5 vueltas
    for (let i = 0; i < ticks; i++) {
      motor.tick()
      const activo = sensorEstado(motor).accionada
      if (activo && !anterior) vecesActivado++
      anterior = activo
    }
    expect(vecesActivado).toBeGreaterThanOrEqual(4)
    expect(vecesActivado).toBeLessThanOrEqual(6)
  })
})
