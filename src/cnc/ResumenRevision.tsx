/** La revisión de un .json recién abierto: qué tiene el trabajo y qué conviene mirar. */
import { type ResumenTrabajo } from './trabajo'

export default function ResumenRevision({ archivo, alumno, resumen, onCerrar }: { archivo: string; alumno: string; resumen: ResumenTrabajo; onCerrar: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Revisión del trabajo" data-resumen-revision="si" style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,40,0.45)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 12 }} onClick={onCerrar}>
      <div style={{ background: '#fff', borderRadius: 10, maxWidth: 560, width: '100%', maxHeight: '88dvh', overflowY: 'auto', padding: '14px 16px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', flex: 1 }}>Revisión del trabajo</h2>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
        <p style={{ margin: '4px 0 10px', fontSize: '0.84rem', color: '#51606f' }}>
          {archivo}
          {alumno ? ` · ${alumno}` : ''}
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 5 }}>
          {resumen.puntos.map((r, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, fontSize: '0.88rem', color: r.ok ? '#14532d' : '#7a4f00' }}>
              <span aria-hidden>{r.ok ? '✓' : '⚠'}</span>
              <span>{r.texto}</span>
            </li>
          ))}
        </ul>
        <dl style={{ margin: '12px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', fontSize: '0.86rem' }}>
          {resumen.datos.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt style={{ color: '#51606f' }}>{k}</dt>
              <dd style={{ margin: 0 }}>{v}</dd>
            </div>
          ))}
        </dl>
        <p style={{ margin: '12px 0 0', fontSize: '0.78rem', color: '#51606f' }}>La revisión no califica: avisa de lo que conviene mirar. El programa ya está abierto para simularlo.</p>
      </div>
    </div>
  )
}
