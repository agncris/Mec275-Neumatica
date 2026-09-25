/**
 * Inspector del banco (a la derecha del lienzo): propiedades de la ficha
 * elegida y vista en corte, en pestañas. Sin nada elegido muestra los avisos
 * del circuito, para que no queden fuera de la pantalla.
 */
import type { Motor } from '../../engine'
import Propiedades from '../Propiedades'
import VistaCorte from '../VistaCorte'

export type PestanaInspector = 'propiedades' | 'corte'

interface Props {
  pestana: PestanaInspector
  onPestana: (p: PestanaInspector) => void
  onPlegar: () => void
  motor: Motor | null
  avisos: string[]
  hayCortes: boolean
}

export default function Inspector({ pestana, onPestana, onPlegar, motor, avisos, hayCortes }: Props) {
  const tabs: Array<[PestanaInspector, string]> = [
    ['propiedades', 'Propiedades'],
    ['corte', 'Vista en corte'],
  ]
  return (
    <aside aria-label="Inspector" className="banco-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div role="tablist" aria-label="Inspector" style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #e0e5eb', padding: '0 4px' }}>
        {tabs.map(([id, t]) => (
          <button
            key={id}
            role="tab"
            aria-selected={pestana === id}
            onClick={() => onPestana(id)}
            disabled={id === 'corte' && !hayCortes}
            title={id === 'corte' && !hayCortes ? 'Coloca una válvula o un cilindro para ver su corte' : undefined}
            className="pestana-panel"
          >
            {t}
          </button>
        ))}
        <button onClick={onPlegar} className="boton-icono" style={{ marginLeft: 'auto', alignSelf: 'center' }} title="Plegar el inspector" aria-label="Plegar el inspector">
          »
        </button>
      </div>
      <div style={{ overflowY: 'auto', minHeight: 0, flex: 1, padding: '10px 12px' }} data-inspector={pestana}>
        {pestana === 'propiedades' ? (
          <>
            <Propiedades />
            {avisos.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #eef1f4' }} data-avisos-circuito="si">
                <h3 style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#33475c' }}>Avisos del circuito ({avisos.length})</h3>
                {avisos.map((a, i) => (
                  <p key={i} style={{ color: '#7a4f00', margin: '4px 0', fontSize: '0.85rem', lineHeight: 1.4 }}>
                    ⚠ {a}
                  </p>
                ))}
              </div>
            )}
          </>
        ) : (
          <VistaCorte motor={motor} />
        )}
      </div>
    </aside>
  )
}
