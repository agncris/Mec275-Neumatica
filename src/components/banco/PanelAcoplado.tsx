/**
 * Panel acoplado bajo el área de trabajo, con pestañas (registro, tablas,
 * diagramas…). Se pliega, se le cambia el alto arrastrando su borde superior
 * (o con ↑ ↓ desde el teclado) y se puede ampliar para leer con calma lo que
 * muestra; si no cabe, su contenido se desplaza.
 */
import { useEffect, useRef, type ReactNode, type UIEvent } from 'react'
import { usePersistente } from '../ui'

export interface PestanaPanel<T extends string = string> {
  id: T
  titulo: string
  /** Un número junto al título (p. ej. cuántos eventos hay). */
  contador?: number
  contenido: ReactNode
  /** Es una lista que crece (registro): el panel sigue lo último mientras se esté mirando el final. */
  seguirFinal?: boolean
}

interface Props<T extends string> {
  pestanas: Array<PestanaPanel<T>>
  abierto: boolean
  onAbrir: (a: boolean) => void
  alto: number
  onAlto: (h: number) => void
  pestana: T
  onPestana: (p: T) => void
  ampliado?: boolean
  onAmpliar?: (a: boolean) => void
  /** Nombre del panel para lectores de pantalla. */
  etiqueta: string
  /** En la bandeja del celular: sin tirador ni plegar. */
  fijo?: boolean
}

export const ALTO_MIN_PANEL = 110
/** Lo que se deja siempre a la vista de lo que está sobre el panel. */
const RESERVA_ARRIBA = 140

function altoMaximo(el: HTMLElement | null): number {
  const padre = el?.parentElement
  const disponible = padre ? padre.clientHeight - RESERVA_ARRIBA : window.innerHeight * 0.6
  return Math.max(ALTO_MIN_PANEL + 40, disponible)
}

export default function PanelAcoplado<T extends string>({
  pestanas,
  abierto,
  onAbrir,
  alto,
  onAlto,
  pestana,
  onPestana,
  ampliado = false,
  onAmpliar,
  etiqueta,
  fijo = false,
}: Props<T>) {
  const raiz = useRef<HTMLElement>(null)
  const actual = pestanas.find((p) => p.id === pestana) ?? pestanas[0]
  const seguir = useSeguirFinal([actual?.contador, pestana, abierto])

  const arrastrarBorde = (e: React.PointerEvent) => {
    e.preventDefault()
    const y0 = e.clientY
    const h0 = raiz.current?.getBoundingClientRect().height ?? alto
    const max = altoMaximo(raiz.current)
    onAmpliar?.(false)
    const mover = (ev: PointerEvent) => onAlto(Math.round(Math.max(ALTO_MIN_PANEL, Math.min(max, h0 + (y0 - ev.clientY)))))
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  const estilo: React.CSSProperties = fijo
    ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }
    : abierto && ampliado
      ? // Ampliado: se queda con casi todo el alto y deja a la vista una franja de lo de arriba.
        { display: 'flex', flexDirection: 'column', flex: '6 1 0', minHeight: 0, position: 'relative' }
      : { display: 'flex', flexDirection: 'column', height: abierto ? alto : 'auto', flex: 'none', minHeight: 0, position: 'relative' }

  return (
    <section ref={raiz} aria-label={etiqueta} className="banco-panel panel-acoplado" style={estilo} data-panel-ampliado={abierto && ampliado ? 'si' : undefined}>
      {abierto && !fijo && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Cambiar el alto del panel"
          aria-valuenow={Math.round(alto)}
          aria-valuemin={ALTO_MIN_PANEL}
          tabIndex={0}
          onPointerDown={arrastrarBorde}
          onDoubleClick={() => onAmpliar?.(!ampliado)}
          onKeyDown={(e) => {
            const max = altoMaximo(raiz.current)
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              onAmpliar?.(false)
              onAlto(Math.min(max, alto + 40))
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              onAmpliar?.(false)
              onAlto(Math.max(ALTO_MIN_PANEL, alto - 40))
            }
          }}
          className="tirador-panel"
          title="Arrastra para cambiar el alto · doble clic para ampliar"
        />
      )}
      <div role="tablist" aria-label={etiqueta} style={{ display: 'flex', alignItems: 'stretch', padding: '0 4px', borderBottom: abierto ? '1px solid #e0e5eb' : 'none', overflowX: 'auto', flex: 'none' }}>
        {pestanas.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={abierto && pestana === p.id}
            onClick={() => {
              onPestana(p.id)
              onAbrir(true)
            }}
            className="pestana-panel"
            data-pestana-inferior={p.id}
          >
            {p.titulo}
            {!!p.contador && <span style={{ marginLeft: 6, fontWeight: 500, color: '#51606f' }}>({p.contador})</span>}
          </button>
        ))}
        {!fijo && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2, paddingLeft: 6 }}>
            {abierto && onAmpliar && (
              <button
                onClick={() => onAmpliar(!ampliado)}
                className="boton-icono"
                aria-pressed={ampliado}
                title={ampliado ? 'Volver al alto de antes' : 'Ampliar el panel para ver más'}
                aria-label={ampliado ? 'Reducir el panel' : 'Ampliar el panel'}
                data-ampliar-panel="si"
              >
                {ampliado ? '⤡' : '⤢'}
              </button>
            )}
            <button
              onClick={() => onAbrir(!abierto)}
              className="boton-icono"
              aria-expanded={abierto}
              title={abierto ? 'Plegar el panel' : 'Abrir el panel'}
              aria-label={abierto ? 'Plegar el panel' : 'Abrir el panel'}
            >
              {abierto ? '▾' : '▴'}
            </button>
          </span>
        )}
      </div>
      {abierto && (
        <div ref={actual?.seguirFinal ? seguir.ref : undefined} onScroll={actual?.seguirFinal ? seguir.onDesplazar : undefined} style={{ overflow: 'auto', minHeight: 0, flex: 1, padding: '6px 12px 8px' }} className="panel-acoplado__contenido">
          {actual?.contenido}
        </div>
      )}
    </section>
  )
}

/** Estado de un panel acoplado que se recuerda en este navegador. */
export function usePanelAcoplado<T extends string>(clave: string, pestanaInicial: T, abiertoInicial = false) {
  const [abierto, setAbierto] = usePersistente(`${clave}.abierto`, abiertoInicial)
  const [alto, setAlto] = usePersistente(
    `${clave}.alto`,
    typeof window === 'undefined' ? 220 : Math.round(Math.min(260, Math.max(150, window.innerHeight * 0.26))),
  )
  const [ampliado, setAmpliado] = usePersistente(`${clave}.ampliado`, false)
  const [pestana, setPestana] = usePersistente<T>(`${clave}.pestana`, pestanaInicial)
  return { abierto, onAbrir: setAbierto, alto, onAlto: setAlto, ampliado, onAmpliar: setAmpliado, pestana, onPestana: setPestana }
}

/** Sigue lo último de una lista (registro) mientras el alumno esté mirando el final. */
export function useSeguirFinal(dependencias: unknown[]) {
  const ref = useRef<HTMLDivElement>(null)
  const pegado = useRef(true)
  useEffect(() => {
    const el = ref.current
    if (el && pegado.current) el.scrollTop = el.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias)
  const onDesplazar = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
  }
  return { ref, onDesplazar }
}
