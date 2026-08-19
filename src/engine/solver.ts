/**
 * Solver de presión: en cada tick construye el grafo de nodos (puertos) y
 * aristas dirigidas (mangueras + caminos internos abiertos) y propaga:
 *  - presión desde las fuentes,
 *  - factor de caudal fuente→nodo (camino más ancho: máximo cuello de botella),
 *  - factor de caudal nodo→atmósfera (para saber si el aire puede escapar).
 *
 * Las aristas son dirigidas para poder modelar el regulador unidireccional:
 * estrangulado en un sentido, paso libre por el antirretorno en el otro.
 */
import { MODELOS } from './componentes'
import type { Circuito, ModeloComponente, Params } from './tipos'

export interface Solucion {
  /** Presión en bar por nodo (clave "componente:puerto"). */
  presion: Map<string, number>
  /** Factor de caudal 0..1 desde la fuente hasta cada nodo. */
  caudalSuministro: Map<string, number>
  /** Factor de caudal 0..1 desde cada nodo hasta la atmósfera. */
  caudalEscape: Map<string, number>
  advertencias: string[]
}

export const claveNodo = (componente: string, puerto: string) => `${componente}:${puerto}`

interface Arista {
  a: string
  restriccion: number
}

/**
 * Camino más ancho multi-fuente sobre un grafo dirigido: para cada nodo
 * alcanzable devuelve el mejor "cuello de botella" (mínima restricción a lo
 * largo del camino, maximizada entre caminos). Los grafos son pequeños, así
 * que basta un Dijkstra simple.
 */
function anchoMaximo(inicios: string[], adyacencia: Map<string, Arista[]>): Map<string, number> {
  const mejor = new Map<string, number>()
  const cola: Array<[string, number]> = []
  for (const n of inicios) {
    mejor.set(n, 1)
    cola.push([n, 1])
  }
  while (cola.length > 0) {
    cola.sort((x, y) => x[1] - y[1])
    const [nodo, factor] = cola.pop()!
    if (factor < (mejor.get(nodo) ?? 0)) continue
    for (const arista of adyacencia.get(nodo) ?? []) {
      const nuevo = Math.min(factor, arista.restriccion)
      if (nuevo > (mejor.get(arista.a) ?? 0)) {
        mejor.set(arista.a, nuevo)
        cola.push([arista.a, nuevo])
      }
    }
  }
  return mejor
}

export function resolver(circuito: Circuito, estados: Map<string, unknown>): Solucion {
  const advertencias: string[] = []
  const nodos = new Set<string>()
  // Grafo directo (sentido del flujo) y reverso (para propagar el escape:
  // "¿desde este nodo se puede llegar a la atmósfera siguiendo el flujo?").
  const directo = new Map<string, Arista[]>()
  const reverso = new Map<string, Arista[]>()
  const conManguera = new Set<string>()

  const agregarDirigida = (de: string, a: string, restriccion: number) => {
    nodos.add(de)
    nodos.add(a)
    if (!directo.has(de)) directo.set(de, [])
    if (!reverso.has(a)) reverso.set(a, [])
    directo.get(de)!.push({ a, restriccion })
    reverso.get(a)!.push({ a: de, restriccion })
  }

  const porId = new Map(circuito.componentes.map((c) => [c.id, c]))
  const modeloDe = (tipo: string): ModeloComponente<any> | undefined => MODELOS[tipo]

  // Mangueras: paso libre en ambos sentidos
  for (const m of circuito.mangueras) {
    let valida = true
    for (const extremo of [m.a, m.b]) {
      const comp = porId.get(extremo.componente)
      const modelo = comp ? modeloDe(comp.tipo) : undefined
      if (!modelo || !modelo.puertos.some((p) => p.id === extremo.puerto)) {
        advertencias.push(
          `La manguera ${m.id} apunta a un puerto inexistente: ${extremo.componente}:${extremo.puerto}.`,
        )
        valida = false
      }
    }
    if (!valida) continue
    const nodoA = claveNodo(m.a.componente, m.a.puerto)
    const nodoB = claveNodo(m.b.componente, m.b.puerto)
    agregarDirigida(nodoA, nodoB, 1)
    agregarDirigida(nodoB, nodoA, 1)
    conManguera.add(nodoA)
    conManguera.add(nodoB)
  }

  // Caminos internos, fuentes y escapes
  const fuentes: Array<{ nodo: string; presion: number }> = []
  const atmosfera: string[] = []

  for (const comp of circuito.componentes) {
    const modelo = modeloDe(comp.tipo)
    if (!modelo) {
      advertencias.push(`Tipo de componente desconocido: ${comp.tipo} (${comp.id}).`)
      continue
    }
    const params: Params = comp.params ?? {}
    const estado = estados.get(comp.id)

    for (const camino of modelo.caminos(estado, params)) {
      const ida = Math.min(1, camino.restriccion)
      const vuelta = Math.min(1, camino.restriccionInversa ?? camino.restriccion)
      const de = claveNodo(comp.id, camino.de)
      const a = claveNodo(comp.id, camino.a)
      if (ida > 0) agregarDirigida(de, a, ida)
      if (vuelta > 0) agregarDirigida(a, de, vuelta)
    }

    for (const puerto of modelo.puertos) {
      const nodo = claveNodo(comp.id, puerto.id)
      nodos.add(nodo)
      if (puerto.rol === 'alimentacion' && modelo.presionSuministro) {
        const p = modelo.presionSuministro(estado, params, puerto.id)
        // Con la fuente apagada, el regulador FRL ventea aguas abajo.
        if (p > 0) fuentes.push({ nodo, presion: p })
        else atmosfera.push(nodo)
      }
      // Un puerto de escape sin manguera ventea directo a la atmósfera;
      // con manguera, el aire sigue por lo que esté conectado (p. ej. un silenciador).
      if (puerto.rol === 'escape' && !conManguera.has(nodo)) {
        atmosfera.push(nodo)
      }
    }
  }

  // Propagación fuente→nodo (grafo directo)
  const caudalSuministro = new Map<string, number>()
  const presionNominal = new Map<string, number>()
  for (const fuente of fuentes) {
    const alcance = anchoMaximo([fuente.nodo], directo)
    for (const [nodo, factor] of alcance) {
      if (factor > (caudalSuministro.get(nodo) ?? 0)) caudalSuministro.set(nodo, factor)
      presionNominal.set(nodo, Math.max(presionNominal.get(nodo) ?? 0, fuente.presion))
    }
  }
  // Propagación nodo→atmósfera (grafo reverso: llegar a la atmósfera siguiendo el flujo)
  const caudalEscape = anchoMaximo(atmosfera, reverso)

  // Presión final por nodo. Si un nodo está a la vez conectado a la fuente y a
  // la atmósfera, hay un cortocircuito presión→escape: el aire se fuga y no se
  // acumula presión.
  const presion = new Map<string, number>()
  let hayCortocircuito = false
  for (const nodo of nodos) {
    const qIn = caudalSuministro.get(nodo) ?? 0
    const qOut = caudalEscape.get(nodo) ?? 0
    if (qIn > 0 && qOut > 0) {
      hayCortocircuito = true
      presion.set(nodo, 0)
    } else if (qIn > 0) {
      presion.set(nodo, presionNominal.get(nodo) ?? 0)
    } else {
      presion.set(nodo, 0)
    }
  }
  if (hayCortocircuito) {
    advertencias.push(
      'Cortocircuito: la presión está conectada directamente al escape. El aire se fuga sin hacer trabajo; revisa el cableado.',
    )
  }

  return { presion, caudalSuministro, caudalEscape, advertencias }
}
