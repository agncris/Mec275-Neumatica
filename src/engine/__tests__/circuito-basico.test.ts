/**
 * Test end-to-end del paso 1:
 * fuente (6 bar) → válvula 3/2 NC con pulsador → cilindro de simple efecto.
 * Al pulsar, el vástago avanza; al soltar, retorna por muelle.
 */
import { describe, expect, it } from 'vitest'
import { Motor } from '../motor'
import type { Circuito, RefPuerto } from '../tipos'
import type { EstadoCilindroSimple } from '../componentes'

const ref = (componente: string, puerto: string): RefPuerto => ({ componente, puerto })

function circuitoBasico(): Circuito {
  return {
    componentes: [
      { id: 'F1', tipo: 'fuente', params: { presion: 6 } },
      { id: 'V1', tipo: 'valvula32', params: { reposo: 'NC', accionamiento: 'pulsador' } },
      { id: 'C1', tipo: 'cilindroSimpleEfecto' },
    ],
    mangueras: [
      { id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') },
      { id: 'm2', a: ref('V1', '2'), b: ref('C1', '1') },
    ],
  }
}

const cilindro = (motor: Motor) => motor.estadoDe<EstadoCilindroSimple>('C1')

describe('circuito básico: fuente → 3/2 NC pulsador → cilindro simple efecto', () => {
  it('en reposo el cilindro permanece retraído y sin presión', () => {
    const motor = new Motor(circuitoBasico())
    motor.simular(1)
    expect(cilindro(motor).posicion).toBe(0)
    expect(motor.presionEn('C1', '1')).toBe(0)
    // La presión sí llega hasta la entrada de la válvula
    expect(motor.presionEn('V1', '1')).toBe(6)
    expect(motor.advertencias).toEqual([])
  })

  it('al pulsar, la válvula conmuta y el vástago avanza hasta el final de carrera', () => {
    const motor = new Motor(circuitoBasico())
    motor.simular(0.5)
    motor.accionar('V1', true)
    motor.simular(2)
    expect(motor.presionEn('C1', '1')).toBe(6)
    expect(cilindro(motor).posicion).toBe(1)
    expect(cilindro(motor).fase).toBe('extendido')

    const tipos = motor.eventos.map((e) => e.tipo)
    expect(tipos).toContain('conmutacion')
    expect(tipos).toContain('avanzando')
    expect(tipos).toContain('extendido')
  })

  it('al soltar, el muelle retorna el vástago y la cámara se despresuriza por el escape', () => {
    const motor = new Motor(circuitoBasico())
    motor.accionar('V1', true)
    motor.simular(2)
    expect(cilindro(motor).posicion).toBe(1)

    motor.accionar('V1', false)
    motor.simular(2)
    expect(motor.presionEn('C1', '1')).toBe(0)
    expect(cilindro(motor).posicion).toBe(0)
    expect(cilindro(motor).fase).toBe('reposo')
  })

  it('soporta ciclos repetidos de pulsar y soltar', () => {
    const motor = new Motor(circuitoBasico())
    for (let ciclo = 0; ciclo < 3; ciclo++) {
      motor.accionar('V1', true)
      motor.simular(2)
      expect(cilindro(motor).posicion).toBe(1)
      motor.accionar('V1', false)
      motor.simular(2)
      expect(cilindro(motor).posicion).toBe(0)
    }
  })

  it('sin aire (fuente apagada) el cilindro no se mueve aunque se pulse', () => {
    const motor = new Motor(circuitoBasico())
    motor.setParametro('F1', 'encendida', false)
    motor.accionar('V1', true)
    motor.simular(2)
    expect(motor.presionEn('C1', '1')).toBe(0)
    expect(cilindro(motor).posicion).toBe(0)
  })

  it('con presión insuficiente para vencer el muelle, el vástago no avanza', () => {
    const motor = new Motor(circuitoBasico())
    motor.setParametro('F1', 'presion', 1) // muelle por defecto: 1.5 bar
    motor.accionar('V1', true)
    motor.simular(2)
    expect(motor.presionEn('C1', '1')).toBe(1)
    expect(cilindro(motor).posicion).toBe(0)
  })

  it('si se corta el aire con el cilindro extendido, el vástago retorna (el FRL ventea)', () => {
    const motor = new Motor(circuitoBasico())
    motor.accionar('V1', true)
    motor.simular(2)
    expect(cilindro(motor).posicion).toBe(1)

    motor.setParametro('F1', 'encendida', false)
    motor.simular(2)
    expect(cilindro(motor).posicion).toBe(0)
  })

  it('la velocidad de avance responde al factor de caudal del camino', () => {
    // Mismo circuito, pero comparamos tiempo de carrera con caudal pleno vs
    // el mismo motor: sirve como línea base para el regulador de caudal (paso 3).
    const motor = new Motor(circuitoBasico())
    motor.accionar('V1', true)
    motor.simular(0.5)
    const posMedia = motor.estadoDe<EstadoCilindroSimple>('C1').posicion
    expect(posMedia).toBeGreaterThan(0.2)
    expect(posMedia).toBeLessThan(0.7)
  })
})
