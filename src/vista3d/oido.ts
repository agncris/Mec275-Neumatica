/**
 * El oído del banco: mira la simulación fotograma a fotograma y dice qué se
 * oiría en el laboratorio y por dónde sale el aire.
 *
 *  - Golpes: la corredera de una válvula que conmuta, la leva que pisa un
 *    rodillo, el vástago que llega al tope, la llave del FRL.
 *  - Escapes: cuando una línea pierde presión o una cámara se vacía, el aire
 *    tiene que salir a la atmósfera por algún sitio. Se sigue el camino que
 *    tiene abierto en ese instante (mangueras y vías internas de cada pieza)
 *    hasta el escape por el que sale de verdad: el silenciador de la válvula
 *    que ventea esa línea, el escape rápido, o el FRL si se cierra la llave.
 *
 * No depende de three.js ni del navegador: el banco decide cómo se ve y
 * `sonido.ts` cómo suena.
 */
import { MODELOS } from '../engine/componentes'
import { claveNodo } from '../engine/solver'
import { esActuador } from '../engine/tipos'
import type { Motor } from '../engine'

export type TipoGolpe = 'valvula' | 'rodillo' | 'tope' | 'bola' | 'llave'

export interface Golpe {
  tipo: TipoGolpe
  componente: string
  /** 0..1 */
  intensidad: number
}

export interface SalidaAire {
  componente: string
  /** Puerto por el que sale el aire; null si sale por el propio cuerpo (motor). */
  puerto: string | null
  /** 0..1 */
  intensidad: number
  /** true: descarga de golpe al perder presión una línea; false: flujo sostenido. */
  rafaga: boolean
}

export interface Escucha {
  golpes: Golpe[]
  salidas: SalidaAire[]
  /** Motores neumáticos girando, con su velocidad en vueltas/s. */
  giros: Array<{ componente: string; velocidad: number }>
  /** Hay un cortocircuito presión→escape: el aire se fuga sin parar. */
  fuga: boolean
}

/** Caída de presión (bar) a partir de la cual una línea «suena» al ventearse. */
const CAIDA_AUDIBLE = 0.2
const VALVULAS = new Set(['valvula32', 'valvula52', 'valvula42', 'temporizador'])
const SENSORES = new Set(['finalCarrera', 'sensorGiro'])
const LOGICAS = new Set(['valvulaO', 'valvulaY'])

interface Previo {
  conmutada: Map<string, unknown>
  fase: Map<string, string>
  velocidad: Map<string, number>
  encendida: Map<string, boolean>
  presion: Map<string, number>
}

export class Oido {
  private previo: Previo | null = null

  constructor(readonly motor: Motor) {}

  /** Lo que ha cambiado desde la última llamada. La primera sólo toma nota. */
  escuchar(): Escucha {
    const motor = this.motor
    const circuito = motor.circuito
    const actual: Previo = {
      conmutada: new Map(),
      fase: new Map(),
      velocidad: new Map(),
      encendida: new Map(),
      presion: new Map(motor.ultimaSolucion?.presion ?? []),
    }
    const escucha: Escucha = { golpes: [], salidas: [], giros: [], fuga: false }
    const antes = this.previo

    for (const c of circuito.componentes) {
      const estado = motor.estadoDe<Record<string, unknown>>(c.id)
      if (VALVULAS.has(c.tipo) || SENSORES.has(c.tipo)) {
        actual.conmutada.set(c.id, estado.accionada)
        if (antes && antes.conmutada.get(c.id) !== estado.accionada) {
          escucha.golpes.push({
            tipo: SENSORES.has(c.tipo) ? 'rodillo' : 'valvula',
            componente: c.id,
            intensidad: estado.accionada ? 0.9 : 0.75,
          })
        }
      } else if (LOGICAS.has(c.tipo)) {
        actual.conmutada.set(c.id, estado.lado)
        if (antes && antes.conmutada.get(c.id) !== estado.lado && estado.lado != null) {
          escucha.golpes.push({ tipo: 'bola', componente: c.id, intensidad: 0.5 })
        }
      } else if (c.tipo === 'fuente') {
        const encendida = c.params?.encendida !== false
        actual.encendida.set(c.id, encendida)
        if (antes && antes.encendida.get(c.id) !== encendida) {
          escucha.golpes.push({ tipo: 'llave', componente: c.id, intensidad: 0.8 })
        }
      } else if (c.tipo === 'motorNeumatico') {
        const v = Math.abs(Number(estado.velocidad) || 0)
        if (v > 0) {
          escucha.giros.push({ componente: c.id, velocidad: v })
          // El motor de paletas descarga por su propio cuerpo.
          escucha.salidas.push({ componente: c.id, puerto: null, intensidad: Math.min(1, 0.4 + v), rafaga: false })
        }
      } else if (esActuador(c.tipo)) {
        const fase = String(estado.fase)
        const v = Number(estado.velocidad) || 0
        actual.fase.set(c.id, fase)
        actual.velocidad.set(c.id, v)
        const faseAntes = antes?.fase.get(c.id)
        const enMarcha = faseAntes === 'avanzando' || faseAntes === 'retornando'
        if (enMarcha && (fase === 'extendido' || fase === 'reposo')) {
          const vAntes = Math.abs(antes?.velocidad.get(c.id) ?? v)
          escucha.golpes.push({
            tipo: 'tope',
            componente: c.id,
            intensidad: Math.min(1, 0.45 + Math.max(vAntes, Math.abs(v)) * 0.6),
          })
        }
      }
    }

    escucha.fuga = motor.advertencias.some((a) => a.startsWith('Cortocircuito'))

    if (antes) {
      // Dónde empieza a salir aire: líneas que acaban de perder presión y
      // cámaras que se están vaciando mientras el vástago se mueve.
      const origenes: Array<{ nodo: string; intensidad: number; rafaga: boolean }> = []
      for (const [nodo, p] of antes.presion) {
        const caida = p - (actual.presion.get(nodo) ?? 0)
        if (caida > CAIDA_AUDIBLE) origenes.push({ nodo, intensidad: Math.min(1, caida / 6), rafaga: true })
      }
      for (const c of circuito.componentes) {
        if (!esActuador(c.tipo) || c.tipo === 'motorNeumatico') continue
        // Contra el tope la velocidad puede no ser nula, pero ya no se mueve aire.
        const fase = actual.fase.get(c.id)
        if (fase !== 'avanzando' && fase !== 'retornando') continue
        const v = actual.velocidad.get(c.id) ?? 0
        let puerto: string | null = null
        if (c.tipo === 'cilindroSimpleEfecto') puerto = v < 0 ? '1' : null
        else puerto = v > 0 ? 'B' : 'A'
        if (puerto) {
          origenes.push({ nodo: claveNodo(c.id, puerto), intensidad: Math.min(1, 0.3 + Math.abs(v) * 0.6), rafaga: false })
        }
      }
      if (origenes.length > 0) {
        const grafo = grafoAbierto(motor)
        const porSalida = new Map<string, SalidaAire>()
        for (const o of origenes) {
          for (const nodo of salidasAlcanzables(grafo, o.nodo)) {
            const clave = `${nodo}|${o.rafaga}`
            const previa = porSalida.get(clave)
            if (previa && previa.intensidad >= o.intensidad) continue
            const [componente, puerto] = separarNodo(nodo)
            porSalida.set(clave, { componente, puerto, intensidad: o.intensidad, rafaga: o.rafaga })
          }
        }
        escucha.salidas.push(...porSalida.values())
      }
    }

    this.previo = actual
    return escucha
  }
}

const separarNodo = (nodo: string): [string, string] => {
  const i = nodo.lastIndexOf(':')
  return [nodo.slice(0, i), nodo.slice(i + 1)]
}

interface GrafoAbierto {
  vecinos: Map<string, string[]>
  atmosfera: Set<string>
}

/** Caminos abiertos en este instante (mangueras + vías internas), en el sentido del flujo. */
function grafoAbierto(motor: Motor): GrafoAbierto {
  const vecinos = new Map<string, string[]>()
  const unir = (a: string, b: string) => {
    const l = vecinos.get(a)
    if (l) l.push(b)
    else vecinos.set(a, [b])
  }
  const conManguera = new Set<string>()
  for (const m of motor.circuito.mangueras) {
    const a = claveNodo(m.a.componente, m.a.puerto)
    const b = claveNodo(m.b.componente, m.b.puerto)
    unir(a, b)
    unir(b, a)
    conManguera.add(a)
    conManguera.add(b)
  }
  const atmosfera = new Set<string>()
  for (const c of motor.circuito.componentes) {
    const modelo = MODELOS[c.tipo]
    if (!modelo) continue
    const params = c.params ?? {}
    const estado = motor.estadoDe(c.id)
    for (const camino of modelo.caminos(estado, params)) {
      const de = claveNodo(c.id, camino.de)
      const a = claveNodo(c.id, camino.a)
      if (camino.restriccion > 0) unir(de, a)
      if ((camino.restriccionInversa ?? camino.restriccion) > 0) unir(a, de)
    }
    for (const puerto of modelo.puertos) {
      const nodo = claveNodo(c.id, puerto.id)
      if (puerto.rol === 'escape' && !conManguera.has(nodo)) atmosfera.add(nodo)
      if (puerto.rol === 'alimentacion' && modelo.presionSuministro) {
        // Con la llave cerrada, el FRL ventea lo que queda aguas abajo.
        if (modelo.presionSuministro(estado, params, puerto.id) <= 0) atmosfera.add(nodo)
      }
    }
  }
  return { vecinos, atmosfera }
}

/** Escapes a la atmósfera que alcanza el aire desde un nodo por caminos abiertos. */
function salidasAlcanzables(grafo: GrafoAbierto, desde: string): string[] {
  const vistos = new Set([desde])
  const cola = [desde]
  const salidas: string[] = []
  while (cola.length > 0) {
    const n = cola.shift()!
    if (grafo.atmosfera.has(n)) salidas.push(n)
    for (const v of grafo.vecinos.get(n) ?? []) {
      if (vistos.has(v)) continue
      vistos.add(v)
      cola.push(v)
    }
  }
  return salidas
}
