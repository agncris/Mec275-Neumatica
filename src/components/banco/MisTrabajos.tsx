/**
 * Diálogo «Mis trabajos»: guardar el trabajo abierto con un nombre, volver a
 * abrir uno guardado, renombrarlo o borrarlo; y el respaldo de todo en un
 * archivo (para llevarlo al computador del laboratorio o a la casa).
 */
import { useEffect, useRef, useState } from 'react'
import { descargarTexto } from '../../entregar'
import { borrarTrabajo, crearRespaldo, esRespaldo, guardarTrabajo, listarTrabajos, renombrarTrabajo, restaurarRespaldo, type TrabajoGuardado, type UnidadTrabajo } from '../../trabajos'

interface Props {
  unidad: UnidadTrabajo
  /** Nombre con que se sugiere guardar el trabajo abierto. */
  nombreActual: string
  /** El trabajo abierto, listo para guardar. */
  actual: () => unknown
  /** Abre un trabajo guardado; devuelve un mensaje de error si no se pudo. */
  abrir: (dato: unknown, nombre: string) => string | void
  onCerrar: () => void
}

const fecha = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function MisTrabajos({ unidad, nombreActual, actual, abrir, onCerrar }: Props) {
  const [lista, setLista] = useState<TrabajoGuardado[]>(() => listarTrabajos(unidad))
  const [nombre, setNombre] = useState(nombreActual)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [renombrando, setRenombrando] = useState<string | null>(null)
  const archivo = useRef<HTMLInputElement>(null)
  const caja = useRef<HTMLDivElement>(null)
  const cerrar = useRef(onCerrar)
  cerrar.current = onCerrar
  useEffect(() => {
    caja.current?.focus()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current()
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [])
  const refrescar = () => setLista(listarTrabajos(unidad))

  const guardar = () => {
    try {
      const ya = lista.some((t) => t.nombre.toLowerCase() === nombre.trim().toLowerCase())
      if (ya && !window.confirm(`Ya tienes un trabajo llamado «${nombre.trim()}». ¿Reemplazarlo?`)) return
      guardarTrabajo(unidad, nombre, actual())
      refrescar()
      setMensaje(`Guardado como «${nombre.trim() || 'Sin nombre'}».`)
    } catch (e) {
      setMensaje(`⚠ ${e instanceof Error ? e.message : 'No se pudo guardar.'}`)
    }
  }

  const restaurar = async (f: File | undefined) => {
    if (!f) return
    try {
      const d = JSON.parse(await f.text())
      if (!esRespaldo(d)) throw new Error('Ese archivo no es un respaldo de NeumaLab.')
      const n = restaurarRespaldo(d)
      refrescar()
      setMensaje(`Respaldo cargado: ${n} trabajo(s) de todas las unidades.`)
    } catch (e) {
      setMensaje(`⚠ ${e instanceof Error ? e.message : 'No se pudo leer el archivo.'}`)
    }
  }

  return (
    <div role="presentation" onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(28,39,51,0.35)', zIndex: 80, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-trabajos"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', width: 'min(560px, 100%)', maxHeight: '85dvh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(28,39,51,0.3)' }}
        data-mis-trabajos="si"
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <h2 id="titulo-trabajos" style={{ margin: 0, fontSize: '1.1rem' }}>
            Mis trabajos
          </h2>
          <button onClick={onCerrar} className="boton-icono" style={{ marginLeft: 'auto' }} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p style={pie}>Se guardan en este navegador. Para llevarlos a otro computador, descarga un respaldo (abajo).</p>

        <div style={{ display: 'flex', gap: 6, margin: '10px 0' }}>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guardar()} aria-label="Nombre del trabajo" placeholder="Ej.: Tarea 2" style={entrada} data-nombre-trabajo="si" />
          <button onClick={guardar} style={{ ...boton, background: '#0e7a43', color: '#fff', borderColor: '#0e7a43' }} data-guardar-trabajo="si">
            Guardar el trabajo abierto
          </button>
        </div>
        {mensaje && (
          <p role="status" style={{ ...pie, color: mensaje.startsWith('⚠') ? '#8a3b00' : '#0a6b3c' }}>
            {mensaje}
          </p>
        )}

        {lista.length === 0 ? (
          <p style={{ ...pie, padding: '10px 0' }}>Todavía no guardas trabajos en esta unidad.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }} data-lista-trabajos="si">
            {lista.map((t) => (
              <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #e0e5eb', borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renombrando === t.id ? (
                    <input
                      autoFocus
                      defaultValue={t.nombre}
                      aria-label="Nuevo nombre"
                      style={entrada}
                      onBlur={(e) => {
                        renombrarTrabajo(unidad, t.id, e.target.value)
                        setRenombrando(null)
                        refrescar()
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</div>
                  )}
                  <div style={{ fontSize: '0.78rem', color: '#51606f' }}>Guardado el {fecha(t.fecha)}</div>
                </div>
                <button
                  onClick={() => {
                    if (!window.confirm(`¿Abrir «${t.nombre}»? El trabajo abierto se reemplaza: si quieres conservarlo, guárdalo antes.`)) return
                    const error = abrir(t.dato, t.nombre)
                    if (error) return setMensaje(`⚠ ${error}`)
                    onCerrar()
                  }}
                  style={{ ...boton, color: '#1668c7', borderColor: '#1668c7' }}
                  data-abrir-trabajo={t.nombre}
                >
                  Abrir
                </button>
                <button onClick={() => setRenombrando(t.id)} className="boton-icono" aria-label={`Renombrar ${t.nombre}`} title="Renombrar">
                  ✎
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm(`¿Borrar «${t.nombre}»? No se puede deshacer.`)) return
                    borrarTrabajo(unidad, t.id)
                    refrescar()
                  }}
                  className="boton-icono"
                  style={{ color: '#b3261e' }}
                  aria-label={`Borrar ${t.nombre}`}
                  title="Borrar"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 style={{ margin: '18px 0 4px', fontSize: '0.95rem' }}>Respaldo de todo</h3>
        <p style={pie}>Un solo archivo con tus trabajos de todas las unidades y lo que tienes abierto en cada una.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const d = new Date()
              descargarTexto(JSON.stringify(crearRespaldo()), `respaldo-neumalab-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`, 'application/json')
              setMensaje('Respaldo descargado.')
            }}
            style={boton}
            data-descargar-respaldo="si"
          >
            Descargar respaldo
          </button>
          <button onClick={() => archivo.current?.click()} style={boton}>
            Cargar un respaldo…
          </button>
          <input
            ref={archivo}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              void restaurar(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </div>
  )
}

const pie: React.CSSProperties = { margin: '2px 0', fontSize: '0.84rem', color: '#51606f', lineHeight: 1.5 }
const entrada: React.CSSProperties = { flex: 1, minWidth: 0, padding: '0.4rem 0.55rem', border: '1px solid #b8c1ca', borderRadius: 6, fontSize: '0.9rem', minHeight: 36, width: '100%' }
const boton: React.CSSProperties = { border: '1px solid #c6ced6', background: '#fff', color: '#33475c', borderRadius: 8, padding: '0.35rem 0.75rem', fontWeight: 600, fontSize: '0.86rem', minHeight: 36, cursor: 'pointer', whiteSpace: 'nowrap' }
