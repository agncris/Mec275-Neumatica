import { describe, expect, it } from 'vitest'
import { formatear } from '../plc/notacion'

describe('notación de direcciones', () => {
  it('traduce a la forma de LogixPro', () => {
    expect(formatear('I0.3', 'ab')).toBe('I:1/03')
    expect(formatear('Q0.1', 'ab')).toBe('O:2/01')
    expect(formatear('M0.1', 'ab')).toBe('B3:0/1')
    expect(formatear('M1.2', 'ab')).toBe('B3:0/10')
    expect(formatear('T0', 'ab')).toBe('T4:0')
    expect(formatear('T2.DN', 'ab')).toBe('T4:2/DN')
    expect(formatear('C1.ACC', 'ab')).toBe('C5:1.ACC')
  })
  it('en notación del apunte no cambia nada', () => {
    expect(formatear('I0.3', 'siemens')).toBe('I0.3')
  })
})
