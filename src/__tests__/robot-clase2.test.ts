import { describe, expect, it } from 'vitest'
import { leerDXF } from '../robot/geometria'
import { simular } from '../robot/movimiento'
import { componente, evaluar, type Definicion, type NodoDef } from '../robot/nodos'
import { ENUNCIADO_FALLA, PRACTICA_ROBOT } from '../robot/practica'

const ejercicio = (id: string): Definicion => PRACTICA_ROBOT.find((e) => e.id === id)!.definicion()
const correr = (d: Definicion) => {
  const ev = evaluar(d, d.dxf ? leerDXF(d.dxf.texto) : null)
  return { ev, sim: ev.programas[0] ? simular(ev.programas[0]) : null }
}
const nodo = (d: Definicion, id: string): NodoDef => d.nodos.find((n) => n.id === id)!
const tipos = (d: Definicion) => (correr(d).ev.programas[0]?.comandos ?? []).filter((c) => c.tipo === 'PTP' || c.tipo === 'LIN').map((c) => c.tipo[0]).join('')
const mensajes = (d: Definicion, nivel: 'aviso' | 'error') => [...new Set((correr(d).sim?.problemas ?? []).filter((p) => p.nivel === nivel).map((p) => p.texto))]
const sinProblemas = (d: Definicion) => {
  const { ev } = correr(d)
  return Object.values(ev.nodos).every((r) => r.estado === 'ok')
}

describe('ejercicios de la Clase 2: lista', () => {
  it('hay doce, cada uno con su enunciado, y las fallas no dicen cuál es la falla', () => {
    expect(PRACTICA_ROBOT).toHaveLength(12)
    expect(PRACTICA_ROBOT.filter((e) => e.grupo === 'retos')).toHaveLength(3)
    expect(PRACTICA_ROBOT.filter((e) => e.grupo === 'clase')).toHaveLength(3)
    expect(PRACTICA_ROBOT.filter((e) => e.grupo === 'fallas')).toHaveLength(5)
    expect(PRACTICA_ROBOT.filter((e) => e.grupo === 'control')).toHaveLength(1)
    for (const e of PRACTICA_ROBOT.filter((x) => x.grupo === 'fallas')) {
      expect(e.enunciado).toBe(ENUNCIADO_FALLA)
      expect(e.titulo).toMatch(/^Falla [A-E]$/)
    }
    const control = PRACTICA_ROBOT.find((e) => e.grupo === 'control')!
    expect(control.enunciado).not.toMatch(/Divide Length|XY Plane|entrada O|salida P/i)
  })

  it('no hay guiones largos en lo que ve el alumno', () => {
    for (const e of PRACTICA_ROBOT) expect(`${e.titulo} ${e.enunciado}`).not.toMatch(/[—–]/)
  })
})

describe('Ej_CIR', () => {
  it('el arco pasa por el punto del medio y sale como semicírculo en el KRL', () => {
    const { sim } = correr(ejercicio('ej-cir'))
    expect(sim!.problemas).toEqual([])
    expect(sim!.krl).toMatch(/CIR \{X 50, Y 50, Z 0, A 0, B 90, C 0\}, \{X 100, Y 0, Z 0, A 0, B 90, C 0\} C_DIS/)
    // Semicírculo: el centro está en (50, 0) y el radio es 50; el punto del medio queda a 50 del centro.
    expect(Math.hypot(50 - 50, 50 - 0)).toBe(50)
  })

  it('con el punto del medio alineado avisa que se hace un movimiento recto', () => {
    const d = ejercicio('ej-cir')
    nodo(d, 'pb').params.y = 0
    expect(mensajes(d, 'aviso')).toContain('CIR: los tres puntos están alineados; se hace un movimiento recto.')
  })
})

describe('Ej_Weaver', () => {
  it('en secuencia da PPPLLL', () => {
    const d = ejercicio('ej-weaver')
    expect(nodo(d, 'w').params.modo).toBe('secuencia')
    expect(tipos(d)).toBe('PPPLLL')
  })

  it('intercalado da PLPLPL', () => {
    const d = ejercicio('ej-weaver')
    nodo(d, 'w').params.modo = 'intercalar'
    expect(tipos(d)).toBe('PLPLPL')
  })
})

describe('Ej_AXIS_KRL', () => {
  it('cada AXIS sale en el KRL como una línea PTP con los seis ángulos', () => {
    const { sim } = correr(ejercicio('ej-axis'))
    expect(sim!.problemas).toEqual([])
    expect(sim!.krl).toContain('PTP {A1 90, A2 -90, A3 90, A4 0, A5 0, A6 0}')
    expect(sim!.krl).toContain('PTP {A1 -90, A2 -90, A3 90, A4 0, A5 0, A6 0}')
    expect(sim!.krl).toContain('$OUT[2] = TRUE')
  })

  it('con A1 = 200 sale el error de rango', () => {
    const d = ejercicio('ej-axis')
    nodo(d, 'ax1').params.a1 = 200
    expect(mensajes(d, 'error')).toContain('AXIS: A1 = 200° está fuera de su rango.')
  })
})

describe('Fallas', () => {
  it('Falla A: la plancha queda fuera del alcance del KR 6 R900', () => {
    const d = ejercicio('falla-a')
    expect(nodo(d, 'rob').params.modelo).toBe('kr6r900')
    expect(mensajes(d, 'error').some((t) => /^Fuera de alcance/.test(t))).toBe(true)
  })

  it('Falla B: el corte baja 8 mm en una plancha de 5 mm y la fresa se entierra en el mesón', () => {
    const d = ejercicio('falla-b')
    expect(nodo(d, 'baj').params.z).toBe(-8)
    expect(nodo(d, 'core').params.espesor).toBe(5)
    expect(mensajes(d, 'error').some((t) => /^Choque: la herramienta atraviesa la plancha y se entierra en el mesón/.test(t))).toBe(true)
  })

  it('Falla C: el husillo nunca se enciende y la app no marca nada', () => {
    const d = ejercicio('falla-c')
    expect(d.nodos.some((n) => n.tipo === 'salida')).toBe(false)
    expect(sinProblemas(d)).toBe(true)
    expect(correr(d).sim!.problemas).toEqual([])
    expect(correr(d).sim!.krl).not.toContain('$OUT')
  })

  it('Falla D: la ranura de 10 mm se programa sin Offset y la app no marca nada', () => {
    const d = ejercicio('falla-d')
    expect(d.nodos.some((n) => n.tipo === 'desfase')).toBe(false)
    expect(sinProblemas(d)).toBe(true)
    expect(correr(d).sim!.problemas).toEqual([])
    // El recorrido sigue el borde de la ranura: la ranura mide 10 mm de ancho y el recorrido también.
    const lin = correr(d).ev.programas[0].comandos.filter((c) => c.tipo === 'LIN') as Array<{ plano: { o: { y: number } } }>
    const ys = lin.map((c) => c.plano.o.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(10, 1)
  })

  it('Falla E: eje cerca de su límite y salto brusco', () => {
    const d = ejercicio('falla-e')
    expect(mensajes(d, 'aviso')).toContain('Ejes cerca del límite: A6.')
    expect(mensajes(d, 'error').some((t) => /^Salto brusco de \d+° en un eje durante un movimiento recto/.test(t))).toBe(true)
  })
})

describe('Pregunta 2 del control', () => {
  it('mal conectada: XY Plane en rojo, LIN y Core en naranjo', () => {
    const d = ejercicio('control-p2')
    expect(d.nodos).toHaveLength(9)
    const { ev } = correr(d)
    expect(ev.nodos.xy.estado).toBe('error')
    expect(ev.nodos.xy.mensajes).toContain('O debe recibir puntos.')
    expect(ev.nodos.lin.estado).toBe('aviso')
    expect(ev.nodos.core.estado).toBe('aviso')
    expect(Object.entries(ev.nodos).filter(([, r]) => r.estado === 'ok')).toHaveLength(6)
  })

  it('la conexión mala sale de Rec y se ve: Rec y XY no tienen nada en medio', () => {
    const d = ejercicio('control-p2')
    const [rec, xy, div] = ['rec', 'xy', 'div'].map((id) => nodo(d, id))
    const malo = d.cables.find((c) => c.a === 'xy')!
    expect(malo.de).toBe('rec')
    // XY queda en otra fila, debajo de DivLength: el cable no pasa por detrás de ningún nodo.
    expect(xy.y).toBeGreaterThan(div.y + 150)
    expect(rec.x + 200).toBeLessThan(xy.x)
  })

  it('con el cable corregido (P de Divide Length a la entrada O de XY Plane) los nueve nodos quedan en ok', () => {
    const d = ejercicio('control-p2')
    d.cables = d.cables.filter((c) => c.a !== 'xy')
    d.cables.push({ de: 'div', salida: 0, a: 'xy', entrada: 0 })
    expect(componente('dividirLargo')!.salidas[0].corto).toBe('P')
    const { ev } = correr(d)
    expect(Object.values(ev.nodos).map((r) => r.estado)).toEqual(Array(9).fill('ok'))
    expect(ev.programas).toHaveLength(1)
  })
})


describe('Retos abiertos', () => {
  it('el reto de la figura parte con lápiz y se puede dibujar de varias maneras', () => {
    const d = ejercicio('reto-figura')
    expect(nodo(d, 'her').params.tipo).toBe('lapiz')
  })

  it('el reto de la posición corre y tiene combinaciones que funcionan y otras que no', () => {
    const ok = ejercicio('reto-posicion')
    expect(correr(ok).sim!.problemas.filter((p) => p.nivel === 'error')).toEqual([])
    const lejos = ejercicio('reto-posicion')
    nodo(lejos, 'core').params.bx = 1200
    expect(mensajes(lejos, 'error').length).toBeGreaterThan(0)
    const otroRobot = ejercicio('reto-posicion')
    nodo(otroRobot, 'rob').params.modelo = 'kr16'
    nodo(otroRobot, 'core').params.bx = 900
    expect(mensajes(otroRobot, 'error')).toEqual([])
  })

  it('el reto del tiempo: cambiar velocidades cambia el tiempo del ciclo', () => {
    const lento = correr(ejercicio('reto-tiempo')).sim!.tiempo
    const d = ejercicio('reto-tiempo')
    for (const n of d.nodos) if (n.tipo === 'lin') n.params.v = Number(n.params.v) * 4
    const rapido = correr(d).sim!.tiempo
    expect(rapido).toBeLessThan(lento)
    expect(correr(d).sim!.problemas.filter((p) => p.nivel === 'error')).toEqual([])
  })
})

/** Varios caminos para arreglar cada falla: no hay una sola respuesta correcta. */
describe('Fallas: más de un arreglo', () => {
  const errores = (d: Definicion) => mensajes(d, 'error')
  const agregarSalida = (d: Definicion, valor: boolean, salida = 1) => {
    const id = `salida-${valor}-${salida}`
    d.nodos.push({ id, tipo: 'salida', x: 0, y: 0, params: { salida, valor } })
    return id
  }

  it('A: se arregla acercando la plancha o con un robot de más alcance', () => {
    expect(errores(ejercicio('falla-a')).length).toBeGreaterThan(0)
    const cerca = ejercicio('falla-a')
    nodo(cerca, 'core').params.bx = 450
    expect(errores(cerca)).toEqual([])
    const masAlcance = ejercicio('falla-a')
    nodo(masAlcance, 'rob').params.modelo = 'kr16'
    expect(errores(masAlcance)).toEqual([])
    const otro = ejercicio('falla-a')
    nodo(otro, 'rob').params.modelo = 'kr50r2100'
    expect(errores(otro)).toEqual([])
  })

  it('B: se arregla cortando hasta -5 o -6 mm, o con una plancha más gruesa', () => {
    for (const z of [-5, -6]) {
      const d = ejercicio('falla-b')
      nodo(d, 'baj').params.z = z
      expect(errores(d)).toEqual([])
    }
    const gruesa = ejercicio('falla-b')
    nodo(gruesa, 'core').params.espesor = 8
    expect(errores(gruesa)).toEqual([])
  })

  it('C: se arregla con cualquier salida digital que se encienda antes del primer corte', () => {
    for (const salida of [1, 2]) {
      const d = ejercicio('falla-c')
      const id = agregarSalida(d, true, salida)
      d.cables.unshift({ de: id, salida: 0, a: 'core', entrada: 0 })
      const sim = correr(d).sim!
      expect(sim.problemas).toEqual([])
      expect(sim.krl).toContain(`$OUT[${salida}] = TRUE`)
      expect(sim.krl.indexOf(`$OUT[${salida}] = TRUE`)).toBeLessThan(sim.krl.indexOf('LIN'))
    }
  })

  it('D: se arregla con un Offset de 2,5 mm hacia adentro de la ranura (el recorrido queda de 5 mm de ancho)', () => {
    const d = ejercicio('falla-d')
    const antes = correr(d).ev.programas[0].comandos.filter((c) => c.tipo === 'LIN') as Array<{ plano: { o: { y: number } } }>
    const ancho = (cs: typeof antes) => Math.max(...cs.map((c) => c.plano.o.y)) - Math.min(...cs.map((c) => c.plano.o.y))
    expect(ancho(antes)).toBeCloseTo(10, 1)
    d.nodos.push({ id: 'off', tipo: 'desfase', x: 0, y: 0, params: { d: -2.5 } })
    d.cables = d.cables.filter((c) => !(c.de === 'crv' && c.a === 'baj'))
    d.cables.push({ de: 'crv', salida: 0, a: 'off', entrada: 0 }, { de: 'off', salida: 0, a: 'baj', entrada: 0 })
    const despues = correr(d).ev.programas[0].comandos.filter((c) => c.tipo === 'LIN') as Array<{ plano: { o: { y: number } } }>
    expect(ancho(despues)).toBeCloseTo(5, 1)
    expect(correr(d).sim!.problemas).toEqual([])
  })

  it('E: se arregla girando la base 180° o -90°', () => {
    expect(errores(ejercicio('falla-e')).length).toBeGreaterThan(0)
    for (const giro of [180, -90]) {
      const d = ejercicio('falla-e')
      nodo(d, 'core').params.brot = giro
      expect(correr(d).sim!.problemas.filter((p) => p.nivel === 'error')).toEqual([])
    }
  })
})
