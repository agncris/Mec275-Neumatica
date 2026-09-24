/**
 * Teoría de la unidad de CNC, escrita para el alumno: qué es el CNC, cómo se
 * organiza un programa, coordenadas absolutas e incrementales, la estructura
 * de un bloque, los códigos G y M, el torno y sus herramientas.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { CODIGOS_G, CODIGOS_M } from './gcode'

const TINTA = '#33475c'
const p: React.CSSProperties = { margin: '0 0 0.6rem', lineHeight: 1.55, color: '#26323f' }
const tabla: React.CSSProperties = { borderCollapse: 'collapse', width: '100%', fontSize: '0.9rem' }
const th: React.CSSProperties = { textAlign: 'left', background: TINTA, color: '#fff', padding: '6px 8px' }
const td: React.CSSProperties = { borderBottom: '1px solid #e0e5eb', padding: '6px 8px', verticalAlign: 'top' }
const boton: React.CSSProperties = { border: 'none', background: '#1668c7', color: '#fff', padding: '0.35rem 0.9rem', borderRadius: 7, fontWeight: 600, cursor: 'pointer' }
const botonSuave: React.CSSProperties = { border: '1px solid #c6ced6', background: '#fff', color: TINTA, padding: '0.35rem 0.75rem', borderRadius: 7, cursor: 'pointer' }
const mono: React.CSSProperties = { fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontWeight: 700 }

function Tabla({ cabeza, filas }: { cabeza: string[]; filas: ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tabla}>
        <thead>
          <tr>
            {cabeza.map((c) => (
              <th key={c} style={th}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              {f.map((c, j) => (
                <td key={j} style={td}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function QueEsCNC() {
  return (
    <div>
      <p style={p}>
        El <strong>Control Numérico Computarizado</strong> (<em>Computerized Numerical Control</em>, CNC) es un sistema que
        controla máquinas herramienta mediante comandos programados en un computador, reemplazando el control manual. El
        programa dice a la máquina hacia dónde mover la herramienta, a qué velocidad y qué hacer (encender el husillo,
        cambiar la herramienta, abrir el refrigerante…).
      </p>
      <p style={p}>
        Como toda máquina herramienta, se piensa en sus <strong>ejes de movimiento</strong>: lineales{' '}
        <strong>X, Y, Z</strong> y rotacionales <strong>A, B, C</strong> (giros alrededor de X, Y y Z). Las instrucciones
        se escriben en <strong>código G</strong> (<em>G-code</em>), normado por DIN 66024 y 66025. Con CNC trabajan
        fresadoras, tornos, cortadoras láser y por plasma, impresoras 3D y routers, entre otras.
      </p>
      <svg viewBox="0 0 560 200" width="100%" style={{ maxWidth: 620, display: 'block', margin: '4px auto 0' }} role="img" aria-label="Ejes de la fresadora y del torno">
        <defs>
          <marker id="fl-cnc" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="context-stroke" />
          </marker>
        </defs>
        <text x={140} y={18} textAnchor="middle" fontWeight={700} fill={TINTA} fontSize={14}>
          Fresadora
        </text>
        <rect x={80} y={110} width={120} height={40} fill="#c9ced4" stroke="#8a949e" />
        <rect x={125} y={40} width={30} height={50} fill="#8a949e" />
        <line x1={140} y1={130} x2={230} y2={130} stroke="#d62828" strokeWidth={3} markerEnd="url(#fl-cnc)" />
        <line x1={140} y1={130} x2={190} y2={100} stroke="#2a9d38" strokeWidth={3} markerEnd="url(#fl-cnc)" />
        <line x1={140} y1={130} x2={140} y2={60} stroke="#1668c7" strokeWidth={3} markerEnd="url(#fl-cnc)" />
        <text x={236} y={134} fill="#d62828" fontWeight={700}>X</text>
        <text x={194} y={98} fill="#2a9d38" fontWeight={700}>Y</text>
        <text x={146} y={58} fill="#1668c7" fontWeight={700}>Z</text>
        <text x={140} y={178} textAnchor="middle" fontSize={12} fill="#5a6b7d">
          X derecha · Y fondo · Z arriba (husillo)
        </text>
        <text x={420} y={18} textAnchor="middle" fontWeight={700} fill={TINTA} fontSize={14}>
          Torno
        </text>
        <rect x={300} y={80} width={30} height={80} fill="#8a949e" />
        <rect x={330} y={100} width={130} height={40} fill="#e3c77a" stroke="#9c7a24" />
        <line x1={320} y1={120} x2={530} y2={120} stroke="#8a97a5" strokeDasharray="8 4" />
        <line x1={460} y1={120} x2={530} y2={120} stroke="#1668c7" strokeWidth={3} markerEnd="url(#fl-cnc)" />
        <line x1={460} y1={120} x2={460} y2={50} stroke="#d62828" strokeWidth={3} markerEnd="url(#fl-cnc)" />
        <text x={534} y={124} fill="#1668c7" fontWeight={700}>Z</text>
        <text x={466} y={52} fill="#d62828" fontWeight={700}>X</text>
        <text x={420} y={178} textAnchor="middle" fontSize={12} fill="#5a6b7d">
          Z a lo largo del eje · X en diámetro
        </text>
      </svg>
    </div>
  )
}

export function VentajasCNC() {
  return (
    <div>
      <Tabla
        cabeza={['Ventajas', 'Limitaciones']}
        filas={[
          ['Alta precisión y repetibilidad', 'Costos iniciales elevados: equipo y experticia'],
          ['Más eficiencia en producción en masa', 'Depende de una programación adecuada (tiempo de preparación)'],
          ['Flexibilidad para piezas complejas y personalizadas', 'Requiere capacitación especializada'],
          ['Menos errores humanos y desechos', ''],
          ['Mejor cumplimiento de tolerancias', ''],
          ['Menor tiempo de mecanizado', ''],
        ]}
      />
      <p style={{ ...p, marginTop: 10 }}>
        <strong>En Ingeniería en Diseño de Productos:</strong> el CNC permite hacer <strong>prototipos rápidos</strong>{' '}
        y piezas funcionales para evaluar funcionalidad, estética y manufacturabilidad antes de producir en serie;
        sirve para <strong>manufactura personalizada</strong> (piezas únicas o series pequeñas, donde a veces conviene
        más la manufactura aditiva) y para <strong>producción masiva</strong> con alta precisión. Trabaja metales,
        plásticos y maderas, según el diseño y las exigencias del producto final.
      </p>
    </div>
  )
}

export function OrganizarPrograma() {
  const pasos = [
    ['Orden de operaciones', 'Planea la secuencia de principio a fin antes de escribir el programa (refrentar, desbastar, afinar, ranurar, tronzar…).'],
    ['Cálculo de coordenadas', 'Marca los puntos de la silueta sobre el plano y anota sus coordenadas en una tabla.'],
    ['Herramientas y velocidades', 'Elige la herramienta de cada etapa, la velocidad del husillo (S) y el avance (F). Revisa que las herramientas estén disponibles en la máquina.'],
  ]
  const eleccion = [
    ['Plano de la pieza', 'dimensiones y tolerancias'],
    ['Tipo de máquina', 'según el proyecto y la cantidad de piezas'],
    ['Herramienta, condiciones y material', 'forma del inserto, sujeción, refrigeración'],
    ['Parámetros tecnológicos', 'velocidad de corte y velocidad de avance'],
  ]
  return (
    <div>
      <ol style={{ margin: '0 0 10px', paddingLeft: 20, lineHeight: 1.6 }}>
        {pasos.map(([t, d]) => (
          <li key={t}>
            <strong>{t}:</strong> {d}
          </li>
        ))}
      </ol>
      <p style={p}>
        <strong>¿Qué máquina y herramienta usar?</strong> Se decide en este orden:
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        {eleccion.map(([t, d], i) => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ border: `1px solid ${TINTA}`, borderRadius: 8, padding: '4px 8px', fontSize: '0.86rem', background: '#f4f6f9' }}>
              <strong>{t}</strong>
              <br />
              <span style={{ color: '#5a6b7d' }}>{d}</span>
            </span>
            {i < eleccion.length - 1 && <span style={{ color: TINTA }}>→</span>}
          </span>
        ))}
      </div>
      <p style={p}>
        Criterios de selección: material de la pieza, parámetros tecnológicos, tolerancias y especificaciones, tiempo de
        ciclo y costo de producción.
      </p>
    </div>
  )
}

export function Coordenadas() {
  return (
    <div>
      <p style={p}>
        <strong>Absolutas (G90):</strong> cada coordenada se mide desde un origen fijo, el <strong>cero pieza</strong>.
        Escribes <em>hacia dónde</em> va la herramienta. <code>G90 G01 X50 Y30</code> la lleva al punto (50, 30), esté
        donde esté.
      </p>
      <p style={p}>
        <strong>Incrementales (G91):</strong> cada coordenada se mide desde la posición actual. Escribes{' '}
        <em>cuánto se mueve</em>. <code>G91 G01 X10 Y5</code> avanza 10 en X y 5 en Y desde donde está. En muchos
        controles también se usan las letras <strong>U, V, W</strong> para mover en X, Y, Z de forma incremental (en el
        torno, <code>U</code> y <code>W</code>).
      </p>
      <Tabla
        cabeza={['Situación', 'Absolutas', 'Incrementales']}
        filas={[
          ['Más intuitivo para el operador', '✅', '❌'],
          ['Útil para patrones repetitivos', '❌', '✅'],
          ['Riesgo de error si se pierde la referencia', 'Bajo', 'Alto (el error se arrastra)'],
          ['Ejemplo típico', 'Primera pieza, contornos', 'Agujeros en línea'],
        ]}
      />
      <p style={{ ...p, marginTop: 10 }}>
        Para pasar de una a otra: el incremento es <strong>punto de llegada − punto de partida</strong>, eje por eje. En
        el torno, X es el diámetro: pasar de X40 a X30 es un incremento U−10.
      </p>
      <PracticaCoordenadas />
    </div>
  )
}

type Pt = { n: string; x: number; y: number }

function puntosAzar(): Pt[] {
  const out: Pt[] = []
  const usados = new Set(['0,0'])
  const letras = 'ABCDE'
  for (let i = 0; i < 5; i++) {
    let x = 0
    let y = 0
    do {
      x = Math.floor(Math.random() * 9) - 4
      y = Math.floor(Math.random() * 9) - 4
    } while (usados.has(`${x},${y}`))
    usados.add(`${x},${y}`)
    out.push({ n: letras[i], x, y })
  }
  return out
}

/** Práctica: completar las coordenadas absolutas e incrementales de un recorrido. */
export function PracticaCoordenadas() {
  const [pts, setPts] = useState<Pt[]>(puntosAzar)
  const [resp, setResp] = useState<Record<string, string>>({})
  const [revisar, setRevisar] = useState(false)
  const esperado = useMemo(() => {
    const e: Record<string, number> = {}
    let px = 0
    let py = 0
    for (const q of pts) {
      e[`${q.n}-ax`] = q.x
      e[`${q.n}-ay`] = q.y
      e[`${q.n}-ix`] = q.x - px
      e[`${q.n}-iy`] = q.y - py
      px = q.x
      py = q.y
    }
    return e
  }, [pts])
  const correctas = Object.keys(esperado).filter((k) => Number(resp[k]) === esperado[k] && resp[k]?.trim() !== '').length
  const s = 22
  const cx = (x: number) => 110 + x * s
  const cy = (y: number) => 110 - y * s
  const campo = (k: string) => {
    const ok = revisar ? Number(resp[k]) === esperado[k] && resp[k]?.trim() !== '' : null
    return (
      <input
        aria-label={k}
        value={resp[k] ?? ''}
        onChange={(e) => setResp({ ...resp, [k]: e.target.value })}
        inputMode="numeric"
        style={{
          width: 44,
          padding: '2px 4px',
          border: `1px solid ${ok === null ? '#c6ced6' : ok ? '#2a9d38' : '#c62828'}`,
          background: ok === null ? '#fff' : ok ? '#eaf7ec' : '#fdeaea',
          borderRadius: 4,
          textAlign: 'center',
        }}
      />
    )
  }
  return (
    <div style={{ border: '1px dashed #c6ced6', borderRadius: 8, padding: 10, marginTop: 8 }}>
      <p style={{ ...p, fontWeight: 700 }}>Práctica: la herramienta parte del origen y recorre A → B → C → D → E.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
        <svg viewBox="0 0 220 220" width={220} style={{ background: '#fbfcfd', border: '1px solid #e0e5eb', borderRadius: 6 }} role="img" aria-label="Puntos de la práctica">
          {Array.from({ length: 9 }, (_, i) => i - 4).map((k) => (
            <g key={k}>
              <line x1={cx(k)} x2={cx(k)} y1={cy(-4.5)} y2={cy(4.5)} stroke={k === 0 ? '#8a97a5' : '#eef1f4'} />
              <line y1={cy(k)} y2={cy(k)} x1={cx(-4.5)} x2={cx(4.5)} stroke={k === 0 ? '#8a97a5' : '#eef1f4'} />
              {k !== 0 && (
                <>
                  <text x={cx(k)} y={cy(0) + 11} fontSize={8} textAnchor="middle" fill="#8a97a5">{k}</text>
                  <text x={cx(0) - 4} y={cy(k) + 3} fontSize={8} textAnchor="end" fill="#8a97a5">{k}</text>
                </>
              )}
            </g>
          ))}
          <polyline points={[{ x: 0, y: 0 }, ...pts].map((q) => `${cx(q.x)},${cy(q.y)}`).join(' ')} fill="none" stroke="#1668c7" strokeWidth={1.5} strokeDasharray="4 3" />
          {pts.map((q) => (
            <g key={q.n}>
              <circle cx={cx(q.x)} cy={cy(q.y)} r={4} fill="#d62828" />
              <text x={cx(q.x) + 5} y={cy(q.y) - 5} fontSize={11} fontWeight={700} fill={TINTA}>{q.n}</text>
            </g>
          ))}
          <text x={cx(4.4)} y={cy(0) - 4} fontSize={10} fontWeight={700} fill={TINTA}>X</text>
          <text x={cx(0) + 4} y={cy(4.3)} fontSize={10} fontWeight={700} fill={TINTA}>Y</text>
        </svg>
        <div>
          <table style={{ ...tabla, width: 'auto' }}>
            <thead>
              <tr>
                <th style={th}>Punto</th>
                <th style={th}>Abs X (G90)</th>
                <th style={th}>Abs Y</th>
                <th style={th}>Inc X (G91)</th>
                <th style={th}>Inc Y</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((q) => (
                <tr key={q.n}>
                  <td style={{ ...td, fontWeight: 700 }}>{q.n}</td>
                  <td style={td}>{campo(`${q.n}-ax`)}</td>
                  <td style={td}>{campo(`${q.n}-ay`)}</td>
                  <td style={td}>{campo(`${q.n}-ix`)}</td>
                  <td style={td}>{campo(`${q.n}-iy`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setRevisar(true)} style={boton}>
              Revisar
            </button>
            <button
              onClick={() => {
                setPts(puntosAzar())
                setResp({})
                setRevisar(false)
              }}
              style={botonSuave}
            >
              Otros puntos
            </button>
            {revisar && (
              <span style={{ fontWeight: 700, color: correctas === 20 ? '#2a9d38' : '#8a5b00' }}>
                {correctas} de 20 correctas{correctas === 20 ? ' ¡Muy bien!' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function EstructuraBloque() {
  const partes: Array<[string, string, string]> = [
    ['N10', '#8a97a5', 'Número de bloque (secuencia)'],
    ['G01', '#1668c7', 'Función preparatoria: cómo se mueve'],
    ['X50', '#18794e', 'Cota según el eje X'],
    ['Y30', '#18794e', 'Cota según el eje Y'],
    ['Z-5', '#18794e', 'Cota según el eje Z (profundidad)'],
    ['F100', '#c75d00', 'Velocidad de avance, mm/min'],
    ['S2000', '#c75d00', 'Velocidad del husillo, rpm'],
    ['T01', '#9c5a12', 'Número de herramienta'],
    ['M03', '#8e3fb8', 'Función auxiliar (miscelánea)'],
  ]
  return (
    <div>
      <p style={p}>
        Un programa es una lista de <strong>bloques</strong> (líneas). Cada bloque tiene <strong>palabras</strong>: una
        letra seguida de un número. El orden habitual es:
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {partes.map(([t, c, d]) => (
          <div key={t} style={{ border: `2px solid ${c}`, borderRadius: 8, padding: '4px 8px', minWidth: 90 }}>
            <div style={{ ...mono, color: c, fontSize: '1.05rem' }}>{t}</div>
            <div style={{ fontSize: '0.78rem', color: '#26323f' }}>{d}</div>
          </div>
        ))}
      </div>
      <p style={p}>
        Muchas palabras son <strong>modales</strong>: siguen valiendo en los bloques siguientes hasta que se cambian. Si
        escribes <code>G01 … F200</code>, las líneas que siguen con sólo <code>X</code> o <code>Y</code> también cortan en
        línea recta a 200 mm/min. Los <strong>comentarios</strong> van entre paréntesis <code>( … )</code> o después de{' '}
        <code>;</code> y la máquina no los lee: úsalos para explicar cada línea.
      </p>
      <Tabla
        cabeza={['Letra', 'Significado']}
        filas={[
          [<span style={mono}>N</span>, 'Número de bloque o secuencia'],
          [<span style={mono}>X, Y, Z</span>, 'Coordenadas de los ejes'],
          [<span style={mono}>U, V, W</span>, 'Movimientos incrementales en X, Y, Z'],
          [<span style={mono}>I, J, K</span>, 'Centro del arco, medido desde el punto de partida (en X, Y, Z)'],
          [<span style={mono}>R</span>, 'Radio del arco (o plano de aproximación en los ciclos)'],
          [<span style={mono}>F</span>, 'Avance (feed rate): mm/min con G94, mm/vuelta con G95'],
          [<span style={mono}>S</span>, 'Velocidad del husillo en rpm (o de corte en m/min con G96)'],
          [<span style={mono}>T</span>, 'Selección de herramienta (en el torno T0101: herramienta 1, corrector 1)'],
          [<span style={mono}>D, H</span>, 'Número del corrector de radio (D) y de largo (H)'],
        ]}
      />
    </div>
  )
}

export function CodigosGM() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 14 }}>
      <Tabla cabeza={['Código G', 'Función']} filas={Object.entries(CODIGOS_G).map(([c, d]) => [<span style={{ ...mono, color: '#1668c7' }}>{c}</span>, d])} />
      <Tabla cabeza={['Código M', 'Función']} filas={Object.entries(CODIGOS_M).map(([c, d]) => [<span style={{ ...mono, color: '#8e3fb8' }}>{c}</span>, d])} />
    </div>
  )
}

export function Arcos() {
  return (
    <div>
      <p style={p}>
        <strong>G02</strong> hace un arco en sentido horario y <strong>G03</strong> antihorario, desde donde está la
        herramienta hasta el punto que escribes. El arco se define de dos formas:
      </p>
      <ul style={{ margin: '0 0 8px', paddingLeft: 20, lineHeight: 1.6 }}>
        <li>
          Con el <strong>centro</strong>: <code>I</code>, <code>J</code> (y <code>K</code>) son las distancias{' '}
          <em>desde el punto de partida hasta el centro</em>, en X, Y (y Z). Sirve también para círculos completos
          (punto final = punto de partida).
        </li>
        <li>
          Con el <strong>radio</strong>: <code>R</code>. Si R es positivo se hace el arco corto (hasta media vuelta); si
          es negativo, el largo.
        </li>
      </ul>
      <svg viewBox="0 0 520 190" width="100%" style={{ maxWidth: 580, display: 'block', margin: '0 auto' }} role="img" aria-label="Arcos G02 y G03">
        <defs>
          <marker id="fl-arco" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#1668c7" />
          </marker>
        </defs>
        {[
          { x0: 130, t: 'G02 (horario)', horario: true },
          { x0: 390, t: 'G03 (antihorario)', horario: false },
        ].map(({ x0, t, horario }) => (
          <g key={t}>
            <text x={x0} y={20} textAnchor="middle" fontWeight={700} fill={TINTA}>
              {t}
            </text>
            <circle cx={x0} cy={110} r={3} fill="#8a97a5" />
            <text x={x0 + 6} y={124} fontSize={11} fill="#5a6b7d">centro</text>
            <path
              d={horario ? `M ${x0 - 60} 110 A 60 60 0 0 1 ${x0} 50` : `M ${x0 + 60} 110 A 60 60 0 0 0 ${x0} 50`}
              fill="none"
              stroke="#1668c7"
              strokeWidth={3}
              markerEnd="url(#fl-arco)"
            />
            <circle cx={horario ? x0 - 60 : x0 + 60} cy={110} r={4} fill="#d62828" />
            <text x={horario ? x0 - 60 : x0 + 60} y={130} textAnchor="middle" fontSize={11} fill="#d62828">inicio</text>
            <line x1={horario ? x0 - 60 : x0 + 60} y1={150} x2={x0} y2={150} stroke="#2a9d38" strokeWidth={1.5} />
            <text x={horario ? x0 - 30 : x0 + 30} y={166} textAnchor="middle" fontSize={11} fill="#2a9d38">
              I = {horario ? '+60' : '−60'}
            </text>
          </g>
        ))}
      </svg>
      <p style={{ ...p, marginTop: 6 }}>
        En el torno se mira el plano con Z hacia la derecha y X hacia arriba: con esa vista G02 es horario y G03
        antihorario. Allí X está en diámetro, pero <code>I</code> se da en radio.
      </p>
    </div>
  )
}

export function Torno() {
  const ops: Array<[string, string]> = [
    ['Refrentado', 'Deja plana la cara de la pieza: la herramienta baja en X hasta el centro (X0) con Z fijo.'],
    ['Desbaste', 'Quita la mayor parte del material en pasadas paralelas al eje (cilindrado). Conviene no quitar más de unos 5 mm de diámetro por pasada.'],
    ['Afinado', 'Una última pasada, fina, siguiendo el contorno terminado: chaflanes, radios y resaltes.'],
    ['Taladrado', 'Con broca en X0, avanzando en Z−. Primero un punto de centro y salidas para botar la viruta.'],
    ['Roscado', 'Con G33 (o un ciclo), el avance por vuelta es el paso de la rosca.'],
    ['Ranurado y tronzado', 'Una herramienta angosta entra en X: hace ranuras y, al llegar al centro, separa la pieza del material que sujeta el plato.'],
  ]
  return (
    <div>
      <p style={p}>
        El torno CNC trabaja en dos ejes: <strong>Z</strong>, a lo largo del eje de la pieza (negativo hacia el plato), y{' '}
        <strong>X</strong>, perpendicular, que se programa en <strong>diámetro</strong>. El <strong>cero máquina</strong>{' '}
        lo fija el fabricante; para programar se usa un <strong>cero pieza</strong>, normalmente en la cara frontal,
        sobre el eje. La posición de referencia (<code>G28</code>) queda lejos de la pieza: allí se cambia la
        herramienta sin chocar.
      </p>
      <Tabla cabeza={['Operación', 'Qué hace']} filas={ops.map(([a, b]) => [<strong>{a}</strong>, b])} />
      <p style={{ ...p, marginTop: 10 }}>
        <strong>Antes de programar:</strong> indica las unidades (G21, milímetros); define el bruto: su diámetro debe
        ser mayor que el mayor diámetro de la pieza, y su largo, el de la pieza + lo que toman las garras del plato
        (unos 25 mm) + el ancho de la herramienta de tronzado; elige la herramienta de cada etapa y dibuja la silueta
        con sus puntos.
      </p>
      <p style={p}>
        <strong>Compensación del radio (G41/G42):</strong> la punta del inserto es redondeada. En chaflanes y radios, si
        se programa la punta teórica, el contorno queda levemente distinto; la compensación corre la trayectoria a la
        izquierda (G41) o a la derecha (G42). Se cancela con G40. En la fresadora es imprescindible: el contorno se
        programa con las medidas de la pieza y la máquina corre el centro de la fresa un radio (el del corrector D); el
        lado se mira en el sentido del avance.
      </p>
      <p style={p}>
        <strong>Ciclos de desbaste y acabado (G71/G70, dialecto Fanuc):</strong> el perfil se escribe una sola vez,
        entre dos bloques numerados. <code>G71 U2 R0.5</code> fija la pasada (2 mm en radio) y el retiro;{' '}
        <code>G71 P10 Q60 U0.4 W0.1 F150</code> desbasta desde el punto de partida hasta el perfil N10…N60 dejando 0,4 mm
        en el diámetro y 0,1 mm en Z; <code>G70 P10 Q60</code> lo recorre una vez para afinar. Sin P y Q, G70 y G71
        son pulgadas y milímetros (DIN).
      </p>
      <p style={p}>
        <strong>Subprogramas (M98/M99):</strong> una parte que se repite (una ranura, una vuelta de contorno) se escribe
        una vez como subprograma <code>O1000</code> … <code>M99</code>, después del M30, y se llama con{' '}
        <code>M98 P1000 L3</code> (tres veces). Con coordenadas incrementales (G91) dentro del subprograma, cada llamada
        trabaja desde donde quedó la anterior.
      </p>
    </div>
  )
}

export function Insertos() {
  return (
    <div>
      <p style={p}>
        Los insertos de corte se designan con un código normalizado (ISO 1832). Por ejemplo, <code>CNMG 120408</code>:
      </p>
      <Tabla
        cabeza={['Posición', 'Ejemplo', 'Qué indica']}
        filas={[
          ['1. Forma', 'C', 'Rómbico de 80° (D = 55°, V = 35°, T = triangular 60°, S = cuadrado, W = trigonal 80°, R = redondo). Más ángulo, más robusto; menos ángulo, más acceso a perfiles.'],
          ['2. Ángulo de incidencia', 'N', '0° (negativo, dos caras útiles). B = 5°, C = 7°, P = 11° (positivos).'],
          ['3. Tolerancia', 'M', 'Precisión de fabricación del inserto.'],
          ['4. Tipo', 'G', 'Agujero de fijación y rompevirutas. Un rompevirutas más cerrado da viruta más corta.'],
          ['5. Largo del filo', '12', 'Tamaño del inserto (círculo inscrito, I.C.), 12 mm.'],
          ['6. Espesor', '04', '4,76 mm.'],
          ['7. Radio de punta', '08', '0,8 mm: más radio, mejor terminación y filo más resistente; menos radio, menos vibración.'],
        ]}
      />
      <p style={{ ...p, marginTop: 10 }}>
        Además se elige la geometría del filo, el recubrimiento y el portaherramientas (su ángulo de posición). El método
        de refrigeración también condiciona el tipo de inserto.
      </p>
    </div>
  )
}
