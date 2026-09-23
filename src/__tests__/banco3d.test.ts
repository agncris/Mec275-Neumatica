/**
 * Banco 3D: lo que se puede comprobar sin tarjeta gráfica.
 *
 * El dibujo en sí necesita WebGL, pero el montaje no: que cada ficha tenga su
 * modelo, que cada puerto del esquema tenga su racor (si no, una manguera del
 * plano no llegaría a ninguna parte en el banco) y que las piezas móviles
 * respondan al estado de la simulación.
 */
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { DESCRIPTORES } from '../components/descriptores'
import { EJEMPLOS, type NumeroEjemplo } from '../circuitos/ejemplos'
import { CIRCUITO_BLOQUEADO, CIRCUITO_CASCADA } from '../circuitos/cascada'
import {
  CARRERA,
  anguloPerilla,
  crearModelo,
  modeloBloque,
  modeloCilindro,
  modeloEscapeRapido,
  modeloFinalCarrera,
  modeloLogica,
  modeloMotor,
  modeloRegulador,
  modeloTemporizador,
  modeloValvula,
} from '../vista3d/modelos'
import type { Pieza } from '../store'

const pieza = (tipo: string, params: Pieza['params'] = {}): Pieza => ({ id: 'X', tipo, x: 0, y: 0, params })

describe('modelos 3D del banco', () => {
  it('todas las fichas de la paleta tienen modelo y un racor por cada puerto', () => {
    for (const [tipo, desc] of Object.entries(DESCRIPTORES)) {
      const modelo = crearModelo(pieza(tipo))
      expect(modelo.grupo.children.length, tipo).toBeGreaterThan(0)
      for (const puerto of desc.puertos) {
        expect(modelo.racores[puerto.id], `${tipo}:${puerto.id}`).toBeDefined()
      }
    }
  })

  it('las mangueras de todos los circuitos de la aplicación encuentran sus dos racores', () => {
    const circuitos = [
      ...([1, 2, 3, 4, 5, 6] as NumeroEjemplo[]).map((n) => EJEMPLOS[n]),
      CIRCUITO_BLOQUEADO,
      CIRCUITO_CASCADA,
    ]
    for (const c of circuitos) {
      const modelos = new Map(c.piezas.map((p) => [p.id, crearModelo(p as Pieza)]))
      for (const m of c.mangueras) {
        expect(modelos.get(m.a.componente)?.racores[m.a.puerto], `${m.id} extremo a`).toBeDefined()
        expect(modelos.get(m.b.componente)?.racores[m.b.puerto], `${m.id} extremo b`).toBeDefined()
      }
    }
  })

  it('el vástago recorre la carrera completa entre las dos posiciones', () => {
    const cil = modeloCilindro('cilindroDobleEfecto', 'A')
    expect(cil.puntaVastago(1) - cil.puntaVastago(0)).toBeCloseTo(CARRERA, 6)
    const vastago = () => cil.grupo.children.find((o) => o instanceof THREE.Group && o.children.length === 3)!
    cil.actualizar({ posicion: 0 }, 0)
    const dentro = vastago().position.x
    cil.actualizar({ posicion: 1 }, 0)
    expect(vastago().position.x - dentro).toBeCloseTo(CARRERA, 6)
  })

  it('el rodillo se inclina cuando la leva lo pisa', () => {
    const fc = modeloFinalCarrera('a1')
    const palanca = fc.grupo.children.find((o) => o instanceof THREE.Group && o.children.length === 2)!
    fc.actualizar({ accionada: false }, 0)
    expect(palanca.rotation.z).toBe(0)
    fc.actualizar({ accionada: true }, 0)
    expect(palanca.rotation.z).not.toBe(0)
  })

  it('las válvulas de pulsador se pueden pulsar en el banco; las pilotadas no', () => {
    expect(modeloValvula('valvula32', 'M', { reposo: 'NC', accionamiento: 'pulsador' }).pulsables.length).toBeGreaterThan(0)
    expect(modeloValvula('valvula52', 'V', { modo: 'monoestable', accionamiento: 'pilotaje' }).pulsables).toHaveLength(0)
  })

  it('ninguna ficha de la paleta cae en el bloque genérico: todas tienen modelo propio', () => {
    const generico = (tipo: string) => modeloBloque(tipo, 'X').grupo.children.length
    for (const tipo of Object.keys(DESCRIPTORES)) {
      const m = crearModelo(pieza(tipo, tipo === 'reguladorCaudal' ? { apertura: 0.5 } : {}))
      expect(m.grupo.children.length, tipo).not.toBe(generico(tipo))
    }
  })

  it('la perilla del regulador gira según la apertura', () => {
    const r = modeloRegulador('R1', { apertura: 0.2 })
    expect(r.perilla.rotation.z).toBeCloseTo(anguloPerilla(0.2), 6)
    r.actualizar({ params: { apertura: 0.9 } }, 0)
    expect(r.perilla.rotation.z).toBeCloseTo(anguloPerilla(0.9), 6)
    expect(anguloPerilla(0)).not.toBeCloseTo(anguloPerilla(1), 2)
  })

  it('el depósito del temporizador se llena con el tiempo y queda lleno al conmutar', () => {
    const t = modeloTemporizador('T1', { retardo: 2 })
    t.actualizar({ acumulado: 0, accionada: false }, 0)
    expect(t.relleno.visible).toBe(false)
    t.actualizar({ acumulado: 1, accionada: false }, 0)
    expect(t.relleno.scale.y).toBeCloseTo(0.5, 6)
    t.actualizar({ acumulado: 2, accionada: true }, 0)
    expect(t.relleno.scale.y).toBe(1)
  })

  it('la bola de la «O» y la corredera de la «Y» se van al lado de la entrada cerrada', () => {
    for (const tipo of ['valvulaO', 'valvulaY']) {
      const l = modeloLogica(tipo, 'L')
      for (let i = 0; i < 30; i++) l.actualizar({ lado: 'X' }, 0)
      expect(l.movil.position.x, tipo).toBeGreaterThan(0.003)
      for (let i = 0; i < 30; i++) l.actualizar({ lado: 'Y' }, 0)
      expect(l.movil.position.x, tipo).toBeLessThan(-0.003)
    }
  })

  it('el obturador del escape rápido salta al purgar', () => {
    const e = modeloEscapeRapido('E1')
    for (let i = 0; i < 30; i++) e.actualizar({ purgando: false }, 0)
    const alimentando = e.obturador.position.x
    for (let i = 0; i < 30; i++) e.actualizar({ purgando: true }, 0)
    expect(e.obturador.position.x).toBeLessThan(alimentando - 0.004)
  })

  it('el motor lleva la leva que pisa el sensor de paso', () => {
    const m = modeloMotor('M1')
    expect(m.radioLeva).toBeGreaterThan(0.014)
    const fc = modeloFinalCarrera('S', 'abajo', 'sensorGiro')
    for (const puerto of DESCRIPTORES.sensorGiro.puertos) expect(fc.racores[puerto.id]).toBeDefined()
  })
})
