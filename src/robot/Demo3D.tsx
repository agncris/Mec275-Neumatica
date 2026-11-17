/**
 * Demostraciones 3D para Estudiar: el mismo robot de la simulación, con
 * deslizadores. Sirven para ver qué hace cada eje, qué es una singularidad y
 * qué pasa cuando la pieza queda más lejos que el alcance.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { HOME, ROBOTS, cercaDelLimite, inversa, orientacionDePlano } from './robots'
import { ejesEn, simular } from './movimiento'
import type { Comando, Programa } from './nodos'
import { planoXY, v } from './matematica'
import type { VistaRobot } from './Robot3D'

const Robot3D = lazy(() => import('./Robot3D'))

const TINTA = '#33475c'
const FRESA = { tipo: 'fresa' as const, nombre: 'Fresa', largo: 120, diametro: 10 }
const MODELO = ROBOTS[0]

function vistaBase(q: number[], alcance: boolean): VistaRobot {
  return {
    modelo: MODELO,
    pedestal: 0,
    herramienta: FRESA,
    base: planoXY(v(0, 0, 0)),
    espesor: 0,
    placa: null,
    q,
    previa: { curvas: [], puntos: [], planos: [] },
    seleccion: { curvas: [], puntos: [], planos: [] },
    sim: null,
    indice: 0,
    corriendo: false,
    husillo: false,
    alcance,
    marcas: [],
  } as VistaRobot
}

const caja: CSSProperties = { border: '1px solid #e0e5eb', borderRadius: 8, background: '#fff', margin: '0 0 12px', overflow: 'hidden' }
const boton: CSSProperties = { border: '1px solid #c6ced6', background: '#fff', color: TINTA, fontWeight: 650, borderRadius: 8, padding: '0.25rem 0.7rem', cursor: 'pointer', fontSize: '0.82rem' }

function Escena({ vista }: { vista: React.MutableRefObject<VistaRobot> }) {
  return (
    <div style={{ height: 340, display: 'flex', flexDirection: 'column', padding: 8 }}>
      <Suspense fallback={<p style={{ padding: 20, color: '#51606f' }}>Montando el robot…</p>}>
        <Robot3D vista={vista} alto="100%" sinDetalle />
      </Suspense>
    </div>
  )
}

const NOMBRE_EJE = ['A1 · gira la base', 'A2 · hombro', 'A3 · codo', 'A4 · antebrazo', 'A5 · inclina la herramienta', 'A6 · gira la herramienta']
const POSE_NORMAL = [20, -70, 95, 0, 55, 0]
const SINGULAR_A5 = 0.5

/** Seis deslizadores, uno por eje. Con A5 en 0° se ve la singularidad de la muñeca. */
export function DemoEjes() {
  const [q, setQ] = useState<number[]>(POSE_NORMAL)
  const vista = useRef<VistaRobot>(vistaBase(q, false))
  vista.current.q = q
  const cerca = cercaDelLimite(MODELO, q, 3)
  const singular = Math.abs(q[4]) < 3
  const poner = (k: number, x: number) => setQ((a) => a.map((y, i) => (i === k ? x : y)))
  return (
    <figure style={caja} data-demo-ejes="si">
      <Escena vista={vista} />
      <div style={{ padding: '4px 12px 12px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 8px' }}>
          <button type="button" style={boton} onClick={() => setQ(POSE_NORMAL)}>Pose normal</button>
          <button type="button" style={boton} onClick={() => setQ((a) => [a[0], a[1], a[2], 40, SINGULAR_A5, -40])} data-ir-singularidad="si">
            Llevar A5 a 0° (singularidad)
          </button>
        </div>
        {q.map((x, k) => (
          <label key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr 52px', gap: 8, alignItems: 'center', fontSize: '0.82rem', color: cerca.includes(k) ? '#a35200' : TINTA, margin: '2px 0' }}>
            <span style={{ fontWeight: 650 }}>{NOMBRE_EJE[k]}</span>
            <input type="range" min={MODELO.limites[k][0]} max={MODELO.limites[k][1]} step={1} value={x} onChange={(e) => poner(k, Number(e.target.value))} aria-label={NOMBRE_EJE[k]} />
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round(x)}°</span>
          </label>
        ))}
        <p role="status" style={{ margin: '8px 0 0', fontSize: '0.86rem', lineHeight: 1.45, padding: '6px 8px', borderRadius: 6, background: singular ? '#fff4e0' : '#eef6f1', border: `1px solid ${singular ? '#f0c987' : '#cfe5d8'}`, color: singular ? '#6b4200' : '#1d5a3a' }}>
          {singular
            ? 'Singularidad: con A5 en 0°, A4 y A6 quedan alineados. Mueve A4 y mira que la herramienta no cambia: da igual cuál gire. El robot perdió un grado de libertad.'
            : 'A1, A2 y A3 llevan la muñeca a su lugar. A4, A5 y A6 orientan la herramienta. Lleva A5 a 0° para ver la singularidad.'}
          {cerca.length > 0 && ` Cerca del límite: ${cerca.map((k) => `A${k + 1}`).join(', ')}.`}
        </p>
      </div>
    </figure>
  )
}

const ZETA = 120

/** La pieza se aleja hasta que el robot no llega. El robot llega con el centro de la muñeca, no con la herramienta. */
export function DemoAlcance() {
  const [d, setD] = useState(500)
  const R = useMemo(() => orientacionDePlano(planoXY(v(0, 0, 0))), [])
  const ultima = useRef<number[]>([0, -90, 90, 0, 90, 0])
  const sol = inversa(MODELO, v(d, 0, ZETA), R, FRESA.largo, ultima.current, v(0, 0, 0))
  const llega = sol.falla === null
  if (llega) ultima.current = sol.q
  const vista = useRef<VistaRobot>(vistaBase(ultima.current, true))
  vista.current.q = ultima.current
  vista.current.marcas = [v(d, 0, ZETA)]
  return (
    <figure style={caja} data-demo-alcance="si">
      <Escena vista={vista} />
      <div style={{ padding: '4px 12px 12px' }}>
        <label style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr 64px', gap: 8, alignItems: 'center', fontSize: '0.82rem', color: TINTA }}>
          <span style={{ fontWeight: 650 }}>Distancia de la pieza</span>
          <input type="range" min={250} max={1200} step={10} value={d} onChange={(e) => setD(Number(e.target.value))} aria-label="Distancia de la pieza a la base" />
          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d} mm</span>
        </label>
        <p role="status" style={{ margin: '8px 0 0', fontSize: '0.86rem', lineHeight: 1.45, padding: '6px 8px', borderRadius: 6, background: llega ? '#eef6f1' : '#fdecea', border: `1px solid ${llega ? '#cfe5d8' : '#f3c1bc'}`, color: llega ? '#1d5a3a' : '#8a1c14' }}>
          {llega
            ? `Llega. La esfera azul es el alcance del ${MODELO.nombre.split(' (')[0]} (${MODELO.alcance} mm hasta la muñeca). La herramienta sigue más allá, pero el límite lo pone la muñeca.`
            : sol.falla === 'limite'
              ? `No llega: el eje A${(sol.eje ?? 0) + 1} se sale de su rango.`
              : `No llega: la muñeca tendría que estar a más de ${MODELO.alcance} mm de la base.`}
        </p>
      </div>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// PTP, LIN y CIR entre los mismos dos puntos
// ---------------------------------------------------------------------------
export type Modo = 'PTP' | 'LIN' | 'CIR'
const COLOR_MODO: Record<Modo, string> = { PTP: '#d85a0e', LIN: '#0e7a43', CIR: '#1668c7' }
const TEXTO_MODO: Record<Modo, string> = {
  PTP: 'PTP: cada eje se mueve a su ritmo y llegan juntos. La herramienta dibuja una curva que no controlas. Sirve para acercarse y alejarse en el aire.',
  LIN: 'LIN: la herramienta sigue una línea recta. Es lo que se usa para cortar en recta.',
  CIR: 'CIR: la herramienta pasa por un punto auxiliar y dibuja un arco. Se usa para cortar curvas.',
}
const P0 = v(480, -220, 220)
const P1 = v(480, 220, 220)
const AUX = v(620, 0, 220)

function programaDe(modo: Modo): Programa {
  const mover: Comando[] = [{ tipo: 'PTP', plano: planoXY(P0), vel: 40, nodo: 'a' }]
  if (modo === 'PTP') mover.push({ tipo: 'PTP', plano: planoXY(P1), vel: 40, nodo: 'b' })
  else if (modo === 'LIN') mover.push({ tipo: 'LIN', plano: planoXY(P1), vel: 0.1, nodo: 'b' })
  else mover.push({ tipo: 'CIR', aux: planoXY(AUX), plano: planoXY(P1), vel: 0.1, nodo: 'b' })
  return { comandos: mover, robot: { modelo: MODELO, pedestal: 0 }, herramienta: FRESA, base: planoXY(v(0, 0, 0)), espesor: 0, inicio: [0, -90, 90, 0, 0, 0], nodo: 'demo' }
}

/** El tramo que importa (de P0 a P1) de cada modo: la simulación, el recorrido de la punta y cuándo empieza. */
export function tramoDemo(modo: Modo) {
  const sim = simular(programaDe(modo))
  const ms = sim.muestras.filter((m) => m.cmd >= 1)
  const t0 = ms.length ? ms[0].t : 0
  return { sim, t0, dur: Math.max(0.1, sim.tiempo - t0), traza: ms.map((m) => m.tcp) }
}

export function DemoMovimientos() {
  const tramos = useMemo(() => ({ PTP: tramoDemo('PTP'), LIN: tramoDemo('LIN'), CIR: tramoDemo('CIR') }), [])
  const [modo, setModo] = useState<Modo>('LIN')
  const [p, setP] = useState(0)
  const [corre, setCorre] = useState(false)
  const vista = useRef<VistaRobot>(vistaBase([...HOME], false))
  const T = tramos[modo]
  const otros = (['PTP', 'LIN', 'CIR'] as Modo[]).filter((m) => m !== modo)
  vista.current.q = ejesEn(T.sim, T.t0 + p * T.dur).q
  vista.current.seleccion = { curvas: [T.traza], puntos: [], planos: [] }
  vista.current.previa = { curvas: otros.map((m) => tramos[m].traza), puntos: [], planos: [] }
  vista.current.marcas = []
  useEffect(() => {
    if (!corre) return
    let cuadro = 0
    let antes = performance.now()
    const tick = (ahora: number) => {
      const dt = (ahora - antes) / 1000
      antes = ahora
      setP((x) => {
        const y = x + dt / (T.dur * 1.2)
        if (y >= 1) {
          setCorre(false)
          return 1
        }
        return y
      })
      cuadro = requestAnimationFrame(tick)
    }
    cuadro = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(cuadro)
  }, [corre, T])
  return (
    <figure style={caja} data-demo-movimientos="si">
      <Escena vista={vista} />
      <div style={{ padding: '4px 12px 12px' }}>
        <div role="group" aria-label="Tipo de movimiento" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 8px', alignItems: 'center' }}>
          {(['PTP', 'LIN', 'CIR'] as Modo[]).map((m) => (
            <button key={m} type="button" aria-pressed={modo === m} onClick={() => { setModo(m); setP(0); setCorre(false) }} style={{ ...boton, background: modo === m ? COLOR_MODO[m] : '#fff', color: modo === m ? '#fff' : TINTA, borderColor: COLOR_MODO[m] }}>
              {m}
            </button>
          ))}
          <button type="button" style={boton} onClick={() => { if (p >= 1) setP(0); setCorre((c) => !c) }} data-demo-play="si">
            {corre ? 'Pausar' : p >= 1 ? 'Repetir' : 'Reproducir'}
          </button>
        </div>
        <input type="range" min={0} max={1} step={0.005} value={p} onChange={(e) => { setCorre(false); setP(Number(e.target.value)) }} aria-label="Avance del movimiento" style={{ width: '100%' }} />
        <p role="status" style={{ margin: '8px 0 0', fontSize: '0.86rem', lineHeight: 1.45, padding: '6px 8px', borderRadius: 6, background: '#f7f9fb', border: '1px solid #e0e5eb', color: '#26323f' }}>
          <strong style={{ color: COLOR_MODO[modo] }}>{TEXTO_MODO[modo].split(':')[0]}</strong>
          {TEXTO_MODO[modo].slice(TEXTO_MODO[modo].indexOf(':'))} La línea verde es el recorrido de este movimiento; las rojas, el de los otros dos.
        </p>
      </div>
    </figure>
  )
}
