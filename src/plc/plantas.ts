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
  /** Pulsador normalmente cerrado: la entrada vale 1 en reposo y 0 al pulsarlo. */
  nc?: boolean
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

// ---------------------------------------------------------------------------
// Silo que llena cajas en una cinta (como el «Silo Simulator» de LogixPro)
// ---------------------------------------------------------------------------
export const SILO: DescripcionPlanta = {
  id: 'silo',
  nombre: 'Silo que llena cajas en una cinta',
  resumen:
    'La cinta trae cajas vacías bajo el silo. El sensor de proximidad detecta la caja en posición; la electroválvula deja caer el material y el sensor de nivel avisa cuando la caja está llena. Pilotos RUN, FILL y FULL. El cableado es el del simulador LogixPro; STOP es un pulsador normalmente cerrado.',
  cableado: [
    { dir: 'I0.0', nombre: 'START', descripcion: 'Pulsador de marcha (NA)' },
    { dir: 'I0.1', nombre: 'STOP', descripcion: 'Pulsador de paro (NC: vale 1 en reposo, 0 al pulsarlo)' },
    { dir: 'I0.3', nombre: 'PROX', descripcion: 'Sensor de proximidad: hay una caja bajo el silo' },
    { dir: 'I0.4', nombre: 'LEVEL', descripcion: 'Sensor de nivel: la caja bajo el silo está llena' },
    { dir: 'Q0.0', nombre: 'MOTOR', descripcion: 'Motor de la cinta transportadora' },
    { dir: 'Q0.1', nombre: 'SOLENOID', descripcion: 'Electroválvula de descarga del silo' },
    { dir: 'Q0.2', nombre: 'RUN', descripcion: 'Piloto: sistema en marcha' },
    { dir: 'Q0.3', nombre: 'FILL', descripcion: 'Piloto: llenando' },
    { dir: 'Q0.4', nombre: 'FULL', descripcion: 'Piloto: caja llena' },
  ],
  mandos: [
    { dir: 'I0.0', nombre: 'START', tipo: 'pulsador', color: 'verde' },
    { dir: 'I0.1', nombre: 'STOP', tipo: 'pulsador', color: 'rojo', nc: true },
  ],
}

/** Posición (0..1 a lo largo de la cinta) del silo y su tolerancia. */
export const X_SILO = 0.5
const VENTANA_PROX = 0.012
const ANCHO_CAJA = 0.1

export interface Caja {
  x: number
  llenado: number
  id: number
}

export class PlantaSilo implements Planta {
  readonly id = 'silo' as const
  eventos: EventoPlanta[] = []
  cajas: Caja[] = [{ x: 0.2, llenado: 0, id: 1 }]
  /** Material derramado fuera de las cajas (0..1, para dibujarlo). */
  derrame = 0
  cayendo = false
  cintaEnMarcha = false
  /** Recorrido de la cinta, para animar rodillos. */
  avance = 0
  llenas = 0
  t = 0
  velocidad = 0.09
  caudal = 0.28
  private siguiente = 2
  private avisoDerrame = false
  private avisoRebalse = false

  private bajoSilo() {
    return this.cajas.find((c) => Math.abs(c.x - X_SILO) < ANCHO_CAJA * 0.35)
  }

  sensores() {
    const c = this.cajas.find((k) => Math.abs(k.x - X_SILO) <= VENTANA_PROX)
    const b = this.bajoSilo()
    return { 'I0.3': !!c, 'I0.4': !!b && b.llenado >= 1 }
  }

  paso(salidas: Record<string, boolean>, dt: number) {
    this.t += dt
    const antes = this.sensores()
    this.cintaEnMarcha = !!salidas['Q0.0']
    if (this.cintaEnMarcha) {
      const d = this.velocidad * dt
      this.avance += d
      for (const c of this.cajas) c.x += d
      // Sale la caja por el final de la cinta.
      const fuera = this.cajas.filter((c) => c.x > 1.08)
      for (const c of fuera) {
        if (c.llenado >= 0.98) this.llenas++
        this.contar(c.llenado >= 0.98 ? `sale una caja llena (${this.llenas})` : 'sale una caja sin llenar')
        if (c.llenado < 0.98) this.avisar('Pasó una caja sin llenar: la cinta no se detuvo bajo el silo el tiempo necesario.')
      }
      this.cajas = this.cajas.filter((c) => c.x <= 1.08)
      // Entra una caja vacía cuando hay hueco al principio.
      const primera = Math.min(...this.cajas.map((c) => c.x), 2)
      if (primera > 0.3) this.cajas.unshift({ x: primera - 0.3, llenado: 0, id: this.siguiente++ })
    }
    this.cayendo = !!salidas['Q0.1']
    if (this.cayendo) {
      const b = this.bajoSilo()
      if (b) {
        b.llenado += this.caudal * dt
        if (b.llenado > 1.05 && !this.avisoRebalse) {
          this.avisar('¡La caja rebalsa! La válvula sigue abierta con la caja llena.')
          this.avisoRebalse = true
        }
        b.llenado = Math.min(1.1, b.llenado)
      } else {
        this.derrame = Math.min(1, this.derrame + dt * 0.2)
        if (!this.avisoDerrame) {
          this.avisar('El material cae sobre la cinta: la válvula se abrió sin una caja debajo.')
          this.avisoDerrame = true
        }
      }
      if (this.cintaEnMarcha && b && !this.avisoDerrame) {
        this.avisar('La válvula está abierta con la cinta en marcha: el material se desparrama.')
        this.avisoDerrame = true
      }
    } else {
      this.avisoRebalse = false
      this.avisoDerrame = false
    }
    const ahora = this.sensores()
    if (ahora['I0.3'] !== antes['I0.3']) this.contar(ahora['I0.3'] ? 'una caja llega bajo el silo: PROX se activa' : 'la caja deja la posición de llenado')
    if (ahora['I0.4'] !== antes['I0.4']) this.contar(ahora['I0.4'] ? 'la caja está llena: LEVEL se activa' : 'LEVEL se desactiva')
  }

  acciones(): Accion[] {
    return [{ id: 'limpiar', etiqueta: 'Limpiar la cinta', titulo: 'Quita el material derramado y deja cajas vacías' }]
  }

  accion(id: string) {
    if (id === 'limpiar') {
      this.derrame = 0
      this.cajas = [{ x: 0.2, llenado: 0, id: this.siguiente++ }]
      this.contar('se limpia la cinta')
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
// Semáforo de un cruce
// ---------------------------------------------------------------------------
export const SEMAFORO: DescripcionPlanta = {
  id: 'semaforo',
  nombre: 'Semáforos de un cruce',
  resumen:
    'Un cruce con semáforo Norte-Sur y Este-Oeste (rojo, amarillo y verde). Los autos avanzan con verde y esperan con rojo; la planta avisa si las dos calles tienen paso a la vez.',
  cableado: [
    { dir: 'I0.0', nombre: 'MARCHA', descripcion: 'Pulsador de marcha (NA)' },
    { dir: 'I0.1', nombre: 'PARO', descripcion: 'Pulsador de paro (NA)' },
    { dir: 'I0.2', nombre: 'PEATON', descripcion: 'Botón de peatón (NA)' },
    { dir: 'Q0.0', nombre: 'ROJO_NS', descripcion: 'Rojo Norte-Sur' },
    { dir: 'Q0.1', nombre: 'AMAR_NS', descripcion: 'Amarillo Norte-Sur' },
    { dir: 'Q0.2', nombre: 'VERDE_NS', descripcion: 'Verde Norte-Sur' },
    { dir: 'Q0.3', nombre: 'ROJO_EO', descripcion: 'Rojo Este-Oeste' },
    { dir: 'Q0.4', nombre: 'AMAR_EO', descripcion: 'Amarillo Este-Oeste' },
    { dir: 'Q0.5', nombre: 'VERDE_EO', descripcion: 'Verde Este-Oeste' },
  ],
  mandos: [
    { dir: 'I0.0', nombre: 'MARCHA', tipo: 'pulsador', color: 'verde' },
    { dir: 'I0.1', nombre: 'PARO', tipo: 'pulsador', color: 'rojo' },
    { dir: 'I0.2', nombre: 'PEATÓN', tipo: 'pulsador', color: 'amarillo' },
  ],
}

export interface Auto {
  /** Posición a lo largo de su calle (−1..1; el cruce está en 0). */
  s: number
  eje: 'NS' | 'EO'
  id: number
}

/** Línea de detención antes del cruce. */
const PARE = -0.22

export class PlantaSemaforo implements Planta {
  readonly id = 'semaforo' as const
  eventos: EventoPlanta[] = []
  autos: Auto[] = [
    { s: -0.9, eje: 'NS', id: 1 },
    { s: -0.55, eje: 'NS', id: 2 },
    { s: -0.8, eje: 'EO', id: 3 },
    { s: -0.45, eje: 'EO', id: 4 },
  ]
  t = 0
  cruces = 0
  private siguiente = 5
  private conflicto = false

  sensores() {
    return {}
  }

  paso(salidas: Record<string, boolean>, dt: number) {
    this.t += dt
    const pasa = {
      NS: !!(salidas['Q0.2'] || salidas['Q0.1']),
      EO: !!(salidas['Q0.5'] || salidas['Q0.4']),
    }
    const ambos = (salidas['Q0.2'] || salidas['Q0.1']) && (salidas['Q0.5'] || salidas['Q0.4'])
    const verdeYRojo = (salidas['Q0.2'] && salidas['Q0.0']) || (salidas['Q0.5'] && salidas['Q0.3'])
    if ((ambos || verdeYRojo) && !this.conflicto) {
      this.avisar(ambos ? '¡Las dos calles tienen paso a la vez! En un cruce real chocarían.' : 'Un semáforo muestra verde y rojo a la vez.')
    }
    this.conflicto = !!(ambos || verdeYRojo)
    const v = 0.3 * dt
    for (const eje of ['NS', 'EO'] as const) {
      const fila = this.autos.filter((a) => a.eje === eje).sort((a, b) => b.s - a.s)
      let delante = Infinity
      for (const a of fila) {
        let limite = delante - 0.22
        // Sin paso, se detiene en la línea (si todavía no la cruzó).
        if (!pasa[eje] && a.s <= PARE + 0.001) limite = Math.min(limite, PARE)
        a.s = Math.min(a.s + v, Math.max(a.s, limite))
        delante = a.s
      }
    }
    const salen = this.autos.filter((a) => a.s > 1.05)
    this.cruces += salen.length
    this.autos = this.autos.filter((a) => a.s <= 1.05)
    for (const eje of ['NS', 'EO'] as const) {
      const ultimo = Math.min(...this.autos.filter((a) => a.eje === eje).map((a) => a.s), 2)
      if (ultimo > -0.7) this.autos.push({ s: -1.05, eje, id: this.siguiente++ })
    }
  }

  acciones(): Accion[] {
    return []
  }
  accion() {}

  private avisar(mensaje: string) {
    this.eventos.push({ t: this.t, mensaje, aviso: true })
  }
}

// ---------------------------------------------------------------------------
// Portón automático (como el «Door Simulator» de LogixPro)
// ---------------------------------------------------------------------------
export const PORTON: DescripcionPlanta = {
  id: 'porton',
  nombre: 'Portón automático',
  resumen:
    'Un portón que sube y baja con un motor de dos sentidos. Finales de carrera arriba y abajo, fotocelda de seguridad, botonera ABRIR / CERRAR / PARO y pilotos de estado.',
  cableado: [
    { dir: 'I0.0', nombre: 'ABRIR', descripcion: 'Pulsador abrir (NA)' },
    { dir: 'I0.1', nombre: 'CERRAR', descripcion: 'Pulsador cerrar (NA)' },
    { dir: 'I0.2', nombre: 'PARO', descripcion: 'Pulsador de paro (NA)' },
    { dir: 'I0.3', nombre: 'FC_ABIERTO', descripcion: 'Final de carrera: portón arriba (abierto)' },
    { dir: 'I0.4', nombre: 'FC_CERRADO', descripcion: 'Final de carrera: portón abajo (cerrado)' },
    { dir: 'I0.5', nombre: 'FOTOCELDA', descripcion: 'Fotocelda: 1 si hay algo bajo el portón' },
    { dir: 'Q0.0', nombre: 'SUBIR', descripcion: 'Motor en sentido de apertura' },
    { dir: 'Q0.1', nombre: 'BAJAR', descripcion: 'Motor en sentido de cierre' },
    { dir: 'Q0.2', nombre: 'L_ABIERTO', descripcion: 'Piloto: abierto' },
    { dir: 'Q0.3', nombre: 'L_CERRADO', descripcion: 'Piloto: cerrado' },
    { dir: 'Q0.4', nombre: 'L_MOVIENDO', descripcion: 'Piloto: en movimiento' },
  ],
  mandos: [
    { dir: 'I0.0', nombre: 'ABRIR', tipo: 'pulsador', color: 'verde' },
    { dir: 'I0.1', nombre: 'CERRAR', tipo: 'pulsador', color: 'negro' },
    { dir: 'I0.2', nombre: 'PARO', tipo: 'pulsador', color: 'rojo' },
  ],
}

export class PlantaPorton implements Planta {
  readonly id = 'porton' as const
  eventos: EventoPlanta[] = []
  /** 0 = cerrado (abajo), 1 = abierto (arriba). */
  apertura = 0
  obstaculo = false
  sube = false
  baja = false
  t = 0
  recorrido = 5
  private avisos = new Set<string>()

  sensores() {
    return {
      'I0.3': this.apertura >= 0.995,
      'I0.4': this.apertura <= 0.005,
      'I0.5': this.obstaculo,
    }
  }

  paso(salidas: Record<string, boolean>, dt: number) {
    this.t += dt
    const antes = this.sensores()
    this.sube = !!salidas['Q0.0']
    this.baja = !!salidas['Q0.1']
    if (this.sube && this.baja) {
      this.avisoUnaVez('dos', '¡SUBIR y BAJAR a la vez! El motor recibe las dos órdenes: falta el enclavamiento entre ellas.')
    } else if (this.sube) {
      if (this.apertura >= 1) this.avisoUnaVez('tope-arriba', 'El motor sigue subiendo con el portón arriba: usa el final de carrera FC_ABIERTO para cortarlo.')
      this.apertura = Math.min(1, this.apertura + dt / this.recorrido)
    } else if (this.baja) {
      if (this.apertura <= 0) this.avisoUnaVez('tope-abajo', 'El motor sigue bajando con el portón cerrado: usa FC_CERRADO para cortarlo.')
      // Con algo bajo el portón, no puede bajar más que hasta el obstáculo.
      const minimo = this.obstaculo ? 0.35 : 0
      if (this.obstaculo && this.apertura <= minimo + 0.001) {
        this.avisoUnaVez('aplasta', '¡El portón baja sobre el obstáculo! La fotocelda debe detenerlo (y conviene que vuelva a subir).')
      }
      this.apertura = Math.max(minimo, this.apertura - dt / this.recorrido)
    }
    if (!this.sube) this.avisos.delete('tope-arriba')
    if (!this.baja) {
      this.avisos.delete('tope-abajo')
      this.avisos.delete('aplasta')
    }
    if (!(this.sube && this.baja)) this.avisos.delete('dos')
    const ahora = this.sensores()
    if (ahora['I0.3'] !== antes['I0.3'] && ahora['I0.3']) this.contar('el portón llega arriba: FC_ABIERTO se activa')
    if (ahora['I0.4'] !== antes['I0.4'] && ahora['I0.4']) this.contar('el portón llega abajo: FC_CERRADO se activa')
  }

  acciones(): Accion[] {
    return [
      {
        id: 'obstaculo',
        etiqueta: this.obstaculo ? '✓ Hay un obstáculo' : 'Poner un obstáculo',
        titulo: 'Pone (o quita) una caja bajo el portón: corta el haz de la fotocelda',
      },
    ]
  }

  accion(id: string) {
    if (id !== 'obstaculo') return
    if (!this.obstaculo && this.apertura < 0.4) {
      this.avisar('No cabe nada bajo el portón: ábrelo primero.')
      return
    }
    this.obstaculo = !this.obstaculo
    this.contar(this.obstaculo ? 'se pone una caja bajo el portón: la fotocelda la detecta' : 'se quita la caja')
  }

  private avisoUnaVez(clave: string, mensaje: string) {
    if (this.avisos.has(clave)) return
    this.avisos.add(clave)
    this.avisar(mensaje)
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
  silo: SILO,
  semaforo: SEMAFORO,
  porton: PORTON,
}

export function crearPlanta(id: IdPlanta): Planta {
  if (id === 'estanque') return new PlantaEstanque()
  if (id === 'elevador') return new PlantaElevador()
  if (id === 'silo') return new PlantaSilo()
  if (id === 'semaforo') return new PlantaSemaforo()
  if (id === 'porton') return new PlantaPorton()
  return new PlantaTablero()
}
