/**
 * Unidad 4 · Robótica: programar un robot KUKA con nodos (como Grasshopper
 * + KUKA|prc) o a mano con el mando (teach-in), simularlo en 3D con análisis
 * de alcance, límites y singularidades, y exportar el código KRL. Funciona en
 * el navegador: no hace falta Windows ni licencias.
 */
import { BarraHerramientas, botonSecundario, botonTerciario, CabeceraUnidad, estiloAviso, Etiquetado, Menu } from '../components/ui'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Seccion } from '../components/Seccion'
import { exportarPng, nombreSeguro } from '../exportar'
import { croquisPieza, croquisPosicion } from './croquis'
import { Historial } from '../historial'
import EditorNodos from './EditorNodos'
import { EJEMPLOS_ROBOT } from './ejemplos'
import { cajaCurvas, leerDXF, type Curva } from './geometria'
import { planoXY, v, type Plano, type V3 } from './matematica'
import Mando, { poseDe, type PuntoEnsenado } from './Mando'
import { ejesEn, generarKRL, PLACA_DEFECTO, simular, type Simulacion } from './movimiento'
import {
  componente,
  describirDato,
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
import { Componentes, FichaTecnica, GradosLibertad, InstalarSoftware, ProgramacionParametrica, QueEsRobot, SerieVsRobotica, TiposGenerales } from './TeoriaRobotica'

const Robot3D = lazy(() => import('./Robot3D'))
const TiposRobot = lazy(() => import('./TiposRobot'))

const CLAVE = 'neumalab.robot.definicion'
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
  const [def, setDefCruda] = useState<Definicion>(leerGuardada)
  const defRef = useRef(def)
  defRef.current = def
  const historial = useRef(new Historial<Definicion>())
  const [, setHist] = useState(0)
  const setDef = useCallback((d: Definicion) => {
    historial.current.anotar(defRef.current)
    setDefCruda(d)
    setHist((n) => n + 1)
  }, [])
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
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
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

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(def))
    } catch {
      /* sin almacenamiento o definición demasiado grande */
    }
  }, [def])
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
  const sim = useMemo(() => (programa ? simular(programa, placa) : null), [programa, placa])

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

  const cargarEjemplo = (id: string) => {
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
    try {
      const texto = await f.text()
      const d = leerDXF(texto)
      if (!d.curvas.length) throw new Error(d.avisos[0] ?? 'El DXF no tiene curvas.')
      const tieneCurva = def.nodos.some((n) => n.tipo === 'curvaDXF')
      setDef({ ...def, dxf: { nombre: f.name, texto } })
      setAviso(
        `Plano «${f.name}» abierto: ${d.curvas.length} curvas en ${d.capas.length} capa(s) (${d.capas.join(', ')}), unidades ${d.unidades}.` +
          (tieneCurva ? '' : ' Agrega un componente Curve (Crv) de la pestaña Params para usarlas.') +
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
      setDef(d)
      setSeleccion(null)
      setAviso(`Definición «${f.name}» abierta.`)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo abrir el archivo.')
    }
  }

  const exportarCroquis = async (cual: string) => {
    const [tipo, formato] = cual.split('-')
    const nombre = def.nombre || 'robot'
    let svg: string
    if (tipo === 'pieza') {
      const curvas = dxf?.curvas.length
        ? dxf.curvas.map((c) => ({ pts: c.pts, cerrada: c.cerrada }))
        : previa.curvas.map((pts) => ({ pts, cerrada: pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-3 }))
      if (!curvas.length) return setAviso('No hay geometría para el croquis: abre un DXF o arma curvas en la definición.')
      svg = croquisPieza(curvas, nombre)
    } else {
      svg = croquisPosicion(
        { modelo: robotVista.modelo, pedestal: robotVista.pedestal, base: baseVista, espesor: programa?.espesor ?? 5, placa: placa ?? PLACA_DEFECTO, herramienta: herrVista },
        nombre,
      )
    }
    const archivo = nombreSeguro(`${nombre}-${tipo === 'pieza' ? 'croquis-pieza' : 'posicionamiento'}`, formato)
    if (formato === 'svg') return descargar(svg, archivo, 'image/svg+xml')
    const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement as unknown as SVGSVGElement
    try {
      await exportarPng(el, archivo)
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
      a.download = nombreSeguro(`${def.nombre || 'robot'}_simulacion`, ext)
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
  const errores = simActiva?.problemas.filter((p) => p.nivel === 'error') ?? []
  const avisosSim = simActiva?.problemas.filter((p) => p.nivel === 'aviso') ?? []
  const modeloVista = modo === 'visual' ? robotVista.modelo : modeloM
  const qVista = vista.current.q

  return (
    <main style={{ maxWidth: 1320, margin: '0 auto', padding: '0.8rem clamp(0.75rem, 3vw, 1.5rem) 1.25rem' }}>
      <CabeceraUnidad titulo="Unidad 4 · Robótica" descripcion="Programa un robot KUKA con nodos (como Grasshopper + KUKA|prc) o con el mando, y simúlalo en 3D" />

      <BarraHerramientas
        derecha={
          <>
            {grabando && (
              <button onClick={alternarGrabacion} style={{ ...botonSecundario, color: '#fff', background: '#c62828', borderColor: '#c62828' }}>
                ■ Detener grabación
              </button>
            )}
            {modo === 'visual' && (
              <Menu
                etiqueta="Archivo"
                items={[
                  { texto: 'Nueva definición', ayuda: 'Empieza con el lienzo vacío', onClick: () => cargarEjemplo('vacio') },
                  { texto: 'Abrir definición…', ayuda: 'Una definición guardada (.json), con su plano', onClick: () => inputDef.current?.click() },
                  { texto: 'Guardar definición', ayuda: 'Descarga la definición y el plano DXF', onClick: () => descargar(JSON.stringify(def, null, 2), nombreSeguro(def.nombre || 'definicion', 'json'), 'application/json') },
                  { texto: 'Abrir plano DXF…', ayuda: 'Trae las curvas de tu plano', onClick: () => inputDXF.current?.click(), separar: true },
                ]}
              />
            )}
            <Menu
              etiqueta="Exportar"
              ancho={300}
              items={[
                { texto: 'Programa KRL (.src)', ayuda: 'Para el controlador KUKA', onClick: exportarKRL },
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
              ]}
            />
          </>
        }
      >
        <span role="tablist" aria-label="Forma de programar" style={{ display: 'inline-flex', border: '1px solid #c6ced6', borderRadius: 9, padding: 2, background: '#fff' }}>
          {(
            [
              ['visual', 'Programación visual'],
              ['mando', 'Mando manual'],
            ] as Array<[Modo, string]>
          ).map(([m, t]) => (
            <button
              key={m}
              role="tab"
              aria-selected={modo === m}
              onClick={() => {
                setReproduciendo(false)
                setModo(m)
              }}
              data-modo={m}
              title={m === 'mando' ? 'Mover el robot a mano y grabar puntos (teach-in)' : 'Armar el programa con nodos, como Grasshopper + KUKA|prc'}
              style={{ border: 'none', borderRadius: 7, padding: '0.4rem 0.8rem', minHeight: 34, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', background: modo === m ? '#33475c' : 'transparent', color: modo === m ? '#fff' : '#33475c' }}
            >
              {t}
            </button>
          ))}
        </span>
        {modo === 'visual' && (
          <>
            <Etiquetado texto="Ejemplos">
              <select
                value=""
                onChange={(e) => {
                  const x = e.target.value
                  e.target.value = ''
                  cargarEjemplo(x)
                }}
                style={{ padding: '0.35rem 0.4rem', minHeight: 36, maxWidth: 'min(320px, calc(100vw - 120px))' }}
                data-ejemplos-robot="si"
              >
                <option value="">— elige una definición —</option>
                {EJEMPLOS_ROBOT.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.titulo}
                  </option>
                ))}
              </select>
            </Etiquetado>
            <button onClick={() => inputDXF.current?.click()} style={botonSecundario} title="Traer un plano DXF para usar sus curvas">
              Abrir DXF
            </button>
            <span style={{ display: 'flex', gap: 2 }}>
              <button onClick={deshacer} disabled={!historial.current.puedeDeshacer} aria-label="Deshacer" style={{ ...botonTerciario, opacity: historial.current.puedeDeshacer ? 1 : 0.4 }} title="Deshacer (Ctrl+Z)">
                ↶ Deshacer
              </button>
              <button onClick={rehacer} disabled={!historial.current.puedeRehacer} aria-label="Rehacer" style={{ ...botonTerciario, opacity: historial.current.puedeRehacer ? 1 : 0.4 }} title="Rehacer (Ctrl+Shift+Z)">
                ↷
              </button>
            </span>
          </>
        )}
      </BarraHerramientas>
      <div>
        <input ref={inputDXF} type="file" accept=".dxf" style={{ display: 'none' }} onChange={(e) => (void abrirDXF(e.target.files?.[0]), (e.target.value = ''))} />
        <input ref={inputDef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => (void abrirDef(e.target.files?.[0]), (e.target.value = ''))} />
      </div>

      {aviso && (
        <p role="status" style={avisoOk}>
          {aviso}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 560px), 1fr))', gap: 14, alignItems: 'start' }}>
        <section style={tarjeta}>
          {modo === 'visual' ? (
            <>
              <h2 style={subtitulo}>
                Definición · {def.nombre}
                {def.dxf ? <span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#5a6b7d' }}> · plano: {def.dxf.nombre}</span> : null}
              </h2>
              <EditorNodos def={def} evaluacion={evaluacion} onCambiar={setDef} seleccion={seleccion} onSeleccionar={setSeleccion} />
              {evaluacion.ciclo && <p style={{ color: '#c62828', fontSize: '0.86rem' }}>⚠ Hay un ciclo en los cables.</p>}
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
                cables={nodoSel ? def.cables.filter((c) => c.a === nodoSel.id) : []}
                onDesconectar={(c) => setDef({ ...def, cables: def.cables.filter((k) => k !== c) })}
              />
            </>
          ) : (
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
          )}
        </section>

        <section style={tarjeta}>
          <h2 style={subtitulo}>
            Simulación · {modeloVista.nombre}
            {simActiva && (
              <span style={{ ...estadoChip, background: errores.length ? '#c62828' : avisosSim.length ? '#e08a00' : '#12a35a' }} data-analisis={errores.length ? 'error' : avisosSim.length ? 'aviso' : 'ok'}>
                {errores.length ? `${errores.length} error(es)` : avisosSim.length ? `${avisosSim.length} aviso(s)` : 'sin problemas'}
              </span>
            )}
          </h2>
          <Suspense fallback={<p style={{ padding: 20, color: '#5a6b7d' }}>Montando la celda…</p>}>
            <Robot3D vista={vista} onCanvas={(c) => (canvasRef.current = c)} />
          </Suspense>
          {simActiva ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }} data-reproductor="si">
              <button
                onClick={() => {
                  if (!reproduciendo && tRef.current >= simActiva.tiempo - 1e-6) tRef.current = 0
                  setReproduciendo((r) => !r)
                }}
                style={{ ...boton, background: reproduciendo ? '#ffa726' : '#12a35a' }}
                data-play="si"
              >
                {reproduciendo ? '❚❚' : '▶'}
              </button>
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
                style={{ flex: 1, minWidth: 160 }}
                aria-label="Tiempo de la simulación"
              />
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.85rem' }}>
                {tiempo.toFixed(1)} / {simActiva.tiempo.toFixed(1)} s
              </span>
              <select value={velocidad} onChange={(e) => setVelocidad(Number(e.target.value))} style={{ padding: '0.2rem' }} aria-label="Velocidad">
                {[0.5, 1, 2, 5, 10].map((x) => (
                  <option key={x} value={x}>
                    ×{x}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: '0.84rem', color: '#5a6b7d' }}>
              {modo === 'visual'
                ? 'Cuando el Core tenga comandos, robot y herramienta, aquí aparece el reproductor (como KUKA|play).'
                : 'Mueve el robot con el mando; graba puntos y pulsa «Reproducir».'}
            </p>
          )}
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.84rem', marginTop: 6 }}>
            <input type="checkbox" checked={alcance} onChange={(e) => setAlcance(e.target.checked)} /> Mostrar el alcance máximo del robot
          </label>
          <Ejes modelo={modeloVista} q={qVista} uso={simActiva?.uso ?? null} />
          {simActiva && (
            <Analisis
              sim={simActiva}
              onIr={(p) => {
                tRef.current = p.t
                if (p.nodo && modo === 'visual') setSeleccion(p.nodo)
                setTick((n) => n + 1)
              }}
            />
          )}
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#33475c' }}>Ficha técnica · {modeloVista.nombre}</summary>
            <table style={{ fontSize: '0.85rem', marginTop: 6, borderCollapse: 'collapse' }}>
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
                ).map(([a, b]) => (
                  <tr key={a}>
                    <td style={{ padding: '3px 8px', fontWeight: 600, verticalAlign: 'top' }}>{a}</td>
                    <td style={{ padding: '3px 8px' }}>{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: '0.78rem', color: '#5f6b78' }}>Datos de las fichas técnicas publicadas de cada modelo. Para un trabajo formal, cita la ficha oficial de KUKA.</p>
          </details>
          {modo === 'visual' && sim && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#33475c' }}>Código KRL generado ({sim.krl.split('\n').length} líneas)</summary>
              <pre style={{ maxHeight: 260, overflow: 'auto', background: '#1f2328', color: '#e8eaed', padding: 10, borderRadius: 8, fontSize: '0.78rem' }} data-krl="si">
                {sim.krl}
              </pre>
            </details>
          )}
        </section>
      </div>

      <section style={{ ...tarjeta, marginTop: 14 }}>
        <Seccion titulo="Tipos de robots de base fija (en 3D)">
          <Suspense fallback={<p>Cargando…</p>}>
            <TiposRobot />
          </Suspense>
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="¿Qué es un robot industrial?">
          <QueEsRobot />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Fabricación en serie y robótica industrial">
          <SerieVsRobotica />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Tipos de robots">
          <TiposGenerales />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Componentes de un robot de base fija">
          <Componentes />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Grados de libertad y singularidades">
          <GradosLibertad />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Ficha técnica: cómo elegir el robot">
          <FichaTecnica />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Programación paramétrica: Rhino, Grasshopper y KUKA|prc">
          <ProgramacionParametrica />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Instalar el software del curso (sin crackear)">
          <InstalarSoftware />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Cómo usar esta unidad">
          <ComoUsar />
        </Seccion>
      </section>
    </main>
  )
}

/** Posiciones de los puntos enseñados (para marcarlos en 3D). */
const cacheMarcas = new WeakMap<PuntoEnsenado[], V3[]>()
function marcasDe(puntos: PuntoEnsenado[], modelo: ReturnType<typeof robotPorId>, h: Herramienta): V3[] {
  const c = cacheMarcas.get(puntos)
  if (c) return c
  const m = puntos.map((p) => poseDe(modelo, p.q, h.largo, 0).tcp)
  cacheMarcas.set(puntos, m)
  return m
}

function Propiedades({
  nodo,
  evaluacion,
  onParam,
  onBorrar,
  onDuplicar,
  capas,
  cables = [],
  onDesconectar,
}: {
  nodo: Definicion['nodos'][number] | null
  evaluacion: ReturnType<typeof evaluar>
  onParam: (clave: string, valor: number | string | boolean) => void
  onBorrar: () => void
  onDuplicar: () => void
  capas: string[]
  /** Cables que llegan a este componente. */
  cables?: Definicion['cables']
  onDesconectar?: (c: Definicion['cables'][number]) => void
}) {
  if (!nodo)
    return (
      <p style={{ margin: '8px 0 0', fontSize: '0.84rem', color: '#5a6b7d' }} data-propiedades="vacio">
        Selecciona un componente para ver qué hace, sus entradas y salidas y ajustar sus valores. Arrastra desde una salida (derecha) hasta una entrada (izquierda) para conectar. Con dos dedos (o con − y +) acercas y alejas el lienzo.
      </p>
    )
  const comp = componente(nodo.tipo)
  if (!comp) return null
  const ev = evaluacion.nodos[nodo.id]
  const params = { ...paramsIniciales(comp), ...nodo.params }
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #e0e5eb', paddingTop: 8 }} data-propiedades={nodo.tipo}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong style={{ color: '#33475c' }}>
          {comp.nombre} ({comp.corto})
        </strong>
        <span style={{ fontSize: '0.78rem', color: '#5f6b78' }}>
          {comp.pestana} › {comp.grupo}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button onClick={onDuplicar} style={botonSuave}>
            Duplicar
          </button>
          <button onClick={onBorrar} style={{ ...botonSuave, color: '#c62828', borderColor: '#e0a0a0' }}>
            Eliminar
          </button>
        </span>
      </div>
      <p style={{ margin: '4px 0 6px', fontSize: '0.86rem', lineHeight: 1.45 }}>{comp.descripcion}</p>
      {ev?.mensajes.map((m, i) => (
        <p key={i} style={{ margin: '2px 0', fontSize: '0.84rem', color: ev.estado === 'error' ? '#c62828' : '#8a5b00' }}>
          {ev.estado === 'error' ? '✕' : '⚠'} {m}
        </p>
      ))}
      {comp.params.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '6px 0' }}>
          {comp.params.filter((p) => !p.si || p.si(params)).map((p) => {
            const valor = params[p.clave]
            return (
              <label key={p.clave} style={{ ...rotulo, flexDirection: p.tipo === 'bool' ? 'row' : 'column', alignItems: p.tipo === 'bool' ? 'center' : 'flex-start', gap: 2 }}>
                {p.tipo !== 'bool' && <span>{p.etiqueta}</span>}
                {p.tipo === 'numero' && (
                  <input
                    type="number"
                    value={Number(valor)}
                    step={p.paso ?? 'any'}
                    onChange={(e) => {
                      const x = Number(e.target.value)
                      if (Number.isFinite(x)) onParam(p.clave, x)
                    }}
                    style={{ width: 100, padding: '3px 6px', border: '1px solid #c6ced6', borderRadius: 6 }}
                  />
                )}
                {p.tipo === 'texto' &&
                  (p.clave === 'capa' && capas.length ? (
                    <select value={String(valor)} onChange={(e) => onParam(p.clave, e.target.value)} style={{ padding: '3px 4px' }}>
                      <option value="">Todas las capas</option>
                      {capas.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={String(valor)} onChange={(e) => onParam(p.clave, e.target.value)} style={{ width: 180, padding: '3px 6px', border: '1px solid #c6ced6', borderRadius: 6 }} />
                  ))}
                {p.tipo === 'opcion' && (
                  <select value={String(valor)} onChange={(e) => onParam(p.clave, e.target.value)} style={{ padding: '3px 4px', maxWidth: 260 }}>
                    {p.opciones?.map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
                {p.tipo === 'bool' && (
                  <>
                    <input type="checkbox" checked={valor !== false} onChange={(e) => onParam(p.clave, e.target.checked)} /> {p.etiqueta}
                  </>
                )}
              </label>
            )
          })}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, fontSize: '0.8rem' }}>
        {comp.entradas.length > 0 && (
          <div>
            <strong>Entradas</strong>
            <ul style={{ margin: '2px 0', paddingLeft: 16 }}>
              {comp.entradas.map((e, i) => {
                const llegan = cables.filter((c) => c.entrada === i)
                return (
                  <li key={e.corto}>
                    <code>{e.corto}</code> {e.nombre}: {e.descripcion}
                    {llegan.map((c) => (
                      <span key={`${c.de}-${c.salida}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
                        <span style={{ color: '#51606f' }}>← {c.de}</span>
                        {onDesconectar && (
                          <button onClick={() => onDesconectar(c)} style={{ ...botonSuave, padding: '1px 8px', fontSize: '0.76rem', minHeight: 28 }} title="Quitar este cable">
                            Desconectar
                          </button>
                        )}
                      </span>
                    ))}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {comp.salidas.length > 0 && (
          <div>
            <strong>Salidas</strong>
            <ul style={{ margin: '2px 0', paddingLeft: 16 }}>
              {comp.salidas.map((s, j) => {
                const datos = ev?.salidas[j] ?? []
                return (
                  <li key={s.corto}>
                    <code>{s.corto}</code> {s.nombre}: {datos.length} elemento(s)
                    {datos.length > 0 && <span style={{ color: '#5a6b7d' }}> — {datos.slice(0, 2).map(describirDato).join('; ')}{datos.length > 2 ? '…' : ''}</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function Ejes({ modelo, q, uso }: { modelo: ReturnType<typeof robotPorId>; q: number[]; uso: Array<[number, number]> | null }) {
  return (
    <div style={{ marginTop: 8 }} data-ejes="si">
      {q.map((x, k) => {
        const [lo, hi] = modelo.limites[k]
        const pos = (y: number) => `${((y - lo) / (hi - lo)) * 100}%`
        const cerca = x < lo + 5 || x > hi - 5
        return (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 70px', gap: 6, alignItems: 'center', fontSize: '0.8rem', marginBottom: 2 }}>
            <strong>A{k + 1}</strong>
            <div style={{ position: 'relative', height: 12, background: '#eef1f4', borderRadius: 6 }} title={`Rango ${lo}° a ${hi}°`}>
              {uso && <div style={{ position: 'absolute', left: pos(uso[k][0]), width: `calc(${pos(uso[k][1])} - ${pos(uso[k][0])})`, top: 2, bottom: 2, background: '#b9d3ef', borderRadius: 4 }} />}
              <div style={{ position: 'absolute', left: pos(x), top: -2, width: 3, height: 16, marginLeft: -1, background: cerca ? '#c62828' : '#33475c', borderRadius: 2 }} />
            </div>
            <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', textAlign: 'right', color: cerca ? '#c62828' : undefined }}>{x.toFixed(1)}°</span>
          </div>
        )
      })}
      <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#5f6b78' }}>Cada barra es el rango del eje; en azul, lo que usa el programa; la marca, la posición actual (roja cerca del límite).</p>
    </div>
  )
}

function Analisis({ sim, onIr }: { sim: Simulacion; onIr: (p: Simulacion['problemas'][number]) => void }) {
  return (
    <div style={{ marginTop: 8 }} data-lista-analisis="si">
      <p style={{ margin: '0 0 4px', fontSize: '0.84rem', color: '#33475c' }}>
        <strong>Análisis:</strong> {sim.muestras.length} posiciones calculadas · recorrido lineal {Math.round(sim.largoCorte)} mm · tiempo {sim.tiempo.toFixed(1)} s
      </p>
      {sim.problemas.length === 0 && <p style={{ margin: 0, fontSize: '0.84rem', color: '#0a6b3c' }}>✓ El robot alcanza todos los puntos sin salirse de sus límites.</p>}
      {sim.problemas.slice(0, 12).map((p, i) => (
        <p key={i} style={{ margin: '2px 0', fontSize: '0.84rem', color: p.nivel === 'error' ? '#c62828' : '#8a5b00', cursor: 'pointer' }} onClick={() => onIr(p)} title="Ir a ese momento">
          {p.nivel === 'error' ? '✕' : '⚠'} {p.t.toFixed(1)} s · {p.texto}
        </p>
      ))}
      {sim.problemas.length > 12 && <p style={{ margin: 0, fontSize: '0.8rem', color: '#5a6b7d' }}>… y {sim.problemas.length - 12} más.</p>}
    </div>
  )
}

function ComoUsar() {
  const li: React.CSSProperties = { marginBottom: 4 }
  return (
    <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55 }}>
      <li style={li}>
        <strong>Programación visual:</strong> agrega componentes desde las pestañas (Params, Curve, Vector, Sets, KUKA|prc) o con
        doble clic en el fondo del lienzo, y conéctalos arrastrando de una salida a una entrada. Todo se recalcula al instante.
      </li>
      <li style={li}>
        <strong>Plano DXF:</strong> «Abrir DXF» trae las curvas de tu plano (líneas, arcos, círculos, polilíneas); el componente
        Curve (Crv) las entrega, filtradas por capa si quieres. El ejemplo 3 trae un plano de práctica.
      </li>
      <li style={li}>
        <strong>La base:</strong> en el Core defines dónde está la pieza respecto del robot (X, Y y la altura del mesón). La
        herramienta apunta en contra de la Z de cada plano: con planos XY, baja vertical sobre la pieza.
      </li>
      <li style={li}>
        <strong>Simular y analizar:</strong> ▶ recorre el programa (como KUKA|play). La trayectoria se pinta verde si todo va
        bien, naranjo si hay avisos (cerca de un límite o de una singularidad) y roja si hay errores (fuera de alcance, fuera
        del rango de un eje, saltos bruscos, choques del brazo o la herramienta con el mesón o la plancha). Haz clic en un
        problema para ir a ese momento.
      </li>
      <li style={li}>
        <strong>Entregar:</strong> «Exportar KRL» descarga el programa .src; «Guardar definición» guarda tu definición (con el
        plano); «● Grabar video» graba la simulación; «Croquis…» descarga la pieza acotada y el posicionamiento del robot
        (planta y elevación) para el informe; la ficha técnica del robot está bajo la vista 3D.
      </li>
      <li style={li}>
        <strong>Mando manual:</strong> mueve el robot eje por eje o en X/Y/Z, graba puntos PTP o LIN y reprodúcelos: es el
        teach-in/playback.
      </li>
      <li style={li}>
        <strong>Otro robot:</strong> en el componente Robot elige «Personalizado» y escribe las medidas de sus eslabones (d1,
        a1, a2, a3, d4, d6) sacadas de su ficha; los rangos y velocidades se toman del modelo parecido que elijas.
      </li>
      <li style={li}>
        <strong>Diferencias con KUKA|prc:</strong> los robots tienen los rangos y velocidades de sus fichas y una geometría muy parecida a la real;
        no se abren archivos .gh de Grasshopper (se arma la definición aquí, con los mismos componentes) y el código KRL es
        de estudio: revísalo antes de usarlo en un robot real.
      </li>
    </ol>
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
const subtitulo: React.CSSProperties = { margin: '0 0 0.6rem', fontSize: '1.05rem', color: '#33475c', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }
const boton: React.CSSProperties = { border: 'none', color: '#fff', padding: '0.4rem 0.9rem', borderRadius: 8, fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }
const botonSuave: React.CSSProperties = { border: '1px solid #c6ced6', background: '#fff', color: '#33475c', padding: '0.35rem 0.75rem', borderRadius: 7, fontSize: '0.85rem', cursor: 'pointer' }
const rotulo: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#5a6b7d' }
const estadoChip: React.CSSProperties = { color: '#fff', borderRadius: 6, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }
/** Aviso flotante: aparece y desaparece sin mover el resto de la página. */
const avisoOk = estiloAviso
