/**
 * Diagrama espacio-fase (recorrido-tiempo): la representación normalizada con
 * la que se leen y diseñan las secuencias neumáticas. Registra la posición del
 * vástago de cada cilindro mientras corre la simulación y la dibuja como una
 * línea 0 (retraído) / 1 (extendido), marcando los movimientos A+ y A−.
 */
import { useState } from 'react'
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
/** Escala de dibujo: el diagrama no se estira más allá de esto (se lee mejor y se desplaza si no cabe). */
const ESCALA = 1.4
/** Ancho mínimo de cada paso: con secuencias largas el diagrama crece hacia el lado. */
const ANCHO_PASO_MIN = 56

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']

/**
 * Registro de la simulación, fuera del componente: se anota en cada cuadro
 * aunque el diagrama no esté a la vista, y se conserva al detener para poder
 * leerlo o exportarlo después.
 */
const registro: { motor: Motor | null; cilindros: string[]; historia: Muestra[]; t: number } = {
  motor: null,
  cilindros: [],
  historia: [],
  t: 0,
}

/** Anota la posición de los actuadores (se llama en cada cuadro de la simulación). */
export function registrarFase(motor: Motor | null): void {
  if (!motor) return
  if (registro.motor !== motor) {
    // Cada ▶ Simular empieza un registro limpio.
    registro.motor = motor
    registro.cilindros = motor.circuito.componentes.filter((c) => esActuador(c.tipo)).map((c) => c.id)
    registro.historia = []
  }
  registro.t = motor.t
  const ultima = registro.historia[registro.historia.length - 1]
  if (ultima && motor.t - ultima.t < PERIODO_MUESTREO) return
  const pos: Record<string, number> = {}
  for (const id of registro.cilindros) pos[id] = motor.estadoDe<{ posicion?: number }>(id).posicion ?? 0
  registro.historia.push({ t: motor.t, pos })
  // Conservamos algo más que la ventana para que el trazo entre suave
  const limite = motor.t - VENTANA * 1.2
  while (registro.historia.length > 2 && registro.historia[0].t < limite) registro.historia.shift()
}

/** ¿Hay un diagrama (de la simulación actual o de la última) para mostrar o exportar? */
export function hayDiagramaFase(): boolean {
  return registro.cilindros.length > 0 && registro.historia.length > 1
}

export default function DiagramaEspacioFase({ motor, idSvg = 'diagrama-fase-svg' }: { motor: Motor | null; idSvg?: string }) {
  const [modoEje, setModoEje] = useState<'pasos' | 'tiempo'>('pasos')
  registrarFase(motor)
  const cilindros = registro.cilindros
  const historia = { current: registro.historia }
  const detenida = !motor

  if (cilindros.length === 0 || (detenida && registro.historia.length < 2)) {
    return (
      <p style={{ color: '#5a6b7d', margin: 0, fontSize: '0.9rem' }}>
        Pulsa <strong>▶ Simular</strong> con al menos un cilindro en la pizarra para ver aquí su
        diagrama de recorrido-tiempo.
      </p>
    )
  }

  const tFin = Math.max(registro.t, VENTANA)
  const tIni = tFin - VENTANA
  const x = (t: number) => MARGEN_IZQ + ((t - tIni) / VENTANA) * (ANCHO - MARGEN_IZQ - 12)
  const alto = cilindros.length * ALTO_PISTA + 30

  const muestras = historia.current.filter((m) => m.t >= tIni - PERIODO_MUESTREO * 2)

  const selector = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', position: 'sticky', top: -6, left: 0, zIndex: 1, background: '#fff', padding: '4px 0' }}>
      {detenida && <span style={{ fontSize: '0.8rem', color: '#7a4f00', marginRight: 6 }}>Simulación detenida: es el diagrama de la última.</span>}
      <span style={{ fontSize: '0.8rem', color: '#51606f' }}>Eje horizontal:</span>
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
    const anchoPaso = Math.max(ANCHO_PASO_MIN, Math.min(90, (ANCHO - MARGEN_IZQ - 20) / n))
    const anchoP = Math.max(ANCHO, MARGEN_IZQ + n * anchoPaso + 20)
    const xPaso = (k: number) => MARGEN_IZQ + k * anchoPaso
    const altoP = cilindros.length * ALTO_PISTA + 34
    return (
      <div>
        {selector}
        {pasos.length === 0 ? (
          <p style={{ color: '#5a6b7d', margin: 0, fontSize: '0.88rem' }}>
            Acciona el circuito: cada vez que un actuador complete una carrera aparecerá un paso.
          </p>
        ) : (
          <svg
            id={idSvg}
            viewBox={`0 0 ${anchoP} ${altoP}`}
            data-diagrama-fase="pasos"
            style={{ width: anchoP * ESCALA, maxWidth: anchoP > ANCHO ? 'none' : '100%', minWidth: 380, height: 'auto', display: 'block' }}
          >
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
    <div>
      {selector}
      <svg id={idSvg} viewBox={`0 0 ${ANCHO} ${alto}`} data-diagrama-fase="tiempo" style={{ width: ANCHO * ESCALA, maxWidth: '100%', minWidth: 380, height: 'auto', display: 'block' }}>
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
