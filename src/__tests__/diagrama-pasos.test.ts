import { describe, expect, it } from 'vitest'
import { diagramaPorPasos, type Muestra } from '../diagramaPasos'

/** Genera muestras con rampas lineales a partir de una lista de movimientos. */
function simular(movs: Array<[number, string, 0 | 1]>, ids: string[]): Muestra[] {
  const pos: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]))
  const muestras: Muestra[] = [{ t: 0, pos: { ...pos } }]
  let t = 0
  for (const [dur, id, fin] of movs) {
    // un movimiento de duración `dur`, muestreado cada 0.05 s
    const ini = pos[id]
    const n = Math.round(dur / 0.05)
    for (let k = 1; k <= n; k++) {
      t += 0.05
      pos[id] = ini + ((fin - ini) * k) / n
      muestras.push({ t, pos: { ...pos } })
    }
  }
  return muestras
}

const AB = [
  { id: 'CA', letra: 'A' },
  { id: 'CB', letra: 'B' },
]

describe('diagrama de fase por pasos', () => {
  it('A+ B+ B− A− da cuatro pasos en ese orden', () => {
    const m = simular([[1, 'CA', 1], [1, 'CB', 1], [1, 'CB', 0], [1, 'CA', 0]], ['CA', 'CB'])
    const d = diagramaPorPasos(m, AB)
    expect(d.pasos.map((p) => p.movimientos.join(' '))).toEqual(['A+', 'B+', 'B−', 'A−'])
    expect(d.inicial).toEqual({ CA: 0, CB: 0 })
    expect(d.pasos[1].estado).toEqual({ CA: 1, CB: 1 })
    expect(d.pasos[3].estado).toEqual({ CA: 0, CB: 0 })
  })

  it('agrupa en un solo paso los movimientos simultáneos', () => {
    // A y B salen a la vez (se muestrean en el mismo instante), luego vuelven juntos
    const muestras: Muestra[] = []
    for (let k = 0; k <= 20; k++) muestras.push({ t: k * 0.05, pos: { CA: k / 20, CB: k / 20 } })
    for (let k = 1; k <= 20; k++) muestras.push({ t: 1 + k * 0.05, pos: { CA: 1 - k / 20, CB: 1 - k / 20 } })
    const d = diagramaPorPasos(muestras, AB)
    expect(d.pasos.map((p) => [...p.movimientos].sort().join(' '))).toEqual(['A+ B+', 'A− B−'])
  })

  it('sin movimiento no hay pasos', () => {
    expect(diagramaPorPasos([{ t: 0, pos: { CA: 0 } }], AB).pasos).toEqual([])
  })

  it('respeta el máximo de pasos', () => {
    const movs: Array<[number, string, 0 | 1]> = []
    for (let i = 0; i < 10; i++) movs.push([0.5, 'CA', 1], [0.5, 'CA', 0])
    expect(diagramaPorPasos(simular(movs, ['CA']), AB, 5).pasos).toHaveLength(5)
  })
})
