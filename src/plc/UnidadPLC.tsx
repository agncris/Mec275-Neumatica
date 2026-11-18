/**
 * Unidad 2 · PLC: programar en Ladder y probar el programa contra una
 * planta del laboratorio (tablero, estanque, elevador), en 3D y con sonido.
 *
 * Como en el laboratorio: en STOP se edita el programa; en RUN el PLC lo
 * ejecuta en ciclos de scan contra la planta, las salidas mueven la máquina
 * y los sensores de la máquina vuelven a las entradas.
 */
import { estiloAviso, useApaisado, useEsEstrecha } from '../components/ui'
import BancoDividido, { TituloArea } from '../components/banco/BancoDividido'
import ProcesoTarea, { enlaceEstudiar } from '../components/banco/ProcesoTarea'
import { usePanelAcoplado, type PestanaPanel } from '../components/banco/PanelAcoplado'
import SubnavUnidad, { seccionDeLaUrl, useSeccionUnidad, type SeccionUnidad } from '../components/banco/SubnavUnidad'
import MisTrabajos from '../components/banco/MisTrabajos'
import GuiaInicio, { GUIA_PLC, useGuia } from '../components/banco/GuiaInicio'
import { limpiarEnlace, trabajoDelEnlace } from '../entregar'
import { ANCLAS_ESTUDIAR_PLC } from './anclasEstudiar'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { exportarPng, nombreSeguro } from '../exportar'
import EditorLadder from './EditorLadder'
import { EJERCICIOS_PLC, programaDeEjercicio } from './ejercicios'
import TarjetaEjercicio from './TarjetaEjercicio'
import SelectorPlanta from './SelectorPlanta'
import { Historial } from '../historial'
import {
  areaDe,
  clonarPrograma,
  estadoInicial,
  programaVacio,
  revisarPrograma,
  type EstadoPLC,
  type FlujoEscalon,
  type IdPlanta,
  type ProgramaPLC,
} from './ladder'
import { PLANTAS, crearPlanta } from './plantas'
import { type Notacion } from './notacion'
import type { SimPLC } from './Planta3D'
import { botonSuave } from './estilosPLC'
import PanelES, { TablaSimbolos, type TipoLibre } from './PanelES'
import PanelEntrega from './PanelEntrega'
import BarraPLC from './BarraPLC'
import { useScanPLC } from './useScanPLC'
import { CLAVE, CLAVE_TAREA, esProgramaPLC, leerGuardado, leerTarea, NOMBRE_TAREA, PLANTA_TAREA, tareaVacia, type Evento } from './datosPLC'
import { ETAPAS_SILO, pasoSilo, checklistSilo, ejemploGuiadoSilo } from './procesoSilo'
import { borrarClave, CLAVES, guardarJson, guardarTexto, leerJson, leerTexto } from '../persistencia'
import { AvisoEjemplo, BarraEjemplo } from '../components/banco/EjemploTarea'

const Planta3D = lazy(() => import('./Planta3D'))
// La teoría, la ficha y la autoevaluación de Estudiar se cargan solo al entrar a Estudiar.
const EstudiarPLC = lazy(() => import('./EstudiarPLC'))

export default function UnidadPLC() {
  const [programa, setProgramaCrudo] = useState<ProgramaPLC>(() => (seccionDeLaUrl() === 'tarea' ? leerTarea() : leerGuardado()))
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
  /** El ejemplo guiado es una visita: mientras dura no se guarda sobre la tarea, que queda en `trabajoPrevio` y en el almacenamiento. */
  const [ejemplo, setEjemplo] = useState(false)
  const trabajoPrevio = useRef<{ programa: ProgramaPLC; historial: Historial<ProgramaPLC> } | null>(null)
  const [corriendo, setCorriendo] = useState(false)
  const [version, setVersion] = useState(0)
  const [, setFotograma] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const estrecha = useEsEstrecha()
  const acostado = useApaisado()
  const [seccion, setSeccionCruda] = useSeccionUnidad(ANCLAS_ESTUDIAR_PLC)
  const enTarea = seccion === 'tarea'
  const panel = usePanelAcoplado<PestanaPLC>(CLAVES.plcPanel, 'es', typeof window !== 'undefined' && window.innerHeight >= 860)
  // Quien tenía abierta una pestaña que ya no existe (la tabla de datos) vuelve a Entradas y salidas.
  useEffect(() => {
    if (enTarea) {
      panel.onPestana('proceso')
      panel.onAbrir(true)
      return
    }
    if (!['es', 'registro'].includes(panel.pestana)) panel.onPestana('es')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [movil, setMovil] = useState('programa')
  const [entregaAbierta, setEntregaAbierta] = useState(false)
  const [misTrabajos, setMisTrabajos] = useState(false)
  const [eligiendoPlanta, setEligiendoPlanta] = useState(false)
  const guia = useGuia('plc')
  /** Entrar o salir de la tarea cambia de programa: cada uno se guarda por su lado. */
  const setSeccion = (s: SeccionUnidad) => {
    if ((s === 'tarea') !== enTarea) {
      setCorriendo(false)
      historialRef.current = new Historial<ProgramaPLC>()
      setProgramaCrudo(s === 'tarea' ? leerTarea() : leerGuardado())
      setEntregaAbierta(false)
      // Cambiar de sección termina la visita al ejemplo: la tarea sigue guardada.
      setEjemplo(false)
      trabajoPrevio.current = null
      borrarClave(CLAVES.plcAntesEjemplo)
    }
    setSeccionCruda(s)
    if (s === 'tarea') {
      panel.onPestana('proceso')
      panel.onAbrir(true)
    } else if (panel.pestana === 'proceso') panel.onPestana('es')
  }
  const [notacion, setNotacion] = useState<Notacion>(() => {
    // Clave nueva: quien había elegido LogixPro vuelve a partir con la notación del apunte.
    return leerTexto(CLAVES.plcDirecciones) === 'ab' ? 'ab' : 'siemens'
  })
  const notacionRef = useRef(notacion)
  notacionRef.current = notacion
  useEffect(() => {
    guardarTexto(CLAVES.plcDirecciones, notacion)
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
    // El ejemplo es una visita: no pisa la tarea guardada.
    if (ejemplo) return
    guardarJson(enTarea ? CLAVE_TAREA : CLAVE, programa)
  }, [programa, enTarea, ejemplo])

  // Un enlace con un programa (#plc=…) lo abre, avisando si reemplaza el que había.
  useEffect(() => {
    void trabajoDelEnlace('plc').then((dato) => {
      if (!dato) return
      limpiarEnlace()
      if (!esProgramaPLC(dato)) return setAviso('El enlace no trae un programa de PLC válido.')
      if (!window.confirm('¿Abrir el programa que viene en el enlace? Reemplaza el programa que tienes en el editor.')) return
      cargar(dato)
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

  const { pausado, setPausado, barridosRef, unBarrido } = useScanPLC({ simRef, programaRef, forzadosRef, notacionRef, flujosRef, eventosRef, avisoPlantaRef, corriendo, setFotograma })

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
  const ejemploEnTarea = enTarea && ejemplo
  /** Mientras se ve el ejemplo no se cambia el programa por otro camino: primero se vuelve a la tarea. */
  const enVisita = () => {
    if (!ejemploEnTarea) return false
    setAviso('Estás viendo el ejemplo. Pulsa «Volver a mi tarea» antes de cambiar el programa.')
    return true
  }
  const confirmar = (mensaje: string) => !enVisita() && (!hayContenido || window.confirm(`${mensaje}\nSe perderá el programa que tienes en el editor.`))

  const cambiarPlanta = (id: IdPlanta) => {
    const cableado = PLANTAS[id].cableado
    const propios = programa.simbolos.filter((s) => ['M', 'T', 'C'].includes(areaDe(s.dir) ?? ''))
    setPrograma({ ...clonarPrograma(programa), planta: id, simbolos: [...cableado.map((s) => ({ ...s })), ...propios] })
  }

  /** Abre un programa en la sección que le corresponde: los del silo van a la tarea. */
  const cargar = (p: ProgramaPLC) => {
    setCorriendo(false)
    const deTarea = p.planta === PLANTA_TAREA
    if (deTarea !== enTarea) {
      historialRef.current = new Historial<ProgramaPLC>()
      setEntregaAbierta(false)
      setSeccionCruda(deTarea ? 'tarea' : 'laboratorio')
      setProgramaCrudo(p)
      return
    }
    setPrograma(p)
  }

  const nuevo = () => {
    if (!confirmar('¿Empezar un programa nuevo?')) return
    setCorriendo(false)
    if (enTarea) return setPrograma(tareaVacia())
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
    if (enVisita()) return
    try {
      const p = JSON.parse(await archivo.text())
      if (!esProgramaPLC(p)) throw new Error('Ese archivo no es un programa de PLC de NeumaLab.')
      cargar(p)
      setAviso(`Programa «${archivo.name}» abierto${p.planta === PLANTA_TAREA && !enTarea ? ` en ${NOMBRE_TAREA}` : ''}.`)
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
      rotulos={Object.fromEntries(descripcion.cableado.map((c) => [c.dir, c.nombre]))}
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
      editable={!corriendo}
      onSimbolo={(dir, campo, valor) => {
        const p = clonarPrograma(programa)
        let s = p.simbolos.find((x) => x.dir === dir)
        if (!s) p.simbolos.push((s = { dir, nombre: '', descripcion: '' }))
        s[campo] = valor
        setPrograma(p)
      }}
      onAgregar={(dir) => {
        if (programa.simbolos.some((x) => x.dir === dir)) return
        const p = clonarPrograma(programa)
        p.simbolos.push({ dir, nombre: '', descripcion: '' })
        setPrograma(p)
      }}
      ocultarPlanta={enTarea}
      onCambiarDir={(antes, despues) => {
        const p = clonarPrograma(programa)
        const s = p.simbolos.find((x) => x.dir === antes)
        if (s && !p.simbolos.some((x) => x.dir === despues)) s.dir = despues
        setPrograma(p)
      }}
      onQuitar={(dir) => {
        const p = clonarPrograma(programa)
        p.simbolos = p.simbolos.filter((x) => x.dir !== dir)
        setPrograma(p)
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

  const verEjemploGuiado = () => {
    if (ejemploEnTarea) return
    // La tarea se guarda entera (programa y su deshacer) antes de mostrar el ejemplo.
    const previo = programaRef.current
    trabajoPrevio.current = { programa: previo, historial: historialRef.current }
    guardarJson(CLAVE_TAREA, previo)
    guardarJson(CLAVES.plcAntesEjemplo, previo)
    setCorriendo(false)
    setEjemplo(true)
    setEntregaAbierta(false)
    historialRef.current = new Historial<ProgramaPLC>()
    setProgramaCrudo({ ...ejemploGuiadoSilo(), nombre: 'Ejemplo guiado' })
    setAviso('Ejemplo guiado. Tu tarea sigue guardada: «Volver a mi tarea» la recupera.')
  }
  const volverDelEjemplo = () => {
    const guardada = leerJson(CLAVES.plcAntesEjemplo)
    const previo = trabajoPrevio.current?.programa ?? (esProgramaPLC(guardada) ? guardada : leerTarea())
    historialRef.current = trabajoPrevio.current?.historial ?? new Historial<ProgramaPLC>()
    trabajoPrevio.current = null
    borrarClave(CLAVES.plcAntesEjemplo)
    setCorriendo(false)
    setProgramaCrudo(previo)
    setHayHistoria((n) => n + 1)
    setEjemplo(false)
    setAviso('Volviste a tu tarea.')
  }

  const barra = (
    <BarraPLC
      corriendo={corriendo}
      setCorriendo={setCorriendo}
      pausado={pausado}
      setPausado={setPausado}
      unBarrido={unBarrido}
      estrecha={estrecha}
      acostado={acostado}
      enTarea={enTarea}
      descripcion={descripcion}
      setEligiendoPlanta={setEligiendoPlanta}
      notacion={notacion}
      setNotacion={setNotacion}
      nuevo={nuevo}
      deshacer={deshacer}
      rehacer={rehacer}
      puedeDeshacer={historialRef.current.puedeDeshacer}
      puedeRehacer={historialRef.current.puedeRehacer}
      inputArchivo={inputArchivo}
      abrir={abrir}
      guardar={guardar}
      setMisTrabajos={setMisTrabajos}
      exportarLadder={exportarLadder}
      guia={guia}
    />
  )

  const areaPrograma = (
    <>
      {ejemploEnTarea && (
        <AvisoEjemplo onVolver={volverDelEjemplo}>
          <strong>Esto es un ejemplo, no tu entrega.</strong> Solo la memoria de marcha, a medias. Tu programa de la tarea sigue guardado.
        </AvisoEjemplo>
      )}
      {ejercicioActual && <TarjetaEjercicio ejercicio={ejercicioActual} programa={programa} notacion={notacion} />}
      {/* Acostado en el celular el título se omite: el estado RUN/STOP ya está en el botón. */}
      {(!acostado || (corriendo && pausado)) && (
      <TituloArea>
        Programa Ladder{programa.nombre ? ` · ${programa.nombre}` : ''}
        <span style={{ ...estadoPLC, background: corriendo ? 'var(--verde)' : '#a35200' }}>{corriendo ? (pausado ? 'RUN · en pausa' : 'RUN') : 'STOP'}</span>
        {corriendo && pausado && (
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--tinta)' }} data-barridos="si">
            Barrido nº {barridosRef.current}
          </span>
        )}
      </TituloArea>
      )}
      {corriendo && <p className="u-ayuda-suave">El PLC está ejecutando el programa. Pásalo a STOP para editarlo.</p>}
      {!corriendo && !programa.escalones.some((e) => e.bobinas.some(Boolean)) && (
        <p className="u-ayuda-tinta">El escalón está vacío. Elige un contacto, haz clic en una casilla y cierra con una bobina a la derecha. Ctrl+Z deshace.</p>
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
        <div className="u-mt-8" data-avisos-plc="si">
          {avisos.map((a, i) => (
            <p key={i} style={{ color: 'var(--naranjo-texto)', margin: '3px 0', fontSize: '0.86rem' }}>
              ⚠ {a}{' '}
              <button type="button" onClick={() => irAEstudiar('ladder')} style={enlaceEstudiar}>
                → Estudiar
              </button>
            </p>
          ))}
        </div>
      )}
    </>
  )

  const areaPlanta = (
    <>
      <TituloArea>
        Planta · {descripcion.nombre}
        {!enTarea && (
        <button onClick={() => setEligiendoPlanta(true)} style={{ border: 'none', background: 'transparent', color: 'var(--azul)', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer', padding: '2px 4px' }} title={descripcion.resumen}>
          Cambiar
        </button>
        )}
      </TituloArea>
      <div className="relleno">
        <Suspense fallback={<p className="u-vacio">Montando la planta…</p>}>
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
            play={{
              etiqueta: corriendo ? '■ STOP' : '▶ RUN',
              onClick: () => setCorriendo((c) => !c),
              titulo: 'Atajo: barra espaciadora',
              corriendo,
            }}
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
            <span style={{ fontSize: '0.8rem', color: 'var(--tinta-suave)', marginLeft: 6 }}>En la planta:</span>
            {sim.planta.acciones().map((a) => (
              <button
                key={a.id}
                title={a.titulo}
                style={{ ...botonSuave, borderColor: 'var(--azul)', color: 'var(--azul)', fontWeight: 600 }}
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
      <p style={{ color: 'var(--tinta-suave)', margin: 0, fontSize: '0.88rem' }}>Pulsa ▶ RUN y acciona la planta: aquí aparece lo que va ocurriendo, en orden.</p>
    ) : (
      <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', lineHeight: 1.55, fontSize: '0.88rem' }} data-registro="si">
        {eventos.map((e, i) => (
          <li key={`${e.t}-${i}`} style={{ opacity: i === eventos.length - 1 ? 1 : 0.8, color: e.aviso ? '#8a3b00' : undefined }}>
            <code style={{ color: 'var(--tinta-suave)', marginRight: 8 }}>t={e.t.toFixed(1)} s</code>
            {e.aviso ? '⚠ ' : ''}
            {e.mensaje}
          </li>
        ))}
      </ol>
    )

  const irAEstudiar = (ancla: string) => {
    try {
      window.history.replaceState(null, '', `#${ancla}`)
    } catch {
      /* sin historial */
    }
    setSeccion('estudiar')
  }
  const pasoTarea = enTarea ? pasoSilo(programa) : null
  const checklistTarea = enTarea ? checklistSilo(programa) : []

  const pestanas: Array<PestanaPanel<PestanaPLC>> = [
    ...(pasoTarea
      ? [
          {
            id: 'proceso' as const,
            titulo: 'Proceso de la tarea',
            tituloCorto: 'Proceso',
            contenido: (
              <div data-plano-tarea="si">
                {ejemploEnTarea ? (
                  <section className="proceso" aria-label="Proceso de la tarea" data-paso-ahora="ejemplo">
                    <p style={{ margin: 0, fontWeight: 700 }}>Ejemplo guiado. No es tu entrega.</p>
                    <p style={{ margin: '6px 0 0' }}>Solo la memoria de marcha con START y STOP. Sirve para mirar cómo se arma un escalón. La cinta, la válvula y los pilotos quedan para tu tarea.</p>
                  </section>
                ) : (
                <ProcesoTarea etapas={ETAPAS_SILO} paso={pasoTarea} progreso>
                  <p className="u-m-8-0-0">
                    <button type="button" onClick={() => irAEstudiar(pasoTarea.id === 'probar' ? 'scan' : pasoTarea.id === 'nombrar' ? 'entradas-salidas' : 'ladder')} style={enlaceEstudiar}>
                      ¿No recuerdas este paso? → Estudiar
                    </button>
                  </p>
                </ProcesoTarea>
                )}
                <p style={{ margin: '8px 0 6px', fontSize: '0.84rem', color: 'var(--tinta)' }}>{PLANTAS.silo.resumen}</p>
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }} data-checklist-tarea="si">
                  {(ejemploEnTarea ? [] : checklistTarea).map((p) => (
                    <li key={p.texto} style={{ margin: '2px 0', fontSize: '0.84rem', color: p.ok ? 'var(--verde-oscuro)' : 'var(--naranjo-aviso)' }}>
                      {p.ok ? '✓' : '☐'} {p.texto}
                    </li>
                  ))}
                </ul>
              </div>
            ),
          },
        ]
      : []),
    {
      id: 'es',
      titulo: 'Entradas y salidas',
      tituloCorto: 'E/S',
      contenido: (
        <>
          {panelES('tabla')}
          <p style={{ margin: '14px 0 4px', fontSize: '0.8rem', color: 'var(--tinta-tenue)', fontWeight: 700 }}>Marcas (memorias internas)</p>
          <TablaSimbolos programa={programa} onCambiar={setPrograma} editable={!corriendo} notacion={notacion} />
        </>
      ),
    },
    { id: 'registro', titulo: '¿Qué está pasando?', tituloCorto: 'Registro', contador: eventos.length, contenido: registro, seguirFinal: true },
  ]

  const barraEstado = (
    <>
      <span>
        {corriendo && pausado
          ? 'En pausa: cambia las entradas (mandos, forzados) y pulsa «⏭ Un barrido» para ver qué hace el PLC en un solo barrido.'
          : corriendo
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
      {avisos.length > 0 && <span style={{ marginLeft: hayForzados ? 0 : 'auto', color: 'var(--naranjo-texto)', fontWeight: 700 }}>⚠ {avisos.length} {avisos.length === 1 ? 'aviso' : 'avisos'}</span>}
    </>
  )

  return (
    <>
      <SubnavUnidad
        nombre="PLC"
        seccion={seccion}
        onSeccion={setSeccion}
        tarea={NOMBRE_TAREA}
        entregar={enTarea ? { abierto: entregaAbierta, onAlternar: () => (ejemploEnTarea && !entregaAbierta ? setAviso('Estás viendo el ejemplo: vuelve a tu tarea antes de entregar.') : setEntregaAbierta((a) => !a)), etiqueta: 'Entregar Tarea PLC', etiquetaCorta: 'Entregar' } : undefined}
      />
      {seccion !== 'estudiar' ? (
        <BancoDividido<PestanaPLC>
          key={seccion}
          clave={CLAVES.plcBanco}
          divisionInicial={0.42}
          anchoMin={340}
          barra={barra}
          izquierda={{ id: 'programa', titulo: 'Programa', contenido: areaPrograma }}
          derecha={{ id: 'planta', titulo: 'Planta', contenido: areaPlanta }}
          inferior={{
            etiqueta: enTarea ? 'Proceso, entradas y registro' : 'Entradas, tablas y registro',
            pestanas,
            estado: panel,
            encabezado: enTarea ? <BarraEjemplo ejemplo={ejemploEnTarea} aviso="Estás viendo el ejemplo guiado. No es tu entrega." etiquetaVer="Ver ejemplo guiado" onVer={verEjemploGuiado} onVolver={volverDelEjemplo} /> : undefined,
          }}
          estado={barraEstado}
          movil={movil}
          onMovil={setMovil}
          conCajon={entregaAbierta && !estrecha}
        />
      ) : (
        <Suspense fallback={<p className="u-cargando">Abriendo Estudiar…</p>}>
          <EstudiarPLC />
        </Suspense>
      )}
      {guia.visible && seccion !== 'estudiar' && <GuiaInicio unidad="PLC" pasos={GUIA_PLC} onCerrar={guia.cerrar} />}
      {eligiendoPlanta && (
        <SelectorPlanta
          actual={programa.planta}
          notacion={notacion}
          ejercicioActual={programa.ejercicio}
          onCerrar={() => setEligiendoPlanta(false)}
          onUsarPlanta={(id) => {
            cambiarPlanta(id)
            setEligiendoPlanta(false)
          }}
          onProgramaVacio={(id) => {
            if (!confirmar(`¿Empezar un programa vacío con «${PLANTAS[id].nombre}»?`)) return
            setCorriendo(false)
            setPrograma(programaVacio(id, PLANTAS[id].cableado.map((x) => ({ ...x }))))
            setEligiendoPlanta(false)
          }}
          onEjercicio={(e) => {
            if (!confirmar(`¿Empezar «${e.titulo}»?`)) return
            setCorriendo(false)
            setPrograma(programaDeEjercicio(e))
            setEligiendoPlanta(false)
          }}
          onEjemplo={(e) => {
            if (!confirmar(`¿Abrir el ejemplo «${e.etiqueta}»?`)) return
            setCorriendo(false)
            setPrograma(clonarPrograma(e.programa))
            setEligiendoPlanta(false)
          }}
        />
      )}
      {misTrabajos && (
        <MisTrabajos
          unidad="plc"
          nombreActual={programa.nombre ?? ''}
          actual={() => programa}
          abrir={(dato) => {
            if (!esProgramaPLC(dato)) return 'Ese trabajo no es un programa de PLC válido.'
            if (ejemploEnTarea) return 'Estás viendo el ejemplo. Pulsa «Volver a mi tarea» antes de abrir otro trabajo.'
            cargar(dato)
          }}
          onCerrar={() => setMisTrabajos(false)}
        />
      )}
      {entregaAbierta && enTarea && (
        <PanelEntrega
          programa={programa}
          hayContenido={hayContenido}
          avisos={avisos}
          forzados={forzados}
          tieneEjercicio={!!ejercicioActual}
          notacion={notacion}
          onCerrar={() => setEntregaAbierta(false)}
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

type PestanaPLC = 'proceso' | 'es' | 'registro'


const estadoPLC: React.CSSProperties = { color: '#fff', borderRadius: 6, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }
const avisoOk = estiloAviso
