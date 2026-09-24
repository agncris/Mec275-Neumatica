import { describe, expect, it } from 'vitest'
import { EJEMPLOS_ROBOT } from '../robot/ejemplos'
import { dxfDeEjemplo, largoCurva, leerDXF, rectangulo, dividirLargo, discontinuidades, desfasar, areaCentro } from '../robot/geometria'
import { componente, evaluar, paramsIniciales, type Definicion } from '../robot/nodos'
import { planoXY, v } from '../robot/matematica'
import { robotPorId } from '../robot/robots'
import { simular } from '../robot/movimiento'

describe('ejemplos de robótica', () => {
  for (const ej of EJEMPLOS_ROBOT) {
    it(`${ej.titulo} se evalúa y simula sin errores`, () => {
      const d = ej.definicion()
      const dxf = d.dxf ? leerDXF(d.dxf.texto) : null
      const ev = evaluar(d, dxf)
      const malos = Object.entries(ev.nodos).filter(([, r]) => r.estado !== 'ok')
      if (ej.id === 'vacio') {
        expect(ev.programas).toHaveLength(0)
        return
      }
      expect(malos.map(([id, r]) => `${id}: ${r.mensajes.join(' ')}`)).toEqual([])
      expect(ev.programas).toHaveLength(1)
      const sim = simular(ev.programas[0])
      console.log(ej.id, sim.tiempo.toFixed(1), 's', sim.muestras.length, sim.problemas.map((p) => p.texto))
      expect(sim.problemas.filter((p) => p.nivel === 'error')).toEqual([])
      expect(sim.krl).toMatch(/^&ACCESS RVP/)
      expect(sim.krl).toMatch(/LIN \{X/)
    })
  }
})

describe('geometría y DXF', () => {
  it('lee el DXF de ejemplo: contorno con arcos, 4 agujeros y la ranura encadenada', () => {
    const d = leerDXF(dxfDeEjemplo())
    expect(d.avisos).toEqual([])
    const capas = (c: string) => d.curvas.filter((k) => k.capa === c)
    expect(capas('AGUJEROS')).toHaveLength(4)
    expect(capas('CONTORNO')).toHaveLength(1)
    expect(capas('RANURA')).toHaveLength(1)
    expect(capas('RANURA')[0].cerrada).toBe(true)
    // Perímetro: 2·(160+100) + 2π·10.
    expect(largoCurva(capas('CONTORNO')[0])).toBeCloseTo(520 + 2 * Math.PI * 10, 0)
    expect(largoCurva(capas('RANURA')[0])).toBeCloseTo(80 + 2 * Math.PI * 8, 0)
    expect(areaCentro(capas('AGUJEROS')[0]).centro.x).toBeCloseTo(15, 1)
  })
  it('Divide Length, Discontinuity y Offset', () => {
    const r = rectangulo(100, 50)
    expect(dividirLargo(r, 10)).toHaveLength(30)
    expect(discontinuidades(r)).toHaveLength(4)
    const o = desfasar(r, 5)
    expect(o.pts[0]).toMatchObject({ x: -5, y: -5 })
    expect(largoCurva(o)).toBeCloseTo(2 * (110 + 60))
  })
})


function defMin(nodos: Array<[string, string, Record<string, unknown>?]>, cables: Array<[string, number, string, number]>): Definicion {
  return {
    version: 1,
    tipo: 'definicion-robot',
    nombre: 't',
    nodos: nodos.map(([id, tipo, p]) => ({ id, tipo, x: 0, y: 0, params: { ...paramsIniciales(componente(tipo)!), ...(p ?? {}) } as never })),
    cables: cables.map(([de, salida, a, entrada]) => ({ de, salida, a, entrada })),
  }
}

describe('evaluación de la definición', () => {
  it('colores de estado: naranjo si faltan datos, rojo si hay error', () => {
    const ev = evaluar(defMin([['d', 'dividirLargo'], ['c', 'curvaDXF']], []), null)
    expect(ev.nodos.d.estado).toBe('aviso')
    expect(ev.nodos.c.estado).toBe('error')
    expect(ev.nodos.c.mensajes[0]).toMatch(/Abrir DXF/)
  })
  it('detecta ciclos', () => {
    const ev = evaluar(defMin([['a', 'unir'], ['b', 'unir']], [['a', 0, 'b', 0], ['b', 0, 'a', 0]]), null)
    expect(ev.ciclo).toBe(true)
  })
  it('List Item con índices negativos y Weave intercalado', () => {
    const d = defMin(
      [
        ['r', 'rectangulo'],
        ['disc', 'discontinuidad'],
        ['it', 'item', { i: -1 }],
      ],
      [
        ['r', 0, 'disc', 0],
        ['disc', 0, 'it', 0],
      ],
    )
    const ev = evaluar(d, null)
    expect(ev.nodos.disc.salidas[0]).toHaveLength(4)
    expect(ev.nodos.it.salidas[0][0]).toMatchObject({ x: 0, y: 100 })
  })
  it('un punto fuera de alcance se marca como error', () => {
    const d = defMin(
      [
        ['p', 'punto', { x: 3000, y: 0, z: 0 }],
        ['xy', 'planoXY'],
        ['lin', 'lin'],
        ['rob', 'robot'],
        ['her', 'herramienta'],
        ['core', 'core'],
      ],
      [
        ['p', 0, 'xy', 0],
        ['xy', 0, 'lin', 0],
        ['lin', 0, 'core', 0],
        ['rob', 0, 'core', 1],
        ['her', 0, 'core', 2],
      ],
    )
    const sim = simular(evaluar(d, null).programas[0])
    expect(sim.problemas.some((p) => p.nivel === 'error' && /alcance/.test(p.texto))).toBe(true)
  })
  it('CIR recorre un arco por el punto auxiliar y el KRL tiene sus dos puntos', () => {
    const prog = {
      comandos: [
        { tipo: 'PTP' as const, plano: planoXY(v(0, 0, 0)), vel: 30, nodo: 'x' },
        { tipo: 'CIR' as const, aux: planoXY(v(50, 50, 0)), plano: planoXY(v(100, 0, 0)), vel: 0.05, nodo: 'x' },
      ],
      robot: { modelo: robotPorId('kr16'), pedestal: 0 },
      herramienta: { tipo: 'fresa' as const, nombre: 'f', largo: 200, diametro: 5 },
      base: planoXY(v(900, 0, 200)),
      espesor: 5,
      inicio: [0, -90, 90, 0, 0, 0],
      nodo: 'x',
    }
    const sim = simular(prog)
    expect(sim.problemas.filter((p) => p.nivel === 'error')).toEqual([])
    const medio = sim.muestras.filter((m) => m.cmd === 1)
    const alto = Math.max(...medio.map((m) => m.tcp.y))
    expect(alto).toBeCloseTo(50, 0)
    expect(sim.krl).toMatch(/CIR \{X 50, Y 50, Z 0/)
    expect(sim.krl).toMatch(/\$BASE = \{X 900, Y 0, Z 200/)
  })
})

describe('choques con el mesón y la plancha', () => {
  const programa = (z: number, base = planoXY(v(900, 0, 300))) => ({
    comandos: [
      { tipo: 'PTP' as const, plano: planoXY(v(50, 50, 20)), vel: 30, nodo: 'a' },
      { tipo: 'LIN' as const, plano: planoXY(v(50, 50, z)), vel: 0.05, nodo: 'b' },
    ],
    robot: { modelo: robotPorId('kr16'), pedestal: 0 },
    herramienta: { tipo: 'fresa' as const, nombre: 'f', largo: 200, diametro: 6 },
    base,
    espesor: 5,
    inicio: [0, -90, 90, 0, 0, 0],
    nodo: 'x',
  })
  it('cortar la plancha no es choque; enterrarse en el mesón sí', () => {
    expect(simular(programa(-5)).problemas.filter((p) => p.nivel === 'error')).toEqual([])
    const malo = simular(programa(-30)).problemas.find((p) => /Choque/.test(p.texto))
    expect(malo?.texto).toMatch(/mesón/)
    expect(malo?.nodo).toBe('b')
  })
  it('avisa si el mesón queda encima del robot', () => {
    const sim = simular(programa(20, planoXY(v(100, 0, 300))), { x0: -200, y0: -200, x1: 200, y1: 200 })
    expect(sim.problemas.some((p) => /Choque: la base del robot/.test(p.texto))).toBe(true)
  })
})

describe('robot personalizado', () => {
  it('usa las medidas propias y los rangos del modelo elegido', () => {
    const comp = componente('robot')!
    const p = { ...paramsIniciales(comp), modelo: 'personalizado', como: 'kr16', a2: 700, d4: 600, nombre: 'Robot del taller' }
    const r = comp.evaluar([], p, { id: 'r' } as never).salidas[0][0] as { modelo: { nombre: string; a2: number; alcance: number; limites: unknown } }
    expect(r.modelo.nombre).toBe('Robot del taller')
    expect(r.modelo.a2).toBe(700)
    expect(r.modelo.limites).toEqual(robotPorId('kr16').limites)
    expect(r.modelo.alcance).toBe(Math.round(25 + 700 + Math.hypot(35, 600)))
    const malo = comp.evaluar([], { ...p, a2: 0 }, { id: 'r' } as never)
    expect(malo.error).toMatch(/más de 0/)
  })
})

describe('croquis para el informe', () => {
  it('acota la pieza y reconoce los círculos', async () => {
    const { croquisPieza } = await import('../robot/croquis')
    const { circulo } = await import('../robot/geometria')
    const svg = croquisPieza([rectangulo(120, 80, 0, v(10, 5, 0)), circulo(v(70, 45, 0), 15), rectangulo(120, 80, 0, v(10, 5, -5))], 'placa')
    expect(svg).toMatch(/^<svg/)
    expect(svg).toContain('>120<')
    expect(svg).toContain('>80<')
    expect(svg).toContain('Ø30 · centro (70; 45)')
    expect(svg).toContain('esquina en (10; 5)')
  })
  it('dibuja la posición del robot y dice si la plancha queda al alcance', async () => {
    const { croquisPosicion } = await import('../robot/croquis')
    const datos = { modelo: robotPorId('kr6r900'), pedestal: 0, base: planoXY(v(450, -150, 300)), espesor: 5, placa: { x0: -20, y0: -20, x1: 220, y1: 170 }, herramienta: { tipo: 'fresa' as const, nombre: 'Fresa', largo: 150, diametro: 6 } }
    const svg = croquisPosicion(datos, 'celda')
    expect(svg).toContain('X 450')
    expect(svg).toContain('Y -150')
    expect(svg).toContain('✓ al alcance')
    expect(croquisPosicion({ ...datos, base: planoXY(v(1500, 0, 300)) }, 'lejos')).toContain('✗ fuera del alcance')
  })
})
