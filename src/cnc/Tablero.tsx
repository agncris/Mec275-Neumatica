import { nombreHerramienta } from './maquinas'
import { type ResultadoGcode } from './gcode'
import { SimuladorCNC } from './simulador'


export default function Tablero({
  sim,
  torno,
  paso,
  ultimo,
  modal,
  tiempoTotal,
  volumen,
  volumenInicial,
}: {
  sim: SimuladorCNC
  torno: boolean
  paso: SimuladorCNC['programa']['pasos'][number] | undefined
  ultimo: SimuladorCNC['programa']['pasos'][number] | undefined
  modal: ResultadoGcode['estados'][number] | undefined
  tiempoTotal: number
  volumen: number
  volumenInicial: number
}) {
  const act = paso ?? ultimo
  // Las cotas se muestran como las ve el programa (respecto de su cero).
  const o = act?.origen ?? sim.programa.pasos[0]?.origen ?? { x: 0, y: 0, z: 0 }
  const p = { x: sim.pos.x - o.x, y: sim.pos.y - o.y, z: sim.pos.z - o.z }
  const rpm = paso && paso.husillo !== 'off' ? Math.round(paso.rpm) : 0
  const f = (v: number) => v.toFixed(3)
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const ejes: Array<[string, number]> = torno
    ? [
        ['X Ø', p.x],
        ['Z', p.z],
      ]
    : [
        ['X', p.x],
        ['Y', p.y],
        ['Z', p.z],
      ]
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }} data-dro="si">
      <div style={{ background: '#1b232c', color: '#7CFC9A', borderRadius: 8, padding: '6px 10px', fontFamily: 'ui-monospace, Menlo, monospace', minWidth: 170 }}>
        {ejes.map(([n, v]) => (
          <div key={n} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '1.05rem' }}>
            <span style={{ color: '#b9c4cf' }}>{n}</span>
            <span data-eje={n}>{f(v)}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.84rem', color: 'var(--tinta)', lineHeight: 1.6, flex: '1 1 200px' }}>
        <div>
          <strong>{act?.codigo ?? '—'}</strong> · {modal?.absoluto === false ? 'G91 incrementales' : 'G90 absolutas'} · {modal?.pulgadas ? 'pulgadas' : 'mm'}
        </div>
        <div>
          Herramienta: <strong>{nombreHerramienta(sim.config.maquina, sim.herramienta)}</strong>
        </div>
        <div>
          Husillo: <strong>{rpm ? `${rpm} rpm ${paso?.husillo === 'ccw' ? '(M04)' : '(M03)'}` : 'detenido'}</strong> · Avance:{' '}
          <strong>{paso && paso.tipo === 'corte' ? `${Math.round(paso.avance)} mm/min` : paso?.tipo === 'rapido' ? 'rápido' : '—'}</strong>
          {paso?.refrigerante ? ' · 💧 refrigerante' : ''}
        </div>
        <div>
          Tiempo: <strong>{mmss(sim.tiempo)}</strong> de {mmss(tiempoTotal)} · Material quitado:{' '}
          <strong>{volumenInicial > 0 ? Math.round(((volumenInicial - volumen) / volumenInicial) * 100) : 0}%</strong>
          {sim.pieza.tipo === 'torno' && sim.pieza.tronzada ? ' · ✂ pieza tronzada' : ''}
        </div>
      </div>
    </div>
  )
}
