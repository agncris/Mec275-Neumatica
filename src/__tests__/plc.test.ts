/**
 * Unidad de PLC: el ciclo de scan, cada instrucción Ladder y los ejercicios
 * del apunte funcionando contra su planta.
 */
import { describe, expect, it } from 'vitest'
import {
  COLUMNAS,
  esProgramaPLC,
  estadoInicial,
  leer,
  resolverEscalon,
  revisarPrograma,
  scan,
  type Celda,
  type Escalon,
  type ProgramaPLC,
} from '../plc/ladder'
import { EJEMPLOS_PLC } from '../plc/ejemplos'
import { PlantaElevador, PlantaEstanque, crearPlanta, type Planta } from '../plc/plantas'

const NA = (dir: string): Celda => ({ tipo: 'contacto', modo: 'NA', dir })
const NC = (dir: string): Celda => ({ tipo: 'contacto', modo: 'NC', dir })
const _: Celda = { tipo: 'vacio' }
const fila = (...c: Celda[]) => [...c, ...Array(COLUMNAS - c.length).fill(_)] as Celda[]
const ejemplo = (id: string) => structuredClone(EJEMPLOS_PLC.find((e) => e.id === id)!.programa)

/** Corre programa + planta juntos, como la aplicación. */
function correr(p: ProgramaPLC, planta: Planta, segundos: number, mandos: Record<string, boolean> = {}, dt = 0.02) {
  const estado = estadoInicial()
  const salidas = () => Object.fromEntries(Object.entries(estado.bits).filter(([d]) => d.startsWith('Q')))
  const historia: Array<Record<string, boolean>> = []
  const paso = (n: number, m: Record<string, boolean>) => {
    for (let i = 0; i < n; i++) {
      scan(p, estado, { ...m, ...planta.sensores() }, dt)
      planta.paso(salidas(), dt)
      historia.push({ ...salidas() })
    }
  }
  paso(Math.round(segundos / dt), mandos)
  return { estado, paso: (s: number, m: Record<string, boolean> = {}) => paso(Math.round(s / dt), m), historia }
}

describe('ciclo de scan', () => {
  it('serie, paralelo y contacto cerrado se comportan como Y, O y NO', () => {
    const p = ejemplo('logica')
    const casos: Array<[boolean, boolean, [boolean, boolean, boolean]]> = [
      [false, false, [false, false, true]],
      [true, false, [false, true, false]],
      [false, true, [false, true, true]],
      [true, true, [true, true, false]],
    ]
    for (const [a, b, [y, o, no]] of casos) {
      const e = estadoInicial()
      scan(p, e, { 'I0.4': a, 'I0.5': b }, 0.02)
      expect([e.bits['Q0.0'], e.bits['Q0.1'], e.bits['Q0.2']], `${a},${b}`).toEqual([y, o, no])
    }
  })

  it('la autorretención mantiene la marcha al soltar y el paro la corta', () => {
    const p = ejemplo('marcha')
    const e = estadoInicial()
    scan(p, e, { 'I0.0': true }, 0.02)
    scan(p, e, {}, 0.02)
    expect(e.bits['Q0.0']).toBe(true)
    scan(p, e, { 'I0.1': true }, 0.02)
    scan(p, e, {}, 0.02)
    expect(e.bits['Q0.0']).toBe(false)
  })

  it('Set y Reset: si se pulsan los dos, gana el que va después', () => {
    const p = ejemplo('setreset')
    const e = estadoInicial()
    scan(p, e, { 'I0.0': true }, 0.02)
    scan(p, e, {}, 0.02)
    expect(e.bits['Q0.0']).toBe(true)
    scan(p, e, { 'I0.0': true, 'I0.1': true }, 0.02)
    expect(e.bits['Q0.0']).toBe(false)
  })

  it('TON: termina a los 3 s y vuelve a cero si se suelta antes', () => {
    const p = ejemplo('ton')
    const e = estadoInicial()
    for (let i = 0; i < 100; i++) scan(p, e, { 'I0.4': true }, 0.02) // 2 s
    expect(e.bits['Q0.0']).toBe(false)
    scan(p, e, {}, 0.02)
    expect(e.temporizadores.T0.acumulado).toBe(0)
    for (let i = 0; i < 151; i++) scan(p, e, { 'I0.4': true }, 0.02)
    expect(e.bits['Q0.0']).toBe(true)
  })

  it('el intermitente parpadea una vez por segundo', () => {
    const p = ejemplo('intermitente')
    const e = estadoInicial()
    let cambios = 0
    let antes = false
    for (let i = 0; i < 250; i++) {
      scan(p, e, { 'I0.4': true }, 0.02)
      if (e.bits['Q0.2'] !== antes) cambios++
      antes = e.bits['Q0.2']
    }
    // 5 s → unas 5 subidas y 5 bajadas.
    expect(cambios).toBeGreaterThanOrEqual(8)
    expect(cambios).toBeLessThanOrEqual(11)
  })

  it('CTU cuenta flancos, no tiempo pulsado, y el reset lo vuelve a cero', () => {
    const p = ejemplo('contador')
    const e = estadoInicial()
    for (let n = 0; n < 4; n++) {
      for (let i = 0; i < 10; i++) scan(p, e, { 'I0.2': true }, 0.02)
      scan(p, e, {}, 0.02)
    }
    expect(e.contadores.C0.valor).toBe(4)
    expect(e.bits['Q0.3']).toBe(false)
    scan(p, e, { 'I0.2': true }, 0.02)
    expect(e.bits['Q0.3']).toBe(true)
    scan(p, e, { 'I0.3': true }, 0.02)
    expect(leer(e, 'C0')).toBe(false)
    expect(e.contadores.C0.valor).toBe(0)
  })

  it('una rama con bobina sólo recibe corriente por su enlace, no de la barra', () => {
    const esc: Escalon = {
      celdas: [fila(NA('I0.0'), NA('I0.1')), fila()],
      enlaces: [Array(COLUMNAS + 1).fill(false).map((_, n) => n === 1)],
      bobinas: [{ tipo: 'normal', dir: 'Q0.0' }, { tipo: 'normal', dir: 'Q0.1' }],
    }
    const lee = (on: string[]) => (d: string) => on.includes(d)
    expect(resolverEscalon(esc, lee([])).bobinas).toEqual([false, false])
    expect(resolverEscalon(esc, lee(['I0.0'])).bobinas).toEqual([false, true])
    expect(resolverEscalon(esc, lee(['I0.0', 'I0.1'])).bobinas).toEqual([true, true])
  })

  it('la corriente no vuelve hacia atrás por un contacto', () => {
    // Fila 0: I0.0 ─ I0.1 ─ (Q0.0). Fila 1: NC I0.2 en la columna 1, enlazada
    // en los nodos 1 y 2. Sin I0.0 no puede haber corriente, cierre lo que cierre.
    const esc: Escalon = {
      celdas: [fila(NA('I0.0'), NA('I0.1')), fila(_, NC('I0.2'))],
      enlaces: [Array(COLUMNAS + 1).fill(false).map((_, n) => n === 1 || n === 2)],
      bobinas: [{ tipo: 'normal', dir: 'Q0.0' }, null],
    }
    expect(resolverEscalon(esc, () => false).bobinas[0]).toBe(false)
    expect(resolverEscalon(esc, (d) => d === 'I0.0').bobinas[0]).toBe(true)
  })

  it('avisa de los errores típicos', () => {
    const p = ejemplo('marcha')
    p.escalones.push(structuredClone(p.escalones[0]))
    expect(revisarPrograma(p).join(' ')).toMatch(/tiene bobina en los escalones 1 y 2/)
    p.escalones[1].bobinas[0] = { tipo: 'normal', dir: 'I0.3' }
    expect(revisarPrograma(p).join(' ')).toMatch(/es una entrada/)
  })

  it('todos los ejemplos son programas válidos y sin avisos', () => {
    for (const e of EJEMPLOS_PLC) {
      expect(esProgramaPLC(e.programa), e.id).toBe(true)
      expect(revisarPrograma(e.programa), e.id).toEqual([])
      expect(() => crearPlanta(e.programa.planta)).not.toThrow()
    }
  })
})

describe('Ejercicio 1 · estanque', () => {
  it('llena hasta S2, vacía hasta S1 y repite, sin abrir nunca V1 y V2 a la vez', () => {
    const planta = new PlantaEstanque()
    const run = correr(ejemplo('ej1'), planta, 0.2, { 'I0.1': true })
    run.paso(30)
    expect(run.historia.some((q) => q['Q0.1'] && q['Q0.2'])).toBe(false)
    expect(planta.eventos.filter((e) => e.aviso)).toEqual([])
    // Tras 30 s ha llenado y vaciado al menos una vez completa.
    const aperturasV2 = run.historia.filter((q, i) => q['Q0.2'] && !run.historia[i - 1]?.['Q0.2']).length
    expect(aperturasV2).toBeGreaterThanOrEqual(2)
    expect(planta.nivel).toBeLessThan(1)
  })

  it('STOP cierra las dos válvulas', () => {
    const planta = new PlantaEstanque()
    const run = correr(ejemplo('ej1'), planta, 0.2, { 'I0.1': true })
    run.paso(3)
    expect(run.estado.bits['Q0.1']).toBe(true)
    run.paso(0.2, { 'I0.2': true })
    run.paso(2)
    expect(run.estado.bits['Q0.1']).toBe(false)
    expect(run.estado.bits['Q0.2']).toBe(false)
  })

  it('un programa que olvida S2 hace rebalsar el estanque, y la planta lo avisa', () => {
    const p = ejemplo('ej1')
    p.escalones[1].celdas[1][2] = { tipo: 'cable' } // S1·S2' → S1 a secas
    const planta = new PlantaEstanque()
    const run = correr(p, planta, 0.2, { 'I0.1': true })
    run.paso(15)
    expect(planta.eventos.some((e) => e.aviso && /rebalsa|a la vez/.test(e.mensaje))).toBe(true)
  })
})

describe('Ejercicio 2 · elevador', () => {
  it('con una pieza hace Z1+ Z2+ Z2− Z1− y la deja en la banda', () => {
    const planta = new PlantaElevador()
    const run = correr(ejemplo('ej2'), planta, 0.5)
    expect(run.estado.bits['Q0.0']).toBe(false)
    planta.accion('pieza')
    run.paso(12)
    const orden: string[] = []
    let [y1, y2] = [false, false]
    for (const q of run.historia) {
      if (q['Q0.0'] !== y1) orden.push(q['Q0.0'] ? 'Z1+' : 'Z1−')
      if (q['Q0.1'] !== y2) orden.push(q['Q0.1'] ? 'Z2+' : 'Z2−')
      y1 = q['Q0.0']
      y2 = q['Q0.1']
    }
    expect(orden).toEqual(['Z1+', 'Z2+', 'Z2−', 'Z1−'])
    expect(planta.transferidas).toBe(1)
    expect(planta.eventos.filter((e) => e.aviso)).toEqual([])
    expect(planta.z1).toBe(0)
  })

  it('con alimentación automática repite el ciclo con cada pieza', () => {
    const planta = new PlantaElevador()
    const run = correr(ejemplo('ej2'), planta, 0.2)
    planta.accion('auto')
    run.paso(40)
    expect(planta.transferidas).toBeGreaterThanOrEqual(3)
  })

  it('sin pieza no arranca', () => {
    const planta = new PlantaElevador()
    const run = correr(ejemplo('ej2'), planta, 5)
    expect(run.historia.some((q) => q['Q0.0'] || q['Q0.1'])).toBe(false)
  })
})
