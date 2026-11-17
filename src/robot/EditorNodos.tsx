/**
 * Lienzo de programación visual al estilo Grasshopper: componentes con sus
 * entradas (a la izquierda) y salidas (a la derecha) unidos por cables.
 *
 *  - Arrastra un componente para moverlo; arrastra el fondo para desplazar
 *    el lienzo y usa la rueda para acercar o alejar.
 *  - Arrastra desde una salida hasta una entrada para conectar (con Mayús se
 *    agrega un cable más a esa entrada; sin Mayús, lo reemplaza). Clic
 *    derecho sobre una entrada la desconecta.
 *  - Doble clic en el fondo abre el buscador de componentes, como en
 *    Grasshopper.
 *  - Colores como en Grasshopper: gris = bien, naranjo = faltan datos o hay
 *    un aviso, rojo = error, verde = seleccionado.
 */
import { usePersistente, useTactil } from '../components/ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  COMPONENTES,
  componente,
  describirDato,
  paramsIniciales,
  type Cable,
  type Componente,
  type Definicion,
  type Evaluacion,
  type NodoDef,
  type Pestana,
} from './nodos'
import { CLAVES } from '../persistencia'

const ANCHO = 172
const FILA = 22
const CABEZA = 26

function colorCabeza(pestana: string | undefined): string {
  if (pestana === 'Movimientos') return '#e85d04'
  if (pestana === 'Robot') return '#1668c7'
  if (pestana === 'Herramientas') return '#0e7a43'
  if (pestana === 'Trayectoria') return '#5c4d91'
  return '#4e5964'
}

export function medidas(_nodo: NodoDef, comp: Componente | undefined): { w: number; h: number } {
  if (!comp) return { w: ANCHO, h: 44 }
  if (comp.tipo === 'slider') return { w: 230, h: 46 }
  if (comp.tipo === 'panel') return { w: 210, h: 120 }
  const filas = Math.max(comp.entradas.length, comp.salidas.length, 1)
  return { w: ANCHO, h: CABEZA + filas * FILA + 8 }
}

function puertoEntrada(nodo: NodoDef, comp: Componente | undefined, i: number) {
  if (comp?.tipo === 'panel') return { x: nodo.x, y: nodo.y + 30 }
  return { x: nodo.x, y: nodo.y + CABEZA + 4 + i * FILA + FILA / 2 }
}
function puertoSalida(nodo: NodoDef, comp: Componente | undefined, j: number) {
  const { w, h } = medidas(nodo, comp)
  if (comp?.tipo === 'slider') return { x: nodo.x + w, y: nodo.y + h / 2 }
  return { x: nodo.x + w, y: nodo.y + CABEZA + 4 + j * FILA + FILA / 2 }
}

const curvaCable = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = Math.max(40, Math.abs(b.x - a.x) / 2)
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`
}

let contador = 0
export function nuevoId(def: Definicion, tipo: string): string {
  let id: string
  do {
    contador++
    id = `${tipo}${contador}`
  } while (def.nodos.some((n) => n.id === id))
  return id
}

export const PESTANAS: Pestana[] = ['Movimientos', 'Robot', 'Herramientas', 'Trayectoria', 'Utilidades']

/** Una línea bajo el nombre del bloque, para quien no conoce la sigla. */
const GLOSA: Record<string, string> = {
  lin: 'Al cortar, en recta',
  ptp: 'Acercarse o alejarse',
  cir: 'Al cortar, en curva',
  axis: 'Por ángulos',
  salida: 'Prender o apagar',
  esperar: 'Pausa',
  core: 'Arma el programa',
  robot: 'El brazo',
  herramienta: 'Fresa, ventosa…',
  curvaDXF: 'Curvas del plano',
  punto: 'Un punto',
  rectangulo: 'Rectángulo',
  circulo: 'Círculo',
  poligono: 'Polígono',
  dividirLargo: 'Puntos cada X mm',
  dividirCurva: 'Puntos parejos',
  discontinuidad: 'Las esquinas',
  kukaDividir: 'Planos sobre la curva',
  desfase: 'Curva paralela',
  area: 'Área y centro',
  mover: 'Desplazar',
  planoXY: 'Hacia dónde apunta',
  girarPlano: 'Girar el plano',
  slider: 'Un número',
  panel: 'Ver los datos',
  unir: 'Juntar listas',
  item: 'Un elemento',
  invertir: 'Dar vuelta la lista',
  krl: 'Una línea de código',
  tejer: 'Combinar comandos',
}

const CUANDO: Record<string, string> = {
  lin: 'Movimiento en línea recta. Úsalo cuando la herramienta está cortando.',
  cir: 'Movimiento en arco. Úsalo en curvas del contorno.',
  ptp: 'Movimiento rápido punto a punto. Úsalo para acercarse o alejarse.',
}

function pista(c: Componente): string {
  if (CUANDO[c.tipo]) return `${c.corto}. ${CUANDO[c.tipo]}`
  const frase = c.descripcion.split(/(?<=\.)\s/)[0]
  return `${c.nombre}. ${frase}`
}

interface Props {
  def: Definicion
  evaluacion: Evaluacion
  onCambiar: (d: Definicion) => void
  seleccion: string | null
  onSeleccionar: (id: string | null) => void
  /** En píxeles, o '100%' para llenar el área. */
  alto?: number | string
  /** En la tarea: el siguiente paso, y el bloque que conviene arrastrar. */
  /** Sin paleta ni tarjeta del paso: sólo el lienzo. */
  soloLienzo?: boolean
  guia?: { id: string; numero: number; total: number; titulo: string; accion: string; listo?: string; por?: string; pasos?: string[]; pista?: string; pestana?: Pestana; destacar?: string }
  /** El ejemplo está abierto: no invita a seguir armando sobre ese lienzo. */
  mirandoEjemplo?: boolean
  onDeshacer?: () => void
  puedeDeshacer?: boolean
}

type Arrastre =
  | { tipo: 'nodo'; id: string; dx: number; dy: number; movido: boolean }
  | { tipo: 'fondo'; x: number; y: number; tx: number; ty: number }
  | { tipo: 'cable'; de?: { id: string; j: number }; a?: { id: string; i: number }; x: number; y: number; agregar: boolean }

export default function EditorNodos({ def, evaluacion, onCambiar, seleccion, onSeleccionar, alto = 460, guia, mirandoEjemplo = false, onDeshacer, puedeDeshacer = false, soloLienzo = false }: Props) {
  const tactil = useTactil()
  const svgRef = useRef<SVGSVGElement>(null)
  const [vista, setVista] = useState({ tx: 20, ty: 40, k: 0.8 })
  const [arrastre, setArrastre] = useState<Arrastre | null>(null)
  const [plegadaGuardada, setPlegada] = usePersistente(CLAVES.robotPaleta, false)
  // Con Entregar abierto queda poco ancho: se esconde la paleta para que el lienzo se vea (y se exporte) entero.
  const plegada = plegadaGuardada || soloLienzo
  const [ayudaCerrada, setAyudaCerrada] = usePersistente(CLAVES.robotAyudaLienzo, false)
  const [abiertas, setAbiertas] = useState<Pestana[]>(() => (guia?.pestana ? [guia.pestana] : ['Movimientos', 'Robot']))
  const paletaRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!guia?.pestana) return
    setAbiertas((prev) => (prev.includes(guia.pestana!) ? prev : [...prev, guia.pestana!]))
  }, [guia?.id, guia?.pestana])
  useEffect(() => {
    if (!guia?.destacar || plegada) return
    const el = paletaRef.current?.querySelector<HTMLElement>(`[data-agregar="${CSS.escape(guia.destacar)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [guia?.destacar, plegada, abiertas])
  const [buscador, setBuscador] = useState<{ x: number; y: number; wx: number; wy: number; texto: string } | null>(null)
  const defRef = useRef(def)
  defRef.current = def
  const soltoBloque = useRef(false)

  const porId = useMemo(() => new Map(def.nodos.map((n) => [n.id, n])), [def])

  // Encuadrar la definición al cargar una nueva.
  const encuadrar = () => {
    const svg = svgRef.current
    if (!svg || !def.nodos.length) return
    const r = svg.getBoundingClientRect()
    const xs = def.nodos.map((n) => n.x)
    const ys = def.nodos.map((n) => n.y)
    const x0 = Math.min(...xs) - 72
    const y0 = Math.min(...ys) - 72
    const x1 = Math.max(...def.nodos.map((n) => n.x + medidas(n, componente(n.tipo)).w)) + 72
    const y1 = Math.max(...def.nodos.map((n) => n.y + medidas(n, componente(n.tipo)).h)) + 72
    // Encuadrar muestra siempre todo, aunque el lienzo sea angosto y los bloques queden chicos.
    const k = Math.min(1, Math.max(0.12, Math.min(r.width / (x1 - x0), r.height / (y1 - y0))))
    setVista({ k, tx: (r.width - (x1 - x0) * k) / 2 - x0 * k, ty: (r.height - (y1 - y0) * k) / 2 - y0 * k })
  }
  const nombreDef = def.nombre + def.nodos.length
  useEffect(() => {
    encuadrar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombreDef])

  const aMundo = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: (cx - r.left - vista.tx) / vista.k, y: (cy - r.top - vista.ty) / vista.k }
  }

  const agregarNodo = (tipo: string, x: number, y: number) => {
    const comp = componente(tipo)
    if (!comp) return
    const id = nuevoId(def, tipo)
    // Buscar un lugar libre cerca del punto pedido (sin tapar otros componentes).
    const nuevo: NodoDef = { id, tipo, x: Math.round(x), y: Math.round(y), params: paramsIniciales(comp) }
    const { w, h } = medidas(nuevo, comp)
    const choca = (px: number, py: number) =>
      def.nodos.some((n) => {
        const m = medidas(n, componente(n.tipo))
        return px < n.x + m.w + 16 && px + w + 16 > n.x && py < n.y + m.h + 12 && py + h + 12 > n.y
      })
    let libre = { x: nuevo.x, y: nuevo.y }
    buscar: for (let r = 0; r < 30; r++) {
      for (let k = 0; k <= r; k++) {
        for (const [dx, dy] of [
          [k, r - k],
          [-k, r - k],
          [k, -(r - k)],
          [-k, -(r - k)],
        ]) {
          const px = nuevo.x + dx * 40
          const py = nuevo.y + dy * 30
          if (!choca(px, py)) {
            libre = { x: px, y: py }
            break buscar
          }
        }
      }
    }
    onCambiar({ ...def, nodos: [...def.nodos, { ...nuevo, ...libre }] })
    onSeleccionar(id)
  }

  const conectar = (c: Cable, agregar: boolean) => {
    if (c.de === c.a) return
    const otros = def.cables.filter((k) => !(agregar ? k.a === c.a && k.entrada === c.entrada && k.de === c.de && k.salida === c.salida : k.a === c.a && k.entrada === c.entrada))
    onCambiar({ ...def, cables: [...otros, c] })
  }

  // Borrar con Supr.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && seleccion && document.activeElement === svgRef.current) {
        e.preventDefault()
        const d = defRef.current
        onCambiar({ ...d, nodos: d.nodos.filter((n) => n.id !== seleccion), cables: d.cables.filter((c) => c.de !== seleccion && c.a !== seleccion) })
        onSeleccionar(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seleccion, onCambiar, onSeleccionar])

  const onPointerMove = (e: React.PointerEvent) => {
    if (!arrastre) return
    if (arrastre.tipo === 'fondo') {
      setVista((v) => ({ ...v, tx: arrastre.tx + (e.clientX - arrastre.x), ty: arrastre.ty + (e.clientY - arrastre.y) }))
    } else if (arrastre.tipo === 'nodo') {
      const p = aMundo(e.clientX, e.clientY)
      const d = defRef.current
      onCambiar({ ...d, nodos: d.nodos.map((n) => (n.id === arrastre.id ? { ...n, x: Math.round(p.x - arrastre.dx), y: Math.round(p.y - arrastre.dy) } : n)) })
      if (!arrastre.movido) setArrastre({ ...arrastre, movido: true })
    } else {
      const p = aMundo(e.clientX, e.clientY)
      setArrastre({ ...arrastre, x: p.x, y: p.y })
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (arrastre?.tipo === 'cable') {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const puerto = el?.closest('[data-puerto]') as HTMLElement | null
      if (puerto) {
        const id = puerto.dataset.nodo as string
        const idx = Number(puerto.dataset.indice)
        if (arrastre.de && puerto.dataset.puerto === 'entrada') conectar({ de: arrastre.de.id, salida: arrastre.de.j, a: id, entrada: idx }, arrastre.agregar)
        if (arrastre.a && puerto.dataset.puerto === 'salida') conectar({ de: id, salida: idx, a: arrastre.a.id, entrada: arrastre.a.i }, arrastre.agregar)
      }
    }
    setArrastre(null)
  }

  /** Zoom alrededor de un punto de la pantalla (px dentro del lienzo). */
  const zoomEn = (mx: number, my: number, factor: number) =>
    setVista((v) => {
      const k2 = Math.min(2.2, Math.max(0.25, v.k * factor))
      return { k: k2, tx: mx - ((mx - v.tx) / v.k) * k2, ty: my - ((my - v.ty) / v.k) * k2 }
    })
  const zoomCentro = (factor: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    zoomEn(r.width / 2, r.height / 2, factor)
  }

  // Zoom con dos dedos.
  const dedos = useRef(new Map<number, { x: number; y: number }>())
  const pinza = useRef<{ d0: number; k0: number; wx: number; wy: number } | null>(null)
  const medir = () => {
    const [a, b] = Array.from(dedos.current.values())
    return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
  }
  const dedoAbajo = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (dedos.current.size === 2) {
      setArrastre(null)
      const { d, mx, my } = medir()
      const w = aMundo(mx, my)
      pinza.current = { d0: Math.max(10, d), k0: vista.k, wx: w.x, wy: w.y }
    }
  }
  const dedoMueve = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !dedos.current.has(e.pointerId)) return
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pz = pinza.current
    if (!pz || dedos.current.size < 2) return
    e.stopPropagation()
    const { d, mx, my } = medir()
    const r = svgRef.current!.getBoundingClientRect()
    const k = Math.min(2.2, Math.max(0.25, (pz.k0 * d) / pz.d0))
    setVista({ k, tx: mx - r.left - pz.wx * k, ty: my - r.top - pz.wy * k })
  }
  const dedoArriba = (e: React.PointerEvent) => {
    dedos.current.delete(e.pointerId)
    if (dedos.current.size < 2) pinza.current = null
  }

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    const k2 = Math.min(2.2, Math.max(0.25, vista.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
    setVista((v) => ({ k: k2, tx: mx - ((mx - v.tx) / v.k) * k2, ty: my - ((my - v.ty) / v.k) * k2 }))
  }

  // Rueda sin desplazar la página.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const evitar = (e: WheelEvent) => e.preventDefault()
    svg.addEventListener('wheel', evitar, { passive: false })
    return () => svg.removeEventListener('wheel', evitar)
  }, [])

  const cableTemporal = (() => {
    if (arrastre?.tipo !== 'cable') return null
    if (arrastre.de) {
      const n = porId.get(arrastre.de.id)
      if (!n) return null
      return curvaCable(puertoSalida(n, componente(n.tipo), arrastre.de.j), { x: arrastre.x, y: arrastre.y })
    }
    if (arrastre.a) {
      const n = porId.get(arrastre.a.id)
      if (!n) return null
      return curvaCable({ x: arrastre.x, y: arrastre.y }, puertoEntrada(n, componente(n.tipo), arrastre.a.i))
    }
    return null
  })()

  const coincidencias = buscador
    ? COMPONENTES.filter((c) => {
        const t = buscador.texto.trim().toLowerCase()
        return !t || c.nombre.toLowerCase().includes(t) || c.corto.toLowerCase().includes(t) || c.descripcion.toLowerCase().includes(t)
      }).slice(0, 10)
    : []

  return (
    <div data-editor-nodos="si" className={typeof alto === 'string' ? 'editor-nodos' : undefined} style={typeof alto === 'string' ? { height: alto } : undefined}>
      <aside ref={paletaRef} className="paleta-nodos" data-plegada={plegada ? 'si' : 'no'} role="toolbar" aria-label="Componentes del programa">
        <div className="paleta-nodos__barra">
          {plegada ? (
            <button type="button" className="paleta-nodos__plegar paleta-nodos__plegar--riel" aria-expanded={false} title="Mostrar componentes" aria-label="Mostrar componentes" onClick={() => setPlegada(false)}>
              <span aria-hidden="true">›</span>
              <span className="paleta-nodos__riel">Componentes</span>
            </button>
          ) : (
            <>
              <span className="paleta-nodos__titulo">Componentes</span>
              <button type="button" className="paleta-nodos__plegar" aria-expanded title="Colapsar componentes" aria-label="Colapsar componentes" onClick={() => setPlegada(true)}>
                ‹
              </button>
            </>
          )}
        </div>
        {!plegada && (
          <div className="paleta-nodos__cuerpo">
            <p className="paleta-nodos__ayuda">
              {mirandoEjemplo
                ? 'Esto es el ejemplo. Para armar la tuya, pulsa «Volver a mi tarea».'
                : guia
                ? `Paso ${guia.numero} de ${guia.total}. El bloque con borde azul es el siguiente.`
                : def.nodos.length === 0
                  ? 'Empieza arrastrando un Robot y un Core.'
                  : tactil
                    ? 'Toca un bloque para ponerlo en el lienzo.'
                    : 'Arrastra un bloque al lienzo, o haz clic para soltarlo al centro.'}
            </p>
            {PESTANAS.map((cat) => {
              const abierta = abiertas.includes(cat)
              const bloques = COMPONENTES.filter((c) => c.pestana === cat)
              const tieneSiguiente = bloques.some((c) => c.tipo === guia?.destacar)
              return (
                <section key={cat} className="paleta-nodos__cat">
                  <button
                    type="button"
                    className="paleta-nodos__cat-btn"
                    aria-expanded={abierta}
                    data-siguiente={!abierta && tieneSiguiente ? 'si' : undefined}
                    onClick={() => setAbiertas((prev) => (prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]))}
                  >
                    <span>{cat}</span>
                    <span aria-hidden="true">{abierta ? '−' : '+'}</span>
                  </button>
                  {abierta &&
                    agrupar(bloques).map(([grupo, cs]) => (
                      <div key={grupo} className="paleta-nodos__grupo">
                        <span className="paleta-nodos__nombre">{grupo}</span>
                        {cs.map((c) => (
                          <button
                            key={c.tipo}
                            type="button"
                            className="bloque-nodo"
                            data-categoria={cat}
                            data-siguiente={guia?.destacar === c.tipo ? 'si' : undefined}
                            title={pista(c)}
                            data-agregar={c.tipo}
                            draggable={!tactil}
                            onDragStart={(e) => {
                              soltoBloque.current = true
                              e.dataTransfer.setData('text/neumalab-nodo', c.tipo)
                              e.dataTransfer.effectAllowed = 'copy'
                            }}
                            onDragEnd={() => {
                              setTimeout(() => {
                                soltoBloque.current = false
                              }, 50)
                            }}
                            onClick={() => {
                              if (soltoBloque.current) {
                                soltoBloque.current = false
                                return
                              }
                              const svg = svgRef.current!
                              const r = svg.getBoundingClientRect()
                              const p = aMundo(r.left + r.width / 2 - 75, r.top + r.height / 2 - 30)
                              agregarNodo(c.tipo, p.x, p.y)
                            }}
                          >
                            <span className="bloque-nodo__agarre" aria-hidden="true">
                              ⋮⋮
                            </span>
                            <span className="bloque-nodo__texto">
                              <span className="bloque-nodo__corto">{c.corto}</span>
                              <span className="bloque-nodo__glosa">{GLOSA[c.tipo] ?? c.nombre}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                </section>
              )
            })}
          </div>
        )}
      </aside>
      <div className={typeof alto === 'string' ? 'editor-nodos__lienzo' : undefined} style={typeof alto === 'string' ? undefined : { position: 'relative' }}>
        {guia && !mirandoEjemplo && !soloLienzo && (
          <div className="lienzo-ayuda lienzo-ayuda--barra lienzo-ayuda--paso" data-guia-paso={guia.id} style={{ display: 'block' }}>
            <p className="u-sin-margen"><strong>Paso {guia.numero} de {guia.total} · {guia.titulo}</strong></p>
            {/* Corto a propósito: el lienzo es angosto. Los micro pasos y el porqué están en la pestaña Plano. */}
            <p style={{ margin: '4px 0 0' }}>{guia.accion}</p>
            {guia.pista && <p style={{ margin: '4px 0 0', color: '#6b4200', fontWeight: 600 }}>Te falta: {guia.pista}</p>}
            {guia.listo && <p style={{ margin: '4px 0 0', color: 'var(--tinta)' }}>Listo cuando: {guia.listo}</p>}
          </div>
        )}
        {!guia && def.nodos.length > 0 && !ayudaCerrada && !mirandoEjemplo && (
          <div className="lienzo-ayuda lienzo-ayuda--barra">
            <p>
              Arrastra un bloque desde Componentes, o haz clic para dejarlo en el centro.{' '}
              La salida (derecha) se conecta con la entrada (izquierda).
            </p>
            <button type="button" onClick={() => setAyudaCerrada(true)}>
              Entendido
            </button>
          </div>
        )}
        <div className="editor-nodos__superficie">
        <svg
          ref={svgRef}
          tabIndex={0}
          width="100%"
          height={typeof alto === 'string' ? '100%' : alto}
          data-lienzo-nodos="si"
          data-arrastre={arrastre?.tipo ?? ""}
          style={{
            display: 'block',
            background: '#eef1f4',
            backgroundImage: 'linear-gradient(#e1e6eb 1px, transparent 1px), linear-gradient(90deg, #e1e6eb 1px, transparent 1px)',
            backgroundSize: `${32 * vista.k}px ${32 * vista.k}px`,
            backgroundPosition: `${vista.tx}px ${vista.ty}px`,
            borderRadius: 10,
            boxShadow: 'inset 0 0 0 1px #d5dee6',
            fontFamily: 'inherit',
            touchAction: 'none',
            outline: 'none',
            cursor: arrastre?.tipo === 'fondo' ? 'grabbing' : 'default',
          }}
          onPointerDown={(e) => {
            if (e.target !== svgRef.current && !(e.target as Element).hasAttribute('data-fondo')) return
            setBuscador(null)
            onSeleccionar(null)
            svgRef.current?.focus()
            setArrastre({ tipo: 'fondo', x: e.clientX, y: e.clientY, tx: vista.tx, ty: vista.ty })
          }}
          onPointerDownCapture={(e) => {
            dedoAbajo(e)
            if (e.button !== 1) return
            e.preventDefault()
            e.stopPropagation()
            svgRef.current?.setPointerCapture?.(e.pointerId)
            setArrastre({ tipo: 'fondo', x: e.clientX, y: e.clientY, tx: vista.tx, ty: vista.ty })
          }}
          onMouseDown={(e) => e.button === 1 && e.preventDefault()}
          onPointerMoveCapture={dedoMueve}
          onPointerUpCapture={dedoArriba}
          onPointerCancelCapture={dedoArriba}
          onPointerMove={(e) => !pinza.current && onPointerMove(e)}
          onPointerUp={onPointerUp}
          onPointerLeave={(e) => (e.buttons & 4) === 0 && arrastre?.tipo !== 'cable' && setArrastre(null)}
          onWheel={onWheel}
          onDragOver={(e) => {
            if ([...e.dataTransfer.types].includes('text/neumalab-nodo')) e.preventDefault()
          }}
          onDrop={(e) => {
            const tipo = e.dataTransfer.getData('text/neumalab-nodo')
            if (!tipo) return
            e.preventDefault()
            const w = aMundo(e.clientX, e.clientY)
            agregarNodo(tipo, w.x - 70, w.y - 16)
          }}
          onDoubleClick={(e) => {
            if (e.target !== svgRef.current && !(e.target as Element).hasAttribute('data-fondo')) return
            const r = svgRef.current!.getBoundingClientRect()
            const w = aMundo(e.clientX, e.clientY)
            setBuscador({ x: e.clientX - r.left, y: e.clientY - r.top, wx: w.x, wy: w.y, texto: '' })
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <g transform={`translate(${vista.tx},${vista.ty}) scale(${vista.k})`}>
            {def.cables.map((c, k) => {
              const a = porId.get(c.de)
              const b = porId.get(c.a)
              if (!a || !b) return null
              const pa = puertoSalida(a, componente(a.tipo), c.salida)
              const pb = puertoEntrada(b, componente(b.tipo), c.entrada)
              const activo = seleccion === c.de || seleccion === c.a
              const vacio = !(evaluacion.nodos[c.de]?.salidas[c.salida]?.length ?? 0)
              const d = curvaCable(pa, pb)
              const color = activo ? '#1668c7' : vacio ? '#d98a1a' : '#3a4450'
              return (
                <g key={k}>
                  <path d={d} fill="none" stroke="rgba(28,39,51,0.14)" strokeWidth={activo ? 7 : 5} strokeLinecap="round" />
                  <path d={d} fill="none" stroke={color} strokeWidth={activo ? 2.6 : 2.15} strokeLinecap="round" strokeDasharray={vacio ? '7 5' : undefined} />
                </g>
              )
            })}
            {cableTemporal && <path d={cableTemporal} fill="none" stroke="#1668c7" strokeWidth={2.4} strokeLinecap="round" strokeDasharray="6 5" />}
            {def.nodos.map((n) => (
              <Nodo
                key={n.id}
                nodo={n}
                def={def}
                evaluacion={evaluacion}
                seleccionado={seleccion === n.id}
                onDown={(e) => {
                  e.stopPropagation()
                  onSeleccionar(n.id)
                  svgRef.current?.focus()
                  const p = aMundo(e.clientX, e.clientY)
                  setArrastre({ tipo: 'nodo', id: n.id, dx: p.x - n.x, dy: p.y - n.y, movido: false })
                }}
                onPuerto={(e, lado, idx) => {
                  e.stopPropagation()
                  const p = aMundo(e.clientX, e.clientY)
                  if (e.button === 2 && lado === 'entrada') {
                    onCambiar({ ...def, cables: def.cables.filter((c) => !(c.a === n.id && c.entrada === idx)) })
                    return
                  }
                  if (lado === 'salida') setArrastre({ tipo: 'cable', de: { id: n.id, j: idx }, x: p.x, y: p.y, agregar: e.shiftKey })
                  else setArrastre({ tipo: 'cable', a: { id: n.id, i: idx }, x: p.x, y: p.y, agregar: e.shiftKey })
                }}
                onParam={(clave, valor) => onCambiar({ ...def, nodos: def.nodos.map((x) => (x.id === n.id ? { ...x, params: { ...x.params, [clave]: valor } } : x)) })}
              />
            ))}
          </g>
        </svg>
        {def.nodos.length === 0 && (
          <div className="lienzo-ayuda lienzo-ayuda--vacio">
            <h3>El lienzo está vacío</h3>
            <p>Arrastra un bloque desde Componentes, o haz clic en él para dejarlo en el centro.</p>
            <p>Conecta de la salida a la entrada: el punto de la derecha de un bloque con el punto de la izquierda del siguiente.</p>
          </div>
        )}
        {def.nodos.length > 0 && ayudaCerrada && (
          <button type="button" className="lienzo-ayuda__chip" onClick={() => setAyudaCerrada(false)}>
            Ayuda
          </button>
        )}
        {buscador && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(buscador.x, 9999),
              top: buscador.y,
              background: '#fff',
              border: '1px solid var(--gris-claro)',
              borderRadius: 6,
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
              width: 280,
              zIndex: 5,
            }}
          >
            <input
              autoFocus
              value={buscador.texto}
              placeholder="Buscar bloque (ej. LIN, curva, robot)…"
              onChange={(e) => setBuscador({ ...buscador, texto: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setBuscador(null)
                if (e.key === 'Enter' && coincidencias[0]) {
                  agregarNodo(coincidencias[0].tipo, buscador.wx, buscador.wy)
                  setBuscador(null)
                }
              }}
              style={{ width: '100%', padding: '6px 8px', border: 'none', borderBottom: '1px solid var(--borde-suave)', fontSize: '0.88rem' }}
            />
            {coincidencias.map((c) => (
              <button
                key={c.tipo}
                onClick={() => {
                  agregarNodo(c.tipo, buscador.wx, buscador.wy)
                  setBuscador(null)
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: '#fff', padding: '4px 8px', cursor: 'pointer', fontSize: '0.82rem' }}
              >
                <strong>{c.nombre}</strong> <span style={{ color: 'var(--tinta-gris)' }}>({c.corto}) · {c.pestana}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', gap: 4 }}>
          {onDeshacer && (
            <button type="button" onClick={onDeshacer} disabled={!puedeDeshacer} aria-label="Deshacer" style={{ ...botonMini, minWidth: 34, fontSize: '1.05rem', opacity: puedeDeshacer ? 1 : 0.45 }} title="Deshacer (Ctrl+Z)">
              ↶
            </button>
          )}
          <button onClick={() => zoomCentro(1 / 1.25)} style={{ ...botonMini, minWidth: 34 }} aria-label="Alejar" title="Alejar">
            −
          </button>
          <button onClick={() => zoomCentro(1.25)} style={{ ...botonMini, minWidth: 34 }} aria-label="Acercar" title="Acercar">
            +
          </button>
          <button onClick={encuadrar} style={botonMini} title="Encuadrar toda la definición">
            ⤢ Encuadrar
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

function agrupar(cs: Componente[]): Array<[string, Componente[]]> {
  const m = new Map<string, Componente[]>()
  for (const c of cs) m.set(c.grupo, [...(m.get(c.grupo) ?? []), c])
  return [...m.entries()]
}

const botonMini: React.CSSProperties = { border: '1px solid #8a97a5', background: 'rgba(255,255,255,0.95)', borderRadius: 6, padding: '4px 10px', minHeight: 32, fontSize: '0.82rem', cursor: 'pointer' }

function Nodo({
  nodo,
  def,
  evaluacion,
  seleccionado,
  onDown,
  onPuerto,
  onParam,
}: {
  nodo: NodoDef
  def: Definicion
  evaluacion: Evaluacion
  seleccionado: boolean
  onDown: (e: React.PointerEvent) => void
  onPuerto: (e: React.PointerEvent, lado: 'entrada' | 'salida', i: number) => void
  onParam: (clave: string, valor: number) => void
}) {
  const comp = componente(nodo.tipo)
  const { w, h } = medidas(nodo, comp)
  const ev = evaluacion.nodos[nodo.id]
  const estado = ev?.estado ?? 'ok'
  const borde = seleccionado ? '#1668c7' : estado === 'error' ? '#c62828' : estado === 'aviso' ? '#d98a1a' : '#d0d7de'
  const relleno = seleccionado ? '#f3f8fd' : estado === 'error' ? '#fdecea' : estado === 'aviso' ? '#fff6e8' : '#fff'
  const conectadas = new Set(def.cables.filter((c) => c.a === nodo.id).map((c) => c.entrada))
  const titulo = ev?.mensajes.length ? ev.mensajes.join(' ') : comp?.descripcion
  const cabeza = colorCabeza(comp?.pestana)

  if (comp?.tipo === 'slider') {
    const p = nodo.params
    const valor = Number(p.valor)
    return (
      <g data-nodo={nodo.id} data-estado={estado}>
        <rect x={nodo.x + 1} y={nodo.y + 2} width={w} height={h} rx={8} fill="rgba(28,39,51,0.08)" />
        <rect x={nodo.x} y={nodo.y} width={w} height={h} rx={8} fill={relleno} stroke={borde} strokeWidth={seleccionado ? 2 : 1.25} onPointerDown={onDown} style={{ cursor: 'move' }}>
          <title>{titulo}</title>
        </rect>
        <text x={nodo.x + 10} y={nodo.y + 16} fontSize={12} fontWeight={700} fill="#1c2733" pointerEvents="none">
          Slider
        </text>
        <foreignObject x={nodo.x + 6} y={nodo.y + 20} width={w - 60} height={22}>
          <input
            type="range"
            min={Number(p.min)}
            max={Number(p.max)}
            step={Number(p.paso) || 1}
            value={valor}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => onParam('valor', Number(e.target.value))}
            style={{ width: '100%', margin: 0 }}
            aria-label="Valor del slider"
          />
        </foreignObject>
        <text x={nodo.x + w - 50} y={nodo.y + 36} fontSize={12} fontWeight={700} fill="#1c2733" pointerEvents="none">
          {Math.round(valor * 1000) / 1000}
        </text>
        <PuertoSvg x={nodo.x + w} y={nodo.y + h / 2} lado="salida" nodo={nodo.id} i={0} onDown={onPuerto} titulo="N: valor" />
      </g>
    )
  }

  if (comp?.tipo === 'panel') {
    const datos = def.cables.filter((c) => c.a === nodo.id).flatMap((c) => evaluacion.nodos[c.de]?.salidas[c.salida] ?? [])
    const lineas = datos.slice(0, 7).map((d, i) => `${i}  ${describirDato(d)}`)
    if (datos.length > 7) lineas.push(`… (${datos.length} elementos)`)
    return (
      <g data-nodo={nodo.id}>
        <rect x={nodo.x + 1} y={nodo.y + 2} width={w} height={h} rx={8} fill="rgba(28,39,51,0.08)" />
        <rect x={nodo.x} y={nodo.y} width={w} height={h} rx={8} fill={seleccionado ? '#f3f8fd' : '#fffdf3'} stroke={borde} strokeWidth={seleccionado ? 2 : 1.25} onPointerDown={onDown} style={{ cursor: 'move' }}>
          <title>Panel: muestra lo que le llega</title>
        </rect>
        {(lineas.length ? lineas : ['(vacío)']).map((l, i) => (
          <text key={i} x={nodo.x + 14} y={nodo.y + 16 + i * 14} fontSize={10.5} fontFamily="ui-monospace, Menlo, monospace" fill="#333" pointerEvents="none">
            {l.length > 34 ? l.slice(0, 33) + '…' : l}
          </text>
        ))}
        <PuertoSvg x={nodo.x} y={nodo.y + 30} lado="entrada" nodo={nodo.id} i={0} onDown={onPuerto} titulo="Datos" conectada={conectadas.has(0)} />
      </g>
    )
  }

  return (
    <g data-nodo={nodo.id} data-estado={estado}>
      <rect x={nodo.x + 1} y={nodo.y + 2} width={w} height={h} rx={8} fill="rgba(28,39,51,0.1)" />
      <rect x={nodo.x} y={nodo.y} width={w} height={h} rx={8} fill={relleno} />
      <rect x={nodo.x} y={nodo.y} width={w} height={CABEZA} rx={8} fill={cabeza} pointerEvents="none" />
      <rect x={nodo.x} y={nodo.y + CABEZA - 8} width={w} height={8} fill={cabeza} pointerEvents="none" />
      <rect x={nodo.x} y={nodo.y} width={w} height={h} rx={8} fill="none" stroke={borde} strokeWidth={seleccionado ? 2 : 1.25} onPointerDown={onDown} style={{ cursor: 'move' }}>
        <title>{titulo}</title>
      </rect>
      <text x={nodo.x + 12} y={nodo.y + 17} fontSize={13} fontWeight={700} fill="#fff" pointerEvents="none">
        {comp?.corto ?? nodo.tipo}
      </text>
      {comp?.entradas.map((p, i) => {
        const pt = puertoEntrada(nodo, comp, i)
        return (
          <g key={`e${i}`}>
            <text x={pt.x + 12} y={pt.y + 4} fontSize={12} fill="#1c2733" pointerEvents="none">
              {p.corto}
            </text>
            <PuertoSvg x={pt.x} y={pt.y} lado="entrada" nodo={nodo.id} i={i} onDown={onPuerto} titulo={`${p.corto} · ${p.nombre}: ${p.descripcion}`} conectada={conectadas.has(i)} />
          </g>
        )
      })}
      {comp?.salidas.map((p, j) => {
        const pt = puertoSalida(nodo, comp, j)
        const cant = ev?.salidas[j]?.length ?? 0
        return (
          <g key={`s${j}`}>
            <text x={pt.x - 12} y={pt.y + 4} fontSize={12} fill="#1c2733" textAnchor="end" pointerEvents="none">
              {p.corto}
              {cant > 1 ? ` (${cant})` : ''}
            </text>
            <PuertoSvg x={pt.x} y={pt.y} lado="salida" nodo={nodo.id} i={j} onDown={onPuerto} titulo={`${p.corto} · ${p.nombre}: ${p.descripcion} — ${cant} elemento(s)`} />
          </g>
        )
      })}
    </g>
  )
}

function PuertoSvg({
  x,
  y,
  lado,
  nodo,
  i,
  onDown,
  titulo,
  conectada,
}: {
  x: number
  y: number
  lado: 'entrada' | 'salida'
  nodo: string
  i: number
  onDown: (e: React.PointerEvent, lado: 'entrada' | 'salida', i: number) => void
  titulo: string
  conectada?: boolean
}) {
  return (
    <g data-puerto={lado} data-nodo={nodo} data-indice={i} onPointerDown={(e) => onDown(e, lado, i)} style={{ cursor: 'crosshair' }}>
      <circle cx={x} cy={y} r={12} fill="transparent" />
      <circle cx={x} cy={y} r={5.5} fill={lado === 'salida' ? '#1c2733' : conectada ? '#1668c7' : '#fff'} stroke={lado === 'salida' ? '#1c2733' : '#1668c7'} strokeWidth={1.6} />
      <title>{titulo}</title>
    </g>
  )
}
