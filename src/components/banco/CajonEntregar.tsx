/**
 * «Entregar»: el cajón lateral con el que se arma la entrega de una tarea,
 * igual en las cuatro unidades. El enunciado y la plantilla (PPT) los reparte
 * el profesor; aquí el alumno
 *   1. pone su nombre (y el de su pareja) y el trabajo, para que los archivos
 *      se llamen como pide el enunciado,
 *   2. revisa su trabajo,
 *   3. descarga las imágenes y copia las tablas que pega en su presentación,
 *   4. descarga el archivo de la app (y el video) que sube junto con su PDF.
 */
import { useState, type ReactNode } from 'react'
import { baseArchivo, useAlumno } from '../../entregar'
import { usePersistente } from '../ui'

export interface AccionEntrega {
  id: string
  titulo: string
  /** Una línea: qué es y para qué pregunta sirve. */
  detalle?: string
  tipo: 'imagen' | 'tabla' | 'archivo' | 'enlace' | 'video'
  /** Recibe la base del nombre de archivo; devuelve un mensaje para el alumno. */
  hacer: (base: string) => Promise<string | void> | string | void
  deshabilitado?: boolean
  porque?: string
}

export interface PuntoRevision {
  ok: boolean
  texto: string
}

interface Props {
  unidad: string
  /** Clave para recordar el nombre del trabajo de esta unidad. */
  clave: string
  trabajoSugerido: string
  onCerrar: () => void
  presentacion: AccionEntrega[]
  archivos: AccionEntrega[]
  /** Revisión del trabajo: se calcula al pulsar «Revisar». */
  revisar?: () => PuntoRevision[]
  /** Herramientas propias de la unidad (p. ej. armar el diagrama VDI). */
  extra?: { titulo: string; contenido: ReactNode }
}

const BOTON: Record<AccionEntrega['tipo'], string> = {
  imagen: 'Descargar PNG',
  tabla: 'Copiar tabla',
  archivo: 'Descargar',
  enlace: 'Copiar enlace',
  video: 'Grabar',
}

export default function CajonEntregar({ unidad, clave, trabajoSugerido, onCerrar, presentacion, archivos, revisar, extra }: Props) {
  const [alumno, setAlumno] = useAlumno()
  const [trabajo, setTrabajo] = usePersistente(`${clave}.trabajo`, trabajoSugerido)
  const [mensajes, setMensajes] = useState<Record<string, string>>({})
  const [revision, setRevision] = useState<PuntoRevision[] | null>(null)
  const base = baseArchivo(alumno, trabajo)
  const sinNombre = !alumno.nombre.trim()

  const ejecutar = async (a: AccionEntrega) => {
    try {
      const m = await a.hacer(base)
      setMensajes((x) => ({ ...x, [a.id]: m || 'Listo.' }))
    } catch (e) {
      setMensajes((x) => ({ ...x, [a.id]: `⚠ ${e instanceof Error ? e.message : 'No se pudo.'}` }))
    }
  }

  const fila = (a: AccionEntrega) => {
    const bloqueada = a.deshabilitado || sinNombre
    return (
      <li key={a.id} style={estiloFila} data-entrega={a.id}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: '#1c2733' }}>{a.titulo}</div>
          {(a.deshabilitado ? a.porque : a.detalle) && <div style={{ fontSize: '0.8rem', color: '#51606f', marginTop: 1 }}>{a.deshabilitado ? a.porque : a.detalle}</div>}
          {mensajes[a.id] && (
            <div role="status" style={{ fontSize: '0.8rem', color: mensajes[a.id].startsWith('⚠') ? '#8a3b00' : '#0a6b3c', marginTop: 2 }}>
              {mensajes[a.id]}
            </div>
          )}
        </div>
        <button onClick={() => void ejecutar(a)} disabled={bloqueada} style={{ ...botonAccion, opacity: bloqueada ? 0.45 : 1, cursor: bloqueada ? 'not-allowed' : 'pointer' }} title={sinNombre ? 'Primero escribe tu nombre (paso 1)' : undefined}>
          {BOTON[a.tipo]}
        </button>
      </li>
    )
  }

  return (
    <aside className="cajon" aria-label={`Entregar · ${unidad}`} data-cajon-entregar="si">
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px 6px', borderBottom: '1px solid #e0e5eb' }}>
        <strong style={{ fontSize: '1.02rem' }}>Entregar tu tarea · {unidad}</strong>
        <button onClick={onCerrar} className="boton-icono" style={{ marginLeft: 'auto' }} aria-label="Cerrar">
          ✕
        </button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '10px 14px 20px' }}>
        <p style={parrafo}>
          Respondes las preguntas en la <strong>plantilla que te entregó el profesor</strong> (PPT) y la guardas como PDF. Desde aquí sacas lo que pegas en ella y el
          archivo de la app que subes junto con tu PDF: quien lo abra en NeumaLab ve tu trabajo y lo puede simular.
        </p>

        <h3 style={titulo}>1 · Tus datos</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={campo}>
            <span>
              Nombre y apellido <span aria-hidden style={{ color: '#b3261e', fontWeight: 700 }}>*</span>
            </span>
            <input value={alumno.nombre} onChange={(e) => setAlumno({ ...alumno, nombre: e.target.value })} placeholder="Ej.: Nombre Apellido" aria-required="true" style={entrada} data-alumno-nombre="si" />
          </label>
          <label style={campo}>
            Si trabajaste en pareja, su nombre y apellido
            <input value={alumno.companero} onChange={(e) => setAlumno({ ...alumno, companero: e.target.value })} placeholder="Ej.: Nombre Apellido" style={entrada} />
          </label>
          <label style={campo}>
            Trabajo (como lo nombra el enunciado)
            <input value={trabajo} onChange={(e) => setTrabajo(e.target.value)} placeholder={`Ej.: ${trabajoSugerido}`} style={entrada} data-trabajo="si" />
          </label>
        </div>
        <p style={{ ...pie, marginTop: 6 }}>
          Tus archivos se llamarán <code style={{ background: '#eef2f6', padding: '1px 5px', borderRadius: 4 }}>{base}</code>. Guarda tu presentación como{' '}
          <code style={{ background: '#eef2f6', padding: '1px 5px', borderRadius: 4 }}>{base}.pdf</code>.
        </p>

        {revisar && (
          <>
            <h3 style={titulo}>2 · Revisa tu trabajo</h3>
            <p style={pie}>La revisión no te pone nota ni te da la respuesta: sólo te avisa de lo que conviene arreglar antes de entregar.</p>
            <button onClick={() => setRevision(revisar())} style={{ ...botonAccion, background: '#0e7a43', color: '#fff', borderColor: '#0e7a43' }} data-revisar="si">
              Revisar
            </button>
            {revision && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 5 }} data-revision="si">
                {revision.map((r, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, padding: '0.4rem 0.6rem', borderRadius: 7, border: `1px solid ${r.ok ? '#a9dcc4' : '#f0c36d'}`, background: r.ok ? '#f2fbf6' : '#fdf6e3', fontSize: '0.85rem', color: '#33475c', lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 700, color: r.ok ? '#0a6b3c' : '#8a5b00' }}>{r.ok ? '✓' : '⚠'}</span>
                    <span>{r.texto}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {extra && (
          <>
            <h3 style={titulo}>{extra.titulo}</h3>
            {extra.contenido}
          </>
        )}

        <h3 style={titulo}>{revisar ? '3' : '2'} · Para pegar en tu presentación</h3>
        {sinNombre && <p style={{ ...pie, color: '#7a4f00' }}>Escribe tu nombre en el paso 1 para descargar.</p>}
        <ul style={lista}>{presentacion.map(fila)}</ul>

        <h3 style={titulo}>{revisar ? '4' : '3'} · Archivos que subes junto con tu PDF</h3>
        <ul style={lista}>{archivos.map(fila)}</ul>
        <p style={{ ...pie, marginTop: 10 }}>Envíalo todo como indique el enunciado (correo o página del ramo), con el asunto que pida.</p>
      </div>
    </aside>
  )
}

const titulo: React.CSSProperties = { margin: '18px 0 6px', fontSize: '0.95rem', color: '#1c2733' }
const parrafo: React.CSSProperties = { margin: '0 0 6px', fontSize: '0.88rem', color: '#33475c', lineHeight: 1.55 }
const pie: React.CSSProperties = { margin: '4px 0 8px', fontSize: '0.82rem', color: '#51606f', lineHeight: 1.5 }
const campo: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.84rem', color: '#33475c' }
const entrada: React.CSSProperties = { padding: '0.4rem 0.55rem', border: '1px solid #b8c1ca', borderRadius: 6, fontSize: '0.9rem', fontFamily: 'inherit', minHeight: 36 }
const lista: React.CSSProperties = { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }
const estiloFila: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #e0e5eb', borderRadius: 8, background: '#fff', fontSize: '0.88rem' }
const botonAccion: React.CSSProperties = { border: '1px solid #1668c7', background: '#fff', color: '#1668c7', borderRadius: 8, padding: '0.35rem 0.7rem', fontWeight: 600, fontSize: '0.84rem', minHeight: 34, whiteSpace: 'nowrap', flexShrink: 0 }
