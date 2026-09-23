import { describe, expect, it } from 'vitest'
import { Historial } from '../historial'

describe('historial de deshacer', () => {
  it('deshace y rehace, y agrupa los cambios seguidos', () => {
    let t = 0
    const h = new Historial<number>(500, 100, () => t)
    let v = 0
    const cambiar = (n: number) => {
      h.anotar(v)
      v = n
    }
    cambiar(1)
    t = 100
    cambiar(2) // seguido: mismo paso que el anterior
    t = 1000
    cambiar(3)
    expect((v = h.deshacer(v)!)).toBe(2)
    expect((v = h.deshacer(v)!)).toBe(0)
    expect(h.deshacer(v)).toBeNull()
    expect((v = h.rehacer(v)!)).toBe(2)
    t = 5000
    cambiar(9) // un cambio nuevo borra lo que se podía rehacer
    expect(h.puedeRehacer).toBe(false)
  })
})
