/**
 * MecLab — laboratorio virtual de neumática (MEC275).
 *
 * Dos modos, como un banco de taller:
 *  - Editar: colocar fichas, cablear puertos, ajustar parámetros.
 *  - Simular: el motor corre a 30 Hz; se accionan las válvulas y se ve el aire
 *    circular, las correderas conmutar y los vástagos moverse.
 */
import { IconoDeshacer, IconoRehacer } from './components/IconosEdicion'
import { BotonNuevo, botonPrimario, estiloAviso, Menu, useApaisado, useApilado, useCelular, useEsEstrecha, usePersistente, useTactil } from './components/ui'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import DiagramaEspacioFase, { hayDiagramaFase, registrarFase } from './components/DiagramaEspacioFase'
import { DT_POR_DEFECTO, Motor, validarCircuito } from './engine'
import BarraTiempo from './components/BarraTiempo'
import Paleta from './components/Paleta'
import Pizarra, { type ControlesPizarra } from './components/Pizarra'
import BancoDividido, { TituloArea } from './components/banco/BancoDividido'
import InterruptorEtapa, { type EtapaTrabajo } from './components/banco/InterruptorEtapa'
import { usePanelAcoplado, type PestanaPanel } from './components/banco/PanelAcoplado'
import { ContenidoCorte, ContenidoFase, ContenidoPropiedades, ContenidoRegistro, type PestanaNeumatica } from './components/banco/PanelesNeumatica'
import AreaSimulacionNeumatica, { type VistaSimulacion } from './components/banco/AreaSimulacionNeumatica'
import BordeAncho from './components/banco/BordeAncho'
import AyudaAtajos from './components/banco/AyudaAtajos'

// La teoría de Estudiar y el cajón de entrega se cargan solo cuando se abren.
const PaginaNeumaticaEstudiar = lazy(() => import('./components/estudio/EstudiarNeumatica'))
const EntregaNeumatica = lazy(() => import('./components/EntregaNeumatica'))
import MisTrabajos from './components/banco/MisTrabajos'
import GuiaInicio, { GUIA_NEUMATICA, useGuia } from './components/banco/GuiaInicio'
import { circuitoDesdeStore, useStore, type NumeroEjemplo } from './store'
import { NOMBRES_EJEMPLO } from './circuitos/ejemplos'
import {
  CLAVES,
  descargarJson,
  enlaceCompartir,
  esCircuitoValido,
  guardarJson as guardarClaveJson,
  guardarLocal,
  leerArchivo,
  leerDeUrl,
  leerJson,
  leerLocal,
} from './persistencia'
import { exportarPng, exportarSvg, nombreSeguro, pngEmbebido } from './exportar'
import { esEntrega, normalizarRespuestas } from './entrega'

const EJEMPLOS: Array<{ n: NumeroEjemplo; etiqueta: string }> = ([1, 2, 3, 4, 5, 6, 7] as NumeroEjemplo[]).map((n) => ({ n, etiqueta: NOMBRES_EJEMPLO[n] }))

const CLAVE_CIRCUITO = CLAVES.circuitoAbierto

export default function App() {
  const piezas = useStore((s) => s.piezas)
  const mangueras = useStore((s) => s.mangueras)
  const modo = useStore((s) => s.modo)
  const aire = useStore((s) => s.aire)
  const alumno = useStore((s) => s.alumno)
  const ejercicio = useStore((s) => s.ejercicio)
  const {
    setAlumno,
    setEjercicio,
    setRespuestas,
    setModo,
    setAire,
    cargarEjemplo,
    cargarCircuito,
    limpiarPizarra,
    borrarSeleccion,
    cancelarCable,
    deshacer,
    rehacer,
  } = useStore()
  const puedeDeshacer = useStore((s) => s.puedeDeshacer)
  const circuito = useStore((s) => s.circuito)
  const puedeRehacer = useStore((s) => s.puedeRehacer)

  const [motor, setMotor] = useState<Motor | null>(null)
  // Velocidad de la simulación (cuántos pasos de motor por reloj) y «Reiniciar»: crea un motor nuevo.
  const [velocidadSim, setVelocidadSim] = useState(1)
  const velocidadRef = useRef(1)
  velocidadRef.current = velocidadSim
  const [reinicioSim, setReinicioSim] = useState(0)
  const [, setFotograma] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  // Lo que se guardó como vista del lienzo ya solo decide «3D» o «Por dentro» en la simulación.
  const [vistaGuardada, setVistaGuardada] = usePersistente<string>(CLAVES.bancoVista, 'banco3d')
  const vistaSim: VistaSimulacion = vistaGuardada === 'taller' ? 'dentro' : '3d'
  const [sinWebGL, setSinWebGL] = useState(false)
  const [paletaPlegada, setPaletaPlegada] = usePersistente(CLAVES.bancoPaletaPlegada, false)
  const [anchoPaleta, setAnchoPaleta] = usePersistente<number | null>(CLAVES.bancoAnchoPaleta, null)
  const panel = usePanelAcoplado<PestanaNeumatica>(CLAVES.neumaticaPanel, 'propiedades', true, 300)
  // Armar el circuito (ancho, con la paleta) o probarlo en el banco (la simulación ocupa el ancho).
  const [etapa, setEtapa] = useState<EtapaTrabajo>('armar')
  const [hoja, setHoja] = useState<'paleta' | null>(null)
  // Laboratorio (el banco) o Estudiar; «Entregar» es un cajón sobre el laboratorio.
  const [seccion, setSeccion] = useState<'laboratorio' | 'estudiar'>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('vista') === 'estudiar' ? 'estudiar' : 'laboratorio',
  )
  const [entregaAbierta, setEntregaAbierta] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('vista') === 'entrega',
  )
  const [ranura, setRanura] = useState<HTMLElement | null>(null)
  useEffect(() => setRanura(document.getElementById('barra-unidad')), [])
  // La URL dice dónde está el alumno, para poder compartir o volver (deep link).
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const vistaUrl = seccion === 'estudiar' ? 'estudiar' : entregaAbierta ? 'entrega' : null
      if (vistaUrl) url.searchParams.set('vista', vistaUrl)
      else url.searchParams.delete('vista')
      if (seccion !== 'estudiar' && /^#(cascada|vdi|iso|vias|ficha)$/.test(url.hash)) url.hash = ''
      if (url.href !== window.location.href) window.history.replaceState(null, '', url)
    } catch {
      /* sin historial */
    }
  }, [seccion, entregaAbierta])
  const [ayuda, setAyuda] = useState(false)
  const [misTrabajos, setMisTrabajos] = useState(false)
  const guia = useGuia('neumatica')
  const [zoom, setZoom] = useState(100)
  const controles = useRef<ControlesPizarra | null>(null)
  const seleccion = useStore((s) => s.seleccion)
  const origenCable = useStore((s) => s.origenCable)

  // Al elegir una ficha se abre el panel con sus propiedades. En el celular no: las pestañas son pantallas y saltaría de lugar.
  useEffect(() => {
    if (seleccion?.clase !== 'pieza' || celular) return
    panel.onAbrir(true)
    panel.onPestana(panel.pestana === 'corte' ? 'corte' : 'propiedades')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion])
  // Al simular se abre el registro (tampoco en el celular: ahí se queda donde estaba).
  useEffect(() => {
    if (modo !== 'simular' || celular) return
    panel.onAbrir(true)
    panel.onPestana('registro')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo])
  const estrecha = useEsEstrecha()
  // Celular: una zona a la vez, con pestañas.
  const celular = useCelular()
  // Ventana mediana: el circuito arriba y la simulación debajo, bajando con la barra de desplazamiento.
  const apilado = useApilado() && !celular
  // Celular acostado: «Laboratorio · Estudiar · Entregar» van en la fila de las unidades.
  const apaisado = useApaisado()
  const subnavAparte = estrecha && !apaisado
  const tactil = useTactil()
  const inputArchivo = useRef<HTMLInputElement>(null)

  // --- carga inicial: primero la URL compartida, si no la copia local -------
  useEffect(() => {
    const deUrl = leerDeUrl()
    if (deUrl) {
      cargarCircuito(deUrl, 'Circuito compartido')
      setAviso('Circuito abierto desde un enlace compartido.')
      return
    }
    const local = leerLocal()
    if (local && local.piezas.length > 0) {
      cargarCircuito(local)
      // Nombre del circuito que estaba abierto (ejemplo o archivo), si se guardó.
      const c = leerJson(CLAVE_CIRCUITO) as { nombre?: unknown; ejemplo?: NumeroEjemplo; modificado?: unknown } | null
      if (c && typeof c.nombre === 'string') useStore.setState({ circuito: { nombre: c.nombre, ejemplo: c.ejemplo, modificado: !!c.modificado } })
    }
    if (local?.trabajo) {
      if (local.trabajo.alumno) setAlumno(local.trabajo.alumno)
      if (local.trabajo.ejercicio) setEjercicio(local.trabajo.ejercicio)
      setRespuestas(normalizarRespuestas(local.trabajo.respuestas as never))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pegar un enlace en una pestaña ya abierta sólo cambia el fragmento y no
  // recarga la página: hay que atender el cambio para abrir ese circuito.
  useEffect(() => {
    const alCambiarHash = () => {
      const deUrl = leerDeUrl()
      if (deUrl) {
        cargarCircuito(deUrl, 'Circuito compartido')
        setAviso('Circuito abierto desde un enlace compartido.')
      }
    }
    window.addEventListener('hashchange', alCambiarHash)
    return () => window.removeEventListener('hashchange', alCambiarHash)
  }, [cargarCircuito])

  useEffect(() => {
    guardarClaveJson(CLAVE_CIRCUITO, circuito)
  }, [circuito])

  // --- copia de trabajo automática (circuito y respuestas) -------------------
  const respuestas = useStore((s) => s.respuestas)
  useEffect(() => {
    guardarLocal({
      version: 1,
      piezas,
      mangueras,
      trabajo: { alumno, ejercicio, respuestas },
    })
  }, [piezas, mangueras, alumno, ejercicio, respuestas])

  // --- motor: se crea al entrar en Simular y se destruye al salir -----------
  useEffect(() => {
    if (modo !== 'simular') {
      setMotor(null)
      return
    }
    const estado = useStore.getState()
    const nuevoMotor = new Motor(circuitoDesdeStore(estado.piezas, estado.mangueras))
    if (!estado.aire) {
      for (const p of estado.piezas) {
        if (p.tipo === 'fuente') nuevoMotor.setParametro(p.id, 'encendida', false)
      }
    }
    setMotor(nuevoMotor)
    let acumulado = 0
    const intervalo = setInterval(() => {
      // ×1 es un paso por reloj, como siempre; ×2 son dos y ×0,5 uno cada dos.
      acumulado += velocidadRef.current
      while (acumulado >= 1) {
        nuevoMotor.tick(DT_POR_DEFECTO)
        acumulado -= 1
      }
      setFotograma((f) => f + 1)
    }, 1000 / 30)
    return () => {
      clearInterval(intervalo)
      setMotor(null)
    }
  }, [modo, reinicioSim])

  // --- atajos de teclado ----------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const enCampo = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
      if (e.key === 'Escape') cancelarCable()
      // Ctrl/Cmd+Z deshace; Ctrl/Cmd+Shift+Z o Ctrl+Y rehace.
      if ((e.ctrlKey || e.metaKey) && !enCampo && modo === 'editar') {
        const k = e.key.toLowerCase()
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault()
          deshacer()
        } else if ((k === 'z' && e.shiftKey) || k === 'y') {
          e.preventDefault()
          rehacer()
        }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && modo === 'editar' && !enCampo) {
        borrarSeleccion()
      }
      if (e.key === ' ' && !enCampo) {
        e.preventDefault()
        if (useStore.getState().piezas.length > 0) {
          setModo(modo === 'simular' ? 'editar' : 'simular')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modo, borrarSeleccion, cancelarCable, setModo, deshacer, rehacer])

  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(id)
  }, [aviso])

  const alternarAire = () => {
    const nuevo = !aire
    setAire(nuevo)
    if (motor) {
      for (const c of motor.circuito.componentes) {
        if (c.tipo === 'fuente') motor.setParametro(c.id, 'encendida', nuevo)
      }
    }
  }

  const confirmarDescarte = (mensaje: string) =>
    piezas.length === 0 ||
    window.confirm(
      `${mensaje}\nSe quitarán ${piezas.length} fichas y ${mangueras.length} mangueras del tablero.`,
    )

  const compartir = async () => {
    const enlace = enlaceCompartir({ version: 1, piezas, mangueras })
    try {
      await navigator.clipboard.writeText(enlace)
      setAviso('Enlace copiado: pégalo para compartir este circuito.')
    } catch {
      window.prompt('Copia este enlace para compartir el circuito:', enlace)
    }
  }

  /** Nombre base de las descargas: sale del nombre y el título del trabajo. */
  const baseArchivo = () => [alumno.nombre, ejercicio].filter(Boolean).join('_') || 'circuito'

  /** Imagen del circuito o del diagrama, para pegar en el informe. */
  const exportarLamina = async (id: string, sufijo: string, formato: 'png' | 'svg') => {
    const svg = document.getElementById(id) as SVGSVGElement | null
    if (!svg) {
      setAviso(id.startsWith('diagrama-fase') ? 'Todavía no hay diagrama: acciona el circuito hasta que un cilindro complete una carrera.' : 'No hay nada que exportar todavía.')
      return
    }
    const archivo = nombreSeguro(`${baseArchivo()}_${sufijo}`, formato)
    try {
      if (formato === 'png') await exportarPng(svg, archivo)
      else exportarSvg(svg, archivo)
      setAviso(`Imagen descargada: ${archivo}`)
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo exportar la imagen.')
    }
  }

  /** El diagrama de fase vive en el panel inferior: se abre para exportarlo. */
  const exportarFase = () => void exportarLamina('diagrama-fase-exportar', 'diagrama-fase', 'png')

  /** Imágenes para «Entregar», tomadas del banco. */
  const capturarCircuito = async (): Promise<string | { error: string }> => {
    const svg = document.getElementById('pizarra-svg') as SVGSVGElement | null
    if (!svg || useStore.getState().piezas.length === 0) return { error: 'Primero arma el circuito en el banco.' }
    try {
      return await pngEmbebido(svg)
    } catch {
      return { error: 'No se pudo tomar la imagen del circuito.' }
    }
  }
  const capturarFase = async (): Promise<string | { error: string }> => {
    const svg = document.getElementById('diagrama-fase-exportar') as SVGSVGElement | null
    if (!svg || !hayDiagramaFase())
      return { error: 'Todavía no hay diagrama: pulsa ▶ Simular y acciona el circuito hasta que un cilindro complete una carrera.' }
    try {
      return await pngEmbebido(svg)
    } catch {
      return { error: 'No se pudo tomar la imagen del diagrama.' }
    }
  }

  const abrirArchivo = async (archivo: File | undefined) => {
    if (!archivo) return
    try {
      // Puede ser una entrega completa del alumno o un circuito suelto
      const crudo = JSON.parse(await archivo.text())
      if (esEntrega(crudo)) {
        cargarCircuito(crudo.circuito, `Entrega de ${crudo.alumno.nombre || 'sin nombre'}`)
        setAlumno(crudo.alumno)
        setEjercicio(crudo.ejercicio)
        setRespuestas(normalizarRespuestas(crudo.respuestas))
        setAviso(
          `Entrega de ${crudo.alumno.nombre || 'sin nombre'}${
            crudo.alumno.rol ? ` (${crudo.alumno.rol})` : ''
          } abierta: circuito y respuestas cargados.`,
        )
        return
      }
      const datos = await leerArchivo(archivo)
      cargarCircuito(datos, archivo.name.replace(/\.json$/i, ''))
      setAviso(`Circuito «${archivo.name}» abierto.`)
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo leer el archivo.')
    }
  }

  registrarFase(motor)
  const avisosCircuito =
    modo === 'editar' ? validarCircuito(circuitoDesdeStore(piezas, mangueras)) : (motor?.advertencias ?? [])
  const bancoVacio = piezas.length === 0
  const hayCortes = piezas.some((p) => p.tipo.startsWith('valvula') || p.tipo.startsWith('cilindro'))
  const simulando = modo === 'simular'

  // Registro «¿Qué está pasando?»: en orden, lo último abajo. Al detener se
  // conserva el último, para poder leerlo con calma.
  const ultimoRegistro = useRef<Array<{ t: number; mensaje: string }>>([])
  if (motor) ultimoRegistro.current = motor.eventos.slice(-300)
  const eventos = ultimoRegistro.current

  // Texto de la barra de estado según lo que está haciendo el alumno.
  const textoEstado = (() => {
    if (simulando)
      return tactil
        ? 'Simulando: mantén el dedo sobre las válvulas de pulsador · toca una biestable para conmutarla · toca la fuente para cortar el aire.'
        : 'Simulando: mantén pulsadas las válvulas de pulsador · clic en una biestable la conmuta · clic en la fuente corta el aire · Espacio detiene.'
    if (origenCable) return `Cableando desde ${origenCable.componente}.${origenCable.puerto}: ${tactil ? 'toca' : 'haz clic en'} el puerto de destino · Esc cancela.`
    if (seleccion?.clase === 'pieza') return `${seleccion.id} seleccionada: arrástrala para moverla · sus propiedades están a la derecha · Supr la borra.`
    if (seleccion?.clase === 'manguera') return `Manguera ${seleccion.id} seleccionada: Supr la quita.`
    if (avisosCircuito[0]) return `Siguiente: ${avisosCircuito[0]}`
    if (bancoVacio) return 'Modo edición: arrastra una ficha desde la paleta al tablero, o carga un ejemplo.'
    return tactil
      ? 'Modo edición: toca un puerto y luego el de destino para unirlos · toca una ficha para ver sus propiedades.'
      : 'Modo edición: arrastra fichas desde la paleta · clic cerca de un puerto para cablear · Espacio simula.'
  })()

  const playEscena = {
    etiqueta: simulando ? '■ Detener' : '▶ Simular',
    onClick: () => setModo(simulando ? 'editar' : 'simular'),
    titulo: bancoVacio ? 'Coloca al menos una ficha en el banco para poder simular' : 'Atajo: barra espaciadora',
    deshabilitado: bancoVacio,
    corriendo: simulando,
    detiene: true,
  }
  const botonSimular = (
    <button
      onClick={() => setModo(simulando ? 'editar' : 'simular')}
      disabled={bancoVacio}
      title={bancoVacio ? 'Coloca al menos una ficha en el banco para poder simular' : 'Atajo: barra espaciadora'}
      style={{ ...botonPrimario(simulando), ...(bancoVacio ? { background: '#dfe4ea', color: 'var(--tinta-suave)' } : {}), minHeight: 36, padding: estrecha ? '0.4rem 0.7rem' : '0.4rem 1rem' }}
      data-simular="si"
    >
      {simulando ? '■ Detener' : '▶ Simular'}
    </button>
  )
  const deshacerRehacer = !simulando && (
    <span style={{ display: 'flex', gap: 0 }}>
      <button onClick={deshacer} disabled={!puedeDeshacer} title="Deshacer (Ctrl+Z)" aria-label="Deshacer" className="boton-icono" style={{ opacity: puedeDeshacer ? 1 : 0.4 }}>
        <IconoDeshacer />
      </button>
      {!estrecha && (
        <button onClick={rehacer} disabled={!puedeRehacer} title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer" className="boton-icono" style={{ opacity: puedeRehacer ? 1 : 0.4 }}>
          <IconoRehacer />
        </button>
      )}
    </span>
  )
  const interruptorAire = (
    <button role="switch" aria-checked={aire} onClick={alternarAire} className="interruptor" title={aire ? 'Cortar el aire de la fuente' : 'Dar el aire'} data-aire="si">
      <span className="interruptor__riel" aria-hidden />
      Aire: <strong>{aire ? 'encendido' : 'cortado'}</strong>
    </button>
  )
  const selectorEjemplos = (
    <select
      value={circuito ? 'actual' : ''}
      title={circuito ? `Abierto: ${circuito.nombre}${circuito.modificado ? ' (modificado)' : ''}` : 'Cargar un circuito de ejemplo'}
      aria-label="Ejemplos"
      data-selector-ejemplos="si"
      onChange={(e) => {
        const n = Number(e.target.value) as NumeroEjemplo
        if (!n) return
        const etiqueta = EJEMPLOS.find((x) => x.n === n)?.etiqueta ?? ''
        if (confirmarDescarte(`¿Cargar el ejemplo «${etiqueta}»?`)) cargarEjemplo(n)
        e.target.value = circuito ? 'actual' : ''
      }}
      style={{ padding: '0.3rem 0.4rem', width: estrecha ? '25vw' : apilado ? 140 : 172, minHeight: 34, fontSize: '0.86rem' }}
    >
      <option value="">— Ejemplos —</option>
      {circuito && (
        <option value="actual" disabled>
          {circuito.nombre}
          {circuito.modificado ? ' (modificado)' : ''}
        </option>
      )}
      {EJEMPLOS.map((ej) => (
        <option key={ej.n} value={ej.n}>
          {ej.etiqueta}
        </option>
      ))}
    </select>
  )
  const guardarJson = () => {
    const base = baseArchivo()
    descargarJson({ version: 1, nombre: ejercicio || undefined, piezas, mangueras }, nombreSeguro(base === 'circuito' ? base : `${base}_circuito`, 'json'))
  }
  const itemsArchivo = [
    { texto: 'Nuevo diagrama', ayuda: 'Deja el tablero en blanco', onClick: () => confirmarDescarte('¿Empezar un diagrama nuevo?') && limpiarPizarra() },
    { texto: 'Abrir…', ayuda: 'Un circuito o una entrega (.json)', onClick: () => inputArchivo.current?.click() },
    { texto: 'Guardar', ayuda: 'Descarga el circuito para seguir editándolo', onClick: guardarJson },
    { texto: 'Mis trabajos…', ayuda: 'Guarda varios circuitos con nombre y cámbiate entre ellos', onClick: () => setMisTrabajos(true), separar: true },
    { texto: 'Copiar enlace para compartir', ayuda: 'El circuito viaja dentro del enlace', onClick: () => void compartir() },
  ]
  const itemsExportar = [
    { texto: 'Circuito (PNG)', ayuda: 'Imagen para pegar en el informe', onClick: () => void exportarLamina('pizarra-svg', 'circuito', 'png'), deshabilitado: bancoVacio, porque: 'Primero coloca fichas en el tablero' },
    { texto: 'Circuito (SVG)', ayuda: 'Dibujo vectorial, se amplía sin perder calidad', onClick: () => void exportarLamina('pizarra-svg', 'circuito', 'svg'), deshabilitado: bancoVacio, porque: 'Primero coloca fichas en el tablero' },
    {
      texto: 'Diagrama de fase (PNG)',
      ayuda: 'El diagrama espacio-fase de la simulación',
      onClick: () => exportarFase(),
      deshabilitado: !hayDiagramaFase(),
      porque: 'Simula y acciona el circuito hasta que un cilindro complete una carrera',
    },
    { texto: 'Circuito (JSON)', ayuda: 'El archivo del circuito: se vuelve a abrir en la app con «Abrir…»', onClick: guardarJson, separar: true, deshabilitado: bancoVacio, porque: 'Primero coloca fichas en el tablero' },
  ]
  const grupoZoom = (
    <span className="grupo-zoom" role="group" aria-label="Zoom del tablero">
      <button onClick={() => controles.current?.alejar()} title="Alejar" aria-label="Alejar">
        −
      </button>
      <button onClick={() => controles.current?.cien()} title="Volver al 100 %" style={{ minWidth: 48, fontWeight: 600, fontSize: '0.82rem' }} data-zoom="si">
        {zoom}%
      </button>
      <button onClick={() => controles.current?.acercar()} title="Acercar" aria-label="Acercar">
        +
      </button>
      <button onClick={() => controles.current?.ajustar()} title="Ajustar: ver todo el circuito" aria-label="Ajustar" data-ajustar="si">
        ⤢
      </button>
      {controles.current?.hayPantallaCompleta !== false && (
        <button onClick={() => controles.current?.pantallaCompleta()} title="Tablero a pantalla completa" aria-label="Pantalla completa">
          ⛶
        </button>
      )}
    </span>
  )
  const inputOculto = (
    <input
      ref={inputArchivo}
      type="file"
      accept="application/json,.json"
      className="u-oculto"
      onChange={(e) => {
        void abrirArchivo(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  const barraTiempo = (
    <BarraTiempo
      tiempo={motor?.t ?? 0}
      velocidad={velocidadSim}
      velocidades={[0.5, 1, 2]}
      onVelocidad={setVelocidadSim}
      onReiniciar={() => setReinicioSim((n) => n + 1)}
      deshabilitada={!simulando}
    />
  )
  /** Armar: el circuito ancho, con el panel en las propiedades. Probar: el circuito se pliega a la tira y la simulación ocupa el ancho. */
  const irAEtapa = (e: EtapaTrabajo) => {
    setEtapa(e)
    panel.onAbrir(true)
    if (e === 'probar') panel.onPestana('registro')
    else if (!simulando) panel.onPestana('propiedades')
  }
  const plegado = etapa === 'probar' && !celular && !apilado ? 'riel' : 'abierto'

  const areaCircuito = (
    <>
      <TituloArea
        derecha={
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {celular && (
              <button onClick={() => setHoja('paleta')} disabled={simulando} title={simulando ? 'Detén la simulación para editar' : 'Agregar componentes'}>
                ＋ Componentes
              </button>
            )}
            {grupoZoom}
          </span>
        }
      >
        Circuito
        <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--tinta-suave)' }}>Símbolos ISO 1219-1</span>
      </TituloArea>
      <div className="circuito-cuerpo">
        {!celular && (
          <>
            <div className={`banco__paleta${paletaPlegada ? ' banco__paleta--plegada' : ''}`} style={!paletaPlegada && anchoPaleta ? { width: anchoPaleta } : undefined}>
              <Paleta plegada={paletaPlegada} onPlegar={setPaletaPlegada} deshabilitada={simulando} />
            </div>
            {!paletaPlegada && <BordeAncho ancho={anchoPaleta} onAncho={setAnchoPaleta} min={180} max={360} lado={1} etiqueta="Cambiar el ancho de la paleta" />}
          </>
        )}
        <div className="circuito-lienzo">
          <Pizarra motor={motor} vista="esquema" llenar sinBarra controles={controles} onZoom={setZoom} />
        </div>
      </div>
    </>
  )

  const areaSimulacion = (
    <AreaSimulacionNeumatica
      motor={motor}
      vista={sinWebGL ? 'dentro' : vistaSim}
      onVista={(v) => setVistaGuardada(v === 'dentro' ? 'taller' : 'banco3d')}
      sinWebGL={sinWebGL}
      onSinWebGL={() => setSinWebGL(true)}
      play={playEscena}
      barraTiempo={barraTiempo}
    />
  )

  const pestanas: Array<PestanaPanel<PestanaNeumatica>> = [
    { id: 'propiedades', titulo: 'Propiedades', contador: avisosCircuito.length || undefined, contenido: <ContenidoPropiedades avisos={avisosCircuito} /> },
    { id: 'corte', titulo: 'Vista en corte', tituloCorto: 'Corte', contenido: <ContenidoCorte motor={motor} hayCortes={hayCortes} /> },
    { id: 'registro', titulo: '¿Qué está pasando?', tituloCorto: 'Registro', contador: eventos.length, contenido: <ContenidoRegistro motor={motor} eventos={eventos} />, seguirFinal: true },
    { id: 'fase', titulo: 'Diagrama espacio-fase', tituloCorto: 'Fase', contenido: <ContenidoFase motor={motor} /> },
  ]

  const barra = (
    <>
      {botonSimular}
      <BotonNuevo que="un diagrama" compacto={estrecha} deshabilitado={simulando} onClick={() => confirmarDescarte('¿Empezar un diagrama nuevo?') && limpiarPizarra()} />
      {deshacerRehacer}
      {selectorEjemplos}
      {/* Un solo interruptor decide qué ocupa la pantalla: armar el circuito o probarlo en el banco. */}
      {!celular && !apilado && <InterruptorEtapa etapa={etapa} onEtapa={irAEtapa} estrecha={estrecha} armar={['① Armar el circuito', '① Armar']} probar={['② Probar en el banco', '② Probar']} />}
      {!estrecha && simulando && interruptorAire}
      <span className="u-barra-derecha">
        {estrecha ? (
          <Menu
            etiqueta="⋯"
            datos="Mas"
            ancho={300}
            items={[
              { texto: 'Rehacer', onClick: rehacer, deshabilitado: !puedeRehacer || simulando, porque: 'No hay nada que rehacer' },
              { texto: aire ? 'Cortar el aire' : 'Dar el aire', ayuda: `Aire: ${aire ? 'encendido' : 'cortado'}`, onClick: alternarAire },
              ...itemsArchivo.map((it, i) => ({ ...it, separar: i === 0 })),
              ...itemsExportar.map((it, i) => ({ ...it, separar: i === 0 })),
              { texto: 'Guía de inicio', ayuda: 'Los cuatro pasos para partir', onClick: guia.abrir, separar: true },
              { texto: 'Gestos del banco', onClick: () => setAyuda(true) },
            ]}
          />
        ) : (
          <>
            <button onClick={() => setAyuda(true)} className="boton-icono" title="Ayuda: guía de inicio, atajos y gestos" aria-label="Ayuda" data-ayuda="si">
              ?
            </button>
            {apilado ? (
              // Ventana mediana: Archivo y Exportar juntos, para que la barra quepa en una línea.
              <Menu etiqueta="⋯" datos="Mas" items={[...itemsArchivo, ...itemsExportar.map((it, i) => ({ ...it, separar: i === 0 }))]} />
            ) : (
              <>
                <Menu etiqueta="Archivo" items={itemsArchivo} />
                <Menu etiqueta="Exportar" items={itemsExportar} />
              </>
            )}
          </>
        )}
        {inputOculto}
      </span>
    </>
  )

  const barraEstado = (
    <>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={textoEstado}>
        {textoEstado}
      </span>
      {!estrecha && (
        <span style={{ color: 'var(--tinta-suave)', whiteSpace: 'nowrap' }}>
          {piezas.length} fichas · {mangueras.length} mangueras
        </span>
      )}
      {!estrecha && avisosCircuito.length > 0 && (
        <button
          onClick={() => {
            panel.onAbrir(true)
            panel.onPestana('propiedades')
          }}
          style={{ border: 'none', background: 'transparent', color: 'var(--naranjo-texto)', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
        >
          ⚠ {avisosCircuito.length} {avisosCircuito.length === 1 ? 'aviso' : 'avisos'}
        </button>
      )}
      {!estrecha && (avisosCircuito.length > 0 || bancoVacio) && (
        <button
          type="button"
          onClick={() => {
            const ancla = /cascada|pilot|bloquean/i.test(avisosCircuito[0] ?? '') ? 'cascada' : /vdi|función|funcion/i.test(avisosCircuito[0] ?? '') ? 'vdi' : 'iso'
            try {
              window.history.replaceState(null, '', `#${ancla}`)
            } catch {
              /* sin historial */
            }
            setSeccion('estudiar')
          }}
          style={{ border: 'none', background: 'transparent', color: 'var(--azul)', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}
        >
          → Estudiar
        </button>
      )}
    </>
  )

  const subnav = (
    <nav className="subnav" aria-label="Neumática" style={subnavAparte ? { borderBottom: '1px solid #e0e5eb', margin: '0 -10px', padding: '0 10px', background: '#fff' } : undefined}>
      <button aria-current={seccion === 'laboratorio' ? 'page' : undefined} onClick={() => setSeccion('laboratorio')} data-seccion="laboratorio">
        Laboratorio
      </button>
      <button aria-current={seccion === 'estudiar' ? 'page' : undefined} onClick={() => setSeccion('estudiar')} data-seccion="estudiar">
        Estudiar
      </button>
      <button
        className="subnav__entrega"
        aria-expanded={entregaAbierta}
        onClick={() => {
          setSeccion('laboratorio')
          setEntregaAbierta((a) => !a)
        }}
        data-abrir-entrega="si"
        title="Descarga lo que pegas en tu presentación y el archivo que subes con tu tarea"
      >
        Entregar
      </button>
    </nav>
  )

  return (
    <>
      {ranura && !subnavAparte && createPortal(subnav, ranura)}
      {subnavAparte && <div style={{ padding: '0 10px' }}>{subnav}</div>}

      {seccion === 'laboratorio' ? (
        <>
      <BancoDividido<PestanaNeumatica>
        clave={CLAVES.neumaticaBanco}
        clase="banco--neumatica"
        divisionInicial={0.58}
        anchoMin={340}
        // La paleta y el tablero necesitan ancho para armar; con Entregar abierto manda la simulación.
        anchoFijoIzquierda={!entregaAbierta && !celular && !apilado ? 600 : undefined}
        plegado={plegado}
        onPlegado={(p) => irAEtapa(p === 'riel' ? 'probar' : 'armar')}
        riel={
          <>
            <span style={{ writingMode: 'vertical-rl', fontSize: '0.75rem', fontWeight: 700, color: 'var(--tinta-suave)', letterSpacing: '0.04em' }}>CIRCUITO</span>
            {/* La pizarra sigue montada, oculta, para poder exportar el circuito. */}
            <div className="u-oculto">
              <Pizarra motor={motor} vista="esquema" />
            </div>
          </>
        }
        barra={barra}
        izquierda={{ id: 'circuito', titulo: 'Circuito', contenido: areaCircuito }}
        derecha={{ id: 'simulacion', titulo: 'Simulación', tituloCorto: '3D', contenido: areaSimulacion }}
        inferior={entregaAbierta && !celular ? undefined : { etiqueta: 'Propiedades, corte, registro y diagrama', pestanas, estado: panel }}
        estado={barraEstado}
        conCajon={entregaAbierta && !celular}
        encabezado={<h1 className="solo-lector">Unidad 1 · Neumática — laboratorio</h1>}
      />
      {aviso && (
        <p role="status" style={estiloAviso}>
          {aviso}
        </p>
      )}

      {celular && hoja && (
        <>
          <div className="hoja-fondo" onClick={() => setHoja(null)} />
          <div className="hoja" role="dialog" aria-label="Componentes">
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px 4px' }}>
              <strong style={{ fontSize: '0.95rem' }}>Componentes</strong>
              <button onClick={() => setHoja(null)} className="boton-icono" style={{ marginLeft: 'auto' }} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Paleta deshabilitada={simulando} onElegida={() => setHoja(null)} />
            </div>
          </div>
        </>
      )}

      {ayuda && (
        <AyudaAtajos
          tactil={tactil}
          onCerrar={() => setAyuda(false)}
          onGuia={() => {
            setAyuda(false)
            guia.abrir()
          }}
        />
      )}
      {guia.visible && seccion === 'laboratorio' && !ayuda && <GuiaInicio unidad="Neumática" pasos={GUIA_NEUMATICA} onCerrar={guia.cerrar} />}
      {misTrabajos && (
        <MisTrabajos
          unidad="neumatica"
          nombreActual={circuito?.nombre ?? ''}
          actual={() => ({ version: 1, nombre: circuito?.nombre, piezas, mangueras, vdi: useStore.getState().respuestas.vdi })}
          abrir={(dato, nombre) => {
            if (!esCircuitoValido(dato)) return 'Ese trabajo no es un circuito válido.'
            setModo('editar')
            cargarCircuito(dato, nombre)
            const vdi = (dato as { vdi?: unknown }).vdi
            if (Array.isArray(vdi)) setRespuestas({ vdi })
          }}
          onCerrar={() => setMisTrabajos(false)}
        />
      )}

        </>
      ) : (
        <Suspense fallback={<p className="u-cargando">Abriendo Estudiar…</p>}>
          <PaginaNeumaticaEstudiar alCargarCircuito={() => setSeccion('laboratorio')} />
        </Suspense>
      )}

      {entregaAbierta && (
        <Suspense fallback={null}>
          <EntregaNeumatica
            onCerrar={() => setEntregaAbierta(false)}
            capturarCircuito={capturarCircuito}
            capturarFase={capturarFase}
            onEstudiar={(ancla) => {
              try {
                window.history.replaceState(null, '', `#${ancla}`)
              } catch {
                /* sin historial */
              }
              setEntregaAbierta(false)
              setSeccion('estudiar')
            }}
          />
        </Suspense>
      )}

      {/* Diagrama de fase fuera de la vista: de aquí salen el PNG y la imagen de la entrega. */}
      <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, width: 640, pointerEvents: 'none' }}>
        <DiagramaEspacioFase motor={motor} idSvg="diagrama-fase-exportar" />
      </div>
    </>
  )
}
