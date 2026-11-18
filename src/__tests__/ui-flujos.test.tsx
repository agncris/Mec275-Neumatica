// @vitest-environment jsdom
/**
 * Flujos de la interfaz: entrar a cada unidad, cargar un ejemplo, la guía de la Tarea 4,
 * «Ver el ejemplo» y «Volver a mi tarea», y «Revisar» en Entregar. Las escenas 3D no montan
 * en jsdom (no hay WebGL): usan su camino «sin WebGL», que es lo que se prueba aquí.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Raiz from '../Raiz'
import { CLAVES } from '../persistencia'
import { tareaVacia as tareaVaciaCnc } from '../cnc/datosCNC'
import { tareaVacia as tareaVaciaPlc } from '../plc/datosPLC'
import { EJEMPLO_GUIADO_TORNO } from '../cnc/PlanoTarea'

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

describe('el ejemplo guiado es una visita (CNC y PLC)', () => {
  const verEjemplo = () => document.querySelector('[data-ver-ejemplo]') as HTMLElement
  const volver = () => document.querySelector('[data-volver-tarea]') as HTMLElement

  it('CNC: «Ver ejemplo guiado» y «Volver a mi tarea» dejan el mismo programa, y la tarea guardada no se pisa', async () => {
    const propio = 'N10 G21 G90\nN20 M03 S900\nN30 G00 X50 Z2\nN40 G01 Z-12 F90\nN50 M30\n'
    const base = tareaVaciaCnc()
    const guardado = JSON.stringify({ config: base.config, codigos: { ...base.codigos, torno: propio }, nombres: { ...base.nombres, torno: 'Mi pieza' } })
    window.localStorage.setItem(CLAVES.cncTarea, guardado)
    abrir('cnc', '&vista=tarea')
    const editor = () => document.querySelector('textarea') as HTMLTextAreaElement
    await waitFor(() => expect(editor()?.value).toBe(propio), ESPERA)

    fireEvent.click(await waitFor(() => {
      expect(verEjemplo()).toBeTruthy()
      return verEjemplo()
    }))
    await waitFor(() => expect(editor().value).toBe(EJEMPLO_GUIADO_TORNO))
    expect(screen.getAllByText(/Esto es un ejemplo, no tu entrega/).length).toBeGreaterThan(0)
    // Editar el ejemplo tampoco toca lo guardado de la tarea.
    fireEvent.change(editor(), { target: { value: `${EJEMPLO_GUIADO_TORNO}\nN5 G04 P1\n` } })
    await new Promise((r) => setTimeout(r, 50))
    expect(window.localStorage.getItem(CLAVES.cncTarea)).toBe(guardado)
    expect(window.localStorage.getItem(CLAVES.cncAntesEjemplo)).toBe(guardado)

    fireEvent.click(volver())
    await waitFor(() => expect(editor().value).toBe(propio))
    expect(document.querySelector('[data-volver-tarea]')).toBeNull()
    expect(window.localStorage.getItem(CLAVES.cncAntesEjemplo)).toBeNull()
    expect(JSON.parse(window.localStorage.getItem(CLAVES.cncTarea) as string).codigos.torno).toBe(propio)
  }, 40000)

  it('CNC: recargar estando en el ejemplo deja el programa propio', async () => {
    const propio = 'N10 G21\nN20 M30\n'
    const base = tareaVaciaCnc()
    window.localStorage.setItem(CLAVES.cncTarea, JSON.stringify({ config: base.config, codigos: { ...base.codigos, torno: propio }, nombres: base.nombres }))
    const { unmount } = abrir('cnc', '&vista=tarea')
    await waitFor(() => expect(verEjemplo()).toBeTruthy(), ESPERA)
    fireEvent.click(verEjemplo())
    await waitFor(() => expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe(EJEMPLO_GUIADO_TORNO))
    unmount()
    abrir('cnc', '&vista=tarea')
    await waitFor(() => expect((document.querySelector('textarea') as HTMLTextAreaElement)?.value).toBe(propio), ESPERA)
    expect(document.querySelector('[data-volver-tarea]')).toBeNull()
  }, 40000)

  it('CNC: la guía muestra la barra de progreso y «Te falta esto» con un programa a medias', async () => {
    const base = tareaVaciaCnc()
    window.localStorage.setItem(CLAVES.cncTarea, JSON.stringify({ config: base.config, codigos: { ...base.codigos, torno: 'N10 G21\nN20 M03\n' }, nombres: base.nombres }))
    abrir('cnc', '&vista=tarea')
    const pista = await waitFor(() => {
      const el = document.querySelector('[data-pista-tarea]')
      expect(el).toBeTruthy()
      return el as HTMLElement
    }, ESPERA)
    expect(pista.textContent).toMatch(/Te falta esto: Hay M03 o M04, pero no veo la velocidad S/)
    expect(document.querySelector('[data-progreso-tarea]')?.getAttribute('aria-valuenow')).toBe('2')
  }, 40000)

  it('PLC: «Ver ejemplo guiado» y «Volver a mi tarea» dejan el mismo programa, y la tarea guardada no se pisa', async () => {
    const propio = { ...tareaVaciaPlc(), nombre: 'Mi silo' }
    propio.simbolos = [{ dir: 'I0.0', nombre: 'MI_START', descripcion: '' }]
    const guardado = JSON.stringify(propio)
    window.localStorage.setItem(CLAVES.plcTarea, guardado)
    abrir('plc', '&vista=tarea')
    await waitFor(() => expect(screen.getByText(/Programa Ladder · Mi silo/)).toBeTruthy(), ESPERA)

    fireEvent.click(verEjemplo())
    await waitFor(() => expect(screen.getByText(/Programa Ladder · Ejemplo guiado/)).toBeTruthy())
    expect(screen.getAllByText(/Esto es un ejemplo, no tu entrega/).length).toBeGreaterThan(0)
    await new Promise((r) => setTimeout(r, 50))
    expect(window.localStorage.getItem(CLAVES.plcTarea)).toBe(guardado)
    expect(window.localStorage.getItem(CLAVES.plcAntesEjemplo)).toBe(guardado)

    fireEvent.click(volver())
    await waitFor(() => expect(screen.getByText(/Programa Ladder · Mi silo/)).toBeTruthy())
    expect(document.querySelector('[data-volver-tarea]')).toBeNull()
    expect(window.localStorage.getItem(CLAVES.plcAntesEjemplo)).toBeNull()
    expect(window.localStorage.getItem(CLAVES.plcTarea)).toBe(guardado)
  }, 40000)

  it('PLC: recargar estando en el ejemplo deja el programa propio', async () => {
    const propio = { ...tareaVaciaPlc(), nombre: 'Mi silo' }
    window.localStorage.setItem(CLAVES.plcTarea, JSON.stringify(propio))
    const { unmount } = abrir('plc', '&vista=tarea')
    await waitFor(() => expect(verEjemplo()).toBeTruthy(), ESPERA)
    fireEvent.click(verEjemplo())
    await waitFor(() => expect(screen.getByText(/Programa Ladder · Ejemplo guiado/)).toBeTruthy())
    unmount()
    abrir('plc', '&vista=tarea')
    await waitFor(() => expect(screen.getByText(/Programa Ladder · Mi silo/)).toBeTruthy(), ESPERA)
    expect(document.querySelector('[data-volver-tarea]')).toBeNull()
  }, 40000)
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
