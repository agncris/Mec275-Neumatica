// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alVerse, bucleVisible } from '../vista3d/visible'

type Aviso = (e: Array<{ isIntersecting: boolean }>) => void
let avisar: Aviso = () => {}

beforeEach(() => {
  class FalsoObservador {
    constructor(cb: Aviso) {
      avisar = cb
    }
    observe() {}
    disconnect() {}
  }
  ;(globalThis as Record<string, unknown>).IntersectionObserver = FalsoObservador
  vi.useFakeTimers()
  // rAF falso: corre cada ~16 ms con el reloj falso.
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})

function ocultarPestana(oculta: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => oculta })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('alVerse', () => {
  it('avisa cuando el lienzo sale y vuelve a entrar en pantalla', () => {
    const al = vi.fn()
    const quitar = alVerse(document.createElement('div'), al)
    avisar([{ isIntersecting: false }])
    avisar([{ isIntersecting: true }])
    expect(al.mock.calls).toEqual([[false], [true]])
    quitar()
  })

  it('no repite avisos si el estado no cambia', () => {
    const al = vi.fn()
    const quitar = alVerse(document.createElement('div'), al)
    avisar([{ isIntersecting: true }])
    avisar([{ isIntersecting: false }])
    avisar([{ isIntersecting: false }])
    expect(al.mock.calls).toEqual([[false]])
    quitar()
  })

  it('una pestaña oculta cuenta como no visible, aunque el lienzo esté en pantalla', () => {
    const al = vi.fn()
    const quitar = alVerse(document.createElement('div'), al)
    ocultarPestana(true)
    avisar([{ isIntersecting: true }])
    ocultarPestana(false)
    expect(al.mock.calls).toEqual([[false], [true]])
    quitar()
  })
})

describe('bucleVisible', () => {
  it('dibuja mientras se ve, se detiene al salir y retoma al volver', () => {
    const cuadro = vi.fn()
    const alOcultar = vi.fn()
    const alMostrar = vi.fn()
    const parar = bucleVisible(document.createElement('div'), cuadro, { alOcultar, alMostrar })
    vi.advanceTimersByTime(100)
    const visto = cuadro.mock.calls.length
    expect(visto).toBeGreaterThan(2)

    avisar([{ isIntersecting: false }])
    expect(alOcultar).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    const trasOcultar = cuadro.mock.calls.length
    vi.advanceTimersByTime(500)
    expect(cuadro.mock.calls.length).toBe(trasOcultar)

    avisar([{ isIntersecting: true }])
    expect(alMostrar).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(40)
    expect(cuadro.mock.calls.length).toBeGreaterThan(trasOcultar)
    parar()
  })

  it('al detenerlo no vuelve a dibujar', () => {
    const cuadro = vi.fn()
    const parar = bucleVisible(document.createElement('div'), cuadro)
    vi.advanceTimersByTime(50)
    parar()
    const n = cuadro.mock.calls.length
    vi.advanceTimersByTime(200)
    avisar([{ isIntersecting: true }])
    vi.advanceTimersByTime(200)
    expect(cuadro.mock.calls.length).toBe(n)
  })
})
