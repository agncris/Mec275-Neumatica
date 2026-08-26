/**
 * Cada ficha dibujada como el objeto real, para la vista Taller de la pizarra.
 *
 * Reutiliza los cortes ya existentes de válvulas y cilindros, incrustados en el
 * hueco que ocupa la ficha, y añade cuerpos realistas sencillos para el resto
 * de componentes (que en el banco son bloques de aluminio con sus racores).
 * Los puertos siguen estando donde dice el descriptor, así que las mangueras
 * llegan al mismo sitio que en la vista de esquema.
 */
import type { Params } from '../engine'
import type { EstadoVivo } from '../symbols/Simbolos'
import { CorteCilindroDoble, CorteCilindroSimple } from './CortesCilindro'
import { CorteValvula32, CorteValvula42, CorteValvula52 } from './CortesValvula'
import {
  CUERPO,
  CUERPO_BORDE,
  METAL,
  METAL_CLARO,
  METAL_OSCURO,
  colorP,
  T_AIRE,
} from './comunes'

interface Props {
  tipo: string
  params: Params
  vivo?: EstadoVivo | null
  /** Hueco de la ficha en la pizarra. */
  ancho: number
  alto: number
  /** Presión en cada puerto, si la simulación está corriendo. */
  presiones?: Record<string, number>
}

/** Presiones supuestas cuando aún no se simula, para que el dibujo no salga vacío. */
function presionesSupuestas(tipo: string, params: Params, vivo?: EstadoVivo | null): Record<string, number> {
  const accionada = vivo?.accionada ?? false
  if (tipo === 'valvula32' || tipo === 'finalCarrera') {
    const abierta = (params.reposo === 'NA') !== accionada
    return { '1': 6, '2': abierta ? 6 : 0, '3': 0 }
  }
  if (tipo === 'valvula42' || tipo === 'valvula52') {
    return { '1': 6, '2': accionada ? 0 : 6, '4': accionada ? 6 : 0, '3': 0, '5': 0, '12': 0, '14': 0 }
  }
  if (tipo === 'cilindroSimpleEfecto') return { '1': (vivo?.posicion ?? 0) > 0.02 ? 6 : 0 }
  return { A: 0, B: 0 }
}

/** Cuerpo genérico de bloque de aluminio, con sus racores. */
function Bloque({
  ancho,
  alto,
  etiqueta,
  detalle,
}: {
  ancho: number
  alto: number
  etiqueta: string
  detalle?: React.ReactNode
}) {
  return (
    <g>
      <rect
        x={ancho * 0.08}
        y={alto * 0.12}
        width={ancho * 0.84}
        height={alto * 0.7}
        rx={4}
        fill={CUERPO}
        stroke={CUERPO_BORDE}
        strokeWidth={2}
      />
      {/* aristas mecanizadas, para que no parezca un rectángulo plano */}
      <line
        x1={ancho * 0.08}
        y1={alto * 0.26}
        x2={ancho * 0.92}
        y2={alto * 0.26}
        stroke={METAL_CLARO}
        strokeWidth={1.5}
      />
      <line
        x1={ancho * 0.08}
        y1={alto * 0.68}
        x2={ancho * 0.92}
        y2={alto * 0.68}
        stroke={METAL_OSCURO}
        strokeWidth={1}
        opacity={0.5}
      />
      {detalle}
      <text
        x={ancho / 2}
        y={alto * 0.55}
        fontSize={Math.min(13, ancho * 0.13)}
        fontWeight={700}
        fill="#4a5561"
        textAnchor="middle"
        fontFamily="inherit"
      >
        {etiqueta}
      </text>
    </g>
  )
}

export function PiezaRealista({ tipo, params, vivo, ancho, alto, presiones }: Props) {
  const p = presiones ?? presionesSupuestas(tipo, params, vivo)
  const accionada = vivo?.accionada ?? false
  const caja = { x: 0, y: 0, w: ancho, h: alto }

  switch (tipo) {
    case 'valvula32':
      return <CorteValvula32 accionada={accionada} presiones={p} na={params.reposo === 'NA'} incrustar={caja} />
    case 'finalCarrera':
      // Un final de carrera es una 3/2; lo que cambia es el mando, no el cuerpo.
      return <CorteValvula32 accionada={accionada} presiones={p} incrustar={caja} />
    case 'valvula42':
      return (
        <CorteValvula42
          accionada={accionada}
          presiones={p}
          pilotaje={params.modo === 'biestable' || params.accionamiento === 'pilotaje'}
          incrustar={caja}
        />
      )
    case 'valvula52':
      return (
        <CorteValvula52
          accionada={accionada}
          presiones={p}
          biestable={params.modo === 'biestable'}
          pilotaje={params.accionamiento === 'pilotaje'}
          incrustar={caja}
        />
      )
    case 'cilindroSimpleEfecto':
      return <CorteCilindroSimple posicion={vivo?.posicion ?? 0} presiones={p} nombres={false} incrustar={caja} />
    case 'cilindroDobleEfecto':
      return <CorteCilindroDoble posicion={vivo?.posicion ?? 0} presiones={p} nombres={false} incrustar={caja} />

    case 'actuadorGiratorio': {
      // Unidad giratoria de paletas: carcasa con el eje y la brida de salida.
      const giro = (vivo?.posicion ?? 0) * Number(params.angulo ?? 180)
      const cx = ancho / 2
      const cy = alto * 0.45
      const r = Math.min(ancho, alto) * 0.3
      return (
        <g>
          <rect x={ancho * 0.1} y={alto * 0.1} width={ancho * 0.8} height={alto * 0.7} rx={6} fill={CUERPO} stroke={CUERPO_BORDE} strokeWidth={2} />
          <circle cx={cx} cy={cy} r={r} fill={METAL_CLARO} stroke={METAL_OSCURO} strokeWidth={1.5} />
          {/* paleta interior, que es lo que empuja el aire */}
          <g transform={`rotate(${giro} ${cx} ${cy})`} style={{ transition: 'transform 120ms linear' }}>
            <rect x={cx - r * 0.16} y={cy - r} width={r * 0.32} height={r} fill={METAL_OSCURO} />
          </g>
          <circle cx={cx} cy={cy} r={r * 0.22} fill={METAL} stroke={METAL_OSCURO} strokeWidth={1} />
          {/* cámaras de trabajo a los lados */}
          <rect x={ancho * 0.14} y={alto * 0.62} width={ancho * 0.2} height={alto * 0.14} fill={colorP(p['A'])} style={{ transition: T_AIRE }} />
          <rect x={ancho * 0.66} y={alto * 0.62} width={ancho * 0.2} height={alto * 0.14} fill={colorP(p['B'])} style={{ transition: T_AIRE }} />
        </g>
      )
    }

    case 'fuente': {
      // Compresor con su depósito y la unidad de mantenimiento.
      const encendida = vivo ? (vivo.encendida ?? true) : ((params.encendida as boolean) ?? true)
      return (
        <g>
          <rect x={ancho * 0.06} y={alto * 0.34} width={ancho * 0.5} height={alto * 0.44} rx={alto * 0.2} fill={METAL_CLARO} stroke={METAL_OSCURO} strokeWidth={1.6} />
          <circle cx={ancho * 0.24} cy={alto * 0.26} r={alto * 0.16} fill={CUERPO} stroke={CUERPO_BORDE} strokeWidth={1.6} />
          <rect x={ancho * 0.6} y={alto * 0.3} width={ancho * 0.14} height={alto * 0.5} fill={CUERPO} stroke={CUERPO_BORDE} strokeWidth={1.4} />
          <rect x={ancho * 0.78} y={alto * 0.3} width={ancho * 0.14} height={alto * 0.5} fill={CUERPO} stroke={CUERPO_BORDE} strokeWidth={1.4} />
          {/* vaso del filtro y manómetro */}
          <rect x={ancho * 0.62} y={alto * 0.72} width={ancho * 0.1} height={alto * 0.16} rx={2} fill="#cfe6f5" stroke={METAL_OSCURO} strokeWidth={1} />
          <circle cx={ancho * 0.85} cy={alto * 0.2} r={alto * 0.1} fill="#fff" stroke={METAL_OSCURO} strokeWidth={1.4} />
          <circle cx={ancho * 0.85} cy={alto * 0.2} r={alto * 0.03} fill={encendida ? '#b3261e' : '#8a97a5'} />
          <text x={ancho / 2} y={alto * 0.98} fontSize={9} fill="#5a6b7d" textAnchor="middle" fontFamily="inherit">
            {encendida ? `${Number(params.presion ?? 6).toFixed(1)} bar` : 'sin aire'}
          </text>
        </g>
      )
    }

    case 'reguladorCaudal':
      return (
        <Bloque
          ancho={ancho}
          alto={alto}
          etiqueta={`${Math.round(Number(params.apertura ?? 0.5) * 100)}%`}
          detalle={
            <circle cx={ancho / 2} cy={alto * 0.2} r={Math.min(8, alto * 0.11)} fill={METAL_CLARO} stroke={METAL_OSCURO} strokeWidth={1.4} />
          }
        />
      )
    case 'valvulaO':
      return <Bloque ancho={ancho} alto={alto} etiqueta="O" />
    case 'valvulaY':
      return <Bloque ancho={ancho} alto={alto} etiqueta="Y" />
    case 'escapeRapido':
      return (
        <Bloque
          ancho={ancho}
          alto={alto}
          etiqueta="escape"
          detalle={
            <rect x={ancho * 0.42} y={alto * 0.02} width={ancho * 0.16} height={alto * 0.12} fill={METAL_OSCURO} opacity={0.7} />
          }
        />
      )
    case 'temporizador':
      return (
        <Bloque
          ancho={ancho}
          alto={alto}
          etiqueta={`${Number(params.retardo ?? 2).toFixed(1)} s`}
          detalle={
            <rect x={ancho * 0.12} y={alto * 0.2} width={ancho * 0.24} height={alto * 0.5} rx={3} fill={METAL_CLARO} stroke={METAL_OSCURO} strokeWidth={1.3} />
          }
        />
      )
    default:
      return <Bloque ancho={ancho} alto={alto} etiqueta="?" />
  }
}
