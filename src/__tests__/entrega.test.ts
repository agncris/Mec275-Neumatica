import { describe, expect, it } from 'vitest'
import { crearEntrega, esEntrega, normalizarRespuestas, RESPUESTAS_VACIAS } from '../entrega'

const circuito = {
  piezas: [{ id: 'F1', tipo: 'fuente', x: 10, y: 10, params: {} }],
  mangueras: [],
}
const base = () =>
  crearEntrega(
    { nombre: 'Ana Pérez', rol: '202012345-6' },
    'tarea',
    { ...RESPUESTAS_VACIAS, secuencia: 'A+ B+ B- A-', vdi: [{ n: 10, nota: 'giro 180°' }] },
    circuito,
  )

describe('archivo de entrega', () => {
  it('una entrega recién creada es válida y lleva fecha', () => {
    const e = base()
    expect(esEntrega(e)).toBe(true)
    expect(Number.isFinite(Date.parse(e.fecha))).toBe(true)
  })

  it('sobrevive al viaje por JSON', () => {
    expect(esEntrega(JSON.parse(JSON.stringify(base())))).toBe(true)
  })

  it('rechaza un circuito suelto, que no es una entrega', () => {
    expect(esEntrega({ version: 1, piezas: [], mangueras: [] })).toBe(false)
  })

  it('rechaza archivos de otra cosa o manipulados', () => {
    expect(esEntrega(null)).toBe(false)
    expect(esEntrega({ formato: 'otra-cosa' })).toBe(false)
    const sinRol = base() as any
    delete sinRol.alumno.rol
    expect(esEntrega(sinRol)).toBe(false)
    const vdiMalo = base() as any
    vdiMalo.respuestas.vdi = ['girar']
    expect(esEntrega(vdiMalo)).toBe(false)
  })

  it('rechaza una entrega cuyo circuito esté corrupto', () => {
    const malo = base() as any
    malo.circuito.piezas = [{ id: 'F1', tipo: 'fuente', x: 'lejos', y: 0 }]
    expect(esEntrega(malo)).toBe(false)
  })

  it('normalizar rellena los huecos de una entrega incompleta', () => {
    expect(normalizarRespuestas(undefined)).toEqual(RESPUESTAS_VACIAS)
    expect(normalizarRespuestas({ secuencia: 'A+ A-' })).toEqual({
      ...RESPUESTAS_VACIAS,
      secuencia: 'A+ A-',
    })
    expect(normalizarRespuestas({ vdi: [{ n: 3 } as any, 'basura' as any] }).vdi).toHaveLength(1)
  })
})
