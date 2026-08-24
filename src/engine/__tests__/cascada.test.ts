/**
 * Método cascada — secuencia A+ B+ B− A−.
 *
 * Es el ejemplo canónico de "señal bloqueante": el final de carrera a1 sigue
 * pisado cuando llega el momento de hacer B−, así que la válvula de B recibe
 * las dos señales de pilotaje a la vez y se queda clavada.
 *
 * El método cascada lo resuelve partiendo la secuencia en grupos y dando aire
 * a un solo grupo cada vez: el emisor de la señal molesta se queda sin
 * alimentación y su señal desaparece sola.
 */
import { describe, expect, it } from 'vitest'
import { Motor } from '../motor'
import type { Circuito, RefPuerto } from '../tipos'
import type { EstadoCilindroDoble } from '../componentes'

const ref = (c: string, p: string): RefPuerto => ({ componente: c, puerto: p })
const pos = (m: Motor, id: string) => m.estadoDe<EstadoCilindroDoble>(id).posicion

/** Piezas comunes: dos cilindros, sus válvulas biestables y los 4 rodillos. */
function base(): Circuito['componentes'] {
  return [
    { id: 'F1', tipo: 'fuente', params: { presion: 6 } },
    { id: 'CA', tipo: 'cilindroDobleEfecto' },
    { id: 'CB', tipo: 'cilindroDobleEfecto' },
    { id: 'VA', tipo: 'valvula52', params: { modo: 'biestable' } },
    { id: 'VB', tipo: 'valvula52', params: { modo: 'biestable' } },
    { id: 'a0', tipo: 'finalCarrera', params: { cilindro: 'CA', puntoDisparo: 0, reposo: 'NC' } },
    { id: 'a1', tipo: 'finalCarrera', params: { cilindro: 'CA', puntoDisparo: 1, reposo: 'NC' } },
    { id: 'b0', tipo: 'finalCarrera', params: { cilindro: 'CB', puntoDisparo: 0, reposo: 'NC' } },
    { id: 'b1', tipo: 'finalCarrera', params: { cilindro: 'CB', puntoDisparo: 1, reposo: 'NC' } },
    { id: 'M', tipo: 'valvula32', params: { reposo: 'NC' } },
  ]
}

/** Conexiones de potencia: cada válvula alimenta su cilindro. */
function potencia(): Circuito['mangueras'] {
  return [
    { id: 'p1', a: ref('F1', '1'), b: ref('VA', '1') },
    { id: 'p2', a: ref('VA', '4'), b: ref('CA', 'A') },
    { id: 'p3', a: ref('VA', '2'), b: ref('CA', 'B') },
    { id: 'p4', a: ref('F1', '1'), b: ref('VB', '1') },
    { id: 'p5', a: ref('VB', '4'), b: ref('CB', 'A') },
    { id: 'p6', a: ref('VB', '2'), b: ref('CB', 'B') },
  ]
}

// ---------------------------------------------------------------------------
// 1) El montaje ingenuo: todos los rodillos alimentados directamente de la red
// ---------------------------------------------------------------------------
function circuitoIngenuo(): Circuito {
  return {
    componentes: base(),
    mangueras: [
      ...potencia(),
      // Todos los finales de carrera y el pulsador cuelgan de la red
      { id: 's1', a: ref('F1', '1'), b: ref('a0', '1') },
      { id: 's2', a: ref('F1', '1'), b: ref('a1', '1') },
      { id: 's3', a: ref('F1', '1'), b: ref('b0', '1') },
      { id: 's4', a: ref('F1', '1'), b: ref('b1', '1') },
      { id: 's5', a: ref('a0', '2'), b: ref('M', '1') },
      // Marcha (con A recogido) → A+
      { id: 's6', a: ref('M', '2'), b: ref('VA', '14') },
      // a1 → B+ ; b1 → B− ; b0 → A−
      { id: 's7', a: ref('a1', '2'), b: ref('VB', '14') },
      { id: 's8', a: ref('b1', '2'), b: ref('VB', '12') },
      { id: 's9', a: ref('b0', '2'), b: ref('VA', '12') },
    ],
  }
}

describe('montaje ingenuo: la secuencia se bloquea por solapamiento de señales', () => {
  it('la válvula recibe las dos señales de pilotaje a la vez y avisa', () => {
    const motor = new Motor(circuitoIngenuo())
    motor.accionar('M', true)
    motor.simular(10)
    expect(motor.eventos.some((e) => e.tipo === 'conflicto')).toBe(true)
  })

  it('con los dos cilindros recogidos, ni siquiera arranca', () => {
    // En reposo a0 y b0 están pisados: a0·marcha pide A+ por el pilotaje 14
    // mientras b0 pide A− por el 12. La corredera no puede moverse.
    const motor = new Motor(circuitoIngenuo())
    motor.accionar('M', true)
    motor.simular(10)
    expect(pos(motor, 'CA')).toBe(0)
    expect(pos(motor, 'CB')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 2) Método cascada: dos grupos (A+ B+ | B− A−) y una válvula de cascada
// ---------------------------------------------------------------------------
function circuitoCascada(): Circuito {
  return {
    componentes: [
      ...base(),
      // Válvula de cascada: reparte el aire entre la línea L1 y la L2
      { id: 'VC', tipo: 'valvula52', params: { modo: 'biestable' } },
    ],
    mangueras: [
      ...potencia(),
      // La cascada se alimenta de la red; su salida 4 es L1 y la 2 es L2
      { id: 'c1', a: ref('F1', '1'), b: ref('VC', '1') },

      // --- GRUPO I (línea L1 = VC:4) : A+ B+ ---
      // 1.er movimiento del grupo: lo manda la propia línea
      { id: 'g1', a: ref('VC', '4'), b: ref('VA', '14') },
      // 2.º movimiento: lo manda a1, alimentado desde L1
      { id: 'g2', a: ref('VC', '4'), b: ref('a1', '1') },
      { id: 'g3', a: ref('a1', '2'), b: ref('VB', '14') },
      // Último final de carrera del grupo → conmuta a la línea siguiente
      { id: 'g4', a: ref('VC', '4'), b: ref('b1', '1') },
      { id: 'g5', a: ref('b1', '2'), b: ref('VC', '12') },

      // --- GRUPO II (línea L2 = VC:2) : B− A− ---
      { id: 'h1', a: ref('VC', '2'), b: ref('VB', '12') },
      { id: 'h2', a: ref('VC', '2'), b: ref('b0', '1') },
      { id: 'h3', a: ref('b0', '2'), b: ref('VA', '12') },
      // Último del grupo (a0) en serie con el pulsador de marcha → vuelve a L1
      { id: 'h4', a: ref('VC', '2'), b: ref('a0', '1') },
      { id: 'h5', a: ref('a0', '2'), b: ref('M', '1') },
      { id: 'h6', a: ref('M', '2'), b: ref('VC', '14') },
    ],
  }
}

describe('método cascada: la misma secuencia sin señales bloqueantes', () => {
  it('no hay ningún conflicto de pilotajes', () => {
    const motor = new Motor(circuitoCascada())
    motor.accionar('M', true)
    motor.simular(12)
    expect(motor.eventos.filter((e) => e.tipo === 'conflicto')).toEqual([])
  })

  it('ejecuta la secuencia completa A+ B+ B− A− y en ese orden', () => {
    const motor = new Motor(circuitoCascada())
    const secuencia: string[] = []
    let a = pos(motor, 'CA')
    let b = pos(motor, 'CB')

    motor.accionar('M', true)
    for (let i = 0; i < 200; i++) {
      motor.tick()
      const na = pos(motor, 'CA')
      const nb = pos(motor, 'CB')
      if (na === 1 && a < 1) secuencia.push('A+')
      if (na === 0 && a > 0) secuencia.push('A−')
      if (nb === 1 && b < 1) secuencia.push('B+')
      if (nb === 0 && b > 0) secuencia.push('B−')
      a = na
      b = nb
    }

    expect(secuencia.slice(0, 4)).toEqual(['A+', 'B+', 'B−', 'A−'])
  })

  it('mantenida la marcha, el ciclo se repite solo', () => {
    const motor = new Motor(circuitoCascada())
    motor.accionar('M', true)
    let ciclos = 0
    let a = 0
    for (let i = 0; i < 600; i++) {
      motor.tick()
      const na = pos(motor, 'CA')
      if (na === 1 && a < 1) ciclos++
      a = na
    }
    expect(ciclos).toBeGreaterThanOrEqual(3)
  })

  it('sólo una línea de grupo tiene aire en cada momento', () => {
    const motor = new Motor(circuitoCascada())
    motor.accionar('M', true)
    for (let i = 0; i < 300; i++) {
      motor.tick()
      const l1 = motor.presionEn('VC', '4')
      const l2 = motor.presionEn('VC', '2')
      expect(l1 > 0.1 && l2 > 0.1).toBe(false)
    }
  })
})
