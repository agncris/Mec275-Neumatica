/**
 * El play que vive dentro de la simulación, abajo a la izquierda. Es el mismo en
 * las cuatro unidades: verde con ▶ al partir, naranjo con ❚❚ (pausa) o ■ (parar)
 * mientras corre.
 */
export interface PlayEscena {
  /** Texto de la barra de arriba. Aquí solo se usa como pista si falta `titulo`. */
  etiqueta: string
  onClick: () => void
  titulo?: string
  deshabilitado?: boolean
  /** La simulación ya está corriendo: el botón pasa a pausa o parar. */
  corriendo?: boolean
  /** Al correr muestra ■ (parar y volver al inicio) en vez de ❚❚ (pausa). */
  detiene?: boolean
}

export function BotonPlayEscena({ play }: { play: PlayEscena }) {
  const corre = !!play.corriendo
  const glifo = corre ? (play.detiene ? '■' : '❚❚') : '▶'
  const nombre = corre ? (play.detiene ? 'Parar' : 'Pausa') : 'Reproducir'
  return (
    <button
      type="button"
      onClick={play.onClick}
      disabled={play.deshabilitado}
      title={play.titulo ?? play.etiqueta}
      aria-label={nombre}
      data-play-escena="si"
      data-play="si"
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        zIndex: 4,
        width: 46,
        height: 46,
        borderRadius: 12,
        border: 'none',
        background: corre ? '#ffa726' : 'var(--verde)',
        color: corre ? 'var(--texto)' : '#fff',
        fontSize: '1.15rem',
        lineHeight: 1,
        cursor: play.deshabilitado ? 'default' : 'pointer',
        opacity: play.deshabilitado ? 0.45 : 1,
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
      }}
    >
      {glifo}
    </button>
  )
}
