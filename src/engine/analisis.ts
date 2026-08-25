/**
 * Análisis automático de un circuito montado: qué actuadores tiene, qué
 * secuencia ejecuta realmente y qué elementos lo componen.
 *
 * Sirve para dos cosas: que el alumno compruebe su propio trabajo antes de
 * entregarlo, y que el profesor vea de un vistazo si el circuito hace lo que
 * el alumno declara.
 */
import { MODELOS } from './componentes'
import { Motor } from './motor'
import { validarCircuito } from './validacion'
import { esActuador, type Circuito } from './tipos'

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export interface Actuador {
  id: string
  letra: string
  nombre: string
}

export interface ElementoInventario {
  tipo: string
  nombre: string
  cantidad: number
}

export interface AnalisisCircuito {
  actuadores: Actuador[]
  /** Movimientos observados al simular, en orden: ['A+', 'B+', 'B−', 'A−']. */
  secuenciaDetectada: string[]
  /** El circuito vuelve al estado inicial y repite: es un ciclo cerrado. */
  cicloCompleto: boolean
  /** Mandos manuales que se accionaron para arrancar (marcha). */
  mandosManuales: string[]
  /** Válvulas que recibieron pilotajes opuestos a la vez. */
  conflictos: string[]
  /** Errores de montaje detectados sin simular. */
  erroresMontaje: string[]
  /** Avisos surgidos durante la simulación (cortocircuitos, etc.). */
  avisosSimulacion: string[]
  inventario: ElementoInventario[]
  /** Ningún actuador llegó a moverse. */
  sinMovimiento: boolean
}

/** Válvulas que un operario puede accionar con la mano (no las de rodillo ni las pilotadas). */
function mandosManuales(circuito: Circuito): string[] {
  return circuito.componentes
    .filter((c) => {
      if (c.tipo === 'valvula32') return true
      if (c.tipo === 'valvula42' || c.tipo === 'valvula52') {
        return c.params?.modo !== 'biestable' && c.params?.accionamiento !== 'pilotaje'
      }
      return false
    })
    .map((c) => c.id)
}

export function inventarioDe(circuito: Circuito): ElementoInventario[] {
  const cuenta = new Map<string, number>()
  for (const c of circuito.componentes) {
    cuenta.set(c.tipo, (cuenta.get(c.tipo) ?? 0) + 1)
  }
  return [...cuenta.entries()]
    .map(([tipo, cantidad]) => ({
      tipo,
      nombre: MODELOS[tipo]?.nombre ?? tipo,
      cantidad,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export interface OpcionesAnalisis {
  /** Segundos de simulación (por defecto, suficiente para 2–3 ciclos). */
  segundos?: number
}

export function analizarCircuito(circuito: Circuito, opciones: OpcionesAnalisis = {}): AnalisisCircuito {
  const erroresMontaje = validarCircuito(circuito)
  const actuadores: Actuador[] = circuito.componentes
    .filter((c) => esActuador(c.tipo))
    .map((c, i) => ({
      id: c.id,
      letra: LETRAS[i] ?? c.id,
      nombre: MODELOS[c.tipo]?.nombre ?? c.tipo,
    }))

  const inventario = inventarioDe(circuito)
  const manuales = mandosManuales(circuito)

  const base: AnalisisCircuito = {
    actuadores,
    secuenciaDetectada: [],
    cicloCompleto: false,
    mandosManuales: manuales,
    conflictos: [],
    erroresMontaje,
    avisosSimulacion: [],
    inventario,
    sinMovimiento: true,
  }

  if (actuadores.length === 0) return base

  let motor: Motor
  try {
    motor = new Motor(circuito)
  } catch {
    return base
  }

  // Se acciona la marcha, como pide el enunciado ("inicio de accionamiento manual").
  for (const id of manuales) {
    try {
      motor.accionar(id, true)
    } catch {
      /* si no admite mando manual, se ignora */
    }
  }

  const previa = new Map(actuadores.map((a) => [a.id, 0]))
  const secuencia: string[] = []
  const pasos = Math.round((opciones.segundos ?? 40) * 30)

  for (let i = 0; i < pasos; i++) {
    motor.tick()
    for (const act of actuadores) {
      const antes = previa.get(act.id) ?? 0
      const ahora = motor.estadoDe<{ posicion?: number }>(act.id).posicion ?? 0
      if (ahora >= 1 && antes < 1) secuencia.push(`${act.letra}+`)
      if (ahora <= 0 && antes > 0) secuencia.push(`${act.letra}−`)
      previa.set(act.id, ahora)
    }
    // Con dos ciclos completos ya sabemos de sobra cómo se comporta
    if (secuencia.length >= actuadores.length * 4 + 2) break
  }

  const conflictos = [
    ...new Set(motor.eventos.filter((e) => e.tipo === 'conflicto').map((e) => e.componente)),
  ]

  return {
    ...base,
    secuenciaDetectada: secuencia,
    cicloCompleto: detectarCiclo(secuencia),
    conflictos,
    avisosSimulacion: motor.advertencias,
    sinMovimiento: secuencia.length === 0,
  }
}

/** ¿La secuencia observada se repite? Buscamos el periodo más corto que encaje. */
function detectarCiclo(secuencia: string[]): boolean {
  for (let periodo = 2; periodo <= Math.floor(secuencia.length / 2); periodo++) {
    let repite = true
    for (let i = 0; i + periodo < secuencia.length; i++) {
      if (secuencia[i] !== secuencia[i + periodo]) {
        repite = false
        break
      }
    }
    if (repite) return true
  }
  return false
}

/** Compara la secuencia que declara el alumno con la que hace el circuito. */
export function coincideSecuencia(declarada: string[], detectada: string[]): boolean {
  if (declarada.length === 0 || detectada.length === 0) return false
  if (detectada.length < declarada.length) return false
  // La detección puede empezar en cualquier punto del ciclo: probamos todos los desfases.
  for (let inicio = 0; inicio + declarada.length <= detectada.length; inicio++) {
    let igual = true
    for (let i = 0; i < declarada.length; i++) {
      if (detectada[inicio + i] !== declarada[i]) {
        igual = false
        break
      }
    }
    if (igual) return true
  }
  return false
}
