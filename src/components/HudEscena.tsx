/**
 * El mando de la cámara dentro de la simulación a pantalla completa.
 * El play va aparte (PlayEscena) y está siempre.
 */
import type { CSSProperties } from 'react'
import type { ModoArrastre, VistaCamara } from './mandoCamara'

const AYUDA: Record<ModoArrastre, string> = {
  girar: 'Arrastra para girar alrededor',
  mover: 'Arrastra para desplazar la vista',
  zoom: 'Arrastra arriba o abajo para acercar · o usa + y −',
}

const chip: CSSProperties = {
  border: '1px solid #c6ced6',
  background: 'rgba(255,255,255,0.95)',
  color: '#33475c',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: '0.78rem',
  cursor: 'pointer',
  minHeight: 32,
}

export default function HudEscena({
  modo,
  onModo,
  onZoom,
}: {
  /** Ya no se usan: las vistas están en el cubo de vistas. Se aceptan para no romper a quien las pase. */
  vista?: VistaCamara
  onVista?: (v: VistaCamara) => void
  modo: ModoArrastre
  onModo: (m: ModoArrastre) => void
  onZoom: (acercar: boolean) => void
}) {
  return (
    <>
      <div style={mando} data-mando-camara="si">
        <div role="group" aria-label="Qué hace el arrastre" className="u-fila-4">
          {(
            [
              ['girar', 'Girar'],
              ['mover', 'Mover'],
              ['zoom', 'Zoom'],
            ] as Array<[ModoArrastre, string]>
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              aria-pressed={modo === id}
              onClick={() => onModo(id)}
              style={{
                ...chip,
                flex: 1,
                background: modo === id ? 'var(--tinta)' : 'rgba(255,255,255,0.95)',
                color: modo === id ? '#fff' : 'var(--tinta)',
                fontWeight: 600,
              }}
            >
              {texto}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Acercar o alejar" className="u-fila-4">
          <button type="button" onClick={() => onZoom(false)} title="Alejar" aria-label="Alejar" style={{ ...chip, flex: 1, fontWeight: 700 }}>
            −
          </button>
          <button type="button" onClick={() => onZoom(true)} title="Acercar" aria-label="Acercar" style={{ ...chip, flex: 1, fontWeight: 700 }}>
            +
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--tinta-suave)', lineHeight: 1.3 }}>{AYUDA[modo]}</p>
      </div>
    </>
  )
}

const mando: CSSProperties = {
  position: 'absolute',
  left: 8,
  bottom: 72,
  zIndex: 4,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  width: 228,
  padding: 8,
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid #d0d5db',
  borderRadius: 10,
  boxShadow: '0 1px 4px rgba(28,39,51,0.15)',
}
