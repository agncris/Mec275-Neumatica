// @vitest-environment jsdom
/**
 * Flujos de la interfaz: entrar a cada unidad, cargar un ejemplo, la guía de la Tarea 4,
 * «Ver el ejemplo» y «Volver a mi tarea», y «Revisar» en Entregar. Las escenas 3D no montan
 * en jsdom (no hay WebGL): usan su camino «sin WebGL», que es lo que se prueba aquí.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Raiz from '../Raiz'

const errorOriginal = console.error
afterAll(() => {
  console.error = errorOriginal
})

beforeAll(() => {
  // three avisa por consola que no hay WebGL; en jsdom es lo esperado.
  console.error = (...a: unknown[]) => {
    if (String(a[0]).includes('WebGL')) return
    errorOriginal(...a)
  }
  window.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.scrollTo = () => {}
  const g = globalThis as Record<string, unknown>
  for (const nombre of ['ResizeObserver', 'IntersectionObserver']) {
    if (!g[nombre]) {
      g[nombre] = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    }
  }
  // jsdom no trae CSS.escape (el editor de nodos lo usa para buscar un bloque por su id).
  const css = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS ?? {}
  css.escape = css.escape ?? ((t: string) => t.replace(/([^\w-])/g, '\\$1'))
  ;(globalThis as { CSS?: unknown }).CSS = css
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia
  // Sin contexto de dibujo, las escenas 3D caen en su aviso «sin WebGL».
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

function abrir(unidad: string, extra = '') {
  window.history.replaceState(null, '', `/?unidad=${unidad}${extra}`)
  return render(<Raiz />)
}

const ESPERA = { timeout: 15000 }

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('entrar a cada unidad', () => {
  const unidades: Array<[string, string]> = [
    ['neumatica', '▶ Simular'],
    ['plc', '▶ RUN'],
    ['cnc', '▶ Ciclo'],
    ['robotica', 'Programación visual'],
  ]
  for (const [id, texto] of unidades) {
    it(`abre ${id} sin que salte el aviso de error`, async () => {
      abrir(id)
      await waitFor(() => expect(screen.getAllByText(texto).length).toBeGreaterThan(0), ESPERA)
      expect(screen.queryByText(/Algo falló/)).toBeNull()
    }, 30000)
  }
})

describe('cargar un ejemplo', () => {
  it('en Neumática, un ejemplo deja el banco listo para simular', async () => {
    abrir('neumatica')
    const simular = await screen.findByRole('button', { name: /Simular/ })
    expect((simular as HTMLButtonElement).disabled).toBe(true)
    const selector = document.querySelector('[data-selector-ejemplos="si"]') as HTMLSelectElement
    expect(selector.options.length).toBeGreaterThan(2)
    fireEvent.change(selector, { target: { value: selector.options[1].value } })
    await waitFor(() => expect((screen.getByRole('button', { name: /Simular/ }) as HTMLButtonElement).disabled).toBe(false))
  }, 30000)
})

describe('Tarea 4 de Robótica', () => {
  const lienzo = () => document.querySelector('[data-guia-paso]')
  const pasoGuia = () => lienzo()?.getAttribute('data-guia-paso')
  const nodos = () => document.querySelectorAll('[data-lienzo-nodos] g[data-nodo]:not([data-puerto])').length

  async function abrirTarea() {
    abrir('robotica', '&vista=tarea')
    await waitFor(() => expect(lienzo()).toBeTruthy(), ESPERA)
  }
  /** Pulsa en la paleta el bloque que la guía destaca como el siguiente. */
  function agregarElSiguiente() {
    const boton = document.querySelector('.bloque-nodo[data-siguiente="si"]') as HTMLElement | null
    expect(boton).toBeTruthy()
    fireEvent.click(boton!)
  }

  it('la guía empieza en el primer paso y avanza al agregar el bloque que pide', async () => {
    await abrirTarea()
    expect(pasoGuia()).toBe('c-curve')
    agregarElSiguiente()
    await waitFor(() => expect(pasoGuia()).not.toBe('c-curve'))
  }, 30000)

  it('«Ver el ejemplo» y «Volver a mi tarea» conservan el trabajo del alumno', async () => {
    await abrirTarea()
    agregarElSiguiente()
    await waitFor(() => expect(pasoGuia()).not.toBe('c-curve'))
    const pasoAntes = pasoGuia()
    const nodosAntes = nodos()
    expect(nodosAntes).toBeGreaterThan(0)

    fireEvent.click(document.querySelector('[data-ver-ejemplo]') as HTMLElement)
    await waitFor(() => expect(screen.getByText(/Estás viendo el ejemplo del contorno/)).toBeTruthy())
    expect(document.querySelector('[data-ver-ejemplo]')).toBeNull()

    fireEvent.click(document.querySelector('[data-volver-tarea]') as HTMLElement)
    await waitFor(() => expect(screen.queryByText(/Estás viendo el ejemplo del contorno/)).toBeNull())
    expect(pasoGuia()).toBe(pasoAntes)
    expect(nodos()).toBe(nodosAntes)
  }, 30000)
})

describe('Revisar en Entregar', () => {
  it('en Neumática muestra el checklist de la revisión', async () => {
    abrir('neumatica')
    fireEvent.click(await screen.findByRole('button', { name: 'Entregar' }))
    const revisar = await waitFor(() => {
      const b = document.querySelector('[data-revisar="si"]')
      expect(b).toBeTruthy()
      return b as HTMLElement
    }, ESPERA)
    expect(document.querySelector('[data-revision="si"]')).toBeNull()
    fireEvent.click(revisar)
    const lista = await waitFor(() => {
      const ul = document.querySelector('[data-revision="si"]')
      expect(ul).toBeTruthy()
      return ul as HTMLElement
    })
    expect(lista.querySelectorAll('li').length).toBeGreaterThan(0)
  }, 30000)

  it('en Robótica el cajón de entrega lista lo que se entrega, desde el módulo de entregables', async () => {
    abrir('robotica', '&vista=tarea')
    fireEvent.click(await screen.findByRole('button', { name: /Entregar/ }, ESPERA))
    await waitFor(() => expect(document.querySelector('[data-cajon-entregar="si"]')).toBeTruthy(), ESPERA)
    for (const titulo of ['Croquis de la pieza', 'Posicionamiento del robot', 'Tu definición (los nodos)', /Ficha técnica · /, 'Tu definición (NeumaLab)', 'Video de la simulación']) {
      expect(screen.getAllByText(titulo).length).toBeGreaterThan(0)
    }
  }, 30000)

  for (const [unidad, boton, vista] of [
    ['plc', /Entregar Tarea PLC/, '&vista=tarea'],
    ['cnc', /Entregar Tarea CNC/, '&vista=tarea'],
  ] as const) {
    it(`en ${unidad.toUpperCase()} muestra el checklist de la revisión`, async () => {
      abrir(unidad, vista)
      fireEvent.click(await screen.findByRole('button', { name: boton }, ESPERA))
      const revisar = await waitFor(() => {
        const b = document.querySelector('[data-revisar="si"]')
        expect(b).toBeTruthy()
        return b as HTMLElement
      }, ESPERA)
      fireEvent.click(revisar)
      await waitFor(() => expect(document.querySelectorAll('[data-revision="si"] li').length).toBeGreaterThan(0))
    }, 30000)
  }
})
