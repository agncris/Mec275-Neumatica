/**
 * Tests de los componentes de la pizarra: cilindro de doble efecto, válvula
 * 5/2 (monoestable y biestable con pilotaje) y regulador de caudal.
 */
import { describe, expect, it } from 'vitest'
import { Motor } from '../motor'
import type { Circuito, RefPuerto } from '../tipos'
import type { EstadoCilindroDoble, EstadoValvula52 } from '../componentes'

const ref = (componente: string, puerto: string): RefPuerto => ({ componente, puerto })

/** fuente → 5/2 monoestable → cilindro doble efecto (4→A avance, 2→B retorno) */
function circuitoDobleEfecto(extra?: {
  reguladorEnB?: number // apertura del regulador instalado entre V1:2 y C1:B
}): Circuito {
  const componentes: Circuito['componentes'] = [
    { id: 'F1', tipo: 'fuente', params: { presion: 6 } },
    { id: 'V1', tipo: 'valvula52', params: { modo: 'monoestable', accionamiento: 'pulsador' } },
    { id: 'C1', tipo: 'cilindroDobleEfecto' },
  ]
  const mangueras: Circuito['mangueras'] = [
    { id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') },
    { id: 'm2', a: ref('V1', '4'), b: ref('C1', 'A') },
  ]
  if (extra?.reguladorEnB !== undefined) {
    componentes.push({ id: 'R1', tipo: 'reguladorCaudal', params: { apertura: extra.reguladorEnB } })
    // Estrangulado 1→2 (desde B hacia la válvula = escape del avance),
    // libre 2→1 (llenado de B durante el retorno).
    mangueras.push(
      { id: 'm3', a: ref('C1', 'B'), b: ref('R1', '1') },
      { id: 'm4', a: ref('R1', '2'), b: ref('V1', '2') },
    )
  } else {
    mangueras.push({ id: 'm3', a: ref('V1', '2'), b: ref('C1', 'B') })
  }
  return { componentes, mangueras }
}

const cilindro = (motor: Motor) => motor.estadoDe<EstadoCilindroDoble>('C1')

describe('cilindro de doble efecto con válvula 5/2 monoestable', () => {
  it('en reposo la cámara B está presurizada y el vástago retraído', () => {
    const motor = new Motor(circuitoDobleEfecto())
    motor.simular(1)
    expect(motor.presionEn('C1', 'B')).toBe(6)
    expect(motor.presionEn('C1', 'A')).toBe(0)
    expect(cilindro(motor).posicion).toBe(0)
  })

  it('al accionar avanza (1→4) y al soltar retorna (1→2)', () => {
    const motor = new Motor(circuitoDobleEfecto())
    motor.accionar('V1', true)
    motor.simular(2)
    expect(motor.presionEn('C1', 'A')).toBe(6)
    expect(cilindro(motor).posicion).toBe(1)

    motor.accionar('V1', false)
    motor.simular(2)
    expect(cilindro(motor).posicion).toBe(0)
  })

  it('si la cámara contraria no puede escapar, el pistón se bloquea', () => {
    const circuito = circuitoDobleEfecto()
    // Quitamos la manguera de B: el aire de B queda atrapado… pero B sin
    // manguera queda a 0 bar desde el inicio, así que para bloquear de verdad
    // tapamos el escape 3 conectándolo a un puerto ciego (el pilotaje 12).
    circuito.mangueras.push({ id: 'mX', a: ref('V1', '3'), b: ref('V1', '12') })
    const motor = new Motor(circuito)
    motor.accionar('V1', true)
    motor.simular(2)
    // El aire entra por A pero B no puede vaciarse a través de 2→3 tapado.
    expect(cilindro(motor).posicion).toBe(0)
  })
})

describe('regulador de caudal unidireccional (control de velocidad)', () => {
  it('estrangular el escape de B frena el avance, pero no el retorno', () => {
    const conRegulador = new Motor(circuitoDobleEfecto({ reguladorEnB: 0.25 }))
    const sinRegulador = new Motor(circuitoDobleEfecto())

    conRegulador.accionar('V1', true)
    sinRegulador.accionar('V1', true)
    conRegulador.simular(2)
    sinRegulador.simular(2)

    // Sin regulador el avance tarda ~1.25 s; con apertura 0.25 tarda ~5 s.
    expect(sinRegulador.estadoDe<EstadoCilindroDoble>('C1').posicion).toBe(1)
    const posConRegulador = conRegulador.estadoDe<EstadoCilindroDoble>('C1').posicion
    expect(posConRegulador).toBeGreaterThan(0.2)
    expect(posConRegulador).toBeLessThan(0.7)

    // El retorno usa el antirretorno (paso libre hacia B): velocidad normal.
    conRegulador.simular(4) // termina de extender
    expect(conRegulador.estadoDe<EstadoCilindroDoble>('C1').posicion).toBe(1)
    conRegulador.accionar('V1', false)
    conRegulador.simular(1.5)
    expect(conRegulador.estadoDe<EstadoCilindroDoble>('C1').posicion).toBe(0)
  })
})

describe('válvula 5/2 biestable con pilotaje neumático', () => {
  /** Dos 3/2 de pulsador pilotan 14 (avance) y 12 (retorno) de una biestable. */
  function circuitoBiestable(): Circuito {
    return {
      componentes: [
        { id: 'F1', tipo: 'fuente', params: { presion: 6 } },
        { id: 'P14', tipo: 'valvula32', params: { reposo: 'NC' } },
        { id: 'P12', tipo: 'valvula32', params: { reposo: 'NC' } },
        { id: 'V1', tipo: 'valvula52', params: { modo: 'biestable' } },
        { id: 'C1', tipo: 'cilindroDobleEfecto' },
      ],
      mangueras: [
        { id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') },
        { id: 'm2', a: ref('F1', '1'), b: ref('P14', '1') },
        { id: 'm3', a: ref('F1', '1'), b: ref('P12', '1') },
        { id: 'm4', a: ref('P14', '2'), b: ref('V1', '14') },
        { id: 'm5', a: ref('P12', '2'), b: ref('V1', '12') },
        { id: 'm6', a: ref('V1', '4'), b: ref('C1', 'A') },
        { id: 'm7', a: ref('V1', '2'), b: ref('C1', 'B') },
      ],
    }
  }

  it('un pulso en 14 la conmuta y queda en memoria al soltar', () => {
    const motor = new Motor(circuitoBiestable())
    motor.accionar('P14', true)
    motor.simular(0.2)
    motor.accionar('P14', false) // pulso corto
    motor.simular(2)
    // La biestable recuerda la posición: el cilindro sigue avanzando/extendido
    expect(motor.estadoDe<EstadoValvula52>('V1').accionada).toBe(true)
    expect(motor.estadoDe<EstadoCilindroDoble>('C1').posicion).toBe(1)

    motor.accionar('P12', true)
    motor.simular(0.2)
    motor.accionar('P12', false)
    motor.simular(2)
    expect(motor.estadoDe<EstadoValvula52>('V1').accionada).toBe(false)
    expect(motor.estadoDe<EstadoCilindroDoble>('C1').posicion).toBe(0)
  })

  it('pilotada por ambos lados a la vez no conmuta y avisa del conflicto', () => {
    const motor = new Motor(circuitoBiestable())
    motor.accionar('P14', true)
    motor.accionar('P12', true)
    motor.simular(1)
    expect(motor.estadoDe<EstadoValvula52>('V1').accionada).toBe(false)
    expect(motor.eventos.some((e) => e.tipo === 'conflicto')).toBe(true)
  })
})
