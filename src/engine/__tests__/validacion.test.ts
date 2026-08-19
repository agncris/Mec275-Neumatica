import { describe, expect, it } from 'vitest'
import { Motor } from '../motor'
import { validarCircuito } from '../validacion'
import type { Circuito, RefPuerto } from '../tipos'
import type { EstadoCilindroSimple } from '../componentes'

const ref = (componente: string, puerto: string): RefPuerto => ({ componente, puerto })

describe('validación y errores comunes', () => {
  it('detecta puertos sin conectar', () => {
    const circuito: Circuito = {
      componentes: [
        { id: 'F1', tipo: 'fuente' },
        { id: 'V1', tipo: 'valvula32' },
        { id: 'C1', tipo: 'cilindroSimpleEfecto' },
      ],
      // Falta la manguera válvula → cilindro
      mangueras: [{ id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') }],
    }
    const mensajes = validarCircuito(circuito)
    expect(mensajes.some((m) => m.includes('puerto 2 de V1'))).toBe(true)
    expect(mensajes.some((m) => m.includes('puerto 1 de C1'))).toBe(true)

    // Y físicamente: al pulsar no le llega aire al cilindro
    const motor = new Motor(circuito)
    motor.accionar('V1', true)
    motor.simular(2)
    expect(motor.estadoDe<EstadoCilindroSimple>('C1').posicion).toBe(0)
  })

  it('un circuito completo no genera mensajes', () => {
    const circuito: Circuito = {
      componentes: [
        { id: 'F1', tipo: 'fuente' },
        { id: 'V1', tipo: 'valvula32' },
        { id: 'C1', tipo: 'cilindroSimpleEfecto' },
      ],
      mangueras: [
        { id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') },
        { id: 'm2', a: ref('V1', '2'), b: ref('C1', '1') },
      ],
    }
    expect(validarCircuito(circuito)).toEqual([])
  })

  it('advierte el cortocircuito presión→escape durante la simulación', () => {
    // Error de cableado típico: la fuente conectada a la salida de trabajo (2)
    // de una 3/2 NC. En reposo la válvula une 2→3, así que el aire de la
    // fuente se va directo al escape sin hacer trabajo.
    const circuito: Circuito = {
      componentes: [
        { id: 'F1', tipo: 'fuente' },
        { id: 'V1', tipo: 'valvula32', params: { reposo: 'NC' } },
      ],
      mangueras: [{ id: 'm1', a: ref('F1', '1'), b: ref('V1', '2') }],
    }
    const motor = new Motor(circuito)
    motor.tick()
    expect(motor.advertencias.some((a) => a.includes('Cortocircuito'))).toBe(true)
    // Y en la zona de fuga no se acumula presión
    expect(motor.presionEn('V1', '2')).toBe(0)
  })
})
