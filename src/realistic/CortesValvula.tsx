/**
 * Vistas en corte de las válvulas distribuidoras, al estilo de las láminas
 * de clase: cuerpo gris de fundición, aire azul intenso = presión, celeste =
 * comunicado con la atmósfera, juntas rojas, muelle helicoidal y elementos
 * móviles (vástago de asiento / corredera) animados.
 *
 * El color de cada cámara se toma de las presiones REALES del motor, así el
 * corte nunca puede contradecir a la simulación.
 */
import {
  CUERPO,
  CUERPO_BORDE,
  JUNTA_ROJA,
  METAL,
  METAL_CLARO,
  METAL_OSCURO,
  NEUTRO,
  TEXTO,
  T_AIRE,
  T_MOVIL,
  colorP,
  resorteHorizontal,
  resorteVertical,
} from './comunes'

export interface PropsCorte {
  accionada: boolean
  /** Presión por puerto en bar (del motor, o heurística en modo editar). */
  presiones: Record<string, number>
}

const Etiqueta = ({ x, y, texto }: { x: number; y: number; texto: string }) => (
  <text x={x} y={y} fontSize={16} fontWeight={700} fill={TEXTO} textAnchor="middle" fontFamily="inherit">
    {texto}
  </text>
)

// ===========================================================================
// Válvula 3/2 de asiento. Un vástago rígido lleva dos juntas cuya separación
// es distinta a la de los asientos: por eso siempre hay un paso abierto y el
// otro cerrado. Al pulsar, el vástago baja: abre 1→2 y cierra 2→3.
// ===========================================================================
// Taladro ancho respecto al vástago: así se ve el aire a los lados y se
// entiende por dónde está pasando en cada posición.
const BORE_X = 106
const BORE_W = 50
const ASIENTO_SUP = 140
const ASIENTO_INF = 190
const RECORRIDO = 26

export function CorteValvula32({ accionada, presiones, na = false }: PropsCorte & { na?: boolean }) {
  // "abierta" = paso 1→2 abierto (vástago abajo)
  const abierta = na ? !accionada : accionada
  const dy = abierta ? RECORRIDO : 0

  // Las juntas van montadas en el vástago: la superior sella contra su asiento
  // cuando dy = RECORRIDO, y la inferior cuando dy = 0. Nunca las dos a la vez.
  const yJuntaInf = ASIENTO_INF + dy

  return (
    <svg viewBox="0 0 262 288" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* cuerpo */}
      <rect x={40} y={84} width={180} height={166} rx={5} fill={CUERPO} stroke={CUERPO_BORDE} strokeWidth={2} />

      {/* taladro central dividido en tres cámaras (una por puerto) */}
      <rect x={BORE_X} y={96} width={BORE_W} height={ASIENTO_SUP - 96} fill={colorP(presiones['3'])} style={{ transition: T_AIRE }} />
      <rect x={BORE_X} y={ASIENTO_SUP} width={BORE_W} height={ASIENTO_INF - ASIENTO_SUP} fill={colorP(presiones['2'])} style={{ transition: T_AIRE }} />
      <rect x={BORE_X} y={ASIENTO_INF} width={BORE_W} height={244 - ASIENTO_INF} fill={colorP(presiones['1'])} style={{ transition: T_AIRE }} />

      {/* canales laterales hacia los puertos */}
      <rect x={BORE_X + BORE_W} y={100} width={220 - (BORE_X + BORE_W)} height={24} fill={colorP(presiones['3'])} style={{ transition: T_AIRE }} />
      <rect x={40} y={148} width={BORE_X - 40} height={24} fill={colorP(presiones['2'])} style={{ transition: T_AIRE }} />
      <rect x={40} y={200} width={BORE_X - 40} height={24} fill={colorP(presiones['1'])} style={{ transition: T_AIRE }} />

      {/* asientos: estrechamientos del cuerpo contra los que sellan las juntas */}
      {[ASIENTO_SUP, ASIENTO_INF].map((y) => (
        <g key={y}>
          <polygon points={`${BORE_X},${y - 9} ${BORE_X + 9},${y} ${BORE_X},${y + 9}`} fill={CUERPO} stroke={CUERPO_BORDE} strokeWidth={1} />
          <polygon
            points={`${BORE_X + BORE_W},${y - 9} ${BORE_X + BORE_W - 9},${y} ${BORE_X + BORE_W},${y + 9}`}
            fill={CUERPO}
            stroke={CUERPO_BORDE}
            strokeWidth={1}
          />
        </g>
      ))}

      {/* muelle de retorno: empuja el vástago hacia arriba y se comprime al pulsar */}
      <path
        d={resorteVertical(yJuntaInf + 8, 242, BORE_X + BORE_W / 2, 12, 4)}
        fill="none"
        stroke={METAL_OSCURO}
        strokeWidth={2.4}
        strokeLinecap="round"
        style={{ transition: 'd 130ms' }}
      />

      {/* conjunto móvil: pulsador + vástago + juntas */}
      <g transform={`translate(0 ${dy})`} style={{ transition: T_MOVIL }}>
        <rect x={116} y={34} width={30} height={50} rx={5} fill={METAL_OSCURO} />
        <rect x={124} y={80} width={14} height={166} fill={METAL} stroke={METAL_OSCURO} strokeWidth={1} />
        <rect x={BORE_X - 4} y={109} width={BORE_W + 8} height={11} rx={2.5} fill={JUNTA_ROJA} stroke="#9c2320" strokeWidth={0.8} />
        <rect x={BORE_X - 4} y={ASIENTO_INF - 5} width={BORE_W + 8} height={11} rx={2.5} fill={JUNTA_ROJA} stroke="#9c2320" strokeWidth={0.8} />
      </g>

      {/* collarín guía del cuerpo */}
      <rect x={BORE_X - 6} y={84} width={BORE_W + 12} height={14} fill={METAL_CLARO} stroke={CUERPO_BORDE} strokeWidth={1.5} />

      <Etiqueta x={26} y={166} texto="2" />
      <Etiqueta x={26} y={218} texto="1" />
      <Etiqueta x={236} y={118} texto="3" />

      {/* indicación del paso abierto */}
      <text x={131} y={276} fontSize={12} fill="#5a6b7d" textAnchor="middle" fontFamily="inherit">
        {abierta ? 'paso abierto 1 → 2' : 'paso abierto 2 → 3'}
      </text>
    </svg>
  )
}

// ===========================================================================
// Válvulas de corredera (5/2 y 4/2). La corredera desliza y las cavidades
// entre sus émbolos conectan unos puertos con otros: la geometría ES la lógica.
// Una 4/2 es una 5/2 con los dos escapes unidos en un solo orificio.
// ===========================================================================
interface PuertoCorte {
  id: string
  x: number
  lado: 'arriba' | 'abajo'
}

const PUERTOS_CORREDERA: PuertoCorte[] = [
  { id: '5', x: 80, lado: 'abajo' },
  { id: '1', x: 170, lado: 'abajo' },
  { id: '3', x: 260, lado: 'abajo' },
  { id: '4', x: 120, lado: 'arriba' },
  { id: '2', x: 210, lado: 'arriba' },
]

/** Émbolos de la corredera en reposo [x0, x1]; se desplazan +DESPL al accionar. */
const EMBOLOS: Array<[number, number]> = [
  [15, 45],
  [125, 155],
  [222, 272],
]
const DESPL = 50
const BORE_A = 35
const BORE_B = 325
const BORE_TOP = 70
const BORE_H = 50

function CorrederaBase({
  accionada,
  presiones,
  biestable = false,
  pilotaje = false,
  escapeUnico = false,
  leyenda,
}: PropsCorte & { biestable?: boolean; pilotaje?: boolean; escapeUnico?: boolean; leyenda: string }) {
  const s = accionada ? DESPL : 0
  const embolos = EMBOLOS.map(([a, b]) => [a + s, b + s] as [number, number])

  // En una 4/2 los dos escapes son el mismo puerto 3
  const puertos = escapeUnico
    ? PUERTOS_CORREDERA.map((p) => (p.id === '5' ? { ...p, id: '3' } : p))
    : PUERTOS_CORREDERA

  // Cavidades = tramos del taladro que no están tapados por un émbolo
  const bordes = [BORE_A, ...embolos.flat(), BORE_B].sort((a, b) => a - b)
  const cavidades: Array<{ a: number; b: number; color: string }> = []
  for (let i = 0; i < bordes.length - 1; i += 1) {
    const [a, b] = [bordes[i], bordes[i + 1]]
    if (b - a < 2) continue
    if (embolos.some(([ea, eb]) => a >= ea && b <= eb)) continue
    const conectados = puertos.filter((p) => p.x - 6 > a && p.x + 6 < b)
    const color =
      conectados.length === 0 ? NEUTRO : colorP(Math.max(...conectados.map((p) => presiones[p.id] ?? 0)))
    cavidades.push({ a, b, color })
  }

  const conPiloto14 = biestable || pilotaje

  return (
    <svg viewBox="0 0 388 210" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* cuerpo y taladro (el cuerpo sobresale a la derecha para alojar el
          muelle o la cámara de pilotaje 12) */}
      <rect x={25} y={58} width={334} height={74} rx={5} fill={CUERPO} stroke={CUERPO_BORDE} strokeWidth={2} />
      <rect x={BORE_A} y={BORE_TOP} width={BORE_B - BORE_A} height={BORE_H} fill={NEUTRO} />

      {/* canales de los puertos */}
      {puertos.map((p, i) => (
        <rect
          key={i}
          x={p.x - 8}
          y={p.lado === 'arriba' ? 40 : 120}
          width={16}
          height={30}
          fill={colorP(presiones[p.id])}
          style={{ transition: T_AIRE }}
        />
      ))}

      {/* colector que une los dos escapes en la 4/2 */}
      {escapeUnico && (
        <>
          <rect x={72} y={146} width={196} height={12} fill={colorP(presiones['3'])} style={{ transition: T_AIRE }} />
          <rect x={72} y={144} width={196} height={16} fill="none" stroke={CUERPO_BORDE} strokeWidth={1.5} />
        </>
      )}

      {/* cavidades entre émbolos: aquí se ve qué puerto queda unido con cuál */}
      {cavidades.map((c, i) => (
        <rect key={i} x={c.a} y={BORE_TOP} width={c.b - c.a} height={BORE_H} fill={c.color} style={{ transition: T_AIRE }} />
      ))}

      {/* corredera: eje fino con émbolos anchos */}
      <g transform={`translate(${s} 0)`} style={{ transition: T_MOVIL }}>
        <rect x={10} y={88} width={266} height={14} rx={2} fill={METAL} stroke={METAL_OSCURO} strokeWidth={1} />
        {EMBOLOS.map(([a, b], i) => (
          <g key={i}>
            <rect x={a} y={BORE_TOP - 1} width={b - a} height={BORE_H + 2} rx={3} fill={METAL_CLARO} stroke={METAL_OSCURO} strokeWidth={1.5} />
            <rect x={a + 3} y={BORE_TOP - 1} width={3} height={BORE_H + 2} fill={METAL_OSCURO} opacity={0.5} />
            <rect x={b - 6} y={BORE_TOP - 1} width={3} height={BORE_H + 2} fill={METAL_OSCURO} opacity={0.5} />
          </g>
        ))}
      </g>

      {/* extremo izquierdo: cámara de pilotaje 14 o tapa ciega */}
      <rect
        x={5}
        y={66}
        width={20}
        height={58}
        rx={3}
        fill={conPiloto14 ? colorP(presiones['14']) : CUERPO}
        stroke={CUERPO_BORDE}
        strokeWidth={1.5}
        style={{ transition: T_AIRE }}
      />
      {conPiloto14 && <Etiqueta x={15} y={54} texto="14" />}

      {/* extremo derecho: cámara de pilotaje 12 (biestable) o muelle de retorno */}
      {biestable ? (
        <>
          <rect
            x={359}
            y={66}
            width={20}
            height={58}
            rx={3}
            fill={colorP(presiones['12'])}
            stroke={CUERPO_BORDE}
            strokeWidth={1.5}
            style={{ transition: T_AIRE }}
          />
          <Etiqueta x={369} y={54} texto="12" />
        </>
      ) : (
        <path
          d={resorteHorizontal(276 + s, 352, 95, 14, 5)}
          fill="none"
          stroke={METAL_OSCURO}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      )}

      {/* etiquetas de puertos */}
      {puertos.map((p, i) => (
        <Etiqueta key={i} x={p.x} y={p.lado === 'arriba' ? 32 : escapeUnico && p.id === '3' ? 180 : 170} texto={p.id} />
      ))}

      <text x={180} y={202} fontSize={12} fill="#5a6b7d" textAnchor="middle" fontFamily="inherit">
        {leyenda}
      </text>
    </svg>
  )
}

export function CorteValvula52(props: PropsCorte & { biestable?: boolean; pilotaje?: boolean }) {
  return (
    <CorrederaBase
      {...props}
      leyenda={props.accionada ? 'pasos abiertos 1 → 4 y 2 → 3' : 'pasos abiertos 1 → 2 y 4 → 5'}
    />
  )
}

export function CorteValvula42(props: PropsCorte & { pilotaje?: boolean }) {
  return (
    <CorrederaBase
      {...props}
      escapeUnico
      leyenda={props.accionada ? 'pasos abiertos 1 → 4 y 2 → 3' : 'pasos abiertos 1 → 2 y 4 → 3'}
    />
  )
}
