/**
 * Instrucciones al estilo LogixPro: bits EN / TT / DN, RTO, ONS y comparaciones.
 */
import { describe, expect, it } from 'vitest'
import { COLUMNAS, estadoInicial, leer, scan, type Bobina, type Celda, type ProgramaPLC } from '../plc/ladder'

const _: Celda = { tipo: 'vacio' }
const NA = (dir: string): Celda => ({ tipo: 'contacto', modo: 'NA', dir })
const prog = (...escalones: Array<[Celda[], Bobina]>): ProgramaPLC => ({
  version: 1,
  tipo: 'programa-plc',
  planta: 'tablero',
  simbolos: [],
  escalones: escalones.map(([c, b]) => ({
    celdas: [[...c, ...Array(COLUMNAS - c.length).fill(_)]],
    enlaces: [],
    bobinas: [b],
  })),
})
const correr = (p: ProgramaPLC, e = estadoInicial()) => (s: number, ent: Record<string, boolean> = {}) => {
  for (let i = 0; i < Math.round(s / 0.02); i++) scan(p, e, ent, 0.02)
  return e
}

describe('instrucciones', () => {
  it('TON: EN con corriente, TT mientras cuenta, DN al terminar', () => {
    const p = prog([[NA('I0.0')], { tipo: 'TON', dir: 'T0', preset: 1 }])
    const e = estadoInicial()
    const run = correr(p, e)
    run(0.5, { 'I0.0': true })
    expect([leer(e, 'T0.EN'), leer(e, 'T0.TT'), leer(e, 'T0.DN')]).toEqual([true, true, false])
    run(0.6, { 'I0.0': true })
    expect([leer(e, 'T0.EN'), leer(e, 'T0.TT'), leer(e, 'T0.DN')]).toEqual([true, false, true])
  })

  it('RTO guarda lo acumulado sin corriente y sólo un Reset lo vuelve a cero', () => {
    const p = prog([[NA('I0.0')], { tipo: 'RTO', dir: 'T1', preset: 2 }], [[NA('I0.1')], { tipo: 'reset', dir: 'T1' }])
    const e = estadoInicial()
    const run = correr(p, e)
    run(1.2, { 'I0.0': true })
    run(1)
    expect(e.temporizadores.T1.acumulado).toBeCloseTo(1.2, 1)
    run(0.9, { 'I0.0': true })
    expect(leer(e, 'T1.DN')).toBe(true)
    run(0.1, { 'I0.1': true })
    expect(e.temporizadores.T1.acumulado).toBe(0)
    expect(leer(e, 'T1.DN')).toBe(false)
  })

  it('ONS deja pasar un solo barrido aunque el pulsador siga apretado', () => {
    const p = prog([[NA('I0.0'), { tipo: 'ons' }], { tipo: 'CTU', dir: 'C0', preset: 99 }], [[NA('I0.0'), { tipo: 'ons' }], { tipo: 'normal', dir: 'Q0.0' }])
    const e = estadoInicial()
    const run = correr(p, e)
    scan(p, e, { 'I0.0': true }, 0.02)
    expect(e.bits['Q0.0']).toBe(true)
    run(0.5, { 'I0.0': true })
    expect(e.bits['Q0.0']).toBe(false)
    run(0.1)
    run(0.1, { 'I0.0': true })
    expect(e.contadores.C0.valor).toBe(2)
  })

  it('las comparaciones leen el acumulado de un contador', () => {
    const p = prog(
      [[NA('I0.0')], { tipo: 'CTU', dir: 'C0', preset: 10 }],
      [[{ tipo: 'comparar', op: 'GEQ', fuente: 'C0.ACC', valor: 3 }], { tipo: 'normal', dir: 'Q0.1' }],
      [[{ tipo: 'comparar', op: 'EQU', fuente: 'C0.ACC', valor: 2 }], { tipo: 'normal', dir: 'Q0.2' }],
    )
    const e = estadoInicial()
    const run = correr(p, e)
    for (let i = 0; i < 2; i++) {
      run(0.1, { 'I0.0': true })
      run(0.1)
    }
    expect([e.bits['Q0.1'], e.bits['Q0.2']]).toEqual([false, true])
    run(0.1, { 'I0.0': true })
    expect([e.bits['Q0.1'], e.bits['Q0.2']]).toEqual([true, false])
    expect(leer(e, 'C0.CU')).toBe(true)
  })
})

describe('instrucciones de datos y forzado', () => {
  it('ADD con ONS cuenta pulsaciones; MUL, DIV y comparaciones entre registros', async () => {
    const { EJEMPLOS_PLC } = await import('../plc/ejemplos')
    const { estadoInicial, scan, revisarPrograma } = await import('../plc/ladder')
    const p = EJEMPLOS_PLC.find((e) => e.id === 'datos')!.programa
    expect(revisarPrograma(p)).toEqual([])
    const e = estadoInicial()
    const pulso = (dir: string) => {
      scan(p, e, { [dir]: true }, 0.02)
      scan(p, e, { [dir]: true }, 0.02)
      scan(p, e, {}, 0.02)
    }
    for (let i = 0; i < 6; i++) pulso('I0.0')
    expect(e.palabras.N0).toBe(6)
    expect(e.palabras.N1).toBe(60)
    expect(e.palabras.N2).toBe(3)
    expect(e.bits['Q0.0']).toBe(true)
    expect(e.bits['Q0.1']).toBe(true)
    pulso('I0.1')
    expect(e.palabras.N0).toBe(5)
    pulso('I0.3')
    expect(e.palabras.N0).toBe(0)
    expect(e.bits['Q0.0']).toBe(false)
  })
  it('DIV entre cero no cambia el resultado y avisa; desborde se recorta', async () => {
    const { estadoInicial, scan, programaVacio, escalonVacio } = await import('../plc/ladder')
    const p = programaVacio()
    const e1 = escalonVacio()
    e1.celdas[0][0] = { tipo: 'cable' }
    e1.bobinas[0] = { tipo: 'DIV', dir: 'N3', a: '10', b: '0' }
    const e2 = escalonVacio()
    e2.celdas[0][0] = { tipo: 'cable' }
    e2.bobinas[0] = { tipo: 'MUL', dir: 'N4', a: '30000', b: '3' }
    p.escalones = [e1, e2]
    const e = estadoInicial()
    e.palabras.N3 = 7
    scan(p, e, {}, 0.02)
    expect(e.palabras.N3).toBe(7)
    expect(Object.values(e.fallas).join(' ')).toMatch(/DIV entre cero/)
    expect(e.palabras.N4).toBe(32767)
    expect(Object.values(e.fallas).join(' ')).toMatch(/Desborde/)
  })
  it('forzar: una entrada forzada vale lo forzado y una salida forzada manda sobre el programa', async () => {
    const { estadoInicial, scan, programaVacio, escalonVacio } = await import('../plc/ladder')
    const p = programaVacio()
    const e1 = escalonVacio()
    e1.celdas[0][0] = { tipo: 'contacto', modo: 'NA', dir: 'I0.0' }
    e1.bobinas[0] = { tipo: 'normal', dir: 'Q0.0' }
    p.escalones = [e1]
    const e = estadoInicial()
    scan(p, e, { 'I0.0': false }, 0.02, { 'I0.0': true })
    expect(e.bits['Q0.0']).toBe(true)
    scan(p, e, { 'I0.0': true }, 0.02, { 'Q0.0': false })
    expect(e.bits['Q0.0']).toBe(false)
  })
  it('notación de los registros', async () => {
    const { formatear } = await import('../plc/notacion')
    expect(formatear('N3', 'ab')).toBe('N7:3')
    expect(formatear('N3', 'siemens')).toBe('MW6')
  })
})
