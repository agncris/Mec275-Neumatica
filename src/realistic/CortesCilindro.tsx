/**
 * Vistas en corte de los cilindros, al estilo de las láminas de clase:
 * cuerpo naranja (aluminio), cámara azul cuando tiene aire a presión,
 * celeste cuando está comunicada con la atmósfera, émbolo con juntas,
 * muelle helicoidal y vástago que se desplaza con la simulación.
 */
import {
  AZUL_PRESION,
  CELESTE_ATM,
  CUERPO_CIL,
  CUERPO_CIL_BORDE,
  JUNTA,
  METAL,
  METAL_CLARO,
  METAL_OSCURO,
  TEXTO_SUAVE,
  T_AIRE,
  colorP,
  resorteHorizontal,
} from './comunes'

interface PropsCilindro {
  /** 0 = retraído, 1 = extendido. */
  posicion: number
  /** Presión por puerto en bar. */
  presiones: Record<string, number>
  /** Muestra los nombres de las piezas (émbolo, muelle, vástago…). */
  nombres?: boolean
}

function Nombre({ x, y, texto, anchor = 'middle' }: { x: number; y: number; texto: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} fontSize={11} fill={TEXTO_SUAVE} textAnchor={anchor} fontFamily="inherit">
      {texto}
    </text>
  )
}

function Guia({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={TEXTO_SUAVE} strokeWidth={0.8} />
}

// ===========================================================================
// Cilindro de simple efecto: un solo orificio; el aire entra y empuja el
// émbolo comprimiendo el muelle. Al despresurizar, el muelle lo devuelve.
// ===========================================================================
const X0 = 60 // cara interior del fondo
const X1 = 330 // cara interior de la tapa delantera
const CY = 120 // eje del cilindro
const RY = 42 // radio interior

export function CorteCilindroSimple({ posicion, presiones, nombres = true }: PropsCilindro) {
  const carrera = X1 - X0 - 100
  const px = X0 + posicion * carrera // cara trasera del émbolo
  const p1 = presiones['1']
  const conPresion = (p1 ?? 0) > 0.1

  return (
    <svg viewBox="0 0 420 210" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* cuerpo exterior */}
      <path
        d={`M30,${CY - RY - 26} H${X1 + 30} v${(RY + 26) * 2} H30 Z`}
        fill={CUERPO_CIL}
        stroke={CUERPO_CIL_BORDE}
        strokeWidth={2}
      />
      {/* camisa interior (hueco) */}
      <rect x={X0} y={CY - RY} width={X1 - X0} height={RY * 2} fill="#f3f5f7" />

      {/* cámara de trabajo: aire a presión */}
      <rect
        x={X0}
        y={CY - RY}
        width={px - X0}
        height={RY * 2}
        fill={conPresion ? AZUL_PRESION : CELESTE_ATM}
        style={{ transition: T_AIRE }}
      />

      {/* orificio único de entrada y salida de aire */}
      <rect x={44} y={CY - RY - 26} width={16} height={30} fill={colorP(p1)} style={{ transition: T_AIRE }} />
      <rect x={40} y={CY - RY - 34} width={24} height={10} fill={METAL} stroke={CUERPO_CIL_BORDE} strokeWidth={1} />

      {/* muelle de retorno (se comprime al avanzar) */}
      <path
        d={resorteHorizontal(px + 26, X1 - 6, CY, 30, 7)}
        fill="none"
        stroke={METAL_OSCURO}
        strokeWidth={2.6}
        strokeLinecap="round"
      />

      {/* conjunto móvil: émbolo + vástago */}
      <g style={{ transition: 'transform 90ms linear' }}>
        {/* émbolo */}
        <rect x={px} y={CY - RY} width={26} height={RY * 2} rx={2} fill={METAL_CLARO} stroke={METAL_OSCURO} strokeWidth={1.5} />
        <rect x={px + 1} y={CY - RY} width={5} height={RY * 2} fill={JUNTA} />
        <rect x={px + 20} y={CY - RY} width={5} height={RY * 2} fill={JUNTA} />
        {/* vástago */}
        <rect x={px + 26} y={CY - 9} width={X1 + 62 - (px + 26)} height={18} fill={METAL} stroke={METAL_OSCURO} strokeWidth={1.2} />
      </g>

      {/* tapa delantera con casquillo guía */}
      <rect x={X1} y={CY - RY - 26} width={30} height={(RY + 26) * 2} fill={CUERPO_CIL} stroke={CUERPO_CIL_BORDE} strokeWidth={2} />
      <rect x={X1} y={CY - 14} width={30} height={28} fill={METAL_CLARO} stroke={METAL_OSCURO} strokeWidth={1.2} />

      {nombres && (
        <g>
          <Guia x1={52} y1={CY - RY - 40} x2={52} y2={CY - RY - 34} />
          <Nombre x={52} y={CY - RY - 46} texto="Entrada y salida de aire" anchor="start" />
          <Guia x1={px + 13} y1={CY + RY} x2={px + 13} y2={CY + RY + 20} />
          <Nombre x={px + 13} y={CY + RY + 32} texto="Émbolo" />
          <Guia x1={(px + 26 + X1) / 2} y1={CY + 32} x2={(px + 26 + X1) / 2} y2={CY + RY + 20} />
          <Nombre x={(px + 26 + X1) / 2} y={CY + RY + 32} texto="Muelle" />
          <Guia x1={X1 + 46} y1={CY + 10} x2={X1 + 46} y2={CY + RY + 20} />
          <Nombre x={X1 + 46} y={CY + RY + 32} texto="Vástago" anchor="end" />
        </g>
      )}
    </svg>
  )
}

// ===========================================================================
// Cilindro de doble efecto: dos orificios. El aire entra por un lado y sale
// por el otro; el émbolo es empujado en ambos sentidos (no hay muelle).
// ===========================================================================
export function CorteCilindroDoble({ posicion, presiones, nombres = true }: PropsCilindro) {
  const carrera = X1 - X0 - 100
  const px = X0 + posicion * carrera
  const pA = presiones['A']
  const pB = presiones['B']

  return (
    <svg viewBox="0 0 420 210" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <path
        d={`M30,${CY - RY - 26} H${X1 + 30} v${(RY + 26) * 2} H30 Z`}
        fill={CUERPO_CIL}
        stroke={CUERPO_CIL_BORDE}
        strokeWidth={2}
      />
      <rect x={X0} y={CY - RY} width={X1 - X0} height={RY * 2} fill="#f3f5f7" />

      {/* cámara trasera (A) y delantera (B) */}
      <rect
        x={X0}
        y={CY - RY}
        width={px - X0}
        height={RY * 2}
        fill={colorP(pA)}
        style={{ transition: T_AIRE }}
      />
      <rect
        x={px + 26}
        y={CY - RY}
        width={X1 - (px + 26)}
        height={RY * 2}
        fill={colorP(pB)}
        style={{ transition: T_AIRE }}
      />

      {/* orificios A y B */}
      <rect x={44} y={CY - RY - 26} width={16} height={30} fill={colorP(pA)} style={{ transition: T_AIRE }} />
      <rect x={40} y={CY - RY - 34} width={24} height={10} fill={METAL} stroke={CUERPO_CIL_BORDE} strokeWidth={1} />
      <rect x={X1 - 60} y={CY - RY - 26} width={16} height={30} fill={colorP(pB)} style={{ transition: T_AIRE }} />
      <rect x={X1 - 64} y={CY - RY - 34} width={24} height={10} fill={METAL} stroke={CUERPO_CIL_BORDE} strokeWidth={1} />
      <text x={52} y={CY - RY - 40} fontSize={13} fontWeight={700} fill="#33475c" textAnchor="middle">A</text>
      <text x={X1 - 52} y={CY - RY - 40} fontSize={13} fontWeight={700} fill="#33475c" textAnchor="middle">B</text>

      {/* conjunto móvil */}
      <g>
        <rect x={px} y={CY - RY} width={26} height={RY * 2} rx={2} fill={METAL_CLARO} stroke={METAL_OSCURO} strokeWidth={1.5} />
        <rect x={px + 1} y={CY - RY} width={5} height={RY * 2} fill={JUNTA} />
        <rect x={px + 20} y={CY - RY} width={5} height={RY * 2} fill={JUNTA} />
        <rect x={px + 26} y={CY - 9} width={X1 + 62 - (px + 26)} height={18} fill={METAL} stroke={METAL_OSCURO} strokeWidth={1.2} />
      </g>

      <rect x={X1} y={CY - RY - 26} width={30} height={(RY + 26) * 2} fill={CUERPO_CIL} stroke={CUERPO_CIL_BORDE} strokeWidth={2} />
      <rect x={X1} y={CY - 14} width={30} height={28} fill={METAL_CLARO} stroke={METAL_OSCURO} strokeWidth={1.2} />

      {nombres && (
        <g>
          <Guia x1={px + 13} y1={CY + RY} x2={px + 13} y2={CY + RY + 20} />
          <Nombre x={px + 13} y={CY + RY + 32} texto="Émbolo" />
          <Guia x1={X1 + 46} y1={CY + 10} x2={X1 + 46} y2={CY + RY + 20} />
          <Nombre x={X1 + 46} y={CY + RY + 32} texto="Vástago" anchor="end" />
        </g>
      )}
    </svg>
  )
}
