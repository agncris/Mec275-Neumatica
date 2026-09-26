/**
 * Selector de máquina (CNC): se elige el torno o la fresadora y ahí mismo se
 * ven sus ejemplos, con una animación que muestra cómo trabaja cada una. Cada
 * máquina guarda su propio programa: cambiar de máquina no borra nada.
 */
import { useEffect, useRef, useState } from 'react'
import type { TipoMaquina } from './maquinas'
import { EJEMPLOS_CNC, type EjemploCNC } from './ejemplos'

export const MAQUINAS: Record<TipoMaquina, { nombre: string; corto: string; resumen: string }> = {
  torno: {
    nombre: 'Centro de torneado (torno)',
    corto: 'Torno',
    resumen: 'La pieza gira en el plato y la herramienta avanza en X (diámetro) y Z (a lo largo). Para piezas de revolución: ejes, bujes, pomos, roscas.',
  },
  fresadora: {
    nombre: 'Fresadora de 3 ejes',
    corto: 'Fresadora',
    resumen: 'La pieza queda fija en la mesa y la fresa gira y se mueve en X, Y y Z. Para contornos, cajeras, agujeros y grabados en piezas planas.',
  },
}

interface Props {
  actual: TipoMaquina
  /** Nombre del programa de cada máquina (para decir qué se va a encontrar). */
  nombres: Record<TipoMaquina, string>
  onUsar: (m: TipoMaquina) => void
  onNuevo: (m: TipoMaquina) => void
  onEjemplo: (e: EjemploCNC) => void
  onCerrar: () => void
}

export default function SelectorMaquina({ actual, nombres, onUsar, onNuevo, onEjemplo, onCerrar }: Props) {
  const [vista, setVista] = useState<TipoMaquina>(actual)
  const caja = useRef<HTMLDivElement>(null)
  const cerrar = useRef(onCerrar)
  cerrar.current = onCerrar
  useEffect(() => {
    caja.current?.focus()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current()
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [])

  const m = MAQUINAS[vista]
  const ejemplos = EJEMPLOS_CNC.filter((e) => e.maquina === vista)

  return (
    <div
      role="presentation"
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(28,39,51,0.35)',
        zIndex: 80,
        display: 'grid',
        placeItems: 'center',
        padding: 12,
      }}
    >
      <div ref={caja} role="dialog" aria-modal="true" aria-labelledby="titulo-maquinas" tabIndex={-1} onClick={(e) => e.stopPropagation()} className="selector-planta" data-selector-maquina-cnc="si">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #e0e5eb',
          }}
        >
          <h2 id="titulo-maquinas" style={{ margin: 0, fontSize: '1.08rem' }}>
            Elegir máquina
          </h2>
          <span style={{ marginLeft: 10, fontSize: '0.84rem', color: '#51606f' }}>Cada una guarda su propio programa</span>
          <button onClick={onCerrar} className="boton-icono" style={{ marginLeft: 'auto' }} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="selector-planta__cuerpo">
          <nav aria-label="Máquinas" className="selector-planta__lista" role="listbox" aria-activedescendant={`maquina-${vista}`}>
            {(Object.keys(MAQUINAS) as TipoMaquina[]).map((id) => {
              const n = EJEMPLOS_CNC.filter((e) => e.maquina === id).length
              return (
                <button key={id} id={`maquina-${id}`} role="option" aria-selected={vista === id} onClick={() => setVista(id)} className="selector-planta__opcion" data-maquina-opcion={id}>
                  <AnimacionMaquina id={id} ancho={60} />
                  <span
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{MAQUINAS[id].nombre}</span>
                    <span style={{ fontSize: '0.76rem', color: '#51606f' }}>
                      {id === actual ? 'En uso · ' : ''}
                      {n} ejemplos
                    </span>
                  </span>
                </button>
              )
            })}
          </nav>
          <section className="selector-planta__detalle" aria-label={m.nombre}>
            <div className="selector-planta__animacion" data-animacion-maquina={vista}>
              <AnimacionMaquina key={vista} id={vista} ancho="100%" />
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.02rem' }}>
              {m.nombre}
              {vista === actual && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#fff',
                    background: '#0e7a43',
                    borderRadius: 6,
                    padding: '1px 7px',
                    verticalAlign: 'middle',
                  }}
                >
                  EN USO
                </span>
              )}
            </h3>
            <p
              style={{
                margin: '0 0 6px',
                fontSize: '0.88rem',
                color: '#33475c',
                lineHeight: 1.5,
              }}
            >
              {m.resumen}
            </p>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '0.84rem',
                color: '#51606f',
              }}
            >
              Tu programa en esta máquina: <strong style={{ color: '#26323f' }}>{nombres[vista]}</strong>
            </p>
            <div style={rotulo}>Ejemplos resueltos</div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 6px',
                display: 'grid',
                gap: 5,
              }}
            >
              {ejemplos.map((e) => (
                <li
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    border: '1px solid #e0e5eb',
                    borderRadius: 8,
                    fontSize: '0.88rem',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{e.titulo}</span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.8rem',
                        color: '#51606f',
                      }}
                    >
                      {e.resumen}
                    </span>
                  </span>
                  <button onClick={() => onEjemplo(e)} style={boton} data-abrir-ejemplo-cnc={e.id}>
                    Abrir
                  </button>
                </li>
              ))}
            </ul>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                borderTop: '1px solid #e0e5eb',
                paddingTop: 10,
                marginTop: 10,
              }}
            >
              {vista !== actual && (
                <button
                  onClick={() => onUsar(vista)}
                  style={{
                    ...boton,
                    background: '#1668c7',
                    borderColor: '#1668c7',
                    color: '#fff',
                  }}
                  data-usar-maquina="si"
                >
                  Usar {vista === 'torno' ? 'el torno' : 'la fresadora'}
                </button>
              )}
              <button onClick={() => onNuevo(vista)} style={boton} data-programa-nuevo-cnc="si">
                Programa nuevo en {vista === 'torno' ? 'el torno' : 'la fresadora'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/** Animación corta de la máquina trabajando (clases .ap-* en index.css). */
export function AnimacionMaquina({ id, ancho = 160 }: { id: TipoMaquina; ancho?: number | string }) {
  return (
    <svg
      viewBox="0 0 160 100"
      width={ancho}
      className="ap"
      aria-hidden="true"
      focusable="false"
      style={{
        display: 'block',
        background: '#f5f8fb',
        borderRadius: 8,
        flex: 'none',
      }}
    >
      {id === 'torno' ? TORNO : FRESADORA}
    </svg>
  )
}

const LINEA = '#51606f'
const texto = {
  fontSize: 7,
  fill: '#33475c',
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 600,
} as const

const TORNO = (
  <g>
    {/* Plato con garras */}
    <rect x={8} y={14} width={20} height={72} rx={3} fill="#8a97a5" stroke={LINEA} />
    <rect x={26} y={24} width={8} height={10} fill="#5f6b78" />
    <rect x={26} y={66} width={8} height={10} fill="#5f6b78" />
    {/* Barra que gira */}
    <rect x={34} y={30} width={108} height={40} fill="#d4ac4f" stroke="#8a6500" />
    <g stroke="#b08a2e" strokeWidth={1.4} className="ap-giro">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
        <line key={i} x1={40 + i * 8} y1={30} x2={36 + i * 8} y2={70} />
      ))}
    </g>
    {/* Material que se lleva la herramienta (se «borra» a medida que avanza) */}
    <rect x={62} y={29} width={81} height={7} fill="#f5f8fb" className="ap-desbaste" />
    <rect x={62} y={64} width={81} height={7} fill="#f5f8fb" className="ap-desbaste" />
    {/* Herramienta */}
    <g className="ap-herramienta">
      <polygon points="142,36 150,24 160,24 160,32 150,32" fill="#e0b300" stroke="#8a6500" />
    </g>
    <text x={8} y={96} style={texto}>
      La pieza gira; la herramienta corta
    </text>
  </g>
)

const FRESADORA = (
  <g>
    {/* Bloque visto desde arriba */}
    <rect x={18} y={10} width={124} height={76} rx={2} fill="#c9ced4" stroke={LINEA} />
    {/* Contorno que va quedando cortado */}
    <path d="M45 25 H115 V71 H45 Z" fill="none" stroke="#51606f" strokeWidth={5} strokeLinejoin="round" pathLength={100} strokeDasharray="100 100" className="ap-contorno" />
    {/* Fresa: recorre el contorno y gira */}
    <g className="ap-fresa">
      <g transform="translate(45 25)">
        <circle r={8} fill="#8a97a5" stroke="#26323f" />
        <g className="ap-giro-fresa">
          <line x1={-7} y1={0} x2={7} y2={0} stroke="#26323f" strokeWidth={2} />
          <line x1={0} y1={-7} x2={0} y2={7} stroke="#26323f" strokeWidth={2} />
        </g>
      </g>
    </g>
    <text x={18} y={96} style={texto}>
      La fresa gira y recorre el contorno
    </text>
  </g>
)

const rotulo: React.CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#51606f',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  margin: '6px 0 4px',
}
const boton: React.CSSProperties = {
  border: '1px solid #c6ced6',
  background: '#fff',
  color: '#33475c',
  borderRadius: 8,
  padding: '0.3rem 0.8rem',
  fontWeight: 600,
  fontSize: '0.85rem',
  minHeight: 34,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
