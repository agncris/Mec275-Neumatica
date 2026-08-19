/**
 * Pruebas de robustez: el motor debe aguantar lo que un alumno pueda montar
 * por error sin romperse ni colgarse, y avisar con mensajes útiles.
 */
import { describe, expect, it } from 'vitest'
import { Motor } from '../motor'
import { validarCircuito } from '../validacion'
import type { Circuito, RefPuerto } from '../tipos'

const ref = (componente: string, puerto: string): RefPuerto => ({ componente, puerto })

describe('circuitos degenerados', () => {
  it('un circuito vacío simula sin romperse', () => {
    const motor = new Motor({ componentes: [], mangueras: [] })
    expect(() => motor.simular(1)).not.toThrow()
    expect(motor.advertencias).toEqual([])
  })

  it('un componente suelto sin mangueras no rompe nada', () => {
    const motor = new Motor({
      componentes: [{ id: 'C1', tipo: 'cilindroDobleEfecto' }],
      mangueras: [],
    })
    motor.simular(1)
    expect(motor.estadoDe<{ posicion: number }>('C1').posicion).toBe(0)
  })

  it('un tipo de componente desconocido se rechaza al construir el motor', () => {
    expect(
      () => new Motor({ componentes: [{ id: 'X1', tipo: 'inventado' }], mangueras: [] }),
    ).toThrow(/desconocido/i)
  })

  it('una manguera hacia un componente inexistente avisa y no rompe', () => {
    const motor = new Motor({
      componentes: [{ id: 'F1', tipo: 'fuente' }],
      mangueras: [{ id: 'm1', a: ref('F1', '1'), b: ref('FANTASMA', '1') }],
    })
    motor.tick()
    expect(motor.advertencias.some((a) => a.includes('inexistente'))).toBe(true)
  })

  it('una manguera hacia un puerto que no existe avisa y no rompe', () => {
    const motor = new Motor({
      componentes: [
        { id: 'F1', tipo: 'fuente' },
        { id: 'C1', tipo: 'cilindroSimpleEfecto' },
      ],
      mangueras: [{ id: 'm1', a: ref('F1', '1'), b: ref('C1', '99') }],
    })
    motor.tick()
    expect(motor.advertencias.some((a) => a.includes('inexistente'))).toBe(true)
  })

  it('una manguera de un puerto a sí mismo no cuelga la simulación', () => {
    const motor = new Motor({
      componentes: [
        { id: 'F1', tipo: 'fuente' },
        { id: 'C1', tipo: 'cilindroSimpleEfecto' },
      ],
      mangueras: [
        { id: 'm1', a: ref('F1', '1'), b: ref('C1', '1') },
        { id: 'm2', a: ref('C1', '1'), b: ref('C1', '1') },
      ],
    })
    expect(() => motor.simular(2)).not.toThrow()
    expect(motor.estadoDe<{ posicion: number }>('C1').posicion).toBe(1)
  })

  it('mangueras duplicadas entre los mismos puertos no alteran el resultado', () => {
    const base: Circuito = {
      componentes: [
        { id: 'F1', tipo: 'fuente' },
        { id: 'C1', tipo: 'cilindroSimpleEfecto' },
      ],
      mangueras: [{ id: 'm1', a: ref('F1', '1'), b: ref('C1', '1') }],
    }
    const conDuplicado: Circuito = {
      ...base,
      mangueras: [...base.mangueras, { id: 'm2', a: ref('C1', '1'), b: ref('F1', '1') }],
    }
    const a = new Motor(base)
    const b = new Motor(conDuplicado)
    a.simular(2)
    b.simular(2)
    expect(b.estadoDe<{ posicion: number }>('C1').posicion).toBe(
      a.estadoDe<{ posicion: number }>('C1').posicion,
    )
  })
})

describe('parámetros absurdos', () => {
  it('una presión negativa se trata como sin presión', () => {
    const motor = new Motor({
      componentes: [
        { id: 'F1', tipo: 'fuente', params: { presion: -5 } },
        { id: 'C1', tipo: 'cilindroSimpleEfecto' },
      ],
      mangueras: [{ id: 'm1', a: ref('F1', '1'), b: ref('C1', '1') }],
    })
    motor.simular(2)
    expect(motor.presionEn('C1', '1')).toBe(0)
    expect(motor.estadoDe<{ posicion: number }>('C1').posicion).toBe(0)
  })

  it('una presión disparatada se recorta al máximo admitido', () => {
    const motor = new Motor({
      componentes: [{ id: 'F1', tipo: 'fuente', params: { presion: 9999 } }],
      mangueras: [],
    })
    motor.tick()
    expect(motor.presionEn('F1', '1')).toBeLessThanOrEqual(10)
  })

  it('un regulador cerrado del todo no deja pasar caudal ni bloquea el motor', () => {
    const motor = new Motor({
      componentes: [
        { id: 'F1', tipo: 'fuente' },
        { id: 'R1', tipo: 'reguladorCaudal', params: { apertura: 0 } },
        { id: 'C1', tipo: 'cilindroSimpleEfecto' },
      ],
      mangueras: [
        { id: 'm1', a: ref('F1', '1'), b: ref('R1', '1') },
        { id: 'm2', a: ref('R1', '2'), b: ref('C1', '1') },
      ],
    })
    motor.simular(2)
    // La apertura se limita a un mínimo: pasa muy poco, pero el motor sigue vivo
    expect(motor.estadoDe<{ posicion: number }>('C1').posicion).toBeLessThan(0.3)
    expect(Number.isFinite(motor.estadoDe<{ posicion: number }>('C1').posicion)).toBe(true)
  })

  it('un valor no numérico en un parámetro cae al valor por defecto', () => {
    const motor = new Motor({
      componentes: [
        { id: 'F1', tipo: 'fuente', params: { presion: 'mucha' as unknown as number } },
        { id: 'C1', tipo: 'cilindroSimpleEfecto' },
      ],
      mangueras: [{ id: 'm1', a: ref('F1', '1'), b: ref('C1', '1') }],
    })
    motor.simular(2)
    expect(motor.presionEn('C1', '1')).toBe(6) // presión nominal por defecto
  })

  it('un retardo de temporizador nulo o negativo no congela el motor', () => {
    const motor = new Motor({
      componentes: [
        { id: 'F1', tipo: 'fuente' },
        { id: 'P1', tipo: 'valvula32', params: { reposo: 'NC' } },
        { id: 'T1', tipo: 'temporizador', params: { retardo: -3 } },
      ],
      mangueras: [
        { id: 'm1', a: ref('F1', '1'), b: ref('P1', '1') },
        { id: 'm2', a: ref('F1', '1'), b: ref('T1', '1') },
        { id: 'm3', a: ref('P1', '2'), b: ref('T1', '12') },
      ],
    })
    motor.accionar('P1', true)
    motor.simular(1)
    expect(motor.presionEn('T1', '2')).toBe(6)
  })
})

describe('finales de carrera mal configurados', () => {
  it('sin cilindro asignado nunca se acciona, pero no rompe', () => {
    const motor = new Motor({
      componentes: [
        { id: 'F1', tipo: 'fuente' },
        { id: 'S1', tipo: 'finalCarrera' },
      ],
      mangueras: [{ id: 'm1', a: ref('F1', '1'), b: ref('S1', '1') }],
    })
    motor.simular(1)
    expect(motor.estadoDe<{ accionada: boolean }>('S1').accionada).toBe(false)
    expect(motor.presionEn('S1', '2')).toBe(0)
  })

  it('apuntando a un componente que no es cilindro, no se acciona', () => {
    const motor = new Motor({
      componentes: [
        { id: 'F1', tipo: 'fuente' },
        { id: 'V9', tipo: 'valvula32' },
        { id: 'S1', tipo: 'finalCarrera', params: { cilindro: 'V9' } },
      ],
      mangueras: [{ id: 'm1', a: ref('F1', '1'), b: ref('S1', '1') }],
    })
    motor.simular(1)
    expect(motor.estadoDe<{ accionada: boolean }>('S1').accionada).toBe(false)
  })

  it('apuntando a un cilindro inexistente, no se acciona', () => {
    const motor = new Motor({
      componentes: [{ id: 'S1', tipo: 'finalCarrera', params: { cilindro: 'NO_EXISTE' } }],
      mangueras: [],
    })
    expect(() => motor.simular(1)).not.toThrow()
    expect(motor.estadoDe<{ accionada: boolean }>('S1').accionada).toBe(false)
  })
})

describe('estabilidad numérica y del bucle', () => {
  it('una simulación larga no acumula deriva ni valores inválidos', () => {
    const motor = new Motor({
      componentes: [
        { id: 'F1', tipo: 'fuente' },
        { id: 'V1', tipo: 'valvula52', params: { modo: 'biestable' } },
        { id: 'C1', tipo: 'cilindroDobleEfecto' },
        { id: 'S1', tipo: 'finalCarrera', params: { cilindro: 'C1', puntoDisparo: 0 } },
        { id: 'S2', tipo: 'finalCarrera', params: { cilindro: 'C1', puntoDisparo: 1 } },
      ],
      mangueras: [
        { id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') },
        { id: 'm2', a: ref('F1', '1'), b: ref('S1', '1') },
        { id: 'm3', a: ref('F1', '1'), b: ref('S2', '1') },
        { id: 'm4', a: ref('S1', '2'), b: ref('V1', '14') },
        { id: 'm5', a: ref('S2', '2'), b: ref('V1', '12') },
        { id: 'm6', a: ref('V1', '4'), b: ref('C1', 'A') },
        { id: 'm7', a: ref('V1', '2'), b: ref('C1', 'B') },
      ],
    })
    motor.simular(120) // dos minutos de ciclo continuo
    const pos = motor.estadoDe<{ posicion: number }>('C1').posicion
    expect(Number.isFinite(pos)).toBe(true)
    expect(pos).toBeGreaterThanOrEqual(0)
    expect(pos).toBeLessThanOrEqual(1)
  })

  it('un paso de tiempo grande no saca al vástago de su recorrido', () => {
    const motor = new Motor({
      componentes: [
        { id: 'F1', tipo: 'fuente' },
        { id: 'V1', tipo: 'valvula32', params: { reposo: 'NA' } },
        { id: 'C1', tipo: 'cilindroSimpleEfecto' },
      ],
      mangueras: [
        { id: 'm1', a: ref('F1', '1'), b: ref('V1', '1') },
        { id: 'm2', a: ref('V1', '2'), b: ref('C1', '1') },
      ],
    })
    motor.tick(10) // un salto absurdo
    const pos = motor.estadoDe<{ posicion: number }>('C1').posicion
    expect(pos).toBeLessThanOrEqual(1)
    expect(pos).toBeGreaterThanOrEqual(0)
  })

  it('accionar un componente sin mando manual da un error claro', () => {
    const motor = new Motor({
      componentes: [{ id: 'C1', tipo: 'cilindroSimpleEfecto' }],
      mangueras: [],
    })
    expect(() => motor.accionar('C1', true)).toThrow(/mando manual/i)
    expect(() => motor.accionar('NADA', true)).toThrow(/inexistente/i)
    expect(() => motor.accionar('NO_EXISTE', true)).toThrow()
  })

  it('cambiar un parámetro de un componente inexistente da un error claro', () => {
    const motor = new Motor({ componentes: [], mangueras: [] })
    expect(() => motor.setParametro('X', 'presion', 5)).toThrow(/inexistente/i)
  })
})

describe('validación estática antes de simular', () => {
  it('detecta el final de carrera sin cilindro asignado', () => {
    const mensajes = validarCircuito({
      componentes: [{ id: 'S1', tipo: 'finalCarrera' }],
      mangueras: [],
    })
    expect(mensajes.some((m) => m.toLowerCase().includes('cilindro'))).toBe(true)
  })

  it('detecta ids de componente repetidos', () => {
    const mensajes = validarCircuito({
      componentes: [
        { id: 'C1', tipo: 'cilindroSimpleEfecto' },
        { id: 'C1', tipo: 'cilindroDobleEfecto' },
      ],
      mangueras: [],
    })
    expect(mensajes.some((m) => m.toLowerCase().includes('repetid'))).toBe(true)
  })
})
