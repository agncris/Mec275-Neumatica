/**
 * Unidad 4 · Robótica: programar un robot KUKA con nodos (como Grasshopper
 * + KUKA|prc) o a mano con el mando (teach-in), simularlo en 3D con análisis
 * de alcance, límites y singularidades, y exportar el código KRL. Funciona en
 * el navegador: no hace falta Windows ni licencias.
 */
import { BotonNuevo, botonPrimario, botonSecundario, estiloAviso, Menu, useEsEstrecha, usePersistente } from '../components/ui'
import BancoDividido, { TituloArea } from '../components/banco/BancoDividido'
import { usePanelAcoplado, type PestanaPanel } from '../components/banco/PanelAcoplado'
import SubnavUnidad, { seccionDeLaUrl, useSeccionUnidad, type SeccionUnidad } from '../components/banco/SubnavUnidad'
import { VER_TAREA_ROBOTICA } from '../unidades'
import MisTrabajos from '../components/banco/MisTrabajos'
import GuiaInicio, { GUIA_ROBOT, useGuia } from '../components/banco/GuiaInicio'
import { ETIQUETA_GRUPO, PRACTICA_ROBOT, type GrupoPractica } from './practica'
import { adaptarATarea, analizarTarea4, ejemploGuiadoTarea, esEjemploGuiado, MARCA_TAREA4, revisarTarea4, tareaAlAbrir, tareaVaciaRobot, type PuntoRevisionTarea } from './tarea4'
import { guiaTarea } from './guiaTarea'
import { leerAlumno, limpiarEnlace, trabajoDelEnlace } from '../entregar'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { exportarPng, nombreSeguro } from '../exportar'
import { croquisPieza, croquisPosicion } from './croquis'
import { Historial } from '../historial'
import EditorNodos from './EditorNodos'
import CodigoKRL from './CodigoKRL'
import Analisis from './Analisis'
import { enlaceEstudiar } from './estilos'
import PlanoTarea, { BarraEjemplo } from './PlanoTarea'
import { Ejes, Propiedades } from './PanelParametros'
import PanelEntrega from './PanelEntrega'
import { EJEMPLOS_ROBOT } from './ejemplos'
import { cajaCurvas, leerDXF, type Curva } from './geometria'
import { planoXY, v, type Plano, type V3 } from './matematica'
import Mando, { poseDe, type PuntoEnsenado } from './Mando'
import { ejesEn, generarKRL, PLACA_DEFECTO, simular, type Simulacion } from './movimiento'
import {
  componente,
  esDefinicion,
  evaluar,
  paramsIniciales,
  type Comando,
  type Dato,
  type Definicion,
  type Herramienta,
  type Programa,
  type RobotVirtual,
} from './nodos'
import { HOME, robotPorId } from './robots'
import type { Previa, VistaRobot } from './Robot3D'
import { ANCLAS_ESTUDIAR_ROBOT } from './anclasEstudiar'

const Robot3D = lazy(() => import('./Robot3D'))
// La teoría, la ficha y las demos 3D de Estudiar se cargan solo al entrar a Estudiar.
const EstudiarRobotica = lazy(() => import('./EstudiarRobotica'))

const CLAVE = 'neumalab.robot.definicion'
/**
 * La tarea de Robótica se trabaja en su propia sección, con su definición guardada
 * aparte del Laboratorio. El enunciado lo entrega el profesor; «Entregar» sólo
 * aparece ahí.
 */
const CLAVE_TAREA = 'neumalab.robot.tarea'
/** Lo que había en la tarea antes de abrir el ejemplo guiado. */
const CLAVE_ANTES_EJEMPLO = 'neumalab.robot.tarea.antes-ejemplo'
const NOMBRE_TAREA = 'Tarea Robótica'
const HERR_DEFECTO: Herramienta = { tipo: 'fresa', nombre: 'Husillo con fresa', largo: 200, diametro: 5 }
const HERR_MANDO: Herramienta = { tipo: 'ventosa', nombre: 'Ventosa de vacío', largo: 120, diametro: 40 }
const BASE_DEFECTO: Plano = planoXY(v(450, -150, 300))

function leerGuardada(): Definicion {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (crudo) {
      const d = JSON.parse(crudo)
      if (esDefinicion(d)) return d
    }
  } catch {
    /* sin almacenamiento */
  }
  return EJEMPLOS_ROBOT[0].definicion()
}

function definicionGuardada(clave: string): Definicion | null {
  try {
    const crudo = localStorage.getItem(clave)
    if (!crudo) return null
    const d = JSON.parse(crudo)
    return esDefinicion(d) ? d : null
  } catch {
    return null
  }
}

function leerTarea(): Definicion {
  const guardada = definicionGuardada(CLAVE_TAREA)
  const previa = definicionGuardada(CLAVE_ANTES_EJEMPLO)
  if (guardada && esEjemploGuiado(guardada)) {
    try {
      localStorage.removeItem(CLAVE_ANTES_EJEMPLO)
    } catch {
      /* sin almacenamiento */
    }
  }
  return tareaAlAbrir(guardada, previa)
}

const esCurva = (d: Dato): d is Curva => typeof d === 'object' && d !== null && 'pts' in d && 'cerrada' in d
const esPlano = (d: Dato): d is Plano => typeof d === 'object' && d !== null && 'o' in d && 'z' in d
const esPunto = (d: Dato): d is V3 => typeof d === 'object' && d !== null && 'x' in d && 'y' in d && 'z' in d && !('o' in d)

function previaDe(datos: Dato[]): Previa {
  const p: Previa = { curvas: [], puntos: [], planos: [] }
  for (const d of datos) {
    if (esCurva(d)) p.curvas.push(d.cerrada ? d.pts : [...d.pts])
    else if (esPlano(d)) p.planos.push(d)
    else if (esPunto(d)) p.puntos.push(d)
  }
  return p
}

type Modo = 'visual' | 'mando'

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
  const panel = usePanelAcoplado<PestanaRobot>('neumalab.robot.panel.v3', enTarea ? 'plano-tarea' : 'analisis', false, 280)
  const [plegadoGuardado, setPlegado] = usePersistente<'abierto' | 'riel' | 'oculto'>('neumalab.robot.plegado', 'abierto')
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
  const nombreVideo = useRef<string | null>(null)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  // Enunciado del ejercicio de práctica abierto (una línea, sin la respuesta).
  const [enunciado, setEnunciado] = useState<string | null>(null)
  const [reproduciendo, setReproduciendo] = useState(false)
  const [velocidad, setVelocidad] = useState(1)
  const [alcance, setAlcance] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const [, setTick] = useState(0)
  const tRef = useRef(0)
  const inputDXF = useRef<HTMLInputElement>(null)
  const inputDef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const grabadora = useRef<MediaRecorder | null>(null)

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
    try {
      localStorage.setItem(enTarea ? CLAVE_TAREA : CLAVE, JSON.stringify(def))
    } catch {
      /* sin almacenamiento o definición demasiado grande */
    }
  }, [def, enTarea])
  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(id)
  }, [aviso])

  const dxf = useMemo(() => (def.dxf ? leerDXF(def.dxf.texto) : null), [def.dxf])
  const evaluacion = useMemo(() => evaluar(def, dxf), [def, dxf])
  const programa: Programa | null = evaluacion.programas[0] ?? null
  const previa = useMemo(() => {
    const todos: Dato[] = []
    for (const n of def.nodos) {
      const r = evaluacion.nodos[n.id]
      if (!r || r.estado === 'error' || n.tipo === 'core') continue
      for (const s of r.salidas) todos.push(...s)
    }
    return previaDe(todos)
  }, [def, evaluacion])
  const seleccionPrevia = useMemo(
    () => (seleccion ? previaDe((evaluacion.nodos[seleccion]?.salidas ?? []).flat()) : { curvas: [], puntos: [], planos: [] }),
    [evaluacion, seleccion],
  )
  // Plancha: el contorno de la geometría con 20 mm de margen.
  const placa = useMemo(() => {
    const curvas = previa.curvas.map((pts) => ({ pts, cerrada: true, esquinas: [] }))
    if (!curvas.length) return null
    const { min, max } = cajaCurvas(curvas)
    return Number.isFinite(min.x) ? { x0: min.x - 20, y0: min.y - 20, x1: max.x + 20, y1: max.y + 20 } : null
  }, [previa])
  // En la tarea, la simulación también avisa del husillo (en los ejercicios y fallas no: ahí se encuentra leyendo el KRL).
  const sim = useMemo(() => (programa ? simular(programa, placa, { avisoHusillo: enTarea }) : null), [programa, placa, enTarea])

  // Programa del mando (teach-in): PTP por ejes, LIN en línea recta.
  const herrMando = HERR_MANDO
  const modeloM = robotPorId(modeloMando)
  const programaMando: Programa | null = useMemo(() => {
    if (!puntos.length) return null
    const comandos: Comando[] = [{ tipo: 'AXIS', q: [...HOME], vel: 40, nodo: 'mando' }]
    let salida = false
    for (const p of puntos) {
      if (p.tipo === 'PTP') comandos.push({ tipo: 'AXIS', q: p.q, vel: 40, nodo: 'mando' })
      else {
        const pose = poseDe(modeloM, p.q, herrMando.largo, 0)
        const xt = { x: pose.R[0][0], y: pose.R[1][0], z: pose.R[2][0] }
        const zt = { x: pose.R[0][2], y: pose.R[1][2], z: pose.R[2][2] }
        const zPlano = { x: -xt.x, y: -xt.y, z: -xt.z }
        const yPlano = { x: zPlano.y * zt.z - zPlano.z * zt.y, y: zPlano.z * zt.x - zPlano.x * zt.z, z: zPlano.x * zt.y - zPlano.y * zt.x }
        comandos.push({ tipo: 'LIN', plano: { o: pose.tcp, x: zt, y: yPlano, z: zPlano }, vel: 0.15, nodo: 'mando' })
      }
      if (p.salida && p.salida.valor !== salida) {
        salida = p.salida.valor
        comandos.push({ tipo: 'OUT', salida: 1, valor: salida, nodo: 'mando' }, { tipo: 'WAIT', seg: 0.5, nodo: 'mando' })
      }
    }
    const rv: RobotVirtual = { modelo: modeloM, pedestal: 0 }
    return { comandos, robot: rv, herramienta: herrMando, base: planoXY(v()), espesor: 0, inicio: [...HOME], nodo: 'mando' }
  }, [puntos, modeloM, herrMando])
  const simMando = useMemo(() => (programaMando ? simular(programaMando) : null), [programaMando])

  const simActiva: Simulacion | null = modo === 'visual' ? sim : reproduciendo ? simMando : null

  // Al cambiar la simulación, volver al inicio.
  useEffect(() => {
    tRef.current = 0
    setTick((n) => n + 1)
  }, [sim, modo])

  // Robot, herramienta y base que se ven (aunque todavía no haya Core completo).
  const robotVista: RobotVirtual = useMemo(() => {
    if (programa) return programa.robot
    for (const n of def.nodos) if (n.tipo === 'robot') {
      const r = evaluacion.nodos[n.id]?.salidas[0]?.[0] as RobotVirtual | undefined
      if (r) return r
    }
    return { modelo: robotPorId('kr6r900'), pedestal: 0 }
  }, [programa, def, evaluacion])
  const herrVista: Herramienta = useMemo(() => {
    if (programa) return programa.herramienta
    for (const n of def.nodos) if (n.tipo === 'herramienta') {
      const h = evaluacion.nodos[n.id]?.salidas[0]?.[0] as Herramienta | undefined
      if (h) return h
    }
    return HERR_DEFECTO
  }, [programa, def, evaluacion])
  const baseVista: Plano = useMemo(() => {
    if (programa) return programa.base
    const core = def.nodos.find((n) => n.tipo === 'core')
    if (!core) return BASE_DEFECTO
    const p = { ...paramsIniciales(componente('core')!), ...core.params }
    return planoXY(v(Number(p.bx), Number(p.by), Number(p.bz)))
  }, [programa, def])


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
  const velRef = useRef(velocidad)
  velRef.current = velocidad
  useEffect(() => {
    if (!reproduciendo || !simActiva) return
    let vivo = true
    let antes = performance.now()
    let ultimo = 0
    const bucle = () => {
      if (!vivo) return
      const ahora = performance.now()
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      tRef.current = Math.min(simActiva.tiempo, tRef.current + dt * velRef.current)
      aplicarTiempo(tRef.current)
      if (ahora - ultimo > 100) {
        ultimo = ahora
        setTick((n) => n + 1)
      }
      if (tRef.current >= simActiva.tiempo) {
        setReproduciendo(false)
        setTick((n) => n + 1)
        return
      }
      requestAnimationFrame(bucle)
    }
    requestAnimationFrame(bucle)
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reproduciendo, simActiva])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      try {
        localStorage.removeItem(CLAVE_ANTES_EJEMPLO)
      } catch {
        /* sin almacenamiento */
      }
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
  const crearCroquis = (tipo: string): string => {
    const nombre = def.nombre || 'robot'
    if (tipo === 'pieza') {
      const curvas = dxf?.curvas.length
        ? dxf.curvas.map((c) => ({ pts: c.pts, cerrada: c.cerrada }))
        : previa.curvas.map((pts) => ({ pts, cerrada: pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-3 }))
      if (!curvas.length) throw new Error('No hay geometría para el croquis: abre un DXF o arma curvas en la definición.')
      return croquisPieza(curvas, nombre)
    }
    return croquisPosicion(
      { modelo: robotVista.modelo, pedestal: robotVista.pedestal, base: baseVista, espesor: programa?.espesor ?? 5, placa: placa ?? PLACA_DEFECTO, herramienta: herrVista },
      nombre,
    )
  }
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

  const puedeGrabar = typeof window !== 'undefined' && 'MediaRecorder' in window
  const alternarGrabacion = () => {
    if (grabando) return grabadora.current?.stop()
    const c = canvasRef.current
    if (!c || !puedeGrabar) return setAviso('Este navegador no permite grabar video.')
    const tipo = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t))
    const rec = new MediaRecorder(c.captureStream(30), tipo ? { mimeType: tipo, videoBitsPerSecond: 6_000_000 } : undefined)
    const partes: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data)
    rec.onstop = () => {
      setGrabando(false)
      const ext = (rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm'
      const url = URL.createObjectURL(new Blob(partes, { type: rec.mimeType || 'video/webm' }))
      const a = document.createElement('a')
      a.href = url
      a.download = nombreVideo.current ? `${nombreVideo.current}.${ext}` : nombreSeguro(`${def.nombre || 'robot'}_simulacion`, ext)
      nombreVideo.current = null
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setAviso(`Video descargado: ${a.download}`)
    }
    rec.start(500)
    grabadora.current = rec
    setGrabando(true)
    setAviso('Grabando la vista 3D: pulsa ▶ y «■ Detener grabación» al terminar.')
  }

  const tiempo = tRef.current
  const nodoSel = seleccion ? def.nodos.find((n) => n.id === seleccion) ?? null : null
  const guiaT = enTarea ? guiaTarea(def) : null
  const pasoTarea = guiaT?.paso ?? null
  const [checklistTarea, setChecklistTarea] = useState<PuntoRevisionTarea[]>([])
  useEffect(() => {
    document.querySelector('.panel-acoplado__contenido')?.scrollTo({ top: 0 })
    if (pasoTarea?.seleccionar) setSeleccion(pasoTarea.seleccionar)
  }, [pasoTarea?.id])
  useEffect(() => {
    if (!enTarea) return
    const id = window.setTimeout(() => {
      try {
        setChecklistTarea(revisarTarea4(analizarTarea4(def), leerAlumno().nombre))
      } catch {
        setChecklistTarea([])
      }
    }, 500)
    return () => window.clearTimeout(id)
  }, [enTarea, def])
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
    try {
      localStorage.setItem(CLAVE_ANTES_EJEMPLO, JSON.stringify(defRef.current))
    } catch {
      /* sin almacenamiento */
    }
    setReproduciendo(false)
    setDef(ejemploGuiadoTarea())
    setSeleccion(null)
    setModo('visual')
    setAviso('Ejemplo del contorno. Tu tarea sigue guardada: «Volver a mi tarea» la recupera.')
  }
  const volverDelEjemplo = () => {
    let previa: Definicion | null = null
    try {
      const crudo = localStorage.getItem(CLAVE_ANTES_EJEMPLO)
      if (crudo) {
        const d = JSON.parse(crudo)
        if (esDefinicion(d) && !esEjemploGuiado(d)) previa = d
      }
      localStorage.removeItem(CLAVE_ANTES_EJEMPLO)
    } catch {
      /* sin almacenamiento */
    }
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
    try {
      localStorage.removeItem(CLAVE_ANTES_EJEMPLO)
    } catch {
      /* sin almacenamiento */
    }
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
    <>
      <span className="segmentado" role="radiogroup" aria-label="Forma de programar">
        {(
          [
            ['visual', estrecha ? 'Nodos' : 'Programación visual'],
            ['mando', estrecha ? 'Mando' : 'Mando manual'],
          ] as Array<[Modo, string]>
        ).map(([m, t]) => (
          <button
            key={m}
            role="radio"
            aria-checked={modo === m}
            onClick={() => {
              setReproduciendo(false)
              setModo(m)
            }}
            data-modo={m}
            title={m === 'mando' ? 'Mover el robot a mano y grabar puntos (teach-in)' : 'Armar el programa con nodos, como Grasshopper + KUKA|prc'}
            style={{ minHeight: 34 }}
          >
            {t}
          </button>
        ))}
      </span>
      {modo === 'visual' && (
        <>
          <BotonNuevo que="la tarea de cero" compacto={estrecha} onClick={() => cargarEjemplo('vacio')} />
          {ejemploEnTarea && (
            <button type="button" onClick={volverDelEjemplo} style={botonPrimario()} data-volver-tarea="si">
              Volver a mi tarea
            </button>
          )}
          <span style={{ display: 'inline-flex', gap: 2 }}>
            <button onClick={deshacer} disabled={!historial.current.puedeDeshacer} aria-label="Deshacer" className="boton-icono" style={{ opacity: historial.current.puedeDeshacer ? 1 : 0.4 }} title="Deshacer (Ctrl+Z)">
              ↶
            </button>
            <button onClick={rehacer} disabled={!historial.current.puedeRehacer} aria-label="Rehacer" className="boton-icono" style={{ opacity: historial.current.puedeRehacer ? 1 : 0.4 }} title="Rehacer (Ctrl+Shift+Z)">
              ↷
            </button>
          </span>
          {!enTarea && (
          <select
            value={ejemploAbierto?.id ?? ''}
            onChange={(e) => {
              if (e.target.value) cargarEjemplo(e.target.value)
            }}
            style={{ padding: '0.35rem 0.4rem', minHeight: 36, width: estrecha ? '42vw' : 340, maxWidth: '46vw' }}
            data-ejemplos-robot="si"
            aria-label="Ejemplos"
            title={ejemploAbierto ? ejemploAbierto.titulo : 'Ejemplos'}
          >
            <option value="">Ejemplos…</option>
            {EJEMPLOS_ROBOT.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titulo}
              </option>
            ))}
            {(['clase', 'fallas', 'control', 'retos'] as GrupoPractica[]).map((g) => (
              <optgroup key={g} label={ETIQUETA_GRUPO[g]}>
                {PRACTICA_ROBOT.filter((e) => e.grupo === g).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.titulo}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          )}
          {!estrecha && (
            <button
              onClick={() => inputDXF.current?.click()}
              disabled={enTarea}
              style={{ ...botonSecundario, opacity: enTarea ? 0.45 : 1 }}
              title={enTarea ? 'En la tarea el plano ya está cargado' : 'Traer un plano DXF para usar sus curvas'}
              data-abrir-dxf="si"
            >
              Abrir DXF
            </button>
          )}
        </>
      )}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        {!estrecha && (
          <button onClick={guia.abrir} className="boton-icono" title="Guía de inicio" aria-label="Guía de inicio" data-abrir-guia="si">
            ?
          </button>
        )}
        {grabando && (
          <button onClick={alternarGrabacion} style={{ ...botonSecundario, color: '#fff', background: '#c62828', borderColor: '#c62828' }}>
            ■ {estrecha ? 'Detener' : 'Detener grabación'}
          </button>
        )}
        {estrecha ? (
          <Menu etiqueta="⋯" datos="mas" ancho={300} items={[...(modo === 'visual' ? itemsArchivo : []), ...itemsExportar.map((it, i) => (i === 0 && modo === 'visual' ? { ...it, separar: true } : it)), { texto: 'Guía de inicio', ayuda: 'Los cuatro pasos para partir', onClick: guia.abrir, separar: true }]} />
        ) : (
          <>
            {modo === 'visual' && <Menu etiqueta="Archivo" items={itemsArchivo} />}
            <Menu etiqueta="Exportar" ancho={300} items={itemsExportar} />
          </>
        )}
      </span>
      <input ref={inputDXF} type="file" accept=".dxf" style={{ display: 'none' }} onChange={(e) => (void abrirDXF(e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={inputDef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => (void abrirDef(e.target.files?.[0]), (e.target.value = ''))} />
    </>
  )

  const areaPrograma =
    modo === 'visual' ? (
      <>
        <TituloArea
          derecha={
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button type="button" className="boton-icono" title="Colapsar el programa" aria-label="Colapsar el programa" onClick={() => setPlegado('riel')}>
                «
              </button>
            </span>
          }
        >
          Programa
          {def.dxf ? <span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#51606f' }}>· {def.dxf.nombre}</span> : null}
        </TituloArea>
        {enunciado && (
          <p data-enunciado="si" style={{ margin: '0 0 6px', padding: '6px 10px', background: '#eef4fb', border: '1px solid #c9d9ee', borderRadius: 6, fontSize: '0.84rem', color: '#1c2733', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ flex: 1 }}>{enunciado}</span>
            <button onClick={() => setEnunciado(null)} aria-label="Ocultar el enunciado" title="Ocultar el enunciado" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>
              ✕
            </button>
          </p>
        )}
        {ejemploEnTarea && (
          <div className="tarea-ejemplo" data-ejemplo-tarea="si">
            <p>
              <strong>Esto es un ejemplo del contorno, no tu entrega.</strong> Curve en CONTORNO, Offset +2,5, Move en Z −5 y Toolpath. Las ranuras no están. Tu tarea sigue guardada.
            </p>
            <span>
              <button type="button" onClick={volverDelEjemplo} style={botonPrimario()} data-volver-tarea="si">
                Volver a mi tarea
              </button>
              <button type="button" onClick={seguirConElEjemplo} style={botonSecundario} data-seguir-ejemplo="si" title="Deja este contorno en tu tarea, en lugar de lo que tenías">
                Seguir con este contorno
              </button>
            </span>
          </div>
        )}
        <div className="relleno">
          <EditorNodos def={def} evaluacion={evaluacion} onCambiar={setDef} seleccion={seleccion} onSeleccionar={setSeleccion} alto="100%" guia={ejemploEnTarea ? undefined : (pasoTarea ?? undefined)} mirandoEjemplo={ejemploEnTarea} onDeshacer={deshacer} puedeDeshacer={historial.current.puedeDeshacer} />
        </div>
        {evaluacion.ciclo && <p style={{ color: '#b3261e', fontSize: '0.86rem', margin: '6px 0 0' }}>⚠ Hay un ciclo en los cables.</p>}
        <div style={{ maxHeight: 150, overflow: 'auto', flex: 'none' }}>
          <Propiedades
            key={nodoSel?.id ?? 'nada'}
            nodo={nodoSel}
            evaluacion={evaluacion}
            onParam={(clave, valor) => nodoSel && setDef({ ...def, nodos: def.nodos.map((n) => (n.id === nodoSel.id ? { ...n, params: { ...n.params, [clave]: valor } } : n)) })}
            onBorrar={() => {
              if (!nodoSel) return
              setDef({ ...def, nodos: def.nodos.filter((n) => n.id !== nodoSel.id), cables: def.cables.filter((c) => c.de !== nodoSel.id && c.a !== nodoSel.id) })
              setSeleccion(null)
            }}
            onDuplicar={() => {
              if (!nodoSel) return
              let k = 1
              while (def.nodos.some((n) => n.id === `${nodoSel.id}_${k}`)) k++
              const id = `${nodoSel.id}_${k}`
              setDef({ ...def, nodos: [...def.nodos, { ...nodoSel, id, x: nodoSel.x + 30, y: nodoSel.y + 30, params: { ...nodoSel.params } }] })
              setSeleccion(id)
            }}
            capas={dxf?.capas ?? []}
            enfocar={pasoTarea?.enfocar}
            cables={nodoSel ? def.cables.filter((c) => c.a === nodoSel.id) : []}
            onDesconectar={(c) => setDef({ ...def, cables: def.cables.filter((k) => k !== c) })}
          />
        </div>
      </>
    ) : (
      <>
      <TituloArea
        derecha={
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="boton-icono" title="Colapsar el mando" aria-label="Colapsar el mando" onClick={() => setPlegado('riel')}>
              «
            </button>
          </span>
        }
      >
        Mando manual
      </TituloArea>
      <Mando
        modelo={modeloM}
        herramienta={herrMando}
        pedestal={0}
        q={qMando}
        onQ={(q) => {
          setReproduciendo(false)
          setQMando(q)
        }}
        puntos={puntos}
        onPuntos={(p) => {
          setReproduciendo(false)
          setPuntos(p)
        }}
        onModelo={(id) => {
          setModeloMando(id)
          setQMando([0, -80, 100, 0, 60, 0])
          setPuntos([])
        }}
        reproduciendo={reproduciendo}
        onReproducir={() => {
          if (reproduciendo) return setReproduciendo(false)
          tRef.current = 0
          setReproduciendo(true)
        }}
        onExportar={exportarKRL}
      />
      </>
    )

  const abrirAnalisis = () => {
    panel.onPestana('analisis')
    panel.onAbrir(true)
  }

  const areaSimulacion = (
    <>
      <div className="relleno">
        <Suspense fallback={<p style={{ padding: 20, color: '#51606f' }}>Montando la celda…</p>}>
          <Robot3D
            vista={vista}
            onCanvas={(c) => (canvasRef.current = c)}
            grabando={grabando}
            alto="100%"
            encabezado={
              <>
                <h2 style={{ margin: 0, fontSize: '1rem' }}>Simulación 3D</h2>
                <span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#51606f' }}>{modeloVista.nombre}</span>
                {simActiva && (
                  <button
                    onClick={abrirAnalisis}
                    title="Ver el análisis de la simulación"
                    style={{ ...estadoChip, border: 'none', cursor: 'pointer', background: errores.length ? '#b3261e' : avisosSim.length ? '#a35200' : '#0e7a43' }}
                    data-analisis={errores.length ? 'error' : avisosSim.length ? 'aviso' : 'ok'}
                  >
                    {errores.length ? `${errores.length} error(es)` : avisosSim.length ? `${avisosSim.length} aviso(s)` : 'sin problemas'}
                  </button>
                )}
              </>
            }
            play={
              simActiva
                ? {
                    etiqueta: reproduciendo ? '❚❚ Pausa' : '▶ Reproducir',
                    onClick: () => {
                      if (!reproduciendo && tRef.current >= simActiva.tiempo - 1e-6) tRef.current = 0
                      setReproduciendo((r) => !r)
                    },
                    titulo: 'Recorre el programa',
                    corriendo: reproduciendo,
                  }
                : { etiqueta: '▶ Reproducir', onClick: () => {}, deshabilitado: true, titulo: 'Arma un programa para simular' }
            }
          />
        </Suspense>
      </div>
      {simActiva ? (
        <div className="reproductor-robot" data-reproductor="si">
          <input
            type="range"
            min={0}
            max={simActiva.tiempo}
            step={0.01}
            value={Math.min(tiempo, simActiva.tiempo)}
            onChange={(e) => {
              tRef.current = Number(e.target.value)
              setTick((n) => n + 1)
            }}
            style={{ flex: 1, minWidth: 140 }}
            aria-label="Tiempo de la simulación"
          />
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.78rem' }}>
            {tiempo.toFixed(1)} / {simActiva.tiempo.toFixed(1)} s
          </span>
          <select value={velocidad} onChange={(e) => setVelocidad(Number(e.target.value))} style={{ padding: '0.2rem', minHeight: 32 }} aria-label="Velocidad">
            {[0.5, 1, 2, 5, 10].map((x) => (
              <option key={x} value={x}>
                ×{x}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#51606f' }}>
          {modo === 'visual'
            ? 'Cuando el Core tenga comandos, robot y herramienta, aquí aparece el reproductor.'
            : 'Mueve los ejes de abajo, graba puntos en el mando y pulsa «Reproducir».'}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8rem', color: '#51606f' }}>
          <input type="checkbox" checked={alcance} onChange={(e) => setAlcance(e.target.checked)} /> Alcance
        </label>
      </div>
      <Ejes
        modelo={modeloVista}
        q={qVista}
        uso={simActiva?.uso ?? null}
        onQ={
          modo === 'mando'
            ? (q) => {
                setReproduciendo(false)
                setQMando(q)
              }
            : undefined
        }
      />
    </>
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
        <p style={{ margin: 0, fontSize: '0.86rem', color: '#51606f' }}>
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
          <p style={{ margin: 0, fontSize: '0.86rem', color: '#51606f' }}>
            {modo === 'visual' ? 'Todavía no hay programa: conecta comandos, robot y herramienta al Core.' : 'En el mando manual, el programa KRL de tus puntos se descarga desde Exportar.'}
          </p>
        ),
    },
    {
      id: 'ficha',
      titulo: 'Ficha técnica',
      tituloCorto: 'Ficha',
      contenido: (
        <>
          <table style={{ fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <tbody>
              {(
                [
                  ['Carga', `${modeloVista.carga} kg`],
                  ['Alcance máximo', `${modeloVista.alcance} mm`],
                  ['Repetibilidad', `± ${modeloVista.repetibilidad} mm`],
                  ['Número de ejes', '6'],
                  ['Peso', `${modeloVista.peso} kg`],
                  ['Montaje', modeloVista.montaje],
                  ['Rango de los ejes', modeloVista.limites.map((l, k) => `A${k + 1} ${l[0]}°/${l[1]}°`).join(' · ')],
                  ['Uso típico', modeloVista.descripcion],
                ] as Array<[string, string]>
              ).map(([x, y]) => (
                <tr key={x}>
                  <td style={{ padding: '3px 8px', fontWeight: 600, verticalAlign: 'top' }}>{x}</td>
                  <td style={{ padding: '3px 8px' }}>{y}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '0.78rem', color: '#5f6b78' }}>Datos de las fichas técnicas publicadas de cada modelo. Para un trabajo formal, cita la ficha oficial de KUKA.</p>
        </>
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
        <button onClick={abrirAnalisis} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: errores.length ? '#b3261e' : '#7a4f00', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
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
          clave="neumalab.robot.escena.v4"
          clase="banco--robot"
          divisionInicial={0.42}
          anchoMin={340}
          plegado={estrecha ? 'abierto' : plegado}
          onPlegado={setPlegado}
          riel={<span style={{ writingMode: 'vertical-rl', fontSize: '0.75rem', fontWeight: 700, color: '#51606f', letterSpacing: '0.04em' }}>{modo === 'visual' ? 'PROGRAMA' : 'MANDO'}</span>}
          barra={barra}
          izquierda={{ id: 'programa', titulo: modo === 'visual' ? 'Programa' : 'Mando', contenido: areaPrograma }}
          derecha={{ id: 'simulacion', titulo: 'Simulación', tituloCorto: '3D', contenido: areaSimulacion }}
          inferior={{ etiqueta: 'Plano, análisis y ficha', pestanas, estado: panel, encabezado: enTarea && pasoTarea ? <BarraEjemplo ejemplo={ejemploEnTarea} onEjemplo={verEjemploGuiado} onVolver={volverDelEjemplo} onSeguir={seguirConElEjemplo} /> : undefined }}
          estado={barraEstado}
          conCajon={entregaAbierta && enTarea && !estrecha}
        />
      ) : (
        <Suspense fallback={<p style={{ padding: 24, color: '#51606f', textAlign: 'center' }}>Abriendo Estudiar…</p>}>
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


/** Posiciones de los puntos enseñados (para marcarlos en 3D). */
const cacheMarcas = new WeakMap<PuntoEnsenado[], V3[]>()
function marcasDe(puntos: PuntoEnsenado[], modelo: ReturnType<typeof robotPorId>, h: Herramienta): V3[] {
  const c = cacheMarcas.get(puntos)
  if (c) return c
  const m = puntos.map((p) => poseDe(modelo, p.q, h.largo, 0).tcp)
  cacheMarcas.set(puntos, m)
  return m
}

const estadoChip: React.CSSProperties = { color: '#fff', borderRadius: 6, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }
/** Aviso flotante: aparece y desaparece sin mover el resto de la página. */
const avisoOk = estiloAviso
