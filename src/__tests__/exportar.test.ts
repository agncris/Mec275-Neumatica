import { describe, expect, it } from 'vitest'
import { nombreSeguro } from '../exportar'

describe('nombre de archivo del entregable', () => {
  it('quita acentos y espacios', () => {
    expect(nombreSeguro('Círculo de fresado', 'png')).toBe('Circulo_de_fresado.png')
  })

  it('conserva guiones y números', () => {
    expect(nombreSeguro('Juan_Perez_Tarea-1', 'png')).toBe('Juan_Perez_Tarea-1.png')
  })

  it('descarta caracteres que romperían la descarga', () => {
    expect(nombreSeguro('a/b\\c:d*e?', 'svg')).toBe('a_b_c_d_e.svg')
  })

  it('nunca devuelve un nombre vacío', () => {
    expect(nombreSeguro('///', 'png')).toBe('circuito.png')
    expect(nombreSeguro('', 'json')).toBe('circuito.json')
  })

  it('recorta nombres desmesurados', () => {
    expect(nombreSeguro('x'.repeat(200), 'png').length).toBeLessThanOrEqual(64)
  })
})
