/**
 * El análisis automático es lo que permite al alumno comprobar su trabajo y al
 * profesor revisarlo: tiene que decir la verdad sobre lo que hace el circuito.
 */
import { describe, expect, it } from 'vitest'
import { analizarCircuito, coincideSecuencia, inventarioDe } from '../analisis'
import { CIRCUITO_TRES_GRUPOS } from '../../circuitos/ejercicios'
import { CIRCUITO_BLOQUEADO, CIRCUITO_CASCADA } from '../../circuitos/cascada'
import type { Circuito } from '../tipos'

const comoCircuito = (c: { piezas: any[]; mangueras: any[] }): Circuito => ({
  componentes: c.piezas.map((p) => ({ id: p.id, tipo: p.tipo, params: { ...p.params } })),
  mangueras: c.mangueras.map((m) => ({ ...m })),
})

describe('detección de la secuencia', () => {
  it('reconoce A+ B+ B− A− en el circuito en cascada', () => {
    const a = analizarCircuito(comoCircuito(CIRCUITO_CASCADA))
    expect(a.secuenciaDetectada.slice(0, 4)).toEqual(['A+', 'B+', 'B−', 'A−'])
    expect(a.cicloCompleto).toBe(true)
    expect(a.conflictos).toEqual([])
    expect(a.sinMovimiento).toBe(false)
  })

  it('reconoce A+ B+ B− A− C+ C− en el circuito de tres grupos', () => {
    const a = analizarCircuito(comoCircuito(CIRCUITO_TRES_GRUPOS))
    expect(a.secuenciaDetectada.slice(0, 6)).toEqual(['A+', 'B+', 'B−', 'A−', 'C+', 'C−'])
    expect(a.cicloCompleto).toBe(true)
    expect(a.conflictos).toEqual([])
  })

  it('en el montaje bloqueado avisa del conflicto y de que nada se mueve', () => {
    const a = analizarCircuito(comoCircuito(CIRCUITO_BLOQUEADO))
    expect(a.conflictos.length).toBeGreaterThan(0)
    expect(a.sinMovimiento).toBe(true)
    expect(a.cicloCompleto).toBe(false)
  })

  it('asigna las letras A, B, C… por orden de aparición', () => {
    const a = analizarCircuito(comoCircuito(CIRCUITO_TRES_GRUPOS))
    expect(a.actuadores.map((x) => `${x.letra}=${x.id}`)).toEqual(['A=CA', 'B=CB', 'C=CC'])
  })

  it('un circuito vacío no rompe el análisis', () => {
    const a = analizarCircuito({ componentes: [], mangueras: [] })
    expect(a.actuadores).toEqual([])
    expect(a.sinMovimiento).toBe(true)
  })

  it('detecta los errores de montaje sin necesidad de simular', () => {
    const a = analizarCircuito({
      componentes: [
        { id: 'C1', tipo: 'cilindroDobleEfecto' },
        { id: 'S1', tipo: 'finalCarrera' },
      ],
      mangueras: [],
    })
    expect(a.erroresMontaje.length).toBeGreaterThan(0)
  })
})

describe('inventario de elementos', () => {
  it('cuenta cada tipo de componente con su nombre normalizado', () => {
    const inv = inventarioDe(comoCircuito(CIRCUITO_TRES_GRUPOS))
    const buscar = (n: string) => inv.find((x) => x.nombre.includes(n))?.cantidad
    expect(buscar('doble efecto')).toBe(2)
    expect(buscar('giratorio')).toBe(1)
    expect(buscar('5/2')).toBe(5) // 3 de potencia + 2 de cascada
    expect(buscar('Final de carrera')).toBe(6)
    expect(buscar('3/2')).toBe(1) // la marcha
    expect(buscar('FRL')).toBe(1)
  })
})

describe('comparación con la secuencia declarada', () => {
  const detectada = ['A+', 'B+', 'B−', 'A−', 'A+', 'B+', 'B−', 'A−']

  it('acepta la secuencia correcta', () => {
    expect(coincideSecuencia(['A+', 'B+', 'B−', 'A−'], detectada)).toBe(true)
  })

  it('acepta que el alumno la escriba empezando en otro punto del ciclo', () => {
    expect(coincideSecuencia(['B−', 'A−', 'A+', 'B+'], detectada)).toBe(true)
  })

  it('rechaza una secuencia distinta', () => {
    expect(coincideSecuencia(['A+', 'B+', 'A−', 'B−'], detectada)).toBe(false)
  })

  it('no da por buena una comparación vacía', () => {
    expect(coincideSecuencia([], detectada)).toBe(false)
    expect(coincideSecuencia(['A+'], [])).toBe(false)
  })
})
