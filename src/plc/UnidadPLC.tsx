/**
 * Unidad 2 · PLC: programar en Ladder y probar el programa contra una
 * planta del laboratorio (tablero, estanque, elevador), en 3D y con sonido.
 *
 * Como en el laboratorio: en STOP se edita el programa; en RUN el PLC lo
 * ejecuta en ciclos de scan contra la planta, las salidas mueven la máquina
 * y los sensores de la máquina vuelven a las entradas.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Seccion } from '../components/Seccion'
import { exportarPng, nombreSeguro } from '../exportar'
import EditorLadder from './EditorLadder'
import { EJEMPLOS_PLC } from './ejemplos'
import {
  ENTRADAS,
  SALIDAS,
  areaDe,
  clonarPrograma,
  DIRECCIONES,
  esProgramaPLC,
  estadoInicial,
  programaVacio,
  revisarPrograma,
  scan,
  type EstadoPLC,
  type FlujoEscalon,
  type IdPlanta,
  type ProgramaPLC,
} from './ladder'
import { PLANTAS, crearPlanta, type Mando } from './plantas'
import type { SimPLC } from './Planta3D'
import { CicloScan, ComponentesPLC, ElegirPLC, EntradasSalidas, QueEsPLC, Sensores, SimbolosLadder } from './TeoriaPLC'

const Planta3D = lazy(() => import('./Planta3D'))

const CLAVE = 'neumalab.plc.programa'
const DT = 0.02

function leerGuardado(): ProgramaPLC {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (crudo) {
      const p = JSON.parse(crudo)
      if (esProgramaPLC(p)) return p
    }
  } catch {
    /* sin almacenamiento o dato roto: se empieza por el ejercicio 1 */
  }
  return clonarPrograma(EJEMPLOS_PLC[0].programa)
}

interface Evento {
  t: number
  mensaje: string
  aviso?: boolean
}

export default function UnidadPLC() {
  const [programa, setPrograma] = useState<ProgramaPLC>(leerGuardado)
  const [corriendo, setCorriendo] = useState(false)
  const [version, setVersion] = useState(0)
  const [, setFotograma] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)
  const programaRef = useRef(programa)
  programaRef.current = programa
  const flujosRef = useRef<FlujoEscalon[] | null>(null)
  const eventosRef = useRef<Evento[]>([])

  const pulsar = useCallback((dir: string, valor: boolean) => {
    simRef.current.mandos = { ...simRef.current.mandos, [dir]: valor }
    setFotograma((f) => f + 1)
  }, [])
  const simRef = useRef<SimPLC>({
    planta: crearPlanta(programa.planta),
    estado: estadoInicial(),
    mandos: {},
    corriendo: false,
    pulsar,
  })

  // Guardado automático del programa.
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(programa))
    } catch {
      /* sin almacenamiento */
    }
  }, [programa])

  // Otra planta: se monta de nuevo, en reposo.
  useEffect(() => {
    if (simRef.current.planta.id === programa.planta) return
    simRef.current.planta = crearPlanta(programa.planta)
    simRef.current.mandos = {}
    simRef.current.estado = estadoInicial()
    eventosRef.current = []
    setVersion((v) => v + 1)
  }, [programa.planta])

  // RUN / STOP: al pasar a RUN el PLC arranca con la memoria limpia.
  const primeraVez = useRef(true)
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    simRef.current.corriendo = corriendo
    simRef.current.estado = estadoInicial()
    flujosRef.current = null
    registrar(corriendo ? 'PLC en RUN: empieza a ejecutar el programa' : 'PLC en STOP: todas las salidas a 0')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corriendo])

  const nombre = useCallback(
    (dir: string) => {
      const s = programaRef.current.simbolos.find((x) => x.dir === dir)
      return s?.nombre ? `${s.nombre} (${dir})` : dir
    },
    [],
  )

  function registrar(mensaje: string, esAviso = false) {
    const lista = eventosRef.current
    lista.push({ t: simRef.current.planta ? (simRef.current.estado.t ?? 0) : 0, mensaje, aviso: esAviso })
    if (lista.length > 60) lista.splice(0, lista.length - 60)
  }

  // El bucle: scan del PLC + física de la planta, 50 veces por segundo.
  useEffect(() => {
    let tiempo = 0
    const id = setInterval(() => {
      const sim = simRef.current
      const estado = sim.estado
      const antes = { ...estado.bits }
      const entradas = { ...sim.mandos, ...sim.planta.sensores() }
      if (sim.corriendo) {
        const r = scan(programaRef.current, estado, entradas, DT)
        flujosRef.current = r.flujos
      } else {
        // En STOP las entradas se siguen viendo, pero las salidas están a 0.
        for (const d of ENTRADAS) estado.bits[d] = !!entradas[d]
        for (const d of SALIDAS) estado.bits[d] = false
        estado.t += DT
      }
      const salidas: Record<string, boolean> = {}
      for (const d of SALIDAS) salidas[d] = estado.bits[d]
      sim.planta.paso(salidas, DT)
      // Qué cambió, contado con los nombres de la tabla de símbolos.
      for (const d of [...ENTRADAS, ...SALIDAS]) {
        if (antes[d] !== estado.bits[d]) {
          const n = nombre(d)
          registrar(`${n} ${estado.bits[d] ? 'se activa (1)' : 'se desactiva (0)'}`)
        }
      }
      for (const e of sim.planta.eventos.splice(0)) registrar(`🏭 ${e.mensaje}`, e.aviso)
      tiempo += DT
      if (tiempo >= 0.066) {
        tiempo = 0
        setFotograma((f) => f + 1)
      }
    }, DT * 1000)
    return () => clearInterval(id)
  }, [nombre])

  // Espacio: RUN / STOP.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
      if (e.key === ' ') {
        e.preventDefault()
        setCorriendo((c) => !c)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(id)
  }, [aviso])

  const avisos = useMemo(() => revisarPrograma(programa), [programa])
  const descripcion = PLANTAS[programa.planta]
  const sim = simRef.current
  const estado: EstadoPLC = sim.estado

  const hayContenido = programa.escalones.some((e) => e.bobinas.some(Boolean) || e.celdas.some((f) => f.some((c) => c.tipo !== 'vacio')))
  const confirmar = (mensaje: string) => !hayContenido || window.confirm(`${mensaje}\nSe perderá el programa que tienes en el editor.`)

  const cambiarPlanta = (id: IdPlanta) => {
    const cableado = PLANTAS[id].cableado
    const propios = programa.simbolos.filter((s) => ['M', 'T', 'C'].includes(areaDe(s.dir) ?? ''))
    setPrograma({ ...clonarPrograma(programa), planta: id, simbolos: [...cableado.map((s) => ({ ...s })), ...propios] })
  }

  const nuevo = () => {
    if (!confirmar('¿Empezar un programa nuevo?')) return
    setCorriendo(false)
    setPrograma(programaVacio(programa.planta, PLANTAS[programa.planta].cableado.map((s) => ({ ...s }))))
  }

  const guardar = () => {
    const blob = new Blob([JSON.stringify(programa, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreSeguro(programa.nombre || 'programa-plc', 'json')
    a.click()
    URL.revokeObjectURL(url)
  }

  const abrir = async (archivo: File | undefined) => {
    if (!archivo) return
    try {
      const p = JSON.parse(await archivo.text())
      if (!esProgramaPLC(p)) throw new Error('Ese archivo no es un programa de PLC de NeumaLab.')
      setCorriendo(false)
      setPrograma(p)
      setAviso(`Programa «${archivo.name}» abierto.`)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    }
  }

  const exportarLadder = async () => {
    const svg = document.getElementById('ladder-svg') as SVGSVGElement | null
    if (!svg) return
    const archivo = nombreSeguro(`${programa.nombre || 'programa'}_ladder`, 'png')
    try {
      await exportarPng(svg, archivo)
      setAviso(`Imagen descargada: ${archivo}`)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo exportar la imagen.')
    }
  }

  const eventos = eventosRef.current.slice(-8).reverse()

  return (
    <main style={{ maxWidth: 1320, margin: '0 auto', padding: '0.4rem 1.5rem 1.25rem' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: '0.8rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.45rem' }}>NeumaLab · PLC</h1>
        <span style={chip}>MEC275</span>
        <p style={{ margin: 0, color: '#5a6b7d', fontSize: '0.9rem' }}>
          Programa en Ladder y pruébalo en la planta del laboratorio
        </p>
      </header>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <button
          onClick={() => setCorriendo((c) => !c)}
          title="Atajo: barra espaciadora"
          style={{ ...boton, background: corriendo ? '#33475c' : '#12a35a', padding: '0.55rem 1.3rem', fontSize: '0.98rem' }}
        >
          {corriendo ? '■ STOP' : '▶ RUN'}
        </button>
        <button onClick={nuevo} style={{ ...boton, background: '#fff', color: '#1668c7', border: '2px solid #1668c7', padding: '0.5rem 1.1rem' }}>
          ＋ Nuevo programa
        </button>
        <label style={rotulo}>
          Ejemplos:
          <select
            value=""
            onChange={(e) => {
              const ej = EJEMPLOS_PLC.find((x) => x.id === e.target.value)
              e.target.value = ''
              if (!ej || !confirmar(`¿Cargar «${ej.etiqueta}»?`)) return
              setCorriendo(false)
              setPrograma(clonarPrograma(ej.programa))
            }}
            style={{ padding: '0.3rem 0.4rem', maxWidth: 280 }}
          >
            <option value="">— elige un programa —</option>
            {EJEMPLOS_PLC.map((e) => (
              <option key={e.id} value={e.id}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label style={rotulo}>
          Planta:
          <select value={programa.planta} onChange={(e) => cambiarPlanta(e.target.value as IdPlanta)} style={{ padding: '0.3rem 0.4rem' }}>
            {Object.values(PLANTAS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={guardar} style={botonSuave} title="Descarga el programa para volver a abrirlo">
            Guardar
          </button>
          <button onClick={() => inputArchivo.current?.click()} style={botonSuave}>
            Abrir
          </button>
          <button onClick={() => void exportarLadder()} style={botonSuave} title="Imagen del diagrama para tu informe">
            Ladder (PNG)
          </button>
          <input
            ref={inputArchivo}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              void abrir(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </span>
      </div>

      {aviso && <p role="status" style={avisoOk}>{aviso}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))', gap: 14, alignItems: 'start' }}>
        <section style={{ ...tarjeta, marginTop: 0 }}>
          <h2 style={subtitulo}>
            Programa Ladder{programa.nombre ? ` · ${programa.nombre}` : ''}
            <span style={{ ...estadoPLC, background: corriendo ? '#12a35a' : '#ffa726' }}>{corriendo ? 'RUN' : 'STOP'}</span>
          </h2>
          {corriendo && (
            <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#5a6b7d' }}>
              El PLC está ejecutando el programa. Pásalo a STOP para editarlo.
            </p>
          )}
          <EditorLadder
            programa={programa}
            onCambiar={setPrograma}
            flujos={corriendo ? flujosRef.current : null}
            estado={corriendo ? estado : null}
            editable={!corriendo}
          />
          {avisos.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {avisos.map((a, i) => (
                <p key={i} style={{ color: '#8a5b00', margin: '3px 0', fontSize: '0.86rem' }}>
                  ⚠ {a}
                </p>
              ))}
            </div>
          )}
        </section>

        <section style={{ ...tarjeta, marginTop: 0 }}>
          <h2 style={subtitulo}>Planta · {descripcion.nombre}</h2>
          <p style={{ margin: '0 0 8px', fontSize: '0.86rem', color: '#5a6b7d' }}>{descripcion.resumen}</p>
          <Suspense fallback={<p style={{ padding: 20, color: '#5a6b7d' }}>Montando la planta…</p>}>
            <Planta3D
              sim={simRef}
              version={version}
              acciones={sim.planta.acciones()}
              onAccion={(id) => {
                sim.planta.accion(id)
                setFotograma((f) => f + 1)
              }}
            />
          </Suspense>
          <PanelES mandos={descripcion.mandos} simbolos={programa.simbolos} cableado={descripcion.cableado.map((c) => c.dir)} estado={estado} mandosActivos={sim.mandos} pulsar={pulsar} />
        </section>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <section style={{ ...tarjeta, flex: '2 1 460px', minWidth: 0 }}>
          <h2 style={subtitulo}>Tabla de símbolos · asignación de entradas y salidas</h2>
          <TablaSimbolos programa={programa} onCambiar={setPrograma} editable={!corriendo} />
        </section>
        <section style={{ ...tarjeta, flex: '1 1 320px', minWidth: 0 }}>
          <h2 style={subtitulo}>¿Qué está pasando?</h2>
          {eventos.length === 0 ? (
            <p style={{ color: '#5a6b7d', margin: 0 }}>Pulsa ▶ RUN y acciona la planta para ver qué hace el programa.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.55, fontSize: '0.9rem' }}>
              {eventos.map((e, i) => (
                <li key={`${e.t}-${i}`} style={{ opacity: i === 0 ? 1 : 0.7, color: e.aviso ? '#8a3b00' : undefined }}>
                  <code>t={e.t.toFixed(1)}s</code> — {e.aviso ? '⚠ ' : ''}
                  {e.mensaje}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section style={tarjeta}>
        <Seccion titulo="¿Qué es un PLC y para qué se usa?">
          <QueEsPLC />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Componentes de un PLC">
          <ComponentesPLC />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Entradas, salidas y direcciones">
          <EntradasSalidas />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="¿Cómo elegir un PLC?">
          <ElegirPLC />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Sensores que se conectan al PLC">
          <Sensores />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Programación Ladder · contactos y bobinas">
          <SimbolosLadder />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Cómo ejecuta el PLC tu programa: el ciclo de scan">
          <CicloScan />
        </Seccion>
      </section>

      <footer style={{ margin: '1.5rem 0 0.5rem', color: '#8a97a5', fontSize: '0.8rem', textAlign: 'center' }}>
        NeumaLab · MEC275 — Unidad 2: Controlador Lógico Programable · Ladder
      </footer>
    </main>
  )
}

/** Mandos de la planta y el estado de cada entrada y salida cableada. */
function PanelES({
  mandos,
  simbolos,
  cableado,
  estado,
  mandosActivos,
  pulsar,
}: {
  mandos: Mando[]
  simbolos: ProgramaPLC['simbolos']
  cableado: string[]
  estado: EstadoPLC
  mandosActivos: Record<string, boolean>
  pulsar: (dir: string, v: boolean) => void
}) {
  const colores: Record<string, string> = { verde: '#19a34e', rojo: '#c62828', negro: '#2b3036', amarillo: '#d4a017' }
  const nombre = (d: string) => simbolos.find((s) => s.dir === d)?.nombre ?? ''
  const dirs = DIRECCIONES.filter((d) => cableado.includes(d))
  return (
    <div style={{ marginTop: 10 }}>
      {mandos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '0.8rem', color: '#5a6b7d' }}>Mandos:</span>
          {mandos.map((m) => {
            const on = !!mandosActivos[m.dir]
            const color = colores[m.color]
            return (
              <button
                key={m.dir}
                title={m.tipo === 'pulsador' ? `Mantén pulsado ${m.nombre} (${m.dir})` : `Cambia el selector ${m.nombre} (${m.dir})`}
                style={{
                  border: `2px solid ${color}`,
                  background: on ? color : '#fff',
                  color: on ? '#fff' : color,
                  borderRadius: m.tipo === 'pulsador' ? 999 : 6,
                  padding: '0.3rem 0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  userSelect: 'none',
                  touchAction: 'none',
                  fontSize: '0.84rem',
                }}
                onPointerDown={(e) => {
                  if (m.tipo === 'interruptor') {
                    pulsar(m.dir, !on)
                    return
                  }
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId)
                  } catch {
                    /* puntero sintético */
                  }
                  pulsar(m.dir, true)
                }}
                onPointerUp={() => m.tipo === 'pulsador' && pulsar(m.dir, false)}
                onPointerCancel={() => m.tipo === 'pulsador' && pulsar(m.dir, false)}
              >
                {m.tipo === 'interruptor' ? (on ? '◉ ' : '○ ') : '● '}
                {m.nombre}
              </button>
            )
          })}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 4 }}>
        {dirs.map((d) => {
          const on = !!estado.bits[d]
          const esEntrada = d.startsWith('I')
          return (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#33475c' }} data-es={d} data-valor={on ? 1 : 0}>
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 999,
                  background: on ? (esEntrada ? '#2ee06d' : '#ffa726') : '#c9ced4',
                  boxShadow: on ? `0 0 6px ${esEntrada ? '#2ee06d' : '#ffa726'}` : 'none',
                  flexShrink: 0,
                }}
              />
              <code>{d}</code>
              <strong>{nombre(d)}</strong>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TablaSimbolos({ programa, onCambiar, editable }: { programa: ProgramaPLC; onCambiar: (p: ProgramaPLC) => void; editable: boolean }) {
  const cambiar = (m: (p: ProgramaPLC) => void) => {
    const p = clonarPrograma(programa)
    m(p)
    onCambiar(p)
  }
  const orden = (d: string) => DIRECCIONES.indexOf(d)
  const filas = programa.simbolos.map((s, i) => ({ s, i })).sort((a, b) => orden(a.s.dir) - orden(b.s.dir))
  const celda: React.CSSProperties = { borderBottom: '1px solid #e0e5eb', padding: '3px 6px' }
  const campo: React.CSSProperties = { width: '100%', padding: '0.2rem 0.3rem', border: '1px solid #d7dde3', borderRadius: 4, fontSize: '0.86rem' }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.88rem' }}>
        <thead>
          <tr style={{ background: '#1d5ea8', color: '#fff', textAlign: 'left' }}>
            <th style={{ padding: '5px 6px', width: '22%' }}>Simbología</th>
            <th style={{ padding: '5px 6px', width: '18%' }}>Asignación</th>
            <th style={{ padding: '5px 6px' }}>Descripción</th>
            {editable && <th style={{ width: 28 }} />}
          </tr>
        </thead>
        <tbody>
          {filas.map(({ s, i }) => (
            <tr key={i}>
              <td style={celda}>
                <input
                  style={{ ...campo, fontWeight: 700 }}
                  disabled={!editable}
                  value={s.nombre}
                  onChange={(e) => cambiar((p) => (p.simbolos[i].nombre = e.target.value))}
                />
              </td>
              <td style={celda}>
                <select
                  style={campo}
                  disabled={!editable}
                  value={s.dir}
                  onChange={(e) => cambiar((p) => (p.simbolos[i].dir = e.target.value))}
                >
                  {DIRECCIONES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </td>
              <td style={celda}>
                <input
                  style={campo}
                  disabled={!editable}
                  value={s.descripcion}
                  onChange={(e) => cambiar((p) => (p.simbolos[i].descripcion = e.target.value))}
                />
              </td>
              {editable && (
                <td style={celda}>
                  <button
                    title="Quitar este símbolo"
                    onClick={() => cambiar((p) => p.simbolos.splice(i, 1))}
                    style={{ border: 'none', background: 'transparent', color: '#8a4a45', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <button
          onClick={() =>
            cambiar((p) => {
              const libre = ['M0.0', ...DIRECCIONES].find((d) => areaDe(d) === 'M' && !p.simbolos.some((s) => s.dir === d)) ?? 'M0.0'
              p.simbolos.push({ dir: libre, nombre: '', descripcion: '' })
            })
          }
          style={{ ...botonSuave, marginTop: 6 }}
        >
          ＋ Añadir símbolo
        </button>
      )}
      <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#5a6b7d' }}>
        Las entradas y salidas vienen cableadas por la planta; ponles el nombre que quieras. Para marcas, temporizadores
        y contadores añade tus propios símbolos.
      </p>
    </div>
  )
}

const tarjeta: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e0e5eb',
  borderRadius: 10,
  padding: '1rem 1.25rem',
  marginTop: 12,
  boxShadow: '0 1px 3px rgba(28, 39, 51, 0.06)',
  minWidth: 0,
}
const subtitulo: React.CSSProperties = { margin: '0 0 0.6rem', fontSize: '1rem', color: '#33475c', display: 'flex', alignItems: 'center', gap: 8 }
const boton: React.CSSProperties = {
  border: 'none',
  color: '#fff',
  padding: '0.45rem 0.9rem',
  borderRadius: 8,
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
}
const botonSuave: React.CSSProperties = {
  border: '1px solid #c6ced6',
  background: '#fff',
  color: '#33475c',
  padding: '0.35rem 0.75rem',
  borderRadius: 7,
  fontSize: '0.85rem',
  cursor: 'pointer',
}
const rotulo: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#5a6b7d' }
const chip: React.CSSProperties = {
  background: '#33475c',
  color: '#fff',
  borderRadius: 999,
  padding: '0.15rem 0.6rem',
  fontSize: '0.78rem',
  fontWeight: 700,
  letterSpacing: '0.03em',
}
const estadoPLC: React.CSSProperties = { color: '#fff', borderRadius: 6, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }
const avisoOk: React.CSSProperties = {
  margin: '0 0 10px',
  padding: '0.5rem 0.8rem',
  background: '#e7f7ef',
  border: '1px solid #a9dcc4',
  borderRadius: 8,
  color: '#0a6b3c',
  fontSize: '0.88rem',
}
