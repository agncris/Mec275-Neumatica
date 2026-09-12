/**
 * Pruebas del auto-layout y del routing ortogonal.
 */
import { describe, expect, it } from 'vitest'
import { CASCADA_TRES_GRUPOS as CASCADA_ABC } from '../engine/__tests__/circuitos-prueba'
import { autoLayout, calcularAreaConMargen } from '../layout'
import { enrutarManguera, type Punto } from '../routing'
import { DESCRIPTORES } from '../components/descriptores'

function caja(p: { x: number; y: number; tipo: string }) {
  const d = DESCRIPTORES[p.tipo]
  return { x: p.x, y: p.y, w: d?.ancho ?? 60, h: d?.alto ?? 40 }
}

function seSuperponen(a: ReturnType<typeof caja>, b: ReturnType<typeof caja>, holgura = 0) {
  return (
    a.x - holgura < b.x + b.w &&
    a.x + a.w + holgura > b.x &&
    a.y - holgura < b.y + b.h &&
    a.y + a.h + holgura > b.y
  )
}

/** Comprueba que una ruta es ortogonal (sólo segmentos H/V). */
function esOrtogonal(d: string): boolean {
  const puntos: Punto[] = []
  const re = /([ML])(-?[\d.]+),(-?[\d.]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d)) !== null) puntos.push({ x: parseFloat(m[2]), y: parseFloat(m[3]) })
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1]
    const b = puntos[i]
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)
    if (dx > 0.1 && dy > 0.1) return false // diagonal → no ortogonal
  }
  return true
}

describe('autoLayout', () => {
  it('coloca los tres actuadores arriba, de izquierda a derecha y bien separados', () => {
    const { piezas, ok } = autoLayout(CASCADA_ABC.piezas, CASCADA_ABC.mangueras)
    const actuadores = piezas
      .filter((p) => p.tipo.startsWith('cilindro') || p.tipo === 'actuadorGiratorio')
      .sort((a, b) => a.x - b.x)
    expect(actuadores.map((p) => p.id)).toEqual(['CA', 'CB', 'CC'])
    // Separación horizontal mínima entre actuadores (≥ 160 px de centro a centro)
    for (let i = 1; i < actuadores.length; i++) {
      const a = caja(actuadores[i - 1])
      const b = caja(actuadores[i])
      expect(b.x - (a.x + a.w)).toBeGreaterThanOrEqual(80)
      expect(ok).toBe(true)
    }
  })

  it('los manómetros G1, G2, G3 no se superponen con ningún componente', () => {
    const { piezas } = autoLayout(CASCADA_ABC.piezas, CASCADA_ABC.mangueras)
    const manometros = piezas.filter((p) => p.tipo === 'manometro')
    const resto = piezas.filter((p) => p.tipo !== 'manometro')
    for (const mano of manometros) {
      for (const otro of resto) {
        expect(seSuperponen(caja(mano), caja(otro), 6)).toBe(false)
      }
    }
  })

  it('ninguna pieza se superpone con otra', () => {
    const { piezas, ok } = autoLayout(CASCADA_ABC.piezas, CASCADA_ABC.mangueras)
    for (let i = 0; i < piezas.length; i++)
      for (let j = i + 1; j < piezas.length; j++)
        expect(seSuperponen(caja(piezas[i]), caja(piezas[j]), 4)).toBe(false)
    expect(ok).toBe(true)
  })

  it('el área calculada contiene todas las piezas con margen', () => {
    const { piezas, area } = autoLayout(CASCADA_ABC.piezas, CASCADA_ABC.mangueras)
    for (const p of piezas) {
      const c = caja(p)
      expect(c.x).toBeGreaterThanOrEqual(area.x)
      expect(c.y).toBeGreaterThanOrEqual(area.y)
      expect(c.x + c.w).toBeLessThanOrEqual(area.x + area.ancho)
      expect(c.y + c.h).toBeLessThanOrEqual(area.y + area.alto)
    }
  })

  it('calcularAreaConMargen funciona con la lista vacía', () => {
    expect(calcularAreaConMargen([], 60)).toEqual({ x: 0, y: 0, ancho: 0, alto: 0 })
  })
})

describe('enrutarManguera', () => {
  it('produce un trazado ortogonal (sin diagonales)', () => {
    const byId = new Map(CASCADA_ABC.piezas.map((p) => [p.id, p]))
    const m = CASCADA_ABC.mangueras[0]
    const pa = byId.get(m.a.componente)!
    const pb = byId.get(m.b.componente)!
    const d = enrutarManguera(CASCADA_ABC.piezas, pa, m.a, pb, m.b)
    expect(d.length).toBeGreaterThan(0)
    expect(esOrtogonal(d)).toBe(true)
  })

  it('no atraviesa el interior de un componente ajeno a la manguera', () => {
    const byId = new Map(CASCADA_ABC.piezas.map((p) => [p.id, p]))
    // Conecta dos puertos entre la válvula VA y el cilindro CA; el camino no
    // debe pasar por el cuerpo de otra pieza (p. ej. VB o los sensores).
    const origen = byId.get('VA')!
    const destino = byId.get('CA')!
    const d = enrutarManguera(
      CASCADA_ABC.piezas,
      origen,
      { componente: 'VA', puerto: '4' },
      destino,
      { componente: 'CA', puerto: 'A' },
    )
    const puntos: Punto[] = []
    const re = /([ML])(-?[\d.]+),(-?[\d.]+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(d)) !== null) puntos.push({ x: parseFloat(m[2]), y: parseFloat(m[3]) })

    // Segmentos consecutivos no deben cortar la caja de VB (un componente ajeno)
    const vb = caja(byId.get('VB')!)
    for (let i = 1; i < puntos.length; i++) {
      const a = puntos[i - 1]
      const b = puntos[i]
      // Muestreo fino a lo largo del segmento
      for (let t = 0; t <= 1; t += 0.05) {
        const px = a.x + (b.x - a.x) * t
        const py = a.y + (b.y - a.y) * t
        const dentroVB =
          px >= vb.x - 1 && px <= vb.x + vb.w + 1 && py >= vb.y - 1 && py <= vb.y + vb.h + 1
        expect(dentroVB).toBe(false)
      }
    }
  })
})
