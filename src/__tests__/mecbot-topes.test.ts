import { afterEach, describe, expect, it, vi } from 'vitest'
import { topes } from '../../api/responder.js'

describe('MecBot: tope de preguntas por IP', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('sin variables usa 12 por hora y 40 por día', () => {
    vi.stubEnv('MEC_BOT_TOPE_HORA', '')
    vi.stubEnv('MEC_BOT_TOPE_DIA', '')
    expect(topes()).toEqual({ hora: 12, dia: 40 })
  })

  it('se puede cambiar o quitar con 0', () => {
    vi.stubEnv('MEC_BOT_TOPE_HORA', '0')
    vi.stubEnv('MEC_BOT_TOPE_DIA', '500')
    expect(topes()).toEqual({ hora: 0, dia: 500 })
  })

  it('un valor inválido deja el tope de siempre', () => {
    vi.stubEnv('MEC_BOT_TOPE_HORA', 'mucho')
    vi.stubEnv('MEC_BOT_TOPE_DIA', '-3')
    expect(topes()).toEqual({ hora: 12, dia: 40 })
  })
})
