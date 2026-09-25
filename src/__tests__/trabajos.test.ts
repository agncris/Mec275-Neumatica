/**
 * «Mis trabajos», respaldo y enlaces: guardar con nombre, reemplazar,
 * restaurar sin perder nada y codificar/decodificar un trabajo en un enlace.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { baseArchivo, codificarEnlace, decodificarEnlace, paraArchivo } from '../entregar'
import { borrarTrabajo, crearRespaldo, esRespaldo, guardarTrabajo, listarTrabajos, renombrarTrabajo, restaurarRespaldo } from '../trabajos'

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
  clear() {
    this.datos.clear()
  }
}

beforeEach(() => {
  ;(globalThis as { localStorage?: unknown }).localStorage = new Almacen()
})

describe('mis trabajos', () => {
  it('guarda, reemplaza por nombre, renombra y borra', () => {
    guardarTrabajo('plc', 'Ejercicio 1', { a: 1 })
    guardarTrabajo('plc', 'Tarea', { a: 2 })
    guardarTrabajo('plc', 'ejercicio 1', { a: 3 })
    const lista = listarTrabajos('plc')
    expect(lista.map((t) => t.nombre)).toEqual(['ejercicio 1', 'Tarea'])
    expect(lista[0].dato).toEqual({ a: 3 })
    renombrarTrabajo('plc', lista[1].id, 'Tarea 2')
    expect(listarTrabajos('plc')[1].nombre).toBe('Tarea 2')
    borrarTrabajo('plc', lista[0].id)
    expect(listarTrabajos('plc')).toHaveLength(1)
    expect(listarTrabajos('cnc')).toEqual([])
  })

  it('el respaldo lleva los trabajos de todas las unidades y se restaura sin duplicar', () => {
    guardarTrabajo('neumatica', 'Circuito A', { piezas: [] })
    guardarTrabajo('cnc', 'Torno', { codigo: 'G21' })
    localStorage.setItem('neumalab.plc.programa', '{"x":1}')
    const r = crearRespaldo()
    expect(esRespaldo(JSON.parse(JSON.stringify(r)))).toBe(true)
    expect(r.abiertos['neumalab.plc.programa']).toBe('{"x":1}')
    localStorage.clear()
    guardarTrabajo('cnc', 'Fresa', { codigo: 'G90' })
    expect(restaurarRespaldo(r)).toBe(2)
    expect(listarTrabajos('cnc').map((t) => t.nombre).sort()).toEqual(['Fresa', 'Torno'])
    restaurarRespaldo(r)
    expect(listarTrabajos('cnc')).toHaveLength(2)
  })
})

describe('entregar', () => {
  it('nombra los archivos como piden los enunciados', () => {
    expect(paraArchivo('Ana María Pérez')).toBe('Ana_Maria_Perez')
    expect(baseArchivo({ nombre: 'Ana Pérez', companero: '' }, 'Trabajo-2')).toBe('Ana_Perez_Trabajo-2')
    expect(baseArchivo({ nombre: 'Ana Pérez', companero: 'Luis Soto' }, 'Trabajo-3')).toBe('Ana_Perez_Luis_Soto_Trabajo-3')
  })

  it('un trabajo va y vuelve por un enlace', async () => {
    const dato = { nombre: 'Programa ñandú', escalones: [1, 2, 3], texto: 'x'.repeat(500) }
    const codigo = await codificarEnlace(dato)
    expect(codigo).toMatch(/^[zj][A-Za-z0-9\-_]+$/)
    expect(await decodificarEnlace(codigo)).toEqual(dato)
  })
})
