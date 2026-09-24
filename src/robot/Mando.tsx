/**
 * Mando manual del robot (como el smartPAD de KUKA): mover el robot eje por
 * eje o en coordenadas cartesianas, grabar puntos y reproducirlos. Es el
 * «teach-in / playback» con que nacieron los robots industriales: se le
 * enseña una secuencia y después la repite.
 */
import { useState } from 'react'
import { aABC, deColumnas, escalar, mul, rad, rotX, rotY, rotZ, suma, unit, v, cruz, col, type M3, type V3 } from './matematica'
import { directa, HOME, inversa, ROBOTS, type ModeloRobot } from './robots'
import type { Herramienta } from './nodos'

export interface PuntoEnsenado {
  tipo: 'PTP' | 'LIN'
  q: number[]
  /** Salida digital que se activa (o no) al llegar. */
  salida?: { n: number; valor: boolean }
}

interface Props {
  modelo: ModeloRobot
  herramienta: Herramienta
  pedestal: number
  q: number[]
  onQ: (q: number[]) => void
  puntos: PuntoEnsenado[]
  onPuntos: (p: PuntoEnsenado[]) => void
  onModelo: (id: string) => void
  onReproducir: () => void
  reproduciendo: boolean
  onExportar: () => void
}

export default function Mando({ modelo, herramienta, pedestal, q, onQ, puntos, onPuntos, onModelo, onReproducir, reproduciendo, onExportar }: Props) {
  const [modo, setModo] = useState<'ejes' | 'mundo'>('ejes')
  const [paso, setPaso] = useState(10)
  const [aviso, setAviso] = useState<string | null>(null)
  const [salida, setSalida] = useState(false)
  const base = v(0, 0, pedestal)
  const pose = directa(modelo, q, herramienta.largo, base)
  const abc = aABC(pose.R)

  const moverEje = (k: number, d: number) => {
    const [lo, hi] = modelo.limites[k]
    const x = Math.max(lo, Math.min(hi, q[k] + d))
    if (x !== q[k] + d) setAviso(`A${k + 1} llegó a su límite (${lo}° / ${hi}°).`)
    else setAviso(null)
    onQ(q.map((y, i) => (i === k ? x : y)))
  }

  const moverCartesiano = (tcp: V3, R: M3) => {
    const s = inversa(modelo, tcp, R, herramienta.largo, q, base)
    if (s.falla === 'alcance') return setAviso('El robot no alcanza ese punto.')
    if (s.falla === 'limite') return setAviso(`Para llegar ahí, A${(s.eje ?? 0) + 1} se saldría de su rango.`)
    setAviso(s.singular ? 'Cuidado: muñeca en singularidad (A5 ≈ 0°).' : null)
    onQ(s.q)
  }

  const trasladar = (d: V3) => moverCartesiano(suma(pose.tcp, escalar(d, paso)), pose.R)
  const girar = (eje: 'A' | 'B' | 'C', signo: number) => {
    const a = rad(Math.min(paso, 15) * signo)
    const Rm = eje === 'A' ? rotZ(a) : eje === 'B' ? rotY(a) : rotX(a)
    moverCartesiano(pose.tcp, mul(Rm, pose.R))
  }
  const vertical = () => {
    // Herramienta hacia abajo, conservando el giro alrededor de Z.
    const xt = v(0, 0, -1)
    const z0 = col(pose.R, 2)
    let zt = unit(v(z0.x, z0.y, 0))
    if (Math.hypot(zt.x, zt.y) < 1e-6) zt = v(1, 0, 0)
    moverCartesiano(pose.tcp, deColumnas(xt, cruz(zt, xt), zt))
  }

  const grabar = (tipo: 'PTP' | 'LIN') => {
    onPuntos([...puntos, { tipo, q: [...q], salida: { n: 1, valor: salida } }])
  }

  const f = (x: number) => x.toFixed(1)
  const cerca = (k: number) => q[k] < modelo.limites[k][0] + 5 || q[k] > modelo.limites[k][1] - 5

  return (
    <div style={{ background: '#1f2328', color: '#e8eaed', borderRadius: 12, padding: 12, fontSize: '0.85rem' }} data-mando="si">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <strong style={{ color: '#ff8a3d' }}>Mando (teach pendant)</strong>
        <select value={modelo.id} onChange={(e) => onModelo(e.target.value)} style={{ padding: '2px 4px' }}>
          {ROBOTS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
        <span style={{ display: 'flex', gap: 2 }}>
          {(['ejes', 'mundo'] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)} style={{ ...tecla, background: modo === m ? '#ff8a3d' : '#3a4048', color: modo === m ? '#1f2328' : '#e8eaed' }}>
              {m === 'ejes' ? 'Ejes A1–A6' : 'Mundo X Y Z'}
            </button>
          ))}
        </span>
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          Paso
          <select value={paso} onChange={(e) => setPaso(Number(e.target.value))} style={{ padding: '2px 4px' }}>
            {[1, 5, 10, 50].map((x) => (
              <option key={x} value={x}>
                {x} {modo === 'ejes' ? '°' : 'mm'}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => onQ([...HOME])} style={tecla} title="Posición de referencia {0, −90, 90, 0, 0, 0}">
          HOME
        </button>
      </div>

      {modo === 'ejes' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '34px 38px 1fr 38px 64px', gap: 4, alignItems: 'center' }}>
          {q.map((x, k) => (
            <Fila key={k}>
              <strong>A{k + 1}</strong>
              <button style={tecla} onClick={() => moverEje(k, -paso)} aria-label={`A${k + 1} menos`}>
                −
              </button>
              <input
                type="range"
                min={modelo.limites[k][0]}
                max={modelo.limites[k][1]}
                step={0.5}
                value={x}
                onChange={(e) => onQ(q.map((y, i) => (i === k ? Number(e.target.value) : y)))}
                aria-label={`A${k + 1}`}
              />
              <button style={tecla} onClick={() => moverEje(k, paso)} aria-label={`A${k + 1} más`}>
                +
              </button>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: cerca(k) ? '#ff6b6b' : '#9fe0a8', textAlign: 'right' }}>{f(x)}°</span>
            </Fila>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {(
            [
              ['X', v(1, 0, 0)],
              ['Y', v(0, 1, 0)],
              ['Z', v(0, 0, 1)],
            ] as Array<[string, V3]>
          ).map(([n, d]) => (
            <div key={n} style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
              <button style={tecla} onClick={() => trasladar(escalar(d, -1))}>
                {n}−
              </button>
              <button style={tecla} onClick={() => trasladar(d)}>
                {n}+
              </button>
            </div>
          ))}
          {(['A', 'B', 'C'] as const).map((n) => (
            <div key={n} style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
              <button style={tecla} onClick={() => girar(n, -1)} title={n === 'A' ? 'Girar alrededor de Z' : n === 'B' ? 'Girar alrededor de Y' : 'Girar alrededor de X'}>
                {n}−
              </button>
              <button style={tecla} onClick={() => girar(n, 1)}>
                {n}+
              </button>
            </div>
          ))}
          <button style={{ ...tecla, gridColumn: '1 / -1' }} onClick={vertical}>
            ⊥ Herramienta vertical (apuntando hacia abajo)
          </button>
        </div>
      )}

      <div style={{ marginTop: 8, fontFamily: 'ui-monospace, Menlo, monospace', background: '#111418', borderRadius: 6, padding: '6px 8px', color: '#9fe0a8' }} data-tcp="si">
        TCP X {f(pose.tcp.x)} Y {f(pose.tcp.y)} Z {f(pose.tcp.z)} · A {f(abc.a)} B {f(abc.b)} C {f(abc.c)}
      </div>
      {aviso && <p style={{ margin: '6px 0 0', color: '#ffb86b' }}>⚠ {aviso}</p>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <button style={{ ...tecla, background: '#1668c7' }} onClick={() => grabar('PTP')} data-grabar="PTP">
          ● Grabar punto PTP
        </button>
        <button style={{ ...tecla, background: '#1668c7' }} onClick={() => grabar('LIN')} data-grabar="LIN">
          ● Grabar punto LIN
        </button>
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }} title="Estado de la salida 1 (pinza/ventosa) al llegar al punto">
          <input type="checkbox" checked={salida} onChange={(e) => setSalida(e.target.checked)} /> Salida 1 (pinza) activa
        </label>
      </div>

      <ol style={{ margin: '8px 0 0', paddingLeft: 22, maxHeight: 150, overflow: 'auto' }}>
        {puntos.map((p, i) => {
          const t = directa(modelo, p.q, herramienta.largo, base).tcp
          return (
            <li key={i} style={{ marginBottom: 2 }}>
              <button onClick={() => onQ([...p.q])} style={{ ...tecla, padding: '0 6px', marginRight: 6 }} title="Ir a este punto">
                ir
              </button>
              {p.tipo} ({f(t.x)}, {f(t.y)}, {f(t.z)}){p.salida?.valor ? ' · salida 1 ON' : ''}
            </li>
          )
        })}
        {!puntos.length && <li style={{ listStyle: 'none', marginLeft: -22, color: '#9aa4ae' }}>Mueve el robot y graba puntos: después se reproducen en orden.</li>}
      </ol>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <button style={{ ...tecla, background: '#12a35a' }} onClick={onReproducir} disabled={!puntos.length} data-reproducir="si">
          {reproduciendo ? '■ Detener' : '▶ Reproducir (playback)'}
        </button>
        <button style={tecla} onClick={() => onPuntos(puntos.slice(0, -1))} disabled={!puntos.length}>
          Borrar último
        </button>
        <button style={tecla} onClick={() => onPuntos([])} disabled={!puntos.length}>
          Borrar todo
        </button>
        <button style={tecla} onClick={onExportar} disabled={!puntos.length}>
          Exportar KRL
        </button>
      </div>
      <p style={{ margin: '8px 0 0', color: '#9aa4ae', fontSize: '0.78rem' }}>
        Herramienta: {herramienta.nombre} ({herramienta.largo} mm). Cada punto guarda los seis ejes; al reproducir, PTP mueve los ejes y LIN va en línea recta.
      </p>
    </div>
  )
}

function Fila({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

const tecla: React.CSSProperties = {
  border: '1px solid #4a525c',
  background: '#3a4048',
  color: '#e8eaed',
  borderRadius: 6,
  padding: '3px 9px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.82rem',
}

/** Convierte los ejes a la orientación del TCP (para exportar LIN). */
export function poseDe(modelo: ModeloRobot, q: number[], largo: number, pedestal: number) {
  return directa(modelo, q, largo, v(0, 0, pedestal))
}

