/**
 * Sección plegable que sólo monta su contenido cuando está abierta.
 *
 * Con <details> el navegador oculta los hijos pero React los sigue
 * reconciliando en cada fotograma. Como la simulación repinta a 30 Hz, las
 * secciones de teoría (que llegan a tener decenas de símbolos SVG) hundían el
 * rendimiento aunque estuviesen cerradas. Al montarlas sólo al abrirlas, una
 * sección cerrada no cuesta nada, y `memo` evita repintarlas mientras corre la
 * simulación si no ha cambiado nada dentro.
 */
import { memo, useState, type ReactNode } from 'react'

interface Props {
  titulo: string
  children: ReactNode
}

function SeccionBase({ titulo, children }: Props) {
  const [abierta, setAbierta] = useState(false)
  return (
    <div>
      <button
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '1rem',
          fontWeight: 600,
          color: '#33475c',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: '0.8rem', color: '#5f6b78' }}>{abierta ? '▼' : '▶'}</span>
        {titulo}
      </button>
      {abierta && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  )
}

export const Seccion = memo(SeccionBase)
