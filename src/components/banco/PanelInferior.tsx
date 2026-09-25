/**
 * Panel acoplado bajo el lienzo: el registro «¿Qué está pasando?» (en orden,
 * con lo último abajo) y el diagrama espacio-fase. Se pliega y se le cambia
 * el alto arrastrando su borde superior.
 */
import { useEffect, useRef } from 'react'
import type { Motor } from '../../engine'
import DiagramaEspacioFase from '../DiagramaEspacioFase'

export type PestanaInferior = 'registro' | 'fase'

interface Props {
  abierto: boolean
  onAbrir: (a: boolean) => void
  alto: number
  onAlto: (h: number) => void
  pestana: PestanaInferior
  onPestana: (p: PestanaInferior) => void
  motor: Motor | null
  eventos: Array<{ t: number; mensaje: string }>
}

export default function PanelInferior({ abierto, onAbrir, alto, onAlto, pestana, onPestana, motor, eventos }: Props) {
  const lista = useRef<HTMLDivElement>(null)
  const pegado = useRef(true)
  // Auto-scroll: si el alumno está mirando lo último, sigue lo último.
  useEffect(() => {
    const el = lista.current
    if (el && pegado.current) el.scrollTop = el.scrollHeight
  }, [eventos.length, abierto, pestana])

  const arrastrarBorde = (e: React.PointerEvent) => {
    e.preventDefault()
    const y0 = e.clientY
    const h0 = alto
    const mover = (ev: PointerEvent) => onAlto(Math.max(110, Math.min(window.innerHeight * 0.6, h0 + (y0 - ev.clientY))))
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  const tabs: Array<[PestanaInferior, string]> = [
    ['registro', '¿Qué está pasando?'],
    ['fase', 'Diagrama espacio-fase'],
  ]
  return (
    <section aria-label="Registro y diagrama" className="banco-panel" style={{ display: 'flex', flexDirection: 'column', height: abierto ? alto : 'auto', minHeight: 0, flex: 'none', position: 'relative' }}>
      {abierto && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Cambiar el alto del panel"
          tabIndex={0}
          onPointerDown={arrastrarBorde}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') onAlto(Math.min(window.innerHeight * 0.6, alto + 20))
            if (e.key === 'ArrowDown') onAlto(Math.max(110, alto - 20))
          }}
          className="tirador-panel"
        />
      )}
      <div role="tablist" aria-label="Panel inferior" style={{ display: 'flex', alignItems: 'stretch', padding: '0 4px', borderBottom: abierto ? '1px solid #e0e5eb' : 'none' }}>
        {tabs.map(([id, t]) => (
          <button
            key={id}
            role="tab"
            aria-selected={abierto && pestana === id}
            onClick={() => {
              onPestana(id)
              onAbrir(true)
            }}
            className="pestana-panel"
            data-pestana-inferior={id}
          >
            {t}
            {id === 'registro' && eventos.length > 0 && <span style={{ marginLeft: 6, fontWeight: 500, color: '#51606f' }}>({eventos.length})</span>}
          </button>
        ))}
        <button
          onClick={() => onAbrir(!abierto)}
          className="boton-icono"
          style={{ marginLeft: 'auto', alignSelf: 'center' }}
          aria-expanded={abierto}
          title={abierto ? 'Plegar el panel' : 'Abrir el panel'}
          aria-label={abierto ? 'Plegar el panel' : 'Abrir el panel'}
        >
          {abierto ? '▾' : '▴'}
        </button>
      </div>
      {abierto && (
        <div
          ref={lista}
          onScroll={(e) => {
            const el = e.currentTarget
            pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
          }}
          style={{ overflowY: 'auto', minHeight: 0, flex: 1, padding: '6px 12px 8px' }}
        >
          {pestana === 'registro' ? (
            eventos.length === 0 ? (
              <p style={{ color: '#51606f', margin: 0, fontSize: '0.88rem' }}>
                {motor ? 'Simulación corriendo. Acciona una válvula para ver los eventos.' : 'Pulsa ▶ Simular y acciona las válvulas: aquí aparece lo que va ocurriendo, en orden.'}
              </p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', lineHeight: 1.55, fontSize: '0.88rem' }} data-registro="si">
                {eventos.map((e, i) => (
                  <li key={`${e.t}-${i}`} style={{ opacity: i === eventos.length - 1 ? 1 : 0.8 }}>
                    <code style={{ color: '#51606f', marginRight: 8 }}>t={e.t.toFixed(1)} s</code>
                    {e.mensaje}
                  </li>
                ))}
              </ol>
            )
          ) : (
            <DiagramaEspacioFase motor={motor} />
          )}
        </div>
      )}
    </section>
  )
}
