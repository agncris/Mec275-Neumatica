/**
 * Explicador animado del método cascada: un esquema simplificado, sin fichas
 * ni mangueras, que enseña la única idea que hay que entender —sólo una línea
 * de grupo tiene aire, así que un rodillo pisado en una línea muerta no manda
 * nada—. Se puede reproducir solo o avanzar paso a paso.
 *
 * Las señales y los bloqueos NO están escritos a mano: se calculan a partir del
 * estado de cada paso, igual que en el circuito real. Así el dibujo no puede
 * contradecir a la explicación.
 */
import { useEffect, useState } from 'react'

type Linea = 'L1' | 'L2' | 'RED'

interface Paso {
  /** Posición de cada vástago: 0 dentro, 1 fuera. */
  a: number
  b: number
  linea: Linea
  marcha: boolean
  texto: string
  /** Resalta el paso donde ocurre lo importante. */
  clave?: boolean
}

const PASOS_CASCADA: Paso[] = [
  { a: 0, b: 0, linea: 'L2', marcha: false,
    texto: 'En reposo manda la línea L2. Los rodillos a0 y b0 están pisados, pero sólo dan señal los que cuelgan de la línea con aire.' },
  { a: 0, b: 0, linea: 'L2', marcha: true,
    texto: 'Pulsas marcha. Como a0 cuelga de L2 y L2 tiene aire, la señal llega y hace conmutar la cascada.' },
  { a: 0, b: 0, linea: 'L1', marcha: true,
    texto: 'Ahora manda L1. Fíjate en que L2 se ha quedado sin aire: se ha puesto gris.' },
  { a: 1, b: 0, linea: 'L1', marcha: true,
    texto: 'La propia línea L1 pilota A+ . El primer movimiento de cada grupo lo manda su línea, sin rodillo de por medio.' },
  { a: 1, b: 1, linea: 'L1', marcha: true,
    texto: 'A ha llegado al final y pisa a1. Como a1 cuelga de L1, sí da señal, y esa señal manda B+ .' },
  { a: 1, b: 1, linea: 'L2', marcha: true, clave: true,
    texto: 'B llega al final y pisa b1, el último del grupo: conmuta la cascada a L2. AQUÍ ESTÁ LA CLAVE — a1 sigue pisado, pero su línea ya no tiene aire, así que deja de mandar B+ .' },
  { a: 1, b: 0, linea: 'L2', marcha: true,
    texto: 'Sin esa señal estorbando, L2 pilota B− y el vástago de B puede volver.' },
  { a: 0, b: 0, linea: 'L2', marcha: true,
    texto: 'B pisa b0, que está en L2 y sí da señal: A− . A vuelve y el ciclo se cierra.' },
]

const PASOS_SIN_CASCADA: Paso[] = [
  { a: 0, b: 0, linea: 'RED', marcha: false,
    texto: 'Aquí los cuatro rodillos cuelgan directamente de la red. Siempre tienen aire, así que el que esté pisado está mandando siempre.' },
  { a: 0, b: 0, linea: 'RED', marcha: true,
    texto: 'Pulsas marcha → orden A+ . Pero b0 lleva todo el rato pisado → orden A− . Las dos llegan a la vez a la misma válvula.' },
  { a: 0, b: 0, linea: 'RED', marcha: true, clave: true,
    texto: 'Resultado: la corredera no puede moverse y no arranca nada. Y aunque lo forzaras, más adelante a1 y b1 harían lo mismo con la válvula de B.' },
]

/** Rodillos: dónde están y qué mandan. */
const RODILLOS = [
  { id: 'a1', x: 120, cuelga: 'L1' as Linea, pie: 'A fuera', manda: 'B+' },
  { id: 'b1', x: 235, cuelga: 'L1' as Linea, pie: 'B fuera', manda: 'pasa a L2' },
  { id: 'b0', x: 350, cuelga: 'L2' as Linea, pie: 'B dentro', manda: 'A−' },
  { id: 'a0', x: 465, cuelga: 'L2' as Linea, pie: 'A dentro', manda: 'marcha' },
]

const AZUL = '#1668c7'
const GRIS = '#9aa5b1'
const VERDE = '#12a35a'
const ROJO = '#b3261e'

/**
 * Estado derivado de un paso: quién está pisado, quién tiene aire y qué
 * órdenes llegan de verdad a cada válvula. Es función pura para poder
 * comprobarla con pruebas: si esto se rompe, la explicación miente.
 */
export function estadoDelPaso(paso: Paso, conCascada: boolean) {
  const pisado: Record<string, boolean> = {
    a1: paso.a >= 1,
    a0: paso.a <= 0,
    b1: paso.b >= 1,
    b0: paso.b <= 0,
  }
  const lineaViva = (l: Linea) => (conCascada ? paso.linea === l : true)
  /** Un rodillo sólo da señal si está pisado Y su línea tiene aire. */
  const daSenal = (r: (typeof RODILLOS)[number]) =>
    pisado[r.id] && lineaViva(conCascada ? r.cuelga : 'RED')
  const senalMarcha = paso.marcha && daSenal(RODILLOS[3]) // la marcha va detrás de a0

  const ordenes = {
    'A+': conCascada ? lineaViva('L1') : senalMarcha,
    'A−': daSenal(RODILLOS[2]),
    'B+': daSenal(RODILLOS[0]),
    'B−': conCascada ? lineaViva('L2') : daSenal(RODILLOS[1]),
  }
  return {
    pisado,
    lineaViva,
    daSenal,
    senalMarcha,
    ordenes,
    choqueA: ordenes['A+'] && ordenes['A−'],
    choqueB: ordenes['B+'] && ordenes['B−'],
  }
}

export const PASOS = { conCascada: PASOS_CASCADA, sinCascada: PASOS_SIN_CASCADA }

const Y_RODILLO = 196
const Y_L1 = 244
const Y_L2 = 280
const Y_RED = 262

export default function ExplicadorCascada() {
  const [conCascada, setConCascada] = useState(true)
  const [i, setI] = useState(0)
  const [reproduciendo, setReproduciendo] = useState(false)

  const pasos = conCascada ? PASOS_CASCADA : PASOS_SIN_CASCADA
  const paso = pasos[Math.min(i, pasos.length - 1)]

  useEffect(() => {
    if (!reproduciendo) return
    const id = setTimeout(() => {
      setI((n) => (n + 1 >= pasos.length ? 0 : n + 1))
    }, paso.clave ? 4200 : 2600)
    return () => clearTimeout(id)
  }, [reproduciendo, i, pasos.length, paso.clave])

  const cambiarModo = (nuevo: boolean) => {
    setConCascada(nuevo)
    setI(0)
    setReproduciendo(false)
  }

  // --- estado derivado: quién está pisado, quién tiene aire y quién manda ---
  const { pisado, lineaViva, daSenal, senalMarcha, choqueA, choqueB } = estadoDelPaso(
    paso,
    conCascada,
  )

  const yDe = (l: Linea) => (l === 'L1' ? Y_L1 : l === 'L2' ? Y_L2 : Y_RED)

  const cilindro = (etiqueta: string, y: number, pos: number, choque: boolean) => (
    <g>
      <text x={30} y={y + 24} fontSize={15} fontWeight={700} fill="#33475c" textAnchor="middle">
        {etiqueta}
      </text>
      <rect x={52} y={y} width={190} height={38} rx={3} fill="#f3f5f7" stroke="#828a94" strokeWidth={1.8} />
      {/* cámara con aire */}
      <rect x={54} y={y + 2} width={Math.max(0, 6 + pos * 170)} height={34} fill="#bfe3f7" />
      {/* émbolo y vástago */}
      <g style={{ transition: 'transform 900ms ease-in-out' }} transform={`translate(${pos * 170} 0)`}>
        <rect x={58} y={y + 2} width={12} height={34} fill="#6d7580" />
        <rect x={70} y={y + 14} width={200} height={10} fill="#9aa2ad" />
      </g>
      {choque && (
        <text x={290} y={y + 25} fontSize={12} fontWeight={700} fill={ROJO}>
          ✕ válvula bloqueada
        </text>
      )}
    </g>
  )

  return (
    <div>
      {/* controles */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', border: '1px solid #c6ced6', borderRadius: 8, overflow: 'hidden' }}>
          <button
            onClick={() => cambiarModo(false)}
            style={{ ...pestana, background: !conCascada ? ROJO : '#fff', color: !conCascada ? '#fff' : '#33475c' }}
          >
            Sin cascada
          </button>
          <button
            onClick={() => cambiarModo(true)}
            style={{ ...pestana, background: conCascada ? VERDE : '#fff', color: conCascada ? '#fff' : '#33475c' }}
          >
            Con cascada
          </button>
        </div>

        <button onClick={() => setReproduciendo((r) => !r)} style={{ ...boton, background: '#33475c', borderColor: '#33475c', color: '#fff' }}>
          {reproduciendo ? '⏸ Pausa' : '▶ Reproducir'}
        </button>
        <button
          onClick={() => {
            setReproduciendo(false)
            setI((n) => Math.max(0, n - 1))
          }}
          style={boton}
          disabled={i === 0}
        >
          ◀ Atrás
        </button>
        <button
          onClick={() => {
            setReproduciendo(false)
            setI((n) => Math.min(pasos.length - 1, n + 1))
          }}
          style={boton}
          disabled={i >= pasos.length - 1}
        >
          Siguiente ▶
        </button>
        <span style={{ fontSize: '0.82rem', color: '#5a6b7d' }}>
          Paso {Math.min(i, pasos.length - 1) + 1} de {pasos.length}
        </span>
      </div>

      <svg viewBox="0 0 620 310" style={{ width: '100%', height: 'auto', display: 'block', background: '#fbfbfa', borderRadius: 8 }}>
        {cilindro('A', 18, paso.a, choqueA)}
        {cilindro('B', 92, paso.b, choqueB)}

        {/* qué manda cada línea directamente (regla 1 del método) */}
        {conCascada && (
          <>
            <text x={508} y={Y_L1 + 4} fontSize={11} fontWeight={700} fill={lineaViva('L1') ? AZUL : GRIS}>
              L1 → A+ directo
            </text>
            <text x={508} y={Y_L2 + 4} fontSize={11} fontWeight={700} fill={lineaViva('L2') ? AZUL : GRIS}>
              L2 → B− directo
            </text>
          </>
        )}

        {/* rodillos y su conexión a la línea */}
        {RODILLOS.map((r) => {
          const senal = daSenal(r)
          const yLinea = yDe(conCascada ? r.cuelga : 'RED')
          const enChoque =
            (r.manda === 'A−' && choqueA) || (r.manda === 'B+' && choqueB) || (r.manda === 'B−' && choqueB)
          const color = enChoque ? ROJO : senal ? AZUL : GRIS
          return (
            <g key={r.id}>
              {/* bajante hasta su línea de grupo */}
              <line x1={r.x} y1={Y_RODILLO + 12} x2={r.x} y2={yLinea} stroke={color} strokeWidth={senal ? 3 : 1.8} />
              {/* lo que manda, sólo se lee fuerte si de verdad está mandando */}
              <text
                x={r.x}
                y={Y_RODILLO - 26}
                fontSize={12}
                fontWeight={700}
                fill={enChoque ? ROJO : senal ? '#0a6b3c' : '#b7c0c9'}
                textAnchor="middle"
              >
                {senal ? `→ ${r.manda}` : r.manda}
              </text>
              <circle
                cx={r.x}
                cy={Y_RODILLO}
                r={11}
                fill={pisado[r.id] ? VERDE : '#fff'}
                stroke={enChoque ? ROJO : '#2a323b'}
                strokeWidth={2}
                style={{ transition: 'fill 250ms' }}
              />
              <text x={r.x} y={Y_RODILLO + 4} fontSize={10} fontWeight={700} fill={pisado[r.id] ? '#fff' : '#33475c'} textAnchor="middle">
                {r.id}
              </text>
              <text x={r.x} y={Y_RODILLO + 28} fontSize={9.5} fill="#5a6b7d" textAnchor="middle">
                {r.pie}
              </text>
            </g>
          )
        })}

        {/* pulsador de marcha: en modo red manda A+, en cascada conmuta la cascada */}
        <g>
          <text
            x={575}
            y={Y_RODILLO - 26}
            fontSize={12}
            fontWeight={700}
            fill={!conCascada && choqueA && senalMarcha ? ROJO : senalMarcha ? '#0a6b3c' : '#b7c0c9'}
            textAnchor="middle"
          >
            {senalMarcha ? `→ ${conCascada ? 'pasa a L1' : 'A+'}` : conCascada ? 'pasa a L1' : 'A+'}
          </text>
          <circle
            cx={575}
            cy={Y_RODILLO}
            r={11}
            fill={paso.marcha ? VERDE : '#fff'}
            stroke="#2a323b"
            strokeWidth={2}
            style={{ transition: 'fill 250ms' }}
          />
          <text x={575} y={Y_RODILLO + 28} fontSize={9.5} fill="#5a6b7d" textAnchor="middle">
            marcha
          </text>
          <line
            x1={575}
            y1={Y_RODILLO + 12}
            x2={575}
            y2={yDe(conCascada ? 'L2' : 'RED')}
            stroke={senalMarcha ? AZUL : GRIS}
            strokeWidth={senalMarcha ? 3 : 1.8}
          />
        </g>

        {/* líneas de grupo */}
        {conCascada ? (
          <>
            {(['L1', 'L2'] as Linea[]).map((l) => {
              const viva = lineaViva(l)
              const y = yDe(l)
              return (
                <g key={l}>
                  <line
                    x1={40}
                    y1={y}
                    x2={500}
                    y2={y}
                    stroke={viva ? AZUL : GRIS}
                    strokeWidth={viva ? 5 : 2.5}
                    strokeLinecap="round"
                    className={viva ? 'manguera-flujo' : undefined}
                  />
                  <text x={22} y={y + 4} fontSize={12} fontWeight={700} fill={viva ? AZUL : GRIS} textAnchor="middle">
                    {l}
                  </text>
                </g>
              )
            })}
            <text x={40} y={306} fontSize={10.5} fill="#5a6b7d">
              L1 = grupo I (A+ B+) · L2 = grupo II (B− A−) — sólo una tiene aire a la vez
            </text>
          </>
        ) : (
          <>
            <line x1={40} y1={Y_RED} x2={560} y2={Y_RED} stroke={AZUL} strokeWidth={5} strokeLinecap="round" className="manguera-flujo" />
            <text x={22} y={Y_RED + 4} fontSize={11} fontWeight={700} fill={AZUL} textAnchor="middle">
              red
            </text>
            <text x={40} y={296} fontSize={10.5} fill="#5a6b7d">
              Una sola línea, siempre con aire: todos los rodillos pisados mandan a la vez
            </text>
          </>
        )}
      </svg>

      {/* narración del paso */}
      <p
        style={{
          margin: '10px 0 0',
          padding: '0.6rem 0.8rem',
          borderRadius: 8,
          border: `1px solid ${paso.clave ? '#f0c36d' : '#dbe1e8'}`,
          background: paso.clave ? '#fdf6e3' : '#f7f9fb',
          fontSize: '0.9rem',
          lineHeight: 1.55,
          color: '#33475c',
          minHeight: '3.2em',
        }}
      >
        {paso.texto}
      </p>

      <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#5a6b7d' }}>
        <span style={{ color: VERDE, fontWeight: 700 }}>●</span> rodillo pisado ·{' '}
        <span style={{ color: AZUL, fontWeight: 700 }}>—</span> con aire (manda) ·{' '}
        <span style={{ color: GRIS, fontWeight: 700 }}>—</span> sin aire (no manda)
      </p>
    </div>
  )
}

const boton: React.CSSProperties = {
  border: '1px solid #c6ced6',
  background: '#fff',
  color: '#33475c',
  borderRadius: 8,
  padding: '0.35rem 0.7rem',
  fontSize: '0.84rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const pestana: React.CSSProperties = {
  border: 'none',
  padding: '0.38rem 0.85rem',
  fontSize: '0.84rem',
  fontWeight: 700,
  cursor: 'pointer',
}
