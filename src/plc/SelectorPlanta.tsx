/**
 * Selector de planta: primero se elige la máquina que se va a controlar y ahí
 * mismo se ve con qué partir — su cableado, sus ejercicios para resolver y sus
 * ejemplos resueltos—, en vez de dos desplegables sueltos.
 */
import { useEffect, useRef, useState } from 'react'
import type { IdPlanta } from './ladder'
import { PLANTAS } from './plantas'
import { EJEMPLOS_PLC, type EjemploPLC } from './ejemplos'
import { EJERCICIOS_PLC, type EjercicioPLC } from './ejercicios'
import { formatear, type Notacion } from './notacion'
import AnimacionPlanta from './AnimacionPlanta'

interface Props {
  actual: IdPlanta
  notacion: Notacion
  /** Ejercicio abierto ahora (para marcarlo). */
  ejercicioActual?: string
  onUsarPlanta: (id: IdPlanta) => void
  onProgramaVacio: (id: IdPlanta) => void
  onEjercicio: (e: EjercicioPLC) => void
  onEjemplo: (e: EjemploPLC) => void
  onCerrar: () => void
}

export default function SelectorPlanta({ actual, notacion, ejercicioActual, onUsarPlanta, onProgramaVacio, onEjercicio, onEjemplo, onCerrar }: Props) {
  const [vista, setVista] = useState<IdPlanta>(actual)
  const caja = useRef<HTMLDivElement>(null)
  const cerrar = useRef(onCerrar)
  cerrar.current = onCerrar
  useEffect(() => {
    caja.current?.focus()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current()
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [])

  const planta = PLANTAS[vista]
  const ejercicios = EJERCICIOS_PLC.filter((e) => e.planta === vista)
  const ejemplos = EJEMPLOS_PLC.filter((e) => e.programa.planta === vista)
  const entradas = planta.cableado.filter((s) => s.dir.startsWith('I'))
  const salidas = planta.cableado.filter((s) => s.dir.startsWith('Q'))
  const cuenta = (id: IdPlanta) => EJERCICIOS_PLC.filter((e) => e.planta === id).length + EJEMPLOS_PLC.filter((e) => e.programa.planta === id).length

  const chips = (lista: typeof entradas) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {lista.map((s) => (
        <span key={s.dir} title={s.descripcion} style={{ border: '1px solid #dbe1e8', borderRadius: 6, padding: '1px 6px', fontSize: '0.8rem', background: '#f7f9fb' }}>
          <code style={{ color: '#51606f' }}>{formatear(s.dir, notacion)}</code> <strong>{s.nombre}</strong>
        </span>
      ))}
    </div>
  )

  return (
    <div role="presentation" onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(28,39,51,0.35)', zIndex: 80, display: 'grid', placeItems: 'center', padding: 12 }}>
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-plantas"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="selector-planta"
        data-selector-planta="si"
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e0e5eb' }}>
          <h2 id="titulo-plantas" style={{ margin: 0, fontSize: '1.08rem' }}>
            Elegir planta
          </h2>
          <span style={{ marginLeft: 10, fontSize: '0.84rem', color: '#51606f' }}>La máquina que controla tu programa</span>
          <button onClick={onCerrar} className="boton-icono" style={{ marginLeft: 'auto' }} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="selector-planta__cuerpo">
          <nav aria-label="Plantas" className="selector-planta__lista" role="listbox" aria-activedescendant={`planta-${vista}`}>
            {Object.values(PLANTAS).map((p) => (
              <button
                key={p.id}
                id={`planta-${p.id}`}
                role="option"
                aria-selected={vista === p.id}
                onClick={() => setVista(p.id)}
                className="selector-planta__opcion"
                data-planta-opcion={p.id}
              >
                <AnimacionPlanta id={p.id} ancho={60} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                  <span style={{ fontSize: '0.76rem', color: '#51606f' }}>
                    {p.id === actual ? 'En uso · ' : ''}
                    {cuenta(p.id) ? `${cuenta(p.id)} ejemplo${cuenta(p.id) === 1 ? '' : 's'} o ejercicio${cuenta(p.id) === 1 ? '' : 's'}` : 'Para programar libre'}
                  </span>
                </span>
              </button>
            ))}
          </nav>
          <section className="selector-planta__detalle" aria-label={planta.nombre}>
            <div className="selector-planta__animacion" data-animacion-planta={vista}>
              <AnimacionPlanta key={vista} id={vista} ancho="100%" />
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.02rem' }}>
              {planta.nombre}
              {vista === actual && <span style={{ marginLeft: 8, fontSize: '0.74rem', fontWeight: 700, color: '#fff', background: '#0e7a43', borderRadius: 6, padding: '1px 7px', verticalAlign: 'middle' }}>EN USO</span>}
            </h3>
            <p style={{ margin: '0 0 8px', fontSize: '0.88rem', color: '#33475c', lineHeight: 1.5 }}>{planta.resumen}</p>
            <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
              <div>
                <div style={rotulo}>Entradas (sensores y mandos)</div>
                {chips(entradas)}
              </div>
              <div>
                <div style={rotulo}>Salidas (actuadores y pilotos)</div>
                {chips(salidas)}
              </div>
            </div>

            {ejercicios.length > 0 && (
              <>
                <div style={rotulo}>📝 Ejercicios para resolver</div>
                <ul style={lista}>
                  {ejercicios.map((e) => (
                    <li key={e.id} style={fila}>
                      <span style={{ flex: 1 }}>
                        {e.titulo}
                        {e.id === ejercicioActual && <span style={{ color: '#0a6b3c', fontWeight: 600 }}> · abierto</span>}
                      </span>
                      <button onClick={() => onEjercicio(e)} style={{ ...boton, background: '#0e7a43', borderColor: '#0e7a43', color: '#fff' }} data-empezar-ejercicio={e.id}>
                        Empezar
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {ejemplos.length > 0 && (
              <>
                <div style={rotulo}>Ejemplos resueltos</div>
                <ul style={lista}>
                  {ejemplos.map((e) => (
                    <li key={e.id} style={fila}>
                      <span style={{ flex: 1 }}>{e.etiqueta}</span>
                      <button onClick={() => onEjemplo(e)} style={boton} data-abrir-ejemplo={e.id}>
                        Abrir
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {ejercicios.length + ejemplos.length === 0 && <p style={{ fontSize: '0.86rem', color: '#51606f' }}>Esta planta no trae ejemplos: es para que programes lo que quieras con ella.</p>}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #e0e5eb', paddingTop: 10, marginTop: 10 }}>
              {vista !== actual && (
                <button onClick={() => onUsarPlanta(vista)} style={{ ...boton, background: '#1668c7', borderColor: '#1668c7', color: '#fff' }} data-usar-planta="si" title="Conserva tu programa y cambia sólo la máquina (y su cableado en la tabla de símbolos)">
                  Usar esta planta con mi programa
                </button>
              )}
              <button onClick={() => onProgramaVacio(vista)} style={boton} data-programa-vacio="si">
                Programa vacío con esta planta
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

const rotulo: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 700, color: '#51606f', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '6px 0 4px' }
const lista: React.CSSProperties = { listStyle: 'none', padding: 0, margin: '0 0 6px', display: 'grid', gap: 5 }
const fila: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: '1px solid #e0e5eb', borderRadius: 8, fontSize: '0.88rem' }
const boton: React.CSSProperties = { border: '1px solid #c6ced6', background: '#fff', color: '#33475c', borderRadius: 8, padding: '0.3rem 0.8rem', fontWeight: 600, fontSize: '0.85rem', minHeight: 34, cursor: 'pointer', whiteSpace: 'nowrap' }
