/**
 * Estado global del editor de la pizarra: piezas colocadas, mangueras,
 * selección, cableado en curso y modo (editar / simular).
 */
import { create } from 'zustand'
import type { Circuito, Manguera, Params, RefPuerto } from './engine'

export interface Pieza {
  id: string
  tipo: string
  x: number
  y: number
  params: Params
}

export type Seleccion = { clase: 'pieza' | 'manguera'; id: string } | null

export type NumeroEjemplo = 1 | 2 | 3 | 4 | 5 | 6

/** Ficha de la paleta que se está arrastrando hacia la pizarra. */
export interface Colocacion {
  tipo: string
  params: Params
  /** Posición del puntero (coordenadas de cliente) al iniciar el arrastre. */
  inicio: { x: number; y: number }
}

interface EstadoApp {
  piezas: Pieza[]
  mangueras: Manguera[]
  modo: 'editar' | 'simular'
  aire: boolean
  seleccion: Seleccion
  origenCable: RefPuerto | null
  colocando: Colocacion | null

  agregarPieza(tipo: string, params?: Params): void
  agregarPiezaEn(tipo: string, params: Params, x: number, y: number): void
  iniciarColocacion(tipo: string, params: Params, inicio: { x: number; y: number }): void
  terminarColocacion(): void
  moverPieza(id: string, x: number, y: number): void
  seleccionar(sel: Seleccion): void
  borrarSeleccion(): void
  iniciarCable(ref: RefPuerto): void
  cancelarCable(): void
  conectarCable(ref: RefPuerto): void
  setModo(modo: 'editar' | 'simular'): void
  setAire(aire: boolean): void
  setParamPieza(id: string, clave: string, valor: Params[string]): void
  limpiarPizarra(): void
  cargarEjemplo(n: NumeroEjemplo): void
  cargarCircuito(datos: { piezas: Pieza[]; mangueras: Manguera[] }): void
}

const PREFIJOS: Record<string, string> = {
  fuente: 'F',
  valvula32: 'V',
  valvula42: 'V',
  valvula52: 'V',
  cilindroSimpleEfecto: 'C',
  cilindroDobleEfecto: 'C',
  reguladorCaudal: 'R',
  finalCarrera: 'S',
  valvulaO: 'O',
  valvulaY: 'Y',
  escapeRapido: 'E',
  temporizador: 'T',
}

function siguienteId(piezas: Pieza[], tipo: string): string {
  const prefijo = PREFIJOS[tipo] ?? 'X'
  let n = 1
  while (piezas.some((p) => p.id === `${prefijo}${n}`)) n++
  return `${prefijo}${n}`
}

function siguienteIdManguera(mangueras: Manguera[]): string {
  let n = 1
  while (mangueras.some((m) => m.id === `m${n}`)) n++
  return `m${n}`
}

const mismaRef = (a: RefPuerto, b: RefPuerto) => a.componente === b.componente && a.puerto === b.puerto

export const useStore = create<EstadoApp>((set, get) => ({
  piezas: [],
  mangueras: [],
  modo: 'editar',
  aire: true,
  seleccion: null,
  origenCable: null,
  colocando: null,

  agregarPieza(tipo, params = {}) {
    // Colocación escalonada para que las fichas nuevas no se apilen
    const n = get().piezas.length
    get().agregarPiezaEn(tipo, params, 80 + (n % 4) * 240, 60 + Math.floor(n / 4) * 160)
  },

  agregarPiezaEn(tipo, params, x, y) {
    set((s) => {
      const id = siguienteId(s.piezas, tipo)
      return { piezas: [...s.piezas, { id, tipo, x, y, params }], seleccion: { clase: 'pieza', id } }
    })
  },

  iniciarColocacion(tipo, params, inicio) {
    set({ colocando: { tipo, params, inicio }, seleccion: null, origenCable: null })
  },

  terminarColocacion() {
    set({ colocando: null })
  },

  moverPieza(id, x, y) {
    set((s) => ({ piezas: s.piezas.map((p) => (p.id === id ? { ...p, x, y } : p)) }))
  },

  seleccionar(seleccion) {
    set({ seleccion })
  },

  borrarSeleccion() {
    const { seleccion } = get()
    if (!seleccion) return
    set((s) => {
      if (seleccion.clase === 'manguera') {
        return { mangueras: s.mangueras.filter((m) => m.id !== seleccion.id), seleccion: null }
      }
      return {
        piezas: s.piezas.filter((p) => p.id !== seleccion.id),
        mangueras: s.mangueras.filter(
          (m) => m.a.componente !== seleccion.id && m.b.componente !== seleccion.id,
        ),
        seleccion: null,
      }
    })
  },

  iniciarCable(ref) {
    set({ origenCable: ref, seleccion: null })
  },

  cancelarCable() {
    set({ origenCable: null })
  },

  conectarCable(ref) {
    const { origenCable, mangueras } = get()
    if (!origenCable) return
    if (mismaRef(origenCable, ref)) {
      set({ origenCable: null })
      return
    }
    const duplicada = mangueras.some(
      (m) =>
        (mismaRef(m.a, origenCable) && mismaRef(m.b, ref)) ||
        (mismaRef(m.b, origenCable) && mismaRef(m.a, ref)),
    )
    if (duplicada) {
      set({ origenCable: null })
      return
    }
    set((s) => ({
      mangueras: [...s.mangueras, { id: siguienteIdManguera(s.mangueras), a: origenCable, b: ref }],
      origenCable: null,
    }))
  },

  setModo(modo) {
    set({ modo, origenCable: null, seleccion: null })
  },

  setAire(aire) {
    set({ aire })
  },

  setParamPieza(id, clave, valor) {
    set((s) => ({
      piezas: s.piezas.map((p) => (p.id === id ? { ...p, params: { ...p.params, [clave]: valor } } : p)),
    }))
  },

  limpiarPizarra() {
    set({ piezas: [], mangueras: [], seleccion: null, origenCable: null, modo: 'editar' })
  },

  cargarCircuito(datos) {
    set({
      piezas: datos.piezas.map((p) => ({ ...p, params: { ...p.params } })),
      mangueras: datos.mangueras.map((m) => ({ ...m, a: { ...m.a }, b: { ...m.b } })),
      seleccion: null,
      origenCable: null,
      modo: 'editar',
    })
  },

  cargarEjemplo(n) {
    const ejemplos: Record<NumeroEjemplo, { piezas: Pieza[]; mangueras: Manguera[] }> = {
      // Cilindro de simple efecto con 3/2 de pulsador
      1: {
        piezas: [
          { id: 'F1', tipo: 'fuente', x: 60, y: 330, params: { presion: 6, encendida: true } },
          { id: 'V1', tipo: 'valvula32', x: 300, y: 280, params: { reposo: 'NC', accionamiento: 'pulsador' } },
          { id: 'C1', tipo: 'cilindroSimpleEfecto', x: 330, y: 90, params: {} },
        ],
        mangueras: [
          { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
          { id: 'm2', a: { componente: 'V1', puerto: '2' }, b: { componente: 'C1', puerto: '1' } },
        ],
      },
      // Doble efecto con 5/2 monoestable y regulador de caudal en el escape de B
      2: {
        piezas: [
          { id: 'F1', tipo: 'fuente', x: 50, y: 350, params: { presion: 6, encendida: true } },
          { id: 'V1', tipo: 'valvula52', x: 290, y: 320, params: { modo: 'monoestable', accionamiento: 'pulsador' } },
          { id: 'C1', tipo: 'cilindroDobleEfecto', x: 300, y: 90, params: {} },
          { id: 'R1', tipo: 'reguladorCaudal', x: 620, y: 200, params: { apertura: 0.3 } },
        ],
        mangueras: [
          { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
          { id: 'm2', a: { componente: 'V1', puerto: '4' }, b: { componente: 'C1', puerto: 'A' } },
          { id: 'm3', a: { componente: 'C1', puerto: 'B' }, b: { componente: 'R1', puerto: '1' } },
          { id: 'm4', a: { componente: 'R1', puerto: '2' }, b: { componente: 'V1', puerto: '2' } },
        ],
      },
      // Biestable pilotada por dos 3/2 de pulsador (marcha / retorno)
      3: {
        piezas: [
          { id: 'F1', tipo: 'fuente', x: 40, y: 350, params: { presion: 6, encendida: true } },
          { id: 'V2', tipo: 'valvula32', x: 220, y: 400, params: { reposo: 'NC' } },
          { id: 'V3', tipo: 'valvula32', x: 640, y: 400, params: { reposo: 'NC' } },
          { id: 'V1', tipo: 'valvula52', x: 380, y: 230, params: { modo: 'biestable' } },
          { id: 'C1', tipo: 'cilindroDobleEfecto', x: 380, y: 60, params: {} },
        ],
        mangueras: [
          { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
          { id: 'm2', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V2', puerto: '1' } },
          { id: 'm3', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V3', puerto: '1' } },
          { id: 'm4', a: { componente: 'V2', puerto: '2' }, b: { componente: 'V1', puerto: '14' } },
          { id: 'm5', a: { componente: 'V3', puerto: '2' }, b: { componente: 'V1', puerto: '12' } },
          { id: 'm6', a: { componente: 'V1', puerto: '4' }, b: { componente: 'C1', puerto: 'A' } },
          { id: 'm7', a: { componente: 'V1', puerto: '2' }, b: { componente: 'C1', puerto: 'B' } },
        ],
      },
      // Ciclo automático ida-vuelta con dos finales de carrera y 5/2 biestable
      4: {
        piezas: [
          { id: 'F1', tipo: 'fuente', x: 40, y: 350, params: { presion: 6, encendida: true } },
          { id: 'S1', tipo: 'finalCarrera', x: 200, y: 400, params: { reposo: 'NC', cilindro: 'C1', puntoDisparo: 0 } },
          { id: 'S2', tipo: 'finalCarrera', x: 660, y: 400, params: { reposo: 'NC', cilindro: 'C1', puntoDisparo: 1 } },
          { id: 'V1', tipo: 'valvula52', x: 390, y: 230, params: { modo: 'biestable' } },
          { id: 'C1', tipo: 'cilindroDobleEfecto', x: 380, y: 60, params: {} },
        ],
        mangueras: [
          { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
          { id: 'm2', a: { componente: 'F1', puerto: '1' }, b: { componente: 'S1', puerto: '1' } },
          { id: 'm3', a: { componente: 'F1', puerto: '1' }, b: { componente: 'S2', puerto: '1' } },
          { id: 'm4', a: { componente: 'S1', puerto: '2' }, b: { componente: 'V1', puerto: '14' } },
          { id: 'm5', a: { componente: 'S2', puerto: '2' }, b: { componente: 'V1', puerto: '12' } },
          { id: 'm6', a: { componente: 'V1', puerto: '4' }, b: { componente: 'C1', puerto: 'A' } },
          { id: 'm7', a: { componente: 'V1', puerto: '2' }, b: { componente: 'C1', puerto: 'B' } },
        ],
      },
      // Mando bimanual: dos pulsadores + válvula de simultaneidad «Y»
      5: {
        piezas: [
          { id: 'F1', tipo: 'fuente', x: 40, y: 400, params: { presion: 6, encendida: true } },
          { id: 'V2', tipo: 'valvula32', x: 200, y: 430, params: { reposo: 'NC' } },
          { id: 'V3', tipo: 'valvula32', x: 420, y: 430, params: { reposo: 'NC' } },
          { id: 'Y1', tipo: 'valvulaY', x: 290, y: 320, params: {} },
          { id: 'V1', tipo: 'valvula52', x: 250, y: 180, params: { modo: 'monoestable', accionamiento: 'pilotaje' } },
          { id: 'C1', tipo: 'cilindroDobleEfecto', x: 620, y: 60, params: {} },
        ],
        mangueras: [
          { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
          { id: 'm2', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V2', puerto: '1' } },
          { id: 'm3', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V3', puerto: '1' } },
          { id: 'm4', a: { componente: 'V2', puerto: '2' }, b: { componente: 'Y1', puerto: 'X' } },
          { id: 'm5', a: { componente: 'V3', puerto: '2' }, b: { componente: 'Y1', puerto: 'Y' } },
          { id: 'm6', a: { componente: 'Y1', puerto: 'A' }, b: { componente: 'V1', puerto: '14' } },
          { id: 'm7', a: { componente: 'V1', puerto: '4' }, b: { componente: 'C1', puerto: 'A' } },
          { id: 'm8', a: { componente: 'V1', puerto: '2' }, b: { componente: 'C1', puerto: 'B' } },
        ],
      },
      // Encadenar dos cilindros: al llegar C1 al final de carrera, su rodillo
      // pilota la válvula que mueve C2.
      6: {
        piezas: [
          { id: 'F1', tipo: 'fuente', x: 40, y: 460, params: { presion: 6, encendida: true } },
          { id: 'V1', tipo: 'valvula32', x: 150, y: 250, params: { reposo: 'NC', accionamiento: 'pulsador' } },
          { id: 'C1', tipo: 'cilindroSimpleEfecto', x: 150, y: 70, params: {} },
          { id: 'S1', tipo: 'finalCarrera', x: 380, y: 375, params: { reposo: 'NC', cilindro: 'C1', puntoDisparo: 1 } },
          { id: 'V2', tipo: 'valvula52', x: 620, y: 230, params: { modo: 'monoestable', accionamiento: 'pilotaje' } },
          { id: 'C2', tipo: 'cilindroDobleEfecto', x: 620, y: 70, params: {} },
        ],
        mangueras: [
          { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
          { id: 'm2', a: { componente: 'V1', puerto: '2' }, b: { componente: 'C1', puerto: '1' } },
          // El rodillo es una válvula más: necesita su propia alimentación
          { id: 'm3', a: { componente: 'F1', puerto: '1' }, b: { componente: 'S1', puerto: '1' } },
          // …y su salida es la señal que pilota la segunda válvula
          { id: 'm4', a: { componente: 'S1', puerto: '2' }, b: { componente: 'V2', puerto: '14' } },
          { id: 'm5', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V2', puerto: '1' } },
          { id: 'm6', a: { componente: 'V2', puerto: '4' }, b: { componente: 'C2', puerto: 'A' } },
          { id: 'm7', a: { componente: 'V2', puerto: '2' }, b: { componente: 'C2', puerto: 'B' } },
        ],
      },
    }
    const ejemplo = ejemplos[n]
    set({
      piezas: ejemplo.piezas.map((p) => ({ ...p, params: { ...p.params } })),
      mangueras: ejemplo.mangueras.map((m) => ({ ...m })),
      seleccion: null,
      origenCable: null,
      modo: 'editar',
    })
  },
}))

/** Circuito para el motor a partir del estado del editor (copia profunda de params). */
export function circuitoDesdeStore(piezas: Pieza[], mangueras: Manguera[]): Circuito {
  return {
    componentes: piezas.map((p) => ({ id: p.id, tipo: p.tipo, params: { ...p.params } })),
    mangueras: mangueras.map((m) => ({ id: m.id, a: { ...m.a }, b: { ...m.b } })),
  }
}
