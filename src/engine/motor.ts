/**
 * Motor de simulación: mantiene el estado de cada componente, ejecuta el
 * solver a ~30 Hz y registra eventos legibles para el panel "¿Qué está pasando?".
 */
import { MODELOS } from './componentes'
import { claveNodo, resolver, type Solucion } from './solver'
import type { Circuito, ContextoSimulacion, EntradasPuertos, IdPuerto, Params } from './tipos'

export interface EventoSimulacion {
  t: number
  componente: string
  tipo: string
  mensaje: string
}

export const DT_POR_DEFECTO = 1 / 30

/** Tope de pasadas de asentado; evita oscilaciones infinitas entre válvulas. */
const MAX_ASENTADO = 6

export class Motor {
  readonly circuito: Circuito
  private estados = new Map<string, unknown>()
  eventos: EventoSimulacion[] = []
  advertencias: string[] = []
  ultimaSolucion: Solucion | null = null
  t = 0

  constructor(circuito: Circuito) {
    this.circuito = circuito
    for (const comp of circuito.componentes) {
      const modelo = MODELOS[comp.tipo]
      if (!modelo) throw new Error(`Tipo de componente desconocido: ${comp.tipo} (${comp.id})`)
      this.estados.set(comp.id, modelo.estadoInicial(comp.params ?? {}))
    }
  }

  /** Avanza la simulación un paso de tiempo. */
  tick(dt = DT_POR_DEFECTO): void {
    let solucion = resolver(this.circuito, this.estados)

    // Durante el asentado una válvula puede conmutar y volver atrás en la misma
    // pasada (artefacto del orden de cálculo, no algo que ocurra en el banco).
    // Guardamos los eventos aparte y luego nos quedamos sólo con los que
    // corresponden a un cambio real de estado en este instante.
    const estadoPrevio = new Map<string, string>()
    for (const comp of this.circuito.componentes) {
      if (!MODELOS[comp.tipo]?.asentar) continue
      estadoPrevio.set(comp.id, JSON.stringify(this.estados.get(comp.id)))
    }
    const eventosAsentado = new Map<string, EventoSimulacion[]>()

    // Fase 1 — asentado de la lógica: las válvulas que eligen camino según la
    // presión (lógicas, pilotadas, escape rápido) y los finales de carrera se
    // recolocan y se vuelve a resolver, hasta que nadie cambia. Así la lógica
    // combinacional queda resuelta en el mismo instante, sin señales falsas.
    for (let pasada = 0; pasada < MAX_ASENTADO; pasada++) {
      let algunCambio = false
      for (const comp of this.circuito.componentes) {
        const modelo = MODELOS[comp.tipo]
        if (!modelo?.asentar) continue
        const cambio = modelo.asentar(
          this.estados.get(comp.id),
          this.entradasDe(comp.id, modelo, solucion),
          comp.params ?? {},
          (tipo, mensaje) => {
            const lista = eventosAsentado.get(comp.id) ?? []
            lista.push({ t: this.t, componente: comp.id, tipo, mensaje: `${comp.id}: ${mensaje}` })
            eventosAsentado.set(comp.id, lista)
          },
          this.contexto,
        )
        if (cambio) algunCambio = true
      }
      if (!algunCambio) break
      solucion = resolver(this.circuito, this.estados)
    }
    this.advertencias = solucion.advertencias

    // Sólo narramos los cambios que han quedado en pie tras el asentado.
    for (const [id, lista] of eventosAsentado) {
      const cambioReal = JSON.stringify(this.estados.get(id)) !== estadoPrevio.get(id)
      if (cambioReal && lista.length > 0) this.eventos.push(lista[lista.length - 1])
    }

    // Fase 2 — física: con los caminos ya asentados, se integra el movimiento.
    for (const comp of this.circuito.componentes) {
      const modelo = MODELOS[comp.tipo]
      if (!modelo?.actualizar) continue
      modelo.actualizar(
        this.estados.get(comp.id),
        this.entradasDe(comp.id, modelo, solucion),
        dt,
        comp.params ?? {},
        (tipo, mensaje) => this.emitir(comp.id, tipo, mensaje),
        this.contexto,
      )
    }

    this.t += dt
    this.ultimaSolucion = solucion
  }

  /** Presiones y caudales que ve un componente en sus propios puertos. */
  private entradasDe(
    id: string,
    modelo: { puertos: Array<{ id: string }> },
    solucion: Solucion,
  ): EntradasPuertos {
    const entradas: EntradasPuertos = { presion: {}, caudalSuministro: {}, caudalEscape: {} }
    for (const puerto of modelo.puertos) {
      const nodo = claveNodo(id, puerto.id)
      entradas.presion[puerto.id] = solucion.presion.get(nodo) ?? 0
      entradas.caudalSuministro[puerto.id] = solucion.caudalSuministro.get(nodo) ?? 0
      entradas.caudalEscape[puerto.id] = solucion.caudalEscape.get(nodo) ?? 0
    }
    return entradas
  }

  /** Simula un intervalo de tiempo completo en pasos de `dt`. */
  simular(segundos: number, dt = DT_POR_DEFECTO): void {
    const pasos = Math.max(1, Math.round(segundos / dt))
    for (let i = 0; i < pasos; i++) this.tick(dt)
  }

  /** Acciona o suelta el mando manual de una válvula (pulsador, palanca...). */
  accionar(idComponente: string, accionada: boolean): void {
    const comp = this.circuito.componentes.find((c) => c.id === idComponente)
    if (!comp) throw new Error(`Componente inexistente: ${idComponente}`)
    const estado = this.estados.get(idComponente) as { accionada?: boolean } | undefined
    if (!estado || typeof estado.accionada !== 'boolean') {
      throw new Error(
        `${idComponente} (${MODELOS[comp.tipo]?.nombre ?? comp.tipo}) no tiene mando manual: no se puede accionar a mano`,
      )
    }
    if (estado.accionada === accionada) return
    estado.accionada = accionada
    this.emitir(
      idComponente,
      'conmutacion',
      accionada
        ? 'se acciona el pulsador y la válvula conmuta'
        : 'se suelta el pulsador y la válvula vuelve a reposo por muelle',
    )
  }

  /** Cambia un parámetro de un componente (presión de la fuente, etc.). */
  setParametro(idComponente: string, clave: string, valor: Params[string]): void {
    const comp = this.circuito.componentes.find((c) => c.id === idComponente)
    if (!comp) throw new Error(`Componente inexistente: ${idComponente}`)
    comp.params = { ...comp.params, [clave]: valor }
  }

  /**
   * Ventana al circuito para los componentes que necesitan mirar más allá de
   * sus propios puertos (finales de carrera).
   */
  private readonly contexto: ContextoSimulacion = {
    posicionDe: (id) => {
      const estado = this.estados.get(id) as { posicion?: number } | undefined
      return typeof estado?.posicion === 'number' ? estado.posicion : null
    },
    cilindros: () =>
      this.circuito.componentes.filter((c) => c.tipo.startsWith('cilindro')).map((c) => c.id),
  }

  /** Presión (bar) en un puerto según la última solución calculada. */
  presionEn(idComponente: string, puerto: IdPuerto): number {
    return this.ultimaSolucion?.presion.get(claveNodo(idComponente, puerto)) ?? 0
  }

  /** Estado interno de un componente (posición del vástago, corredera...). */
  estadoDe<T>(idComponente: string): T {
    const estado = this.estados.get(idComponente)
    if (estado === undefined) throw new Error(`Componente inexistente: ${idComponente}`)
    return estado as T
  }

  private emitir(componente: string, tipo: string, mensaje: string): void {
    this.eventos.push({ t: this.t, componente, tipo, mensaje: `${componente}: ${mensaje}` })
  }
}
