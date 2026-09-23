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
import { EJERCICIOS_PLC, programaDeEjercicio } from '../plc/ejercicios'

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

describe('elevador y ejercicio 2 para resolver', () => {
  it('la planta hace su ciclo si se accionan las electroválvulas a mano', () => {
    const planta = new PlantaElevador()
    planta.accion('pieza')
    const paso = (q: Record<string, boolean>, s: number) => {
      for (let i = 0; i < s / 0.02; i++) planta.paso(q, 0.02)
    }
    paso({ 'Q0.0': true }, 2)
    expect(planta.sensores()['I0.2']).toBe(true)
    paso({ 'Q0.0': true, 'Q0.1': true }, 2)
    expect(planta.pieza).toBe('fuera')
    paso({}, 4)
    expect(planta.transferidas).toBe(1)
    expect(planta.eventos.filter((e) => e.aviso)).toEqual([])
  })

  it('el ejercicio viene sin solución: programa en blanco con la tabla de conexiones', () => {
    const ej = EJERCICIOS_PLC.find((e) => e.id === 'ejercicio2')!
    const p = programaDeEjercicio(ej)
    expect(p.escalones).toHaveLength(1)
    expect(p.escalones[0].bobinas.every((b) => b === null)).toBe(true)
    expect(p.simbolos.map((s) => s.nombre)).toEqual(['S0', 'S1', 'S2', 'S3', 'S4', 'Y1', 'Y2'])
    expect(EJEMPLOS_PLC.some((e) => e.programa.planta === 'elevador')).toBe(false)
  })

  it('primer escalón S0·S1·S3 → (L) Y1: Z1 sube al poner la pieza; con la bobina negada, al revés', () => {
    const ej = EJERCICIOS_PLC.find((e) => e.id === 'ejercicio2')!
    const conBobina = (tipo: 'set' | 'negada') => {
      const p = programaDeEjercicio(ej)
      p.escalones[0].celdas[0].splice(0, 3, NA('I0.0'), NA('I0.1'), NA('I0.3'))
      p.escalones[0].bobinas[0] = { tipo, dir: 'Q0.0' }
      return p
    }
    // Con enclavar (L): quieto sin pieza, sube con pieza.
    const planta = new PlantaElevador()
    const run = correr(conBobina('set'), planta, 1)
    expect(planta.z1).toBe(0)
    planta.accion('pieza')
    run.paso(2)
    expect(planta.z1).toBeGreaterThan(0.9)
    // Con la bobina negada (/): sube sin pieza (el escalón no tiene corriente).
    const planta2 = new PlantaElevador()
    correr(conBobina('negada'), planta2, 2)
    expect(planta2.z1).toBeGreaterThan(0.9)
  })

  it('verificar: un programa en blanco no pasa y dice en qué paso falla', () => {
    const ej = EJERCICIOS_PLC.find((e) => e.id === 'ejercicio2')!
    const r = ej.verificar(programaDeEjercicio(ej))
    expect(r.ok).toBe(false)
    expect(r.mensajes[0].ok).toBe(true)
    expect(r.mensajes.find((m) => !m.ok)?.texto).toMatch(/Paso 2/)
  })

  it('verificar: si Z1 sube sin esperar la pieza, falla el paso 1', () => {
    const ej = EJERCICIOS_PLC.find((e) => e.id === 'ejercicio2')!
    const p = programaDeEjercicio(ej)
    p.escalones[0].celdas[0][0] = { tipo: 'contacto', modo: 'NA', dir: 'I0.1' }
    p.escalones[0].bobinas[0] = { tipo: 'normal', dir: 'Q0.0' }
    const r = ej.verificar(p)
    expect(r.ok).toBe(false)
    expect(r.mensajes[0].ok).toBe(false)
  })
})

describe('plantas nuevas', () => {
  it('semáforo: el ejemplo alterna las calles sin dar paso a las dos a la vez', async () => {
    const { PlantaSemaforo } = await import('../plc/plantas')
    const planta = new PlantaSemaforo()
    const run = correr(ejemplo('semaforo'), planta, 0.2, { 'I0.0': true })
    run.paso(30)
    const pasoNS = (q: Record<string, boolean>) => q['Q0.2'] || q['Q0.1']
    const pasoEO = (q: Record<string, boolean>) => q['Q0.5'] || q['Q0.4']
    expect(run.historia.some((q) => pasoNS(q) && pasoEO(q))).toBe(false)
    expect(run.historia.some((q) => q['Q0.2'])).toBe(true)
    expect(run.historia.some((q) => q['Q0.5'])).toBe(true)
    expect(planta.eventos.filter((e) => e.aviso)).toEqual([])
    expect(planta.cruces).toBeGreaterThan(0)
  })

  it('portón: abre hasta arriba, cierra hasta abajo y la fotocelda detiene el cierre', async () => {
    const { PlantaPorton } = await import('../plc/plantas')
    const planta = new PlantaPorton()
    const run = correr(ejemplo('porton'), planta, 0.2, { 'I0.0': true })
    run.paso(6)
    expect(planta.apertura).toBeGreaterThan(0.99)
    expect(run.estado.bits['Q0.0']).toBe(false)
    planta.accion('obstaculo')
    run.paso(0.2, { 'I0.1': true })
    run.paso(3)
    expect(planta.apertura).toBeGreaterThan(0.99)
    planta.accion('obstaculo')
    run.paso(0.2, { 'I0.1': true })
    run.paso(6)
    expect(planta.apertura).toBeLessThan(0.01)
    expect(planta.eventos.filter((e) => e.aviso)).toEqual([])
  })

  it('portón: sin enclavamiento la planta avisa de SUBIR y BAJAR a la vez', async () => {
    const { PlantaPorton } = await import('../plc/plantas')
    const planta = new PlantaPorton()
    planta.paso({ 'Q0.0': true, 'Q0.1': true }, 0.02)
    expect(planta.eventos.some((e) => e.aviso && /a la vez/.test(e.mensaje))).toBe(true)
  })

  it('silo: la cinta lleva la caja al sensor, la válvula la llena y LEVEL avisa', async () => {
    const { PlantaSilo } = await import('../plc/plantas')
    const planta = new PlantaSilo()
    // Sin programa: se accionan las salidas a mano para probar la planta.
    let n = 0
    while (!planta.sensores()['I0.3'] && n++ < 1000) planta.paso({ 'Q0.0': true }, 0.02)
    expect(planta.sensores()['I0.3']).toBe(true)
    n = 0
    while (!planta.sensores()['I0.4'] && n++ < 1000) planta.paso({ 'Q0.1': true }, 0.02)
    expect(planta.sensores()['I0.4']).toBe(true)
    expect(planta.eventos.filter((e) => e.aviso)).toEqual([])
    planta.paso({ 'Q0.1': true, 'Q0.0': true }, 0.02)
    expect(planta.eventos.some((e) => e.aviso)).toBe(true)
  })
})
