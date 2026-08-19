/**
 * Símbolos ISO 1219-1 dibujados en SVG, con animación de estado:
 *  - las correderas de las válvulas se desplazan al conmutar,
 *  - los pistones de los cilindros siguen la posición del vástago,
 *  - el manómetro de la fuente indica presión.
 * Se dibujan en coordenadas locales del azulejo (ver descriptores.ts).
 */
import type { Params } from '../engine'

export interface EstadoVivo {
  accionada?: boolean
  posicion?: number
  encendida?: boolean
  presion?: number
  /** Entrada seleccionada en las válvulas lógicas O / Y. */
  lado?: 'X' | 'Y'
  /** La válvula de escape rápido está purgando el actuador. */
  purgando?: boolean
}

interface PropsSimbolo {
  params: Params
  vivo?: EstadoVivo | null
}

const TRAZO = {
  stroke: '#14181d',
  strokeWidth: 2.2,
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const TRANSICION_CORREDERA = 'transform 100ms ease-out'

function Flecha({ x, y, angulo }: { x: number; y: number; angulo: number }) {
  return (
    <polygon
      points="0,-6 4.5,4 -4.5,4"
      transform={`translate(${x} ${y}) rotate(${angulo})`}
      fill="#14181d"
      stroke="none"
    />
  )
}

function Etiqueta({ x, y, texto }: { x: number; y: number; texto: string }) {
  return (
    <text x={x} y={y} fontSize={9} fill="#6a7683" textAnchor="middle" fontFamily="inherit">
      {texto}
    </text>
  )
}

// ---------------------------------------------------------------------------
export function SimboloFuente({ params, vivo }: PropsSimbolo) {
  const encendida = vivo ? (vivo.encendida ?? true) : ((params.encendida as boolean) ?? true)
  const presion = Number(params.presion ?? 6)
  // Aguja del manómetro: -120° (0 bar) a 60° (10 bar)
  const angulo = -120 + (encendida ? presion : 0) * 18
  return (
    <g>
      <circle cx={38} cy={48} r={19} {...TRAZO} />
      {/* triángulo de fuente de presión dentro del círculo */}
      <polygon points="38,36 48,54 28,54" fill="#14181d" stroke="none" />
      <line x1={57} y1={48} x2={90} y2={48} {...TRAZO} />
      {/* manómetro */}
      <line x1={70} y1={48} x2={70} y2={30} {...TRAZO} strokeWidth={1.6} />
      <circle cx={70} cy={22} r={8} {...TRAZO} strokeWidth={1.6} fill="#fff" />
      <line
        x1={70}
        y1={22}
        x2={70 + 6 * Math.cos(((angulo - 90) * Math.PI) / 180)}
        y2={22 + 6 * Math.sin(((angulo - 90) * Math.PI) / 180)}
        stroke={encendida ? '#b3261e' : '#8a97a5'}
        strokeWidth={1.6}
        style={{ transition: 'all 200ms' }}
      />
      <Etiqueta x={38} y={80} texto={encendida ? `FRL · ${presion.toFixed(1)} bar` : 'FRL · sin aire'} />
    </g>
  )
}

// ---------------------------------------------------------------------------
export function SimboloValvula32({ params, vivo }: PropsSimbolo) {
  const na = params.reposo === 'NA'
  const accionada = vivo?.accionada ?? false
  const dx = accionada ? 40 : 0
  return (
    <g>
      {/* conexiones fijas del cuerpo a los puertos */}
      <line x1={90} y1={35} x2={90} y2={3} {...TRAZO} />
      <line x1={80} y1={75} x2={80} y2={97} {...TRAZO} />
      <line x1={100} y1={75} x2={100} y2={97} {...TRAZO} />
      <Etiqueta x={99} y={12} texto="2" />
      <Etiqueta x={71} y={93} texto="1" />
      <Etiqueta x={109} y={93} texto="3" />
      {/* accionamientos fijos: mando a la izquierda, muelle a la derecha */}
      {params.accionamiento === 'rodillo' ? (
        <>
          {/* palanca con rodillo: lo pisa el vástago del cilindro */}
          <line x1={22} y1={55} x2={30} y2={55} {...TRAZO} strokeWidth={1.8} />
          <line x1={22} y1={55} x2={22} y2={40} {...TRAZO} strokeWidth={1.8} />
          <circle cx={22} cy={33} r={7} {...TRAZO} strokeWidth={1.8} fill={accionada ? '#12a35a' : '#fff'} />
        </>
      ) : (
        <>
          <line x1={20} y1={55} x2={30} y2={55} {...TRAZO} strokeWidth={1.8} />
          <circle cx={14} cy={55} r={6} {...TRAZO} strokeWidth={1.8} fill={accionada ? '#12a35a' : '#fff'} />
        </>
      )}
      <path d="M110,55 l6,-7 l6,14 l6,-14 l6,14 l4,-7" {...TRAZO} strokeWidth={1.6} />
      {/* corredera: dos posiciones que se desplazan al conmutar */}
      <g transform={`translate(${dx} 0)`} style={{ transition: TRANSICION_CORREDERA }}>
        {/* caja izquierda = posición accionada */}
        <rect x={30} y={35} width={40} height={40} {...TRAZO} fill="#fff" />
        {na ? (
          <>
            {/* NA accionada: 2→3, 1 bloqueado */}
            <line x1={50} y1={37} x2={60} y2={73} {...TRAZO} strokeWidth={2} />
            <Flecha x={59} y={70} angulo={165} />
            <line x1={40} y1={75} x2={40} y2={66} {...TRAZO} strokeWidth={2} />
            <line x1={33} y1={66} x2={47} y2={66} {...TRAZO} strokeWidth={2} />
          </>
        ) : (
          <>
            {/* NC accionada: 1→2, 3 bloqueado */}
            <line x1={40} y1={73} x2={50} y2={37} {...TRAZO} strokeWidth={2} />
            <Flecha x={50} y={40} angulo={15} />
            <line x1={60} y1={75} x2={60} y2={66} {...TRAZO} strokeWidth={2} />
            <line x1={53} y1={66} x2={67} y2={66} {...TRAZO} strokeWidth={2} />
          </>
        )}
        {/* caja derecha = posición de reposo */}
        <rect x={70} y={35} width={40} height={40} {...TRAZO} fill="#fff" />
        {na ? (
          <>
            {/* NA reposo: 1→2, 3 bloqueado */}
            <line x1={80} y1={73} x2={90} y2={37} {...TRAZO} strokeWidth={2} />
            <Flecha x={90} y={40} angulo={15} />
            <line x1={100} y1={75} x2={100} y2={66} {...TRAZO} strokeWidth={2} />
            <line x1={93} y1={66} x2={107} y2={66} {...TRAZO} strokeWidth={2} />
          </>
        ) : (
          <>
            {/* NC reposo: 2→3, 1 bloqueado */}
            <path d="M90,37 L90,55 L100,55 L100,73" {...TRAZO} strokeWidth={2} />
            <Flecha x={100} y={70} angulo={180} />
            <line x1={80} y1={75} x2={80} y2={66} {...TRAZO} strokeWidth={2} />
            <line x1={73} y1={66} x2={87} y2={66} {...TRAZO} strokeWidth={2} />
          </>
        )}
      </g>
    </g>
  )
}

// ---------------------------------------------------------------------------
export function SimboloValvula52({ params, vivo }: PropsSimbolo) {
  const biestable = params.modo === 'biestable'
  const pilotaje = biestable || params.accionamiento === 'pilotaje'
  const accionada = vivo?.accionada ?? false
  const dx = accionada ? 50 : 0
  return (
    <g>
      {/* conexiones fijas a puertos */}
      <line x1={105} y1={35} x2={105} y2={3} {...TRAZO} />
      <line x1={125} y1={35} x2={125} y2={3} {...TRAZO} />
      <line x1={95} y1={75} x2={95} y2={107} {...TRAZO} />
      <line x1={115} y1={75} x2={115} y2={107} {...TRAZO} />
      <line x1={135} y1={75} x2={135} y2={107} {...TRAZO} />
      <Etiqueta x={97} y={12} texto="4" />
      <Etiqueta x={133} y={12} texto="2" />
      <Etiqueta x={87} y={102} texto="5" />
      <Etiqueta x={115} y={102} texto="1" />
      <Etiqueta x={143} y={102} texto="3" />

      {/* accionamiento izquierdo: pilotaje 14 o pulsador */}
      {pilotaje ? (
        <>
          <rect x={12} y={46} width={24} height={18} {...TRAZO} strokeWidth={1.8} fill="#fff" />
          <line x1={14} y1={62} x2={34} y2={48} {...TRAZO} strokeWidth={1.4} />
          <line x1={3} y1={55} x2={12} y2={55} {...TRAZO} strokeWidth={1.8} />
          <Etiqueta x={24} y={42} texto="14" />
        </>
      ) : (
        <>
          <line x1={26} y1={55} x2={38} y2={55} {...TRAZO} strokeWidth={1.8} />
          <circle cx={19} cy={55} r={6} {...TRAZO} strokeWidth={1.8} fill={accionada ? '#12a35a' : '#fff'} />
        </>
      )}
      {/* accionamiento derecho: pilotaje 12 (biestable) o muelle */}
      {biestable ? (
        <>
          <rect x={154} y={46} width={24} height={18} {...TRAZO} strokeWidth={1.8} fill="#fff" />
          <line x1={156} y1={62} x2={176} y2={48} {...TRAZO} strokeWidth={1.4} />
          <line x1={178} y1={55} x2={187} y2={55} {...TRAZO} strokeWidth={1.8} />
          <Etiqueta x={166} y={42} texto="12" />
        </>
      ) : (
        <path d="M142,55 l6,-7 l6,14 l6,-14 l6,14 l4,-7" {...TRAZO} strokeWidth={1.6} />
      )}

      {/* corredera */}
      <g transform={`translate(${dx} 0)`} style={{ transition: TRANSICION_CORREDERA }}>
        {/* caja izquierda = accionada: 1→4 y 2→3 */}
        <rect x={40} y={35} width={50} height={40} {...TRAZO} fill="#fff" />
        <line x1={65} y1={73} x2={55} y2={37} {...TRAZO} strokeWidth={2} />
        <Flecha x={55.5} y={40} angulo={-15} />
        <line x1={75} y1={37} x2={85} y2={73} {...TRAZO} strokeWidth={2} />
        <Flecha x={84.5} y={70} angulo={165} />
        {/* caja derecha = reposo: 1→2 y 4→5 */}
        <rect x={90} y={35} width={50} height={40} {...TRAZO} fill="#fff" />
        <line x1={115} y1={73} x2={125} y2={37} {...TRAZO} strokeWidth={2} />
        <Flecha x={124.5} y={40} angulo={15} />
        <line x1={105} y1={37} x2={95} y2={73} {...TRAZO} strokeWidth={2} />
        <Flecha x={95.5} y={70} angulo={195} />
      </g>
    </g>
  )
}

// ---------------------------------------------------------------------------
// Válvula 4/2: dos vías de trabajo y un solo escape.
//   Reposo:    1→2 y 4→3  (conexiones cruzadas en el símbolo)
//   Accionada: 1→4 y 2→3  (conexiones rectas)
export function SimboloValvula42({ params, vivo }: PropsSimbolo) {
  const biestable = params.modo === 'biestable'
  const pilotaje = biestable || params.accionamiento === 'pilotaje'
  const accionada = vivo?.accionada ?? false
  const dx = accionada ? 50 : 0
  return (
    <g>
      {/* conexiones fijas a puertos */}
      <line x1={105} y1={35} x2={105} y2={3} {...TRAZO} />
      <line x1={125} y1={35} x2={125} y2={3} {...TRAZO} />
      <line x1={105} y1={75} x2={105} y2={107} {...TRAZO} />
      <line x1={125} y1={75} x2={125} y2={107} {...TRAZO} />
      <Etiqueta x={97} y={12} texto="4" />
      <Etiqueta x={133} y={12} texto="2" />
      <Etiqueta x={97} y={102} texto="1" />
      <Etiqueta x={133} y={102} texto="3" />

      {/* accionamiento izquierdo */}
      {pilotaje ? (
        <>
          <rect x={12} y={46} width={24} height={18} {...TRAZO} strokeWidth={1.8} fill="#fff" />
          <line x1={14} y1={62} x2={34} y2={48} {...TRAZO} strokeWidth={1.4} />
          <line x1={3} y1={55} x2={12} y2={55} {...TRAZO} strokeWidth={1.8} />
          <Etiqueta x={24} y={42} texto="14" />
        </>
      ) : (
        <>
          <line x1={26} y1={55} x2={38} y2={55} {...TRAZO} strokeWidth={1.8} />
          <circle cx={19} cy={55} r={6} {...TRAZO} strokeWidth={1.8} fill={accionada ? '#12a35a' : '#fff'} />
        </>
      )}
      {/* accionamiento derecho */}
      {biestable ? (
        <>
          <rect x={144} y={46} width={24} height={18} {...TRAZO} strokeWidth={1.8} fill="#fff" />
          <line x1={146} y1={62} x2={166} y2={48} {...TRAZO} strokeWidth={1.4} />
          <line x1={168} y1={55} x2={177} y2={55} {...TRAZO} strokeWidth={1.8} />
          <Etiqueta x={156} y={42} texto="12" />
        </>
      ) : (
        <path d="M142,55 l6,-7 l6,14 l6,-14 l6,14 l4,-7" {...TRAZO} strokeWidth={1.6} />
      )}

      {/* corredera */}
      <g transform={`translate(${dx} 0)`} style={{ transition: TRANSICION_CORREDERA }}>
        {/* caja izquierda = accionada: 1→4 y 2→3 (rectas) */}
        <rect x={40} y={35} width={50} height={40} {...TRAZO} fill="#fff" />
        <line x1={55} y1={73} x2={55} y2={39} {...TRAZO} strokeWidth={2} />
        <Flecha x={55} y={41} angulo={0} />
        <line x1={75} y1={37} x2={75} y2={71} {...TRAZO} strokeWidth={2} />
        <Flecha x={75} y={69} angulo={180} />
        {/* caja derecha = reposo: 1→2 y 4→3 (cruzadas) */}
        <rect x={90} y={35} width={50} height={40} {...TRAZO} fill="#fff" />
        <line x1={105} y1={73} x2={125} y2={39} {...TRAZO} strokeWidth={2} />
        <Flecha x={124} y={41} angulo={30} />
        <line x1={105} y1={37} x2={125} y2={71} {...TRAZO} strokeWidth={2} />
        <Flecha x={124} y={69} angulo={150} />
      </g>
    </g>
  )
}

// ---------------------------------------------------------------------------
export function SimboloCilindroSimple({ vivo }: PropsSimbolo) {
  const pos = vivo?.posicion ?? 0
  const px = 24 + pos * 60 // cara izquierda del pistón
  const finMuelle = 118
  const anchoMuelle = Math.max(10, finMuelle - (px + 6))
  const q = anchoMuelle / 4
  return (
    <g>
      <rect x={20} y={25} width={100} height={30} {...TRAZO} fill="#fff" />
      {/* pistón y vástago */}
      <rect x={px} y={27} width={6} height={26} fill="#14181d" />
      <line x1={px + 6} y1={40} x2={130 + pos * 60} y2={40} stroke="#14181d" strokeWidth={4} />
      {/* muelle de retorno (se comprime al avanzar) */}
      <path
        d={`M${px + 6},40 l${q / 2},-8 l${q},16 l${q},-16 l${q},16 l${q / 2},-8`}
        {...TRAZO}
        strokeWidth={1.6}
      />
      {/* respiradero delantero */}
      <line x1={112} y1={55} x2={112} y2={62} {...TRAZO} strokeWidth={1.6} />
      {/* conexión al puerto */}
      <line x1={30} y1={55} x2={30} y2={77} {...TRAZO} />
      <Etiqueta x={40} y={72} texto="1" />
    </g>
  )
}

// ---------------------------------------------------------------------------
export function SimboloCilindroDoble({ vivo }: PropsSimbolo) {
  const pos = vivo?.posicion ?? 0
  const px = 24 + pos * 80
  return (
    <g>
      <rect x={20} y={25} width={110} height={30} {...TRAZO} fill="#fff" />
      <rect x={px} y={27} width={6} height={26} fill="#14181d" />
      <line x1={px + 6} y1={40} x2={140 + pos * 80} y2={40} stroke="#14181d" strokeWidth={4} />
      <line x1={30} y1={55} x2={30} y2={77} {...TRAZO} />
      <line x1={120} y1={55} x2={120} y2={77} {...TRAZO} />
      <Etiqueta x={40} y={72} texto="A" />
      <Etiqueta x={110} y={72} texto="B" />
    </g>
  )
}

// ---------------------------------------------------------------------------
export function SimboloRegulador({ params }: PropsSimbolo) {
  const apertura = Number(params.apertura ?? 0.5)
  return (
    <g>
      <line x1={0} y1={35} x2={35} y2={35} {...TRAZO} />
      <line x1={65} y1={35} x2={100} y2={35} {...TRAZO} />
      <rect x={35} y={15} width={30} height={40} {...TRAZO} fill="#fff" />
      {/* estrangulador ajustable: flecha diagonal */}
      <line x1={40} y1={50} x2={60} y2={20} {...TRAZO} strokeWidth={1.8} />
      <Flecha x={59} y={22} angulo={33} />
      {/* antirretorno en paralelo (paso libre 2→1) */}
      <path d="M35,35 C35,62 65,62 65,35" {...TRAZO} strokeWidth={1.6} fill="none" />
      <circle cx={50} cy={62} r={4} fill="#14181d" />
      <line x1={42} y1={68} x2={58} y2={68} {...TRAZO} strokeWidth={1.6} />
      <Etiqueta x={8} y={28} texto="1" />
      <Etiqueta x={92} y={28} texto="2" />
      <Etiqueta x={50} y={12} texto={`${Math.round(apertura * 100)}%`} />
    </g>
  )
}


// ---------------------------------------------------------------------------
// Válvulas lógicas: selectora «O» (la bola sella la entrada sin presión) y de
// simultaneidad «Y» (hace falta señal en las dos entradas).
function SimboloLogica({ vivo, tipo }: PropsSimbolo & { tipo: 'O' | 'Y' }) {
  const lado = vivo?.lado
  const activo = (id: 'X' | 'Y') => (lado === id ? '#12a35a' : '#14181d')
  return (
    <g>
      <rect x={15} y={15} width={60} height={50} {...TRAZO} fill="#fff" />
      {/* conexiones a puertos */}
      <line x1={45} y1={15} x2={45} y2={3} {...TRAZO} />
      <line x1={25} y1={65} x2={25} y2={77} {...TRAZO} />
      <line x1={65} y1={65} x2={65} y2={77} {...TRAZO} />
      {tipo === 'O' ? (
        <>
          {/* asientos en V y bola: pasa la entrada con más presión */}
          <path d="M25,63 L45,45" {...TRAZO} strokeWidth={2} stroke={activo('X')} />
          <path d="M65,63 L45,45" {...TRAZO} strokeWidth={2} stroke={activo('Y')} />
          <line x1={45} y1={38} x2={45} y2={18} {...TRAZO} strokeWidth={2} />
          <circle cx={45} cy={42} r={7} fill="#14181d" />
        </>
      ) : (
        <>
          {/* la bola se coloca del lado de menor presión: cierra ese paso */}
          <line x1={25} y1={63} x2={25} y2={40} {...TRAZO} strokeWidth={2} stroke={activo('X')} />
          <line x1={65} y1={63} x2={65} y2={40} {...TRAZO} strokeWidth={2} stroke={activo('Y')} />
          <path d="M25,34 L45,34 L65,34" {...TRAZO} strokeWidth={2} />
          <line x1={45} y1={34} x2={45} y2={18} {...TRAZO} strokeWidth={2} />
          <circle cx={lado === 'Y' ? 65 : 25} cy={37} r={7} fill="#14181d" style={{ transition: 'cx 120ms' }} />
        </>
      )}
      <Etiqueta x={45} y={12} texto="A" />
      <Etiqueta x={16} y={76} texto="X" />
      <Etiqueta x={74} y={76} texto="Y" />
      <text x={45} y={34} fontSize={13} fontWeight={700} fill="#6a7683" textAnchor="middle">
        {tipo}
      </text>
    </g>
  )
}

export const SimboloValvulaO = (p: PropsSimbolo) => <SimboloLogica {...p} tipo="O" />
export const SimboloValvulaY = (p: PropsSimbolo) => <SimboloLogica {...p} tipo="Y" />

// ---------------------------------------------------------------------------
// Válvula de escape rápido: alimenta 1→2, y al caer la presión de entrada
// comunica 2 con el escape 3.
export function SimboloEscapeRapido({ vivo }: PropsSimbolo) {
  const purgando = vivo?.purgando ?? false
  return (
    <g>
      <rect x={20} y={20} width={60} height={40} {...TRAZO} fill="#fff" />
      <line x1={0} y1={40} x2={20} y2={40} {...TRAZO} />
      <line x1={80} y1={40} x2={100} y2={40} {...TRAZO} />
      <line x1={50} y1={20} x2={50} y2={6} {...TRAZO} />
      {/* obturador: tapa el escape o tapa la entrada */}
      <line
        x1={purgando ? 32 : 50}
        y1={purgando ? 28 : 26}
        x2={purgando ? 32 : 50}
        y2={purgando ? 52 : 26}
        {...TRAZO}
        strokeWidth={4}
        style={{ transition: 'all 120ms' }}
      />
      <path
        d="M42,52 L50,40 L58,52 Z"
        {...TRAZO}
        fill={purgando ? '#1668c7' : 'none'}
        strokeWidth={1.6}
      />
      <Etiqueta x={8} y={33} texto="1" />
      <Etiqueta x={92} y={33} texto="2" />
      <Etiqueta x={60} y={14} texto="3" />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Temporizador neumático: estrangulador + depósito que pilotan una 3/2 NC.
export function SimboloTemporizador({ params, vivo }: PropsSimbolo) {
  const accionada = vivo?.accionada ?? false
  const retardo = Number(params.retardo ?? 2)
  const dx = accionada ? 40 : 0
  return (
    <g>
      {/* conexiones fijas */}
      <line x1={110} y1={45} x2={110} y2={13} {...TRAZO} />
      <line x1={100} y1={85} x2={100} y2={107} {...TRAZO} />
      <line x1={120} y1={85} x2={120} y2={107} {...TRAZO} />
      <Etiqueta x={119} y={22} texto="2" />
      <Etiqueta x={91} y={103} texto="1" />
      <Etiqueta x={129} y={103} texto="3" />

      {/* estrangulador ajustable + depósito de aire = el retardo */}
      <line x1={3} y1={65} x2={16} y2={65} {...TRAZO} strokeWidth={1.8} />
      <Etiqueta x={10} y={58} texto="12" />
      <path d="M16,58 L28,72" {...TRAZO} strokeWidth={1.8} />
      <Flecha x={27} y={70} angulo={40} />
      <rect x={30} y={54} width={22} height={22} {...TRAZO} strokeWidth={1.6} fill="#fff" />
      <path d="M30,76 L52,76" {...TRAZO} strokeWidth={1.6} />
      <line x1={52} y1={65} x2={62} y2={65} {...TRAZO} strokeWidth={1.8} />
      <text x={41} y={48} fontSize={9} fill="#6a7683" textAnchor="middle">
        {retardo.toFixed(1)} s
      </text>

      {/* corredera de la 3/2 pilotada */}
      <g transform={`translate(${dx} 0)`} style={{ transition: TRANSICION_CORREDERA }}>
        <rect x={62} y={45} width={40} height={40} {...TRAZO} fill="#fff" />
        <line x1={72} y1={83} x2={82} y2={47} {...TRAZO} strokeWidth={2} />
        <Flecha x={82} y={50} angulo={15} />
        <line x1={92} y1={85} x2={92} y2={76} {...TRAZO} strokeWidth={2} />
        <line x1={85} y1={76} x2={99} y2={76} {...TRAZO} strokeWidth={2} />
        <rect x={102} y={45} width={40} height={40} {...TRAZO} fill="#fff" />
        <path d="M122,47 L122,65 L132,65 L132,83" {...TRAZO} strokeWidth={2} />
        <Flecha x={132} y={80} angulo={180} />
        <line x1={112} y1={85} x2={112} y2={76} {...TRAZO} strokeWidth={2} />
        <line x1={105} y1={76} x2={119} y2={76} {...TRAZO} strokeWidth={2} />
      </g>
      {/* muelle de reposición */}
      <path d="M144,65 l6,-7 l6,14 l6,-14 l6,14 l4,-7" {...TRAZO} strokeWidth={1.6} />
    </g>
  )
}

// ---------------------------------------------------------------------------
export function SimboloPieza({ tipo, params, vivo }: { tipo: string } & PropsSimbolo) {
  switch (tipo) {
    case 'fuente':
      return <SimboloFuente params={params} vivo={vivo} />
    case 'valvula32':
      return <SimboloValvula32 params={params} vivo={vivo} />
    case 'finalCarrera':
      return <SimboloValvula32 params={{ ...params, accionamiento: 'rodillo' }} vivo={vivo} />
    case 'valvulaO':
      return <SimboloValvulaO params={params} vivo={vivo} />
    case 'valvulaY':
      return <SimboloValvulaY params={params} vivo={vivo} />
    case 'escapeRapido':
      return <SimboloEscapeRapido params={params} vivo={vivo} />
    case 'temporizador':
      return <SimboloTemporizador params={params} vivo={vivo} />
    case 'valvula42':
      return <SimboloValvula42 params={params} vivo={vivo} />
    case 'valvula52':
      return <SimboloValvula52 params={params} vivo={vivo} />
    case 'cilindroSimpleEfecto':
      return <SimboloCilindroSimple params={params} vivo={vivo} />
    case 'cilindroDobleEfecto':
      return <SimboloCilindroDoble params={params} vivo={vivo} />
    case 'reguladorCaudal':
      return <SimboloRegulador params={params} vivo={vivo} />
    default:
      return null
  }
}
