/**
 * Página «Estudiar» de una unidad: la teoría y las autoevaluaciones, con un
 * índice fijo a la izquierda que marca la sección que se está leyendo. Cada
 * sección tiene su enlace (#id) para compartirla o volver a ella.
 */
import { useEffect, useState, type ReactNode } from 'react'

export interface SeccionEstudio {
  id: string
  /** Nombre corto para el índice. */
  indice: string
  /** Título completo de la sección. */
  titulo: string
  contenido: ReactNode
}

interface Props {
  titulo: string
  descripcion: string
  secciones: SeccionEstudio[]
  pie: string
  /** Para lectores de pantalla. */
  etiqueta: string
}

const tarjeta: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e0e5eb',
  borderRadius: 10,
  padding: '1rem 1.25rem',
  marginTop: 12,
  boxShadow: '0 1px 3px rgba(28, 39, 51, 0.06)',
}

export default function PaginaEstudiar({ titulo, descripcion, secciones, pie, etiqueta }: Props) {
  const [actual, setActual] = useState(() => (typeof window !== 'undefined' ? window.location.hash.slice(1) : '') || secciones[0]?.id)
  // Ir a la sección del enlace (#…) al entrar.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id && document.getElementById(id)) document.getElementById(id)!.scrollIntoView()
    else window.scrollTo({ top: 0 })
  }, [])
  // Marcar en el índice la sección que se está leyendo.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActual(visible.target.id)
      },
      { rootMargin: '-60px 0px -60% 0px' },
    )
    for (const s of secciones) {
      const el = document.getElementById(s.id)
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <main className="estudiar" aria-label={etiqueta}>
      <nav className="estudiar__indice" aria-label="Índice">
        {secciones.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={actual === s.id ? 'true' : undefined}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })
              try {
                window.history.replaceState(null, '', `#${s.id}`)
              } catch {
                /* sin historial */
              }
              setActual(s.id)
            }}
          >
            {s.indice}
          </a>
        ))}
      </nav>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.4rem' }}>{titulo}</h1>
        <p style={{ margin: '0 0 12px', color: '#51606f' }}>{descripcion}</p>
        {secciones.map((s) => (
          <section key={s.id} id={s.id} style={tarjeta} aria-labelledby={`t-${s.id}`}>
            <h2 id={`t-${s.id}`} style={{ margin: '0 0 10px', fontSize: '1.1rem', color: '#1c2733' }}>
              {s.titulo}
            </h2>
            {s.contenido}
          </section>
        ))}
        <footer style={{ margin: '1.5rem 0 0.5rem', color: '#5f6b78', fontSize: '0.8rem', textAlign: 'center' }}>{pie}</footer>
      </div>
    </main>
  )
}
