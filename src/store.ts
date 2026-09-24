/**
 * Estado global del editor de la pizarra: piezas colocadas, mangueras,
 * selección, cableado en curso y modo (editar / simular).
 */
import { create } from 'zustand'
import type { Circuito, Manguera, Params, RefPuerto } from './engine'
import { RESPUESTAS_VACIAS, type Respuestas } from './entrega'
import { autoLayout } from './layout'
import { EJEMPLOS, NOMBRES_EJEMPLO, type NumeroEjemplo } from './circuitos/ejemplos'
import { Historial } from './historial'

export interface Pieza {
  id: string
  tipo: string
  x: number
  y: number
  params: Params
}

export type Seleccion = { clase: 'pieza' | 'manguera'; id: string } | null

export type { NumeroEjemplo }

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
  /** Datos e identidad de quien entrega. */
  alumno: { nombre: string; rol: string }
  /** Título del trabajo; da nombre a los archivos que se descargan. */
  ejercicio: string
  /** Respuestas escritas a las preguntas del enunciado. */
  respuestas: Respuestas

  setAlumno(alumno: { nombre: string; rol: string }): void
  setEjercicio(ejercicio: string): void
  setRespuestas(cambio: Partial<Respuestas>): void
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
  cargarCircuito(datos: { piezas: Pieza[]; mangueras: Manguera[] }, nombre?: string): void
  /** Circuito abierto (ejemplo o archivo) y si se cambió después de abrirlo. */
  circuito: { nombre: string; ejemplo?: NumeroEjemplo; modificado: boolean } | null
  /** Sube cada vez que se abre un circuito: el lienzo se ajusta para mostrarlo entero. */
  solicitudAjuste: number
  /** Deshacer / rehacer el último cambio del circuito. */
  deshacer(): void
  rehacer(): void
  puedeDeshacer: boolean
  puedeRehacer: boolean
}

type Foto = { piezas: Pieza[]; mangueras: Manguera[] }
const historial = new Historial<Foto>()

const PREFIJOS: Record<string, string> = {
  fuente: 'F',
  manometro: 'M',
  valvula32: 'V',
  valvula42: 'V',
  valvula52: 'V',
  cilindroSimpleEfecto: 'C',
  cilindroDobleEfecto: 'C',
  actuadorGiratorio: 'C',
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

export const useStore = create<EstadoApp>((set, get) => {
  /** Guarda el circuito actual en el historial antes de cambiarlo. */
  const anotar = () => {
    const { piezas, mangueras, circuito } = get()
    historial.anotar({ piezas, mangueras })
    set({
      puedeDeshacer: historial.puedeDeshacer,
      puedeRehacer: historial.puedeRehacer,
      // Cualquier cambio marca el circuito abierto como modificado.
      circuito: circuito && !circuito.modificado ? { ...circuito, modificado: true } : circuito,
    })
  }
  return {
  piezas: [],
  puedeDeshacer: false,
  puedeRehacer: false,
  mangueras: [],
  modo: 'editar',
  aire: true,
  seleccion: null,
  origenCable: null,
  colocando: null,
  circuito: null,
  solicitudAjuste: 0,
  alumno: { nombre: '', rol: '' },
  ejercicio: '',
  respuestas: { ...RESPUESTAS_VACIAS },

  setAlumno(alumno) {
    set({ alumno })
  },

  setEjercicio(ejercicio) {
    set({ ejercicio })
  },

  setRespuestas(cambio) {
    set((s) => ({ respuestas: { ...s.respuestas, ...cambio } }))
  },

  agregarPieza(tipo, params = {}) {
    // Colocación escalonada para que las fichas nuevas no se apilen
    const n = get().piezas.length
    get().agregarPiezaEn(tipo, params, 80 + (n % 4) * 240, 60 + Math.floor(n / 4) * 160)
  },

  agregarPiezaEn(tipo, params, x, y) {
    anotar()
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
    anotar()
    set((s) => ({ piezas: s.piezas.map((p) => (p.id === id ? { ...p, x, y } : p)) }))
  },

  seleccionar(seleccion) {
    set({ seleccion })
  },

  borrarSeleccion() {
    const { seleccion } = get()
    if (!seleccion) return
    anotar()
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
    anotar()
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
    anotar()
    set((s) => ({
      piezas: s.piezas.map((p) => (p.id === id ? { ...p, params: { ...p.params, [clave]: valor } } : p)),
    }))
  },

  limpiarPizarra() {
    anotar()
    set({ piezas: [], mangueras: [], seleccion: null, origenCable: null, modo: 'editar', circuito: null })
  },

  cargarCircuito(datos, nombre) {
    // Abrir sobre una pizarra vacía (p. ej. al cargar la página) no es un paso que deshacer.
    if (get().piezas.length > 0) anotar()
    const { piezas, area } = autoLayout(datos.piezas, datos.mangueras)
    void area
    set({
      piezas: piezas.map((p) => ({ ...p, params: { ...p.params } })),
      mangueras: datos.mangueras.map((m) => ({ ...m, a: { ...m.a }, b: { ...m.b } })),
      seleccion: null,
      origenCable: null,
      modo: 'editar',
      circuito: nombre ? { nombre, modificado: false } : null,
      solicitudAjuste: get().solicitudAjuste + 1,
    })
  },

  cargarEjemplo(n) {
    if (get().piezas.length > 0) anotar()
    const ejemplo = EJEMPLOS[n]
    const { piezas } = autoLayout(ejemplo.piezas, ejemplo.mangueras)
    set({
      piezas: piezas.map((p) => ({ ...p, params: { ...p.params } })),
      mangueras: ejemplo.mangueras.map((m) => ({ ...m })),
      seleccion: null,
      origenCable: null,
      modo: 'editar',
      circuito: { nombre: NOMBRES_EJEMPLO[n], ejemplo: n, modificado: false },
      solicitudAjuste: get().solicitudAjuste + 1,
    })
  },

  deshacer() {
    const { piezas, mangueras } = get()
    const previo = historial.deshacer({ piezas, mangueras })
    if (!previo) return
    set({ ...previo, seleccion: null, origenCable: null, puedeDeshacer: historial.puedeDeshacer, puedeRehacer: historial.puedeRehacer })
  },

  rehacer() {
    const { piezas, mangueras } = get()
    const siguiente = historial.rehacer({ piezas, mangueras })
    if (!siguiente) return
    set({ ...siguiente, seleccion: null, origenCable: null, puedeDeshacer: historial.puedeDeshacer, puedeRehacer: historial.puedeRehacer })
  },
  }
})

/** Circuito para el motor a partir del estado del editor (copia profunda de params). */
export function circuitoDesdeStore(piezas: Pieza[], mangueras: Manguera[]): Circuito {
  return {
    componentes: piezas.map((p) => ({ id: p.id, tipo: p.tipo, params: { ...p.params } })),
    mangueras: mangueras.map((m) => ({ id: m.id, a: { ...m.a }, b: { ...m.b } })),
  }
}
