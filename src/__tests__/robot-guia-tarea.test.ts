import { describe, expect, it } from 'vitest'
import { guiaTarea } from '../robot/guiaTarea'
import { tareaVaciaRobot } from '../robot/tarea4'
import type { Definicion } from '../robot/nodos'

const nodo = (id: string, tipo: string, params: Record<string, number | string | boolean> = {}) => ({ id, tipo, x: 0, y: 0, params })
const cable = (de: string, a: string, entrada = 0, salida = 0) => ({ de, salida, a, entrada })

function con(def: Definicion, nodos: ReturnType<typeof nodo>[], cables: ReturnType<typeof cable>[] = []): Definicion {
  return { ...def, nodos: [...def.nodos, ...nodos], cables: [...def.cables, ...cables] }
}

describe('guía de la Tarea 4', () => {
  const vacia = tareaVaciaRobot()
  const core = vacia.nodos.find((n) => n.tipo === 'core')!.id

  it('parte pidiendo la Curve', () => {
    const g = guiaTarea(vacia)
    expect(g.paso.id).toBe('c-curve')
    expect(g.paso.numero).toBe(1)
    expect(g.avance.every((a) => !a.hecho)).toBe(true)
  })

  it('avanza paso a paso y dice qué falta cuando el bloque está a medias', () => {
    let d = con(vacia, [nodo('c1', 'curvaDXF', { capa: '' })])
    expect(guiaTarea(d).paso.id).toBe('c-capa')
    expect(guiaTarea(d).paso.pista).toMatch(/Todas las capas/)

    d = { ...d, nodos: d.nodos.map((n) => (n.id === 'c1' ? { ...n, params: { capa: 'CONTORNO' } } : n)) }
    expect(guiaTarea(d).paso.id).toBe('c-offset-cable')

    d = con(d, [nodo('o1', 'desfase', { d: 2.5 })])
    const g = guiaTarea(d)
    expect(g.paso.id).toBe('c-offset-cable')
    expect(g.paso.pista).toMatch(/no está conectado/)

    d = con(d, [], [cable('c1', 'o1')])
    expect(guiaTarea(d).paso.id).toBe('c-move')

    d = con(d, [nodo('m1', 'mover', { z: 0 })], [cable('o1', 'm1')])
    expect(guiaTarea(d).paso.pista).toMatch(/Z = 0/)

    d = { ...d, nodos: d.nodos.map((n) => (n.id === 'm1' ? { ...n, params: { x: 0, y: 0, z: -5 } } : n)) }
    expect(guiaTarea(d).paso.id).toBe('c-path')

    d = con(d, [nodo('p1', 'recorrer')], [cable('m1', 'p1')])
    expect(guiaTarea(d).paso.id).toBe('husillo-on')

    d = con(d, [nodo('on', 'salida', { salida: 1, valor: true })])
    expect(guiaTarea(d).paso.id).toBe('core')

    d = con(d, [nodo('u1', 'unir')], [cable('on', 'u1', 0), cable('p1', 'u1', 1), cable('u1', core, 0)])
    const g2 = guiaTarea(d)
    expect(g2.paso.grupo).toBe('Ranuras')
    expect(g2.paso.id).toBe('r-curve')
  })

  it('el último paso es revisar y el total no cambia', () => {
    const g = guiaTarea(vacia)
    expect(g.avance[g.avance.length - 1].id).toBe('revisar')
    expect(g.paso.total).toBe(g.avance.length)
  })
})
