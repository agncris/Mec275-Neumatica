/**
 * La pizarra: un canvas SVG que funciona como editor CAD de circuitos
 * neumáticos. Admite zoom (rueda / trackpad / Ctrl+rueda, centrado en el
 * cursor) y desplazamiento (pan) sobre un área de trabajo amplia, y dibuja
 * el circuito con auto-layout y enrutado ortogonal de mangueras.
 */
import { memo, useEffect, useRef, useState } from 'react'
import type { Motor, RefPuerto } from '../engine'
import type { EstadoVivo } from '../symbols/Simbolos'
import { SimboloPieza } from '../symbols/Simbolos'
import { PiezaRealista } from '../realistic/PiezaRealista'
import { DESCRIPTORES, puertosVisibles } from './descriptores'
import { useStore, type Pieza } from '../store'
import { enrutarManguera } from '../routing'
import { calcularAreaConMargen } from '../layout'

/** Dimensiones por defecto del viewport en el espacio del circuito. */
const VW_BASE = 1200
const VH_BASE = 780
const REJILLA = 10
/** Radio del imán de los puertos (píxeles de pantalla). */
const RADIO_IMAN = 30
/** Límites razonables de escala. */
const ESC_MIN = 0.15
const ESC_MAX = 5

export type Vista = 'esquema' | 'taller'

interface PropsDibujo {
  tipo: string
  params: Pieza['params']
  vivo: EstadoVivo | null
  vista: Vista
  ancho: number
  alto: number
  presiones?: Record<string, number>
  /** Resumen del estado que afecta al dibujo; evita redibujar lo que no cambió. */
  firma: string
}

const DibujoFicha = memo(
  function DibujoFicha({ tipo, params, vivo, vista, ancho, alto, presiones }: PropsDibujo) {
    return vista === 'taller' ? (
      <PiezaRealista tipo={tipo} params={params} vivo={vivo} ancho={ancho} alto={alto} presiones={presiones} />
    ) : (
      <SimboloPieza tipo={tipo} params={params} vivo={vivo} />
    )
  },
  (a, b) =>
    a.tipo === b.tipo &&
    a.vista === b.vista &&
    a.ancho === b.ancho &&
    a.alto === b.alto &&
    a.firma === b.firma,
)

function firmaDe(
  params: Pieza['params'],
  vivo: EstadoVivo | null,
  presiones: Record<string, number> | undefined,
): string {
  const pos = typeof vivo?.posicion === 'number' ? vivo.posicion.toFixed(3) : ''
  const aire = presiones
    ? Object.keys(presiones)
        .sort()
        .map((k) => `${k}${(presiones[k] ?? 0) > 0.1 ? 1 : 0}`)
        .join('')
    : ''
  return [
    JSON.stringify(params),
    vivo?.accionada ?? '',
    pos,
    vivo?.encendida ?? '',
    vivo?.lado ?? '',
    vivo?.purgando ?? '',
    aire,
  ].join('|')
}

interface Props {
  motor: Motor | null
  /** La vista (esquema/taller) sirve para decidir qué dibujar. */
  vista?: Vista
  soloLectura?: boolean
  id?: string
}

interface Punto {
  x: number
  y: number
}

/** Ventana visible del canvas (esquina + tamaño) en el espacio del circuito. */
interface VistaVentana {
  x: number
  y: number
  w: number
  h: number
}

function puertoMundo(pieza: Pieza, idPuerto: string): Punto | null {
  const desc = DESCRIPTORES[pieza.tipo]
  const puerto = desc?.puertos.find((p) => p.id === idPuerto)
  if (!puerto) return null
  return { x: pieza.x + puerto.x, y: pieza.y + puerto.y }
}

export default function Pizarra({ motor, vista = 'esquema', soloLectura = false, id = 'pizarra-svg' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const piezas = useStore((s) => s.piezas)
  const mangueras = useStore((s) => s.mangueras)
  const modo = useStore((s) => s.modo)
  const seleccion = useStore((s) => s.seleccion)
  const origenCable = useStore((s) => s.origenCable)
  const { moverPieza, seleccionar, iniciarCable, conectarCable, cancelarCable } = useStore()

  const colocando = useStore((s) => s.colocando)
  const { agregarPieza, agregarPiezaEn, terminarColocacion } = useStore()

  const [cursor, setCursor] = useState<Punto | null>(null)
  const [fantasma, setFantasma] = useState<Punto | null>(null)
  const [iman, setIman] = useState<{ ref: RefPuerto; punto: Punto } | null>(null)
  const [view, setView] = useState<VistaVentana>({ x: 0, y: 0, w: VW_BASE, h: VH_BASE })
  const arrastreRef = useRef<{
    id: string
    dx: number
    dy: number
    movido: boolean
  } | null>(null)
  const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const escalaRef = useRef(1)

  const porId = new Map(piezas.map((p) => [p.id, p]))
  const simulando = modo === 'simular' && motor !== null

  /** Convierte coordenadas de pantalla al espacio del circuito (mundo). */
  const coordsDesdeCliente = (clientX: number, clientY: number): Punto | null => {
    const svg = svgRef.current
    if (!svg) return null
    const punto = svg.createSVGPoint()
    punto.x = clientX
    punto.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const local = punto.matrixTransform(ctm.inverse())
    return { x: local.x, y: local.y }
  }

  const coordsSvg = (e: React.PointerEvent): Punto =>
    coordsDesdeCliente(e.clientX, e.clientY) ?? { x: 0, y: 0 }

  // --- arranque: ajustar el circuito a la pantalla -------------------------
  useEffect(() => {
    // No re-ajustar cuando el usuario ya ha navegado.
    if (panRef.current) return
    const cont = contenedorRef.current
    const cw = cont?.clientWidth || VW_BASE
    const ch = cont?.clientHeight || VH_BASE
    const area = calcularAreaConMargen(piezas, 60)
    if (area.ancho > 0 && area.alto > 0) {
      const escX = cw / area.ancho
      const escY = ch / area.alto
      const esc = Math.max(ESC_MIN, Math.min(1.1, Math.min(escX, escY)))
      const w = cw / esc
      const h = ch / esc
      setView({
        x: area.x + (area.ancho - w) / 2,
        y: area.y + (area.alto - h) / 2,
        w,
        h,
      })
      escalaRef.current = esc
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- arrastre de una ficha nueva desde la paleta -------------------------
  useEffect(() => {
    if (!colocando) {
      setFantasma(null)
      return
    }
    const desc = DESCRIPTORES[colocando.tipo]

    const posSoltado = (clientX: number, clientY: number): Punto | null => {
      const p = coordsDesdeCliente(clientX, clientY)
      if (!p) return null
      const x = Math.round((p.x - desc.ancho / 2) / REJILLA) * REJILLA
      const y = Math.round((p.y - desc.alto / 2) / REJILLA) * REJILLA
      return { x, y }
    }

    const onMove = (e: PointerEvent) => setFantasma(posSoltado(e.clientX, e.clientY))
    const onUp = (e: PointerEvent) => {
      const destino = posSoltado(e.clientX, e.clientY)
      if (destino) {
        agregarPiezaEn(colocando.tipo, { ...colocando.params }, destino.x, destino.y)
      } else {
        const dist = Math.hypot(e.clientX - colocando.inicio.x, e.clientY - colocando.inicio.y)
        if (dist < 8) agregarPieza(colocando.tipo, { ...colocando.params })
      }
      terminarColocacion()
    }
    const onCancel = () => terminarColocacion()

    document.body.style.cursor = 'grabbing'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colocando])

  const estadoVivoDe = (pieza: Pieza): EstadoVivo | null => {
    if (!simulando || !motor) return null
    try {
      const estado = motor.estadoDe<Record<string, unknown>>(pieza.id)
      const params = motor.circuito.componentes.find((c) => c.id === pieza.id)?.params ?? {}
      return {
        accionada: typeof estado.accionada === 'boolean' ? estado.accionada : undefined,
        posicion: typeof estado.posicion === 'number' ? estado.posicion : undefined,
        encendida: pieza.tipo === 'fuente' ? ((params.encendida as boolean) ?? true) : undefined,
        lado: estado.lado === 'X' || estado.lado === 'Y' ? estado.lado : undefined,
        purgando: typeof estado.purgando === 'boolean' ? estado.purgando : undefined,
        presion: pieza.tipo === 'manometro' ? motor.presionEn(pieza.id, '1') : undefined,
      }
    } catch {
      return null
    }
  }

  const presionesDe = (id: string, tipo: string): Record<string, number> | undefined => {
    if (!simulando || !motor) return undefined
    const salida: Record<string, number> = {}
    for (const puerto of puertosVisibles(tipo, porId.get(id)?.params ?? {})) {
      salida[puerto.id] = motor.presionEn(id, puerto.id)
    }
    return salida
  }

  // --- imán de puertos -----------------------------------------------------
  const radioIman = (): number => {
    const escala = escalaRef.current
    return Math.min(50, Math.max(RADIO_IMAN, 22 / escala))
  }

  const puertoMasCercano = (pos: Punto): { ref: RefPuerto; punto: Punto } | null => {
    let mejor: { ref: RefPuerto; punto: Punto } | null = null
    let mejorDist = radioIman()
    for (const pieza of piezas) {
      for (const puerto of puertosVisibles(pieza.tipo, pieza.params)) {
        const px = pieza.x + puerto.x
        const py = pieza.y + puerto.y
        const d = Math.hypot(px - pos.x, py - pos.y)
        if (d < mejorDist) {
          mejorDist = d
          mejor = { ref: { componente: pieza.id, puerto: puerto.id }, punto: { x: px, y: py } }
        }
      }
    }
    return mejor
  }

  const accionPuerto = (ref: RefPuerto) => {
    if (origenCable) conectarCable(ref)
    else iniciarCable(ref)
  }

  // --- pan / zoom ----------------------------------------------------------
  const escDe = (v: VistaVentana, cw: number) => cw / v.w

  /** Aplica un factor de zoom manteniendo bajo el cursor el punto dado (si existe). */
  const aplicarZoom = (factor: number, cxMundo: Punto | null) => {
    setView((v) => {
      const cont = contenedorRef.current
      const cw = cont?.clientWidth || v.w
      const ch = cont?.clientHeight || v.h
      const escActual = escDe(v, cw)
      const escNuevo = Math.max(ESC_MIN, Math.min(ESC_MAX, escActual * factor))
      if (Math.abs(escNuevo - escActual) < 1e-6) return v
      const w2 = cw / escNuevo
      const h2 = ch / escNuevo
      let x2 = v.x
      let y2 = v.y
      if (cxMundo) {
        // El punto bajo el cursor debe quedarse donde estaba en pantalla.
        const relX = (cxMundo.x - v.x) / v.w
        const relY = (cxMundo.y - v.y) / v.h
        x2 = cxMundo.x - relX * w2
        y2 = cxMundo.y - relY * h2
      }
      escalaRef.current = escNuevo
      return { x: x2, y: y2, w: w2, h: h2 }
    })
  }

  const onWheel = (e: React.WheelEvent) => {
    if (soloLectura) return
    e.preventDefault()
    const punto = coordsDesdeCliente(e.clientX, e.clientY)
    const delta = e.deltaY || e.deltaX
    const factor = delta < 0 ? 1.12 : 1 / 1.12
    aplicarZoom(factor, punto)
  }

  const onPointerDownFondo = (e: React.PointerEvent) => {
    if (soloLectura || e.target !== svgRef.current) return
    if (modo === 'editar' && iman) {
      accionPuerto(iman.ref)
      return
    }
    // Arrastrar el fondo = pan (deja el puntero libre para cablear con clic)
    if (modo === 'editar' || modo === 'simular') {
      const pos = coordsSvg(e)
      panRef.current = { x: view.x, y: view.y, px: pos.x, py: pos.y }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (soloLectura) return
    const pos = coordsSvg(e)
    if (origenCable) setCursor(pos)
    const arrastre = arrastreRef.current
    const pan = panRef.current

    if (pan) {
      // Pan en el espacio del circuito
      const dx = pos.x - pan.px
      const dy = pos.y - pan.py
      setView((v) => ({ ...v, x: pan.x - dx, y: pan.y - dy }))
      return
    }

    if (modo === 'editar' && !arrastre && !colocando) setIman(puertoMasCercano(pos))
    else if (iman) setIman(null)

    if (arrastre) {
      const nx = Math.round((pos.x - arrastre.dx) / REJILLA) * REJILLA
      const ny = Math.round((pos.y - arrastre.dy) / REJILLA) * REJILLA
      const pieza = porId.get(arrastre.id)
      if (pieza && (Math.abs(nx - pieza.x) > 0 || Math.abs(ny - pieza.y) > 0)) {
        arrastre.movido = true
        moverPieza(arrastre.id, nx, ny)
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (soloLectura) return
    if (panRef.current) {
      const clicSinMover = Math.abs((coordsSvg(e).x - panRef.current.px)) < 3 && Math.abs((coordsSvg(e).y - panRef.current.py)) < 3
      panRef.current = null
      if (clicSinMover && e.target === svgRef.current && !iman) {
        seleccionar(null)
        cancelarCable()
      }
      return
    }
    const arrastre = arrastreRef.current
    if (arrastre) {
      if (!arrastre.movido) seleccionar({ clase: 'pieza', id: arrastre.id })
      arrastreRef.current = null
      return
    }
    if (e.target === svgRef.current && !iman) {
      seleccionar(null)
      cancelarCable()
    }
  }

  const onClickPuerto = (e: React.PointerEvent, ref: RefPuerto) => {
    if (soloLectura) return
    e.stopPropagation()
    if (simulando) return
    accionPuerto(ref)
  }

  // --- interacción con piezas ---------------------------------------------
  const onPointerDownPieza = (e: React.PointerEvent, pieza: Pieza) => {
    if (soloLectura) return
    e.stopPropagation()
    if (!simulando && modo === 'editar' && iman) {
      accionPuerto(iman.ref)
      return
    }
    if (simulando && motor) {
      const esCorredera = pieza.tipo === 'valvula42' || pieza.tipo === 'valvula52'
      const esBiestable = esCorredera && pieza.params.modo === 'biestable'
      if ((pieza.tipo === 'valvula32' || esCorredera) && !esBiestable) {
        if (pieza.params.accionamiento !== 'pilotaje') {
          motor.accionar(pieza.id, true)
          const soltar = () => motor.accionar(pieza.id, false)
          window.addEventListener('pointerup', soltar, { once: true })
        }
      } else if (esBiestable) {
        const estado = motor.estadoDe<{ accionada: boolean }>(pieza.id)
        motor.accionar(pieza.id, !estado.accionada)
      } else if (pieza.tipo === 'fuente') {
        const params = motor.circuito.componentes.find((c) => c.id === pieza.id)?.params
        motor.setParametro(pieza.id, 'encendida', !((params?.encendida as boolean) ?? true))
      }
      return
    }
    const pos = coordsSvg(e)
    arrastreRef.current = { id: pieza.id, dx: pos.x - pieza.x, dy: pos.y - pieza.y, movido: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  // --- controles de navegación ---------------------------------------------
  const zoomAbsoluto = (esc: number) => {
    setView((v) => {
      const cont = contenedorRef.current
      const cw = cont?.clientWidth || v.w
      const ch = cont?.clientHeight || v.h
      escalaRef.current = esc
      return { x: v.x, y: v.y, w: cw / esc, h: ch / esc }
    })
  }

  const ajustar = () => {
    const cont = contenedorRef.current
    const cw = cont?.clientWidth || VW_BASE
    const ch = cont?.clientHeight || VH_BASE
    const area = calcularAreaConMargen(piezas, 60)
    if (area.ancho <= 0) return zoomAbsoluto(1)
    const escX = cw / area.ancho
    const escY = ch / area.alto
    const esc = Math.max(ESC_MIN, Math.min(escX, escY))
    const w = cw / esc
    const h = ch / esc
    setView({
      x: area.x + (area.ancho - w) / 2,
      y: area.y + (area.alto - h) / 2,
      w,
      h,
    })
    escalaRef.current = esc
  }

  const escPorcentaje = () => {
    const cont = contenedorRef.current
    const cw = cont?.clientWidth || 1
    return Math.round((cw / view.w) * 100)
  }

  const escActual = () => {
    const cont = contenedorRef.current
    const cw = cont?.clientWidth || 1
    return cw / view.w
  }

  // --- render -------------------------------------------------------------
  const bancoVacio = piezas.length === 0

  return (
    <div
      ref={contenedorRef}
      style={{
        position: 'relative',
        width: '100%',
        height: 520,
        overflow: 'hidden',
        borderRadius: 10,
        border: `6px solid ${simulando ? '#12a35a' : '#b9bec5'}`,
        background: '#f7f5ef',
        touchAction: 'none',
      }}
    >
      {/* barra de navegación */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 5,
          display: 'flex',
          gap: 4,
          alignItems: 'center',
          padding: '4px 6px',
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid #d0d5db',
          borderRadius: 8,
          boxShadow: '0 1px 4px rgba(28,39,51,0.15)',
          fontSize: '0.78rem',
          userSelect: 'none',
        }}
      >
        <button onClick={() => zoomAbsoluto(Math.max(ESC_MIN, escActual() / 1.4))} title="Alejar" style={btnNav}>
          −
        </button>
        <button
          onClick={() => zoomAbsoluto(1)}
          title="Volver al 100%"
          style={{ ...btnNav, minWidth: 44 }}
        >
          {escPorcentaje()}%
        </button>
        <button onClick={() => zoomAbsoluto(Math.min(ESC_MAX, escActual() * 1.4))} title="Acercar" style={btnNav}>
          +
        </button>
        <button onClick={ajustar} title="Ajustar todo el circuito a la pantalla" style={btnNav}>
          Ajustar
        </button>
      </div>

      <svg
        ref={svgRef}
        id={id}
        width="100%"
        height="100%"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', cursor: modo === 'editar' && iman ? 'crosshair' : 'default' }}
        onWheel={onWheel}
        onPointerDown={onPointerDownFondo}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <defs>
          <pattern id="rejilla" width={40} height={40} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={1} fill="#d9d5c9" />
          </pattern>
        </defs>
        <rect x={view.x - 5000} y={view.y - 5000} width={view.w + 10000} height={view.h + 10000} fill="url(#rejilla)" pointerEvents="none" />

        {/* estado vacío */}
        {bancoVacio && modo === 'editar' && (
          <g>
            <text x={view.x + view.w / 2} y={view.y + view.h / 2 - 60} textAnchor="middle" fontSize={24} fontWeight={700} fill="#33475c" pointerEvents="none">
              Tu banco está vacío
            </text>
            <text x={view.x + view.w / 2} y={view.y + view.h / 2 - 26} textAnchor="middle" fontSize={16} fill="#5a6b7d" pointerEvents="none">
              1 · Arrastra una ficha desde la paleta&nbsp;&nbsp;2 · Cablea los puertos
            </text>
            <text x={view.x + view.w / 2} y={view.y + view.h / 2 + 2} textAnchor="middle" fontSize={16} fill="#5a6b7d" pointerEvents="none">
              3 · Pulsa ▶ Simular y acciona las válvulas
            </text>
            <g
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => {
                e.stopPropagation()
                useStore.getState().cargarEjemplo(1)
              }}
            >
              <rect x={view.x + view.w / 2 - 90} y={view.y + view.h / 2 + 26} width={180} height={38} rx={8} fill="#fff" stroke="#c6ced6" strokeWidth={1.5} />
              <text x={view.x + view.w / 2} y={view.y + view.h / 2 + 50} textAnchor="middle" fontSize={15} fontWeight={600} fill="#33475c">
                …o carga un ejemplo
              </text>
            </g>
          </g>
        )}

        {/* mangueras (por debajo de las fichas) */}
        {mangueras.map((m) => {
          const pa = porId.get(m.a.componente)
          const pb = porId.get(m.b.componente)
          if (!pa || !pb) return null
          const d = enrutarManguera(piezas, pa, m.a, pb, m.b)
          const presurizada =
            simulando && motor
              ? (motor.ultimaSolucion?.presion.get(`${m.a.componente}:${m.a.puerto}`) ?? 0) > 0.1
              : false
          const seleccionada = seleccion?.clase === 'manguera' && seleccion.id === m.id
          return (
            <g key={m.id}>
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                style={{ cursor: modo === 'editar' ? 'pointer' : 'default' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  if (modo === 'editar') seleccionar({ clase: 'manguera', id: m.id })
                }}
              />
              <path
                d={d}
                fill="none"
                stroke={seleccionada ? '#e8801a' : presurizada ? '#1668c7' : simulando ? '#9aa5b1' : '#2a323b'}
                strokeWidth={presurizada ? 3 : 2.4}
                strokeLinejoin="round"
                className={presurizada ? 'manguera-flujo' : undefined}
                pointerEvents="none"
              />
            </g>
          )
        })}

        {/* fantasma durante la colocación */}
        {colocando &&
          fantasma &&
          (() => {
            const desc = DESCRIPTORES[colocando.tipo]
            return (
              <g transform={`translate(${fantasma.x} ${fantasma.y})`} opacity={0.55} pointerEvents="none">
                <rect x={-4} y={-4} width={desc.ancho + 8} height={desc.alto + 8} rx={8} fill="#fffefa" stroke="#12a35a" strokeWidth={2} strokeDasharray="6 4" />
                <SimboloPieza tipo={colocando.tipo} params={colocando.params} vivo={null} />
              </g>
            )
          })()}

        {/* línea fantasma durante el cableado */}
        {origenCable &&
          cursor &&
          (() => {
            const pieza = porId.get(origenCable.componente)
            const p = pieza ? puertoMundo(pieza, origenCable.puerto) : null
            if (!p) return null
            const destino = iman ? iman.punto : cursor
            return (
              <line
                x1={p.x}
                y1={p.y}
                x2={destino.x}
                y2={destino.y}
                stroke="#12a35a"
                strokeWidth={iman ? 3 : 2}
                strokeDasharray={iman ? undefined : '6 5'}
                pointerEvents="none"
              />
            )
          })()}

        {/* fichas */}
        {piezas.map((pieza) => {
          const desc = DESCRIPTORES[pieza.tipo]
          if (!desc) return null
          const vivo = estadoVivoDe(pieza)
          const presiones = vista === 'taller' ? presionesDe(pieza.id, pieza.tipo) : undefined
          const seleccionada = seleccion?.clase === 'pieza' && seleccion.id === pieza.id
          const clicable =
            simulando &&
            (pieza.tipo === 'valvula32' ||
              pieza.tipo === 'valvula42' ||
              pieza.tipo === 'valvula52' ||
              pieza.tipo === 'fuente')
          return (
            <g key={pieza.id} transform={`translate(${pieza.x} ${pieza.y})`}>
              <rect
                x={-4}
                y={-4}
                width={desc.ancho + 8}
                height={desc.alto + 8}
                rx={8}
                fill="#fffefa"
                stroke={seleccionada ? '#e8801a' : '#d8d3c6'}
                strokeWidth={seleccionada ? 2.5 : 1.5}
                style={{
                  filter: 'drop-shadow(0 2px 3px rgba(28,39,51,0.18))',
                  cursor: simulando ? (clicable ? 'pointer' : 'default') : 'grab',
                }}
                onPointerDown={(e) => onPointerDownPieza(e, pieza)}
              />
              <g pointerEvents="none">
                <DibujoFicha
                  tipo={pieza.tipo}
                  params={pieza.params}
                  vivo={vivo}
                  vista={vista}
                  ancho={desc.ancho}
                  alto={desc.alto}
                  presiones={presiones}
                  firma={firmaDe(pieza.params, vivo, presiones)}
                />
              </g>
              {/* etiqueta del componente, con halo para que no se mezcle con las líneas */}
              <text
                x={desc.ancho / 2}
                y={-12}
                fontSize={12}
                fontWeight={600}
                fill="#33475c"
                textAnchor="middle"
                pointerEvents="none"
                style={{ paintOrder: 'stroke', stroke: '#fffefa', strokeWidth: 3, strokeLinejoin: 'round' }}
              >
                {pieza.id}
              </text>
              {/* puertos */}
              {puertosVisibles(pieza.tipo, pieza.params).map((puerto) => {
                const esOrigen = origenCable?.componente === pieza.id && origenCable.puerto === puerto.id
                const esIman = iman?.ref.componente === pieza.id && iman.ref.puerto === puerto.id && !esOrigen
                return (
                  <g key={puerto.id}>
                    {esIman && (
                      <circle cx={puerto.x} cy={puerto.y} r={11} fill="rgba(18,163,90,0.15)" stroke="#12a35a" strokeWidth={1.5} pointerEvents="none" />
                    )}
                    <circle
                      cx={puerto.x}
                      cy={puerto.y}
                      r={esOrigen ? 7 : esIman ? 7 : 5.5}
                      fill={esOrigen ? '#12a35a' : esIman ? '#e7f7ef' : '#fff'}
                      stroke={esOrigen || esIman ? '#12a35a' : origenCable ? '#12a35a' : '#2a323b'}
                      strokeWidth={2}
                      pointerEvents="none"
                      style={{ transition: 'r 80ms' }}
                    />
                    <circle
                      cx={puerto.x}
                      cy={puerto.y}
                      r={16}
                      fill="transparent"
                      style={{ cursor: modo === 'editar' ? 'crosshair' : 'default' }}
                      onPointerDown={(e) => onClickPuerto(e, { componente: pieza.id, puerto: puerto.id })}
                    />
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

const btnNav: React.CSSProperties = {
  border: '1px solid #c6ced6',
  background: '#fff',
  color: '#33475c',
  borderRadius: 6,
  padding: '3px 8px',
  cursor: 'pointer',
  fontSize: '0.78rem',
  lineHeight: 1.2,
}
