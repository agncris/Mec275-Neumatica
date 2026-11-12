import { describe, expect, it } from 'vitest'
import publico from '../../public/plano-tarea4-robotica.dxf?raw'
import { cajaCurvas, leerDXF } from '../robot/geometria'
import { componente, paramsIniciales, type Definicion, type NodoDef, type ValorParam } from '../robot/nodos'
import { PLANO_TAREA4_DXF } from '../robot/planoTarea4'
import { adaptarATarea, analizarTarea4, esPlanoDeLaTarea, revisarTarea4, tareaVaciaRobot } from '../robot/tarea4'

describe('plano de la Tarea 4', () => {
  const dxf = leerDXF(PLANO_TAREA4_DXF)
  const caja = (capa: string) => cajaCurvas(dxf.curvas.filter((c) => c.capa === capa))

  it('el archivo público es el mismo que usa la app', () => {
    expect(publico.replace(/\r/g, '').trim()).toBe(PLANO_TAREA4_DXF.replace(/\r/g, '').trim())
  })

  it('está en mm, con el contorno en CONTORNO y las nueve ranuras en RANURAS', () => {
    expect(dxf.unidades).toBe('mm')
    expect(dxf.avisos).toEqual([])
    expect(dxf.curvas).toHaveLength(10)
    expect(dxf.curvas.filter((c) => c.capa === 'CONTORNO')).toHaveLength(1)
    expect(dxf.curvas.filter((c) => c.capa === 'RANURAS')).toHaveLength(9)
  })

  it('la plancha mide 250 x 250 mm (cota de la lámina)', () => {
    const { min, max } = caja('CONTORNO')
    expect(max.x - min.x).toBeCloseTo(250, 1)
    expect(max.y - min.y).toBeCloseTo(250, 1)
  })

  it('las cotas de la lámina coinciden con el DXF: 120, 159,64, 25,13, 65,23 y 10 mm', () => {
    const c = caja('CONTORNO')
    const ranuras = dxf.curvas.filter((r) => r.capa === 'RANURAS')
    const recta = (r: (typeof ranuras)[number]) => {
      const { min, max } = cajaCurvas([r])
      return { w: max.x - min.x, h: max.y - min.y, min, max }
    }
    // Ranuras rectas: 65,23 x 10 (las curvas de las puntas tienen una flecha de menos de 0,2 mm).
    const rectas = ranuras.map(recta).filter((r) => Math.abs(r.w - 10) < 0.4 || Math.abs(r.h - 10) < 0.4).filter((r) => Math.max(r.w, r.h) > 60 && Math.max(r.w, r.h) < 66)
    expect(rectas).toHaveLength(4)
    for (const r of rectas) expect(Math.max(r.w, r.h)).toBeGreaterThan(65.2)
    // Borde izquierdo a la ranura horizontal izquierda: 25,13. Al borde de la ranura vertical: 120.
    const horizontales = rectas.filter((r) => r.w > r.h).sort((a, b) => a.min.x - b.min.x)
    expect(horizontales[0].min.x - c.min.x).toBeCloseTo(25.13, 0)
    expect(horizontales[1].min.x - c.min.x).toBeCloseTo(159.64, 0)
    const verticales = rectas.filter((r) => r.h > r.w)
    expect(Math.min(...verticales.map((r) => r.min.x)) - c.min.x).toBeCloseTo(120, 0)
  })
})

describe('definición de la tarea', () => {
  it('parte con robot, fresa de 5 mm y Core de 5 mm, con el plano cargado', () => {
    const d = tareaVaciaRobot()
    expect(d.nodos.map((n) => n.tipo).sort()).toEqual(['core', 'herramienta', 'robot'])
    expect(d.nodos.find((n) => n.tipo === 'herramienta')!.params).toMatchObject({ tipo: 'fresa', diametro: 5 })
    expect(d.nodos.find((n) => n.tipo === 'core')!.params.espesor).toBe(5)
    expect(esPlanoDeLaTarea(d)).toBe(true)
  })

  it('un plano modificado deja de ser el de la tarea', () => {
    const d = tareaVaciaRobot()
    d.dxf = { nombre: 'otro.dxf', texto: PLANO_TAREA4_DXF.replace('RANURAS', 'OTRA') }
    expect(esPlanoDeLaTarea(d)).toBe(false)
  })

  it('en blanco, la revisión avisa lo que falta y no inventa nada', () => {
    const a = analizarTarea4(tareaVaciaRobot())
    expect(a.hayPrograma).toBe(false)
    expect(a.herramienta).toMatchObject({ tipo: 'fresa', diametro: 5 })
    const r = revisarTarea4(a, '')
    const textos = r.map((x) => x.texto).join(' ')
    expect(r[0].ok).toBe(true) // plano de la tarea
    expect(r[1].ok).toBe(true) // fresa de 5 mm
    expect(textos).toMatch(/Falta tu nombre/)
    expect(r.filter((x) => x.ok)).toHaveLength(3)
  })
})

/** Un programa mínimo: sólo el contorno exterior, con y sin compensar. */
function soloContorno(d: number, o: { mover?: [number, number]; dividir?: 'largo' | 'cantidad'; robot?: string; bx?: number; giro?: number } = {}): Definicion {
  const base = tareaVaciaRobot()
  const nodos: NodoDef[] = base.nodos.filter((n) => n.tipo !== 'core')
  const add = (id: string, tipo: string, params: Record<string, ValorParam> = {}) => {
    const comp = componente(tipo)!
    nodos.push({ id, tipo, x: 0, y: 0, params: { ...paramsIniciales(comp), ...params } })
  }
  add('crv', 'curvaDXF', { capa: 'CONTORNO' })
  add('of', 'desfase', { d })
  add('bj', 'mover', { x: o.mover?.[0] ?? 0, y: o.mover?.[1] ?? 0, z: -5 })
  add(o.dividir === 'cantidad' ? 'dv' : 'dv', o.dividir === 'cantidad' ? 'dividirCurva' : 'dividirLargo', o.dividir === 'cantidad' ? { n: 220 } : { l: 4 })
  add('px', 'planoXY')
  add('ln', 'lin', { v: 0.02 })
  add('core', 'core', { bx: o.bx ?? 425, by: -125, bz: 300, espesor: 5, brot: o.giro ?? 0 })
  if (o.robot) nodos.find((n) => n.id === 'rob')!.params.modelo = o.robot
  const cables = [
    ...base.cables.filter((c) => c.a !== 'core'),
    ...[
      ['crv', 0, 'of', 0],
      ['of', 0, 'bj', 0],
      ['bj', 0, 'dv', 0],
      ['dv', 0, 'px', 0],
      ['px', 0, 'ln', 0],
      ['ln', 0, 'core', 0],
      ['rob', 0, 'core', 1],
      ['her', 0, 'core', 2],
    ].map(([de, salida, a, entrada]) => ({ de: de as string, salida: salida as number, a: a as string, entrada: entrada as number })),
  ]
  return { ...base, nodos, cables }
}

describe('análisis de un trabajo', () => {
  it('reconoce el contorno compensado y cuenta una de diez piezas del plano', () => {
    const a = analizarTarea4(soloContorno(2.5))
    expect(a.hayPrograma).toBe(true)
    expect(a.errores).toEqual([])
    expect(a.trazosRecorridos).toBe(1)
    expect(a.trazos.find((t) => t.nombre === 'contorno')!.cobertura).toBeGreaterThan(0.95)
    expect(a.profundidadCorte).toBeCloseTo(5, 1)
  })

  it('sin compensar, el contorno se recorre sobre el borde y no cuenta como compensado', () => {
    const a = analizarTarea4(soloContorno(0))
    expect(a.trazosRecorridos).toBe(0)
    const t = a.trazos.find((x) => x.nombre === 'contorno')!
    expect(t.coberturaSinCompensar).toBeGreaterThan(0.9)
    expect(t.cobertura).toBeLessThan(0.5)
  })

  it('avisa que el husillo no está encendido y que se corta desde HOME con LIN en el aire', () => {
    const a = analizarTarea4(soloContorno(2.5))
    expect(a.husilloAntesDelCorte).toBe(false)
    const r = revisarTarea4(a, 'Ana Pérez')
    expect(r.find((x) => /husillo/i.test(x.texto))!.ok).toBe(false)
    expect(r.find((x) => /nombre/i.test(x.texto))!.ok).toBe(true)
  })
})


describe('caminos propios: la tarea no tiene una sola solución', () => {
  it('si corre el plano con Move (otra posición en la pieza), igual reconoce el contorno', () => {
    const a = analizarTarea4(soloContorno(2.5, { mover: [60, 35] }))
    expect(a.errores).toEqual([])
    expect(a.trazosRecorridos).toBe(1)
  })

  it('si divide la curva por cantidad en vez de por largo (Divide Curve), igual cuenta', () => {
    const a = analizarTarea4(soloContorno(2.5, { dividir: 'cantidad' }))
    expect(a.trazosRecorridos).toBe(1)
  })

  it('la posición y el giro de la base no cambian lo que mide: se mide en el sistema de la pieza', () => {
    const base = analizarTarea4(soloContorno(2.5))
    const otro = analizarTarea4(soloContorno(2.5, { bx: 500, giro: 20 }))
    expect(otro.trazosRecorridos).toBe(base.trazosRecorridos)
    expect(otro.base?.giro).toBeCloseTo(20, 1)
  })

  it('con otros robots (que alcancen) también mide el recorrido', () => {
    for (const robot of ['kr10r1100', 'kr50r2100']) {
      const a = analizarTarea4(soloContorno(2.5, { robot, bx: 600 }))
      expect(a.robot).toBe(robot)
      expect(a.trazosRecorridos).toBe(1)
    }
  })

  it('una definición del Laboratorio se trae a la tarea con el plano de la tarea y se avisa', () => {
    const d = tareaVaciaRobot()
    d.dxf = { nombre: 'otro.dxf', texto: PLANO_TAREA4_DXF.replace('RANURAS', 'OTRA') }
    const { def, cambioElPlano } = adaptarATarea(d)
    expect(cambioElPlano).toBe(true)
    expect(esPlanoDeLaTarea(def)).toBe(true)
    expect(def.nodos).toEqual(d.nodos)
    const sinPlano = adaptarATarea({ ...tareaVaciaRobot(), dxf: null })
    expect(sinPlano.cambioElPlano).toBe(true)
    expect(adaptarATarea(tareaVaciaRobot()).cambioElPlano).toBe(false)
  })
})
