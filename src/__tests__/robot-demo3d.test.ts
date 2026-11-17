import { describe, expect, it } from 'vitest'
import { ROBOTS, directa, inversa, orientacionDePlano } from '../robot/robots'
import { planoXY, v } from '../robot/matematica'

const m = ROBOTS[0]
const R = orientacionDePlano(planoXY(v(0, 0, 0)))

describe('demos 3D de Estudiar', () => {
  it('el alcance: llega a 500 mm y no llega a 1150 mm', () => {
    expect(inversa(m, v(500, 0, 120), R, 120, [0, -90, 90, 0, 90, 0], v(0, 0, 0)).falla).toBeNull()
    expect(inversa(m, v(1150, 0, 120), R, 120, [0, -90, 90, 0, 90, 0], v(0, 0, 0)).falla).toBe('alcance')
  })

  it('con A5 en 0° la herramienta no cambia aunque A4 y A6 giren al revés', () => {
    const a = directa(m, [20, -70, 95, 0, 0, 0], 120)
    const b = directa(m, [20, -70, 95, 40, 0.5, -40], 120)
    expect(Math.hypot(a.tcp.x - b.tcp.x, a.tcp.y - b.tcp.y, a.tcp.z - b.tcp.z)).toBeLessThan(2)
  })

  it('los límites de cada eje dejan los deslizadores en un rango razonable', () => {
    for (const [mn, mx] of m.limites) expect(mx).toBeGreaterThan(mn)
    expect(m.limites[4][0]).toBeLessThan(0)
    expect(m.limites[4][1]).toBeGreaterThan(0)
  })
})

import { tramoDemo } from '../robot/Demo3D'

describe('recorridos de PTP, LIN y CIR entre los mismos puntos', () => {
  const ancho = (m: 'PTP' | 'LIN' | 'CIR') => {
    const t = tramoDemo(m).traza
    return { xMax: Math.max(...t.map((p) => p.x)), xMin: Math.min(...t.map((p) => p.x)), fin: t[t.length - 1] }
  }
  it('LIN va recto: X casi no cambia', () => {
    const r = ancho('LIN')
    expect(r.xMax - r.xMin).toBeLessThan(3)
  })
  it('CIR se abulta hacia el punto auxiliar', () => {
    expect(ancho('CIR').xMax).toBeGreaterThan(560)
  })
  it('PTP no es recto, pero llega al mismo punto que los otros', () => {
    const p = ancho('PTP')
    expect(p.xMax - p.xMin).toBeGreaterThan(3)
    for (const m of ['PTP', 'LIN', 'CIR'] as const) {
      const f = ancho(m).fin
      expect(Math.hypot(f.x - 480, f.y - 220, f.z - 220)).toBeLessThan(2)
    }
  })
})
