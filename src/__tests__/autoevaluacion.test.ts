/**
 * Autoevaluaciones: cada generador da preguntas bien formadas (opciones
 * distintas, una sola correcta y en rango) con cualquier semilla.
 */
import { describe, expect, it } from 'vitest'
import { PREGUNTAS_PLC } from '../plc/preguntasPLC'
import { PREGUNTAS_CNC } from '../cnc/preguntasCNC'
import { PREGUNTAS_ROBOT } from '../robot/preguntasRobot'

/** Números pseudoaleatorios repetibles. */
function semilla(s: number) {
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe.each([
  ['PLC', PREGUNTAS_PLC],
  ['CNC', PREGUNTAS_CNC],
  ['Robótica', PREGUNTAS_ROBOT],
])('autoevaluación de %s', (_, bancos) => {
  it.each(bancos.map((b) => [b.tema, b]))('%s: 300 preguntas bien formadas', (_t, b) => {
    const azar = semilla(7)
    for (let i = 0; i < 300; i++) {
      const q = b.generar(azar)
      expect(q.opciones.length).toBeGreaterThanOrEqual(2)
      expect(new Set(q.opciones).size).toBe(q.opciones.length)
      expect(q.correcta).toBeGreaterThanOrEqual(0)
      expect(q.correcta).toBeLessThan(q.opciones.length)
      expect(q.enunciado.length).toBeGreaterThan(10)
      expect(q.explicacion.length).toBeGreaterThan(10)
    }
  })
})

describe('preguntas con cálculo', () => {
  it('absolutas e incrementales: la opción correcta cumple la cuenta', () => {
    const inc = PREGUNTAS_CNC.find((b) => b.tema === 'Absolutas e incrementales')!
    const azar = semilla(3)
    for (let i = 0; i < 200; i++) {
      const q = inc.generar(azar)
      const nums = (t: string) => (t.match(/-?\d+/g) ?? []).map(Number)
      const [ax, ay] = nums(q.enunciado)
      const ok = q.opciones[q.correcta]
      if (ok.startsWith('G91')) {
        const [, bx, by] = [0, ...nums(q.enunciado).slice(2, 4)]
        const [, , dx, dy] = nums(ok)
        expect([ax + dx, ay + dy]).toEqual([bx, by])
      } else {
        const [dx, dy] = nums(q.enunciado).slice(2, 4)
        const [, , bx, by] = nums(ok)
        expect([bx, by]).toEqual([ax + dx, ay + dy])
      }
    }
  })
})
