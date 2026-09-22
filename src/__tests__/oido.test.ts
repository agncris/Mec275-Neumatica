/**
 * El oído del banco 3D: qué suena y por dónde sale el aire en el laboratorio.
 */
import { describe, expect, it } from 'vitest'
import { Motor } from '../engine'
import { EJEMPLOS } from '../circuitos/ejemplos'
import { Oido, type Escucha } from '../vista3d/oido'

const motorDe = (n: 1 | 2) => {
  const e = EJEMPLOS[n]
  return new Motor({
    componentes: e.piezas.map((p) => ({ id: p.id, tipo: p.tipo, params: { ...p.params } })),
    mangueras: e.mangueras.map((m) => ({ id: m.id, a: { ...m.a }, b: { ...m.b } })),
  })
}

/** Avanza la simulación y junta todo lo que se ha oído. */
const durante = (motor: Motor, oido: Oido, segundos: number): Escucha[] => {
  const oido_: Escucha[] = []
  for (let i = 0; i < Math.round(segundos * 30); i++) {
    motor.tick()
    oido_.push(oido.escuchar())
  }
  return oido_
}

const salidas = (lista: Escucha[], rafaga: boolean) =>
  new Set(lista.flatMap((e) => e.salidas.filter((s) => s.rafaga === rafaga).map((s) => `${s.componente}:${s.puerto}`)))

describe('oído del banco', () => {
  it('en reposo, con el circuito quieto, no suena nada', () => {
    const motor = motorDe(2)
    const oido = new Oido(motor)
    const todo = durante(motor, oido, 1)
    expect(todo.flatMap((e) => [...e.golpes, ...e.salidas])).toEqual([])
  })

  it('5/2 con regulador: clic al pulsar, escape de B por el 3 al avanzar y golpe de tope', () => {
    const motor = motorDe(2)
    const oido = new Oido(motor)
    durante(motor, oido, 0.5)
    motor.accionar('V1', true)
    const ida = durante(motor, oido, 6)
    expect(ida[0].golpes).toContainEqual(expect.objectContaining({ tipo: 'valvula', componente: 'V1' }))
    // Mientras el vástago avanza, la cámara B se vacía por el regulador y sale por el 3.
    expect(salidas(ida, false)).toEqual(new Set(['V1:3']))
    expect(ida.flatMap((e) => e.golpes).filter((g) => g.tipo === 'tope' && g.componente === 'C1')).toHaveLength(1)
  })

  it('al soltar: la línea de A se descarga de golpe por el 5 y el cilindro retorna', () => {
    const motor = motorDe(2)
    const oido = new Oido(motor)
    motor.accionar('V1', true)
    durante(motor, oido, 6)
    motor.accionar('V1', false)
    const vuelta = durante(motor, oido, 6)
    expect(salidas(vuelta, true)).toContain('V1:5')
    expect(salidas(vuelta, false)).toEqual(new Set(['V1:5']))
    expect(vuelta.flatMap((e) => e.golpes).some((g) => g.tipo === 'tope')).toBe(true)
  })

  it('simple efecto: al soltar, el muelle devuelve el aire por el escape 3 de la 3/2', () => {
    const motor = motorDe(1)
    const oido = new Oido(motor)
    motor.accionar('V1', true)
    durante(motor, oido, 4)
    motor.accionar('V1', false)
    const vuelta = durante(motor, oido, 4)
    expect(salidas(vuelta, false)).toEqual(new Set(['V1:3']))
  })

  it('al cerrar la llave del FRL, el circuito se descarga por el propio FRL', () => {
    const motor = motorDe(1)
    const oido = new Oido(motor)
    motor.accionar('V1', true)
    durante(motor, oido, 4)
    motor.setParametro('F1', 'encendida', false)
    const tras = durante(motor, oido, 1)
    expect(tras.flatMap((e) => e.golpes)).toContainEqual(expect.objectContaining({ tipo: 'llave', componente: 'F1' }))
    expect(salidas(tras, true)).toContain('F1:1')
  })
})
