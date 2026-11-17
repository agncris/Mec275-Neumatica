/**
 * Todo lo que la app guarda en el navegador pasa por `src/persistencia.ts`: ahí
 * están las claves y ahí se lee y se escribe `localStorage`, con su `try/catch`.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { borrarClave, CLAVES, claveGuia, claveTrabajos, guardarJson, guardarTexto, leerJson, leerTexto } from '../persistencia'

// El código fuente de todo `src` (sin los tests), como texto.
const fuentes = import.meta.glob(['../**/*.{ts,tsx}', '!../__tests__/**', '!../persistencia.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const fuera = Object.entries(fuentes)

describe('persistencia en un solo lugar', () => {
  it('el barrido ve los archivos de src', () => {
    expect(fuera.length).toBeGreaterThan(100)
  })

  it('nadie más usa localStorage ni sessionStorage', () => {
    const culpables = fuera.filter(([, texto]) => /\b(localStorage|sessionStorage)\b/.test(texto)).map(([ruta]) => ruta)
    expect(culpables).toEqual([])
  })

  it('las claves neumalab.* están solo en persistencia.ts', () => {
    const culpables = fuera.filter(([, texto]) => /['"`]neumalab\./.test(texto)).map(([ruta]) => ruta)
    expect(culpables).toEqual([])
  })

  it('las claves no se repiten y todas parten con neumalab.', () => {
    const valores = Object.values(CLAVES)
    expect(new Set(valores).size).toBe(valores.length)
    for (const v of valores) expect(v.startsWith('neumalab.')).toBe(true)
    expect(claveGuia('plc')).toBe('neumalab.guia.plc')
    expect(claveTrabajos('cnc')).toBe('neumalab.trabajos.cnc')
  })
})

class Almacen {
  datos = new Map<string, string>()
  getItem(k: string) {
    return this.datos.has(k) ? (this.datos.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.datos.set(k, v)
  }
  removeItem(k: string) {
    this.datos.delete(k)
  }
}
const global = globalThis as { localStorage?: unknown }

describe('leer y guardar sin romper', () => {
  afterEach(() => {
    delete global.localStorage
  })

  it('guarda y lee texto y JSON; un JSON roto cuenta como nada guardado', () => {
    global.localStorage = new Almacen()
    expect(leerTexto('x')).toBeNull()
    expect(guardarTexto('x', 'hola')).toBe(true)
    expect(leerTexto('x')).toBe('hola')
    expect(guardarJson('j', { a: 1 })).toBe(true)
    expect(leerJson('j')).toEqual({ a: 1 })
    guardarTexto('roto', '{no es json')
    expect(leerJson('roto')).toBeNull()
    borrarClave('x')
    expect(leerTexto('x')).toBeNull()
  })

  it('si el navegador no deja usar el almacenamiento, no lanza error', () => {
    global.localStorage = {
      getItem() {
        throw new Error('bloqueado')
      },
      setItem() {
        throw new Error('lleno')
      },
      removeItem() {
        throw new Error('bloqueado')
      },
    }
    expect(leerTexto('x')).toBeNull()
    expect(leerJson('x')).toBeNull()
    expect(guardarTexto('x', 'a')).toBe(false)
    expect(guardarJson('x', { a: 1 })).toBe(false)
    expect(() => borrarClave('x')).not.toThrow()
  })

  it('un valor que no se puede pasar a JSON no lanza error', () => {
    global.localStorage = new Almacen()
    const circular: Record<string, unknown> = {}
    circular.yo = circular
    expect(guardarJson('c', circular)).toBe(false)
  })
})
