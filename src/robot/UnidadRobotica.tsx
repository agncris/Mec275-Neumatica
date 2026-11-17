/**
 * Unidad 4 · Robótica: programar un robot KUKA con nodos (como Grasshopper
 * + KUKA|prc) o a mano con el mando (teach-in), simularlo en 3D con análisis
 * de alcance, límites y singularidades, y exportar el código KRL. Funciona en
 * el navegador: no hace falta Windows ni licencias.
 */
import { estiloAviso, useEsEstrecha, usePersistente } from '../components/ui'
import BancoDividido from '../components/banco/BancoDividido'
import { usePanelAcoplado, type PestanaPanel } from '../components/banco/PanelAcoplado'
import SubnavUnidad, { seccionDeLaUrl, useSeccionUnidad, type SeccionUnidad } from '../components/banco/SubnavUnidad'
import { VER_TAREA_ROBOTICA } from '../unidades'
import MisTrabajos from '../components/banco/MisTrabajos'
import GuiaInicio, { GUIA_ROBOT, useGuia } from '../components/banco/GuiaInicio'
import { PRACTICA_ROBOT } from './practica'
import { adaptarATarea, ejemploGuiadoTarea, esEjemploGuiado, MARCA_TAREA4, tareaAlAbrir, tareaVaciaRobot } from './tarea4'
import { guiaTarea } from './guiaTarea'
import { limpiarEnlace, trabajoDelEnlace } from '../entregar'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { exportarPng, nombreSeguro } from '../exportar'
import { useBucleReproduccion, useReproduccion } from './useReproduccion'
import { useEvaluacionRobot } from './useEvaluacionRobot'
import { useChecklistTarea } from './useChecklistTarea'
import { crearCroquisRobot } from './croquisRobot'
import { Historial } from '../historial'
import CodigoKRL from './CodigoKRL'
import Analisis from './Analisis'
import { enlaceEstudiar } from './estilos'
import PlanoTarea, { BarraEjemplo } from './PlanoTarea'
import PanelEntrega from './PanelEntrega'
import BarraRobot from './BarraRobot'
import AreaPrograma from './AreaPrograma'
import AreaSimulacion from './AreaSimulacion'
import FichaModelo from './FichaModelo'
import { EJEMPLOS_ROBOT } from './ejemplos'
import { leerDXF } from './geometria'
import type { PuntoEnsenado } from './Mando'
import { ejesEn, generarKRL, simular, type Simulacion } from './movimiento'
import {
  esDefinicion,
  type Definicion,
  type Programa,
} from './nodos'
import { HOME, robotPorId } from './robots'
import type { VistaRobot } from './Robot3D'
import { ANCLAS_ESTUDIAR_ROBOT } from './anclasEstudiar'
import { BASE_DEFECTO, CLAVE, CLAVE_ANTES_EJEMPLO, CLAVE_TAREA, definicionGuardada, HERR_MANDO, leerGuardada, leerTarea, marcasDe, type Modo, NOMBRE_TAREA, programaDelMando } from './datosRobot'
import { borrarClave, CLAVES, guardarJson as guardarClaveJson, leerJson } from '../persistencia'

// La teoría, la ficha y las demos 3D de Estudiar se cargan solo al entrar a Estudiar.
const EstudiarRobotica = lazy(() => import('./EstudiarRobotica'))

export default function UnidadRobotica() {
  const [def, setDefCruda] = useState<Definicion>(() => (seccionDeLaUrl() === 'tarea' && VER_TAREA_ROBOTICA ? leerTarea() : leerGuardada()))
  const defRef = useRef(def)
  defRef.current = def
  const historial = useRef(new Historial<Definicion>())
  const [, setHist] = useState(0)
  const setDef = useCallback((d: Definicion) => {
    historial.current.anotar(defRef.current)
    setDefCruda(d)
    setHist((n) => n + 1)
  }, [])
  /** Entrar o salir de la tarea cambia de definición: cada una se guarda por su lado. */
  const setSeccion = (s: SeccionUnidad) => {
    if ((s === 'tarea') !== enTarea) {
      historial.current = new Historial<Definicion>()
      setDefCruda(s === 'tarea' ? leerTarea() : leerGuardada())
      setHist((n) => n + 1)
      setReproduciendo(false)
      setSeleccion(null)
      setModo('visual')
      setEnunciado(null)
      setEntregaAbierta(false)
      panel.onPestana(s === 'tarea' ? 'plano-tarea' : 'analisis')
      panel.onAbrir(true)
    }
    setSeccionCruda(s)
  }
  const deshacer = () => {
    const p = historial.current.deshacer(defRef.current)
    if (p) setDefCruda(p)
    setHist((n) => n + 1)
  }
  const rehacer = () => {
    const p = historial.current.rehacer(defRef.current)
    if (p) setDefCruda(p)
    setHist((n) => n + 1)
  }
  const [modo, setModo] = useState<Modo>('visual')
  const estrecha = useEsEstrecha()
  const [seccionPedida, setSeccionCruda] = useSeccionUnidad(ANCLAS_ESTUDIAR_ROBOT)
  // Mientras la tarea no se publica, ni el enlace ?vista=tarea la abre.
  const seccion: SeccionUnidad = seccionPedida === 'tarea' && !VER_TAREA_ROBOTICA ? 'laboratorio' : seccionPedida
  const enTarea = seccion === 'tarea'
  const panel = usePanelAcoplado<PestanaRobot>(CLAVES.robotPanel, enTarea ? 'plano-tarea' : 'analisis', false, 280)
  const [plegadoGuardado, setPlegado] = usePersistente<'abierto' | 'riel' | 'oculto'>(CLAVES.robotPlegado, 'abierto')
  // Antes se podía ocultar del todo y no quedaba cómo volver. Solo se colapsa a una tira.
  const plegado = plegadoGuardado === 'oculto' ? 'riel' : plegadoGuardado
  // Al entrar directo a la tarea (enlace ?vista=tarea) se ve primero el plano.
  useEffect(() => {
    if (!enTarea) return
    panel.onPestana('plano-tarea')
    panel.onAbrir(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [entregaAbierta, setEntregaAbierta] = useState(false)
  const [misTrabajos, setMisTrabajos] = useState(false)
  const guia = useGuia('robotica')
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  // Enunciado del ejercicio de práctica abierto (una línea, sin la respuesta).
  const [enunciado, setEnunciado] = useState<string | null>(null)
  const { reproduciendo, setReproduciendo, velocidad, setVelocidad, grabando, setTick, tRef, canvasRef, nombreVideo, puedeGrabar, alternarGrabacion } = useReproduccion({ nombre: def.nombre, avisar: setAviso })
  const [alcance, setAlcance] = useState(false)
  const inputDXF = useRef<HTMLInputElement>(null)
  const inputDef = useRef<HTMLInputElement>(null)

  // Mando manual.
  const [modeloMando, setModeloMando] = useState('kr6r900')
  const [qMando, setQMando] = useState<number[]>([0, -80, 100, 0, 60, 0])
  const [puntos, setPuntos] = useState<PuntoEnsenado[]>([])

  // Un enlace con una definición (#rob=…) la abre, avisando si reemplaza la actual.
  useEffect(() => {
    void trabajoDelEnlace('rob').then((dato) => {
      if (!dato) return
      limpiarEnlace()
      if (!esDefinicion(dato)) return setAviso('El enlace no trae una definición válida.')
      if (!window.confirm('¿Abrir la definición que viene en el enlace? Reemplaza la que tienes en el lienzo.')) return
      setDef(dato)
      setAviso(`Definición del enlace abierta: «${dato.nombre}».`)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // El ejemplo es una visita: no pisa la tarea guardada.
    if (enTarea && esEjemploGuiado(def)) return
    // Sin almacenamiento o definición demasiado grande: no se guarda y listo.
    guardarClaveJson(enTarea ? CLAVE_TAREA : CLAVE, def)
  }, [def, enTarea])
  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(id)
  }, [aviso])

  const { dxf, evaluacion, programa, previa, seleccionPrevia, placa, sim, robotVista, herrVista, baseVista } = useEvaluacionRobot(def, seleccion, enTarea)

  // Programa del mando (teach-in): PTP por ejes, LIN en línea recta.
  const herrMando = HERR_MANDO
  const modeloM = robotPorId(modeloMando)
  const programaMando: Programa | null = useMemo(() => programaDelMando(puntos, modeloM, herrMando), [puntos, modeloM, herrMando])
  const simMando = useMemo(() => (programaMando ? simular(programaMando) : null), [programaMando])

  const simActiva: Simulacion | null = modo === 'visual' ? sim : reproduciendo ? simMando : null

  // Al cambiar la simulación, volver al inicio.
  useEffect(() => {
    tRef.current = 0
    setTick((n) => n + 1)
  }, [sim, modo])

  const vista = useRef<VistaRobot>({
    modelo: robotVista.modelo,
    pedestal: robotVista.pedestal,
    herramienta: herrVista,
    base: baseVista,
    espesor: 5,
    placa,
    q: [...HOME],
    previa,
    seleccion: seleccionPrevia,
    sim: simActiva,
    indice: 0,
    corriendo: false,
    husillo: false,
    alcance,
  } as VistaRobot)

  // Estado de la reproducción en el instante t.
  const aplicarTiempo = (t: number) => {
    const V = vista.current
    if (simActiva) {
      const { q, i } = ejesEn(simActiva, t)
      V.q = q
      V.indice = i
      const s = simActiva.salidas.filter((x) => x.salida === 1 && x.t <= t + 1e-9)
      V.husillo = s.length ? s[s.length - 1].valor : false
    }
  }

  // Poner al día la vista 3D.
  const V = vista.current
  if (modo === 'visual') {
    V.modelo = robotVista.modelo
    V.pedestal = robotVista.pedestal
    V.herramienta = herrVista
    V.base = baseVista
    V.espesor = programa?.espesor ?? 5
    V.placa = placa
    V.previa = previa
    V.seleccion = seleccionPrevia
    V.marcas = []
  } else {
    V.modelo = modeloM
    V.pedestal = 0
    V.herramienta = herrMando
    V.base = BASE_DEFECTO
    V.espesor = 5
    V.placa = null
    V.previa = { curvas: [], puntos: [], planos: [] }
    V.seleccion = V.previa
    V.marcas = marcasDe(puntos, modeloM, herrMando)
  }
  V.sim = simActiva
  V.corriendo = reproduciendo && !!simActiva
  V.alcance = alcance
  if (simActiva) aplicarTiempo(tRef.current)
  else {
    V.q = modo === 'mando' ? qMando : [...HOME]
    V.indice = 0
    V.husillo = false
  }

  // Bucle de reproducción.
  useBucleReproduccion({ reproduciendo, setReproduciendo, simActiva, velocidad, tRef, setTick, aplicarTiempo })

  // Atajos.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) rehacer()
        else deshacer()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        rehacer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const cargarPractica = (id: string) => {
    const ej = PRACTICA_ROBOT.find((e) => e.id === id)
    if (!ej) return false
    setReproduciendo(false)
    setDef(ej.definicion())
    setSeleccion(null)
    setModo('visual')
    setEnunciado(ej.enunciado)
    setAviso(`Ejercicio abierto: ${ej.titulo}.`)
    return true
  }

  const cargarEjemplo = (id: string) => {
    if (cargarPractica(id)) return
    setEnunciado(null)
    // En la tarea, «Nuevo» vuelve a la definición de la tarea (con el plano cargado).
    if (enTarea && id === 'vacio') {
      if (!window.confirm('¿Empezar de cero? Se borra lo que llevas en la tarea.')) return
      setReproduciendo(false)
      borrarClave(CLAVE_ANTES_EJEMPLO)
      setDef(tareaVaciaRobot())
      setSeleccion(null)
      setModo('visual')
      return setAviso('Tarea en blanco: robot, fresa y el plano.')
    }
    const ej = EJEMPLOS_ROBOT.find((e) => e.id === id)
    if (!ej) return
    setReproduciendo(false)
    setDef(ej.definicion())
    setSeleccion(null)
    setModo('visual')
    setAviso(`Ejemplo cargado: ${ej.titulo}. Pulsa ▶ para simular.`)
  }

  const descargar = (texto: string, nombre: string, tipo = 'text/plain') => {
    const url = URL.createObjectURL(new Blob([texto], { type: tipo }))
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const abrirDXF = async (f: File | undefined) => {
    if (!f) return
    // En la tarea el plano es el del enunciado: no se reemplaza.
    if (enTarea) return setAviso('En la tarea el plano ya está cargado y no se puede cambiar.')
    try {
      const texto = await f.text()
      const d = leerDXF(texto)
      if (!d.curvas.length) throw new Error(d.avisos[0] ?? 'El DXF no tiene curvas.')
      const tieneCurva = def.nodos.some((n) => n.tipo === 'curvaDXF')
      setDef({ ...def, dxf: { nombre: f.name, texto } })
      setAviso(
        `Plano «${f.name}» abierto: ${d.curvas.length} curvas en ${d.capas.length} capa(s) (${d.capas.join(', ')}), unidades ${d.unidades}.` +
          (tieneCurva ? '' : ' Agrega el bloque Curve, en la pestaña Trayectoria, para usarlas.') +
          (d.avisos.length ? ` ${d.avisos.join(' ')}` : ''),
      )
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo leer el DXF.')
    }
  }

  const abrirDef = async (f: File | undefined) => {
    if (!f) return
    try {
      const d = JSON.parse(await f.text())
      if (!esDefinicion(d)) throw new Error('Ese archivo no es una definición de robótica de NeumaLab.')
      // Una definición de la tarea se abre en la sección de la tarea, sea donde sea que se abra.
      if ((d as { tarea?: string }).tarea === MARCA_TAREA4 && VER_TAREA_ROBOTICA && !enTarea) setSeccion('tarea')
      // En la tarea el plano es el del enunciado: si la definición trae otro, se cambia por el de la tarea.
      const { def: abierta, cambioElPlano } = enTarea || ((d as { tarea?: string }).tarea === MARCA_TAREA4 && VER_TAREA_ROBOTICA) ? adaptarATarea(d) : { def: d, cambioElPlano: false }
      setDef(abierta)
      setSeleccion(null)
      setEnunciado(null)
      setAviso(`Definición «${f.name}» abierta.${cambioElPlano ? ' Traía otro plano: quedó el de la tarea. Revisa que tus componentes Curve usen sus capas (CONTORNO y RANURAS).' : ''}`)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo abrir el archivo.')
    }
  }

  /** Croquis (SVG en texto): la pieza acotada o el posicionamiento del robot. */
  const crearCroquis = (tipo: string): string => crearCroquisRobot(tipo, { nombre: def.nombre, dxf, previa, robotVista, baseVista, programa, placa, herrVista, alOrigen: def.nodos.some((n) => n.tipo === 'curvaDXF' && n.params.alOrigen !== false) })
  const croquisPng = async (tipo: string, archivo: string) => {
    const el = new DOMParser().parseFromString(crearCroquis(tipo), 'image/svg+xml').documentElement as unknown as SVGSVGElement
    await exportarPng(el, archivo)
  }
  const exportarCroquis = async (cual: string) => {
    const [tipo, formato] = cual.split('-')
    const archivo = nombreSeguro(`${def.nombre || 'robot'}-${tipo === 'pieza' ? 'croquis-pieza' : 'posicionamiento'}`, formato)
    try {
      if (formato === 'svg') return descargar(crearCroquis(tipo), archivo, 'image/svg+xml')
      await croquisPng(tipo, archivo)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo generar la imagen.')
    }
  }

  const exportarKRL = () => {
    if (modo === 'mando') {
      if (!programaMando || !simMando) return
      descargar(generarKRL(programaMando, simMando, 'teach_in'), 'teach_in.src')
      return
    }
    if (!programa || !sim) return setAviso('Todavía no hay programa: el Core necesita comandos, robot y herramienta.')
    descargar(generarKRL(programa, sim, def.nombre), nombreSeguro(def.nombre || 'programa', 'src'))
    setAviso('Código KRL descargado (.src).')
  }

  const tiempo = tRef.current
  const nodoSel = seleccion ? def.nodos.find((n) => n.id === seleccion) ?? null : null
  const guiaT = enTarea ? guiaTarea(def) : null
  const pasoTarea = guiaT?.paso ?? null
  const checklistTarea = useChecklistTarea(def, enTarea)
  useEffect(() => {
    document.querySelector('.panel-acoplado__contenido')?.scrollTo({ top: 0 })
    if (pasoTarea?.seleccionar) setSeleccion(pasoTarea.seleccionar)
  }, [pasoTarea?.id])
  const irAEstudiar = (ancla: string) => {
    try {
      window.history.replaceState(null, '', `#${ancla}`)
    } catch {
      /* sin historial */
    }
    setSeccion('estudiar')
  }
  const verEjemploGuiado = () => {
    if (esEjemploGuiado(defRef.current)) return
    guardarClaveJson(CLAVE_ANTES_EJEMPLO, defRef.current)
    setReproduciendo(false)
    setDef(ejemploGuiadoTarea())
    setSeleccion(null)
    setModo('visual')
    setAviso('Ejemplo del contorno. Tu tarea sigue guardada: «Volver a mi tarea» la recupera.')
  }
  const volverDelEjemplo = () => {
    let previa: Definicion | null = null
    const guardada = leerJson(CLAVE_ANTES_EJEMPLO)
    if (esDefinicion(guardada) && !esEjemploGuiado(guardada)) previa = guardada
    borrarClave(CLAVE_ANTES_EJEMPLO)
    const siguiente = previa ?? tareaAlAbrir(definicionGuardada(CLAVE_TAREA), null)
    setReproduciendo(false)
    setDef(siguiente)
    setSeleccion(null)
    setModo('visual')
    setAviso('Volviste a tu tarea.')
  }
  const seguirConElEjemplo = () => {
    const actual = defRef.current
    if (!esEjemploGuiado(actual)) return
    borrarClave(CLAVE_ANTES_EJEMPLO)
    setDef({ ...actual, nombre: NOMBRE_TAREA })
    setAviso('Este contorno quedó como tu tarea. Sigue con las ranuras.')
  }
  const ejemploEnTarea = enTarea && esEjemploGuiado(def)
  // El desplegable muestra el ejemplo abierto, también después de recargar.
  const ejemploAbierto = useMemo(() => [...EJEMPLOS_ROBOT, ...PRACTICA_ROBOT].find((e) => e.definicion().nombre === def.nombre) ?? null, [def.nombre])
  const errores = simActiva?.problemas.filter((p) => p.nivel === 'error') ?? []
  const avisosSim = simActiva?.problemas.filter((p) => p.nivel === 'aviso') ?? []
  const modeloVista = modo === 'visual' ? robotVista.modelo : modeloM
  const qVista = vista.current.q

  const itemsArchivo = [
    { texto: 'Nueva definición', ayuda: 'Empieza con el lienzo vacío', onClick: () => cargarEjemplo('vacio') },
    { texto: 'Abrir definición…', ayuda: 'Una definición guardada (.json), con su plano', onClick: () => inputDef.current?.click() },
    { texto: 'Guardar definición', ayuda: 'Descarga la definición y el plano DXF', onClick: () => descargar(JSON.stringify(def, null, 2), nombreSeguro(def.nombre || 'definicion', 'json'), 'application/json') },
    { texto: 'Abrir plano DXF…', ayuda: enTarea ? 'En la tarea el plano ya está cargado' : 'Trae las curvas de tu plano', onClick: () => inputDXF.current?.click(), separar: true, ...(enTarea ? { deshabilitado: true, porque: 'En la tarea el plano ya está cargado' } : {}) },
    { texto: 'Mis trabajos…', ayuda: 'Guarda varias definiciones con nombre y cámbiate entre ellas', onClick: () => setMisTrabajos(true), separar: true },
  ]
  const itemsExportar = [
    { texto: 'Programa KRL (.src)', ayuda: 'Para el controlador KUKA', onClick: exportarKRL },
    { texto: 'Definición (JSON)', ayuda: 'El archivo de la definición: se vuelve a abrir en la app', onClick: () => descargar(JSON.stringify(def, null, 2), nombreSeguro(def.nombre || 'definicion', 'json'), 'application/json') },
    ...(modo === 'visual'
      ? [
          { texto: 'Croquis de la pieza (PNG)', ayuda: 'La pieza acotada, con el cero de la pieza', onClick: () => void exportarCroquis('pieza-png'), separar: true },
          { texto: 'Croquis de la pieza (SVG)', onClick: () => void exportarCroquis('pieza-svg') },
          { texto: 'Posicionamiento del robot (PNG)', ayuda: 'Planta y elevación: robot, mesón y alcance', onClick: () => void exportarCroquis('posicion-png') },
          { texto: 'Posicionamiento del robot (SVG)', onClick: () => void exportarCroquis('posicion-svg') },
        ]
      : []),
    {
      texto: 'Grabar video de la simulación',
      ayuda: 'Graba la vista 3D; se descarga al detener',
      onClick: alternarGrabacion,
      deshabilitado: !puedeGrabar || grabando,
      porque: grabando ? 'Ya está grabando' : 'Tu navegador no permite grabar video',
      separar: true,
    },
  ]

  const barra = (
    <BarraRobot
      modo={modo}
      setModo={setModo}
      setReproduciendo={setReproduciendo}
      estrecha={estrecha}
      enTarea={enTarea}
      ejemploEnTarea={ejemploEnTarea}
      ejemploAbierto={ejemploAbierto}
      puedeDeshacer={historial.current.puedeDeshacer}
      puedeRehacer={historial.current.puedeRehacer}
      deshacer={deshacer}
      rehacer={rehacer}
      cargarEjemplo={cargarEjemplo}
      volverDelEjemplo={volverDelEjemplo}
      inputDXF={inputDXF}
      inputDef={inputDef}
      abrirDXF={abrirDXF}
      abrirDef={abrirDef}
      guia={guia}
      grabando={grabando}
      alternarGrabacion={alternarGrabacion}
      itemsArchivo={itemsArchivo}
      itemsExportar={itemsExportar}
    />
  )

  const areaPrograma = (
    <AreaPrograma
      entregando={entregaAbierta && enTarea}
      modo={modo}
      def={def}
      setDef={setDef}
      evaluacion={evaluacion}
      dxfCapas={dxf?.capas ?? []}
      seleccion={seleccion}
      setSeleccion={setSeleccion}
      nodoSel={nodoSel}
      pasoTarea={pasoTarea}
      enunciado={enunciado}
      setEnunciado={setEnunciado}
      ejemploEnTarea={ejemploEnTarea}
      volverDelEjemplo={volverDelEjemplo}
      seguirConElEjemplo={seguirConElEjemplo}
      deshacer={deshacer}
      puedeDeshacer={historial.current.puedeDeshacer}
      setPlegado={setPlegado}
      modeloM={modeloM}
      herrMando={herrMando}
      qMando={qMando}
      setQMando={setQMando}
      setModeloMando={setModeloMando}
      puntos={puntos}
      setPuntos={setPuntos}
      reproduciendo={reproduciendo}
      setReproduciendo={setReproduciendo}
      tRef={tRef}
      exportarKRL={exportarKRL}
    />
  )

  const abrirAnalisis = () => {
    panel.onPestana('analisis')
    panel.onAbrir(true)
  }

  const areaSimulacion = (
    <AreaSimulacion
      modo={modo}
      vista={vista}
      canvasRef={canvasRef}
      grabando={grabando}
      modeloVista={modeloVista}
      simActiva={simActiva}
      errores={errores}
      avisosSim={avisosSim}
      abrirAnalisis={abrirAnalisis}
      reproduciendo={reproduciendo}
      setReproduciendo={setReproduciendo}
      tRef={tRef}
      tiempo={tiempo}
      setTick={setTick}
      velocidad={velocidad}
      setVelocidad={setVelocidad}
      alcance={alcance}
      setAlcance={setAlcance}
      qVista={qVista}
      setQMando={setQMando}
    />
  )

  const pestanas: Array<PestanaPanel<PestanaRobot>> = [
    ...(enTarea && pasoTarea ? [{ id: 'plano-tarea' as const, titulo: 'Plano de la tarea', tituloCorto: 'Plano', contenido: <PlanoTarea paso={pasoTarea} avance={guiaT?.avance ?? []} checklist={ejemploEnTarea ? [] : checklistTarea} onEstudiar={irAEstudiar} ejemplo={ejemploEnTarea} /> }] : []),
    {
      id: 'analisis',
      titulo: 'Análisis',
      contador: simActiva ? errores.length + avisosSim.length : undefined,
      contenido: simActiva ? (
        <Analisis
          sim={simActiva}
          onEstudiar={irAEstudiar}
          onIr={(p) => {
            tRef.current = p.t
            if (p.nodo && modo === 'visual') setSeleccion(p.nodo)
            setTick((n) => n + 1)
          }}
        />
      ) : (
        <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--tinta-suave)' }}>
          Cuando haya una simulación, aquí se revisan el alcance, los límites de los ejes y las singularidades. <button type="button" onClick={() => irAEstudiar('grados')} style={enlaceEstudiar}>¿Qué es una singularidad? → Estudiar</button>
        </p>
      ),
    },
    {
      id: 'krl',
      titulo: 'Código KRL',
      tituloCorto: 'KRL',
      contenido:
        modo === 'visual' && sim ? (
          <CodigoKRL sim={sim} t={tRef.current} seguir={reproduciendo} />
        ) : (
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--tinta-suave)' }}>
            {modo === 'visual' ? 'Todavía no hay programa: conecta comandos, robot y herramienta al Core.' : 'En el mando manual, el programa KRL de tus puntos se descarga desde Exportar.'}
          </p>
        ),
    },
    {
      id: 'ficha',
      titulo: 'Ficha técnica',
      tituloCorto: 'Ficha',
      contenido: (
        <FichaModelo modeloVista={modeloVista} />
      ),
    },
  ]

  const barraEstado = (
    <>
      <span>
        {modo === 'mando'
          ? 'Mando manual: mueve los ejes, graba puntos y pulsa «Reproducir».'
          : simActiva
            ? reproduciendo
              ? 'Reproduciendo la simulación.'
              : 'Pulsa ▶ para ver el recorrido del robot · selecciona un componente para ver y cambiar sus valores.'
            : 'Arrastra desde una salida (derecha) hasta una entrada (izquierda) para conectar · doble clic en el fondo para buscar un componente.'}
      </span>
      {simActiva && (errores.length > 0 || avisosSim.length > 0) && (
        <button onClick={abrirAnalisis} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: errores.length ? 'var(--rojo-error)' : 'var(--naranjo-texto)', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
          ⚠ {errores.length ? `${errores.length} error(es)` : `${avisosSim.length} aviso(s)`}
        </button>
      )}
    </>
  )

  return (
    <>
      <SubnavUnidad
        nombre="Robótica"
        seccion={seccion}
        onSeccion={setSeccion}
        tarea={VER_TAREA_ROBOTICA ? NOMBRE_TAREA : undefined}
        entregar={enTarea ? { abierto: entregaAbierta, onAlternar: () => setEntregaAbierta((a) => !a), etiqueta: 'Entregar Tarea Robótica', etiquetaCorta: 'Entregar' } : undefined}
      />
      {seccion !== 'estudiar' ? (
        <BancoDividido<PestanaRobot>
          key={seccion}
          clave={CLAVES.robotEscena}
          clase="banco--robot"
          divisionInicial={0.42}
          anchoMin={340}
          // La paleta ocupa unos 250 px: con menos de 560 el lienzo de nodos no se puede usar.
          // Con Entregar abierto no se arma el programa: ahí manda la simulación, que es lo que se graba.
          anchoFijoIzquierda={modo === 'visual' && !entregaAbierta ? 560 : undefined}
          plegado={estrecha ? 'abierto' : plegado}
          onPlegado={setPlegado}
          riel={<span style={{ writingMode: 'vertical-rl', fontSize: '0.75rem', fontWeight: 700, color: 'var(--tinta-suave)', letterSpacing: '0.04em' }}>{modo === 'visual' ? 'PROGRAMA' : 'MANDO'}</span>}
          barra={barra}
          izquierda={{ id: 'programa', titulo: modo === 'visual' ? 'Programa' : 'Mando', contenido: areaPrograma }}
          derecha={{ id: 'simulacion', titulo: 'Simulación', tituloCorto: '3D', contenido: areaSimulacion }}
          inferior={{ etiqueta: 'Plano, análisis y ficha', pestanas, estado: panel, encabezado: enTarea && pasoTarea ? <BarraEjemplo ejemplo={ejemploEnTarea} onEjemplo={verEjemploGuiado} onVolver={volverDelEjemplo} onSeguir={seguirConElEjemplo} /> : undefined }}
          estado={barraEstado}
          conCajon={entregaAbierta && enTarea && !estrecha}
        />
      ) : (
        <Suspense fallback={<p style={{ padding: 24, color: 'var(--tinta-suave)', textAlign: 'center' }}>Abriendo Estudiar…</p>}>
          <EstudiarRobotica setSeccion={setSeccion} />
        </Suspense>
      )}
      {guia.visible && seccion !== 'estudiar' && <GuiaInicio unidad="Robótica" pasos={GUIA_ROBOT} onCerrar={guia.cerrar} />}
      {misTrabajos && (
        <MisTrabajos
          unidad="robotica"
          nombreActual={def.nombre ?? ''}
          actual={() => def}
          abrir={(dato, nombre) => {
            if (!esDefinicion(dato)) return 'Ese trabajo no es una definición válida.'
            setReproduciendo(false)
            setModo('visual')
            setDef({ ...dato, nombre: dato.nombre || nombre })
            setSeleccion(null)
          }}
          onCerrar={() => setMisTrabajos(false)}
        />
      )}
      {entregaAbierta && enTarea && (
        <PanelEntrega
          def={def}
          sim={sim}
          simActiva={simActiva}
          evaluacion={evaluacion}
          enTarea={enTarea}
          modo={modo}
          modeloVista={modeloVista}
          grabando={grabando}
          puedeGrabar={puedeGrabar}
          nombreVideo={nombreVideo}
          tRef={tRef}
          alternarGrabacion={alternarGrabacion}
          setReproduciendo={setReproduciendo}
          croquisPng={croquisPng}
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

type PestanaRobot = 'analisis' | 'krl' | 'ficha' | 'plano-tarea'


/** Aviso flotante: aparece y desaparece sin mover el resto de la página. */
const avisoOk = estiloAviso
