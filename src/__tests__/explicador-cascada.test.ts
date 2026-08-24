/**
 * El explicador animado no puede contradecir a la teoría: estas pruebas fijan
 * lo que debe verse en cada paso.
 */
import { describe, expect, it } from 'vitest'
import { PASOS, estadoDelPaso } from '../components/ExplicadorCascada'

describe('explicador · con cascada', () => {
  it('en ningún paso se bloquea una válvula', () => {
    for (const paso of PASOS.conCascada) {
      const e = estadoDelPaso(paso, true)
      expect(e.choqueA, `paso: ${paso.texto.slice(0, 40)}`).toBe(false)
      expect(e.choqueB, `paso: ${paso.texto.slice(0, 40)}`).toBe(false)
    }
  })

  it('nunca hay dos líneas de grupo con aire a la vez', () => {
    for (const paso of PASOS.conCascada) {
      const e = estadoDelPaso(paso, true)
      expect(e.lineaViva('L1') && e.lineaViva('L2')).toBe(false)
    }
  })

  it('el paso clave enseña justo lo que tiene que enseñar', () => {
    const clave = PASOS.conCascada.find((p) => p.clave)
    expect(clave).toBeDefined()
    const e = estadoDelPaso(clave!, true)
    // a1 está pisado…
    expect(e.pisado.a1).toBe(true)
    // …pero su línea está muerta, así que NO manda
    expect(e.lineaViva('L1')).toBe(false)
    expect(e.ordenes['B+']).toBe(false)
    // y por eso B puede volver
    expect(e.ordenes['B−']).toBe(true)
  })

  it('el primer movimiento de cada grupo lo manda su línea, no un rodillo', () => {
    const conL1 = PASOS.conCascada.filter((p) => p.linea === 'L1')
    const conL2 = PASOS.conCascada.filter((p) => p.linea === 'L2')
    expect(conL1.every((p) => estadoDelPaso(p, true).ordenes['A+'])).toBe(true)
    expect(conL2.every((p) => estadoDelPaso(p, true).ordenes['B−'])).toBe(true)
  })
})

describe('explicador · sin cascada', () => {
  it('al pulsar marcha llegan dos órdenes opuestas a la válvula de A', () => {
    const conMarcha = PASOS.sinCascada.filter((p) => p.marcha)
    expect(conMarcha.length).toBeGreaterThan(0)
    for (const paso of conMarcha) {
      const e = estadoDelPaso(paso, false)
      expect(e.ordenes['A+']).toBe(true)
      expect(e.ordenes['A−']).toBe(true)
      expect(e.choqueA).toBe(true)
    }
  })

  it('antes de pulsar marcha todavía no hay choque', () => {
    const enReposo = PASOS.sinCascada.find((p) => !p.marcha)!
    expect(estadoDelPaso(enReposo, false).choqueA).toBe(false)
  })
})
