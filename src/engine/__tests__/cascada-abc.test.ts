/**
 * Test del circuito «Cascada de tres grupos A, B, C» (CASCADA_ABC):
 * verifica que el motor ejecuta la secuencia A+ B+ | B− A− C+ | C− en orden,
 * sin conflictos de pilotaje, con una sola línea de grupo presurizada a la vez
 * y que el ciclo se repite mientras se mantiene el START (y se detiene al
 * soltarlo).
 */
import { describe, expect, it } from 'vitest'
import { Motor } from '../motor'
import { validarCircuito } from '../validacion'
import { CASCADA_ABC } from '../../circuitos/cascada-abc'

const circuito = () => ({
  componentes: CASCADA_ABC.piezas.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    params: { ...p.params },
  })),
  mangueras: CASCADA_ABC.mangueras.map((m) => ({ ...m })),
})

const pos = (m: Motor, id: string) => m.estadoDe<{ posicion: number }>(id).posicion

/** Lee la presión del manómetro de una línea de grupo. */
const grupoVivo = (m: Motor, manometro: string) => m.presionEn(manometro, '1') > 0.1

describe('CASCADA_ABC: cascada de tres grupos A+ B+ | B− A− C+ | C−', () => {
  it('el circuito no tiene errores de montaje', () => {
    expect(validarCircuito(circuito())).toEqual([])
  })

  it('mantiene las etiquetas exactas de sensores, grupo y actuadores', () => {
    const ids = CASCADA_ABC.piezas.map((p) => p.id).sort()
    // Sensores y cilindros
    for (const s of ['A0', 'A1', 'B0', 'B1', 'C0', 'C1']) expect(ids).toContain(s)
    for (const c of ['CA', 'CB', 'CC']) expect(ids).toContain(c)
    // Manómetros de las líneas de grupo y las válvulas de cascada
    for (const g of ['G1', 'G2', 'G3']) expect(ids).toContain(g)
    for (const k of ['K1', 'K2']) expect(ids).toContain(k)
    expect(ids).toContain('START')
  })

  it('los tres manómetros están conectados a su línea de grupo', () => {
    const líneas: Record<string, { de: string; puerto: string }> = {
      G1: { de: 'K1', puerto: '2' },
      G2: { de: 'K1', puerto: '4' },
      G3: { de: 'K2', puerto: '4' },
    }
    for (const [man, esperado] of Object.entries(líneas)) {
      const manguera = CASCADA_ABC.mangueras.find(
        (m) => m.a.componente === man || m.b.componente === man,
      )
      expect(manguera).toBeTruthy()
      expect(manguera!.a.componente === esperado.de || manguera!.b.componente === esperado.de).toBe(
        true,
      )
    }
  })

  it('ejecuta la secuencia completa en el orden pedido', () => {
    const motor = new Motor(circuito())
    const seq: string[] = []
    let a = 0, b = 0, c = 0
    motor.accionar('START', true)
    for (let i = 0; i < 600; i++) {
      motor.tick()
      const na = pos(motor, 'CA'), nb = pos(motor, 'CB'), nc = pos(motor, 'CC')
      if (na === 1 && a < 1) seq.push('A+')
      if (na === 0 && a > 0) seq.push('A−')
      if (nb === 1 && b < 1) seq.push('B+')
      if (nb === 0 && b > 0) seq.push('B−')
      if (nc === 1 && c < 1) seq.push('C+')
      if (nc === 0 && c > 0) seq.push('C−')
      a = na; b = nb; c = nc
    }
    expect(seq.slice(0, 6)).toEqual(['A+', 'B+', 'B−', 'A−', 'C+', 'C−'])
  })

  it('sólo una de las tres líneas de grupo tiene presión en cada instante', () => {
    const motor = new Motor(circuito())
    motor.accionar('START', true)
    for (let i = 0; i < 500; i++) {
      motor.tick()
      const vivas = [grupoVivo(motor, 'G1'), grupoVivo(motor, 'G2'), grupoVivo(motor, 'G3')].filter(
        Boolean,
      ).length
      expect(vivas).toBeLessThanOrEqual(1)
    }
  })

  it('no aparece ningún conflicto de pilotajes', () => {
    const motor = new Motor(circuito())
    motor.accionar('START', true)
    motor.simular(25)
    expect(motor.eventos.filter((e) => e.tipo === 'conflicto')).toEqual([])
  })

  it('el ciclo se repite mientras se mantenga el START, y se detiene al soltarlo', () => {
    const motor = new Motor(circuito())
    motor.accionar('START', true)
    let ciclos = 0
    let a = 0
    for (let i = 0; i < 1200; i++) {
      motor.tick()
      const na = pos(motor, 'CA')
      if (na === 1 && a < 1) ciclos++
      a = na
    }
    expect(ciclos).toBeGreaterThanOrEqual(2)

    motor.accionar('START', false)
    motor.simular(15)
    const eventosAntes = motor.eventos.length
    motor.simular(12)
    expect(motor.eventos.length).toBe(eventosAntes)
  })
})
