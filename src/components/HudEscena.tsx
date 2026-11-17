/**
 * Controles que viven dentro de la simulación al ponerla a pantalla completa:
 * el play (la barra de la unidad queda fuera) y el mando de la cámara.
 */
import type { CSSProperties } from 'react'
import { botonPrimario } from './ui'
import type { ModoArrastre, VistaCamara } from './mandoCamara'

export interface PlayEscena {
  etiqueta: string
  onClick: () => void
  titulo?: string
  deshabilitado?: boolean
  /** La simulación ya está corriendo: el botón pasa a detener o pausar. */
  corriendo?: boolean
}

const AYUDA: Record<ModoArrastre, string> = {
  girar: 'Arrastra para girar alrededor',
  mover: 'Arrastra para desplazar la vista',
  zoom: 'Arrastra arriba o abajo para acercar · o usa + y −',
}

const VISTAS: Array<{ id: VistaCamara; etiqueta: string }> = [
  { id: 'arriba', etiqueta: 'Arriba' },
  { id: 'lado', etiqueta: 'Lado' },
  { id: 'iso', etiqueta: '3D' },
  { id: 'frente', etiqueta: 'Frente' },
]

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

export function BotonPlayEscena({ play }: { play: PlayEscena }) {
  return (
    <button
      type="button"
      onClick={play.onClick}
      disabled={play.deshabilitado}
      title={play.titulo}
      data-play-escena="si"
      style={{
        ...botonPrimario(!!play.corriendo),
        boxShadow: '0 2px 8px rgba(28,39,51,0.25)',
        opacity: play.deshabilitado ? 0.5 : 1,
      }}
    >
      {play.etiqueta}
    </button>
  )
}

export default function HudEscena({
  play,
  vista,
  onVista,
  modo,
  onModo,
  onZoom,
}: {
  play?: PlayEscena
  vista?: VistaCamara
  onVista?: (v: VistaCamara) => void
  modo: ModoArrastre
  onModo: (m: ModoArrastre) => void
  onZoom: (acercar: boolean) => void
}) {
  return (
    <>
      <div style={mando} data-mando-camara="si">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, justifyItems: 'center' }}>
          <span />
          <VistaBoton id="arriba" actual={vista} onVista={onVista} />
          <span />
          <VistaBoton id="lado" actual={vista} onVista={onVista} />
          <VistaBoton id="iso" actual={vista} onVista={onVista} />
          <VistaBoton id="frente" actual={vista} onVista={onVista} />
        </div>
        <div role="group" aria-label="Qué hace el arrastre" style={{ display: 'flex', gap: 4 }}>
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
                background: modo === id ? '#33475c' : 'rgba(255,255,255,0.95)',
                color: modo === id ? '#fff' : '#33475c',
                fontWeight: 600,
              }}
            >
              {texto}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Acercar o alejar" style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={() => onZoom(false)} title="Alejar" aria-label="Alejar" style={{ ...chip, flex: 1, fontWeight: 700 }}>
            −
          </button>
          <button type="button" onClick={() => onZoom(true)} title="Acercar" aria-label="Acercar" style={{ ...chip, flex: 1, fontWeight: 700 }}>
            +
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.72rem', color: '#51606f', lineHeight: 1.3 }}>{AYUDA[modo]}</p>
      </div>
      {play && (
        <div style={{ position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 4 }}>
          <BotonPlayEscena play={play} />
        </div>
      )}
    </>
  )
}

function VistaBoton({ id, actual, onVista }: { id: VistaCamara; actual?: VistaCamara; onVista?: (v: VistaCamara) => void }) {
  const etiqueta = VISTAS.find((v) => v.id === id)?.etiqueta ?? id
  const activo = actual === id
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={() => onVista?.(id)}
      style={{
        ...chip,
        minWidth: 64,
        background: activo ? '#33475c' : 'rgba(255,255,255,0.95)',
        color: activo ? '#fff' : '#33475c',
        fontWeight: 600,
      }}
    >
      {etiqueta}
    </button>
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
