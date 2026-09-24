/**
 * Diagrama espacio-fase (recorrido-tiempo): la representación normalizada con
 * la que se leen y diseñan las secuencias neumáticas. Registra la posición del
 * vástago de cada cilindro mientras corre la simulación y la dibuja como una
 * línea 0 (retraído) / 1 (extendido), marcando los movimientos A+ y A−.
 */
import { useEffect, useRef, useState } from 'react'
import { diagramaPorPasos } from '../diagramaPasos'
import { esActuador } from '../engine'
import type { Motor } from '../engine'

interface Muestra {
  t: number
  pos: Record<string, number>
}

/** Ventana de tiempo visible, en segundos. */
const VENTANA = 20
const PERIODO_MUESTREO = 0.05
const ALTO_PISTA = 68
const MARGEN_IZQ = 74
const ANCHO = 620

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']

export default function DiagramaEspacioFase({ motor }: { motor: Motor | null }) {
  const historia = useRef<Muestra[]>([])
  const [, redibujar] = useState(0)
  const [modoEje, setModoEje] = useState<'pasos' | 'tiempo'>('pasos')

  const cilindros = motor
    ? motor.circuito.componentes.filter((c) => esActuador(c.tipo)).map((c) => c.id)
    : []

  // Cada motor nuevo (cada pulsación de ▶ Simular) arranca un registro limpio
  useEffect(() => {
    historia.current = []
    redibujar((n) => n + 1)
  }, [motor])

  useEffect(() => {
    if (!motor) return
    const ultima = historia.current[historia.current.length - 1]
    if (ultima && motor.t - ultima.t < PERIODO_MUESTREO) return
    const pos: Record<string, number> = {}
    for (const id of cilindros) {
      pos[id] = motor.estadoDe<{ posicion?: number }>(id).posicion ?? 0
    }
    historia.current.push({ t: motor.t, pos })
    // Conservamos algo más que la ventana para que el trazo entre suave
    const limite = motor.t - VENTANA * 1.2
    while (historia.current.length > 2 && historia.current[0].t < limite) {
      historia.current.shift()
    }
    redibujar((n) => n + 1)
  })

  if (!motor || cilindros.length === 0) {
    return (
      <p style={{ color: '#5a6b7d', margin: 0, fontSize: '0.9rem' }}>
        Pulsa <strong>▶ Simular</strong> con al menos un cilindro en la pizarra para ver aquí su
        diagrama de recorrido-tiempo.
      </p>
    )
  }

  const tFin = Math.max(motor.t, VENTANA)
  const tIni = tFin - VENTANA
  const x = (t: number) => MARGEN_IZQ + ((t - tIni) / VENTANA) * (ANCHO - MARGEN_IZQ - 12)
  const alto = cilindros.length * ALTO_PISTA + 30

  const muestras = historia.current.filter((m) => m.t >= tIni - PERIODO_MUESTREO * 2)

  const selector = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: '0.8rem', color: '#5a6b7d' }}>Eje horizontal:</span>
      {(
        [
          ['pasos', 'Pasos (desplazamiento-paso)'],
          ['tiempo', 'Tiempo'],
        ] as const
      ).map(([m, etiqueta]) => (
        <button
          key={m}
          onClick={() => setModoEje(m)}
          style={{
            border: '1px solid #c6ced6',
            borderRadius: 6,
            padding: '0.15rem 0.55rem',
            fontSize: '0.78rem',
            cursor: 'pointer',
            background: modoEje === m ? '#33475c' : '#fff',
            color: modoEje === m ? '#fff' : '#33475c',
          }}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  )

  if (modoEje === 'pasos') {
    const actuadores = cilindros.map((id, i) => ({ id, letra: LETRAS[i] ?? id }))
    const { inicial, pasos } = diagramaPorPasos(historia.current, actuadores)
    const n = Math.max(pasos.length, 1)
    const anchoPaso = Math.min(90, (ANCHO - MARGEN_IZQ - 20) / n)
    const xPaso = (k: number) => MARGEN_IZQ + k * anchoPaso
    const altoP = cilindros.length * ALTO_PISTA + 34
    return (
      <div style={{ overflowX: 'auto' }}>
        {selector}
        {pasos.length === 0 ? (
          <p style={{ color: '#5a6b7d', margin: 0, fontSize: '0.88rem' }}>
            Acciona el circuito: cada vez que un actuador complete una carrera aparecerá un paso.
          </p>
        ) : (
          <svg id="diagrama-fase-svg" viewBox={`0 0 ${ANCHO} ${altoP}`} style={{ width: '100%', minWidth: 380, height: 'auto', display: 'block' }}>
            {/* rejilla de pasos */}
            {Array.from({ length: pasos.length + 1 }, (_, k) => (
              <g key={`g${k}`}>
                <line x1={xPaso(k)} y1={8} x2={xPaso(k)} y2={altoP - 22} stroke="#dbe1e8" strokeWidth={1} />
                {k > 0 && (
                  <text x={xPaso(k) - anchoPaso / 2} y={altoP - 6} fontSize={10} fill="#5f6b78" textAnchor="middle">
                    {k}
                  </text>
                )}
              </g>
            ))}
            {cilindros.map((id, i) => {
              const yTop = i * ALTO_PISTA + 12
              const yBase = yTop + 32
              const y = (v: number) => yBase - v * 32
              const letra = LETRAS[i] ?? id
              const puntos = [`${xPaso(0)},${y(inicial[id] ?? 0)}`]
              pasos.forEach((paso, k) => {
                puntos.push(`${xPaso(k + 1)},${y(paso.estado[id] ?? 0)}`)
              })
              return (
                <g key={id}>
                  <text x={4} y={yBase - 10} fontSize={12} fontWeight={700} fill="#33475c">{letra} · {id}</text>
                  <text x={MARGEN_IZQ - 8} y={y(1) + 4} fontSize={10} fill="#5f6b78" textAnchor="end">1</text>
                  <text x={MARGEN_IZQ - 8} y={y(0) + 4} fontSize={10} fill="#5f6b78" textAnchor="end">0</text>
                  <polyline points={puntos.join(' ')} fill="none" stroke="#1668c7" strokeWidth={2.4} strokeLinejoin="round" />
                </g>
              )
            })}
            {/* movimientos de cada paso, arriba */}
            {pasos.map((paso, k) => (
              <text key={`m${k}`} x={xPaso(k) + anchoPaso / 2} y={8} fontSize={10} fontWeight={700} fill="#0a8a4a" textAnchor="middle">
                {paso.movimientos.join(' ')}
              </text>
            ))}
          </svg>
        )}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      {selector}
      <svg id="diagrama-fase-svg" viewBox={`0 0 ${ANCHO} ${alto}`} style={{ width: '100%', minWidth: 380, height: 'auto', display: 'block' }}>
        {cilindros.map((id, i) => {
          const yTop = i * ALTO_PISTA + 12
          const yBase = yTop + 32
          const y = (p: number) => yBase - p * 32
          const letra = LETRAS[i] ?? id

          const puntos = muestras
            .map((m) => `${x(m.t).toFixed(1)},${y(m.pos[id] ?? 0).toFixed(1)}`)
            .join(' ')

          // Marcas A+ / A−: instantes en que el vástago sale o entra
          const marcas: Array<{ t: number; texto: string }> = []
          for (let k = 1; k < muestras.length; k++) {
            const antes = muestras[k - 1].pos[id] ?? 0
            const ahora = muestras[k].pos[id] ?? 0
            if (antes < 0.02 && ahora >= 0.02) marcas.push({ t: muestras[k].t, texto: `${letra}+` })
            if (antes > 0.98 && ahora <= 0.98) marcas.push({ t: muestras[k].t, texto: `${letra}−` })
          }
          // Con ciclos rápidos las etiquetas se pisarían: las alternamos en altura
          const ANCHO_ETIQUETA = 22
          let ultimaX = -Infinity
          let alterna = false

          return (
            <g key={id}>
              {/* carriles 0 y 1 */}
              <line x1={MARGEN_IZQ} y1={y(1)} x2={ANCHO - 12} y2={y(1)} stroke="#dbe1e8" strokeWidth={1} />
              <line x1={MARGEN_IZQ} y1={y(0)} x2={ANCHO - 12} y2={y(0)} stroke="#dbe1e8" strokeWidth={1} />
              <text x={MARGEN_IZQ - 8} y={y(1) + 4} fontSize={10} fill="#5f6b78" textAnchor="end">1</text>
              <text x={MARGEN_IZQ - 8} y={y(0) + 4} fontSize={10} fill="#5f6b78" textAnchor="end">0</text>
              <text x={4} y={yBase - 10} fontSize={12} fontWeight={700} fill="#33475c">
                {letra} · {id}
              </text>

              {puntos && (
                <polyline points={puntos} fill="none" stroke="#1668c7" strokeWidth={2.2} strokeLinejoin="round" />
              )}

              {marcas.map((m, k) => {
                const mx = x(m.t)
                if (mx - ultimaX < ANCHO_ETIQUETA) alterna = !alterna
                else alterna = false
                ultimaX = mx
                return (
                  <g key={k}>
                    <line x1={mx} y1={y(0) + 4} x2={mx} y2={y(1) - 4} stroke="#12a35a" strokeWidth={1} strokeDasharray="3 3" />
                    <text
                      x={mx}
                      y={y(1) - (alterna ? 20 : 8)}
                      fontSize={11}
                      fontWeight={700}
                      fill="#0a8a4a"
                      textAnchor="middle"
                    >
                      {m.texto}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}

        {/* eje de tiempo */}
        <line x1={MARGEN_IZQ} y1={alto - 18} x2={ANCHO - 12} y2={alto - 18} stroke="#8a97a5" strokeWidth={1} />
        {Array.from({ length: 5 }, (_, i) => {
          const t = tIni + (VENTANA / 4) * i
          return (
            <g key={i}>
              <line x1={x(t)} y1={alto - 18} x2={x(t)} y2={alto - 14} stroke="#8a97a5" strokeWidth={1} />
              <text x={x(t)} y={alto - 4} fontSize={10} fill="#5f6b78" textAnchor="middle">
                {t.toFixed(0)} s
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
