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
// Elementos normalizados ISO 1219-1 que se repiten en varios símbolos. Van
// marcados con `data-iso` para que las pruebas puedan comprobar que cada
// válvula lleva las vías y los bloqueos que le corresponden.
// ---------------------------------------------------------------------------

/**
 * Vía bloqueada (ISO 1219-1): el puerto se cierra con un trazo en T dentro de
 * la casilla. Toda posición de una válvula tiene que representar TODOS sus
 * puertos: los que comunican, con su flecha, y los que no, con este bloqueo.
 */
function Bloqueo({ x, y, hacia = 'abajo' }: { x: number; y: number; hacia?: 'abajo' | 'arriba' }) {
  const signo = hacia === 'abajo' ? 1 : -1
  return (
    <g data-iso="bloqueo">
      <line x1={x} y1={y} x2={x} y2={y - 9 * signo} {...TRAZO} strokeWidth={2} />
      <line x1={x - 7} y1={y - 9 * signo} x2={x + 7} y2={y - 9 * signo} {...TRAZO} strokeWidth={2} />
    </g>
  )
}

/**
 * Pilotaje neumático (ISO 1219-1): triángulo hueco apuntando hacia la válvula.
 * No es un rectángulo con una diagonal —ése es el accionamiento manual
 * general—: el triángulo es lo que identifica que la señal es de aire.
 */
function PilotajeNeumatico({
  xPuerto,
  xValvula,
  y,
  etiqueta,
}: {
  xPuerto: number
  xValvula: number
  y: number
  etiqueta: string
}) {
  const haciaDerecha = xValvula > xPuerto
  const s = haciaDerecha ? 1 : -1
  const base = xPuerto + 14 * s
  const punta = base + 14 * s
  return (
    <g data-iso="pilotaje">
      <line x1={xPuerto} y1={y} x2={base} y2={y} {...TRAZO} strokeWidth={1.8} />
      <polygon
        points={`${base},${y - 8} ${base},${y + 8} ${punta},${y}`}
        {...TRAZO}
        strokeWidth={1.8}
        fill="#fff"
      />
      <line x1={punta} y1={y} x2={xValvula} y2={y} {...TRAZO} strokeWidth={1.8} />
      <Etiqueta x={(base + punta) / 2} y={y - 13} texto={etiqueta} />
    </g>
  )
}

/**
 * Pulsador (ISO 1219-1): vástago con cabeza redondeada apoyado en la válvula.
 * Se colorea al accionarlo, que es información de la simulación, no del
 * símbolo.
 */
function Pulsador({
  xCabeza,
  xValvula,
  y,
  accionado,
}: {
  xCabeza: number
  xValvula: number
  y: number
  accionado: boolean
}) {
  const s = xValvula > xCabeza ? 1 : -1
  return (
    <g data-iso="pulsador">
      <line x1={xCabeza} y1={y} x2={xValvula} y2={y} {...TRAZO} strokeWidth={1.8} />
      <line x1={xCabeza} y1={y - 8} x2={xCabeza} y2={y + 8} {...TRAZO} strokeWidth={1.8} />
      <path
        d={`M${xCabeza},${y - 8} a 8 8 0 0 ${s > 0 ? 0 : 1} 0,16`}
        {...TRAZO}
        strokeWidth={1.8}
        fill={accionado ? '#12a35a' : '#fff'}
      />
    </g>
  )
}

/** Muelle de retorno (ISO 1219-1). */
function Muelle({ x, y, hacia = 'derecha' }: { x: number; y: number; hacia?: 'derecha' | 'izquierda' }) {
  const s = hacia === 'derecha' ? 1 : -1
  return (
    <path
      data-iso="muelle"
      d={`M${x},${y} l${6 * s},-7 l${6 * s},14 l${6 * s},-14 l${6 * s},14 l${4 * s},-7`}
      {...TRAZO}
      strokeWidth={1.6}
    />
  )
}

/** Palanca con rodillo (ISO 1219-1): el vástago del cilindro lo pisa. */
function Rodillo({ x, y, accionado }: { x: number; y: number; accionado: boolean }) {
  return (
    <g data-iso="rodillo">
      <line x1={x} y1={y} x2={x + 8} y2={y} {...TRAZO} strokeWidth={1.8} />
      <line x1={x} y1={y} x2={x} y2={y - 15} {...TRAZO} strokeWidth={1.8} />
      <circle cx={x} cy={y - 22} r={7} {...TRAZO} strokeWidth={1.8} fill={accionado ? '#12a35a' : '#fff'} />
    </g>
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
      {/* Compresor (ISO 1219-1): círculo con el triángulo macizo apuntando en
          el sentido del flujo, o sea hacia la salida. */}
      <polygon points="30,38 30,58 51,48" fill="#14181d" stroke="none" />
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
        <Rodillo x={22} y={55} accionado={accionada} />
      ) : (
        <Pulsador xCabeza={16} xValvula={30} y={55} accionado={accionada} />
      )}
      <Muelle x={110} y={55} />
      {/* corredera: dos posiciones que se desplazan al conmutar */}
      <g transform={`translate(${dx} 0)`} style={{ transition: TRANSICION_CORREDERA }}>
        {/* caja izquierda = posición accionada */}
        <rect x={30} y={35} width={40} height={40} {...TRAZO} fill="#fff" />
        {na ? (
          <>
            {/* NA accionada: 2→3, 1 bloqueado */}
            <g data-iso="via">
              <line x1={50} y1={37} x2={60} y2={73} {...TRAZO} strokeWidth={2} />
              <Flecha x={59} y={70} angulo={165} />
            </g>
            <Bloqueo x={40} y={75} />
          </>
        ) : (
          <>
            {/* NC accionada: 1→2, 3 bloqueado */}
            <g data-iso="via">
              <line x1={40} y1={73} x2={50} y2={37} {...TRAZO} strokeWidth={2} />
              <Flecha x={50} y={40} angulo={15} />
            </g>
            <Bloqueo x={60} y={75} />
          </>
        )}
        {/* caja derecha = posición de reposo */}
        <rect x={70} y={35} width={40} height={40} {...TRAZO} fill="#fff" />
        {na ? (
          <>
            {/* NA reposo: 1→2, 3 bloqueado */}
            <g data-iso="via">
              <line x1={80} y1={73} x2={90} y2={37} {...TRAZO} strokeWidth={2} />
              <Flecha x={90} y={40} angulo={15} />
            </g>
            <Bloqueo x={100} y={75} />
          </>
        ) : (
          <>
            {/* NC reposo: 2→3, 1 bloqueado */}
            <g data-iso="via">
              <path d="M90,37 L90,55 L100,55 L100,73" {...TRAZO} strokeWidth={2} />
              <Flecha x={100} y={70} angulo={180} />
            </g>
            <Bloqueo x={80} y={75} />
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
        <PilotajeNeumatico xPuerto={0} xValvula={40} y={55} etiqueta="14" />
      ) : (
        <Pulsador xCabeza={22} xValvula={40} y={55} accionado={accionada} />
      )}
      {/* accionamiento derecho: pilotaje 12 (biestable) o muelle */}
      {biestable ? (
        <PilotajeNeumatico xPuerto={190} xValvula={140} y={55} etiqueta="12" />
      ) : (
        <Muelle x={142} y={55} />
      )}

      {/* corredera */}
      <g transform={`translate(${dx} 0)`} style={{ transition: TRANSICION_CORREDERA }}>
        {/* caja izquierda = accionada: 1→4, 2→3 y el escape 5 bloqueado */}
        <rect x={40} y={35} width={50} height={40} {...TRAZO} fill="#fff" />
        <g data-iso="via">
          <line x1={65} y1={73} x2={55} y2={37} {...TRAZO} strokeWidth={2} />
          <Flecha x={55.5} y={40} angulo={-15} />
        </g>
        <g data-iso="via">
          <line x1={75} y1={37} x2={85} y2={73} {...TRAZO} strokeWidth={2} />
          <Flecha x={84.5} y={70} angulo={165} />
        </g>
        <Bloqueo x={45} y={75} />
        {/* caja derecha = reposo: 1→2, 4→5 y el escape 3 bloqueado */}
        <rect x={90} y={35} width={50} height={40} {...TRAZO} fill="#fff" />
        <g data-iso="via">
          <line x1={115} y1={73} x2={125} y2={37} {...TRAZO} strokeWidth={2} />
          <Flecha x={124.5} y={40} angulo={15} />
        </g>
        <g data-iso="via">
          <line x1={105} y1={37} x2={95} y2={73} {...TRAZO} strokeWidth={2} />
          <Flecha x={95.5} y={70} angulo={195} />
        </g>
        <Bloqueo x={135} y={75} />
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
        <PilotajeNeumatico xPuerto={0} xValvula={40} y={55} etiqueta="14" />
      ) : (
        <Pulsador xCabeza={22} xValvula={40} y={55} accionado={accionada} />
      )}
      {/* accionamiento derecho */}
      {biestable ? (
        <PilotajeNeumatico xPuerto={180} xValvula={140} y={55} etiqueta="12" />
      ) : (
        <Muelle x={142} y={55} />
      )}

      {/* corredera */}
      <g transform={`translate(${dx} 0)`} style={{ transition: TRANSICION_CORREDERA }}>
        {/* caja izquierda = accionada: 1→4 y 2→3 (rectas) */}
        <rect x={40} y={35} width={50} height={40} {...TRAZO} fill="#fff" />
        <g data-iso="via">
          <line x1={55} y1={73} x2={55} y2={39} {...TRAZO} strokeWidth={2} />
          <Flecha x={55} y={41} angulo={0} />
        </g>
        <g data-iso="via">
          <line x1={75} y1={37} x2={75} y2={71} {...TRAZO} strokeWidth={2} />
          <Flecha x={75} y={69} angulo={180} />
        </g>
        {/* caja derecha = reposo: 1→2 y 4→3 (cruzadas) */}
        <rect x={90} y={35} width={50} height={40} {...TRAZO} fill="#fff" />
        <g data-iso="via">
          <line x1={105} y1={73} x2={125} y2={39} {...TRAZO} strokeWidth={2} />
          <Flecha x={124} y={41} angulo={30} />
        </g>
        <g data-iso="via">
          <line x1={105} y1={37} x2={125} y2={71} {...TRAZO} strokeWidth={2} />
          <Flecha x={124} y={69} angulo={150} />
        </g>
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
      <rect
        x={px + 6}
        y={36}
        width={Math.max(4, 130 + pos * 60 - (px + 6))}
        height={8}
        {...TRAZO}
        strokeWidth={1.8}
        fill="#fff"
      />
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
    </g>
  )
}

// ---------------------------------------------------------------------------
export function SimboloCilindroDoble({ vivo }: PropsSimbolo) {
  const pos = vivo?.posicion ?? 0
  const px = 24 + pos * 80
  return (
    <g>
      {/* camisa, émbolo y vástago. Los puertos de un actuador no se rotulan:
          se identifican por la vía de la válvula que los alimenta (4 y 2). */}
      <rect x={20} y={25} width={110} height={30} {...TRAZO} fill="#fff" />
      <rect x={px} y={27} width={6} height={26} fill="#14181d" />
      <rect
        x={px + 6}
        y={36}
        width={Math.max(4, 140 + pos * 80 - (px + 6))}
        height={8}
        {...TRAZO}
        strokeWidth={1.8}
        fill="#fff"
      />
      <line x1={30} y1={55} x2={30} y2={77} {...TRAZO} />
      <line x1={120} y1={55} x2={120} y2={77} {...TRAZO} />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Actuador giratorio (unidad de volteo): cuerpo con eje y doble flecha curva.
// El indicador de posición gira con la simulación.
export function SimboloActuadorGiratorio({ params, vivo }: PropsSimbolo) {
  const pos = vivo?.posicion ?? 0
  const angulo = Number(params.angulo ?? 180)
  const giro = pos * angulo
  // Cúpula con base plana, eje saliendo por arriba y paleta que gira con la
  // simulación: es el símbolo normalizado de la unidad oscilante, no un
  // indicador de aguja.
  const cx = 65
  const base = 82
  const r = 32
  return (
    <g>
      <line x1={cx - 3} y1={base - r} x2={cx - 3} y2={22} {...TRAZO} strokeWidth={1.8} />
      <line x1={cx + 3} y1={base - r} x2={cx + 3} y2={22} {...TRAZO} strokeWidth={1.8} />
      <path
        d={`M${cx - r},${base} A${r},${r} 0 0 1 ${cx + r},${base} Z`}
        {...TRAZO}
        fill="#fff"
      />
      {/* paleta: gira con el eje */}
      <g transform={`rotate(${giro} ${cx} ${base})`} style={{ transition: 'transform 120ms linear' }}>
        <line x1={cx} y1={base} x2={cx} y2={base - r + 6} stroke="#1668c7" strokeWidth={3.4} strokeLinecap="round" />
      </g>
      {/* sentido de giro */}
      <path d={`M${cx - 18},${base - 14} A22,22 0 0 1 ${cx + 6},${base - 25}`} {...TRAZO} strokeWidth={1.6} />
      <polygon points={`${cx + 6},${base - 25} ${cx - 1},${base - 27} ${cx + 1},${base - 19}`} fill="#14181d" stroke="none" />
      {/* conexiones a puertos: sin rótulo, como cualquier actuador */}
      <line x1={45} y1={base} x2={45} y2={97} {...TRAZO} />
      <line x1={85} y1={base} x2={85} y2={97} {...TRAZO} />
    </g>
  )
}

// ---------------------------------------------------------------------------
export function SimboloMotorNeumatico({ vivo }: PropsSimbolo) {
  const girando = vivo?.accionada ?? false
  const angulo = (vivo?.posicion ?? 0) * 360
  return (
    <g>
      <line x1={45} y1={70} x2={45} y2={97} {...TRAZO} />
      <circle cx={45} cy={40} r={30} {...TRAZO} />
      <g transform={`rotate(${angulo} 45 40)`}>
        <line x1={45} y1={16} x2={45} y2={64} {...TRAZO} strokeWidth={1.6} />
        <line x1={21} y1={40} x2={69} y2={40} {...TRAZO} strokeWidth={1.6} />
      </g>
      <circle cx={45} cy={40} r={5} fill="#14181d" />
      <Etiqueta x={45} y={93} texto={girando ? 'girando' : 'motor'} />
    </g>
  )
}

// ---------------------------------------------------------------------------
export function SimboloSensorGiro({ vivo }: PropsSimbolo) {
  const activo = vivo?.accionada ?? false
  return (
    <g>
      <line x1={90} y1={35} x2={90} y2={3} {...TRAZO} />
      <line x1={80} y1={75} x2={80} y2={97} {...TRAZO} />
      <line x1={100} y1={75} x2={100} y2={97} {...TRAZO} />
      <Etiqueta x={99} y={12} texto="2" />
      <Etiqueta x={71} y={93} texto="1" />
      <Etiqueta x={109} y={93} texto="3" />
      <rect x={30} y={35} width={80} height={40} {...TRAZO} fill={activo ? '#e7f7ef' : '#fff'} />
      <circle cx={70} cy={55} r={9} {...TRAZO} strokeWidth={1.8} fill={activo ? '#12a35a' : '#fff'} />
      {activo && (
        <>
          <path d="M84,55 a14,14 0 0 0 -4,-10" {...TRAZO} strokeWidth={1.4} />
          <path d="M56,55 a14,14 0 0 1 4,10" {...TRAZO} strokeWidth={1.4} />
        </>
      )}
      <Etiqueta x={70} y={30} texto="sensor de paso" />
    </g>
  )
}

// ---------------------------------------------------------------------------
// FRL como componente independiente (sin compresor): así se ve en el control,
// donde se pregunta por separado de la fuente de aire.
// ---------------------------------------------------------------------------
export function SimboloFRL() {
  return (
    <g>
      <line x1={0} y1={40} x2={14} y2={40} {...TRAZO} />
      <line x1={86} y1={40} x2={100} y2={40} {...TRAZO} />
      <rect x={14} y={14} width={72} height={52} {...TRAZO} fill="#fff" />
      <line x1={50} y1={14} x2={50} y2={66} {...TRAZO} strokeWidth={1.6} />
      <circle cx={30} cy={40} r={10} {...TRAZO} strokeWidth={1.6} />
      <line x1={30} y1={32} x2={30} y2={48} {...TRAZO} strokeWidth={1.4} />
      <circle cx={68} cy={30} r={8} {...TRAZO} strokeWidth={1.4} fill="#fff" />
      <line x1={68} y1={30} x2={72} y2={25} stroke="#b3261e" strokeWidth={1.4} />
      <path d="M60,52 l16,0 l-4,-5 M76,52 l-4,5" {...TRAZO} strokeWidth={1.4} />
      <Etiqueta x={50} y={78} texto="FRL" />
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
// Manómetro: instrumento pasivo que cuelga de una línea y marca la presión
// estática de su puerto 1. Sin estado interno propio; la aguja sigue a `presion`.
// ---------------------------------------------------------------------------
export function SimboloManometro({ params, vivo }: PropsSimbolo) {
  const presion = vivo?.presion ?? Number(params.presion ?? 0)
  const valor = Math.max(0, Math.min(10, presion))
  // Aguja: -120° (0 bar) a +60° (10 bar), como en el manómetro de la fuente.
  const angulo = -120 + valor * 18
  return (
    <g>
      <line x1={40} y1={60} x2={40} y2={97} {...TRAZO} strokeWidth={1.6} />
      <circle cx={43} cy={45} r={30} {...TRAZO} fill="#fff" />
      {/* trazos de escala */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => {
        const a = ((-120 + bar * 18 - 90) * Math.PI) / 180
        return (
          <line
            key={bar}
            x1={43 + (bar % 5 === 0 ? 24 : 26) * Math.cos(a)}
            y1={45 + (bar % 5 === 0 ? 24 : 26) * Math.sin(a)}
            x2={43 + 30 * Math.cos(a)}
            y2={45 + 30 * Math.sin(a)}
            {...TRAZO}
            strokeWidth={bar % 5 === 0 ? 1.8 : 1.2}
          />
        )
      })}
      {/* aguja */}
      <g style={{ transition: 'transform 200ms' }} transform={`rotate(${angulo} 43 45)`}>
        <line x1={43} y1={45} x2={43} y2={20} stroke="#b3261e" strokeWidth={2} strokeLinecap="round" />
      </g>
      <circle cx={43} cy={45} r={3} fill="#14181d" />
      <Etiqueta x={43} y={84} texto={`${presion.toFixed(1)} bar`} />
    </g>
  )
}

// ---------------------------------------------------------------------------
export function SimboloPieza({ tipo, params, vivo }: { tipo: string } & PropsSimbolo) {
  switch (tipo) {
    case 'fuente':
      return <SimboloFuente params={params} vivo={vivo} />
    case 'manometro':
      return <SimboloManometro params={params} vivo={vivo} />
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
    case 'actuadorGiratorio':
      return <SimboloActuadorGiratorio params={params} vivo={vivo} />
    case 'reguladorCaudal':
      return <SimboloRegulador params={params} vivo={vivo} />
    case 'motorNeumatico':
      return <SimboloMotorNeumatico params={params} vivo={vivo} />
    case 'sensorGiro':
      return <SimboloSensorGiro params={params} vivo={vivo} />
    default:
      return null
  }
}
