/**
 * Unidad 3 · CNC: escribir un programa en código G y simular el mecanizado
 * en un centro de torneado o en una fresadora, en 3D, como en CNC Simulator
 * Pro: preparación de la máquina (material, bruto, herramientas), ejecución
 * continua o bloque a bloque, alarmas de la máquina, trayectoria en 2D con
 * sus coordenadas, explicación de cada bloque y exportación del .cnc y del
 * video de la simulación.
 */
import { acercar, estiloAviso, useEsEstrecha, useTactil } from '../components/ui'
import BancoDividido, { TituloArea } from '../components/banco/BancoDividido'
import { enlaceEstudiar } from '../components/banco/ProcesoTarea'
import { usePanelAcoplado, type PestanaPanel } from '../components/banco/PanelAcoplado'
import SubnavUnidad, { seccionDeLaUrl, useSeccionUnidad, type SeccionUnidad } from '../components/banco/SubnavUnidad'
import MisTrabajos from '../components/banco/MisTrabajos'
import GuiaInicio, { GUIA_CNC, useGuia } from '../components/banco/GuiaInicio'
import { baseArchivo, descargarTexto, leerAlumno, limpiarEnlace, trabajoDelEnlace } from '../entregar'
import { crearTrabajo, leerTrabajo, revisarTrabajo, TAREA_3, type PuntoRevision, type ResumenTrabajo } from './trabajo'
import { ANCLAS_ESTUDIAR_CNC } from './anclasEstudiar'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { exportarPng, nombreSeguro } from '../exportar'
import EditorGcode, { type EditorGcodeRef } from './EditorGcode'
import { EJEMPLOS_CNC, programaNuevo } from './ejemplos'
import { VER_TAREA_CNC } from '../unidades'
import { explicarBloque, interpretar, type ResultadoGcode } from './gcode'
import {
  almacenDe,
  fijarHerramientas,
  material as materialDe,
  origenPrograma,
  posicionCasa,
  type ConfigCNC,
  type TipoMaquina,
} from './maquinas'
import Plano2D from './Plano2D'
import SelectorMaquina from './SelectorMaquina'
import Preparacion from './PanelPreparacion'
import Revision from './Revision'
import Tablero from './Tablero'
import TablaPuntos from './TablaPuntos'
import PlanoTarea, { EJEMPLO_GUIADO_TORNO } from './PlanoTarea'
import ResumenRevision from './ResumenRevision'
import PanelEntrega from './PanelEntrega'
import BarraCNC, { SelectorVelocidad } from './BarraCNC'
import { useBucleSimulacion, useGrabacionCNC } from './useSimulacionCNC'
import { botonSuave } from './estilos'
import { SimuladorCNC, volumenPieza } from './simulador'
import type { VistaCNC } from './Maquina3D'
import { CLAVE, CLAVE_TAREA, NOMBRE_TAREA, leerGuardado, leerTarea } from './datosCNC'
import { type Estado } from './datosCNC'

const Maquina3D = lazy(() => import('./Maquina3D'))
// La teoría, la ficha y la autoevaluación de Estudiar se cargan solo al entrar a Estudiar.
const EstudiarCNC = lazy(() => import('./EstudiarCNC'))

export default function UnidadCNC() {
  const tactil = useTactil()
  const estrecha = useEsEstrecha()
  const [seccionPedida, setSeccionCruda] = useSeccionUnidad(ANCLAS_ESTUDIAR_CNC)
  // Mientras la tarea no se publica, ni el enlace ?vista=tarea la abre.
  const seccion: SeccionUnidad = seccionPedida === 'tarea' && !VER_TAREA_CNC ? 'laboratorio' : seccionPedida
  const enTarea = seccion === 'tarea'
  const panel = usePanelAcoplado<PestanaCNC>('neumalab.cnc.panel', 'preparacion', typeof window !== 'undefined' && window.innerHeight >= 860)
  const [entregaAbierta, setEntregaAbierta] = useState(false)
  const [misTrabajos, setMisTrabajos] = useState(false)
  const guia = useGuia('cnc')
  const inicial = useMemo(() => (seccionDeLaUrl() === 'tarea' && VER_TAREA_CNC ? leerTarea() : leerGuardado()), [])
  const [config, setConfig] = useState<ConfigCNC>(inicial.config)
  const [codigos, setCodigos] = useState(inicial.codigos)
  const [nombres, setNombres] = useState(inicial.nombres)
  const maquina = config.maquina
  /** Entrar o salir de la tarea cambia de programa y de preparación: cada uno se guarda por su lado. */
  const setSeccion = (s: SeccionUnidad) => {
    if ((s === 'tarea') !== enTarea) {
      const g = s === 'tarea' ? leerTarea() : leerGuardado()
      setConfig(g.config)
      setCodigos(g.codigos)
      setNombres(g.nombres)
      setEstado('listo')
      setEntregaAbierta(false)
      setEligiendoMaquina(false)
      panel.onPestana(s === 'tarea' ? 'plano-tarea' : 'preparacion')
      panel.onAbrir(true)
    }
    setSeccionCruda(s)
  }
  const codigo = codigos[maquina]
  const setCodigo = (c: string) => setCodigos((x) => ({ ...x, [maquina]: c }))
  const [eligiendoMaquina, setEligiendoMaquina] = useState(false)
  const [estado, setEstado] = useState<Estado>('listo')
  const [velocidad, setVelocidad] = useState(5)
  const [trayectoria, setTrayectoria] = useState(true)
  const [corte, setCorte] = useState(false)
  const [sonido, setSonido] = useState(false)
  const [cursor, setCursor] = useState<number | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  // Al abrir un .json se muestra su revisión: errores, comentarios, choques, herramientas y bruto.
  const [revisionAlAbrir, setRevisionAlAbrir] = useState<{ archivo: string; alumno: string } | null>(null)
  const [resumen, setResumen] = useState<{ archivo: string; alumno: string; resumen: ResumenTrabajo } | null>(null)
  const [, setTick] = useState(0)
  const { grabando, canvasRef, nombreVideo, puedeGrabar, alternarGrabacion } = useGrabacionCNC({ nombre: nombres[maquina], avisar: setAviso })
  const editor = useRef<EditorGcodeRef>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)

  const casa = useMemo(() => posicionCasa(config), [config])
  const cero = useMemo(() => origenPrograma(config, codigo), [config, codigo])
  fijarHerramientas(config)
  const almacen = almacenDe(config)
  const resultado: ResultadoGcode = useMemo(
    () =>
      interpretar(codigo, maquina, casa, {
        origen: cero.origen,
        radio: (t) => {
          const h = almacen.find((x) => x.t === t)
          return h ? h.diametro / 2 : undefined
        },
      }),
    [codigo, maquina, casa, cero, almacen],
  )

  const vista = useRef<VistaCNC>({ sim: new SimuladorCNC(resultado, config, casa), trayectoria, sonido, corte })
  vista.current.corte = corte
  vista.current.trayectoria = trayectoria
  vista.current.sonido = sonido
  vista.current.linea = estado === 'corriendo' ? vista.current.sim.linea : cursor
  // Programa o preparación nuevos: la máquina vuelve al inicio con el bruto entero.
  const reiniciar = useCallback(() => {
    vista.current.sim = new SimuladorCNC(resultado, config, casa)
    setEstado('listo')
    setTick((t) => t + 1)
  }, [resultado, config, casa])
  const primera = useRef(true)
  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    reiniciar()
  }, [reiniciar])

  // Guardado automático: la tarea y el laboratorio se guardan cada uno por su lado.
  useEffect(() => {
    try {
      localStorage.setItem(enTarea ? CLAVE_TAREA : CLAVE, JSON.stringify({ config, codigos, nombres }))
    } catch {
      /* sin almacenamiento */
    }
  }, [config, codigos, nombres, enTarea])

  // Un enlace con un programa (#cnc=…) lo abre en su máquina, con su preparación.
  useEffect(() => {
    void trabajoDelEnlace('cnc').then((dato) => {
      if (!dato) return
      limpiarEnlace()
      const d = dato as { config?: ConfigCNC; codigo?: string; nombre?: string }
      if (!d.config || typeof d.codigo !== 'string') return setAviso('El enlace no trae un programa de CNC válido.')
      if (!window.confirm('¿Abrir el programa que viene en el enlace? Reemplaza el programa de esa máquina.')) return
      const m = d.config.maquina
      setConfig(d.config)
      setCodigos((x) => ({ ...x, [m]: d.codigo as string }))
      setNombres((x) => ({ ...x, [m]: d.nombre || 'Programa del enlace' }))
      setAviso('Programa del enlace abierto.')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Al entrar directo a la tarea (enlace ?vista=tarea) se ve primero el plano.
  useEffect(() => {
    if (!enTarea) return
    panel.onPestana('plano-tarea')
    panel.onAbrir(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [checklistTarea, setChecklistTarea] = useState<PuntoRevision[]>([])
  useEffect(() => {
    if (!enTarea) return
    const id = window.setTimeout(() => {
      try {
        setChecklistTarea(revisarTrabajo(config, codigo).puntos)
      } catch {
        setChecklistTarea([])
      }
    }, 500)
    return () => window.clearTimeout(id)
  }, [enTarea, config, codigo])
  const irAEstudiar = (ancla: string) => {
    try {
      window.history.replaceState(null, '', `#${ancla}`)
    } catch {
      /* sin historial */
    }
    setSeccion('estudiar')
  }
  const verEjemploGuiado = () => {
    if (!window.confirm('Se reemplaza el programa por un ejemplo a medias: una sola pasada recta, con husillo y fin. No es la pieza del plano. ¿Seguir?')) return
    setEstado('listo')
    setCodigo(EJEMPLO_GUIADO_TORNO)
    setAviso('Ejemplo guiado cargado. Mira cómo se acerca y corta una recta, y reemplaza esa pasada por las cotas del plano.')
  }

  useEffect(() => {
    if (!revisionAlAbrir) return
    setResumen({ ...revisionAlAbrir, resumen: revisarTrabajo(config, codigo) })
    setRevisionAlAbrir(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisionAlAbrir])

  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(id)
  }, [aviso])

  // Bucle de la simulación.
  useBucleSimulacion({ estado, setEstado, velocidad, vista, setTick })

  const sim = vista.current.sim
  const hayErrores = resultado.primerError !== null
  const correr = (modo: 'corriendo' | 'bloque') => {
    if (estado === 'fin' || estado === 'alarma') {
      vista.current.sim = new SimuladorCNC(resultado, config, casa)
    }
    if (estado === 'parada') vista.current.sim.continuar()
    setEstado(modo)
  }
  // Volver un bloque: se simula de nuevo desde el inicio hasta ese bloque.
  const atras = () => {
    const s = vista.current.sim
    const pasos = s.programa.pasos
    if (!pasos.length) return
    const i = Math.min(s.indice, pasos.length - 1)
    let ini = i
    while (ini > 0 && pasos[ini - 1].linea === pasos[i].linea) ini--
    let objetivo = ini
    if (!s.terminado && s.indice === ini && s.t === 0 && ini > 0) {
      objetivo = ini - 1
      while (objetivo > 0 && pasos[objetivo - 1].linea === pasos[ini - 1].linea) objetivo--
    }
    const nuevo = new SimuladorCNC(resultado, config, casa)
    nuevo.irAPaso(objetivo)
    vista.current.sim = nuevo
    setEstado(objetivo === 0 ? 'listo' : 'pausa')
    setTick((t) => t + 1)
  }
  const alFinal = () => {
    if (estado === 'fin' || estado === 'alarma') vista.current.sim = new SimuladorCNC(resultado, config, casa)
    vista.current.sim.terminar()
    setEstado(vista.current.sim.alarma ? 'alarma' : 'fin')
    setTick((t) => t + 1)
  }

  const cargarEjemplo = (id: string) => {
    const ej = EJEMPLOS_CNC.find((e) => e.id === id)
    if (!ej) return false
    const actual = codigos[ej.maquina]
    const sinCambios = EJEMPLOS_CNC.some((e) => e.codigo === actual) || actual === programaNuevo(ej.maquina) || !actual.trim()
    if (!sinCambios && !window.confirm(`¿Cargar «${ej.titulo}»? Se reemplaza tu programa de ${ej.maquina === 'torno' ? 'torno' : 'fresadora'}.`)) return false
    setConfig((c) => ({
      ...c,
      maquina: ej.maquina,
      material: ej.config.material ?? c.material,
      torno: ej.config.torno ? { ...ej.config.torno } : c.torno,
      fresa: ej.config.fresa ? { ...ej.config.fresa } : c.fresa,
    }))
    setCodigos((x) => ({ ...x, [ej.maquina]: ej.codigo }))
    setNombres((x) => ({ ...x, [ej.maquina]: ej.titulo }))
    setAviso(`Ejemplo cargado: ${ej.titulo}. Pulsa ▶ Ciclo para mecanizar.`)
    return true
  }

  const nuevo = (m: TipoMaquina = maquina) => {
    const actual = codigos[m]
    const sinCambios = EJEMPLOS_CNC.some((e) => e.codigo === actual) || actual === programaNuevo(m) || !actual.trim()
    if (!sinCambios && !window.confirm(`¿Empezar un programa nuevo? Se reemplaza tu programa de ${m === 'torno' ? 'torno' : 'fresadora'}.`)) return false
    if (m !== maquina) cambiarMaquina(m)
    setCodigos((x) => ({ ...x, [m]: programaNuevo(m) }))
    setNombres((x) => ({ ...x, [m]: 'Mi programa' }))
    return true
  }

  const guardarCnc = () => {
    const blob = new Blob([codigo.replace(/\n/g, '\r\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreSeguro(nombres[maquina] || 'programa', 'cnc')
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setAviso(`Programa descargado como ${a.download}.`)
  }

  /** El trabajo completo (programa, preparación y máquina) en un solo archivo, para entregar y volver a abrir. */
  const trabajoJson = () => {
    const alumno = leerAlumno()
    return JSON.stringify(crearTrabajo({ nombre: nombres[maquina], config, codigo, tarea: enTarea ? TAREA_3 : undefined, alumno: enTarea ? alumno : undefined }), null, 2)
  }

  const guardarJson = () => {
    // En la tarea el archivo sale con el nombre que pide el enunciado, si ya se escribió el nombre.
    const alumno = leerAlumno()
    const nombreTarea = enTarea && alumno.nombre.trim() ? `${baseArchivo(alumno, 'Tarea-3')}.json` : null
    descargarTexto(trabajoJson(), nombreTarea ?? nombreSeguro(nombres[maquina] || 'programa-cnc', 'json'), 'application/json')
    setAviso('Trabajo descargado (JSON): se abre en la app con Archivo › Abrir.')
  }

  const abrir = async (archivo: File | undefined) => {
    if (!archivo) return
    try {
      const texto = await archivo.text()
      if (/\.json$/i.test(archivo.name) || texto.trimStart().startsWith('{')) {
        const d = leerTrabajo(texto)
        const m = d.config.maquina
        const deLaTarea = d.tarea === TAREA_3 && VER_TAREA_CNC
        if (enTarea && m !== 'torno') throw new Error('La Tarea 3 se hace en el centro de torneado.')
        // Un trabajo de la tarea se abre en la sección de la tarea, sea donde sea que se abra.
        if (deLaTarea && !enTarea) setSeccion('tarea')
        setEstado('listo')
        setConfig(d.config)
        setCodigos((x) => ({ ...x, [m]: d.codigo }))
        setNombres((x) => ({ ...x, [m]: d.nombre || archivo.name.replace(/\.[^.]+$/, '') }))
        setRevisionAlAbrir({ archivo: archivo.name, alumno: d.alumno ? [d.alumno.nombre, d.alumno.companero].filter(Boolean).join(' y ') : '' })
        return setAviso(`Trabajo «${archivo.name}» abierto en la ${m === 'torno' ? 'máquina de torneado' : 'fresadora'}.`)
      }
      if (/[\u0000-\u0008]/.test(texto.slice(0, 2000))) throw new Error('Ese archivo no parece un programa de texto (código G).')
      setCodigo(texto.replace(/\r\n?/g, '\n'))
      setNombres((x) => ({ ...x, [maquina]: archivo.name.replace(/\.[^.]+$/, '') }))
      setAviso(`Programa «${archivo.name}» abierto en la ${maquina === 'torno' ? 'máquina de torneado' : 'fresadora'}.`)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    }
  }

  const exportarPlano = async (nombreArchivo?: string) => {
    let svg = document.querySelector('[data-plano2d]') as SVGSVGElement | null
    if (!svg) {
      // La trayectoria vive en una pestaña del panel: se abre para poder dibujarla.
      panel.onPestana('plano')
      panel.onAbrir(true)
      for (let i = 0; i < 20 && !svg; i++) {
        await new Promise((r) => requestAnimationFrame(r))
        svg = document.querySelector('[data-plano2d]') as SVGSVGElement | null
      }
    }
    if (!svg) return
    const archivo = nombreArchivo ?? nombreSeguro(`${nombres[maquina] || 'programa'}_trayectoria`, 'png')
    try {
      await exportarPng(svg, archivo)
      setAviso(`Imagen descargada: ${archivo}`)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo exportar la imagen.')
    }
  }

  const irA = (n: number) => editor.current?.irALinea(n)

  const cambiarMaquina = (m: TipoMaquina) => {
    setConfig((c) => ({ ...c, maquina: m, material: m === 'torno' && c.material === 'madera' ? 'laton' : c.material }))
  }

  // ---- datos para mostrar
  const paso = sim.terminado ? undefined : sim.programa.pasos[sim.indice]
  const ultimo = sim.programa.pasos[Math.min(sim.indice, sim.programa.pasos.length - 1)]
  const lineaActiva = estado === 'listo' ? null : sim.linea
  const torno = maquina === 'torno'
  const errores = resultado.diagnosticos.filter((d) => d.nivel === 'error')
  const avisosProg = resultado.diagnosticos.filter((d) => d.nivel !== 'error')
  const estadoModal = resultado.estados[Math.min(lineaActiva ?? 0, resultado.estados.length - 1)]
  const lineas = codigo.split('\n')
  const lineaExplicada = cursor ?? lineaActiva ?? 0
  const explicacion = explicarBloque(lineas[lineaExplicada] ?? '', resultado.estados[lineaExplicada], maquina)
  const volumenInicial = useMemo(() => volumenPieza(new SimuladorCNC(resultado, config, casa).pieza), [config, resultado, casa])
  const volumen = volumenPieza(sim.pieza)
  const mat = materialDe(config.material)

  const textoEstado: Record<Estado, [string, string]> = {
    listo: ['LISTO', '#5a6b7d'],
    corriendo: ['EN CICLO', '#0e7a43'],
    bloque: ['BLOQUE A BLOQUE', '#1668c7'],
    pausa: ['EN PAUSA', '#a35200'],
    parada: ['PARADA M00', '#a35200'],
    alarma: ['ALARMA', '#c62828'],
    fin: ['FIN DE PROGRAMA', '#33475c'],
  }

  const bloqueado = estado === 'corriendo' || estado === 'bloque'
  const nombreMaquina = torno ? 'Centro de torneado' : 'Fresadora de 3 ejes'

  const selectorVelocidad = <SelectorVelocidad velocidad={velocidad} setVelocidad={setVelocidad} estrecha={estrecha} />
  const itemsArchivo = [
    { texto: 'Nuevo programa', ayuda: 'Un programa en blanco para esta máquina', onClick: () => void nuevo() },
    { texto: 'Abrir…', ayuda: 'Un trabajo (.json) o un programa .cnc, .nc, .gcode o .txt (también de CNC Simulator Pro)', onClick: () => inputArchivo.current?.click() },
    { texto: 'Guardar .cnc', ayuda: 'El archivo de texto que se entrega', onClick: guardarCnc },
    { texto: 'Mis trabajos…', ayuda: 'Guarda varios programas con nombre (con su preparación)', onClick: () => setMisTrabajos(true), separar: true },
  ]
  const itemsExportar = [
    { texto: 'Trabajo (JSON)', ayuda: 'Programa y preparación en un archivo: se vuelve a abrir en la app con «Abrir…»', onClick: guardarJson },
    { texto: 'Trayectoria (PNG)', ayuda: 'La trayectoria 2D con sus puntos, para el informe', onClick: () => void exportarPlano() },
    {
      texto: 'Grabar video de la simulación',
      ayuda: 'Graba la vista 3D; se descarga al detener',
      onClick: alternarGrabacion,
      deshabilitado: !puedeGrabar || grabando,
      porque: grabando ? 'Ya está grabando' : 'Tu navegador no permite grabar video',
    },
  ]

  const barra = (
    <BarraCNC
      estado={estado}
      setEstado={setEstado}
      correr={correr}
      atras={atras}
      alFinal={alFinal}
      reiniciar={reiniciar}
      hayPasos={resultado.pasos.length > 0}
      hayErrores={hayErrores}
      estrecha={estrecha}
      enTarea={enTarea}
      bloqueado={bloqueado}
      nuevo={nuevo}
      selectorVelocidad={selectorVelocidad}
      maquina={maquina}
      setEligiendoMaquina={setEligiendoMaquina}
      guia={guia}
      grabando={grabando}
      alternarGrabacion={alternarGrabacion}
      itemsArchivo={itemsArchivo}
      itemsExportar={itemsExportar}
      inputArchivo={inputArchivo}
      abrir={abrir}
    />
  )

  const areaPrograma = (
    <>
      <TituloArea>
        Programa · {nombres[maquina]}
        <span style={{ ...estadoChip, background: textoEstado[estado][1] }} data-estado-cnc={estado}>
          {textoEstado[estado][0]}
        </span>
      </TituloArea>
      {!/\bG0?[123]\b/i.test(codigo.replace(/\(.*?\)/g, '').replace(/;.*/g, '')) && (
        <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#33475c' }}>G00 sólo se acerca. Para cortar escribe G01 (recta) o G02/G03 (arco), con avance F. Ctrl+Z deshace.</p>
      )}
      <div className="relleno" style={{ minHeight: 220 }}>
        <EditorGcode
          ref={editor}
          codigo={codigo}
          onCambiar={setCodigo}
          lineaActiva={lineaActiva}
          seleccion={cursor}
          diagnosticos={resultado.diagnosticos}
          onCursor={setCursor}
          soloLectura={bloqueado}
          alto="100%"
        />
      </div>
        <div style={{ maxHeight: '30%', overflow: 'auto', flexShrink: 0 }}>
        <Revision resultado={resultado} errores={errores} avisos={avisosProg} irA={irA} onEstudiar={irAEstudiar} />
      </div>
    </>
  )

  const areaMaquina = (
    <>
      <TituloArea>
        {nombreMaquina} · {mat.nombre}
      </TituloArea>
      {sim.alarma && (
        <div role="alert" style={alarma} data-alarma-cnc="si">
          <strong>⚠ ALARMA en la línea {sim.alarma.linea + 1}:</strong> {sim.alarma.texto}{' '}
          <button onClick={() => irA(sim.alarma!.linea)} style={{ ...botonSuave, padding: '1px 8px', marginLeft: 6 }}>
            Ir a la línea
          </button>
        </div>
      )}
      {estado === 'parada' && <div style={{ ...alarma, background: '#fff5e0', borderColor: '#f0c36d', color: '#7a4b00' }}>Programa detenido por M00/M01. Pulsa ▶ Continuar.</div>}
      <div className="relleno">
        <Suspense fallback={<p style={{ padding: 20, color: '#51606f' }}>Preparando la máquina…</p>}>
          <Maquina3D
            vista={vista}
            onCanvas={(c) => (canvasRef.current = c)}
            alto="100%"
            play={{
              etiqueta: estado === 'corriendo' ? '❚❚ Pausa' : estado === 'parada' ? '▶ Continuar' : '▶ Ciclo',
              onClick: () => (estado === 'corriendo' ? setEstado('pausa') : correr('corriendo')),
              titulo: hayErrores ? 'Hay errores: la máquina corre hasta la línea anterior al primer error' : 'Ejecuta el programa completo',
              deshabilitado: estado !== 'corriendo' && !resultado.pasos.length,
              corriendo: estado === 'corriendo',
            }}
          />
        </Suspense>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: '0.85rem', color: '#33475c' }}>
        <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <input type="checkbox" checked={trayectoria} onChange={(e) => setTrayectoria(e.target.checked)} /> Trayectoria
        </label>
        {torno && (
          <label style={{ display: 'flex', gap: 5, alignItems: 'center' }} title="Corta la pieza por la mitad para ver agujeros y ranuras por dentro">
            <input type="checkbox" checked={corte} onChange={(e) => setCorte(e.target.checked)} /> Vista en corte
          </label>
        )}
        <label style={{ display: 'flex', gap: 5, alignItems: 'center' }} title="Husillo, corte y ejes; se activa al hacer clic en la vista 3D">
          <input type="checkbox" checked={sonido} onChange={(e) => setSonido(e.target.checked)} /> Sonido
        </label>
        {estrecha && selectorVelocidad}
        <span style={{ color: '#51606f' }}>Arrastra para girar la vista · {acercar(tactil)}.</span>
      </div>
      <Tablero sim={sim} torno={torno} paso={paso} ultimo={ultimo} modal={estadoModal} tiempoTotal={resultado.tiempoTotal} volumen={volumen} volumenInicial={volumenInicial} />
      {sim.consejos.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {sim.consejos.map((c, i) => (
            <p key={i} style={{ color: '#7a4f00', margin: '3px 0', fontSize: '0.85rem' }}>
              <button type="button" onClick={() => irA(c.linea)} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit', textAlign: 'left' }}>
                💡 Línea {c.linea + 1}: {c.texto}
              </button>{' '}
              <button type="button" onClick={() => irAEstudiar('torno')} style={enlaceEstudiar}>
                → Estudiar
              </button>
            </p>
          ))}
        </div>
      )}
    </>
  )

  const pestanas: Array<PestanaPanel<PestanaCNC>> = [
    ...(enTarea
      ? [
          {
            id: 'plano-tarea' as const,
            titulo: 'Plano de la Tarea 3',
            tituloCorto: 'Plano',
            contenido: <PlanoTarea codigo={codigo} checklist={checklistTarea} onEstudiar={irAEstudiar} onEjemplo={verEjemploGuiado} />,
          },
        ]
      : []),
    {
      id: 'preparacion',
      titulo: 'Preparación',
      tituloCorto: 'Preparar',
      contenido: <Preparacion config={config} setConfig={setConfig} bloqueado={bloqueado} modoCero={cero.modo} addRegPart={resultado.addRegPart} />,
    },
    {
      id: 'plano',
      titulo: `Trayectoria 2D ${torno ? '(Z-X)' : '(desde arriba)'}`,
      tituloCorto: 'Trayectoria',
      contenido: <Plano2D programa={resultado} sim={sim} config={config} lineas={lineas} seleccionada={cursor} onElegirLinea={irA} origen={cero.origen} />,
    },
    {
      id: 'explicar',
      titulo: 'Explicar el bloque',
      tituloCorto: 'Explicar',
      contenido: (
        <>
          <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#51606f' }}>Línea {lineaExplicada + 1}. Pon el cursor en una línea del programa para ver qué hace cada palabra.</p>
          <code style={{ display: 'block', background: '#f4f6f9', padding: '6px 8px', borderRadius: 6, marginBottom: 6, whiteSpace: 'pre-wrap' }}>{lineas[lineaExplicada] || ' '}</code>
          {explicacion.length ? (
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.88rem' }} data-explicacion="si">
              <tbody>
                {explicacion.map((e, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eef1f4', fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{e.palabra}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eef1f4' }}>{e.texto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#5f6b78', fontSize: '0.86rem' }}>Línea vacía.</p>
          )}
        </>
      ),
    },
    {
      id: 'coordenadas',
      titulo: 'Tabla de coordenadas',
      tituloCorto: 'Tabla',
      contenido: <TablaPuntos resultado={resultado} torno={torno} lineas={lineas} irA={irA} seleccionada={cursor} casa={casa} origen={cero.origen} />,
    },
  ]

  const barraEstado = (
    <>
      <span>
        {estado === 'corriendo'
          ? 'En ciclo: la máquina ejecuta el programa · ❚❚ Pausa lo detiene.'
          : estado === 'alarma'
            ? 'Alarma: corrige la línea marcada y vuelve a pulsar ▶ Ciclo.'
            : bloqueado
              ? 'Bloque a bloque: cada ⏭ ejecuta una línea.'
              : 'Escribe o abre un programa y pulsa ▶ Ciclo · ⏭ avanza bloque a bloque.'}
      </span>
      <button
        onClick={() => {
          panel.onPestana('preparacion')
          panel.onAbrir(true)
        }}
        style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#1668c7', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}
        title="Ver o cambiar la preparación (bruto y cero)"
      >
        {mat.nombre} ·{' '}
        {torno ? `Ø${config.torno.diametro} × ${config.torno.largo} mm` : `${config.fresa.largo} × ${config.fresa.ancho} × ${config.fresa.alto} mm`}
      </button>
      {(errores.length > 0 || avisosProg.length > 0) && (
        <span style={{ color: errores.length ? '#b3261e' : '#7a4f00', fontWeight: 700 }}>
          ⚠ {errores.length ? `${errores.length} error${errores.length === 1 ? '' : 'es'}` : `${avisosProg.length} aviso${avisosProg.length === 1 ? '' : 's'}`}
        </span>
      )}
    </>
  )

  return (
    <>
      <SubnavUnidad
        nombre="CNC"
        seccion={seccion}
        onSeccion={setSeccion}
        tarea={VER_TAREA_CNC ? NOMBRE_TAREA : undefined}
        entregar={enTarea ? { abierto: entregaAbierta, onAlternar: () => setEntregaAbierta((a) => !a), etiqueta: 'Entregar Tarea CNC', etiquetaCorta: 'Entregar' } : undefined}
      />
      {seccion !== 'estudiar' ? (
        <BancoDividido<PestanaCNC>
          key={seccion}
          clave="neumalab.cnc.banco.v2"
          divisionInicial={0.42}
          anchoMin={340}
          barra={barra}
          izquierda={{ id: 'programa', titulo: 'Programa', contenido: areaPrograma }}
          derecha={{ id: 'maquina', titulo: 'Máquina', contenido: areaMaquina }}
          inferior={{ etiqueta: 'Preparación, trayectoria y tablas', pestanas, estado: panel }}
          estado={barraEstado}
          conCajon={entregaAbierta && enTarea && !estrecha}
        />
      ) : (
        <Suspense fallback={<p style={{ padding: 24, color: '#51606f', textAlign: 'center' }}>Abriendo Estudiar…</p>}>
          <EstudiarCNC />
        </Suspense>
      )}
      {guia.visible && seccion !== 'estudiar' && <GuiaInicio unidad="CNC" pasos={GUIA_CNC} onCerrar={guia.cerrar} />}
      {eligiendoMaquina && (
        <SelectorMaquina
          actual={maquina}
          nombres={nombres}
          onUsar={(m) => {
            cambiarMaquina(m)
            setEligiendoMaquina(false)
          }}
          onNuevo={(m) => nuevo(m) && setEligiendoMaquina(false)}
          onEjemplo={(e) => cargarEjemplo(e.id) && setEligiendoMaquina(false)}
          onCerrar={() => setEligiendoMaquina(false)}
        />
      )}
      {misTrabajos && (
        <MisTrabajos
          unidad="cnc"
          nombreActual={nombres[maquina] ?? ''}
          actual={() => ({ config, codigo, nombre: nombres[maquina] })}
          abrir={(dato, nombre) => {
            const d = dato as { config?: ConfigCNC; codigo?: string }
            if (!d?.config || typeof d.codigo !== 'string') return 'Ese trabajo no es un programa de CNC válido.'
            const m = d.config.maquina
            if (enTarea && m !== 'torno') return 'La Tarea 3 se hace en el centro de torneado.'
            setEstado('listo')
            setConfig(d.config)
            setCodigos((x) => ({ ...x, [m]: d.codigo as string }))
            setNombres((x) => ({ ...x, [m]: nombre }))
          }}
          onCerrar={() => setMisTrabajos(false)}
        />
      )}
      {entregaAbierta && enTarea && (
        <PanelEntrega
          config={config}
          codigo={codigo}
          resultado={resultado}
          torno={torno}
          lineas={lineas}
          casa={casa}
          mat={mat}
          trabajoJson={trabajoJson}
          exportarPlano={exportarPlano}
          grabando={grabando}
          puedeGrabar={puedeGrabar}
          nombreVideo={nombreVideo}
          reiniciar={reiniciar}
          alternarGrabacion={alternarGrabacion}
          correr={correr}
          onCerrar={() => setEntregaAbierta(false)}
        />
      )}
      {resumen && <ResumenRevision {...resumen} onCerrar={() => setResumen(null)} />}
      {aviso && (
        <p role="status" style={avisoOk}>
          {aviso}
        </p>
      )}
    </>
  )
}

type PestanaCNC = 'preparacion' | 'plano' | 'explicar' | 'coordenadas' | 'plano-tarea'


const estadoChip: React.CSSProperties = { color: '#fff', borderRadius: 6, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }
const avisoOk = estiloAviso
const alarma: React.CSSProperties = {
  margin: '0 0 8px',
  padding: '0.5rem 0.8rem',
  background: '#fdeaea',
  border: '1px solid #f1a9a9',
  borderRadius: 8,
  color: '#8e1c1c',
  fontSize: '0.88rem',
}
