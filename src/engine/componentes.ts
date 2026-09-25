/**
 * Biblioteca de modelos de componentes (lógica pura, sin UI).
 * Paso 1: fuente (compresor + FRL), válvula 3/2 y cilindro de simple efecto.
 */
import type {
  EmitirEvento,
  EntradasPuertos,
  ModeloComponente,
  Params,
} from './tipos'

const num = (params: Params, clave: string, defecto: number): number =>
  typeof params[clave] === 'number' ? (params[clave] as number) : defecto

const bool = (params: Params, clave: string, defecto: boolean): boolean =>
  typeof params[clave] === 'boolean' ? (params[clave] as boolean) : defecto

const limitar = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x))

// ---------------------------------------------------------------------------
// Fuente: compresor + unidad de mantenimiento FRL con presión regulable.
// Cuando está apagada, el regulador ventea aguas abajo (puerto tratado como
// escape por el solver al entregar presión 0).
// ---------------------------------------------------------------------------
export type EstadoFuente = Record<string, never>

export const Fuente: ModeloComponente<EstadoFuente> = {
  tipo: 'fuente',
  nombre: 'Compresor + unidad FRL',
  puertos: [{ id: '1', rol: 'alimentacion', descripcion: 'Salida de aire comprimido' }],
  estadoInicial: () => ({}),
  presionSuministro: (_estado, params) =>
    bool(params, 'encendida', true) ? limitar(num(params, 'presion', 6), 0, 10) : 0,
  caminos: () => [],
}

// ---------------------------------------------------------------------------
// Válvula 3/2 con retorno por muelle. Se acciona con pulsador, con pulsador
// con enclavamiento (queda accionada hasta volver a pulsarla: la válvula de
// inicio de un ciclo automático) o por pilotaje neumático.
// Puertos ISO: 1 = alimentación, 2 = trabajo, 3 = escape, 12/10 = pilotaje.
//   NC en reposo: 2→3 (salida venteada). Accionada: 1→2.
//   NA en reposo: 1→2.                    Accionada: 2→3.
// ---------------------------------------------------------------------------
const UMBRAL_PILOTO = 2 // bar mínimos para mover la corredera

export interface EstadoValvula32 {
  accionada: boolean
}

export const Valvula32: ModeloComponente<EstadoValvula32> = {
  tipo: 'valvula32',
  nombre: 'Válvula 3/2',
  puertos: [
    { id: '1', rol: 'trabajo', descripcion: 'Alimentación' },
    { id: '2', rol: 'trabajo', descripcion: 'Salida de trabajo' },
    { id: '3', rol: 'escape', descripcion: 'Escape a atmósfera' },
    // Pilotaje neumático (accionamiento «pilotaje»): 12 en la NC (abre 1→2), 10 en la NA (cierra 1).
    { id: '12', rol: 'trabajo', descripcion: 'Pilotaje: conmuta la válvula (NC: abre 1→2)', opcional: true },
    { id: '10', rol: 'trabajo', descripcion: 'Pilotaje: conmuta la válvula (NA: cierra el paso de 1)', opcional: true },
  ],
  estadoInicial: () => ({ accionada: false }),
  // Pilotada: la señal de aire la conmuta y el muelle la devuelve al desaparecer.
  asentar: (estado, entradas, params, emitir) => {
    if (params.accionamiento !== 'pilotaje') return false
    const puerto = params.reposo === 'NA' ? '10' : '12'
    const senal = (entradas.presion[puerto] ?? 0) > UMBRAL_PILOTO
    if (senal === estado.accionada) return false
    estado.accionada = senal
    emitir('conmutacion', senal ? `la señal en ${puerto} conmuta la válvula 3/2` : `sin señal en ${puerto}, el muelle devuelve la válvula 3/2 a reposo`)
    return true
  },
  caminos: (estado, params) => {
    const abiertaEnReposo = params.reposo === 'NA'
    const pasoAbierto = abiertaEnReposo !== estado.accionada // XOR
    return pasoAbierto
      ? [{ de: '1', a: '2', restriccion: 1 }]
      : [{ de: '2', a: '3', restriccion: 1 }]
  },
}

// ---------------------------------------------------------------------------
// Cilindro de simple efecto con retorno por muelle.
// El vástago avanza solo si la presión vence al muelle Y hay caudal desde la
// fuente; retorna solo si el aire de la cámara puede escapar. Si el aire queda
// atrapado (puerto sin camino a la atmósfera), el vástago se queda donde está.
// ---------------------------------------------------------------------------
export type FaseCilindro = 'reposo' | 'avanzando' | 'extendido' | 'retornando'

export interface EstadoCilindroSimple {
  /** Posición del vástago normalizada: 0 = retraído, 1 = extendido. */
  posicion: number
  /** Velocidad actual en carreras/segundo (negativa al retornar). */
  velocidad: number
  fase: FaseCilindro
}

export const CilindroSimpleEfecto: ModeloComponente<EstadoCilindroSimple> = {
  tipo: 'cilindroSimpleEfecto',
  nombre: 'Cilindro de simple efecto',
  puertos: [{ id: '1', rol: 'trabajo', descripcion: 'Cámara delantera' }],
  estadoInicial: () => ({ posicion: 0, velocidad: 0, fase: 'reposo' }),
  caminos: () => [],
  actualizar(estado, entradas: EntradasPuertos, dt, params, emitir: EmitirEvento) {
    const presionMuelle = num(params, 'presionMuelle', 1.5)
    const velAvance = num(params, 'velocidadAvance', 0.8) // carreras/s a caudal pleno
    const velRetorno = num(params, 'velocidadRetorno', 1.0)

    const p = entradas.presion['1'] ?? 0
    const qIn = entradas.caudalSuministro['1'] ?? 0
    const qOut = entradas.caudalEscape['1'] ?? 0

    let v = 0
    if (p > presionMuelle && qIn > 0) {
      v = velAvance * qIn
    } else if (p <= presionMuelle && qOut > 0) {
      v = -velRetorno * qOut
    }
    // Si no entra ni sale aire, el vástago queda bloqueado (aire atrapado).

    estado.velocidad = v
    estado.posicion = limitar(estado.posicion + v * dt)

    let nuevaFase: FaseCilindro
    if (estado.posicion >= 1 && v >= 0) nuevaFase = 'extendido'
    else if (estado.posicion <= 0 && v <= 0) nuevaFase = 'reposo'
    else if (v > 0) nuevaFase = 'avanzando'
    else if (v < 0) nuevaFase = 'retornando'
    else nuevaFase = estado.fase

    if (nuevaFase !== estado.fase) {
      estado.fase = nuevaFase
      const mensajes: Record<FaseCilindro, string> = {
        avanzando: 'el aire vence al muelle y el vástago avanza',
        extendido: 'el vástago llegó al final de carrera (extendido)',
        retornando: 'el muelle retorna el vástago y el aire de la cámara escapa',
        reposo: 'el vástago quedó retraído (posición inicial)',
      }
      emitir(nuevaFase, mensajes[nuevaFase])
    }
  },
}

// ---------------------------------------------------------------------------
// Válvula 5/2: monoestable (muelle) o biestable (memoria), con accionamiento
// por pulsador o pilotaje neumático (puertos 12 y 14).
// Puertos ISO: 1 = alimentación, 2 y 4 = trabajo, 3 y 5 = escapes.
//   Reposo:    1→2 y 4→5.
//   Accionada (señal en 14): 1→4 y 2→3.
// ---------------------------------------------------------------------------
export interface EstadoValvula52 {
  accionada: boolean
  conflictoPilotos: boolean
}


/**
 * Lógica de conmutación por pilotaje neumático, común a las válvulas de
 * corredera (4/2 y 5/2): señal en 14 → posición accionada, señal en 12 →
 * reposo. La biestable conserva su posición al desaparecer la señal.
 */
function actualizarPilotaje(
  estado: EstadoValvula52,
  entradas: EntradasPuertos,
  params: Params,
  emitir: EmitirEvento,
  salidaAccionada: string,
  salidaReposo: string,
): boolean {
  const biestable = params.modo === 'biestable'
  if (!biestable && params.accionamiento !== 'pilotaje') return false

  const p14 = (entradas.presion['14'] ?? 0) > UMBRAL_PILOTO
  const p12 = (entradas.presion['12'] ?? 0) > UMBRAL_PILOTO

  if (biestable && p14 && p12) {
    if (!estado.conflictoPilotos) {
      estado.conflictoPilotos = true
      emitir(
        'conflicto',
        'está pilotada por 12 y 14 a la vez: la corredera no puede moverse (error típico en circuitos biestables)',
      )
    }
    return false
  }
  estado.conflictoPilotos = false

  if (biestable) {
    if (p14 && !estado.accionada) {
      estado.accionada = true
      emitir('conmutacion', `la señal en 14 conmuta la válvula: el aire sale por ${salidaAccionada}`)
      return true
    }
    if (p12 && estado.accionada) {
      estado.accionada = false
      emitir('conmutacion', `la señal en 12 conmuta la válvula: el aire sale por ${salidaReposo}`)
      return true
    }
    // Sin señal, la biestable conserva su posición (memoria neumática).
    return false
  }
  if (p14 !== estado.accionada) {
    estado.accionada = p14
    emitir(
      'conmutacion',
      p14
        ? `la señal en 14 conmuta la válvula: el aire sale por ${salidaAccionada}`
        : 'sin señal en 14, el muelle devuelve la válvula a reposo',
    )
    return true
  }
  return false
}

export const Valvula52: ModeloComponente<EstadoValvula52> = {
  tipo: 'valvula52',
  nombre: 'Válvula 5/2',
  puertos: [
    { id: '1', rol: 'trabajo', descripcion: 'Alimentación' },
    { id: '2', rol: 'trabajo', descripcion: 'Salida de trabajo' },
    { id: '4', rol: 'trabajo', descripcion: 'Salida de trabajo' },
    { id: '3', rol: 'escape', descripcion: 'Escape de 2' },
    { id: '5', rol: 'escape', descripcion: 'Escape de 4' },
    { id: '12', rol: 'trabajo', descripcion: 'Pilotaje: conmuta hacia 1→2', opcional: true },
    { id: '14', rol: 'trabajo', descripcion: 'Pilotaje: conmuta hacia 1→4', opcional: true },
  ],
  estadoInicial: () => ({ accionada: false, conflictoPilotos: false }),
  caminos: (estado) =>
    estado.accionada
      ? [
          { de: '1', a: '4', restriccion: 1 },
          { de: '2', a: '3', restriccion: 1 },
        ]
      : [
          { de: '1', a: '2', restriccion: 1 },
          { de: '4', a: '5', restriccion: 1 },
        ],
  asentar: (estado, entradas, params, emitir) =>
    actualizarPilotaje(estado, entradas, params, emitir, '4', '2'),
}

// ---------------------------------------------------------------------------
// Válvula 4/2: como la 5/2 pero con un único escape (3) compartido por las dos
// vías de trabajo. Puertos ISO: 1 = alimentación, 2 y 4 = trabajo, 3 = escape.
//   Reposo:    1→2 y 4→3.
//   Accionada: 1→4 y 2→3.
// ---------------------------------------------------------------------------
export const Valvula42: ModeloComponente<EstadoValvula52> = {
  tipo: 'valvula42',
  nombre: 'Válvula 4/2',
  puertos: [
    { id: '1', rol: 'trabajo', descripcion: 'Alimentación' },
    { id: '2', rol: 'trabajo', descripcion: 'Salida de trabajo' },
    { id: '4', rol: 'trabajo', descripcion: 'Salida de trabajo' },
    { id: '3', rol: 'escape', descripcion: 'Escape común' },
    { id: '12', rol: 'trabajo', descripcion: 'Pilotaje: conmuta hacia 1→2', opcional: true },
    { id: '14', rol: 'trabajo', descripcion: 'Pilotaje: conmuta hacia 1→4', opcional: true },
  ],
  estadoInicial: () => ({ accionada: false, conflictoPilotos: false }),
  caminos: (estado) =>
    estado.accionada
      ? [
          { de: '1', a: '4', restriccion: 1 },
          { de: '2', a: '3', restriccion: 1 },
        ]
      : [
          { de: '1', a: '2', restriccion: 1 },
          { de: '4', a: '3', restriccion: 1 },
        ],
  asentar: (estado, entradas, params, emitir) =>
    actualizarPilotaje(estado, entradas, params, emitir, '4', '2'),
}

// ---------------------------------------------------------------------------
// Cilindro de doble efecto: el aire empuja en ambos sentidos. La velocidad la
// limita el menor de los dos caudales: el que entra a la cámara que empuja y
// el que logra escapar de la cámara contraria (por eso estrangular el escape
// frena el movimiento).
// Puertos: A = cámara trasera (avance), B = cámara delantera (retorno).
// ---------------------------------------------------------------------------
export interface EstadoCilindroDoble {
  posicion: number
  velocidad: number
  fase: FaseCilindro
}

const UMBRAL_FUERZA = 0.3 // diferencia de presión mínima para mover el pistón

/**
 * Física común a los actuadores de doble efecto (lineales y giratorios): el
 * movimiento lo limita el menor entre el aire que entra por la cámara que
 * empuja y el que consigue escapar de la contraria.
 */
function moverDobleEfecto(
  estado: EstadoCilindroDoble,
  entradas: EntradasPuertos,
  dt: number,
  params: Params,
  emitir: EmitirEvento,
  mensajes: Record<FaseCilindro, string>,
): void {
  const velIda = num(params, 'velocidadAvance', 0.8)
  const velVuelta = num(params, 'velocidadRetorno', 0.8)

  const pA = entradas.presion['A'] ?? 0
  const pB = entradas.presion['B'] ?? 0

  let v = 0
  if (pA - pB > UMBRAL_FUERZA) {
    v = velIda * Math.min(entradas.caudalSuministro['A'] ?? 0, entradas.caudalEscape['B'] ?? 0)
  } else if (pB - pA > UMBRAL_FUERZA) {
    v = -velVuelta * Math.min(entradas.caudalSuministro['B'] ?? 0, entradas.caudalEscape['A'] ?? 0)
  }

  estado.velocidad = v
  estado.posicion = limitar(estado.posicion + v * dt)

  let nuevaFase: FaseCilindro
  if (estado.posicion >= 1 && v >= 0) nuevaFase = 'extendido'
  else if (estado.posicion <= 0 && v <= 0) nuevaFase = 'reposo'
  else if (v > 0) nuevaFase = 'avanzando'
  else if (v < 0) nuevaFase = 'retornando'
  else nuevaFase = estado.fase

  if (nuevaFase !== estado.fase) {
    estado.fase = nuevaFase
    emitir(nuevaFase, mensajes[nuevaFase])
  }
}

export const CilindroDobleEfecto: ModeloComponente<EstadoCilindroDoble> = {
  tipo: 'cilindroDobleEfecto',
  nombre: 'Cilindro de doble efecto',
  puertos: [
    { id: 'A', rol: 'trabajo', descripcion: 'Cámara trasera (avance)' },
    { id: 'B', rol: 'trabajo', descripcion: 'Cámara delantera (retorno)' },
  ],
  estadoInicial: () => ({ posicion: 0, velocidad: 0, fase: 'reposo' }),
  caminos: () => [],
  actualizar(estado, entradas, dt, params, emitir) {
    moverDobleEfecto(estado, entradas, dt, params, emitir, {
      avanzando: 'entra aire por A y el vástago avanza (la cámara B escapa)',
      extendido: 'el vástago llegó al final de carrera (extendido)',
      retornando: 'entra aire por B y el vástago retorna (la cámara A escapa)',
      reposo: 'el vástago quedó retraído (posición inicial)',
    })
  },
}

// ---------------------------------------------------------------------------
// Actuador giratorio (unidad giratoria de paletas): el mismo doble efecto,
// pero el aire hace girar un eje un ángulo limitado en vez de desplazar un
// vástago. Es el elemento de las unidades de volteo (giro de 180°).
// ---------------------------------------------------------------------------
export const ActuadorGiratorio: ModeloComponente<EstadoCilindroDoble> = {
  tipo: 'actuadorGiratorio',
  nombre: 'Actuador giratorio',
  puertos: [
    { id: 'A', rol: 'trabajo', descripcion: 'Cámara de giro directo' },
    { id: 'B', rol: 'trabajo', descripcion: 'Cámara de giro inverso' },
  ],
  estadoInicial: () => ({ posicion: 0, velocidad: 0, fase: 'reposo' }),
  caminos: () => [],
  actualizar(estado, entradas, dt, params, emitir) {
    const angulo = num(params, 'angulo', 180)
    moverDobleEfecto(estado, entradas, dt, params, emitir, {
      avanzando: `entra aire por A y el eje gira hacia los ${angulo}°`,
      extendido: `el eje llegó al tope de giro (${angulo}°)`,
      retornando: 'entra aire por B y el eje gira de vuelta',
      reposo: 'el eje volvió a su posición inicial (0°)',
    })
  },
}

// ---------------------------------------------------------------------------
// Motor neumático de giro continuo: a diferencia del actuador giratorio (que
// gira un ángulo fijo y se detiene en el tope), este gira sin parar mientras
// reciba aire por su único puerto, como el que arrastra una cinta
// transportadora o una rueda dentada. No tiene "extendido" ni "retraído": su
// posición dentro de la vuelta (0..1) da la vuelta sola en vez de quedarse
// clavada en los extremos, para que el Sensor de paso pueda detectar cada
// vuelta sin que el motor tenga que detenerse a esperarlo.
// ---------------------------------------------------------------------------
export interface EstadoMotor {
  posicion: number
  velocidad: number
  accionada: boolean
}

export const MotorNeumatico: ModeloComponente<EstadoMotor> = {
  tipo: 'motorNeumatico',
  nombre: 'Motor neumático (giro continuo)',
  puertos: [{ id: '1', rol: 'trabajo', descripcion: 'Alimentación: gira mientras reciba aire' }],
  estadoInicial: () => ({ posicion: 0, velocidad: 0, accionada: false }),
  caminos: () => [],
  actualizar(estado, entradas, dt, params, emitir) {
    const velNominal = num(params, 'velocidad', 0.4) // vueltas/s a caudal pleno
    const p = entradas.presion['1'] ?? 0
    const qIn = entradas.caudalSuministro['1'] ?? 0
    const girando = p > 0.5 && qIn > 0

    estado.velocidad = girando ? velNominal * qIn : 0
    if (estado.velocidad > 0) {
      let siguiente = (estado.posicion + estado.velocidad * dt) % 1
      if (siguiente < 0) siguiente += 1
      estado.posicion = siguiente
    }

    if (girando !== estado.accionada) {
      estado.accionada = girando
      emitir(
        girando ? 'girando' : 'detenido',
        girando ? 'entra aire por 1: el eje gira de forma continua' : 'sin aire en 1: el eje se detiene',
      )
    }
  },
}

// ---------------------------------------------------------------------------
// Regulador de caudal unidireccional: estrangula el paso 1→2 según `apertura`
// y deja paso libre 2→1 por el antirretorno.
// ---------------------------------------------------------------------------
export type EstadoRegulador = Record<string, never>

export const ReguladorCaudal: ModeloComponente<EstadoRegulador> = {
  tipo: 'reguladorCaudal',
  nombre: 'Regulador de caudal unidireccional',
  puertos: [
    { id: '1', rol: 'trabajo', descripcion: 'Entrada del sentido estrangulado' },
    { id: '2', rol: 'trabajo', descripcion: 'Salida del sentido estrangulado' },
  ],
  estadoInicial: () => ({}),
  caminos: (_estado, params) => [
    {
      de: '1',
      a: '2',
      restriccion: limitar(num(params, 'apertura', 0.5), 0.05, 1),
      restriccionInversa: 1,
    },
  ],
}


// ---------------------------------------------------------------------------
// Final de carrera de rodillo: una 3/2 que no se pulsa a mano, sino que la
// acciona el propio vástago de un cilindro al llegar a su punto de disparo.
// Es la pieza que permite montar ciclos automáticos.
// ---------------------------------------------------------------------------
export interface EstadoFinalCarrera {
  accionada: boolean
}

export const FinalCarrera: ModeloComponente<EstadoFinalCarrera> = {
  tipo: 'finalCarrera',
  nombre: 'Final de carrera (rodillo)',
  puertos: [
    { id: '1', rol: 'trabajo', descripcion: 'Alimentación' },
    { id: '2', rol: 'trabajo', descripcion: 'Salida de trabajo (señal)' },
    { id: '3', rol: 'escape', descripcion: 'Escape a atmósfera' },
  ],
  estadoInicial: () => ({ accionada: false }),
  caminos: (estado, params) => {
    const abiertaEnReposo = params.reposo === 'NA'
    const pasoAbierto = abiertaEnReposo !== estado.accionada
    return pasoAbierto
      ? [{ de: '1', a: '2', restriccion: 1 }]
      : [{ de: '2', a: '3', restriccion: 1 }]
  },
  asentar(estado, _entradas, params, emitir, ctx) {
    const idCilindro = typeof params.cilindro === 'string' ? params.cilindro : ''
    const pos = idCilindro ? ctx.posicionDe(idCilindro) : null
    if (pos === null) {
      // Sin cilindro asignado, el rodillo nunca se pisa.
      if (estado.accionada) {
        estado.accionada = false
        emitir('liberado', 'se ha quedado sin cilindro asignado y vuelve a reposo')
        return true
      }
      return false
    }
    const punto = limitar(num(params, 'puntoDisparo', 1))
    // Tolerancia muy fina: como la posición del vástago se recorta exactamente
    // en 0 y en 1, el rodillo se pisa justo al completar la carrera (y no un
    // poco antes, que dejaría al cilindro sin llegar nunca al final).
    const tolerancia = Math.max(0.001, num(params, 'tolerancia', 0.002))
    const pisado = Math.abs(pos - punto) <= tolerancia
    if (pisado !== estado.accionada) {
      estado.accionada = pisado
      emitir(
        pisado ? 'pisado' : 'liberado',
        pisado
          ? `el vástago de ${idCilindro} pisa el rodillo (${punto >= 0.5 ? 'final de carrera extendido' : 'posición retraída'}) y la válvula conmuta`
          : `el vástago de ${idCilindro} libera el rodillo y la válvula vuelve a reposo`,
      )
      return true
    }
    return false
  },
}

// ---------------------------------------------------------------------------
// Sensor de paso: detecta cada vez que el eje de un motor neumático cruza un
// punto de su vuelta (p. ej. "la cinta avanzó lo suficiente"). A diferencia
// del final de carrera —pensado para un vástago que se queda quieto en el
// tope, donde basta mirar si está cerca del punto—, un eje que gira sin parar
// puede cruzar el punto entre dos instantes de la simulación sin que la
// posición llegue nunca a estar "cerca" de él. Por eso el sensor compara la
// posición anterior con la actual y dispara si el punto quedó entre medio
// (contando la vuelta de 1 a 0), no por proximidad: así no se le escapa un
// pulso aunque el motor gire rápido.
// ---------------------------------------------------------------------------
export interface EstadoSensorGiro {
  accionada: boolean
  posAnterior: number | null
  tiempoRestante: number
}

export const SensorGiro: ModeloComponente<EstadoSensorGiro> = {
  tipo: 'sensorGiro',
  nombre: 'Sensor de paso (motor)',
  puertos: [
    { id: '1', rol: 'trabajo', descripcion: 'Alimentación' },
    { id: '2', rol: 'trabajo', descripcion: 'Salida de trabajo (pulso)' },
    { id: '3', rol: 'escape', descripcion: 'Escape a atmósfera' },
  ],
  estadoInicial: () => ({ accionada: false, posAnterior: null, tiempoRestante: 0 }),
  caminos: (estado) =>
    estado.accionada
      ? [{ de: '1', a: '2', restriccion: 1 }]
      : [{ de: '2', a: '3', restriccion: 1 }],
  actualizar(estado, _entradas, dt, params, emitir, ctx) {
    const idMotor = typeof params.motor === 'string' ? params.motor : ''
    const punto = limitar(num(params, 'puntoDisparo', 0))
    const duracion = Math.max(0.05, num(params, 'duracionPulso', 0.3))
    const pos = idMotor ? ctx.posicionDe(idMotor) : null

    if (pos === null) {
      estado.posAnterior = null
      if (estado.accionada) {
        estado.accionada = false
        estado.tiempoRestante = 0
        emitir('liberado', 'se ha quedado sin motor asignado')
      }
      return
    }

    if (estado.posAnterior !== null && estado.posAnterior !== pos) {
      const cruzo =
        estado.posAnterior <= pos
          ? punto > estado.posAnterior && punto <= pos
          : punto > estado.posAnterior || punto <= pos // dio la vuelta completa (1→0)
      if (cruzo) {
        estado.tiempoRestante = duracion
        emitir(
          'pulso',
          `el eje pasa por el punto marcado (${Math.round(punto * 100)}% de la vuelta) y dispara un pulso`,
        )
      }
    }
    estado.posAnterior = pos

    if (estado.tiempoRestante > 0) {
      estado.tiempoRestante = Math.max(0, estado.tiempoRestante - dt)
      if (!estado.accionada) estado.accionada = true
    } else if (estado.accionada) {
      estado.accionada = false
    }
  },
}

// ---------------------------------------------------------------------------
// Válvula selectora "O" (OR / antirretorno doble): la salida A recibe aire si
// hay presión en X **o** en Y. Internamente una bola sella la entrada de menor
// presión, así que modelamos la conexión con la entrada de MAYOR presión.
// ---------------------------------------------------------------------------
export interface EstadoLogica {
  /**
   * Entrada conectada con la salida. `null` = el elemento móvil aún no se ha
   * colocado (estado inicial): en ese instante no pasa nada de aire.
   * Es importante para la seguridad del mando bimanual: si la válvula «Y»
   * arrancase ya conectada a una entrada, daría una señal falsa de un ciclo
   * y el cilindro daría un tirón antes de bloquearse.
   */
  lado: 'X' | 'Y' | null
}

export const ValvulaO: ModeloComponente<EstadoLogica> = {
  tipo: 'valvulaO',
  nombre: 'Válvula selectora «O»',
  puertos: [
    { id: 'X', rol: 'trabajo', descripcion: 'Entrada de señal (equivale a un 1 de la norma)' },
    { id: 'Y', rol: 'trabajo', descripcion: 'Entrada de señal (equivale a un 1 de la norma)' },
    { id: 'A', rol: 'trabajo', descripcion: 'Salida (equivale al 2 de la norma)' },
  ],
  estadoInicial: () => ({ lado: null }),
  // La bola conecta el lado elegido con la salida y sella el otro.
  caminos: (estado) => (estado.lado ? [{ de: estado.lado, a: 'A', restriccion: 1 }] : []),
  asentar(estado, entradas, _params, emitir) {
    const pX = entradas.presion['X'] ?? 0
    const pY = entradas.presion['Y'] ?? 0
    const nuevo: 'X' | 'Y' = pY > pX ? 'Y' : 'X'
    if (nuevo === estado.lado) return false
    const primera = estado.lado === null
    estado.lado = nuevo
    if (!primera) {
      emitir('seleccion', `la bola sella la entrada de menor presión: ahora pasa la señal de ${nuevo}`)
    }
    return true
  },
}

// ---------------------------------------------------------------------------
// Válvula de simultaneidad "Y" (AND): la salida A solo recibe aire si hay
// presión en X **y** en Y. El elemento móvil deja pasar la señal de MENOR
// presión, que es justo lo que hace que baste soltar una entrada para que la
// salida se purgue (mando bimanual).
// ---------------------------------------------------------------------------
export const ValvulaY: ModeloComponente<EstadoLogica> = {
  tipo: 'valvulaY',
  nombre: 'Válvula de simultaneidad «Y»',
  puertos: [
    { id: 'X', rol: 'trabajo', descripcion: 'Entrada de señal (equivale a un 1 de la norma)' },
    { id: 'Y', rol: 'trabajo', descripcion: 'Entrada de señal (equivale a un 1 de la norma)' },
    { id: 'A', rol: 'trabajo', descripcion: 'Salida (equivale al 2 de la norma)' },
  ],
  estadoInicial: () => ({ lado: null }),
  caminos: (estado) => (estado.lado ? [{ de: estado.lado, a: 'A', restriccion: 1 }] : []),
  asentar(estado, entradas, _params, emitir) {
    const pX = entradas.presion['X'] ?? 0
    const pY = entradas.presion['Y'] ?? 0
    const nuevo: 'X' | 'Y' = pY < pX ? 'Y' : 'X'
    if (nuevo === estado.lado) return false
    const primera = estado.lado === null
    estado.lado = nuevo
    if (!primera) {
      emitir('seleccion', `pasa la señal más débil (${nuevo}): hacen falta las dos entradas a la vez`)
    }
    return true
  },
}

// ---------------------------------------------------------------------------
// Válvula de escape rápido: mientras entra aire por 1, alimenta 2; en cuanto la
// presión de 1 cae, comunica 2 directamente con el escape 3 sin que el aire
// tenga que recorrer toda la manguera de vuelta (el cilindro retorna más rápido).
// ---------------------------------------------------------------------------
export interface EstadoEscapeRapido {
  purgando: boolean
}

export const EscapeRapido: ModeloComponente<EstadoEscapeRapido> = {
  tipo: 'escapeRapido',
  nombre: 'Válvula de escape rápido',
  puertos: [
    { id: '1', rol: 'trabajo', descripcion: 'Entrada desde la válvula' },
    { id: '2', rol: 'trabajo', descripcion: 'Salida al actuador' },
    { id: '3', rol: 'escape', descripcion: 'Escape rápido a atmósfera' },
  ],
  estadoInicial: () => ({ purgando: false }),
  caminos: (estado) =>
    estado.purgando
      ? [{ de: '2', a: '3', restriccion: 1 }]
      : [{ de: '1', a: '2', restriccion: 1 }],
  asentar(estado, entradas, _params, emitir) {
    // El obturador lo mueve el caudal de alimentación, no la diferencia de
    // presión estática: en cuanto deja de llegar aire por 1, el obturador cae
    // y abre el escape 3 (comparar presiones no sirve, porque al soltar la
    // válvula los dos puertos quedan a presión atmosférica).
    const purgando = (entradas.caudalSuministro['1'] ?? 0) <= 0
    if (purgando !== estado.purgando) {
      estado.purgando = purgando
      emitir(
        purgando ? 'purga' : 'alimenta',
        purgando
          ? 'cae la presión de entrada: el obturador abre el escape 3 y el actuador se purga de golpe'
          : 'entra aire por 1: el obturador tapa el escape y alimenta el actuador por 2',
      )
      return true
    }
    return false
  },
}

// ---------------------------------------------------------------------------
// Temporizador neumático (retardo a la conexión): una 3/2 NC pilotada por 12 a
// través de un estrangulador y un depósito. La señal de salida aparece sólo
// después de mantener el pilotaje durante el tiempo ajustado.
// ---------------------------------------------------------------------------
export interface EstadoTemporizador {
  acumulado: number
  accionada: boolean
}

export const Temporizador: ModeloComponente<EstadoTemporizador> = {
  tipo: 'temporizador',
  nombre: 'Temporizador neumático',
  puertos: [
    { id: '1', rol: 'trabajo', descripcion: 'Alimentación' },
    { id: '2', rol: 'trabajo', descripcion: 'Salida retardada' },
    { id: '3', rol: 'escape', descripcion: 'Escape a atmósfera' },
    { id: '12', rol: 'trabajo', descripcion: 'Pilotaje: inicia la temporización' },
  ],
  estadoInicial: () => ({ acumulado: 0, accionada: false }),
  caminos: (estado) =>
    estado.accionada
      ? [{ de: '1', a: '2', restriccion: 1 }]
      : [{ de: '2', a: '3', restriccion: 1 }],
  actualizar(estado, entradas, dt, params, emitir) {
    const retardo = Math.max(0.1, num(params, 'retardo', 2))
    const pilotado = (entradas.presion['12'] ?? 0) > UMBRAL_PILOTO

    if (!pilotado) {
      // Al desaparecer el pilotaje, el depósito se vacía y el muelle repone.
      if (estado.accionada) {
        estado.accionada = false
        emitir('reposicion', 'desaparece el pilotaje: el depósito se vacía y la válvula vuelve a reposo')
      }
      estado.acumulado = 0
      return
    }

    if (estado.accionada) return
    estado.acumulado += dt
    if (estado.acumulado >= retardo) {
      estado.accionada = true
      emitir('temporizado', `el depósito se ha llenado tras ${retardo.toFixed(1)} s y la válvula conmuta`)
    }
  },
}

// ---------------------------------------------------------------------------
// Manómetro: instrumento pasivo de lectura. No conduce aire hacia ninguna
// parte —cuelga de una línea y sólo indica la presión estática que hay en su
// puerto—, por eso no tiene caminos internos. Lo usa la documentación para
// señalizar la presión de cada línea de grupo (p. ej. G1, G2, G3).
// ---------------------------------------------------------------------------
export type EstadoManometro = Record<string, never>

export const Manometro: ModeloComponente<EstadoManometro> = {
  tipo: 'manometro',
  nombre: 'Manómetro',
  puertos: [{ id: '1', rol: 'trabajo', descripcion: 'Conexión a la línea a medir' }],
  estadoInicial: () => ({}),
  caminos: () => [],
}

// ---------------------------------------------------------------------------
// Registro de modelos disponibles.
// ---------------------------------------------------------------------------
export const MODELOS: Record<string, ModeloComponente<any>> = {
  [Fuente.tipo]: Fuente,
  [Valvula32.tipo]: Valvula32,
  [Valvula42.tipo]: Valvula42,
  [Valvula52.tipo]: Valvula52,
  [CilindroSimpleEfecto.tipo]: CilindroSimpleEfecto,
  [CilindroDobleEfecto.tipo]: CilindroDobleEfecto,
  [ActuadorGiratorio.tipo]: ActuadorGiratorio,
  [MotorNeumatico.tipo]: MotorNeumatico,
  [ReguladorCaudal.tipo]: ReguladorCaudal,
  [FinalCarrera.tipo]: FinalCarrera,
  [SensorGiro.tipo]: SensorGiro,
  [ValvulaO.tipo]: ValvulaO,
  [ValvulaY.tipo]: ValvulaY,
  [EscapeRapido.tipo]: EscapeRapido,
  [Temporizador.tipo]: Temporizador,
  [Manometro.tipo]: Manometro,
}
