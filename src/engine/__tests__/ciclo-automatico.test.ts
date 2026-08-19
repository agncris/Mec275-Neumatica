/**
 * Circuitos del temario de MEC275 que usan finales de carrera y válvulas
 * lógicas: ciclo automático ida-vuelta, mando bimanual y marcha desde dos
 * puestos.
 */
import { describe, expect, it } from 'vitest'
import { Motor } from '../motor'
import type { Circuito, RefPuerto } from '../tipos'
import type { EstadoCilindroDoble, EstadoFinalCarrera } from '../componentes'

const ref = (componente: string, puerto: string): RefPuerto => ({ componente, puerto })
const cil = (motor: Motor, id = 'C1') => motor.estadoDe<EstadoCilindroDoble>(id)

// ---------------------------------------------------------------------------
// Ciclo automático: 5/2 biestable pilotada por dos finales de carrera.
// Al llegar el vástago a un extremo, su rodillo pilota la válvula al otro lado.
// ---------------------------------------------------------------------------
function circuitoCicloAutomatico(): Circuito {
  return {
    componentes: [
      { id: 'F1', tipo: 'fuente', params: { presion: 6 } },
      { id: 'V1', tipo: 'valvula52', params: { modo: 'biestable' } },
      { id: 'C1', tipo: 'cilindroDobleEfecto' },
      // S1 pisado con el vástago retraído → pilota 14 (avance)
      { id: 'S1', tipo: 'finalCarrera', params: { cilindro: 'C1', puntoDisparo: 0, reposo: 'NC' } },
      // S2 pisado con el vástago extendido → pilota 12 (retorno)
      { id: 'S2', tipo: 'finalCarrera', params: { cilindro: 'C1', puntoDisparo: 1, reposo: 'NC' } },
    ],
    mangueras: [
      { id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') },
      { id: 'm2', a: ref('F1', '1'), b: ref('S1', '1') },
      { id: 'm3', a: ref('F1', '1'), b: ref('S2', '1') },
      { id: 'm4', a: ref('S1', '2'), b: ref('V1', '14') },
      { id: 'm5', a: ref('S2', '2'), b: ref('V1', '12') },
      { id: 'm6', a: ref('V1', '4'), b: ref('C1', 'A') },
      { id: 'm7', a: ref('V1', '2'), b: ref('C1', 'B') },
    ],
  }
}

describe('ciclo automático con finales de carrera', () => {
  it('el rodillo se acciona cuando el vástago llega a su punto de disparo', () => {
    const motor = new Motor(circuitoCicloAutomatico())
    motor.tick()
    // Arranca retraído: S1 pisado, S2 libre
    expect(motor.estadoDe<EstadoFinalCarrera>('S1').accionada).toBe(true)
    expect(motor.estadoDe<EstadoFinalCarrera>('S2').accionada).toBe(false)
  })

  it('arranca solo y oscila entre los dos finales de carrera', () => {
    const motor = new Motor(circuitoCicloAutomatico())
    motor.simular(6)
    // Debe haber conmutado varias veces en ambos sentidos
    const conmutaciones = motor.eventos.filter((e) => e.componente === 'V1' && e.tipo === 'conmutacion')
    expect(conmutaciones.length).toBeGreaterThanOrEqual(4)
    const extendidos = motor.eventos.filter((e) => e.componente === 'C1' && e.tipo === 'extendido')
    const reposos = motor.eventos.filter((e) => e.componente === 'C1' && e.tipo === 'reposo')
    expect(extendidos.length).toBeGreaterThanOrEqual(2)
    expect(reposos.length).toBeGreaterThanOrEqual(1)
  })

  it('al cortar el aire el ciclo se detiene', () => {
    const motor = new Motor(circuitoCicloAutomatico())
    motor.simular(3)
    motor.setParametro('F1', 'encendida', false)
    motor.simular(2)
    const nEventos = motor.eventos.length
    motor.simular(3)
    expect(motor.eventos.length).toBe(nEventos)
  })
})

// ---------------------------------------------------------------------------
// Mando bimanual: dos pulsadores + válvula de simultaneidad "Y".
// ---------------------------------------------------------------------------
function circuitoBimanual(): Circuito {
  return {
    componentes: [
      { id: 'F1', tipo: 'fuente', params: { presion: 6 } },
      { id: 'P1', tipo: 'valvula32', params: { reposo: 'NC' } },
      { id: 'P2', tipo: 'valvula32', params: { reposo: 'NC' } },
      { id: 'Y1', tipo: 'valvulaY' },
      { id: 'V1', tipo: 'valvula52', params: { modo: 'monoestable', accionamiento: 'pilotaje' } },
      { id: 'C1', tipo: 'cilindroDobleEfecto' },
    ],
    mangueras: [
      { id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') },
      { id: 'm2', a: ref('F1', '1'), b: ref('P1', '1') },
      { id: 'm3', a: ref('F1', '1'), b: ref('P2', '1') },
      { id: 'm4', a: ref('P1', '2'), b: ref('Y1', 'X') },
      { id: 'm5', a: ref('P2', '2'), b: ref('Y1', 'Y') },
      { id: 'm6', a: ref('Y1', 'A'), b: ref('V1', '14') },
      { id: 'm7', a: ref('V1', '4'), b: ref('C1', 'A') },
      { id: 'm8', a: ref('V1', '2'), b: ref('C1', 'B') },
    ],
  }
}

describe('mando bimanual con válvula de simultaneidad «Y»', () => {
  it('con un solo pulsador el cilindro NO avanza', () => {
    const motor = new Motor(circuitoBimanual())
    motor.accionar('P1', true)
    motor.simular(2)
    expect(motor.presionEn('V1', '14')).toBeLessThan(1)
    expect(cil(motor).posicion).toBe(0)
  })

  it('con el otro pulsador solo, tampoco', () => {
    const motor = new Motor(circuitoBimanual())
    motor.accionar('P2', true)
    motor.simular(2)
    expect(cil(motor).posicion).toBe(0)
  })

  it('con los dos a la vez el cilindro avanza', () => {
    const motor = new Motor(circuitoBimanual())
    motor.accionar('P1', true)
    motor.accionar('P2', true)
    motor.simular(2)
    expect(motor.presionEn('V1', '14')).toBeGreaterThan(5)
    expect(cil(motor).posicion).toBe(1)
  })

  it('NO da un tirón falso al pulsar una sola entrada (seguridad)', () => {
    const motor = new Motor(circuitoBimanual())
    // Primero dejamos el circuito en reposo un rato, como en el uso real:
    // así la bola ya está colocada cuando llega la señal.
    motor.simular(1)
    motor.accionar('P1', true)
    for (let i = 0; i < 90; i++) {
      motor.tick()
      expect(cil(motor).posicion).toBe(0)
    }
    // Y tampoco al revés, soltando y pulsando la otra
    motor.accionar('P1', false)
    motor.simular(1)
    motor.accionar('P2', true)
    for (let i = 0; i < 90; i++) {
      motor.tick()
      expect(cil(motor).posicion).toBe(0)
    }
  })

  it('soltar uno de los dos purga la señal y el cilindro retorna', () => {
    const motor = new Motor(circuitoBimanual())
    motor.accionar('P1', true)
    motor.accionar('P2', true)
    motor.simular(2)
    expect(cil(motor).posicion).toBe(1)

    motor.accionar('P2', false)
    motor.simular(2)
    expect(motor.presionEn('V1', '14')).toBeLessThan(1)
    expect(cil(motor).posicion).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Marcha desde dos puestos: válvula selectora "O".
// ---------------------------------------------------------------------------
function circuitoSelectora(): Circuito {
  return {
    componentes: [
      { id: 'F1', tipo: 'fuente', params: { presion: 6 } },
      { id: 'P1', tipo: 'valvula32', params: { reposo: 'NC' } },
      { id: 'P2', tipo: 'valvula32', params: { reposo: 'NC' } },
      { id: 'O1', tipo: 'valvulaO' },
      { id: 'C1', tipo: 'cilindroSimpleEfecto' },
    ],
    mangueras: [
      { id: 'm1', a: ref('F1', '1'), b: ref('P1', '1') },
      { id: 'm2', a: ref('F1', '1'), b: ref('P2', '1') },
      { id: 'm3', a: ref('P1', '2'), b: ref('O1', 'X') },
      { id: 'm4', a: ref('P2', '2'), b: ref('O1', 'Y') },
      { id: 'm5', a: ref('O1', 'A'), b: ref('C1', '1') },
    ],
  }
}

describe('marcha desde dos puestos con válvula selectora «O»', () => {
  it('cualquiera de los dos pulsadores hace avanzar el cilindro', () => {
    for (const pulsador of ['P1', 'P2']) {
      const motor = new Motor(circuitoSelectora())
      motor.accionar(pulsador, true)
      motor.simular(2)
      expect(motor.estadoDe<{ posicion: number }>('C1').posicion).toBe(1)
    }
  })

  it('al soltar, el cilindro retorna purgando por el pulsador activo', () => {
    const motor = new Motor(circuitoSelectora())
    motor.accionar('P1', true)
    motor.simular(2)
    motor.accionar('P1', false)
    motor.simular(2)
    expect(motor.estadoDe<{ posicion: number }>('C1').posicion).toBe(0)
  })

  it('no hay cortocircuito: el aire no se fuga por el pulsador en reposo', () => {
    const motor = new Motor(circuitoSelectora())
    motor.accionar('P1', true)
    motor.simular(1)
    expect(motor.advertencias).toEqual([])
    expect(motor.presionEn('C1', '1')).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// Escape rápido y temporizador.
// ---------------------------------------------------------------------------
describe('válvula de escape rápido', () => {
  const circuito = (conEscape: boolean): Circuito => {
    const componentes: Circuito['componentes'] = [
      { id: 'F1', tipo: 'fuente', params: { presion: 6 } },
      { id: 'V1', tipo: 'valvula32', params: { reposo: 'NC' } },
      { id: 'C1', tipo: 'cilindroSimpleEfecto', params: { velocidadRetorno: 1 } },
    ]
    const mangueras: Circuito['mangueras'] = [{ id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') }]
    if (conEscape) {
      componentes.push({ id: 'E1', tipo: 'escapeRapido' })
      mangueras.push(
        { id: 'm2', a: ref('V1', '2'), b: ref('E1', '1') },
        { id: 'm3', a: ref('E1', '2'), b: ref('C1', '1') },
      )
    } else {
      mangueras.push({ id: 'm2', a: ref('V1', '2'), b: ref('C1', '1') })
    }
    return { componentes, mangueras }
  }

  it('alimenta normalmente el actuador cuando hay presión de entrada', () => {
    const motor = new Motor(circuito(true))
    motor.accionar('V1', true)
    motor.simular(2)
    expect(motor.presionEn('C1', '1')).toBe(6)
    expect(motor.estadoDe<{ posicion: number }>('C1').posicion).toBe(1)
  })

  it('al soltar, purga el actuador por su propio escape', () => {
    const motor = new Motor(circuito(true))
    motor.accionar('V1', true)
    motor.simular(2)
    motor.accionar('V1', false)
    motor.simular(2)
    expect(motor.estadoDe<{ posicion: number }>('C1').posicion).toBe(0)
    expect(motor.eventos.some((e) => e.componente === 'E1' && e.tipo === 'purga')).toBe(true)
  })
})

describe('temporizador neumático', () => {
  const circuito = (retardo: number): Circuito => ({
    componentes: [
      { id: 'F1', tipo: 'fuente', params: { presion: 6 } },
      { id: 'P1', tipo: 'valvula32', params: { reposo: 'NC' } },
      { id: 'T1', tipo: 'temporizador', params: { retardo } },
      { id: 'C1', tipo: 'cilindroSimpleEfecto' },
    ],
    mangueras: [
      { id: 'm1', a: ref('F1', '1'), b: ref('P1', '1') },
      { id: 'm2', a: ref('F1', '1'), b: ref('T1', '1') },
      { id: 'm3', a: ref('P1', '2'), b: ref('T1', '12') },
      { id: 'm4', a: ref('T1', '2'), b: ref('C1', '1') },
    ],
  })

  it('no conmuta antes de cumplirse el retardo', () => {
    const motor = new Motor(circuito(2))
    motor.accionar('P1', true)
    motor.simular(1.5)
    expect(motor.presionEn('C1', '1')).toBe(0)
  })

  it('conmuta al cumplirse el retardo', () => {
    const motor = new Motor(circuito(2))
    motor.accionar('P1', true)
    motor.simular(2.5)
    expect(motor.presionEn('C1', '1')).toBe(6)
    expect(motor.eventos.some((e) => e.tipo === 'temporizado')).toBe(true)
  })

  it('si el pilotaje se interrumpe, la cuenta se reinicia', () => {
    const motor = new Motor(circuito(2))
    motor.accionar('P1', true)
    motor.simular(1.5)
    motor.accionar('P1', false)
    motor.simular(0.5)
    motor.accionar('P1', true)
    motor.simular(1.5) // sólo 1.5 s desde el reinicio: aún no debe conmutar
    expect(motor.presionEn('C1', '1')).toBe(0)
  })
})
