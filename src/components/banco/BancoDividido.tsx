/**
 * Banco de trabajo de las unidades PLC, CNC y Robótica: ocupa el alto de la
 * ventana (sin desplazar la página), con la barra de herramientas arriba, dos
 * áreas lado a lado (lo que se programa y lo que se simula) separadas por un
 * divisor que se arrastra, un panel acoplado abajo con pestañas y una barra
 * de estado. En el celular las áreas y las pestañas del panel pasan a ser
 * pestañas que ocupan toda la pantalla, una a la vez.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useEsEstrecha, usePersistente } from '../ui'
import PanelAcoplado, { type PestanaPanel } from './PanelAcoplado'

export interface AreaBanco {
  id: string
  /** Nombre corto (pestaña del celular y lectores de pantalla). */
  titulo: string
  contenido: ReactNode
  /** Sin relleno interior (p. ej. un lienzo que ocupa todo el área). */
  sinRelleno?: boolean
}

interface EstadoPanel<T extends string> {
  abierto: boolean
  onAbrir: (a: boolean) => void
  alto: number
  onAlto: (h: number) => void
  ampliado: boolean
  onAmpliar: (a: boolean) => void
  pestana: T
  onPestana: (p: T) => void
}

interface Props<T extends string> {
  /** Prefijo para recordar el ancho de las áreas en este navegador. */
  clave: string
  barra: ReactNode
  izquierda: AreaBanco
  derecha: AreaBanco
  inferior?: { etiqueta: string; pestanas: Array<PestanaPanel<T>>; estado: EstadoPanel<T> }
  /** Texto o controles de la barra de estado (abajo). */
  estado?: ReactNode
  /** Encima de las áreas (p. ej. el enunciado de un ejercicio). */
  encabezado?: ReactNode
  /** Qué área o pestaña mostrar en el celular (controlado desde fuera). */
  movil?: string
  onMovil?: (id: string) => void
}

const ANCHO_MIN = 320

/** Una capa del celular: todas ocupan el mismo lugar y sólo la elegida se ve. */
const capa = (visible: boolean): React.CSSProperties => ({ position: 'absolute', inset: 0, visibility: visible ? 'visible' : 'hidden', zIndex: visible ? 1 : 0 })

export default function BancoDividido<T extends string>({ clave, barra, izquierda, derecha, inferior, estado, encabezado, movil, onMovil }: Props<T>) {
  const estrecha = useEsEstrecha()
  const [division, setDivision] = usePersistente(`${clave}.division`, 0.5)
  const [movilPropio, setMovilPropio] = useState(izquierda.id)
  const vistaMovil = movil ?? movilPropio
  const elegirMovil = onMovil ?? setMovilPropio
  const cuerpo = useRef<HTMLDivElement>(null)
  // En el celular, cuando algo abre una pestaña del panel (p. ej. «⚠ avisos» en la barra de estado), se muestra.
  const pestanaPanel = inferior?.estado.pestana
  const panelAbierto = inferior?.estado.abierto
  const primera = useRef(true)
  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    if (estrecha && panelAbierto && pestanaPanel) elegirMovil(pestanaPanel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestanaPanel, panelAbierto])

  const limitar = (f: number) => {
    const w = cuerpo.current?.clientWidth ?? 1200
    const min = Math.min(0.45, ANCHO_MIN / Math.max(1, w))
    return Math.max(min, Math.min(1 - min, f))
  }
  const arrastrar = (e: React.PointerEvent) => {
    e.preventDefault()
    const r = cuerpo.current?.getBoundingClientRect()
    if (!r) return
    const mover = (ev: PointerEvent) => setDivision(limitar((ev.clientX - r.left) / r.width))
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      document.body.style.cursor = ''
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  const area = (a: AreaBanco, estilo: React.CSSProperties) => (
    <section aria-label={a.titulo} className={`banco-panel banco__area${a.sinRelleno ? ' banco__area--sin-relleno' : ''}`} style={estilo} data-area={a.id}>
      {a.contenido}
    </section>
  )

  if (estrecha) {
    const pestanas: Array<{ id: string; titulo: string }> = [izquierda, derecha, ...(inferior?.pestanas ?? [])]
    const deInferior = inferior?.pestanas.find((p) => p.id === vistaMovil)
    return (
      <main className="banco banco--dividido">
        <div className="banco__barra" role="toolbar" aria-label="Herramientas">
          {barra}
        </div>
        {encabezado}
        <div role="tablist" aria-label="Qué ver" className="pestanas-movil">
          {pestanas.map((p) => (
            <button key={p.id} role="tab" aria-selected={vistaMovil === p.id} onClick={() => elegirMovil(p.id)} data-pestana-movil={p.id}>
              {p.titulo}
            </button>
          ))}
        </div>
        <div className="banco__cuerpo" style={{ position: 'relative' }}>
          {/* Las dos áreas quedan montadas y con su tamaño, una encima de la otra: la vista 3D
              no se reinicia al cambiar de pestaña y se dibuja bien al volver. */}
          {area(izquierda, capa(vistaMovil === izquierda.id))}
          {area(derecha, capa(vistaMovil === derecha.id))}
          {deInferior && (
            <section aria-label={deInferior.titulo} className="banco-panel banco__area" style={capa(true)}>
              {deInferior.contenido}
            </section>
          )}
        </div>
        {estado && <div className="banco__estado">{estado}</div>}
      </main>
    )
  }

  return (
    <main className="banco banco--dividido">
      <div className="banco__barra" role="toolbar" aria-label="Herramientas">
        {barra}
      </div>
      {encabezado}
      <div className="banco__centro" style={{ flex: 1 }}>
        <div ref={cuerpo} className="banco__lienzo banco__dividido">
          {area(izquierda, { flex: `${division} 1 0` })}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Cambiar el ancho de las áreas"
            aria-valuenow={Math.round(division * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            tabIndex={0}
            className="divisor-areas"
            onPointerDown={arrastrar}
            onDoubleClick={() => setDivision(0.5)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setDivision((d) => limitar(d - 0.04))
              if (e.key === 'ArrowRight') setDivision((d) => limitar(d + 0.04))
            }}
            title="Arrastra para cambiar el ancho · doble clic: mitad y mitad"
          />
          {area(derecha, { flex: `${1 - division} 1 0` })}
        </div>
        {inferior && <PanelAcoplado<T> etiqueta={inferior.etiqueta} pestanas={inferior.pestanas} {...inferior.estado} />}
      </div>
      {estado && <div className="banco__estado">{estado}</div>}
    </main>
  )
}

/** Título de un área del banco, con lo que haga falta a la derecha. */
export function TituloArea({ children, derecha }: { children: ReactNode; derecha?: ReactNode }) {
  return (
    <div className="titulo-area">
      <h2>{children}</h2>
      {derecha}
    </div>
  )
}
