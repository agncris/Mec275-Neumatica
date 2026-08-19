/**
 * Guardar, compartir y abrir circuitos: el alumno no debe perder su trabajo,
 * y un archivo o enlace corrupto no debe romper la aplicación.
 */
import { describe, expect, it } from 'vitest'
import { enlaceCompartir, esCircuitoValido, leerDeUrl } from '../persistencia'
import type { CircuitoGuardado } from '../persistencia'

const circuito: CircuitoGuardado = {
  version: 1,
  piezas: [
    { id: 'F1', tipo: 'fuente', x: 60, y: 330, params: { presion: 6, encendida: true } },
    { id: 'V1', tipo: 'valvula32', x: 300, y: 280, params: { reposo: 'NC' } },
  ],
  mangueras: [
    { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
  ],
}

const BASE = 'https://neumalab.example/'

describe('compartir por enlace', () => {
  it('el circuito sobrevive al viaje de ida y vuelta por la URL', () => {
    const enlace = enlaceCompartir(circuito, BASE)
    const recuperado = leerDeUrl(new URL(enlace).hash)
    expect(recuperado).toEqual(circuito)
  })

  it('soporta acentos y comillas españolas en los parámetros', () => {
    const conTextos: CircuitoGuardado = {
      ...circuito,
      nombre: 'Válvula selectora «O» — práctica nº 3',
    }
    const recuperado = leerDeUrl(new URL(enlaceCompartir(conTextos, BASE)).hash)
    expect(recuperado?.nombre).toBe('Válvula selectora «O» — práctica nº 3')
  })

  it('una URL sin circuito devuelve null en vez de romper', () => {
    expect(leerDeUrl('')).toBeNull()
    expect(leerDeUrl('#otracosa=1')).toBeNull()
  })

  it('un enlace manipulado devuelve null en vez de cargar basura', () => {
    expect(leerDeUrl('#c=esto-no-es-base64-valido')).toBeNull()
    expect(leerDeUrl('#c=' + btoa('{"piezas":"no es un array"}'))).toBeNull()
  })
})

describe('validación de circuitos cargados', () => {
  it('acepta un circuito bien formado', () => {
    expect(esCircuitoValido(circuito)).toBe(true)
  })

  it('rechaza estructuras que no son circuitos', () => {
    expect(esCircuitoValido(null)).toBe(false)
    expect(esCircuitoValido('texto')).toBe(false)
    expect(esCircuitoValido({})).toBe(false)
    expect(esCircuitoValido({ piezas: [], mangueras: 'no' })).toBe(false)
  })

  it('rechaza piezas sin coordenadas numéricas', () => {
    expect(
      esCircuitoValido({
        piezas: [{ id: 'F1', tipo: 'fuente', x: 'lejos', y: 0, params: {} }],
        mangueras: [],
      }),
    ).toBe(false)
  })

  it('rechaza mangueras con extremos incompletos', () => {
    expect(
      esCircuitoValido({
        piezas: [],
        mangueras: [{ id: 'm1', a: { componente: 'F1' }, b: { componente: 'V1', puerto: '1' } }],
      }),
    ).toBe(false)
  })

  it('acepta un circuito vacío (pizarra en blanco)', () => {
    expect(esCircuitoValido({ piezas: [], mangueras: [] })).toBe(true)
  })
})
