/**
 * Animación corta de cada planta para el selector: muestra de un vistazo qué
 * hace la máquina (se llena el estanque, sube la pieza, cambia el semáforo…)
 * sin tener que leer la descripción. Es sólo ilustrativa: no es la solución de
 * ningún ejercicio. Los movimientos están en index.css (clases .ap-*) y se
 * detienen con «reducir movimiento».
 */
import type { IdPlanta } from './ladder'

const LINEA = '#51606f'
const AGUA = '#4d9be6'
const texto = { fontSize: 7, fill: '#33475c', fontFamily: 'system-ui, sans-serif', fontWeight: 600 } as const

export default function AnimacionPlanta({ id, ancho = 160 }: { id: IdPlanta; ancho?: number | string }) {
  return (
    <svg viewBox="0 0 160 100" width={ancho} className={`ap ap-${id}`} aria-hidden="true" focusable="false" style={{ display: 'block', background: '#f5f8fb', borderRadius: 8, flex: 'none' }}>
      {DIBUJOS[id]}
    </svg>
  )
}

const tablero = (
  <g>
    <rect x={14} y={10} width={132} height={82} rx={6} fill="#e3e8ee" stroke={LINEA} />
    {['#2fa35a', '#d9443a', '#e0b300', '#2f7fd6', '#ffffff', '#ffffff'].map((c, i) => (
      <g key={i}>
        <circle cx={32 + i * 19} cy={32} r={7} fill="#9aa5b1" stroke={LINEA} />
        <circle cx={32 + i * 19} cy={32} r={7} fill={c} stroke={LINEA} className="ap-luz" style={{ animationDelay: `${i * 0.25}s` }} />
      </g>
    ))}
    <circle cx={32} cy={66} r={7} fill="#2fa35a" stroke={LINEA} className="ap-marcha" />
    <circle cx={55} cy={66} r={7} fill="#d9443a" stroke={LINEA} className="ap-paro" />
    <circle cx={73} cy={66} r={7} fill="#333" stroke={LINEA} />
    <circle cx={91} cy={66} r={7} fill="#333" stroke={LINEA} />
    {[0, 1].map((i) => (
      <g key={i}>
        <circle cx={112 + i * 19} cy={66} r={7} fill="#fff" stroke={LINEA} />
        <rect x={110.5 + i * 19} y={59} width={3} height={14} rx={1} fill="#333" className={i === 0 ? 'ap-selector' : undefined} />
      </g>
    ))}
    <text x={32} y={84} textAnchor="middle" style={{ ...texto, fontSize: 5.5 }}>MARCHA</text>
    <text x={55} y={84} textAnchor="middle" style={{ ...texto, fontSize: 5.5 }}>PARO</text>
  </g>
)

const estanque = (
  <g>
    {/* V1: llenado por arriba */}
    <path d="M4 10 H80 V20" fill="none" stroke={LINEA} strokeWidth={4} />
    <path d="M30 5 L42 15 V5 L30 15 Z" fill="#fff" stroke={LINEA} className="ap-v1-valvula" />
    <text x={31} y={25} style={texto}>V1</text>
    <line x1={80} y1={21} x2={80} y2={80} stroke={AGUA} strokeWidth={3} strokeDasharray="4 4" className="ap-v1-chorro" />
    {/* Estanque y nivel */}
    <rect x={56} y={20} width={48} height={62} fill="#fff" stroke={LINEA} strokeWidth={2} />
    <rect x={57} y={21} width={46} height={60} fill={AGUA} className="ap-nivel" />
    {/* Sensores de nivel */}
    <circle cx={110} cy={28} r={4} fill="#c6ced6" stroke={LINEA} className="ap-s2" />
    <text x={117} y={31} style={texto}>S2</text>
    <circle cx={110} cy={74} r={4} fill="#c6ced6" stroke={LINEA} className="ap-s1" />
    <text x={117} y={77} style={texto}>S1</text>
    {/* V2: vaciado por abajo */}
    <path d="M80 82 V92 H156" fill="none" stroke={LINEA} strokeWidth={4} />
    <path d="M114 87 L126 97 V87 L114 97 Z" fill="#fff" stroke={LINEA} className="ap-v2-valvula" />
    <text x={130} y={86} style={texto}>V2</text>
    <line x1={82} y1={92} x2={158} y2={92} stroke={AGUA} strokeWidth={2} strokeDasharray="4 4" className="ap-v2-chorro" />
  </g>
)

const elevador = (
  <g>
    {/* Bandas de abajo (llegan piezas) y de arriba (salen) */}
    <rect x={0} y={80} width={56} height={6} fill="#6b7785" />
    <rect x={92} y={30} width={68} height={6} fill="#6b7785" />
    {/* Cilindro Z1 con la plataforma */}
    <g className="ap-z1">
      <rect x={69} y={86} width={6} height={70} fill="#b8c2cc" stroke={LINEA} />
      <rect x={58} y={80} width={28} height={6} fill="#8a97a5" stroke={LINEA} />
    </g>
    <rect x={63} y={88} width={18} height={12} fill="#dbe1e8" stroke={LINEA} />
    <text x={84} y={97} style={texto}>Z1</text>
    {/* Cilindro Z2 que empuja la pieza a la banda de arriba */}
    <g className="ap-z2">
      <rect x={-30} y={22} width={89} height={3} fill="#b8c2cc" stroke={LINEA} strokeWidth={0.6} />
      <rect x={57} y={17} width={4} height={13} fill="#8a97a5" />
    </g>
    <rect x={2} y={16} width={43} height={15} fill="#dbe1e8" stroke={LINEA} />
    <text x={18} y={26} style={texto}>Z2</text>
    {/* Pieza */}
    <rect x={65} y={68} width={14} height={12} fill="#e08a2e" stroke="#8a4b10" className="ap-pieza" />
  </g>
)

const silo = (
  <g>
    <path d="M60 4 H100 V26 L86 38 H74 L60 26 Z" fill="#dbe1e8" stroke={LINEA} />
    <rect x={74} y={38} width={12} height={5} fill="#8a97a5" stroke={LINEA} className="ap-solenoide" />
    <line x1={80} y1={44} x2={80} y2={70} stroke="#b07a3a" strokeWidth={5} strokeDasharray="3 3" className="ap-chorro" />
    {/* Pilotos RUN, FILL, FULL */}
    {(
      [
        [114, '#2fa35a', 'RUN', undefined],
        [133, '#e0b300', 'FILL', 'ap-fill'],
        [152, '#d9443a', 'FULL', 'ap-full'],
      ] as const
    ).map(([x, c, n, cl]) => (
      <g key={n}>
        <circle cx={x} cy={10} r={4} fill={c} stroke={LINEA} className={cl} />
        <text x={x} y={22} textAnchor="middle" style={{ ...texto, fontSize: 5.5 }}>
          {n}
        </text>
      </g>
    ))}
    {/* Cinta */}
    <rect x={2} y={82} width={156} height={7} rx={3.5} fill="#6b7785" />
    <line x1={6} y1={85.5} x2={154} y2={85.5} stroke="#c6ced6" strokeWidth={2} strokeDasharray="4 6" className="ap-cinta" />
    {/* Caja que se llena */}
    <g className="ap-caja">
      <rect x={68} y={62} width={24} height={20} fill="#fff" stroke="#8a4b10" strokeWidth={1.5} />
      <rect x={69} y={63} width={22} height={18} fill="#b07a3a" className="ap-carga" />
    </g>
  </g>
)

const lampara = (x: number, y: number, clases: [string, string, string]) => (
  <g>
    <rect x={x} y={y} width={12} height={32} rx={3} fill="#26323f" />
    {(['#d9443a', '#e0b300', '#2fa35a'] as const).map((c, i) => (
      <circle key={i} cx={x + 6} cy={y + 6 + i * 10} r={4} fill={c} className={clases[i]} />
    ))}
  </g>
)

const semaforo = (
  <g>
    <rect x={0} y={40} width={160} height={22} fill="#9aa5b1" />
    <rect x={68} y={0} width={24} height={100} fill="#9aa5b1" />
    <line x1={0} y1={51} x2={160} y2={51} stroke="#fff" strokeDasharray="6 5" />
    <line x1={80} y1={0} x2={80} y2={100} stroke="#fff" strokeDasharray="6 5" />
    <rect x={71} y={-16} width={8} height={16} rx={2} fill="#2f7fd6" className="ap-auto-ns" />
    <rect x={-20} y={53} width={16} height={8} rx={2} fill="#d9443a" className="ap-auto-eo" />
    {lampara(100, 4, ['ap-ns-rojo', 'ap-ns-amarillo', 'ap-ns-verde'])}
    <text x={100} y={45} style={{ ...texto, fontSize: 6 }}>N-S</text>
    {lampara(46, 66, ['ap-eo-rojo', 'ap-eo-amarillo', 'ap-eo-verde'])}
    <text x={30} y={80} style={{ ...texto, fontSize: 6 }}>E-O</text>
  </g>
)

const porton = (
  <g>
    <rect x={32} y={10} width={96} height={80} fill="#fff" stroke={LINEA} strokeWidth={2} />
    <g className="ap-hoja">
      <rect x={33} y={11} width={94} height={78} fill="#c9d3dd" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line key={i} x1={33} y1={22 + i * 11} x2={127} y2={22 + i * 11} stroke="#8a97a5" />
      ))}
    </g>
    <rect x={70} y={2} width={20} height={8} rx={2} fill="#8a97a5" stroke={LINEA} />
    <text x={136} y={20} style={{ ...texto, fontSize: 12 }} className="ap-sube">▲</text>
    <text x={136} y={36} style={{ ...texto, fontSize: 12 }} className="ap-baja">▼</text>
    <rect x={24} y={76} width={6} height={10} fill="#33475c" />
    <rect x={130} y={76} width={6} height={10} fill="#33475c" />
    <line x1={30} y1={81} x2={130} y2={81} stroke="#d9443a" strokeDasharray="3 3" />
    <text x={4} y={96} style={{ ...texto, fontSize: 6 }}>fotocelda</text>
  </g>
)

const DIBUJOS: Record<IdPlanta, JSX.Element> = { tablero, estanque, elevador, silo, semaforo, porton }
