/**
 * Unidad 2 · PLC: programar en Ladder y probar el programa contra una
 * planta del laboratorio (tablero, estanque, elevador), en 3D y con sonido.
 *
 * Como en el laboratorio: en STOP se edita el programa; en RUN el PLC lo
 * ejecuta en ciclos de scan contra la planta, las salidas mueven la máquina
 * y los sensores de la máquina vuelven a las entradas.
 */
import { botonPrimario, estiloAviso, Etiquetado, Menu, useEsEstrecha } from '../components/ui'
import BancoDividido, { TituloArea } from '../components/banco/BancoDividido'
import { usePanelAcoplado, type PestanaPanel } from '../components/banco/PanelAcoplado'
import PaginaEstudiar, { type SeccionEstudio } from '../components/banco/PaginaEstudiar'
import SubnavUnidad, { useSeccionUnidad } from '../components/banco/SubnavUnidad'
import CajonEntregar from '../components/banco/CajonEntregar'
import MisTrabajos from '../components/banco/MisTrabajos'
import { copiarTabla, copiarTexto, descargarTexto, enlaceTrabajo, limpiarEnlace, trabajoDelEnlace } from '../entregar'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { exportarPng, nombreSeguro } from '../exportar'
import EditorLadder from './EditorLadder'
import { EJEMPLOS_PLC } from './ejemplos'
import { EJERCICIOS_PLC, programaDeEjercicio } from './ejercicios'
import TarjetaEjercicio from './TarjetaEjercicio'
import { Historial } from '../historial'
import {
  ENTRADAS,
  MARCAS,
  PALABRAS,
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
  const [programa, setProgramaCrudo] = useState<ProgramaPLC>(leerGuardado)
  // Deshacer / rehacer: cada cambio del programa pasa por aquí.
  const historialRef = useRef(new Historial<ProgramaPLC>())
  const [, setHayHistoria] = useState(0)
  const setPrograma = useCallback((p: ProgramaPLC) => {
    historialRef.current.anotar(programaRef.current)
    setProgramaCrudo(p)
    setHayHistoria((n) => n + 1)
  }, [])
  const deshacer = useCallback(() => {
    const previo = historialRef.current.deshacer(programaRef.current)
    if (previo) setProgramaCrudo(previo)
    setHayHistoria((n) => n + 1)
  }, [])
  const rehacer = useCallback(() => {
    const siguiente = historialRef.current.rehacer(programaRef.current)
    if (siguiente) setProgramaCrudo(siguiente)
    setHayHistoria((n) => n + 1)
  }, [])
  const [corriendo, setCorriendo] = useState(false)
  const [version, setVersion] = useState(0)
  const [, setFotograma] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const estrecha = useEsEstrecha()
  const [seccion, setSeccion] = useSeccionUnidad(SECCIONES_PLC.map((x) => x.id))
  const panel = usePanelAcoplado<PestanaPLC>('neumalab.plc.panel', 'es', typeof window !== 'undefined' && window.innerHeight >= 860)
  const [movil, setMovil] = useState('programa')
  const [entregaAbierta, setEntregaAbierta] = useState(false)
  const [misTrabajos, setMisTrabajos] = useState(false)
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
  /** Entradas y salidas forzadas (como «Force» en LogixPro). */
  const [forzados, setForzados] = useState<Record<string, boolean>>({})
  const forzadosRef = useRef(forzados)
  forzadosRef.current = forzados
  const programaRef = useRef(programa)
  programaRef.current = programa
  const flujosRef = useRef<FlujoEscalon[] | null>(null)
  const eventosRef = useRef<Evento[]>([])
  /** Último aviso de la planta, para mostrarlo junto a ella unos segundos. */
  const avisoPlantaRef = useRef<{ mensaje: string; hasta: number } | null>(null)

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

  // Un enlace con un programa (#plc=…) lo abre, avisando si reemplaza el que había.
  useEffect(() => {
    void trabajoDelEnlace('plc').then((dato) => {
      if (!dato) return
      limpiarEnlace()
      if (!esProgramaPLC(dato)) return setAviso('El enlace no trae un programa de PLC válido.')
      if (!window.confirm('¿Abrir el programa que viene en el enlace? Reemplaza el programa que tienes en el editor.')) return
      setCorriendo(false)
      setPrograma(dato)
      setAviso(`Programa del enlace abierto${dato.nombre ? `: «${dato.nombre}»` : ''}.`)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        const r = scan(programaRef.current, estado, entradas, DT, forzadosRef.current)
        flujosRef.current = r.flujos
      } else {
        // En STOP las entradas se siguen viendo, pero las salidas están a 0.
        const fz = forzadosRef.current
        for (const d of ENTRADAS) estado.bits[d] = d in fz ? fz[d] : !!entradas[d]
        for (const d of SALIDAS) estado.bits[d] = d in fz ? fz[d] : false
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
      for (const e of sim.planta.eventos.splice(0)) {
        registrar(`🏭 ${e.mensaje}`, e.aviso)
        if (e.aviso) avisoPlantaRef.current = { mensaje: e.mensaje, hasta: Date.now() + 7000 }
      }
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
      // Ctrl/Cmd+Z deshace y Ctrl/Cmd+Shift+Z o Ctrl+Y rehace (sólo en STOP).
      if ((e.ctrlKey || e.metaKey) && !simRef.current.corriendo) {
        const k = e.key.toLowerCase()
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault()
          deshacer()
        } else if ((k === 'z' && e.shiftKey) || k === 'y') {
          e.preventDefault()
          rehacer()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deshacer, rehacer])

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

  const eventos = eventosRef.current
  const hayForzados = Object.keys(forzados).length > 0

  const panelES = (parte: 'mandos' | 'tabla') => (
    <PanelES
      parte={parte}
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
      forzados={forzados}
      onForzar={(dir, v) =>
        setForzados((f) => {
          const n = { ...f }
          if (v === null) delete n[dir]
          else n[dir] = v
          return n
        })
      }
    />
  )

  const selectorPlanta = (
    <select
      value={programa.planta}
      onChange={(e) => cambiarPlanta(e.target.value as IdPlanta)}
      aria-label="Planta"
      style={{ padding: '0.35rem 0.4rem', minHeight: 36, width: estrecha ? '100%' : 220, maxWidth: 320 }}
      data-planta="si"
    >
      {Object.values(PLANTAS).map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
        </option>
      ))}
    </select>
  )
  const itemsArchivo = [
    { texto: 'Nuevo programa', ayuda: 'Empieza con el diagrama vacío', onClick: nuevo },
    { texto: 'Abrir…', ayuda: 'Un programa guardado (.json)', onClick: () => inputArchivo.current?.click() },
    { texto: 'Guardar', ayuda: 'Descarga el programa para volver a abrirlo', onClick: guardar },
    { texto: 'Mis trabajos…', ayuda: 'Guarda varios programas con nombre y cámbiate entre ellos', onClick: () => setMisTrabajos(true), separar: true },
  ]
  const itemExportar = { texto: 'Diagrama Ladder (PNG)', ayuda: 'Imagen del programa para tu informe', onClick: () => void exportarLadder() }

  const barra = (
    <>
      {/* RUN / STOP: la acción principal. */}
      <button onClick={() => setCorriendo((c) => !c)} title="Atajo: barra espaciadora" aria-pressed={corriendo} style={botonPrimario(corriendo)} data-run="si">
        {corriendo ? '■ STOP' : '▶ RUN'}
      </button>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        <button onClick={deshacer} disabled={corriendo || !historialRef.current.puedeDeshacer} title="Deshacer (Ctrl+Z)" aria-label="Deshacer" className="boton-icono" style={{ opacity: corriendo || !historialRef.current.puedeDeshacer ? 0.4 : 1 }}>
          ↶
        </button>
        <button onClick={rehacer} disabled={corriendo || !historialRef.current.puedeRehacer} title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer" className="boton-icono" style={{ opacity: corriendo || !historialRef.current.puedeRehacer ? 0.4 : 1 }}>
          ↷
        </button>
      </span>
      <select
        value=""
        aria-label="Ejemplos y ejercicios"
        title="Abrir un ejemplo resuelto o un ejercicio para resolver"
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
        style={{ padding: '0.35rem 0.4rem', width: estrecha ? '32vw' : 210, minHeight: 36 }}
        data-ejemplos-plc="si"
      >
        <option value="">Ejemplos y ejercicios…</option>
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
      {!estrecha && <Etiquetado texto="Planta">{selectorPlanta}</Etiquetado>}
      {!estrecha && (
        <Etiquetado texto="Direcciones" titulo="Cómo se escriben las direcciones: como en el apunte o como en LogixPro / RSLogix">
          <select value={notacion} onChange={(e) => setNotacion(e.target.value as Notacion)} style={{ padding: '0.35rem 0.4rem', minHeight: 36, width: 172 }}>
            <option value="siemens">Apunte (I0.3)</option>
            <option value="ab">LogixPro (I:1/03)</option>
          </select>
        </Etiquetado>
      )}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        {estrecha ? (
          <Menu
            etiqueta="⋯"
            datos="mas"
            items={[
              ...itemsArchivo,
              { ...itemExportar, texto: 'Exportar Ladder (PNG)', separar: true },
              {
                texto: notacion === 'ab' ? 'Direcciones como en el apunte' : 'Direcciones como en LogixPro',
                ayuda: notacion === 'ab' ? 'I0.3, Q0.1' : 'I:1/03, O:2/01',
                onClick: () => setNotacion(notacion === 'ab' ? 'siemens' : 'ab'),
                separar: true,
              },
            ]}
          />
        ) : (
          <>
            <Menu etiqueta="Archivo" items={itemsArchivo} />
            <Menu etiqueta="Exportar" items={[itemExportar]} />
          </>
        )}
      </span>
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
    </>
  )

  const areaPrograma = (
    <>
      {ejercicioActual && <TarjetaEjercicio ejercicio={ejercicioActual} programa={programa} notacion={notacion} />}
      <TituloArea>
        Programa Ladder{programa.nombre ? ` · ${programa.nombre}` : ''}
        <span style={{ ...estadoPLC, background: corriendo ? '#0e7a43' : '#a35200' }}>{corriendo ? 'RUN' : 'STOP'}</span>
      </TituloArea>
      {corriendo && <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#51606f' }}>El PLC está ejecutando el programa. Pásalo a STOP para editarlo.</p>}
      <EditorLadder
        programa={programa}
        onCambiar={setPrograma}
        flujos={corriendo ? flujosRef.current : null}
        estado={corriendo ? estado : null}
        editable={!corriendo}
        notacion={notacion}
      />
      {avisos.length > 0 && (
        <div style={{ marginTop: 8 }} data-avisos-plc="si">
          {avisos.map((a, i) => (
            <p key={i} style={{ color: '#7a4f00', margin: '3px 0', fontSize: '0.86rem' }}>
              ⚠ {a}
            </p>
          ))}
        </div>
      )}
    </>
  )

  const areaPlanta = (
    <>
      {estrecha && <div style={{ marginBottom: 6 }}>{selectorPlanta}</div>}
      <TituloArea>
        Planta · {descripcion.nombre}
        <span title={descripcion.resumen} style={{ fontWeight: 400, fontSize: '0.8rem', color: '#51606f' }}>
          ⓘ
        </span>
      </TituloArea>
      <div className="relleno">
        <Suspense fallback={<p style={{ padding: 20, color: '#51606f' }}>Montando la planta…</p>}>
          <Planta3D
            sim={simRef}
            version={version}
            acciones={[]}
            onAccion={(id) => {
              sim.planta.accion(id)
              setFotograma((f) => f + 1)
            }}
            notacion={notacion}
            alto="100%"
          />
        </Suspense>
      </div>
      {avisoPlantaRef.current && avisoPlantaRef.current.hasta > Date.now() && (
        <p role="alert" style={{ margin: '8px 0 0', padding: '0.45rem 0.7rem', background: '#fff4e5', border: '1px solid #f0c98a', borderRadius: 8, color: '#8a3b00', fontSize: '0.86rem' }}>
          ⚠ {avisoPlantaRef.current.mensaje}
        </p>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
        {panelES('mandos')}
        {sim.planta.acciones().length > 0 && (
          <>
            <span style={{ fontSize: '0.8rem', color: '#51606f', marginLeft: 6 }}>En la planta:</span>
            {sim.planta.acciones().map((a) => (
              <button
                key={a.id}
                title={a.titulo}
                style={{ ...botonSuave, borderColor: '#1668c7', color: '#1668c7', fontWeight: 600 }}
                onClick={() => {
                  sim.planta.accion(a.id)
                  setFotograma((f) => f + 1)
                }}
              >
                {a.etiqueta}
              </button>
            ))}
          </>
        )}
      </div>
    </>
  )

  const registro =
    eventos.length === 0 ? (
      <p style={{ color: '#51606f', margin: 0, fontSize: '0.88rem' }}>Pulsa ▶ RUN y acciona la planta: aquí aparece lo que va ocurriendo, en orden.</p>
    ) : (
      <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', lineHeight: 1.55, fontSize: '0.88rem' }} data-registro="si">
        {eventos.map((e, i) => (
          <li key={`${e.t}-${i}`} style={{ opacity: i === eventos.length - 1 ? 1 : 0.8, color: e.aviso ? '#8a3b00' : undefined }}>
            <code style={{ color: '#51606f', marginRight: 8 }}>t={e.t.toFixed(1)} s</code>
            {e.aviso ? '⚠ ' : ''}
            {e.mensaje}
          </li>
        ))}
      </ol>
    )

  const pestanas: Array<PestanaPanel<PestanaPLC>> = [
    { id: 'es', titulo: 'Entradas y salidas', contenido: panelES('tabla') },
    { id: 'simbolos', titulo: 'Tabla de símbolos', contenido: <TablaSimbolos programa={programa} onCambiar={setPrograma} editable={!corriendo} notacion={notacion} /> },
    {
      id: 'datos',
      titulo: 'Tabla de datos',
      contenido: (
        <TablaDatos
          estado={estado}
          programa={programa}
          notacion={notacion}
          onPalabra={(d, v) => {
            simRef.current.estado.palabras[d] = v
            setFotograma((f) => f + 1)
          }}
        />
      ),
    },
    { id: 'registro', titulo: '¿Qué está pasando?', contador: eventos.length, contenido: registro, seguirFinal: true },
  ]

  const barraEstado = (
    <>
      <span>
        {corriendo
          ? 'RUN: el PLC ejecuta el programa contra la planta · pulsa los mandos o los botones de la máquina · Espacio pasa a STOP.'
          : 'STOP: elige una herramienta y haz clic en una casilla para editar · Espacio pasa a RUN.'}
      </span>
      {hayForzados && (
        <button
          onClick={() => {
            panel.onPestana('es')
            panel.onAbrir(true)
          }}
          style={{ border: 'none', background: 'transparent', color: '#8e1c1c', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
        >
          ⚠ E/S forzadas
        </button>
      )}
      {avisos.length > 0 && <span style={{ marginLeft: hayForzados ? 0 : 'auto', color: '#7a4f00', fontWeight: 700 }}>⚠ {avisos.length} {avisos.length === 1 ? 'aviso' : 'avisos'}</span>}
    </>
  )

  return (
    <>
      <SubnavUnidad nombre="PLC" seccion={seccion} onSeccion={setSeccion} entregar={{ abierto: entregaAbierta, onAlternar: () => setEntregaAbierta((a) => !a) }} />
      {seccion === 'laboratorio' ? (
        <BancoDividido<PestanaPLC>
          clave="neumalab.plc.banco"
          barra={barra}
          izquierda={{ id: 'programa', titulo: 'Programa', contenido: areaPrograma }}
          derecha={{ id: 'planta', titulo: 'Planta', contenido: areaPlanta }}
          inferior={{ etiqueta: 'Entradas, tablas y registro', pestanas, estado: panel }}
          estado={barraEstado}
          movil={movil}
          onMovil={setMovil}
          conCajon={entregaAbierta && !estrecha}
        />
      ) : (
        <PaginaEstudiar
          etiqueta="Estudiar PLC"
          titulo="Estudiar · PLC"
          descripcion="Teoría de la unidad. Los programas de ejemplo y los ejercicios se abren en el Laboratorio."
          pie="NeumaLab · MEC275 — Unidad 2: Controlador Lógico Programable · Ladder"
          secciones={SECCIONES_PLC}
        />
      )}
      {misTrabajos && (
        <MisTrabajos
          unidad="plc"
          nombreActual={programa.nombre ?? ''}
          actual={() => programa}
          abrir={(dato) => {
            if (!esProgramaPLC(dato)) return 'Ese trabajo no es un programa de PLC válido.'
            setCorriendo(false)
            setPrograma(dato)
          }}
          onCerrar={() => setMisTrabajos(false)}
        />
      )}
      {entregaAbierta && (
        <CajonEntregar
          unidad="PLC"
          clave="neumalab.plc.entrega"
          trabajoSugerido="Trabajo-2"
          onCerrar={() => setEntregaAbierta(false)}
          revisar={() => {
            const usadas = new Set<string>()
            for (const e of programa.escalones) {
              for (const f of e.celdas) for (const c of f) if ('dir' in c && typeof c.dir === 'string' && c.dir) usadas.add(c.dir)
              for (const b of e.bobinas) if (b?.dir) usadas.add(b.dir)
            }
            const sinNombre = [...usadas].filter((d) => ['I', 'Q'].includes(areaDe(d) ?? '') && !programa.simbolos.find((x) => x.dir === d)?.nombre)
            return [
              { ok: hayContenido, texto: hayContenido ? `El programa tiene ${programa.escalones.length} escalón(es).` : 'El programa está vacío.' },
              { ok: avisos.length === 0, texto: avisos.length === 0 ? 'El editor no encuentra problemas en el programa.' : `Hay ${avisos.length} aviso(s). El primero: ${avisos[0]}` },
              {
                ok: sinNombre.length === 0,
                texto: sinNombre.length === 0 ? 'Todas las entradas y salidas que usas tienen nombre en la tabla de símbolos.' : `Ponle nombre en la tabla de símbolos a: ${sinNombre.map((d) => formatear(d, notacion)).join(', ')}.`,
              },
              { ok: Object.keys(forzados).length === 0, texto: Object.keys(forzados).length === 0 ? 'No quedan entradas ni salidas forzadas.' : 'Quedan E/S forzadas: quítalas antes de probar y entregar.' },
              {
                ok: true,
                texto: ejercicioActual ? 'Pruébalo con «✓ Verificar mi programa» del ejercicio y también en RUN, accionando la planta.' : 'Pruébalo en RUN accionando la planta (pestaña Planta) antes de entregar.',
              },
            ]
          }}
          presentacion={[
            {
              id: 'ladder',
              tipo: 'imagen',
              titulo: 'Diagrama Ladder',
              detalle: 'Tu programa completo, escalón por escalón.',
              hacer: async (base) => {
                const svg = document.getElementById('ladder-svg') as SVGSVGElement | null
                if (!svg) throw new Error('No se encontró el diagrama.')
                await exportarPng(svg, `${base}_ladder.png`)
                return `Descargada: ${base}_ladder.png`
              },
            },
            {
              id: 'es',
              tipo: 'tabla',
              titulo: 'Tabla de entradas y salidas',
              detalle: 'Símbolo, dirección, tipo y descripción, desde tu tabla de símbolos.',
              hacer: async () => {
                const tipo: Record<string, string> = { I: 'Entrada (INPUT)', Q: 'Salida (OUTPUT)', M: 'Marca', T: 'Temporizador', C: 'Contador' }
                const orden = 'IQMTC'
                const filas = programa.simbolos
                  .filter((x) => x.nombre.trim())
                  .sort((a, b) => orden.indexOf(areaDe(a.dir) ?? 'Z') - orden.indexOf(areaDe(b.dir) ?? 'Z') || a.dir.localeCompare(b.dir))
                  .map((x) => [x.nombre, formatear(x.dir, notacion), tipo[areaDe(x.dir) ?? ''] ?? '', x.descripcion])
                if (!filas.length) throw new Error('Tu tabla de símbolos no tiene nombres todavía.')
                return (await copiarTabla([['Símbolo', 'Dirección', 'Tipo', 'Descripción'], ...filas])) ? 'Tabla copiada: pégala en tu presentación (Ctrl+V).' : 'Tu navegador no dejó copiar.'
              },
            },
          ]}
          archivos={[
            {
              id: 'enlace',
              tipo: 'enlace',
              titulo: 'Enlace a tu programa',
              detalle: 'Pégalo en tu PDF: quien lo abra ve tu programa en la app y lo puede correr.',
              hacer: async () => {
                const url = await enlaceTrabajo('plc', 'plc', programa)
                return (await copiarTexto(url)) ? 'Enlace copiado: pégalo en tu presentación.' : `Copia este enlace: ${url}`
              },
            },
            {
              id: 'programa',
              tipo: 'archivo',
              titulo: 'Tu programa (NeumaLab)',
              detalle: 'Se abre en la app con Archivo › Abrir.',
              hacer: (base) => {
                descargarTexto(JSON.stringify(programa, null, 2), `${base}.json`, 'application/json')
                return `Descargado: ${base}.json`
              },
            },
          ]}
        />
      )}
      {aviso && (
        <p role="status" style={avisoOk}>
          {aviso}
        </p>
      )}
    </>
  )
}

type PestanaPLC = 'es' | 'simbolos' | 'datos' | 'registro'

const SECCIONES_PLC: SeccionEstudio[] = [
  { id: 'que-es', indice: '¿Qué es un PLC?', titulo: '¿Qué es un PLC y para qué se usa?', contenido: <QueEsPLC /> },
  { id: 'componentes', indice: 'Componentes', titulo: 'Componentes de un PLC', contenido: <ComponentesPLC /> },
  { id: 'entradas-salidas', indice: 'Entradas y salidas', titulo: 'Entradas, salidas y direcciones', contenido: <EntradasSalidas /> },
  { id: 'elegir', indice: 'Cómo elegir un PLC', titulo: '¿Cómo elegir un PLC?', contenido: <ElegirPLC /> },
  { id: 'sensores', indice: 'Sensores', titulo: 'Sensores que se conectan al PLC', contenido: <Sensores /> },
  { id: 'ladder', indice: 'Ladder', titulo: 'Programación Ladder · contactos y bobinas', contenido: <SimbolosLadder /> },
  { id: 'scan', indice: 'Ciclo de scan', titulo: 'Cómo ejecuta el PLC tu programa: el ciclo de scan', contenido: <CicloScan /> },
]

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
  forzados,
  onForzar,
  parte,
}: {
  /** Sólo los mandos de la planta (bajo la vista 3D) o sólo la tabla de E/S. */
  parte: 'mandos' | 'tabla'
  mandos: Mando[]
  simbolos: ProgramaPLC['simbolos']
  cableado: string[]
  estado: EstadoPLC
  mandosActivos: Record<string, boolean>
  pulsar: (dir: string, v: boolean) => void
  notacion: Notacion
  tiposLibres: Record<string, TipoLibre>
  onTipoLibre: (dir: string, tipo: TipoLibre) => void
  forzados: Record<string, boolean>
  onForzar: (dir: string, v: boolean | null) => void
}) {
  /** Botón de forzado: sin forzar → forzar 1 → forzar 0 → sin forzar. */
  const forzar = (d: string) => {
    const f = forzados[d]
    const texto = f === undefined ? 'F' : f ? 'F1' : 'F0'
    return (
      <button
        onClick={() => onForzar(d, f === undefined ? true : f ? false : null)}
        title={f === undefined ? `Forzar ${formatear(d, notacion)} a 1 (y otra vez, a 0)` : `Forzada a ${f ? 1 : 0}: clic para ${f ? 'forzar a 0' : 'quitar el forzado'}`}
        data-forzar={d}
        style={{
          marginLeft: 'auto',
          border: `1px solid ${f === undefined ? '#c6ced6' : '#c62828'}`,
          background: f === undefined ? '#fff' : '#fdecea',
          color: f === undefined ? '#5f6b78' : '#c62828',
          borderRadius: 4,
          padding: '0 5px',
          minWidth: 28,
          minHeight: 26,
          fontSize: '0.72rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {texto}
      </button>
    )
  }
  const colores: Record<string, string> = { verde: '#0e7a43', rojo: '#c62828', negro: '#2b3036', amarillo: '#8a6500' }
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
  if (parte === 'mandos')
    return mandos.length > 0 ? (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: '#51606f' }}>Mandos de la planta:</span>
        {mandos.map((m) => botonMando(m.dir, m.nombre, m.tipo, colores[m.color]))}
      </div>
    ) : null
  return (
    <div>
      {Object.keys(forzados).length > 0 && (
        <p style={{ margin: '0 0 8px', padding: '4px 8px', background: '#fdecea', border: '1px solid #f1b0ab', borderRadius: 6, color: '#8e1c1c', fontSize: '0.8rem' }} data-aviso-forzado="si">
          ⚠ Hay E/S forzadas ({Object.entries(forzados).map(([d, v]) => `${formatear(d, notacion)}=${v ? 1 : 0}`).join(', ')}): valen eso sin importar el programa ni la planta. Úsalo sólo para probar y quítalo después.{' '}
          <button onClick={() => Object.keys(forzados).forEach((d) => onForzar(d, null))} style={{ border: '1px solid #c62828', background: '#fff', color: '#c62828', borderRadius: 4, cursor: 'pointer', fontSize: '0.76rem' }}>
            Quitar todos
          </button>
        </p>
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
                    <span style={{ color: '#5f6b78', fontSize: '0.76rem' }}>{deMandos.has(d) ? ' · mando' : ' · sensor de la planta'}</span>
                  </span>
                )}
                {forzar(d)}
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
              {!cableado.includes(d) && <span style={{ color: '#5f6b78', fontSize: '0.76rem' }}>· piloto libre</span>}
              {forzar(d)}
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
function TablaDatos({
  estado,
  programa,
  notacion,
  onPalabra,
}: {
  estado: EstadoPLC
  programa: ProgramaPLC
  notacion: Notacion
  onPalabra: (d: string, v: number) => void
}) {
  const fmt = (d: string) => formatear(d, notacion)
  const nombre = (d: string) => programa.simbolos.find((s) => s.dir === d)?.nombre ?? ''
  const celda: React.CSSProperties = { border: '1px solid #e0e5eb', padding: '3px 6px', textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem' }
  const bit = (v: boolean | undefined) => (
    <td style={{ ...celda, background: v ? '#d8f3e5' : '#fff', color: v ? '#0a6b3c' : '#5f6b78', fontWeight: 700 }}>{v ? 1 : 0}</td>
  )
  const filaBits = (titulo: string, dirs: string[]) => (
    <tr>
      <th style={{ ...celda, textAlign: 'left', background: '#f4f7fb' }}>{titulo}</th>
      {dirs.map((d) => (
        <td key={d} style={{ ...celda, padding: 0 }} title={`${fmt(d)}${nombre(d) ? ` · ${nombre(d)}` : ''}`}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ fontSize: '0.66rem', color: '#5f6b78', textAlign: 'center' }}>{fmt(d).replace(/^.*[./]/, '')}</td>
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
                <td colSpan={7} style={{ ...celda, fontFamily: 'inherit', color: '#5f6b78' }}>El programa no usa temporizadores.</td>
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
                <td colSpan={6} style={{ ...celda, fontFamily: 'inherit', color: '#5f6b78' }}>El programa no usa contadores.</td>
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
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse' }} data-tabla-registros="si">
          <tbody>
            <tr>
              <th style={{ ...celda, textAlign: 'left', background: '#f4f7fb' }}>{notacion === 'ab' ? 'N7 (enteros)' : 'MW (enteros)'}</th>
              {PALABRAS.map((d) => (
                <td key={d} style={{ ...celda, padding: 2 }} title={`${fmt(d)}${nombre(d) ? ` · ${nombre(d)}` : ''} — puedes escribir un valor`}>
                  <div style={{ fontSize: '0.66rem', color: '#5f6b78' }}>{fmt(d).replace(/^.*[:W]/, '')}</div>
                  <input
                    type="number"
                    value={estado.palabras?.[d] ?? 0}
                    onChange={(e) => onPalabra(d, Math.max(-32767, Math.min(32767, Math.round(Number(e.target.value) || 0))))}
                    style={{ width: 52, fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', textAlign: 'center', border: '1px solid #e0e5eb' }}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {Object.values(estado.fallas ?? {}).length > 0 && (
        <p style={{ margin: 0, color: '#c62828', fontSize: '0.82rem' }}>⚠ {Object.values(estado.fallas).join(' · ')}</p>
      )}
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

const botonSuave: React.CSSProperties = {
  border: '1px solid #c6ced6',
  background: '#fff',
  color: '#33475c',
  padding: '0.35rem 0.75rem',
  borderRadius: 7,
  fontSize: '0.85rem',
  cursor: 'pointer',
}
const estadoPLC: React.CSSProperties = { color: '#fff', borderRadius: 6, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }
const avisoOk = estiloAviso
