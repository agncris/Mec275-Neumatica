/**
 * Tipos base del motor de simulación neumática.
 *
 * El circuito se modela como un grafo:
 *  - nodos  = puertos de los componentes (numerados según ISO 1219-1: 1, 2, 3, 4, 5, 12, 14)
 *  - aristas = mangueras entre puertos + caminos internos de cada componente
 *              (que dependen de su estado, p. ej. la posición de la corredera de una válvula)
 */

export type IdPuerto = string

export interface RefPuerto {
  componente: string
  puerto: IdPuerto
}

export interface Manguera {
  id: string
  a: RefPuerto
  b: RefPuerto
}

export type Params = Record<string, number | string | boolean>

export interface InstanciaComponente {
  id: string
  tipo: string
  params?: Params
}

export interface Circuito {
  componentes: InstanciaComponente[]
  mangueras: Manguera[]
}

/**
 * Rol de un puerto:
 *  - 'alimentacion': entrega presión (solo fuentes / compresor+FRL)
 *  - 'escape': ventea a la atmósfera si no tiene manguera conectada
 *  - 'trabajo': puerto normal por el que circula aire
 */
export type RolPuerto = 'trabajo' | 'alimentacion' | 'escape'

export interface EspecPuerto {
  id: IdPuerto
  rol: RolPuerto
  descripcion?: string
  /** Los puertos opcionales (p. ej. pilotajes 12/14) pueden quedar sin conectar. */
  opcional?: boolean
}

/**
 * Camino interno abierto dentro de un componente en su estado actual.
 * `restriccion` va de 0 (bloqueado) a 1 (paso libre); un regulador de caudal
 * usará valores intermedios.
 */
export interface CaminoInterno {
  de: IdPuerto
  a: IdPuerto
  restriccion: number
  /**
   * Restricción en el sentido contrario (a→de). Si se omite, el camino es
   * simétrico. Un regulador unidireccional usa restriccion < 1 en el sentido
   * estrangulado y restriccionInversa = 1 en el sentido libre (antirretorno).
   */
  restriccionInversa?: number
}

/** Lo que el solver le entrega a cada componente en cada tick. */
export interface EntradasPuertos {
  /** Presión estática en cada puerto, en bar (relativa; 0 = atmósfera). */
  presion: Record<IdPuerto, number>
  /** Factor de caudal 0..1 disponible desde la fuente hasta el puerto. */
  caudalSuministro: Record<IdPuerto, number>
  /** Factor de caudal 0..1 disponible desde el puerto hasta la atmósfera. */
  caudalEscape: Record<IdPuerto, number>
}

export type EmitirEvento = (tipo: string, mensaje: string) => void

/**
 * Ventana al resto del circuito que el motor entrega a los componentes que la
 * necesitan. Hoy la usan los finales de carrera, que se accionan cuando el
 * vástago de un cilindro llega a su punto de disparo.
 */
export interface ContextoSimulacion {
  /** Posición 0..1 del vástago de un cilindro; null si ese id no es un cilindro. */
  posicionDe(idComponente: string): number | null
  /** Ids de los cilindros presentes en el circuito. */
  cilindros(): string[]
}

export interface ModeloComponente<E = unknown> {
  tipo: string
  nombre: string
  puertos: EspecPuerto[]
  estadoInicial(params: Params): E
  /** Presión que entrega un puerto de alimentación (solo fuentes). */
  presionSuministro?(estado: E, params: Params, puerto: IdPuerto): number
  /** Caminos internos abiertos según el estado actual. */
  caminos(estado: E, params: Params): CaminoInterno[]
  /**
   * Ajusta los caminos internos que dependen de la presión (válvulas lógicas,
   * pilotajes, escape rápido, finales de carrera) ANTES de integrar la física.
   * El motor lo llama en bucle hasta que nadie cambia, de modo que la lógica
   * combinacional queda resuelta dentro del mismo instante: sin este asentado,
   * una válvula «Y» daría una señal falsa de un tick al pulsar una sola entrada.
   * Devuelve true si ha cambiado de estado.
   */
  asentar?(
    estado: E,
    entradas: EntradasPuertos,
    params: Params,
    emitir: EmitirEvento,
    ctx: ContextoSimulacion,
  ): boolean
  /** Integra la física del componente un paso de tiempo. */
  actualizar?(
    estado: E,
    entradas: EntradasPuertos,
    dt: number,
    params: Params,
    emitir: EmitirEvento,
    ctx: ContextoSimulacion,
  ): void
}
