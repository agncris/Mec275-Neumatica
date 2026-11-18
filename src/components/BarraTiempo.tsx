import type { CSSProperties, ReactNode } from 'react'

/**
 * La barra de tiempo bajo la escena, igual en las cuatro unidades.
 * Con `total` y `onBuscar` hay deslizador para ir a un instante (Robótica, CNC).
 * Sin ellos queda el tiempo transcurrido, la velocidad y Reiniciar: así son los
 * simuladores en tiempo real (Neumática, PLC), que no pueden volver atrás.
 */
export default function BarraTiempo({
  tiempo,
  total,
  onBuscar,
  velocidad,
  velocidades,
  onVelocidad,
  onReiniciar,
  deshabilitada = false,
  extra,
}: {
  tiempo: number
  total?: number
  onBuscar?: (t: number) => void
  velocidad: number
  velocidades: number[]
  onVelocidad: (v: number) => void
  onReiniciar?: () => void
  /** Sin simulación: se ve la barra, pero sin usarse. */
  deshabilitada?: boolean
  extra?: ReactNode
}) {
  const hayTotal = total !== undefined && total > 0
  const conDeslizador = hayTotal && !!onBuscar
  return (
    <div className="reproductor-robot" data-reproductor="si">
      {conDeslizador && (
        <input
          type="range"
          min={0}
          max={total}
          step={0.01}
          value={Math.min(tiempo, total)}
          disabled={deshabilitada}
          onChange={(e) => onBuscar(Number(e.target.value))}
          style={{ flex: 1, minWidth: 140 }}
          aria-label="Tiempo de la simulación"
        />
      )}
      <span style={mono} data-tiempo-sim="si">
        {hayTotal ? `${tiempo.toFixed(1)} / ${total.toFixed(1)} s` : `${tiempo.toFixed(1)} s`}
      </span>
      {!conDeslizador && <span style={{ flex: 1 }} />}
      {onReiniciar && (
        <button type="button" onClick={onReiniciar} disabled={deshabilitada} title="Vuelve la simulación al inicio" aria-label="Reiniciar" data-reiniciar-sim="si" style={botonChico}>
          ⟲ Reiniciar
        </button>
      )}
      {extra}
      <select value={velocidad} onChange={(e) => onVelocidad(Number(e.target.value))} style={{ padding: '0.2rem', minHeight: 32 }} aria-label="Velocidad" data-velocidad-sim="si">
        {velocidades.map((x) => (
          <option key={x} value={x}>
            ×{x}
          </option>
        ))}
      </select>
    </div>
  )
}

const mono: CSSProperties = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.78rem' }
const botonChico: CSSProperties = { minHeight: 32, padding: '0 10px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--borde-suave)', background: '#fff', color: 'var(--tinta)', borderRadius: 8 }
