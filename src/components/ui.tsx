/**
 * Piezas de interfaz comunes a las cuatro unidades, para que todas se usen
 * igual: la cabecera de la unidad, la barra de herramientas (acción
 * principal a la izquierda; «Archivo» y «Exportar» a la derecha), los tres
 * pesos de botón y un menú desplegable accesible.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Colores y botones
// ---------------------------------------------------------------------------
export const COLOR = {
  tinta: '#1c2733',
  texto2: '#51606f', // texto secundario: 6,3:1 sobre blanco
  borde: '#c6ced6',
  azul: '#1668c7',
  verde: '#0e7a43',
  pizarra: '#33475c',
}

const base: CSSProperties = {
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.9rem',
  lineHeight: 1.2,
  minHeight: 36,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
}

/** La acción principal de la vista (una sola): Simular, RUN, Ciclo, ▶. */
export function botonPrimario(activo = false, color = COLOR.verde): CSSProperties {
  return { ...base, border: 'none', background: activo ? COLOR.pizarra : color, color: '#fff', padding: '0.5rem 1.2rem', fontSize: '0.98rem', minHeight: 40 }
}

/** Acciones de apoyo: con borde, sin relleno. */
export const botonSecundario: CSSProperties = { ...base, border: `1px solid ${COLOR.borde}`, background: '#fff', color: COLOR.pizarra, padding: '0.4rem 0.8rem' }

/** Acciones menores: sólo texto. */
export const botonTerciario: CSSProperties = { ...base, border: '1px solid transparent', background: 'transparent', color: COLOR.pizarra, padding: '0.4rem 0.6rem', fontWeight: 500 }

/** ¿Pantalla táctil (dedo) en vez de mouse? Para escribir las ayudas como corresponde. */
export function useTactil(): boolean {
  const consulta = '(pointer: coarse)'
  const [t, setT] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(consulta).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(consulta)
    if (!mq) return
    const cambiar = () => setT(mq.matches)
    mq.addEventListener?.('change', cambiar)
    return () => mq.removeEventListener?.('change', cambiar)
  }, [])
  return t
}

/** «rueda» o «dos dedos», según el dispositivo. */
export const acercar = (tactil: boolean) => (tactil ? 'pellizca con dos dedos para acercar' : 'rueda para acercar')

// ---------------------------------------------------------------------------
// Cabecera y barra de herramientas
// ---------------------------------------------------------------------------
export function CabeceraUnidad({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <header style={{ display: 'flex', alignItems: 'baseline', gap: '4px 12px', flexWrap: 'wrap', margin: '0.2rem 0 0.7rem' }}>
      <h1 style={{ margin: 0, fontSize: 'clamp(1.2rem, 3.5vw, 1.45rem)', letterSpacing: '-0.01em' }}>{titulo}</h1>
      <p style={{ margin: 0, color: COLOR.texto2, fontSize: '0.92rem' }}>{descripcion}</p>
    </header>
  )
}

/** Fila de herramientas: lo de la izquierda es el trabajo; a la derecha, archivo y exportar. */
export function BarraHerramientas({ children, derecha }: { children: ReactNode; derecha?: ReactNode }) {
  return (
    <div role="toolbar" aria-label="Herramientas" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
      {children}
      {derecha && <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>{derecha}</span>}
    </div>
  )
}

/** Aviso flotante (no empuja el contenido): confirma descargas, cargas, etc. */
export const estiloAviso: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 18,
  transform: 'translateX(-50%)',
  zIndex: 60,
  maxWidth: 'min(720px, calc(100vw - 32px))',
  margin: 0,
  padding: '0.6rem 0.9rem',
  background: '#e7f7ef',
  border: '1px solid #a9dcc4',
  borderRadius: 8,
  color: '#0a6b3c',
  fontSize: '0.9rem',
  boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
}

export function Etiquetado({ texto, children, titulo }: { texto: string; children: ReactNode; titulo?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', color: COLOR.texto2 }} title={titulo}>
      {texto}
      {children}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Menú desplegable
// ---------------------------------------------------------------------------
export interface ItemMenu {
  texto: string
  /** Una línea que explica para qué sirve. */
  ayuda?: string
  onClick: () => void
  deshabilitado?: boolean
  /** Motivo por el que está deshabilitado (se muestra en lugar de la ayuda). */
  porque?: string
  /** Separador antes de este ítem. */
  separar?: boolean
  peligro?: boolean
}

export function Menu({ etiqueta, items, ancho = 280, datos }: { etiqueta: string; items: ItemMenu[]; ancho?: number; datos?: string }) {
  const [abierto, setAbierto] = useState(false)
  // Se abre hacia donde haya espacio (en el celular el botón puede quedar a la izquierda).
  const [izquierda, setIzquierda] = useState(0)
  const raiz = useRef<HTMLSpanElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false)
        raiz.current?.querySelector('button')?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const bs = Array.from(lista.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
        const i = bs.indexOf(document.activeElement as HTMLButtonElement)
        const j = e.key === 'ArrowDown' ? (i + 1) % bs.length : (i - 1 + bs.length) % bs.length
        bs[j]?.focus()
      }
    }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla)
    lista.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])
  return (
    <span ref={raiz} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          // Posición del menú respecto del botón, sin salirse de la pantalla.
          const w = Math.min(ancho, window.innerWidth - 32)
          const ideal = r.width - w // alineado al borde derecho del botón
          setIzquierda(Math.max(16 - r.left, Math.min(ideal, window.innerWidth - 16 - w - r.left)))
          setAbierto((a) => !a)
        }}
        style={{ ...botonSecundario, background: abierto ? '#eef2f6' : '#fff' }}
        data-menu={datos ?? etiqueta}
      >
        {etiqueta} <span aria-hidden style={{ fontSize: '0.7rem' }}>▾</span>
      </button>
      {abierto && (
        <div
          ref={lista}
          id={id}
          role="menu"
          style={{
            position: 'absolute',
            left: izquierda,
            top: 'calc(100% + 4px)',
            zIndex: 50,
            width: `min(${ancho}px, calc(100vw - 32px))`,
            background: '#fff',
            border: `1px solid ${COLOR.borde}`,
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(28,39,51,0.16), 0 2px 6px rgba(28,39,51,0.08)',
            padding: 6,
          }}
        >
          {items.map((it, i) => (
            <div key={i}>
              {it.separar && <hr style={{ border: 0, borderTop: '1px solid #e6e9ee', margin: '4px 2px' }} />}
              <button
                role="menuitem"
                disabled={it.deshabilitado}
                onClick={() => {
                  setAbierto(false)
                  it.onClick()
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 6,
                  padding: '0.45rem 0.6rem',
                  cursor: it.deshabilitado ? 'not-allowed' : 'pointer',
                  color: it.deshabilitado ? '#8b96a1' : it.peligro ? '#b3261e' : COLOR.tinta,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}
                className="item-menu"
              >
                {it.texto}
                {(it.deshabilitado ? it.porque : it.ayuda) && (
                  <span style={{ display: 'block', fontWeight: 400, fontSize: '0.78rem', color: COLOR.texto2, marginTop: 1 }}>
                    {it.deshabilitado ? it.porque : it.ayuda}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
