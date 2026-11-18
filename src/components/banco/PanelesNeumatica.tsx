/**
 * Contenido de las pestañas del panel de la derecha en Neumática: propiedades
 * de la ficha elegida, vista en corte, el registro «¿Qué está pasando?» y el
 * diagrama espacio-fase. El panel mismo es el `PanelAcoplado` de las otras unidades.
 */
import type { Motor } from '../../engine'
import DiagramaEspacioFase from '../DiagramaEspacioFase'
import Propiedades from '../Propiedades'
import VistaCorte from '../VistaCorte'

export type PestanaNeumatica = 'propiedades' | 'corte' | 'registro' | 'fase'

const suave: React.CSSProperties = { color: 'var(--tinta-suave)', margin: 0, fontSize: '0.88rem' }

/** Propiedades de la ficha elegida; los avisos del circuito quedan a la vista bajo ellas. */
export function ContenidoPropiedades({ avisos }: { avisos: string[] }) {
  return (
    <div data-inspector="propiedades">
      <Propiedades />
      {avisos.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--fondo-gris)' }} data-avisos-circuito="si">
          <h3 className="u-ayuda-tinta">Avisos del circuito ({avisos.length})</h3>
          {avisos.map((a, i) => (
            <p key={i} style={{ color: 'var(--naranjo-texto)', margin: '4px 0', fontSize: '0.85rem', lineHeight: 1.4 }}>
              ⚠ {a}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export function ContenidoCorte({ motor, hayCortes }: { motor: Motor | null; hayCortes: boolean }) {
  if (!hayCortes) return <p style={suave}>Coloca una válvula o un cilindro para ver su corte.</p>
  return (
    <div data-inspector="corte">
      <VistaCorte motor={motor} />
    </div>
  )
}

/** El registro, en orden y con lo último abajo. */
export function ContenidoRegistro({ motor, eventos }: { motor: Motor | null; eventos: Array<{ t: number; mensaje: string }> }) {
  if (eventos.length === 0)
    return <p style={suave}>{motor ? 'Simulación corriendo. Acciona una válvula para ver los eventos.' : 'Pulsa ▶ Simular y acciona las válvulas: aquí aparece lo que va ocurriendo, en orden.'}</p>
  return (
    <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', lineHeight: 1.55, fontSize: '0.88rem' }} data-registro="si">
      {eventos.map((e, i) => (
        <li key={`${e.t}-${i}`} style={{ opacity: i === eventos.length - 1 ? 1 : 0.8 }}>
          <code style={{ color: 'var(--tinta-suave)', marginRight: 8 }}>t={e.t.toFixed(1)} s</code>
          {e.mensaje}
        </li>
      ))}
    </ol>
  )
}

export function ContenidoFase({ motor }: { motor: Motor | null }) {
  return <DiagramaEspacioFase motor={motor} />
}
