import { describe, expect, it } from 'vitest'
import { StockPlancha } from '../robot/stock'
import type { Muestra } from '../robot/movimiento'

const m = (x: number, z: number, i: number): Muestra => ({ t: i, q: [], tcp: { x, y: 50, z }, estado: 'ok', cmd: 0, enPieza: true, corta: true })
const pasada = (z: number) => [m(10, 5, 0), m(10, z, 1), m(90, z, 2), m(90, 5, 3)]
const aLocal = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y, z: p.z })

/** Altura (mm, negativa si bajó) del vértice más cercano a (x, y). */
function alturaEn(s: StockPlancha, x: number, y: number): number {
  const pos = s.malla.geometry.getAttribute('position')
  let mejor = Infinity
  let h = 0
  for (let k = 0; k < pos.count; k++) {
    const d = Math.hypot(pos.getX(k) - x, pos.getY(k) - y)
    if (d < mejor && pos.getZ(k) <= 0.001) {
      mejor = d
      h = pos.getZ(k)
    }
  }
  return h
}

function cortar(radio: number, profundidad: number) {
  const s = new StockPlancha({ x0: 0, y0: 0, x1: 100, y1: 100 }, 5, 5)
  s.cargar(pasada(5 - profundidad), radio, 5, aLocal, true)
  s.aplicar(3, 1, true)
  return s
}

describe('desbaste de la plancha del robot', () => {
  it('la ranura tiene el ancho de la fresa', () => {
    const fina = cortar(1.5, 3)
    const gruesa = cortar(4, 3)
    // A 3 mm del eje: la fresa de 8 mm lo corta; la de 3 mm no.
    expect(alturaEn(fina, 50, 53)).toBeCloseTo(0, 1)
    expect(alturaEn(gruesa, 50, 53)).toBeLessThan(-2.5)
    // En el eje, las dos cortan.
    expect(alturaEn(fina, 50, 50)).toBeLessThan(-2.5)
    expect(alturaEn(gruesa, 50, 50)).toBeLessThan(-2.5)
  })

  it('la profundidad de la ranura es la de la herramienta', () => {
    expect(alturaEn(cortar(2.5, 2), 50, 50)).toBeCloseTo(-2, 0)
    expect(alturaEn(cortar(2.5, 4), 50, 50)).toBeCloseTo(-4, 0)
  })

  it('no pasa del espesor de la plancha', () => {
    expect(alturaEn(cortar(2.5, 9), 50, 50)).toBeGreaterThanOrEqual(-5.001)
  })

  it('antes de que pase la herramienta, la plancha está entera', () => {
    const s = new StockPlancha({ x0: 0, y0: 0, x1: 100, y1: 100 }, 5, 5)
    s.cargar(pasada(2), 2.5, 5, aLocal, true)
    s.aplicar(0, 1, true)
    expect(alturaEn(s, 50, 50)).toBeCloseTo(0, 3)
  })
})
