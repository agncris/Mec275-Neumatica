import { describe, expect, it } from 'vitest'
import { interpretar } from '../cnc/gcode'
import { CONFIG_INICIAL, almacenDe, origenPrograma, posicionCasa, type ConfigCNC } from '../cnc/maquinas'
import { SimuladorCNC, altoMordaza } from '../cnc/simulador'

const config: ConfigCNC = { ...CONFIG_INICIAL, maquina: 'fresadora', fresa: { largo: 100, ancho: 80, alto: 20 }, material: 'aluminio' }

function correr(z: number, y: number) {
  const codigo = `%
G21 G90 G17
T1 M06
S2000 M03
G00 X-10 Y${y} Z5
G01 Z${z} F200
G01 X110 F300
G00 Z20
M05
M30
%`
  const casa = posicionCasa(config)
  const radio = (t: number) => {
    const h = almacenDe(config).find((x) => x.t === t)
    return h ? h.diametro / 2 : undefined
  }
  const sim = new SimuladorCNC(interpretar(codigo, 'fresadora', casa, { origen: origenPrograma(config, codigo).origen, radio }), config, casa)
  sim.terminar()
  return sim
}

describe('fresadora: la prensa', () => {
  it('las mordazas toman la parte baja del bruto', () => {
    expect(altoMordaza(20)).toBe(12)
    expect(altoMordaza(4)).toBe(1)
  })

  it('por fuera del canto, sobre el borde de la mordaza, se puede pasar', () => {
    const sim = correr(-6, -5)
    expect(sim.alarma).toBeNull()
  })

  it('por fuera del canto, más abajo que el borde de la mordaza, choca', () => {
    const sim = correr(-12, -5)
    expect(sim.alarma?.texto).toMatch(/mordaza/)
  })

  it('lejos de la prensa no hay choque', () => {
    const sim = correr(-12, -40)
    expect(sim.alarma?.texto ?? '').not.toMatch(/mordaza/)
  })

  it('dentro de la pieza se puede bajar más que la mordaza', () => {
    const sim = correr(-6, 40)
    expect(sim.alarma).toBeNull()
  })
})
