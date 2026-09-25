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
import { useTactil } from '../components/ui'
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

const ANCHO = 150
const FILA = 18
const CABEZA = 22

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

export const PESTANAS: Pestana[] = ['Params', 'Curve', 'Vector', 'Sets', 'KUKA|prc']

interface Props {
  def: Definicion
  evaluacion: Evaluacion
  onCambiar: (d: Definicion) => void
  seleccion: string | null
  onSeleccionar: (id: string | null) => void
  /** En píxeles, o '100%' para llenar el área. */
  alto?: number | string
}

type Arrastre =
  | { tipo: 'nodo'; id: string; dx: number; dy: number; movido: boolean }
  | { tipo: 'fondo'; x: number; y: number; tx: number; ty: number }
  | { tipo: 'cable'; de?: { id: string; j: number }; a?: { id: string; i: number }; x: number; y: number; agregar: boolean }

export default function EditorNodos({ def, evaluacion, onCambiar, seleccion, onSeleccionar, alto = 460 }: Props) {
  const tactil = useTactil()
  const svgRef = useRef<SVGSVGElement>(null)
  const [vista, setVista] = useState({ tx: 20, ty: 40, k: 0.8 })
  const [arrastre, setArrastre] = useState<Arrastre | null>(null)
  const [pestana, setPestana] = useState<Pestana>('KUKA|prc')
  const [buscador, setBuscador] = useState<{ x: number; y: number; wx: number; wy: number; texto: string } | null>(null)
  const defRef = useRef(def)
  defRef.current = def

  const porId = useMemo(() => new Map(def.nodos.map((n) => [n.id, n])), [def])

  // Encuadrar la definición al cargar una nueva.
  const encuadrar = () => {
    const svg = svgRef.current
    if (!svg || !def.nodos.length) return
    const r = svg.getBoundingClientRect()
    const xs = def.nodos.map((n) => n.x)
    const ys = def.nodos.map((n) => n.y)
    const x0 = Math.min(...xs) - 20
    const y0 = Math.min(...ys) - 20
    const x1 = Math.max(...def.nodos.map((n) => n.x + medidas(n, componente(n.tipo)).w)) + 20
    const y1 = Math.max(...def.nodos.map((n) => n.y + medidas(n, componente(n.tipo)).h)) + 20
    const k = Math.min(1.1, Math.max(0.3, Math.min(r.width / (x1 - x0), r.height / (y1 - y0))))
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
    <div data-editor-nodos="si" style={typeof alto === 'string' ? { display: 'flex', flexDirection: 'column', height: alto, minHeight: 0 } : undefined}>
      {/* Cinta de componentes, por pestañas como en Grasshopper. */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        {PESTANAS.map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            aria-pressed={pestana === p}
            style={{
              border: '1px solid #c6ced6',
              borderBottom: pestana === p ? '2px solid #33475c' : '1px solid #c6ced6',
              background: pestana === p ? '#fff' : '#f1f4f7',
              color: '#33475c',
              padding: tactil ? '6px 12px' : '2px 10px',
              fontSize: tactil ? '0.88rem' : '0.8rem',
              fontWeight: pestana === p ? 700 : 500,
              cursor: 'pointer',
              borderRadius: '6px 6px 0 0',
            }}
          >
            {p}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.76rem', color: '#5f6b78', alignSelf: 'center' }}>
          {tactil ? 'Toca un componente (LIN, PTP…) para agregarlo · arrastra desde una salida hasta una entrada para conectar · dos dedos: zoom' : 'Doble clic en el fondo: buscar componente · Supr: borrar'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6, minHeight: 30 }}>
        {agrupar(COMPONENTES.filter((c) => c.pestana === pestana)).map(([grupo, cs]) => (
          <span key={grupo} style={{ display: 'flex', gap: 3, alignItems: 'center', border: '1px solid #e0e5eb', borderRadius: 6, padding: '2px 4px', background: '#fafbfc' }}>
            <span style={{ fontSize: '0.66rem', color: '#5f6b78', marginRight: 2 }}>{grupo}</span>
            {cs.map((c) => (
              <button
                key={c.tipo}
                title={`${c.nombre}: ${c.descripcion}`}
                data-agregar={c.tipo}
                onClick={() => {
                  const svg = svgRef.current!
                  const r = svg.getBoundingClientRect()
                  const p = aMundo(r.left + r.width / 2 - 75, r.top + r.height / 2 - 30)
                  agregarNodo(c.tipo, p.x, p.y)
                }}
                style={{ border: '1px solid #b8c1ca', background: '#fff', borderRadius: 4, padding: tactil ? '6px 10px' : '1px 6px', minHeight: tactil ? 34 : undefined, fontSize: tactil ? '0.85rem' : '0.74rem', cursor: 'pointer', color: '#1c2733' }}
              >
                {c.corto}
              </button>
            ))}
          </span>
        ))}
      </div>
      <div style={{ position: 'relative', ...(typeof alto === 'string' ? { flex: 1, minHeight: 200 } : {}) }}>
        <svg
          ref={svgRef}
          tabIndex={0}
          width="100%"
          height={typeof alto === 'string' ? '100%' : alto}
          data-lienzo-nodos="si"
          data-arrastre={arrastre?.tipo ?? ""}
          style={{
            display: 'block',
            background: '#d4d7da',
            backgroundImage: 'linear-gradient(#c8cbcf 1px, transparent 1px), linear-gradient(90deg, #c8cbcf 1px, transparent 1px)',
            backgroundSize: `${20 * vista.k}px ${20 * vista.k}px`,
            backgroundPosition: `${vista.tx}px ${vista.ty}px`,
            borderRadius: 8,
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
          onPointerDownCapture={dedoAbajo}
          onPointerMoveCapture={dedoMueve}
          onPointerUpCapture={dedoArriba}
          onPointerCancelCapture={dedoArriba}
          onPointerMove={(e) => !pinza.current && onPointerMove(e)}
          onPointerUp={onPointerUp}
          onPointerLeave={() => arrastre?.tipo !== 'cable' && setArrastre(null)}
          onWheel={onWheel}
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
              return (
                <path
                  key={k}
                  d={curvaCable(pa, pb)}
                  fill="none"
                  stroke={activo ? '#4c9a2a' : vacio ? '#e0913a' : '#4b5157'}
                  strokeWidth={activo ? 3 : 2}
                  strokeDasharray={vacio ? '6 4' : undefined}
                  opacity={0.9}
                />
              )
            })}
            {cableTemporal && <path d={cableTemporal} fill="none" stroke="#1668c7" strokeWidth={2.5} strokeDasharray="5 4" />}
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
        {buscador && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(buscador.x, 9999),
              top: buscador.y,
              background: '#fff',
              border: '1px solid #8a97a5',
              borderRadius: 6,
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
              width: 280,
              zIndex: 5,
            }}
          >
            <input
              autoFocus
              value={buscador.texto}
              placeholder="Buscar componente (ej. divide, LIN, plane)…"
              onChange={(e) => setBuscador({ ...buscador, texto: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setBuscador(null)
                if (e.key === 'Enter' && coincidencias[0]) {
                  agregarNodo(coincidencias[0].tipo, buscador.wx, buscador.wy)
                  setBuscador(null)
                }
              }}
              style={{ width: '100%', padding: '6px 8px', border: 'none', borderBottom: '1px solid #e0e5eb', outline: 'none', fontSize: '0.88rem' }}
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
                <strong>{c.nombre}</strong> <span style={{ color: '#5f6b78' }}>({c.corto}) · {c.pestana}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', gap: 4 }}>
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
  const fondo = seleccionado ? '#b7dd8f' : estado === 'error' ? '#ef9a9a' : estado === 'aviso' ? '#f7c77e' : '#e6e7e8'
  const borde = seleccionado ? '#4c9a2a' : estado === 'error' ? '#c62828' : estado === 'aviso' ? '#d98a1a' : '#5f6368'
  const conectadas = new Set(def.cables.filter((c) => c.a === nodo.id).map((c) => c.entrada))
  const titulo = ev?.mensajes.length ? ev.mensajes.join(' ') : comp?.descripcion

  if (comp?.tipo === 'slider') {
    const p = nodo.params
    const valor = Number(p.valor)
    return (
      <g data-nodo={nodo.id} data-estado={estado}>
        <rect x={nodo.x} y={nodo.y} width={w} height={h} rx={6} fill={fondo} stroke={borde} strokeWidth={1.5} onPointerDown={onDown} style={{ cursor: 'move' }}>
          <title>{titulo}</title>
        </rect>
        <text x={nodo.x + 8} y={nodo.y + 16} fontSize={11} fill="#1c2733" pointerEvents="none">
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
        <rect x={nodo.x} y={nodo.y} width={w} height={h} rx={3} fill={seleccionado ? '#e8f5c8' : '#fff9c4'} stroke={borde} strokeWidth={1.2} onPointerDown={onDown} style={{ cursor: 'move' }}>
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
      <rect x={nodo.x} y={nodo.y} width={w} height={h} rx={6} fill={fondo} stroke={borde} strokeWidth={1.5} onPointerDown={onDown} style={{ cursor: 'move' }}>
        <title>{titulo}</title>
      </rect>
      <rect x={nodo.x + w / 2 - 34} y={nodo.y + 3} width={68} height={16} rx={3} fill={comp?.pestana === 'KUKA|prc' ? '#ff6b00' : '#3c4046'} pointerEvents="none" />
      <text x={nodo.x + w / 2} y={nodo.y + 15} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle" pointerEvents="none">
        {comp?.corto ?? nodo.tipo}
      </text>
      {comp?.entradas.map((p, i) => {
        const pt = puertoEntrada(nodo, comp, i)
        return (
          <g key={`e${i}`}>
            <text x={pt.x + 10} y={pt.y + 4} fontSize={11} fill="#1c2733" pointerEvents="none">
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
            <text x={pt.x - 10} y={pt.y + 4} fontSize={11} fill="#1c2733" textAnchor="end" pointerEvents="none">
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
      <circle cx={x} cy={y} r={9} fill="transparent" />
      <circle cx={x} cy={y} r={4.5} fill={lado === 'salida' || conectada ? '#fff' : '#f3f3f3'} stroke="#3c4046" strokeWidth={1.4} />
      <title>{titulo}</title>
    </g>
  )
}
