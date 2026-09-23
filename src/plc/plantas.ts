/**
 * Las plantas del laboratorio de PLC: lo que el PLC controla. Cada planta
 * tiene su cableado fijo (qué sensor va a qué entrada, qué actuador cuelga de
 * qué salida), como en el banco: el alumno no recablea, programa.
 *
 * La física es sencilla pero honesta: el estanque se llena y se vacía a un
 * caudal, los cilindros tardan en recorrer su carrera, los sensores cambian
 * cuando de verdad llega el nivel o el vástago. Así un programa mal hecho se
 * nota (el estanque rebalsa, el cilindro choca), igual que en el laboratorio.
 */
import type { IdPlanta, Simbolo } from './ladder'

export interface Mando {
  dir: string
  nombre: string
  /** Pulsador: vuelve solo al soltarlo. Interruptor: se queda donde lo dejas. */
  tipo: 'pulsador' | 'interruptor'
  color: 'verde' | 'rojo' | 'negro' | 'amarillo'
}

export interface Accion {
  id: string
  etiqueta: string
  titulo: string
}

export interface EventoPlanta {
  t: number
  mensaje: string
  aviso?: boolean
}

export interface DescripcionPlanta {
  id: IdPlanta
  nombre: string
  resumen: string
  /** Cableado de la planta: dirección, nombre y qué es. */
  cableado: Simbolo[]
  /** Botones y selectores que maneja el operador. */
  mandos: Mando[]
}

export interface Planta {
  readonly id: IdPlanta
  /** Entradas que imponen los sensores de la planta (no los mandos). */
  sensores(): Record<string, boolean>
  /** Avanza la física con las salidas del PLC. */
  paso(salidas: Record<string, boolean>, dt: number): void
  /** Botones propios de la planta (poner una pieza…). */
  acciones(): Accion[]
  accion(id: string): void
  eventos: EventoPlanta[]
}

// ---------------------------------------------------------------------------
// Tablero de pruebas
// ---------------------------------------------------------------------------
export const TABLERO: DescripcionPlanta = {
  id: 'tablero',
  nombre: 'Tablero de pruebas',
  resumen:
    'Cuatro pulsadores, cuatro selectores, seis pilotos, un zumbador y un ventilador, cableados al PLC. Sirve para practicar cualquier programa.',
  cableado: [
    { dir: 'I0.0', nombre: 'MARCHA', descripcion: 'Pulsador verde (NA)' },
    { dir: 'I0.1', nombre: 'PARO', descripcion: 'Pulsador rojo (NA)' },
    { dir: 'I0.2', nombre: 'P3', descripcion: 'Pulsador negro (NA)' },
    { dir: 'I0.3', nombre: 'P4', descripcion: 'Pulsador negro (NA)' },
    { dir: 'I0.4', nombre: 'SEL1', descripcion: 'Selector 1 (se queda en su posición)' },
    { dir: 'I0.5', nombre: 'SEL2', descripcion: 'Selector 2' },
    { dir: 'I0.6', nombre: 'SEL3', descripcion: 'Selector 3' },
    { dir: 'I0.7', nombre: 'SEL4', descripcion: 'Selector 4' },
    { dir: 'Q0.0', nombre: 'H1', descripcion: 'Piloto verde' },
    { dir: 'Q0.1', nombre: 'H2', descripcion: 'Piloto rojo' },
    { dir: 'Q0.2', nombre: 'H3', descripcion: 'Piloto amarillo' },
    { dir: 'Q0.3', nombre: 'H4', descripcion: 'Piloto azul' },
    { dir: 'Q0.4', nombre: 'H5', descripcion: 'Piloto blanco' },
    { dir: 'Q0.5', nombre: 'H6', descripcion: 'Piloto blanco' },
    { dir: 'Q0.6', nombre: 'ZUMB', descripcion: 'Zumbador' },
    { dir: 'Q0.7', nombre: 'VENT', descripcion: 'Motor del ventilador' },
  ],
  mandos: [
    { dir: 'I0.0', nombre: 'MARCHA', tipo: 'pulsador', color: 'verde' },
    { dir: 'I0.1', nombre: 'PARO', tipo: 'pulsador', color: 'rojo' },
    { dir: 'I0.2', nombre: 'P3', tipo: 'pulsador', color: 'negro' },
    { dir: 'I0.3', nombre: 'P4', tipo: 'pulsador', color: 'negro' },
    { dir: 'I0.4', nombre: 'SEL1', tipo: 'interruptor', color: 'negro' },
    { dir: 'I0.5', nombre: 'SEL2', tipo: 'interruptor', color: 'negro' },
    { dir: 'I0.6', nombre: 'SEL3', tipo: 'interruptor', color: 'negro' },
    { dir: 'I0.7', nombre: 'SEL4', tipo: 'interruptor', color: 'negro' },
  ],
}

export class PlantaTablero implements Planta {
  readonly id = 'tablero' as const
  eventos: EventoPlanta[] = []
  /** Vueltas del ventilador (para dibujarlo). */
  giro = 0
  velocidad = 0
  sensores() {
    return {}
  }
  paso(salidas: Record<string, boolean>, dt: number) {
    // El ventilador arranca y se frena con inercia.
    const objetivo = salidas['Q0.7'] ? 4 : 0
    this.velocidad += (objetivo - this.velocidad) * Math.min(1, dt * 1.5)
    this.giro = (this.giro + this.velocidad * dt) % 1
  }
  acciones() {
    return []
  }
  accion() {}
}

// ---------------------------------------------------------------------------
// Estanque (Ejercicio 1 del apunte: llenado y vaciado de tanque)
// ---------------------------------------------------------------------------
export const ESTANQUE: DescripcionPlanta = {
  id: 'estanque',
  nombre: 'Estanque con dos electroválvulas',
  resumen:
    'Estanque con electroválvula de llenado V1 arriba y de vaciado V2 abajo, dos sensores de nivel magnéticos (flotadores) S1 abajo y S2 arriba, y una botonera START / STOP.',
  cableado: [
    { dir: 'I0.1', nombre: 'C', descripcion: 'Pulsador de inicio (START, NA)' },
    { dir: 'I0.2', nombre: 'P', descripcion: 'Pulsador de parada (STOP, NA)' },
    { dir: 'I0.3', nombre: 'S1', descripcion: 'Sensor de vaciado: flotador bajo, activo si hay líquido a su altura' },
    { dir: 'I0.4', nombre: 'S2', descripcion: 'Sensor de llenado: flotador alto, activo si el nivel llega arriba' },
    { dir: 'Q0.1', nombre: 'V1', descripcion: 'Electroválvula de llenado' },
    { dir: 'Q0.2', nombre: 'V2', descripcion: 'Electroválvula de vaciado' },
  ],
  mandos: [
    { dir: 'I0.1', nombre: 'START', tipo: 'pulsador', color: 'verde' },
    { dir: 'I0.2', nombre: 'STOP', tipo: 'pulsador', color: 'rojo' },
  ],
}

/** Alturas (fracción del estanque) a las que están los flotadores. */
export const NIVEL_S1 = 0.1
export const NIVEL_S2 = 0.88

export class PlantaEstanque implements Planta {
  readonly id = 'estanque' as const
  eventos: EventoPlanta[] = []
  /** 0 = vacío, 1 = hasta el borde. */
  nivel = 0
  entrando = false
  saliendo = false
  t = 0
  private rebalsando = false
  private cruzados = false
  /** Caudales en fracción de estanque por segundo. */
  caudalLlenado = 0.11
  caudalVaciado = 0.14

  sensores() {
    return { 'I0.3': this.nivel >= NIVEL_S1, 'I0.4': this.nivel >= NIVEL_S2 }
  }

  paso(salidas: Record<string, boolean>, dt: number) {
    this.t += dt
    const antes = this.sensores()
    this.entrando = !!salidas['Q0.1']
    this.saliendo = !!salidas['Q0.2'] && this.nivel > 0
    let nivel = this.nivel
    if (this.entrando) nivel += this.caudalLlenado * dt
    if (this.saliendo) nivel -= this.caudalVaciado * dt
    nivel = Math.max(0, nivel)
    // Lleno hasta el borde con agua entrando: el sobrante se derrama.
    if (nivel >= 1 && this.entrando && !this.saliendo) {
      if (!this.rebalsando) {
        this.avisar('¡El estanque rebalsa! V1 sigue abierta con el estanque lleno: el programa no la cerró con S2.')
        this.rebalsando = true
      }
    } else if (nivel < 0.98) this.rebalsando = false
    this.nivel = Math.min(1, nivel)
    const cruzadas = this.entrando && !!salidas['Q0.2']
    if (cruzadas && !this.cruzados) {
      this.avisar('V1 y V2 están abiertas a la vez: el agua entra y sale sin hacer nada útil (el enunciado pide que nunca pase).')
    }
    this.cruzados = cruzadas
    const ahora = this.sensores()
    if (ahora['I0.4'] !== antes['I0.4']) {
      this.contar(ahora['I0.4'] ? 'el nivel llega arriba: el flotador S2 se activa' : 'el nivel baja de S2: el flotador S2 se desactiva')
    }
    if (ahora['I0.3'] !== antes['I0.3']) {
      this.contar(ahora['I0.3'] ? 'el agua cubre el flotador S1: S1 se activa' : 'el estanque se vació: el flotador S1 se desactiva')
    }
  }

  acciones(): Accion[] {
    return [{ id: 'vaciar', etiqueta: 'Vaciar a mano', titulo: 'Deja el estanque vacío, como al empezar' }]
  }

  accion(id: string) {
    if (id === 'vaciar') {
      this.nivel = 0
      this.contar('se vacía el estanque a mano')
    }
  }

  private contar(mensaje: string) {
    this.eventos.push({ t: this.t, mensaje })
  }
  private avisar(mensaje: string) {
    this.eventos.push({ t: this.t, mensaje, aviso: true })
  }
}

// ---------------------------------------------------------------------------
// Elevador de piezas (Ejercicio 2 del apunte)
// ---------------------------------------------------------------------------
export const ELEVADOR: DescripcionPlanta = {
  id: 'elevador',
  nombre: 'Elevador de piezas con dos cilindros',
  resumen:
    'El cilindro Z1 sube la plataforma con la pieza y el Z2 la empuja a la banda de arriba. Cada cilindro tiene su electroválvula (Y1, Y2) y dos finales de carrera; S0 detecta que hay una pieza en la plataforma.',
  cableado: [
    { dir: 'I0.0', nombre: 'S0', descripcion: 'Detector de proximidad: hay una pieza lista para ser elevada' },
    { dir: 'I0.1', nombre: 'S1', descripcion: 'Final de carrera: Z1 en su posición inicial (abajo)' },
    { dir: 'I0.2', nombre: 'S2', descripcion: 'Final de carrera: Z1 en su posición final (arriba)' },
    { dir: 'I0.3', nombre: 'S3', descripcion: 'Final de carrera: Z2 en su posición inicial' },
    { dir: 'I0.4', nombre: 'S4', descripcion: 'Final de carrera: Z2 en su posición final' },
    { dir: 'Q0.0', nombre: 'Y1', descripcion: 'Electroválvula: activa el cilindro Z1' },
    { dir: 'Q0.1', nombre: 'Y2', descripcion: 'Electroválvula: activa el cilindro Z2' },
  ],
  mandos: [],
}

export type EstadoPieza = 'ninguna' | 'plataforma' | 'fuera'

export class PlantaElevador implements Planta {
  readonly id = 'elevador' as const
  eventos: EventoPlanta[] = []
  /** Posición de los vástagos: 0 = retraído, 1 = extendido. */
  z1 = 0
  z2 = 0
  pieza: EstadoPieza = 'ninguna'
  /** Cuánto ha empujado Z2 a la pieza (0..1) y cuánto lleva en la banda. */
  empuje = 0
  enBanda = 0
  transferidas = 0
  automatico = false
  t = 0
  /** Segundos que tarda cada cilindro en recorrer su carrera. */
  carrera = 1.4
  private esperaNueva = 0
  private choque = false

  sensores() {
    return {
      'I0.0': this.pieza === 'plataforma',
      'I0.1': this.z1 <= 0.02,
      'I0.2': this.z1 >= 0.98,
      'I0.3': this.z2 <= 0.02,
      'I0.4': this.z2 >= 0.98,
    }
  }

  paso(salidas: Record<string, boolean>, dt: number) {
    this.t += dt
    const antes = this.sensores()
    const v = dt / this.carrera
    // Válvulas monoestables: con bobina avanzan, sin ella el muelle las devuelve.
    let z1 = this.z1 + (salidas['Q0.0'] ? v : -v)
    const z2 = Math.min(1, Math.max(0, this.z2 + (salidas['Q0.1'] ? v : -v)))
    // Si Z2 está fuera, la plataforma no puede pasar: choca con su vástago.
    const tope = 0.8
    if (this.z2 > 0.15 && this.z1 <= tope && z1 > tope) {
      z1 = tope
      if (!this.choque) {
        this.avisar('La plataforma choca con el vástago de Z2: Z2 salió antes de que Z1 llegara arriba.')
        this.choque = true
      }
    } else if (z1 < tope - 0.05) this.choque = false
    this.z1 = Math.min(1, Math.max(0, z1))
    this.z2 = z2

    // Z2 sólo alcanza la pieza con la plataforma arriba.
    if (this.pieza === 'plataforma' && this.z1 >= 0.98) {
      this.empuje = Math.max(this.empuje, this.z2)
      if (this.empuje >= 0.98) {
        this.pieza = 'fuera'
        this.enBanda = 0
        this.contar('Z2 empuja la pieza a la banda de arriba')
      }
    }
    if (this.pieza === 'fuera') {
      this.enBanda += dt / 1.6
      if (this.enBanda >= 1) {
        this.pieza = 'ninguna'
        this.empuje = 0
        this.transferidas++
        this.contar(`la pieza sale por la banda (${this.transferidas} transferida${this.transferidas === 1 ? '' : 's'})`)
        this.esperaNueva = 1.5
      }
    }
    if (this.automatico && this.pieza === 'ninguna') {
      this.esperaNueva -= dt
      if (this.esperaNueva <= 0 && this.z1 <= 0.02) this.accion('pieza')
    }

    const ahora = this.sensores()
    const nombres: Record<string, [string, string]> = {
      'I0.1': ['Z1 llega abajo: S1 se activa', 'Z1 deja su posición inicial'],
      'I0.2': ['Z1 llega arriba: S2 se activa', 'Z1 empieza a bajar'],
      'I0.3': ['Z2 vuelve a su inicio: S3 se activa', 'Z2 empieza a salir'],
      'I0.4': ['Z2 llega a su final: S4 se activa', 'Z2 empieza a volver'],
    }
    for (const [dir, [si, no]] of Object.entries(nombres)) {
      if (ahora[dir as keyof typeof ahora] !== antes[dir as keyof typeof antes]) {
        this.contar(ahora[dir as keyof typeof ahora] ? si : no)
      }
    }
  }

  acciones(): Accion[] {
    return [
      { id: 'pieza', etiqueta: '＋ Poner pieza', titulo: 'Deja una pieza en la plataforma del elevador' },
      {
        id: 'auto',
        etiqueta: this.automatico ? '✓ Alimentación automática' : 'Alimentación automática',
        titulo: 'Llega una pieza nueva cada vez que la anterior sale por la banda',
      },
    ]
  }

  accion(id: string) {
    if (id === 'auto') {
      this.automatico = !this.automatico
      this.esperaNueva = 0
      return
    }
    if (id === 'pieza') {
      if (this.pieza !== 'ninguna') return
      if (this.z1 > 0.02) {
        this.avisar('La plataforma no está abajo: la pieza no se puede cargar ahora.')
        return
      }
      this.pieza = 'plataforma'
      this.empuje = 0
      this.contar('llega una pieza a la plataforma: S0 la detecta')
    }
  }

  private contar(mensaje: string) {
    this.eventos.push({ t: this.t, mensaje })
  }
  private avisar(mensaje: string) {
    this.eventos.push({ t: this.t, mensaje, aviso: true })
  }
}

export const PLANTAS: Record<IdPlanta, DescripcionPlanta> = {
  tablero: TABLERO,
  estanque: ESTANQUE,
  elevador: ELEVADOR,
}

export function crearPlanta(id: IdPlanta): Planta {
  if (id === 'estanque') return new PlantaEstanque()
  if (id === 'elevador') return new PlantaElevador()
  return new PlantaTablero()
}
