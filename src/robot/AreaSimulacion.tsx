import { lazy, Suspense, type CSSProperties, type MutableRefObject } from 'react'
import { Ejes } from './PanelParametros'
import type { Modo } from './datosRobot'
import type { Simulacion } from './movimiento'
import type { VistaRobot } from './Robot3D'
import type { robotPorId } from './robots'

const Robot3D = lazy(() => import('./Robot3D'))

const estadoChip: CSSProperties = { color: '#fff', borderRadius: 6, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }

/** El panel derecho: la simulación 3D con su reproductor, el alcance y los ejes. */
export default function AreaSimulacion({
  modo,
  vista,
  canvasRef,
  grabando,
  modeloVista,
  simActiva,
  errores,
  avisosSim,
  abrirAnalisis,
  reproduciendo,
  setReproduciendo,
  tRef,
  tiempo,
  setTick,
  velocidad,
  setVelocidad,
  alcance,
  setAlcance,
  qVista,
  setQMando,
}: {
  modo: Modo
  vista: MutableRefObject<VistaRobot>
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  grabando: boolean
  modeloVista: ReturnType<typeof robotPorId>
  simActiva: Simulacion | null
  errores: Simulacion['problemas']
  avisosSim: Simulacion['problemas']
  abrirAnalisis: () => void
  reproduciendo: boolean
  setReproduciendo: (f: boolean | ((r: boolean) => boolean)) => void
  tRef: MutableRefObject<number>
  tiempo: number
  setTick: (f: (n: number) => number) => void
  velocidad: number
  setVelocidad: (v: number) => void
  alcance: boolean
  setAlcance: (v: boolean) => void
  qVista: number[]
  setQMando: (q: number[]) => void
}) {
  return (
  <>
    <div className="relleno">
      <Suspense fallback={<p className="u-vacio">Montando la celda…</p>}>
        <Robot3D
          vista={vista}
          onCanvas={(c) => (canvasRef.current = c)}
          grabando={grabando}
          alto="100%"
          encabezado={
            <>
              <h2 style={{ margin: 0, fontSize: '1rem' }}>Simulación 3D</h2>
              <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--tinta-suave)' }}>{modeloVista.nombre}</span>
              {simActiva && (
                <button
                  onClick={abrirAnalisis}
                  title="Ver el análisis de la simulación"
                  style={{ ...estadoChip, border: 'none', cursor: 'pointer', background: errores.length ? 'var(--rojo-error)' : avisosSim.length ? '#a35200' : 'var(--verde)' }}
                  data-analisis={errores.length ? 'error' : avisosSim.length ? 'aviso' : 'ok'}
                >
                  {errores.length ? `${errores.length} error(es)` : avisosSim.length ? `${avisosSim.length} aviso(s)` : 'sin problemas'}
                </button>
              )}
            </>
          }
          play={
            simActiva
              ? {
                  etiqueta: reproduciendo ? '❚❚ Pausa' : '▶ Reproducir',
                  onClick: () => {
                    if (!reproduciendo && tRef.current >= simActiva.tiempo - 1e-6) tRef.current = 0
                    setReproduciendo((r) => !r)
                  },
                  titulo: 'Recorre el programa',
                  corriendo: reproduciendo,
                }
              : { etiqueta: '▶ Reproducir', onClick: () => {}, deshabilitado: true, titulo: 'Arma un programa para simular' }
          }
        />
      </Suspense>
    </div>
    {simActiva ? (
      <div className="reproductor-robot" data-reproductor="si">
        <input
          type="range"
          min={0}
          max={simActiva.tiempo}
          step={0.01}
          value={Math.min(tiempo, simActiva.tiempo)}
          onChange={(e) => {
            tRef.current = Number(e.target.value)
            setTick((n) => n + 1)
          }}
          style={{ flex: 1, minWidth: 140 }}
          aria-label="Tiempo de la simulación"
        />
        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.78rem' }}>
          {tiempo.toFixed(1)} / {simActiva.tiempo.toFixed(1)} s
        </span>
        <select value={velocidad} onChange={(e) => setVelocidad(Number(e.target.value))} style={{ padding: '0.2rem', minHeight: 32 }} aria-label="Velocidad">
          {[0.5, 1, 2, 5, 10].map((x) => (
            <option key={x} value={x}>
              ×{x}
            </option>
          ))}
        </select>
      </div>
    ) : (
      <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--tinta-suave)' }}>
        {modo === 'visual'
          ? 'Cuando el Core tenga comandos, robot y herramienta, aquí aparece el reproductor.'
          : 'Mueve los ejes de abajo, graba puntos en el mando y pulsa «Reproducir».'}
      </p>
    )}
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8rem', color: 'var(--tinta-suave)' }}>
        <input type="checkbox" checked={alcance} onChange={(e) => setAlcance(e.target.checked)} /> Alcance
      </label>
    </div>
    <Ejes
      modelo={modeloVista}
      q={qVista}
      uso={simActiva?.uso ?? null}
      onQ={
        modo === 'mando'
          ? (q) => {
              setReproduciendo(false)
              setQMando(q)
            }
          : undefined
      }
    />
  </>
  )
}
