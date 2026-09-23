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
import { EJERCICIOS_PLC, programaDeEjercicio } from './ejercicios'
import TarjetaEjercicio from './TarjetaEjercicio'
import {
  ENTRADAS,
  MARCAS,
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
import { formatear, type Notacion } from './notacion'
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
  const [notacion, setNotacion] = useState<Notacion>(() => {
    try {
      return localStorage.getItem('neumalab.plc.notacion') === 'ab' ? 'ab' : 'siemens'
    } catch {
      return 'siemens'
    }
  })
  const notacionRef = useRef(notacion)
  notacionRef.current = notacion
  useEffect(() => {
    try {
      localStorage.setItem('neumalab.plc.notacion', notacion)
    } catch {
      /* sin almacenamiento */
    }
  }, [notacion])
  /** Tipo de cada entrada libre del simulador de E/S (las que la planta no usa). */
  const [tiposLibres, setTiposLibres] = useState<Record<string, TipoLibre>>({})
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
    setTiposLibres({})
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
      const d = formatear(dir, notacionRef.current)
      return s?.nombre ? `${s.nombre} (${d})` : d
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
      // Los pulsadores NC de la planta dan 1 en reposo y 0 al pulsarlos.
      for (const m of PLANTAS[sim.planta.id].mandos) if (m.nc) entradas[m.dir] = !sim.mandos[m.dir]
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
  const ejercicioActual = EJERCICIOS_PLC.find((e) => e.id === programa.ejercicio) ?? null
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
    // En un ejercicio, «nuevo» vuelve a empezarlo (se conserva el enunciado).
    const ej = EJERCICIOS_PLC.find((e) => e.id === programa.ejercicio)
    setPrograma(ej ? programaDeEjercicio(ej) : programaVacio(programa.planta, PLANTAS[programa.planta].cableado.map((s) => ({ ...s }))))
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
        <button onClick={nuevo} style={{ ...boton, background: '#fff', color: '#1668c7', border: '2px solid #1668c7', padding: '0.5rem 1.1rem' }}>
          ＋ Nuevo programa
        </button>
        <label style={rotulo}>
          Ejemplos:
          <select
            value=""
            onChange={(e) => {
              const valor = e.target.value
              e.target.value = ''
              const ejercicio = EJERCICIOS_PLC.find((x) => `ejercicio:${x.id}` === valor)
              if (ejercicio) {
                if (!confirmar(`¿Empezar «${ejercicio.titulo}»?`)) return
                setCorriendo(false)
                setPrograma(programaDeEjercicio(ejercicio))
                return
              }
              const ej = EJEMPLOS_PLC.find((x) => x.id === valor)
              if (!ej || !confirmar(`¿Cargar «${ej.etiqueta}»?`)) return
              setCorriendo(false)
              setPrograma(clonarPrograma(ej.programa))
            }}
            style={{ padding: '0.3rem 0.4rem', maxWidth: 280 }}
          >
            <option value="">— elige un programa —</option>
            <optgroup label="Ejercicios para resolver (sin solución)">
              {EJERCICIOS_PLC.map((e) => (
                <option key={e.id} value={`ejercicio:${e.id}`}>
                  📝 {e.titulo}
                </option>
              ))}
            </optgroup>
            <optgroup label="Ejemplos resueltos">
              {EJEMPLOS_PLC.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.etiqueta}
                </option>
              ))}
            </optgroup>
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
        <label style={rotulo} title="Cómo se escriben las direcciones: como en el apunte o como en LogixPro / RSLogix">
          Direcciones:
          <select value={notacion} onChange={(e) => setNotacion(e.target.value as Notacion)} style={{ padding: '0.3rem 0.4rem' }}>
            <option value="siemens">Apunte (I0.3, Q0.1)</option>
            <option value="ab">LogixPro (I:1/03, O:2/01)</option>
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

      {ejercicioActual && <TarjetaEjercicio ejercicio={ejercicioActual} programa={programa} notacion={notacion} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))', gap: 14, alignItems: 'start' }}>
        <section style={{ ...tarjeta, marginTop: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: '0.6rem' }}>
            {/* RUN / STOP junto al programa: se prueba sin salir del diagrama. */}
            <button
              onClick={() => setCorriendo((c) => !c)}
              title="Atajo: barra espaciadora"
              aria-pressed={corriendo}
              style={{ ...boton, background: corriendo ? '#33475c' : '#12a35a', padding: '0.5rem 1.2rem', fontSize: '0.98rem' }}
            >
              {corriendo ? '■ STOP' : '▶ RUN'}
            </button>
            <h2 style={{ ...subtitulo, margin: 0 }}>
              Programa Ladder{programa.nombre ? ` · ${programa.nombre}` : ''}
              <span style={{ ...estadoPLC, background: corriendo ? '#12a35a' : '#ffa726' }}>{corriendo ? 'RUN' : 'STOP'}</span>
            </h2>
          </div>
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
            notacion={notacion}
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
              notacion={notacion}
            />
          </Suspense>
          <PanelES
            mandos={descripcion.mandos}
            simbolos={programa.simbolos}
            cableado={descripcion.cableado.map((c) => c.dir)}
            estado={estado}
            mandosActivos={sim.mandos}
            pulsar={pulsar}
            notacion={notacion}
            tiposLibres={tiposLibres}
            onTipoLibre={(dir, tipo) => {
              setTiposLibres((t) => ({ ...t, [dir]: tipo }))
              // Un pulsador NC da 1 en reposo.
              pulsar(dir, tipo === 'NC')
            }}
          />
        </section>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <section style={{ ...tarjeta, flex: '2 1 460px', minWidth: 0 }}>
          <h2 style={subtitulo}>Tabla de símbolos · asignación de entradas y salidas</h2>
          <TablaSimbolos programa={programa} onCambiar={setPrograma} editable={!corriendo} notacion={notacion} />
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
        <Seccion titulo="Tabla de datos · la memoria del PLC por dentro">
          <TablaDatos estado={estado} programa={programa} notacion={notacion} />
        </Seccion>
      </section>

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

type TipoLibre = 'interruptor' | 'NA' | 'NC'

/**
 * Simulador de E/S, como el de LogixPro: las 8 entradas y las 8 salidas del
 * PLC. Las entradas que usa la planta las mueve la planta (sus sensores) o sus
 * mandos; las demás quedan libres, con un interruptor o un pulsador NA / NC
 * para probar cualquier programa.
 */
function PanelES({
  mandos,
  simbolos,
  cableado,
  estado,
  mandosActivos,
  pulsar,
  notacion,
  tiposLibres,
  onTipoLibre,
}: {
  mandos: Mando[]
  simbolos: ProgramaPLC['simbolos']
  cableado: string[]
  estado: EstadoPLC
  mandosActivos: Record<string, boolean>
  pulsar: (dir: string, v: boolean) => void
  notacion: Notacion
  tiposLibres: Record<string, TipoLibre>
  onTipoLibre: (dir: string, tipo: TipoLibre) => void
}) {
  const colores: Record<string, string> = { verde: '#19a34e', rojo: '#c62828', negro: '#2b3036', amarillo: '#d4a017' }
  const nombre = (d: string) => simbolos.find((s) => s.dir === d)?.nombre ?? ''
  const fmt = (d: string) => formatear(d, notacion)
  const botonMando = (dir: string, texto: string, tipo: 'pulsador' | 'interruptor' | 'NC', color: string) => {
    const on = !!mandosActivos[dir]
    const pulsado = tipo === 'NC' ? !on : on
    return (
      <button
        key={dir}
        data-mando={dir}
        title={tipo === 'interruptor' ? `Cambia ${texto} (${fmt(dir)})` : `Mantén pulsado ${texto} (${fmt(dir)})`}
        style={{
          border: `2px solid ${color}`,
          background: pulsado ? color : '#fff',
          color: pulsado ? '#fff' : color,
          borderRadius: tipo === 'interruptor' ? 6 : 999,
          padding: '0.25rem 0.7rem',
          fontWeight: 700,
          cursor: 'pointer',
          userSelect: 'none',
          touchAction: 'none',
          fontSize: '0.82rem',
        }}
        onPointerDown={(e) => {
          if (tipo === 'interruptor') {
            pulsar(dir, !on)
            return
          }
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* puntero sintético */
          }
          pulsar(dir, tipo !== 'NC')
        }}
        onPointerUp={() => tipo !== 'interruptor' && pulsar(dir, tipo === 'NC')}
        onPointerCancel={() => tipo !== 'interruptor' && pulsar(dir, tipo === 'NC')}
      >
        {tipo === 'interruptor' ? (on ? '◉ ' : '○ ') : '● '}
        {texto}
      </button>
    )
  }
  const led = (d: string) => {
    const on = !!estado.bits[d]
    const esEntrada = d.startsWith('I')
    const color = esEntrada ? '#2ee06d' : '#ffa726'
    return (
      <span
        style={{
          width: 11,
          height: 11,
          borderRadius: 999,
          background: on ? color : '#c9ced4',
          boxShadow: on ? `0 0 6px ${color}` : 'none',
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
    )
  }
  const deMandos = new Set(mandos.map((m) => m.dir))
  return (
    <div style={{ marginTop: 10 }}>
      {mandos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '0.8rem', color: '#5a6b7d' }}>Mandos de la planta:</span>
          {mandos.map((m) => botonMando(m.dir, m.nombre, m.tipo, colores[m.color]))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        <div>
          <p style={subRotulo}>Entradas</p>
          {ENTRADAS.map((d) => {
            const libre = !cableado.includes(d)
            const tipo = tiposLibres[d] ?? 'interruptor'
            return (
              <div key={d} style={filaES} data-es={d} data-valor={estado.bits[d] ? 1 : 0}>
                {led(d)}
                <code style={{ minWidth: 48 }}>{fmt(d)}</code>
                {libre ? (
                  <>
                    {botonMando(d, nombre(d) || 'libre', tipo === 'interruptor' ? 'interruptor' : tipo === 'NC' ? 'NC' : 'pulsador', '#1d5ea8')}
                    <select
                      value={tipo}
                      title="Qué elemento hay en esta entrada libre"
                      onChange={(e) => onTipoLibre(d, e.target.value as TipoLibre)}
                      style={{ fontSize: '0.76rem', padding: '0.1rem' }}
                    >
                      <option value="interruptor">interruptor</option>
                      <option value="NA">pulsador NA</option>
                      <option value="NC">pulsador NC</option>
                    </select>
                  </>
                ) : (
                  <span>
                    <strong>{nombre(d)}</strong>
                    <span style={{ color: '#8a97a5', fontSize: '0.76rem' }}>{deMandos.has(d) ? ' · mando' : ' · sensor de la planta'}</span>
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div>
          <p style={subRotulo}>Salidas</p>
          {SALIDAS.map((d) => (
            <div key={d} style={filaES} data-es={d} data-valor={estado.bits[d] ? 1 : 0}>
              {led(d)}
              <code style={{ minWidth: 48 }}>{fmt(d)}</code>
              <strong>{nombre(d)}</strong>
              {!cableado.includes(d) && <span style={{ color: '#8a97a5', fontSize: '0.76rem' }}>· piloto libre</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const subRotulo: React.CSSProperties = { margin: '0 0 4px', fontSize: '0.8rem', color: '#5a6b7d', fontWeight: 700 }
const filaES: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#33475c', minHeight: 28 }

/**
 * Tabla de datos, como la de LogixPro: los bits de entradas, salidas y
 * marcas, y cada temporizador y contador con su preset, acumulado y bits.
 */
function TablaDatos({ estado, programa, notacion }: { estado: EstadoPLC; programa: ProgramaPLC; notacion: Notacion }) {
  const fmt = (d: string) => formatear(d, notacion)
  const nombre = (d: string) => programa.simbolos.find((s) => s.dir === d)?.nombre ?? ''
  const celda: React.CSSProperties = { border: '1px solid #e0e5eb', padding: '3px 6px', textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem' }
  const bit = (v: boolean | undefined) => (
    <td style={{ ...celda, background: v ? '#d8f3e5' : '#fff', color: v ? '#0a6b3c' : '#8a97a5', fontWeight: 700 }}>{v ? 1 : 0}</td>
  )
  const filaBits = (titulo: string, dirs: string[]) => (
    <tr>
      <th style={{ ...celda, textAlign: 'left', background: '#f4f7fb' }}>{titulo}</th>
      {dirs.map((d) => (
        <td key={d} style={{ ...celda, padding: 0 }} title={`${fmt(d)}${nombre(d) ? ` · ${nombre(d)}` : ''}`}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ fontSize: '0.66rem', color: '#8a97a5', textAlign: 'center' }}>{fmt(d).replace(/^.*[./]/, '')}</td>
              </tr>
              <tr>{bit(estado.bits[d])}</tr>
            </tbody>
          </table>
        </td>
      ))}
    </tr>
  )
  const usados = (letra: 'T' | 'C') => {
    const s = new Set<string>()
    for (const e of programa.escalones) for (const b of e.bobinas) if (b?.dir.startsWith(letra)) s.add(b.dir)
    return [...s].sort()
  }
  const temporizadores = usados('T')
  const contadores = usados('C')
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {filaBits(notacion === 'ab' ? 'I:1' : 'I0', ENTRADAS)}
            {filaBits(notacion === 'ab' ? 'O:2' : 'Q0', SALIDAS)}
            {filaBits(notacion === 'ab' ? 'B3:0' : 'M0', MARCAS.slice(0, 8))}
            {filaBits(notacion === 'ab' ? 'B3:0 (8–15)' : 'M1', MARCAS.slice(8))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: '#33475c', color: '#fff' }}>
              {['Temporizador', 'Tipo', 'PRE (s)', 'ACC (s)', 'EN', 'TT', 'DN'].map((h) => (
                <th key={h} style={{ ...celda, color: '#fff' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {temporizadores.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...celda, fontFamily: 'inherit', color: '#8a97a5' }}>El programa no usa temporizadores.</td>
              </tr>
            )}
            {temporizadores.map((d) => {
              const tm = estado.temporizadores[d]
              const b = programa.escalones.flatMap((e) => e.bobinas).find((x) => x?.dir === d && /TON|TOF|RTO/.test(x.tipo))
              return (
                <tr key={d}>
                  <td style={{ ...celda, textAlign: 'left' }}>
                    {fmt(d)} {nombre(d) && <span style={{ fontFamily: 'inherit', color: '#5a6b7d' }}>· {nombre(d)}</span>}
                  </td>
                  <td style={celda}>{b?.tipo ?? '—'}</td>
                  <td style={celda}>{(tm?.preset ?? b?.preset ?? 0).toFixed(1)}</td>
                  <td style={celda}>{(tm?.acumulado ?? 0).toFixed(2)}</td>
                  {bit(tm?.activo)}
                  {bit(tm?.contando)}
                  {bit(tm?.hecho)}
                </tr>
              )
            })}
          </tbody>
        </table>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: '#33475c', color: '#fff' }}>
              {['Contador', 'Tipo', 'PRE', 'ACC', 'CU', 'DN'].map((h) => (
                <th key={h} style={{ ...celda, color: '#fff' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contadores.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...celda, fontFamily: 'inherit', color: '#8a97a5' }}>El programa no usa contadores.</td>
              </tr>
            )}
            {contadores.map((d) => {
              const ct = estado.contadores[d]
              const b = programa.escalones.flatMap((e) => e.bobinas).find((x) => x?.dir === d && /CTU|CTD/.test(x.tipo))
              return (
                <tr key={d}>
                  <td style={{ ...celda, textAlign: 'left' }}>
                    {fmt(d)} {nombre(d) && <span style={{ fontFamily: 'inherit', color: '#5a6b7d' }}>· {nombre(d)}</span>}
                  </td>
                  <td style={celda}>{b?.tipo ?? '—'}</td>
                  <td style={celda}>{ct?.preset ?? b?.preset ?? 0}</td>
                  <td style={celda}>{ct?.valor ?? (b?.tipo === 'CTD' ? b.preset ?? 0 : 0)}</td>
                  {bit(ct?.anterior)}
                  {bit(ct?.hecho)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#5a6b7d' }}>
        EN: la instrucción tiene corriente · TT: el temporizador está contando · DN: terminó (su contacto se cierra) · CU:
        el contador tiene corriente. Estos bits se pueden usar como contactos (por ejemplo {fmt('T0.DN')} o {fmt('T0.TT')}).
      </p>
    </div>
  )
}

function TablaSimbolos({
  programa,
  onCambiar,
  editable,
  notacion,
}: {
  programa: ProgramaPLC
  onCambiar: (p: ProgramaPLC) => void
  editable: boolean
  notacion: Notacion
}) {
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
                      {formatear(d, notacion)}
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
