/**
 * La pizarra: tablero SVG donde se colocan las fichas (como imanes en un banco
 * real), se cablean puerto a puerto y se ve la simulación en vivo con líneas
 * presurizadas en azul y flujo animado.
 */
import { useEffect, useRef, useState } from 'react'
import type { Motor, RefPuerto } from '../engine'
import type { EstadoVivo } from '../symbols/Simbolos'
import { SimboloPieza } from '../symbols/Simbolos'
import { DESCRIPTORES, VECTOR_DIR, puertosVisibles } from './descriptores'
import { useStore, type Pieza } from '../store'

export const ANCHO_PIZARRA = 1000
export const ALTO_PIZARRA = 560
const REJILLA = 10
/** Radio del imán de los puertos: un clic o el extremo del cable dentro de
 *  esta distancia se "pega" al puerto más cercano. */
const RADIO_IMAN = 30

interface Props {
  motor: Motor | null
}

interface Punto {
  x: number
  y: number
}

function puertoMundo(pieza: Pieza, idPuerto: string): Punto | null {
  const desc = DESCRIPTORES[pieza.tipo]
  const puerto = desc?.puertos.find((p) => p.id === idPuerto)
  if (!puerto) return null
  return { x: pieza.x + puerto.x, y: pieza.y + puerto.y }
}

/** Enrutado ortogonal simple entre dos puertos, saliendo por su dirección. */
function rutaManguera(pieza1: Pieza, ref1: RefPuerto, pieza2: Pieza, ref2: RefPuerto): string {
  const d1 = DESCRIPTORES[pieza1.tipo]?.puertos.find((p) => p.id === ref1.puerto)
  const d2 = DESCRIPTORES[pieza2.tipo]?.puertos.find((p) => p.id === ref2.puerto)
  if (!d1 || !d2) return ''
  const p1 = { x: pieza1.x + d1.x, y: pieza1.y + d1.y }
  const p2 = { x: pieza2.x + d2.x, y: pieza2.y + d2.y }
  const [vx1, vy1] = VECTOR_DIR[d1.dir]
  const [vx2, vy2] = VECTOR_DIR[d2.dir]
  const SALIDA = 20
  const s1 = { x: p1.x + vx1 * SALIDA, y: p1.y + vy1 * SALIDA }
  const s2 = { x: p2.x + vx2 * SALIDA, y: p2.y + vy2 * SALIDA }

  const vertical1 = vy1 !== 0
  const vertical2 = vy2 !== 0
  let intermedios: Punto[]
  if (vertical1 && vertical2) {
    const midY = (s1.y + s2.y) / 2
    intermedios = [
      { x: s1.x, y: midY },
      { x: s2.x, y: midY },
    ]
  } else if (!vertical1 && !vertical2) {
    const midX = (s1.x + s2.x) / 2
    intermedios = [
      { x: midX, y: s1.y },
      { x: midX, y: s2.y },
    ]
  } else if (vertical1) {
    intermedios = [{ x: s1.x, y: s2.y }]
  } else {
    intermedios = [{ x: s2.x, y: s1.y }]
  }
  const puntos = [p1, s1, ...intermedios, s2, p2]
  return puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
}

export default function Pizarra({ motor }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
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
  const arrastreRef = useRef<{
    id: string
    dx: number
    dy: number
    movido: boolean
  } | null>(null)

  const porId = new Map(piezas.map((p) => [p.id, p]))
  const simulando = modo === 'simular' && motor !== null

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

  // --- arrastre de una ficha nueva desde la paleta -------------------------
  useEffect(() => {
    if (!colocando) {
      setFantasma(null)
      return
    }
    const desc = DESCRIPTORES[colocando.tipo]

    const posSoltado = (clientX: number, clientY: number): Punto | null => {
      const p = coordsDesdeCliente(clientX, clientY)
      if (!p || p.x < 0 || p.x > ANCHO_PIZARRA || p.y < 0 || p.y > ALTO_PIZARRA) return null
      const x = Math.round((p.x - desc.ancho / 2) / REJILLA) * REJILLA
      const y = Math.round((p.y - desc.alto / 2) / REJILLA) * REJILLA
      return {
        x: Math.max(0, Math.min(ANCHO_PIZARRA - desc.ancho, x)),
        y: Math.max(0, Math.min(ALTO_PIZARRA - desc.alto, y)),
      }
    }

    const onMove = (e: PointerEvent) => setFantasma(posSoltado(e.clientX, e.clientY))
    const onUp = (e: PointerEvent) => {
      const destino = posSoltado(e.clientX, e.clientY)
      if (destino) {
        agregarPiezaEn(colocando.tipo, { ...colocando.params }, destino.x, destino.y)
      } else {
        // Toque/clic corto sin llegar a la pizarra: colócala igual (escalonada)
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
      }
    } catch {
      return null
    }
  }

  // --- imán de puertos -----------------------------------------------------
  // El radio se calcula en píxeles de pantalla (~22 px reales) para que en
  // tablets o ventanas chicas el objetivo táctil no se encoja con el zoom.
  const radioIman = (): number => {
    const escala = svgRef.current?.getScreenCTM()?.a ?? 1
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

  // --- interacción con piezas -------------------------------------------
  const onPointerDownPieza = (e: React.PointerEvent, pieza: Pieza) => {
    e.stopPropagation()
    // Cerca de un puerto, el imán gana: el clic cablea en vez de arrastrar
    if (!simulando && modo === 'editar' && iman) {
      accionPuerto(iman.ref)
      return
    }
    if (simulando && motor) {
      // Operar: pulsadores se mantienen, biestables y fuente conmutan al clic
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
    // Editar: arrastrar / seleccionar
    const pos = coordsSvg(e)
    arrastreRef.current = { id: pieza.id, dx: pos.x - pieza.x, dy: pos.y - pieza.y, movido: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const pos = coordsSvg(e)
    if (origenCable) setCursor(pos)
    const arrastre = arrastreRef.current
    // El imán solo actúa editando, sin arrastres ni colocaciones en curso
    if (modo === 'editar' && !arrastre && !colocando) setIman(puertoMasCercano(pos))
    else if (iman) setIman(null)
    if (arrastre) {
      const nx = Math.round((pos.x - arrastre.dx) / REJILLA) * REJILLA
      const ny = Math.round((pos.y - arrastre.dy) / REJILLA) * REJILLA
      const pieza = porId.get(arrastre.id)
      if (pieza && (Math.abs(nx - pieza.x) > 0 || Math.abs(ny - pieza.y) > 0)) {
        arrastre.movido = true
        const desc = DESCRIPTORES[pieza.tipo]
        moverPieza(
          arrastre.id,
          Math.max(0, Math.min(ANCHO_PIZARRA - desc.ancho, nx)),
          Math.max(0, Math.min(ALTO_PIZARRA - desc.alto, ny)),
        )
      }
    }
  }

  const onPointerDownFondo = (e: React.PointerEvent) => {
    if (e.target !== svgRef.current) return
    if (modo === 'editar' && iman) accionPuerto(iman.ref)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const arrastre = arrastreRef.current
    if (arrastre) {
      if (!arrastre.movido) seleccionar({ clase: 'pieza', id: arrastre.id })
      arrastreRef.current = null
      return
    }
    // clic en el fondo lejos de todo puerto: deseleccionar / cancelar cable
    if (e.target === svgRef.current && !iman) {
      seleccionar(null)
      cancelarCable()
    }
  }

  const onClickPuerto = (e: React.PointerEvent, ref: RefPuerto) => {
    e.stopPropagation()
    if (simulando) return
    accionPuerto(ref)
  }

  // --- render -------------------------------------------------------------
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${ANCHO_PIZARRA} ${ALTO_PIZARRA}`}
      style={{
        width: '100%',
        height: 'auto',
        display: 'block',
        background: '#f7f5ef',
        borderRadius: 10,
        border: `6px solid ${simulando ? '#12a35a' : '#b9bec5'}`,
        transition: 'border-color 200ms',
        boxShadow: 'inset 0 1px 8px rgba(28,39,51,0.08)',
        touchAction: 'none',
        cursor: modo === 'editar' && iman ? 'crosshair' : undefined,
      }}
      onPointerDown={onPointerDownFondo}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* rejilla sutil de la pizarra */}
      <defs>
        <pattern id="rejilla" width={40} height={40} patternUnits="userSpaceOnUse">
          <circle cx={1} cy={1} r={1} fill="#d9d5c9" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={ANCHO_PIZARRA} height={ALTO_PIZARRA} fill="url(#rejilla)" pointerEvents="none" />

      {/* estado vacío: onboarding en 3 pasos */}
      {piezas.length === 0 && modo === 'editar' && (
        <g>
          <text x={500} y={218} textAnchor="middle" fontSize={24} fontWeight={700} fill="#33475c" pointerEvents="none">
            Tu banco está vacío
          </text>
          <text x={500} y={256} textAnchor="middle" fontSize={16} fill="#5a6b7d" pointerEvents="none">
            1 · Arrastra una ficha desde la paleta&nbsp;&nbsp;&nbsp;2 · Cablea los puertos (son magnéticos)
          </text>
          <text x={500} y={282} textAnchor="middle" fontSize={16} fill="#5a6b7d" pointerEvents="none">
            3 · Pulsa ▶ Simular y acciona las válvulas
          </text>
          <g
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation()
              useStore.getState().cargarEjemplo(1)
            }}
          >
            <rect x={410} y={306} width={180} height={38} rx={8} fill="#fff" stroke="#c6ced6" strokeWidth={1.5} />
            <text x={500} y={330} textAnchor="middle" fontSize={15} fontWeight={600} fill="#33475c">
              …o carga un ejemplo
            </text>
          </g>
        </g>
      )}

      {/* mangueras */}
      {mangueras.map((m) => {
        const pa = porId.get(m.a.componente)
        const pb = porId.get(m.b.componente)
        if (!pa || !pb) return null
        const d = rutaManguera(pa, m.a, pb, m.b)
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

      {/* fantasma de la ficha que se está soltando desde la paleta */}
      {colocando &&
        fantasma &&
        (() => {
          const desc = DESCRIPTORES[colocando.tipo]
          return (
            <g transform={`translate(${fantasma.x} ${fantasma.y})`} opacity={0.55} pointerEvents="none">
              <rect
                x={-4}
                y={-4}
                width={desc.ancho + 8}
                height={desc.alto + 8}
                rx={8}
                fill="#fffefa"
                stroke="#12a35a"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
              <SimboloPieza tipo={colocando.tipo} params={colocando.params} vivo={null} />
            </g>
          )
        })()}

      {/* línea fantasma durante el cableado: el extremo se imanta al puerto cercano */}
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
              <SimboloPieza tipo={pieza.tipo} params={pieza.params} vivo={vivo} />
            </g>
            <text
              x={desc.ancho / 2}
              y={-10}
              fontSize={11}
              fontWeight={600}
              fill="#6a7683"
              textAnchor="middle"
              pointerEvents="none"
            >
              {pieza.id}
            </text>
            {/* puertos (con zona magnética ampliada) */}
            {puertosVisibles(pieza.tipo, pieza.params).map((puerto) => {
              const esOrigen =
                origenCable?.componente === pieza.id && origenCable.puerto === puerto.id
              const esIman =
                iman?.ref.componente === pieza.id && iman.ref.puerto === puerto.id && !esOrigen
              return (
                <g key={puerto.id}>
                  {/* anillo de imán al acercarse */}
                  {esIman && (
                    <circle
                      cx={puerto.x}
                      cy={puerto.y}
                      r={11}
                      fill="rgba(18,163,90,0.15)"
                      stroke="#12a35a"
                      strokeWidth={1.5}
                      pointerEvents="none"
                    />
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
                  {/* zona de clic generosa */}
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
  )
}
