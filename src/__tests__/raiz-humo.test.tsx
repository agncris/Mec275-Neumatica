// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import Raiz from '../Raiz'

beforeAll(() => {
  // jsdom no trae estas APIs que la app usa al montar.
  window.scrollTo = () => {}
  const g = globalThis as Record<string, unknown>
  if (!g.ResizeObserver) {
    g.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (!g.matchMedia) {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia
  }
})

describe('Raiz (prueba de humo)', () => {
  afterEach(cleanup)

  it('monta la portada y muestra las cuatro pestañas de unidad', () => {
    render(<Raiz />)
    const nav = screen.getByRole('navigation', { name: 'Unidades del curso' })
    const textos = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent)
    expect(textos).toEqual(['1Neumática', '2PLC', '3CNC', '4Robótica'])
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
