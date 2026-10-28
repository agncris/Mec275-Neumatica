/**
 * Pantalla completa para una vista 3D: el contenedor que se pasa ocupa toda la
 * pantalla y vuelve a su tamaño al salir (con el mismo botón o con Esc).
 */
import { useEffect, useState, type CSSProperties, type RefObject } from 'react'
import { useCelular } from './ui'

export function usePantallaCompleta(ref: RefObject<HTMLElement>): [boolean, () => void] {
  const [activa, setActiva] = useState(false)
  useEffect(() => {
    const alCambiar = () => setActiva(!!ref.current && document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', alCambiar)
    return () => document.removeEventListener('fullscreenchange', alCambiar)
  }, [ref])
  const alternar = () => {
    const c = ref.current
    if (!c) return
    if (document.fullscreenElement === c) void document.exitFullscreen()
    else void c.requestFullscreen?.().catch(() => setActiva(false))
  }
  return [activa, alternar]
}

export default function BotonPantallaCompleta({ activa, onAlternar, estilo }: { activa: boolean; onAlternar: () => void; estilo: CSSProperties }) {
  const celular = useCelular()
  if (typeof document === 'undefined' || !document.fullscreenEnabled) return null
  return (
    <button style={estilo} aria-label={activa ? 'Salir de pantalla completa' : 'Pantalla completa'} title="Ver la escena a pantalla completa (Esc para salir)" onClick={onAlternar} data-pantalla-completa="si">
      {celular ? (activa ? '⤡' : '⤢') : activa ? '⤡ Salir' : '⤢ Pantalla completa'}
    </button>
  )
}
