/**
 * Máquinas, herramientas y materiales de la unidad de CNC.
 *
 * Hay dos máquinas, las mismas que se usan en CNC Simulator Pro:
 *  - Centro de torneado (torno): ejes X (diámetro) y Z. El cero pieza está en
 *    el eje de giro, en la cara frontal del material; el plato queda hacia Z−.
 *  - Fresadora de 3 ejes: X a la derecha, Y hacia el fondo, Z hacia arriba. El
 *    cero pieza está en la esquina delantera izquierda de la cara superior.
 *
 * Las herramientas del torno se describen por su «envolvente»: para cada
 * distancia dz (en Z) a la punta, hasta qué radio baja el filo. Con eso se
 * calcula qué material arranca la herramienta y también si una herramienta
 * mal elegida se come un resalte (como pasa en la máquina real).
 */

export type TipoMaquina = 'torno' | 'fresadora'

export interface Material {
  id: string
  nombre: string
  color: number
  /** Brillo metálico para la vista 3D (0 = mate, 1 = metal pulido). */
  metal: number
  /** Velocidad de corte orientativa (m/min) y avance orientativo (mm/min). */
  vc: [number, number]
  avance: [number, number]
}

export const MATERIALES: Material[] = [
  { id: 'laton', nombre: 'Latón', color: 0xd4ac4f, metal: 0.85, vc: [150, 300], avance: [75, 350] },
  { id: 'aluminio', nombre: 'Aluminio', color: 0xc9ced4, metal: 0.8, vc: [200, 500], avance: [100, 800] },
  { id: 'acero', nombre: 'Acero SAE 1020', color: 0x8f969e, metal: 0.9, vc: [80, 180], avance: [50, 250] },
  { id: 'acrilico', nombre: 'Acrílico', color: 0x9fd3e6, metal: 0.05, vc: [100, 300], avance: [200, 1000] },
  { id: 'madera', nombre: 'Madera (MDF)', color: 0xb58a5a, metal: 0, vc: [150, 600], avance: [300, 2000] },
]

export function material(id: string): Material {
  return MATERIALES.find((m) => m.id === id) ?? MATERIALES[0]
}

// ---------------------------------------------------------------------------
// Herramientas del torno
// ---------------------------------------------------------------------------
export type FormaTorno = 'izquierda' | 'derecha' | 'ranurado' | 'roscado' | 'broca'

export interface HerramientaTorno {
  t: number
  nombre: string
  forma: FormaTorno
  /** Para qué etapa sirve, en una frase para el alumno. */
  uso: string
  /** Ancho (ranurado) o diámetro (broca), en mm. */
  medida?: number
  /** Ángulo del filo secundario respecto del eje Z (grados). */
  angulo?: number
  color: number
}

export const HERRAMIENTAS_TORNO: HerramientaTorno[] = [
  { t: 1, nombre: 'Desbaste izquierda', forma: 'izquierda', angulo: 5, uso: 'Desbaste grueso avanzando hacia el plato (Z−). Inserto rómbico de 80°.', color: 0xd9a400 },
  { t: 2, nombre: 'Afinado izquierda', forma: 'izquierda', angulo: 32, uso: 'Afinado avanzando hacia el plato. Inserto de 55°: deja subir y bajar rampas suaves.', color: 0x2f8fdd },
  { t: 3, nombre: 'Ranurado 2 mm', forma: 'ranurado', medida: 2, uso: 'Ranuras angostas. El punto programado es la esquina derecha de la hoja (hacia la cara): corta desde Z hacia el plato.', color: 0x8e5bd6 },
  { t: 4, nombre: 'Desbaste derecha', forma: 'derecha', angulo: 5, uso: 'Desbaste avanzando hacia la cara (Z+). Inserto rómbico de 80°.', color: 0xe07b39 },
  { t: 5, nombre: 'Afinado derecha', forma: 'derecha', angulo: 32, uso: 'Afinado avanzando hacia la cara (Z+). Inserto de 55°.', color: 0x2aa876 },
  { t: 6, nombre: 'Roscado exterior 60°', forma: 'roscado', angulo: 60, uso: 'Roscas métricas exteriores (G33).', color: 0x607d8b },
  { t: 7, nombre: 'Perfilado 35°', forma: 'izquierda', angulo: 52, uso: 'Acabado de contornos con rampas, radios y gargantas, avanzando hacia el plato. Inserto de 35°.', color: 0xd64550 },
  { t: 8, nombre: 'Broca Ø10', forma: 'broca', medida: 10, uso: 'Taladrado centrado: se trabaja en X0 avanzando en Z−.', color: 0x4a5560 },
  { t: 9, nombre: 'Tronzado 4 mm', forma: 'ranurado', medida: 4, uso: 'Ranuras y corte final (tronzado). El punto programado es la esquina derecha de la hoja: con Z−40 la pieza queda de 40 mm.', color: 0x1f6fb2 },
  { t: 10, nombre: 'Broca de centro Ø4', forma: 'broca', medida: 4, uso: 'Punto de centro antes de taladrar.', color: 0x6b4a8a },
  { t: 17, nombre: 'Broca Ø10 (la del tutorial de CNC Simulator Pro)', forma: 'broca', medida: 10, uso: 'Taladrado en el eje, también con el ciclo G81 (por ejemplo G81 Z60 R78).', color: 0x3d4650 },
]

/** Largo del filo que se considera en la envolvente, en mm. */
const LARGO_FILO = 12

/**
 * Envolvente de la herramienta: para un desplazamiento dz desde la punta,
 * cuánto sube el filo en radio (mm). Devuelve null si a esa distancia no hay
 * herramienta. La herramienta se prolonga hacia arriba (el portaherramienta),
 * así que todo lo que quede sobre el filo se arranca.
 */
export function envolventeTorno(h: HerramientaTorno, dz: number): number | null {
  const tan = (g: number) => Math.tan((g * Math.PI) / 180)
  switch (h.forma) {
    case 'izquierda':
      // El filo principal mira al plato (Z−) y es casi vertical; el
      // secundario queda detrás, subiendo con el ángulo del inserto.
      if (dz < 0 || dz > LARGO_FILO) return null
      return dz * tan(h.angulo ?? 5)
    case 'derecha':
      if (dz > 0 || dz < -LARGO_FILO) return null
      return -dz * tan(h.angulo ?? 5)
    case 'roscado':
      if (Math.abs(dz) > 3) return null
      return Math.abs(dz) / tan((h.angulo ?? 60) / 2)
    case 'ranurado': {
      // El punto programado es la esquina derecha (hacia la cara): la hoja
      // ocupa desde Z−ancho hasta Z.
      const w = h.medida ?? 4
      if (dz > 0 || dz < -w) return null
      return 0
    }
    case 'broca':
      return null
  }
}

/** Rango de dz que ocupa la herramienta (para recorrerla). */
export function rangoTorno(h: HerramientaTorno): [number, number] {
  switch (h.forma) {
    case 'izquierda':
      return [0, LARGO_FILO]
    case 'derecha':
      return [-LARGO_FILO, 0]
    case 'roscado':
      return [-3, 3]
    case 'ranurado':
      return [-(h.medida ?? 4), 0]
    case 'broca':
      return [0, 0]
  }
}

// ---------------------------------------------------------------------------
// Herramientas de la fresadora
// ---------------------------------------------------------------------------
export type FormaFresa = 'plana' | 'bola' | 'broca' | 'grabado'

export interface HerramientaFresa {
  t: number
  nombre: string
  forma: FormaFresa
  diametro: number
  uso: string
  color: number
}

export const HERRAMIENTAS_FRESA: HerramientaFresa[] = [
  { t: 1, nombre: 'Fresa plana Ø10', forma: 'plana', diametro: 10, uso: 'Contornos y cajeras.', color: 0xd9a400 },
  { t: 2, nombre: 'Fresa plana Ø6', forma: 'plana', diametro: 6, uso: 'Contornos y cajeras pequeñas.', color: 0x2f8fdd },
  { t: 3, nombre: 'Fresa plana Ø3', forma: 'plana', diametro: 3, uso: 'Detalles y ranuras finas.', color: 0x2aa876 },
  { t: 4, nombre: 'Fresa bola Ø6', forma: 'bola', diametro: 6, uso: 'Superficies curvas y canales redondeados.', color: 0xe07b39 },
  { t: 5, nombre: 'Broca Ø8', forma: 'broca', diametro: 8, uso: 'Agujeros: se baja en Z sin moverse en X/Y.', color: 0x4a5560 },
  { t: 6, nombre: 'Broca Ø5', forma: 'broca', diametro: 5, uso: 'Agujeros pequeños.', color: 0x6b4a8a },
  { t: 7, nombre: 'Grabado en V 90°', forma: 'grabado', diametro: 6, uso: 'Grabar letras y líneas: más ancho cuanto más profundo.', color: 0xd64550 },
  { t: 8, nombre: 'Planeadora Ø40', forma: 'plana', diametro: 40, uso: 'Planear (emparejar) la cara superior.', color: 0x1f6fb2 },
]

/**
 * Profundidad extra del filo a una distancia d del eje (mm): la fresa plana
 * corta parejo; la de bola y la broca dejan fondo curvo o en punta.
 */
export function perfilFresa(h: HerramientaFresa, d: number): number | null {
  const r = h.diametro / 2
  if (d > r) return null
  switch (h.forma) {
    case 'plana':
      return 0
    case 'bola':
      return r - Math.sqrt(Math.max(0, r * r - d * d))
    case 'broca':
      return d * Math.tan((31 * Math.PI) / 180) // punta de 118°
    case 'grabado':
      return d // 90°: sube lo mismo que se aleja del eje
  }
}

// ---------------------------------------------------------------------------
// Preparación (el «setup» del simulador)
// ---------------------------------------------------------------------------
/**
 * Dónde está el cero del programa en el torno:
 *  - 'cara': en la cara frontal de la pieza, sobre el eje (como en los planos).
 *  - 'garras': en la cara de las garras, como CNC Simulator Pro; la cara del
 *    bruto queda en Z = largo − agarre (con 100 mm y 23 mm de agarre, Z77).
 *  - 'auto': 'garras' si el programa usa $AddRegPart; si no, 'cara'.
 */
export type OrigenTorno = 'auto' | 'cara' | 'garras'

export interface BrutoTorno {
  diametro: number
  largo: number
  origen?: OrigenTorno
  /** Largo que toman las garras del plato. */
  agarre: number
  /** Material que sobresale delante del cero pieza (para refrentar). */
  sobremetal: number
}

export interface BrutoFresa {
  largo: number // X
  ancho: number // Y
  alto: number // Z
}

export interface ConfigCNC {
  maquina: TipoMaquina
  material: string
  torno: BrutoTorno
  fresa: BrutoFresa
}

export const CONFIG_INICIAL: ConfigCNC = {
  maquina: 'torno',
  material: 'laton',
  torno: { diametro: 40, largo: 90, agarre: 25, sobremetal: 1 },
  fresa: { largo: 100, ancho: 80, alto: 20 },
}

/** Cero del programa que corresponde a la preparación y al programa. */
export function origenPrograma(c: ConfigCNC, codigo: string): { origen: { x: number; y: number; z: number }; modo: 'cara' | 'garras' } {
  if (c.maquina !== 'torno') return { origen: { x: 0, y: 0, z: 0 }, modo: 'cara' }
  const pedido = c.torno.origen ?? 'auto'
  const modo = pedido === 'auto' ? (/\$\s*AddRegPart/i.test(codigo) ? 'garras' : 'cara') : pedido
  if (modo === 'cara') return { origen: { x: 0, y: 0, z: 0 }, modo }
  return { origen: { x: 0, y: 0, z: c.torno.sobremetal - c.torno.largo + c.torno.agarre }, modo }
}

/** Posición de referencia (G28 / cambio de herramienta), en coordenadas pieza. */
export function posicionCasa(c: ConfigCNC): { x: number; y: number; z: number } {
  if (c.maquina === 'torno') return { x: Math.round(c.torno.diametro + 60), y: 0, z: Math.round(c.torno.sobremetal + 60) }
  return { x: 0, y: 0, z: 50 }
}

export function herramientaTorno(t: number): HerramientaTorno | undefined {
  return HERRAMIENTAS_TORNO.find((h) => h.t === t)
}

export function herramientaFresa(t: number): HerramientaFresa | undefined {
  return HERRAMIENTAS_FRESA.find((h) => h.t === t)
}

export function nombreHerramienta(maquina: TipoMaquina, t: number): string {
  const h = maquina === 'torno' ? herramientaTorno(t) : herramientaFresa(t)
  return h ? `T${t} · ${h.nombre}` : `T${t} (no está en la torreta)`
}
