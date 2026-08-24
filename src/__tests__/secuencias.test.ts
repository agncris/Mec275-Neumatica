import { describe, expect, it } from 'vitest'
import { analizarSecuencia } from '../secuencias'

const grupos = (texto: string) =>
  analizarSecuencia(texto).grupos.map((g) => g.map((m) => m.texto).join(' '))

describe('división en grupos para el método cascada', () => {
  it('A+ B+ B− A− se parte en dos grupos', () => {
    expect(grupos('A+ B+ B- A-')).toEqual(['A+ B+', 'B− A−'])
    expect(analizarSecuencia('A+ B+ B- A-').valvulasCascada).toBe(1)
  })

  it('A+ B+ A− B− también se parte en dos', () => {
    expect(grupos('A+ B+ A- B-')).toEqual(['A+ B+', 'A− B−'])
  })

  it('A+ A− B+ B− necesita tres grupos y dos válvulas de cascada', () => {
    expect(grupos('A+ A- B+ B-')).toEqual(['A+', 'A− B+', 'B−'])
    expect(analizarSecuencia('A+ A- B+ B-').valvulasCascada).toBe(2)
  })

  it('una secuencia sin repeticiones cabe en un solo grupo, sin cascada', () => {
    expect(grupos('A+ B+ C+')).toEqual(['A+ B+ C+'])
    expect(analizarSecuencia('A+ B+ C+').valvulasCascada).toBe(0)
  })

  it('tolera minúsculas, comas y que se escriba todo pegado', () => {
    expect(grupos('a+,b+,b-,a-')).toEqual(['A+ B+', 'B− A−'])
    expect(grupos('A+B+B-A-')).toEqual(['A+ B+', 'B− A−'])
  })

  it('acepta el guion tipográfico que insertan algunos editores', () => {
    expect(grupos('A+ B+ B− A−')).toEqual(['A+ B+', 'B− A−'])
  })

  it('avisa si falta el signo o hay caracteres raros', () => {
    expect(analizarSecuencia('A+ B').error).toMatch(/signo/i)
    expect(analizarSecuencia('A+ 3% B-').error).toBeTruthy()
  })

  it('una entrada vacía no es un error, simplemente no hay nada que agrupar', () => {
    expect(analizarSecuencia('   ')).toMatchObject({ grupos: [], error: null })
  })

  it('secuencia larga de tres actuadores', () => {
    expect(grupos('A+ B+ C+ C- B- A-')).toEqual(['A+ B+ C+', 'C− B− A−'])
  })
})
