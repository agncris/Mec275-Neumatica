import { describe, expect, it } from 'vitest'
import { aABC, deABC, dist, anguloEntre, planoXY, v } from '../robot/matematica'
import { directa, HOME, inversa, orientacionDePlano, ROBOTS } from '../robot/robots'

describe('cinemática de los robots KUKA', () => {
  it('el alcance de la ficha coincide con la geometría (hombro → muñeca estirado)', () => {
    for (const m of ROBOTS) expect(m.a1 + m.a2 + Math.hypot(m.d4, m.a3)).toBeCloseTo(m.alcance, -1)
  })
  it('en HOME el brazo queda vertical y el antebrazo horizontal', () => {
    const m = ROBOTS[0]
    const p = directa(m, HOME, 0)
    const [, S, E, W] = p.cadena
    expect(E.x).toBeCloseTo(S.x)
    expect(E.z - S.z).toBeCloseTo(m.a2)
    expect(W.z - E.z).toBeCloseTo(m.a3)
    expect(W.x - E.x).toBeCloseTo(m.d4)
  })
  it('inversa ∘ directa devuelve la misma pose en muchas posiciones', () => {
    for (const m of ROBOTS) {
      let n = 0
      for (let k = 0; k < 60; k++) {
        const q = m.limites.map(([lo, hi]) => lo + (hi - lo) * (0.2 + 0.6 * Math.random()))
        if (Math.abs(q[4]) < 5) q[4] = 20
        const p = directa(m, q, 150)
        const s = inversa(m, p.tcp, p.R, 150, q)
        if (s.falla) continue
        n++
        const p2 = directa(m, s.q, 150)
        expect(dist(p2.tcp, p.tcp)).toBeLessThan(1e-6)
        expect(anguloEntre(p2.R, p.R)).toBeLessThan(1e-6)
      }
      expect(n).toBeGreaterThan(20)
    }
  })
  it('la herramienta apunta hacia abajo en un plano XY y avisa si no alcanza', () => {
    const m = ROBOTS[0]
    const R = orientacionDePlano(planoXY(v(500, 0, 200)))
    const s = inversa(m, v(500, 0, 200), R, 150)
    expect(s.falla).toBeNull()
    const p = directa(m, s.q, 150)
    expect(p.R[2][0]).toBeCloseTo(-1)
    expect(inversa(m, v(3000, 0, 200), R, 150).falla).toBe('alcance')
  })
  it('ABC de KUKA ida y vuelta', () => {
    const R = deABC(30, -20, 170)
    const abc = aABC(R)
    expect(abc.a).toBeCloseTo(30)
    expect(abc.b).toBeCloseTo(-20)
    expect(abc.c).toBeCloseTo(170)
  })
})
