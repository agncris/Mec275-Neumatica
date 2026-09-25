/**
 * Válvula 3/2 pilotada (12 en la NC, 10 en la NA) y letras de los actuadores.
 * Una señal de aire en el pilotaje conmuta la 3/2; al desaparecer, el muelle
 * la devuelve a reposo.
 */
import { describe, expect, it } from 'vitest'
import { Motor } from '../motor'
import { analizarCircuito } from '../analisis'
import { letraActuador, type Circuito, type RefPuerto } from '../tipos'
import type { EstadoCilindroSimple } from '../componentes'

const ref = (componente: string, puerto: string): RefPuerto => ({ componente, puerto })

/** Un pulsador (V1) pilota una 3/2 (V2) que alimenta un cilindro de simple efecto. */
function circuito(reposo: 'NC' | 'NA'): Circuito {
  const piloto = reposo === 'NA' ? '10' : '12'
  return {
    componentes: [
      { id: 'F1', tipo: 'fuente', params: { presion: 6 } },
      { id: 'V1', tipo: 'valvula32', params: { reposo: 'NC', accionamiento: 'pulsador' } },
      { id: 'V2', tipo: 'valvula32', params: { reposo, accionamiento: 'pilotaje' } },
      { id: 'C1', tipo: 'cilindroSimpleEfecto' },
    ],
    mangueras: [
      { id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') },
      { id: 'm2', a: ref('F1', '1'), b: ref('V2', '1') },
      { id: 'm3', a: ref('V1', '2'), b: ref('V2', piloto) },
      { id: 'm4', a: ref('V2', '2'), b: ref('C1', '1') },
    ],
  }
}

const posicion = (m: Motor) => m.estadoDe<EstadoCilindroSimple>('C1').posicion

describe('válvula 3/2 pilotada', () => {
  it('NC: sin señal en 12 queda cerrada; con señal abre 1→2 y el cilindro avanza', () => {
    const m = new Motor(circuito('NC'))
    m.simular(1)
    expect(posicion(m)).toBe(0)
    m.accionar('V1', true)
    m.simular(2)
    expect(posicion(m)).toBe(1)
  })

  it('NC: al desaparecer la señal, el muelle la devuelve y el cilindro retorna', () => {
    const m = new Motor(circuito('NC'))
    m.accionar('V1', true)
    m.simular(2)
    m.accionar('V1', false)
    m.simular(2)
    expect(posicion(m)).toBe(0)
  })

  it('NA: alimenta en reposo y la señal en 10 corta el paso', () => {
    const m = new Motor(circuito('NA'))
    m.simular(2)
    expect(posicion(m)).toBe(1)
    m.accionar('V1', true)
    m.simular(2)
    expect(posicion(m)).toBe(0)
  })

  it('la 3/2 pilotada no cuenta como mando manual de marcha', () => {
    const a = analizarCircuito(circuito('NC'), { segundos: 3 })
    expect(a.mandosManuales).toEqual(['V1'])
  })
})

describe('letras de los actuadores', () => {
  const comps = [
    { id: 'C1', tipo: 'cilindroDobleEfecto' },
    { id: 'G1', tipo: 'actuadorGiratorio', params: { letra: 'A' } },
    { id: 'M1', tipo: 'motorNeumatico' },
    { id: 'V1', tipo: 'valvula52' },
  ]
  it('respeta la letra elegida y reparte las demás por orden, sin repetir', () => {
    expect(letraActuador('G1', comps)).toBe('A')
    expect(letraActuador('C1', comps)).toBe('B')
    expect(letraActuador('M1', comps)).toBe('C')
  })
})
