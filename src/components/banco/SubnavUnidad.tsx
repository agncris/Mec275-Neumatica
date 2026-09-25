/**
 * Navegación de segundo nivel de una unidad: «Laboratorio» (el banco de
 * trabajo) y «Estudiar» (la teoría). En el computador va en la barra superior;
 * en el celular, justo debajo. La URL dice dónde está el alumno (?vista=estudiar
 * y el #ancla de la sección), para compartir el enlace o volver.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useEsEstrecha } from '../ui'

export type SeccionUnidad = 'laboratorio' | 'estudiar'

/** Sección actual, sincronizada con la URL. `anclas`: ids de las secciones de estudio. */
export function useSeccionUnidad(anclas: string[]): [SeccionUnidad, (s: SeccionUnidad) => void] {
  const [seccion, setSeccion] = useState<SeccionUnidad>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('vista') === 'estudiar' ? 'estudiar' : 'laboratorio',
  )
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (seccion === 'estudiar') url.searchParams.set('vista', 'estudiar')
      else url.searchParams.delete('vista')
      if (seccion !== 'estudiar' && anclas.includes(url.hash.slice(1))) url.hash = ''
      if (url.href !== window.location.href) window.history.replaceState(null, '', url)
    } catch {
      /* sin historial */
    }
    window.scrollTo({ top: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccion])
  return [seccion, setSeccion]
}

interface PropsSubnav {
  nombre: string
  seccion: SeccionUnidad
  onSeccion: (s: SeccionUnidad) => void
  extra?: ReactNode
  /** Botón «Entregar»: abre o cierra el cajón de la entrega. */
  entregar?: { abierto: boolean; onAlternar: () => void }
}

export default function SubnavUnidad({ nombre, seccion, onSeccion, extra, entregar }: PropsSubnav) {
  const estrecha = useEsEstrecha()
  const [ranura, setRanura] = useState<HTMLElement | null>(null)
  useEffect(() => setRanura(document.getElementById('barra-unidad')), [])
  const nav = (
    <nav className="subnav" aria-label={nombre} style={estrecha ? { borderBottom: '1px solid #e0e5eb', margin: '0 -10px', padding: '0 10px', background: '#fff' } : undefined}>
      <button aria-current={seccion === 'laboratorio' ? 'page' : undefined} onClick={() => onSeccion('laboratorio')} data-seccion="laboratorio">
        Laboratorio
      </button>
      <button aria-current={seccion === 'estudiar' ? 'page' : undefined} onClick={() => onSeccion('estudiar')} data-seccion="estudiar">
        Estudiar
      </button>
      {extra}
      {entregar && (
        <button
          className="subnav__entrega"
          aria-expanded={entregar.abierto}
          onClick={() => {
            onSeccion('laboratorio')
            entregar.onAlternar()
          }}
          data-abrir-entrega="si"
          title="Descarga lo que pegas en tu presentación y el archivo que subes con tu tarea"
        >
          Entregar
        </button>
      )}
    </nav>
  )
  if (estrecha) return <div style={{ padding: '0 10px' }}>{nav}</div>
  return ranura ? createPortal(nav, ranura) : null
}
