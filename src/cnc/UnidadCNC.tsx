/**
 * Unidad 3 · CNC: escribir un programa en código G y simular el mecanizado
 * en un centro de torneado o en una fresadora, en 3D, como en CNC Simulator
 * Pro: preparación de la máquina (material, bruto, herramientas), ejecución
 * continua o bloque a bloque, alarmas de la máquina, trayectoria en 2D con
 * sus coordenadas, explicación de cada bloque y exportación del .cnc y del
 * video de la simulación.
 */
import { acercar, botonPrimario, botonSecundario, estiloAviso, Etiquetado, Menu, useEsEstrecha, useTactil } from '../components/ui'
import BancoDividido, { TituloArea } from '../components/banco/BancoDividido'
import { usePanelAcoplado, type PestanaPanel } from '../components/banco/PanelAcoplado'
import PaginaEstudiar, { type SeccionEstudio } from '../components/banco/PaginaEstudiar'
import SubnavUnidad, { useSeccionUnidad } from '../components/banco/SubnavUnidad'
import CajonEntregar from '../components/banco/CajonEntregar'
import MisTrabajos from '../components/banco/MisTrabajos'
import Autoevaluacion from '../components/Autoevaluacion'
import FichaCNC from './FichaCNC'
import { PREGUNTAS_CNC } from './preguntasCNC'
import { copiarTabla, copiarTexto, descargarTexto, enlaceTrabajo, limpiarEnlace, trabajoDelEnlace } from '../entregar'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { exportarPng, nombreSeguro } from '../exportar'
import EditorGcode, { type EditorGcodeRef } from './EditorGcode'
import { EJEMPLOS_CNC, programaNuevo } from './ejemplos'
import { explicarBloque, interpretar, type ResultadoGcode } from './gcode'
import {
  almacenDe,
  COLORES_HERRAMIENTA,
  CONFIG_INICIAL,
  fijarHerramientas,
  MATERIALES,
  torretaDe,
  type FormaFresa,
  type FormaTorno,
  type HerramientaFresa,
  type HerramientaTorno,
  material as materialDe,
  nombreHerramienta,
  origenPrograma,
  posicionCasa,
  type OrigenTorno,
  type ConfigCNC,
  type TipoMaquina,
} from './maquinas'
import Plano2D, { textoPunto } from './Plano2D'
import { SimuladorCNC, volumenPieza } from './simulador'
import type { VistaCNC } from './Maquina3D'
import { Arcos, CodigosGM, Coordenadas, EstructuraBloque, Insertos, OrganizarPrograma, QueEsCNC, Torno, VentajasCNC } from './TeoriaCNC'

const Maquina3D = lazy(() => import('./Maquina3D'))

const CLAVE = 'neumalab.cnc'

type Estado = 'listo' | 'corriendo' | 'bloque' | 'pausa' | 'parada' | 'alarma' | 'fin'

interface Guardado {
  config: ConfigCNC
  codigos: Record<TipoMaquina, string>
  nombres: Record<TipoMaquina, string>
}

function leerGuardado(): Guardado {
  const base: Guardado = {
    config: CONFIG_INICIAL,
    codigos: { torno: EJEMPLOS_CNC[0].codigo, fresadora: EJEMPLOS_CNC.find((e) => e.maquina === 'fresadora')!.codigo },
    nombres: { torno: EJEMPLOS_CNC[0].titulo, fresadora: EJEMPLOS_CNC.find((e) => e.maquina === 'fresadora')!.titulo },
  }
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (crudo) {
      const g = JSON.parse(crudo) as Partial<Guardado>
      if (g.config && g.codigos && typeof g.codigos.torno === 'string' && typeof g.codigos.fresadora === 'string') {
        return {
          config: { ...CONFIG_INICIAL, ...g.config, torno: { ...CONFIG_INICIAL.torno, ...g.config.torno }, fresa: { ...CONFIG_INICIAL.fresa, ...g.config.fresa } },
          codigos: g.codigos as Guardado['codigos'],
          nombres: { ...base.nombres, ...(g.nombres ?? {}) },
        }
      }
    }
  } catch {
    /* sin almacenamiento o dato roto */
  }
  return base
}

const VELOCIDADES = [0.5, 1, 2, 5, 10, 25, 60]

export default function UnidadCNC() {
  const tactil = useTactil()
  const estrecha = useEsEstrecha()
  const [seccion, setSeccion] = useSeccionUnidad(SECCIONES_CNC.map((x) => x.id))
  const panel = usePanelAcoplado<PestanaCNC>('neumalab.cnc.panel', 'preparacion', typeof window !== 'undefined' && window.innerHeight >= 860)
  const [entregaAbierta, setEntregaAbierta] = useState(false)
  const [misTrabajos, setMisTrabajos] = useState(false)
  /** Nombre del próximo video (desde «Entregar» se nombra como pide el enunciado). */
  const nombreVideo = useRef<string | null>(null)
  const inicial = useMemo(leerGuardado, [])
  const [config, setConfig] = useState<ConfigCNC>(inicial.config)
  const [codigos, setCodigos] = useState(inicial.codigos)
  const [nombres, setNombres] = useState(inicial.nombres)
  const maquina = config.maquina
  const codigo = codigos[maquina]
  const setCodigo = (c: string) => setCodigos((x) => ({ ...x, [maquina]: c }))
  const [estado, setEstado] = useState<Estado>('listo')
  const [velocidad, setVelocidad] = useState(5)
  const [trayectoria, setTrayectoria] = useState(true)
  const [corte, setCorte] = useState(false)
  const [sonido, setSonido] = useState(false)
  const [cursor, setCursor] = useState<number | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [, setTick] = useState(0)
  const [grabando, setGrabando] = useState(false)
  const editor = useRef<EditorGcodeRef>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const grabadora = useRef<MediaRecorder | null>(null)

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

  // Guardado automático.
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ config, codigos, nombres }))
    } catch {
      /* sin almacenamiento */
    }
  }, [config, codigos, nombres])

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

  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(id)
  }, [aviso])

  // Bucle de la simulación.
  const velRef = useRef(velocidad)
  velRef.current = velocidad
  useEffect(() => {
    if (estado !== 'corriendo' && estado !== 'bloque') return
    let vivo = true
    let antes = performance.now()
    let ultimoPintado = 0
    const bucle = () => {
      if (!vivo) return
      const ahora = performance.now()
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      const r = vista.current.sim.avanzar(dt * velRef.current, estado === 'bloque')
      if (r === 'sigue') {
        if (ahora - ultimoPintado > 90) {
          ultimoPintado = ahora
          setTick((t) => t + 1)
        }
        requestAnimationFrame(bucle)
        return
      }
      setEstado(r === 'fin-bloque' ? 'pausa' : r === 'parada' ? 'parada' : r === 'alarma' ? 'alarma' : 'fin')
      setTick((t) => t + 1)
    }
    requestAnimationFrame(bucle)
    return () => {
      vivo = false
    }
  }, [estado])

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
    if (!ej) return
    const actual = codigos[ej.maquina]
    const sinCambios = EJEMPLOS_CNC.some((e) => e.codigo === actual) || actual === programaNuevo(ej.maquina) || !actual.trim()
    if (!sinCambios && !window.confirm(`¿Cargar «${ej.titulo}»? Se reemplaza tu programa de ${ej.maquina === 'torno' ? 'torno' : 'fresadora'}.`)) return
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
  }

  const nuevo = () => {
    const sinCambios = EJEMPLOS_CNC.some((e) => e.codigo === codigo) || codigo === programaNuevo(maquina) || !codigo.trim()
    if (!sinCambios && !window.confirm('¿Empezar un programa nuevo? Se reemplaza el programa del editor.')) return
    setCodigo(programaNuevo(maquina))
    setNombres((x) => ({ ...x, [maquina]: 'Mi programa' }))
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

  const abrir = async (archivo: File | undefined) => {
    if (!archivo) return
    try {
      const texto = await archivo.text()
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

  const puedeGrabar = typeof window !== 'undefined' && 'MediaRecorder' in window
  const alternarGrabacion = () => {
    if (grabando) {
      grabadora.current?.stop()
      return
    }
    const c = canvasRef.current
    if (!c || !puedeGrabar) {
      setAviso('Este navegador no permite grabar video de la vista 3D.')
      return
    }
    const flujo = c.captureStream(30)
    const tipo = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t))
    const rec = new MediaRecorder(flujo, tipo ? { mimeType: tipo, videoBitsPerSecond: 6_000_000 } : undefined)
    const partes: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data)
    rec.onstop = () => {
      setGrabando(false)
      const ext = (rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(partes, { type: rec.mimeType || 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nombreVideo.current ? `${nombreVideo.current}.${ext}` : nombreSeguro(`${nombres[maquina] || 'simulacion'}_simulacion`, ext)
      nombreVideo.current = null
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setAviso(`Video descargado: ${a.download}`)
    }
    rec.start(500)
    grabadora.current = rec
    setGrabando(true)
    setAviso('Grabando la vista 3D. Pulsa ▶ Ciclo para mecanizar y «■ Detener grabación» al terminar.')
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

  const selectorMaquina = (
    <select value={maquina} onChange={(e) => cambiarMaquina(e.target.value as TipoMaquina)} style={{ ...selector, minHeight: 36, width: estrecha ? '100%' : 196 }} data-selector-maquina="si" aria-label="Máquina">
      <option value="torno">Centro de torneado (torno)</option>
      <option value="fresadora">Fresadora de 3 ejes</option>
    </select>
  )
  const itemsArchivo = [
    { texto: 'Nuevo programa', ayuda: 'Un programa en blanco para esta máquina', onClick: nuevo },
    { texto: 'Abrir…', ayuda: '.cnc, .nc, .gcode o .txt (también de CNC Simulator Pro)', onClick: () => inputArchivo.current?.click() },
    { texto: 'Guardar .cnc', ayuda: 'El archivo de texto que se entrega', onClick: guardarCnc },
    { texto: 'Mis trabajos…', ayuda: 'Guarda varios programas con nombre (con su preparación)', onClick: () => setMisTrabajos(true), separar: true },
  ]
  const itemsExportar = [
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
    <>
      {estado === 'corriendo' ? (
        <button onClick={() => setEstado('pausa')} style={{ ...botonPrimario(false, '#ffa726'), color: '#1c2733' }} data-control="pausa">
          ❚❚ Pausa
        </button>
      ) : (
        <button
          onClick={() => correr('corriendo')}
          disabled={!resultado.pasos.length}
          title={hayErrores ? 'Hay errores: la máquina corre hasta la línea anterior al primer error' : 'Ejecuta el programa completo'}
          style={{ ...botonPrimario(), opacity: resultado.pasos.length ? 1 : 0.5 }}
          data-control="ciclo"
        >
          {estado === 'parada' ? '▶ Continuar' : '▶ Ciclo'}
        </button>
      )}
      <span className="grupo-zoom" role="group" aria-label="Avance del programa">
        <button onClick={atras} disabled={estado === 'corriendo' || estado === 'listo'} style={{ opacity: estado === 'corriendo' || estado === 'listo' ? 0.4 : 1 }} title="Bloque anterior: vuelve una línea" aria-label="Bloque anterior" data-control="atras">
          {'⏮\uFE0E'}
        </button>
        <button onClick={() => correr('bloque')} disabled={!resultado.pasos.length || estado === 'corriendo'} style={{ opacity: !resultado.pasos.length || estado === 'corriendo' ? 0.4 : 1 }} title="Bloque a bloque: ejecuta una línea y se detiene" aria-label="Bloque a bloque" data-control="bloque">
          {'⏭\uFE0E'}
        </button>
        <button onClick={alFinal} disabled={!resultado.pasos.length} title="Al final: mecaniza todo de una vez" aria-label="Al final" data-control="final">
          {'⏩\uFE0E'}
        </button>
        <button onClick={reiniciar} title="Reiniciar: vuelve al inicio con el bruto entero" aria-label="Reiniciar" data-control="reiniciar">
          {'⟲\uFE0E'}
        </button>
      </span>
      <label style={{ ...rotulo }} title="Velocidad de la simulación">
        {!estrecha && 'Velocidad'}
        <select value={velocidad} onChange={(e) => setVelocidad(Number(e.target.value))} style={{ ...selector, minHeight: 36 }} aria-label="Velocidad">
          {VELOCIDADES.map((v) => (
            <option key={v} value={v}>
              ×{v}
            </option>
          ))}
        </select>
      </label>
      {!estrecha && <Etiquetado texto="Máquina">{selectorMaquina}</Etiquetado>}
      <select
        value=""
        onChange={(e) => {
          const v = e.target.value
          e.target.value = ''
          cargarEjemplo(v)
        }}
        style={{ ...selector, minHeight: 36, width: estrecha ? '30vw' : 200 }}
        data-ejemplos-cnc="si"
        aria-label="Ejemplos"
      >
        <option value="">Ejemplos…</option>
        <optgroup label="Centro de torneado">
          {EJEMPLOS_CNC.filter((e) => e.maquina === 'torno').map((e) => (
            <option key={e.id} value={e.id}>
              {e.titulo}
            </option>
          ))}
        </optgroup>
        <optgroup label="Fresadora">
          {EJEMPLOS_CNC.filter((e) => e.maquina === 'fresadora').map((e) => (
            <option key={e.id} value={e.id}>
              {e.titulo}
            </option>
          ))}
        </optgroup>
      </select>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        {grabando && (
          <button onClick={alternarGrabacion} style={{ ...botonSecundario, color: '#fff', background: '#c62828', borderColor: '#c62828' }}>
            ■ {estrecha ? 'Detener' : 'Detener grabación'}
          </button>
        )}
        {estrecha ? (
          <Menu etiqueta="⋯" datos="mas" items={[...itemsArchivo, ...itemsExportar.map((it, i) => (i === 0 ? { ...it, separar: true } : it))]} />
        ) : (
          <>
            <Menu etiqueta="Archivo" items={itemsArchivo} />
            <Menu etiqueta="Exportar" items={itemsExportar} />
          </>
        )}
      </span>
      <input
        ref={inputArchivo}
        type="file"
        accept=".cnc,.nc,.gcode,.ngc,.tap,.txt,text/plain"
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
      {estrecha && <div style={{ marginBottom: 6 }}>{selectorMaquina}</div>}
      <TituloArea>
        Programa · {nombres[maquina]}
        <span style={{ ...estadoChip, background: textoEstado[estado][1] }} data-estado-cnc={estado}>
          {textoEstado[estado][0]}
        </span>
      </TituloArea>
      <div className="relleno" style={{ minHeight: 220 }}>
        <EditorGcode
          ref={editor}
          codigo={codigo}
          onCambiar={setCodigo}
          lineaActiva={lineaActiva}
          diagnosticos={resultado.diagnosticos}
          onCursor={setCursor}
          soloLectura={bloqueado}
          alto="100%"
        />
      </div>
      <div style={{ maxHeight: '30%', overflow: 'auto', flexShrink: 0 }}>
        <Revision resultado={resultado} errores={errores} avisos={avisosProg} irA={irA} />
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
          <Maquina3D vista={vista} onCanvas={(c) => (canvasRef.current = c)} alto="100%" />
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
        <span style={{ color: '#51606f' }}>Arrastra para girar la vista · {acercar(tactil)}.</span>
      </div>
      <Tablero sim={sim} torno={torno} paso={paso} ultimo={ultimo} modal={estadoModal} tiempoTotal={resultado.tiempoTotal} volumen={volumen} volumenInicial={volumenInicial} />
      {sim.consejos.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {sim.consejos.map((c, i) => (
            <p key={i} style={{ color: '#7a4f00', margin: '3px 0', fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => irA(c.linea)}>
              💡 Línea {c.linea + 1}: {c.texto}
            </p>
          ))}
        </div>
      )}
    </>
  )

  const pestanas: Array<PestanaPanel<PestanaCNC>> = [
    {
      id: 'preparacion',
      titulo: 'Preparación',
      contenido: <Preparacion config={config} setConfig={setConfig} bloqueado={bloqueado} modoCero={cero.modo} addRegPart={resultado.addRegPart} />,
    },
    {
      id: 'plano',
      titulo: `Trayectoria 2D ${torno ? '(Z-X)' : '(desde arriba)'}`,
      contenido: <Plano2D programa={resultado} sim={sim} config={config} lineas={lineas} seleccionada={cursor} onElegirLinea={irA} origen={cero.origen} />,
    },
    {
      id: 'explicar',
      titulo: 'Explicar el bloque',
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
      <SubnavUnidad nombre="CNC" seccion={seccion} onSeccion={setSeccion} entregar={{ abierto: entregaAbierta, onAlternar: () => setEntregaAbierta((a) => !a) }} />
      {seccion === 'laboratorio' ? (
        <BancoDividido<PestanaCNC>
          clave="neumalab.cnc.banco"
          barra={barra}
          izquierda={{ id: 'programa', titulo: 'Programa', contenido: areaPrograma }}
          derecha={{ id: 'maquina', titulo: 'Máquina', contenido: areaMaquina }}
          inferior={{ etiqueta: 'Preparación, trayectoria y tablas', pestanas, estado: panel }}
          estado={barraEstado}
          conCajon={entregaAbierta && !estrecha}
        />
      ) : (
        <PaginaEstudiar
          etiqueta="Estudiar CNC"
          titulo="Estudiar · CNC"
          descripcion="Teoría de la unidad. Los programas de ejemplo se abren en el Laboratorio."
          pie="NeumaLab · MEC275 — Unidad 3: Control numérico computacional · código G"
          secciones={SECCIONES_CNC}
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
            setEstado('listo')
            setConfig(d.config)
            setCodigos((x) => ({ ...x, [m]: d.codigo as string }))
            setNombres((x) => ({ ...x, [m]: nombre }))
          }}
          onCerrar={() => setMisTrabajos(false)}
        />
      )}
      {entregaAbierta && (
        <CajonEntregar
          unidad="CNC"
          clave="neumalab.cnc.entrega"
          trabajoSugerido="Trabajo-3"
          onCerrar={() => setEntregaAbierta(false)}
          revisar={() => {
            const prueba = new SimuladorCNC(resultado, config, casa)
            prueba.terminar()
            const codigoSinComentarios = lineas.filter((l) => !/^\s*[(;%]/.test(l))
            const unidadesMm = codigoSinComentarios.some((l) => /\bG21\b/i.test(l.replace(/\(.*?\)/g, '')))
            const fin = codigoSinComentarios.some((l) => /\bM(30|0?2)\b/i.test(l.replace(/\(.*?\)/g, '')))
            const sinC = resultado.sinComentario
            return [
              { ok: errores.length === 0, texto: errores.length === 0 ? 'El programa no tiene errores de escritura.' : `Hay ${errores.length} error(es). El primero, en la línea ${errores[0].linea + 1}: ${errores[0].texto}` },
              {
                ok: sinC.length === 0,
                texto: sinC.length === 0 ? 'Cada línea de código tiene su comentario.' : `Hay ${sinC.length} línea(s) de código sin comentario (por ejemplo la ${sinC[0] + 1}). Si el enunciado pide comentar cada línea, agrégalo entre paréntesis.`,
              },
              { ok: unidadesMm, texto: unidadesMm ? 'Trabaja en milímetros (G21).' : 'No encuentro G21: indica que trabajas en milímetros.' },
              { ok: fin, texto: fin ? 'El programa termina con M30 (o M02).' : 'El programa no termina con M30 ni M02.' },
              {
                ok: !prueba.alarma,
                texto: prueba.alarma ? `Al mecanizar todo salta una alarma en la línea ${prueba.alarma.linea + 1}: ${prueba.alarma.texto}` : 'La simulación completa llega al final sin alarmas.',
              },
              ...prueba.consejos.slice(0, 3).map((c) => ({ ok: false, texto: `Línea ${c.linea + 1}: ${c.texto}` })),
            ]
          }}
          presentacion={[
            {
              id: 'trayectoria',
              tipo: 'imagen',
              titulo: 'Trayectoria con sus puntos',
              detalle: 'La silueta que recorre la herramienta, con los puntos numerados.',
              hacer: async (base) => {
                await exportarPlano(`${base}_trayectoria.png`)
                return `Descargada: ${base}_trayectoria.png`
              },
            },
            {
              id: 'coordenadas',
              tipo: 'tabla',
              titulo: 'Tabla de coordenadas',
              detalle: 'Dónde queda la herramienta en cada bloque, en absolutas e incrementales.',
              hacer: async () => {
                const filas = filasCoordenadas(resultado, torno, lineas, casa)
                if (filas.length < 2) throw new Error('El programa todavía no mueve la máquina.')
                return (await copiarTabla(filas)) ? 'Tabla copiada: pégala en tu presentación (Ctrl+V).' : 'Tu navegador no dejó copiar.'
              },
            },
            {
              id: 'herramientas',
              tipo: 'tabla',
              titulo: 'Herramientas que usa tu programa',
              detalle: 'Cada herramienta con su nombre y en qué líneas se llama.',
              hacer: async () => {
                const lista = torno ? torretaDe(config) : almacenDe(config)
                const uso = new Map<number, number[]>()
                lineas.forEach((l, i) => {
                  const limpia = l.replace(/\(.*?\)/g, '').replace(/;.*/, '')
                  for (const m of limpia.matchAll(/\bT0*(\d{1,2})/gi)) {
                    const t = Number(m[1])
                    uso.set(t, [...(uso.get(t) ?? []), i + 1])
                  }
                })
                if (!uso.size) throw new Error('Tu programa no llama a ninguna herramienta (T).')
                const filas = [...uso.entries()].sort((a, b) => a[0] - b[0]).map(([t, ls]) => [`T${t}`, lista.find((h) => h.t === t)?.nombre ?? '(no está en la torreta)', lista.find((h) => h.t === t)?.uso ?? '', ls.join(', ')])
                return (await copiarTabla([['Herramienta', 'Nombre', 'Para qué sirve', 'Líneas'], ...filas])) ? 'Tabla copiada: pégala en tu presentación (Ctrl+V).' : 'Tu navegador no dejó copiar.'
              },
            },
            {
              id: 'bruto',
              tipo: 'tabla',
              titulo: 'Material y dimensiones del bruto',
              detalle: 'Lo que pusiste en Preparación.',
              hacer: async () => {
                const filas = torno
                  ? [['Material', 'Diámetro (mm)', 'Largo (mm)', 'Toman las garras (mm)', 'Sobremetal en la cara (mm)'], [mat.nombre, String(config.torno.diametro), String(config.torno.largo), String(config.torno.agarre), String(config.torno.sobremetal)]]
                  : [['Material', 'Largo X (mm)', 'Ancho Y (mm)', 'Alto Z (mm)'], [mat.nombre, String(config.fresa.largo), String(config.fresa.ancho), String(config.fresa.alto)]]
                return (await copiarTabla(filas)) ? 'Tabla copiada: pégala en tu presentación (Ctrl+V).' : 'Tu navegador no dejó copiar.'
              },
            },
          ]}
          archivos={[
            {
              id: 'cnc',
              tipo: 'archivo',
              titulo: 'Programa .cnc',
              detalle: 'El archivo de texto con tu código G. También se abre en CNC Simulator Pro.',
              hacer: (base) => {
                descargarTexto(codigo.replace(/\n/g, '\r\n'), `${base}.cnc`)
                return `Descargado: ${base}.cnc`
              },
            },
            {
              id: 'video',
              tipo: 'video',
              titulo: 'Video de la simulación',
              detalle: grabando ? 'Grabando… pulsa «■ Detener grabación» arriba al terminar.' : 'Graba la máquina 3D mientras mecaniza; se descarga al detener.',
              deshabilitado: !puedeGrabar || grabando,
              porque: grabando ? 'Grabando… pulsa «■ Detener grabación» arriba al terminar.' : 'Tu navegador no permite grabar video.',
              hacer: (base) => {
                nombreVideo.current = `${base}_simulacion`
                reiniciar()
                alternarGrabacion()
                setTimeout(() => correr('corriendo'), 300)
                return 'Grabando desde el inicio. Al terminar el mecanizado pulsa «■ Detener grabación» (arriba a la derecha).'
              },
            },
            {
              id: 'enlace',
              tipo: 'enlace',
              titulo: 'Enlace a tu programa',
              detalle: 'Opcional: abre tu programa, con su preparación, en la app.',
              hacer: async () => {
                const url = await enlaceTrabajo('cnc', 'cnc', { config, codigo, nombre: nombres[maquina] })
                return (await copiarTexto(url)) ? 'Enlace copiado.' : `Copia este enlace: ${url}`
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

/** Filas de la tabla de coordenadas (con encabezado), para copiar al informe. */
function filasCoordenadas(resultado: ResultadoGcode, torno: boolean, lineas: string[], casa: { x: number; y: number; z: number }): string[][] {
  let previo = casa
  const r = (v: number) => String(Math.round(v * 1000) / 1000)
  const cab = torno ? ['Bloque', 'G', 'X (Ø)', 'Z', 'U (ΔX)', 'W (ΔZ)'] : ['Bloque', 'G', 'X', 'Y', 'Z', 'ΔX', 'ΔY', 'ΔZ']
  const filas = resultado.puntos.map((p) => {
    const d = { x: p.pos.x - previo.x, y: p.pos.y - previo.y, z: p.pos.z - previo.z }
    previo = p.pos
    const n = /^\s*N(\d+)/i.exec(lineas[p.linea] ?? '')
    const b = n ? `N${n[1]}` : `L${p.linea + 1}`
    return torno ? [b, p.codigo, r(p.prog.x), r(p.prog.z), r(d.x), r(d.z)] : [b, p.codigo, r(p.prog.x), r(p.prog.y), r(p.prog.z), r(d.x), r(d.y), r(d.z)]
  })
  return [cab, ...filas]
}

type PestanaCNC = 'preparacion' | 'plano' | 'explicar' | 'coordenadas'

const SECCIONES_CNC: SeccionEstudio[] = [
  { id: 'practica', indice: 'Autoevaluación', titulo: 'Autoevaluación · practica con preguntas al azar', contenido: <Autoevaluacion generadores={PREGUNTAS_CNC} /> },
  { id: 'ficha', indice: 'Ficha de repaso', titulo: 'Ficha de repaso · para imprimir', contenido: <FichaCNC /> },
  { id: 'que-es', indice: '¿Qué es el CNC?', titulo: '¿Qué es el CNC?', contenido: <QueEsCNC /> },
  { id: 'ventajas', indice: 'Ventajas y aplicaciones', titulo: 'Ventajas, limitaciones y aplicaciones', contenido: <VentajasCNC /> },
  { id: 'organizar', indice: 'Organizar la programación', titulo: 'Cómo organizar la programación', contenido: <OrganizarPrograma /> },
  { id: 'coordenadas', indice: 'Coordenadas', titulo: 'Coordenadas absolutas e incrementales (con práctica)', contenido: <Coordenadas /> },
  { id: 'bloque', indice: 'Estructura de un bloque', titulo: 'Estructura de un bloque de código G', contenido: <EstructuraBloque /> },
  { id: 'codigos', indice: 'Códigos G y M', titulo: 'Códigos G y M', contenido: <CodigosGM /> },
  { id: 'arcos', indice: 'Arcos G02 y G03', titulo: 'Arcos: G02 y G03', contenido: <Arcos /> },
  { id: 'torno', indice: 'El torno CNC', titulo: 'El torno CNC y sus operaciones', contenido: <Torno /> },
  { id: 'insertos', indice: 'Herramientas de corte', titulo: 'Herramientas de corte: código de los insertos', contenido: <Insertos /> },
  { id: 'como-usar', indice: 'Cómo usar el simulador', titulo: 'Cómo usar este simulador (y entregar tu trabajo)', contenido: <ComoUsar /> },
]

// ---------------------------------------------------------------------------
function Preparacion({
  config,
  setConfig,
  bloqueado,
  modoCero,
  addRegPart,
}: {
  config: ConfigCNC
  setConfig: (f: (c: ConfigCNC) => ConfigCNC) => void
  bloqueado: boolean
  modoCero: 'cara' | 'garras'
  addRegPart: number | null
}) {
  const torno = config.maquina === 'torno'
  const num = (valor: number, cambiar: (v: number) => void, min: number, max: number, etiqueta: string, ayuda?: string) => (
    <label style={{ ...rotulo, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} title={ayuda}>
      <span>{etiqueta}</span>
      <input
        type="number"
        value={valor}
        min={min}
        max={max}
        step={1}
        disabled={bloqueado}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) cambiar(Math.min(max, Math.max(min, v)))
        }}
        style={{ width: 80, padding: '3px 6px', border: '1px solid #c6ced6', borderRadius: 6 }}
      />
    </label>
  )
  const herramientas = torno ? torretaDe(config) : almacenDe(config)
  return (
    <section aria-label="Preparación">
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ ...rotulo, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <span>Material</span>
          <select value={config.material} disabled={bloqueado} onChange={(e) => setConfig((c) => ({ ...c, material: e.target.value }))} style={selector}>
            {MATERIALES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
        {torno ? (
          <>
            {num(config.torno.diametro, (v) => setConfig((c) => ({ ...c, torno: { ...c.torno, diametro: v } })), 5, 120, 'Diámetro bruto (mm)')}
            {num(config.torno.largo, (v) => setConfig((c) => ({ ...c, torno: { ...c.torno, largo: v } })), 20, 300, 'Largo bruto (mm)')}
            {num(config.torno.agarre, (v) => setConfig((c) => ({ ...c, torno: { ...c.torno, agarre: v } })), 10, 60, 'Toman las garras (mm)', 'Largo del material que queda dentro del plato')}
            {num(config.torno.sobremetal, (v) => setConfig((c) => ({ ...c, torno: { ...c.torno, sobremetal: v } })), 0, 10, 'Sobremetal en la cara (mm)', 'Material que sobresale delante de Z0, para refrentar')}
            <label style={{ ...rotulo, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} title="Dónde queda el cero (X0 Z0) del programa">
              <span>Cero del programa</span>
              <select
                value={config.torno.origen ?? 'auto'}
                disabled={bloqueado}
                onChange={(e) => setConfig((c) => ({ ...c, torno: { ...c.torno, origen: e.target.value as OrigenTorno } }))}
                style={selector}
                data-origen-torno="si"
              >
                <option value="auto">Automático</option>
                <option value="cara">En la cara de la pieza</option>
                <option value="garras">En las garras (CNC Simulator Pro)</option>
              </select>
            </label>
          </>
        ) : (
          <>
            {num(config.fresa.largo, (v) => setConfig((c) => ({ ...c, fresa: { ...c.fresa, largo: v } })), 10, 300, 'Largo X (mm)')}
            {num(config.fresa.ancho, (v) => setConfig((c) => ({ ...c, fresa: { ...c.fresa, ancho: v } })), 10, 300, 'Ancho Y (mm)')}
            {num(config.fresa.alto, (v) => setConfig((c) => ({ ...c, fresa: { ...c.fresa, alto: v } })), 3, 100, 'Alto Z (mm)')}
          </>
        )}
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#51606f', flex: '1 1 260px' }}>
          {torno
            ? modoCero === 'cara'
              ? `Cero del programa: en la cara frontal, sobre el eje. El bruto va de Z${config.torno.sobremetal} a Z${config.torno.sobremetal - config.torno.largo}; las garras llegan hasta Z${config.torno.sobremetal - config.torno.largo + config.torno.agarre}. X se programa en diámetro.`
              : `Cero del programa como en CNC Simulator Pro: Z0 en la cara de las garras. La cara del bruto queda en Z${config.torno.largo - config.torno.agarre} y las Z negativas entran al plato.${config.torno.agarre !== 23 ? ' (CNC Simulator Pro toma 23 mm en las garras.)' : ''} X se programa en diámetro. Con G92 puedes mover el cero.`
            : 'Cero pieza: esquina delantera izquierda de la cara superior. Z negativo corta hacia abajo.'}{' '}
          {addRegPart !== null && `El programa pide $AddRegPart ${addRegPart}: se usa el bruto de esta preparación. `}
          Avance orientativo para {materialDe(config.material).nombre.toLowerCase()}: {materialDe(config.material).avance.join('–')} mm/min.
        </p>
      </div>
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', color: '#33475c', fontWeight: 600, fontSize: '0.9rem' }}>
          Herramientas {torno ? 'de la torreta' : 'del almacén'} ({herramientas.length}){(torno ? config.herramientasTorno : config.herramientasFresa) ? ' · propias' : ''}
        </summary>
        <EditorHerramientas config={config} setConfig={setConfig} bloqueado={bloqueado} />
      </details>
    </section>
  )
}

function Revision({ resultado, errores, avisos, irA }: { resultado: ResultadoGcode; errores: ResultadoGcode['diagnosticos']; avisos: ResultadoGcode['diagnosticos']; irA: (n: number) => void }) {
  const sinC = resultado.sinComentario
  return (
    <div style={{ marginTop: 8 }} data-revision-cnc="si">
      {errores.length === 0 && avisos.length === 0 && (
        <p style={{ margin: '3px 0', color: '#0a6b3c', fontSize: '0.86rem' }}>✓ El programa no tiene errores de escritura.</p>
      )}
      {[...errores, ...avisos].map((d, i) => (
        <p
          key={i}
          onClick={() => irA(d.linea)}
          style={{ margin: '3px 0', fontSize: '0.86rem', cursor: 'pointer', color: d.nivel === 'error' ? '#c62828' : d.nivel === 'aviso' ? '#8a5b00' : '#5a6b7d' }}
        >
          {d.nivel === 'error' ? '✕' : d.nivel === 'aviso' ? '⚠' : 'ℹ'} Línea {d.linea + 1}: {d.texto}
        </p>
      ))}
      {errores.length > 0 && (
        <p style={{ margin: '3px 0', fontSize: '0.82rem', color: '#5a6b7d' }}>Con errores, la máquina ejecuta el programa sólo hasta la línea anterior al primer error.</p>
      )}
      {sinC.length > 0 && (
        <p style={{ margin: '3px 0', fontSize: '0.82rem', color: '#5a6b7d' }}>
          ℹ {sinC.length === 1 ? 'Una línea no tiene' : `${sinC.length} líneas no tienen`} comentario:{' '}
          {sinC.slice(0, 12).map((n, i) => (
            <span key={n}>
              {i ? ', ' : ''}
              <a href="#" onClick={(e) => (e.preventDefault(), irA(n))}>
                {n + 1}
              </a>
            </span>
          ))}
          {sinC.length > 12 ? '…' : ''}. Comentar cada línea ( … ) ayuda a entender y revisar el programa.
        </p>
      )}
    </div>
  )
}

function Tablero({
  sim,
  torno,
  paso,
  ultimo,
  modal,
  tiempoTotal,
  volumen,
  volumenInicial,
}: {
  sim: SimuladorCNC
  torno: boolean
  paso: SimuladorCNC['programa']['pasos'][number] | undefined
  ultimo: SimuladorCNC['programa']['pasos'][number] | undefined
  modal: ResultadoGcode['estados'][number] | undefined
  tiempoTotal: number
  volumen: number
  volumenInicial: number
}) {
  const act = paso ?? ultimo
  // Las cotas se muestran como las ve el programa (respecto de su cero).
  const o = act?.origen ?? sim.programa.pasos[0]?.origen ?? { x: 0, y: 0, z: 0 }
  const p = { x: sim.pos.x - o.x, y: sim.pos.y - o.y, z: sim.pos.z - o.z }
  const rpm = paso && paso.husillo !== 'off' ? Math.round(paso.rpm) : 0
  const f = (v: number) => v.toFixed(3)
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const ejes: Array<[string, number]> = torno
    ? [
        ['X Ø', p.x],
        ['Z', p.z],
      ]
    : [
        ['X', p.x],
        ['Y', p.y],
        ['Z', p.z],
      ]
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }} data-dro="si">
      <div style={{ background: '#1b232c', color: '#7CFC9A', borderRadius: 8, padding: '6px 10px', fontFamily: 'ui-monospace, Menlo, monospace', minWidth: 170 }}>
        {ejes.map(([n, v]) => (
          <div key={n} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '1.05rem' }}>
            <span style={{ color: '#b9c4cf' }}>{n}</span>
            <span data-eje={n}>{f(v)}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.84rem', color: '#33475c', lineHeight: 1.6, flex: '1 1 200px' }}>
        <div>
          <strong>{act?.codigo ?? '—'}</strong> · {modal?.absoluto === false ? 'G91 incrementales' : 'G90 absolutas'} · {modal?.pulgadas ? 'pulgadas' : 'mm'}
        </div>
        <div>
          Herramienta: <strong>{nombreHerramienta(sim.config.maquina, sim.herramienta)}</strong>
        </div>
        <div>
          Husillo: <strong>{rpm ? `${rpm} rpm ${paso?.husillo === 'ccw' ? '(M04)' : '(M03)'}` : 'detenido'}</strong> · Avance:{' '}
          <strong>{paso && paso.tipo === 'corte' ? `${Math.round(paso.avance)} mm/min` : paso?.tipo === 'rapido' ? 'rápido' : '—'}</strong>
          {paso?.refrigerante ? ' · 💧 refrigerante' : ''}
        </div>
        <div>
          Tiempo: <strong>{mmss(sim.tiempo)}</strong> de {mmss(tiempoTotal)} · Material quitado:{' '}
          <strong>{volumenInicial > 0 ? Math.round(((volumenInicial - volumen) / volumenInicial) * 100) : 0}%</strong>
          {sim.pieza.tipo === 'torno' && sim.pieza.tronzada ? ' · ✂ pieza tronzada' : ''}
        </div>
      </div>
    </div>
  )
}

function TablaPuntos({
  resultado,
  torno,
  lineas,
  irA,
  seleccionada,
  casa,
  origen,
}: {
  resultado: ResultadoGcode
  torno: boolean
  lineas: string[]
  irA: (n: number) => void
  seleccionada: number | null
  casa: { x: number; y: number; z: number }
  origen: { x: number; y: number; z: number }
}) {
  const [copiado, setCopiado] = useState(false)
  const casaProg = { x: casa.x - origen.x, y: casa.y - origen.y, z: casa.z - origen.z }
  const filas = useMemo(() => {
    let previo = casa
    return resultado.puntos.map((p) => {
      const d = { x: p.pos.x - previo.x, y: p.pos.y - previo.y, z: p.pos.z - previo.z }
      previo = p.pos
      const n = /^\s*N(\d+)/i.exec(lineas[p.linea] ?? '')
      return { ...p, pos: p.prog, d, n: n ? `N${n[1]}` : `L${p.linea + 1}` }
    })
  }, [resultado, lineas, casa])
  const r = (v: number) => String(Math.round(v * 1000) / 1000)
  const cab = torno ? ['Bloque', 'G', 'X (Ø)', 'Z', 'U (ΔX)', 'W (ΔZ)'] : ['Bloque', 'G', 'X', 'Y', 'Z', 'ΔX', 'ΔY', 'ΔZ']
  const copiar = () => {
    const texto = [cab.join('\t'), ...filas.map((f) => (torno ? [f.n, f.codigo, r(f.pos.x), r(f.pos.z), r(f.d.x), r(f.d.z)] : [f.n, f.codigo, r(f.pos.x), r(f.pos.y), r(f.pos.z), r(f.d.x), r(f.d.y), r(f.d.z)]).join('\t'))].join('\n')
    void navigator.clipboard?.writeText(texto).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }
  if (!filas.length) return <p style={{ color: '#5f6b78', fontSize: '0.86rem' }}>El programa todavía no mueve la máquina.</p>
  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#5a6b7d' }}>
        Dónde queda la herramienta al final de cada bloque, en absolutas y en incrementales (Δ desde el bloque anterior).{' '}
        <button onClick={copiar} style={{ ...botonSuave, padding: '1px 8px', fontSize: '0.78rem' }}>
          {copiado ? '✓ Copiada' : 'Copiar tabla'}
        </button>
      </p>
      <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid #e0e5eb', borderRadius: 6 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem', fontFamily: 'ui-monospace, Menlo, monospace' }} data-tabla-puntos="si">
          <thead style={{ position: 'sticky', top: 0 }}>
            <tr>
              {cab.map((c) => (
                <th key={c} style={{ background: '#33475c', color: '#fff', padding: '3px 6px', textAlign: 'right' }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} onClick={() => irA(f.linea)} style={{ cursor: 'pointer', background: seleccionada === f.linea ? '#fff2a8' : i % 2 ? '#f8fafc' : '#fff' }}>
                <td style={celdaNum}>{f.n}</td>
                <td style={celdaNum}>{f.codigo}</td>
                <td style={celdaNum}>{r(f.pos.x)}</td>
                {!torno && <td style={celdaNum}>{r(f.pos.y)}</td>}
                <td style={celdaNum}>{r(f.pos.z)}</td>
                <td style={{ ...celdaNum, color: '#5a6b7d' }}>{r(f.d.x)}</td>
                {!torno && <td style={{ ...celdaNum, color: '#5a6b7d' }}>{r(f.d.y)}</td>}
                <td style={{ ...celdaNum, color: '#5a6b7d' }}>{r(f.d.z)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#5f6b78' }}>Punto de partida: posición de referencia {textoPunto(casaProg, torno)}.</p>
    </div>
  )
}

function ComoUsar() {
  const li: React.CSSProperties = { marginBottom: 4 }
  return (
    <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55 }}>
      <li style={li}>
        <strong>Prepara la máquina:</strong> elige el centro de torneado o la fresadora, el material y las medidas del bruto.
        Revisa la lista de herramientas: en el torno se llaman con <code>T0101</code> (herramienta 1, corrector 1); en la
        fresadora con <code>T1 M06</code>. Puedes editarlas, agregar las tuyas o quitar las que no tengas.
      </li>
      <li style={li}>
        <strong>Escribe el programa</strong> en el editor (o abre un .cnc). Mientras escribes se revisa: los errores salen
        en rojo con su línea. Pon el cursor en una línea para ver qué hace cada palabra.
      </li>
      <li style={li}>
        <strong>Simula:</strong> ▶ Ciclo lo ejecuta completo, ⏭ Bloque a bloque avanza de a una línea, ⏮ Bloque
        anterior retrocede una línea, ⏩ Al final mecaniza todo de una vez y ⟲ Reiniciar vuelve al bruto entero. En el
        torno, «Vista en corte» parte la pieza por la mitad para ver agujeros y roscas. Cambia la velocidad para verlo más rápido.
      </li>
      <li style={li}>
        <strong>Como en la máquina real,</strong> se detiene con una alarma si la herramienta entra al material en rápido
        (G00), si corta con el husillo detenido, si choca con las garras del plato o con la mesa, o si la broca se mueve de
        lado. Los consejos 💡 (por ejemplo, pasadas muy profundas) no detienen la simulación.
      </li>
      <li style={li}>
        <strong>Para el informe:</strong> «Trayectoria (PNG)» descarga el dibujo 2D con los puntos, «Copiar tabla» copia
        las coordenadas, «Guardar .cnc» descarga el programa (un archivo de texto que también abre CNC Simulator Pro) y
        «● Grabar video» graba la vista 3D mientras corre la simulación.
      </li>
      <li style={li}>
        <strong>Programas de CNC Simulator Pro:</strong> se abren tal cual. <code>$Millimeter</code>/<code>$Inch</code> fijan
        las unidades y <code>$AddRegPart 1</code> pone en el plato el bruto de «Preparación». Con <code>$AddRegPart</code> el
        cero del torno pasa a la cara de las garras, como en ese simulador (con un bruto de 100 mm y 23 mm en las garras,
        la cara queda en Z77); también puedes elegirlo en «Cero del programa». <code>G92 X… Z…</code> mueve el cero (la
        posición actual toma esas coordenadas), <code>ET2</code> llama una herramienta igual que <code>T2</code>, y
        <code>T… M6</code> la monta. En el torno funcionan los ciclos <code>G81</code>/<code>G83</code> (taladrado en el eje)
        y <code>G76</code> (roscado en dos bloques). Otras instrucciones <code>$</code> se ignoran. El punto programado de la
        herramienta de tronzado es su esquina derecha (hacia la cara).
      </li>
      <li style={li}>
        <strong>Para programar menos:</strong> en el torno, <code>G71 U… R…</code> + <code>G71 P… Q… U… W… F…</code> desbasta
        el perfil escrito entre los bloques N indicados en P y Q, y <code>G70 P… Q…</code> lo afina (solos, G70 y G71 siguen
        siendo pulgadas y milímetros). <code>M98 P1000 L3</code> llama tres veces al subprograma <code>O1000</code>, que se
        escribe después del M30 y termina con <code>M99</code>. En la fresadora, <code>G41</code>/<code>G42</code> con
        <code>D…</code> corren la fresa un radio a la izquierda o a la derecha del contorno (se programa con las medidas de la
        pieza) y <code>G40</code> la cancela; en el torno no se simula la compensación del radio de la punta.
      </li>
    </ol>
  )
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Herramientas propias: se pueden editar, agregar y quitar
// ---------------------------------------------------------------------------
const FORMAS_TORNO: Array<[FormaTorno, string]> = [
  ['izquierda', 'Cilindrar hacia el plato (Z−)'],
  ['derecha', 'Cilindrar hacia la cara (Z+)'],
  ['ranurado', 'Ranurado / tronzado'],
  ['roscado', 'Roscado'],
  ['broca', 'Broca (en el eje)'],
]
const FORMAS_FRESA: Array<[FormaFresa, string]> = [
  ['plana', 'Fresa plana'],
  ['bola', 'Fresa bola'],
  ['broca', 'Broca'],
  ['grabado', 'Grabado en V'],
]

function EditorHerramientas({ config, setConfig, bloqueado }: { config: ConfigCNC; setConfig: (f: (c: ConfigCNC) => ConfigCNC) => void; bloqueado: boolean }) {
  const torno = config.maquina === 'torno'
  const lista: Array<HerramientaTorno | HerramientaFresa> = torno ? torretaDe(config) : almacenDe(config)
  const propias = torno ? !!config.herramientasTorno : !!config.herramientasFresa
  const guardar = (nueva: Array<HerramientaTorno | HerramientaFresa>) =>
    setConfig((c) => (torno ? { ...c, herramientasTorno: nueva as HerramientaTorno[] } : { ...c, herramientasFresa: nueva as HerramientaFresa[] }))
  const cambiar = (i: number, cambio: Partial<HerramientaTorno> & Partial<HerramientaFresa>) => guardar(lista.map((h, k) => (k === i ? ({ ...h, ...cambio } as HerramientaTorno | HerramientaFresa) : h)))
  const agregar = () => {
    const t = Math.max(0, ...lista.map((h) => h.t)) + 1
    const color = COLORES_HERRAMIENTA[t % COLORES_HERRAMIENTA.length]
    const nueva: HerramientaTorno | HerramientaFresa = torno
      ? { t, nombre: 'Herramienta nueva', forma: 'izquierda', angulo: 30, uso: 'Escribe para qué sirve.', color }
      : { t, nombre: 'Fresa nueva', forma: 'plana', diametro: 8, uso: 'Escribe para qué sirve.', color }
    guardar([...lista, nueva])
  }
  const repetidas = new Set(lista.map((h) => h.t).filter((t, i, a) => a.indexOf(t) !== i))
  const entrada: React.CSSProperties = { padding: '2px 4px', border: '1px solid #c6ced6', borderRadius: 4, fontSize: '0.82rem' }
  return (
    <div style={{ marginTop: 6 }} data-herramientas="si">
      <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: '#5a6b7d' }}>
        Puedes cambiar las herramientas como en la máquina: el número T, el nombre, el tipo y sus medidas.
        {torno ? ' En el torno la medida es el ancho de la hoja (ranurado) o el diámetro (broca); el ángulo es el del filo secundario (el de roscado, el de la punta).' : ' El diámetro es el que usa la compensación de radio G41/G42 (radio = diámetro ÷ 2).'}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              {['T', 'Herramienta', 'Tipo', torno ? 'Medida / ángulo' : 'Diámetro', 'Para qué sirve', torno ? 'Cómo llamarla' : 'Cómo montarla', ''].map((h, i) => (
                <th key={i} style={{ textAlign: 'left', background: '#33475c', color: '#fff', padding: '4px 8px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((h, i) => {
              const ht = h as HerramientaTorno
              const hf = h as HerramientaFresa
              return (
                <tr key={i}>
                  <td style={{ ...celda, whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: `#${h.color.toString(16).padStart(6, '0')}`, marginRight: 5 }} />
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={h.t}
                      disabled={bloqueado}
                      onChange={(e) => cambiar(i, { t: Math.max(1, Math.min(99, Math.round(Number(e.target.value) || 1))) })}
                      style={{ ...entrada, width: 46, borderColor: repetidas.has(h.t) ? '#d93025' : '#c6ced6' }}
                      aria-label="Número T"
                    />
                  </td>
                  <td style={celda}>
                    <input value={h.nombre} disabled={bloqueado} onChange={(e) => cambiar(i, { nombre: e.target.value })} style={{ ...entrada, width: 150 }} aria-label="Nombre" />
                  </td>
                  <td style={celda}>
                    <select value={h.forma} disabled={bloqueado} onChange={(e) => cambiar(i, { forma: e.target.value as FormaTorno & FormaFresa })} style={entrada}>
                      {(torno ? FORMAS_TORNO : FORMAS_FRESA).map(([v, t]) => (
                        <option key={v} value={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...celda, whiteSpace: 'nowrap' }}>
                    {torno ? (
                      ht.forma === 'ranurado' || ht.forma === 'broca' ? (
                        <label>
                          {ht.forma === 'broca' ? 'Ø' : 'ancho'}{' '}
                          <input type="number" min={0.5} max={40} step={0.5} value={ht.medida ?? 4} disabled={bloqueado} onChange={(e) => cambiar(i, { medida: Math.max(0.5, Number(e.target.value) || 1) })} style={{ ...entrada, width: 58 }} /> mm
                        </label>
                      ) : (
                        <label>
                          <input type="number" min={1} max={85} step={1} value={ht.angulo ?? (ht.forma === 'roscado' ? 60 : 5)} disabled={bloqueado} onChange={(e) => cambiar(i, { angulo: Math.max(1, Math.min(85, Number(e.target.value) || 5)) })} style={{ ...entrada, width: 52 }} />°
                        </label>
                      )
                    ) : (
                      <label>
                        Ø <input type="number" min={0.5} max={80} step={0.5} value={hf.diametro} disabled={bloqueado} onChange={(e) => cambiar(i, { diametro: Math.max(0.5, Math.min(80, Number(e.target.value) || 1)) })} style={{ ...entrada, width: 58 }} /> mm
                      </label>
                    )}
                  </td>
                  <td style={celda}>
                    <input value={h.uso} disabled={bloqueado} onChange={(e) => cambiar(i, { uso: e.target.value })} style={{ ...entrada, width: '100%', minWidth: 180 }} aria-label="Para qué sirve" />
                  </td>
                  <td style={{ ...celda, fontFamily: 'ui-monospace, Menlo, monospace' }}>{torno ? `T${String(h.t).padStart(2, '0')}${String(h.t).padStart(2, '0')}` : `T${h.t} M06`}</td>
                  <td style={celda}>
                    <button onClick={() => guardar(lista.filter((_, k) => k !== i))} disabled={bloqueado || lista.length <= 1} title="Quitar esta herramienta" style={{ ...entrada, cursor: 'pointer', background: '#fff' }}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {repetidas.size > 0 && <p style={{ margin: '4px 0 0', color: '#d93025', fontSize: '0.8rem' }}>Hay números T repetidos: la máquina usa la primera herramienta con ese número.</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <button onClick={agregar} disabled={bloqueado} style={{ ...botonSuave }} data-agregar-herramienta="si">
          + Agregar herramienta
        </button>
        {propias && (
          <button onClick={() => setConfig((c) => (torno ? { ...c, herramientasTorno: undefined } : { ...c, herramientasFresa: undefined }))} disabled={bloqueado} style={{ ...botonSuave }}>
            Volver a las de fábrica
          </button>
        )}
      </div>
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
const selector: React.CSSProperties = { padding: '0.3rem 0.4rem' }
const rotulo: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#5a6b7d' }
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
const celda: React.CSSProperties = { padding: '4px 8px', borderBottom: '1px solid #eef1f4', verticalAlign: 'top' }
const celdaNum: React.CSSProperties = { padding: '2px 6px', textAlign: 'right', borderBottom: '1px solid #eef1f4' }
