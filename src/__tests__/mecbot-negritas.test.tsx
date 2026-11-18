import { describe, expect, it } from 'vitest'
import { isValidElement } from 'react'
import { conNegritas } from '../components/MecBot'

const comoTexto = (partes: ReturnType<typeof conNegritas>) =>
  partes.map((p) => (isValidElement(p) ? `<b>${(p.props as { children: string }).children}</b>` : p)).join('')

describe('respuestas de MecBot', () => {
  it('muestra las negritas sin asteriscos', () => {
    expect(comoTexto(conNegritas('Un **DOut** es una *salida* digital.'))).toBe('Un <b>DOut</b> es una salida digital.')
  })

  it('deja el resto igual, viñetas incluidas', () => {
    expect(comoTexto(conNegritas('- **PTP**: rápido\n* LIN: recto\n2 * 3 = 6'))).toBe('- <b>PTP</b>: rápido\n* LIN: recto\n2 * 3 = 6')
  })
})
