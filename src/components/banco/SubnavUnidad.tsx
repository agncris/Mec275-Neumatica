/**
 * Navegación de segundo nivel de una unidad: «Laboratorio» (el banco de
 * trabajo), la tarea de la unidad si la tiene (su banco aparte, con la planta
 * de la tarea) y «Estudiar» (la teoría). En el computador va en la barra superior;
 * en el celular, justo debajo. La URL dice dónde está el alumno (?vista=estudiar
 * y el #ancla de la sección), para compartir el enlace o volver.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useApaisado, useEsEstrecha } from '../ui'

export type SeccionUnidad = 'laboratorio' | 'tarea' | 'estudiar'

/** Sección actual, sincronizada con la URL. `anclas`: ids de las secciones de estudio. */
export function useSeccionUnidad(anclas: string[]): [SeccionUnidad, (s: SeccionUnidad) => void] {
  const [seccion, setSeccion] = useState<SeccionUnidad>(seccionDeLaUrl)
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (seccion !== 'laboratorio') url.searchParams.set('vista', seccion)
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

/** La sección que pide la URL (?vista=estudiar o ?vista=tarea). */
export function seccionDeLaUrl(): SeccionUnidad {
  if (typeof window === 'undefined') return 'laboratorio'
  const v = new URLSearchParams(window.location.search).get('vista')
  return v === 'estudiar' || v === 'tarea' ? v : 'laboratorio'
}

interface PropsSubnav {
  nombre: string
  seccion: SeccionUnidad
  onSeccion: (s: SeccionUnidad) => void
  extra?: ReactNode
  /** Pestaña de la tarea de la unidad (p. ej. «Tarea 2»), junto a «Laboratorio». */
  tarea?: string
  /** Botón «Entregar»: abre o cierra el cajón de la entrega. */
  entregar?: { abierto: boolean; onAlternar: () => void; etiqueta?: string; etiquetaCorta?: string }
}

export default function SubnavUnidad({ nombre, seccion, onSeccion, extra, tarea, entregar }: PropsSubnav) {
  // Acostado, la subnavegación va en la misma fila que las unidades (se ahorra una fila de alto).
  const angosta = useEsEstrecha()
  const apaisado = useApaisado()
  const estrecha = angosta && !apaisado
  const [ranura, setRanura] = useState<HTMLElement | null>(null)
  useEffect(() => setRanura(document.getElementById('barra-unidad')), [])
  const nav = (
    <nav className="subnav" aria-label={nombre} style={estrecha ? { borderBottom: '1px solid #e0e5eb', margin: '0 -10px', padding: '0 10px', background: '#fff' } : undefined}>
      <button aria-current={seccion === 'laboratorio' ? 'page' : undefined} onClick={() => onSeccion('laboratorio')} data-seccion="laboratorio">
        Laboratorio
      </button>
      {tarea && (
        <button aria-current={seccion === 'tarea' ? 'page' : undefined} onClick={() => onSeccion('tarea')} data-seccion="tarea" className="subnav__tarea">
          {tarea}
        </button>
      )}
      <button aria-current={seccion === 'estudiar' ? 'page' : undefined} onClick={() => onSeccion('estudiar')} data-seccion="estudiar">
        Estudiar
      </button>
      {extra}
      {entregar && (
        <button
          className="subnav__entrega"
          aria-expanded={entregar.abierto}
          onClick={() => {
            if (!tarea) onSeccion('laboratorio')
            entregar.onAlternar()
          }}
          data-abrir-entrega="si"
          title="Descarga lo que pegas en tu PDF y el archivo que subes con tu tarea"
        >
          {angosta && entregar.etiquetaCorta ? entregar.etiquetaCorta : entregar.etiqueta ?? 'Entregar'}
        </button>
      )}
    </nav>
  )
  if (estrecha) return <div style={{ padding: '0 10px' }}>{nav}</div>
  return ranura ? createPortal(nav, ranura) : null
}
