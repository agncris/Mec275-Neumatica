/**
 * NeumaLab — laboratorio virtual de neumática (MEC275).
 *
 * Dos modos, como un banco de taller:
 *  - Editar: colocar fichas, cablear puertos, ajustar parámetros.
 *  - Simular: el motor corre a 30 Hz; se accionan las válvulas y se ve el aire
 *    circular, las correderas conmutar y los vástagos moverse.
 */
import { botonPrimario, estiloAviso, Menu, useEsEstrecha, usePersistente, useTactil } from './components/ui'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import DiagramaEspacioFase, { hayDiagramaFase, registrarFase } from './components/DiagramaEspacioFase'
import { DT_POR_DEFECTO, Motor, validarCircuito } from './engine'
import Paleta from './components/Paleta'
import Pizarra, { type ControlesPizarra, type Vista } from './components/Pizarra'
import Inspector, { type PestanaInspector } from './components/banco/Inspector'
import PaginaEstudiar from './components/banco/PaginaEstudiar'
import PanelInferior, { type PestanaInferior } from './components/banco/PanelInferior'
import AyudaAtajos from './components/banco/AyudaAtajos'

// El banco 3D arrastra three.js: se carga sólo cuando alguien lo abre.
const Banco3D = lazy(() => import('./vista3d/Banco3D'))
type VistaApp = Vista | 'banco3d' | 'ambos'
import TablaNomenclatura from './components/TablaNomenclatura'
import MetodoCascada from './components/MetodoCascada'
import SimbologiaVDI from './components/SimbologiaVDI'
import SimbologiaISO from './components/SimbologiaISO'
import PanelEntrega from './components/PanelEntrega'
import { circuitoDesdeStore, useStore, type NumeroEjemplo } from './store'
import { NOMBRES_EJEMPLO } from './circuitos/ejemplos'
import {
  descargarJson,
  enlaceCompartir,
  guardarLocal,
  leerArchivo,
  leerDeUrl,
  leerLocal,
} from './persistencia'
import { exportarPng, exportarSvg, nombreSeguro, pngEmbebido } from './exportar'
import { esEntrega, normalizarRespuestas } from './entrega'

const EJEMPLOS: Array<{ n: NumeroEjemplo; etiqueta: string }> = ([1, 2, 3, 4, 5, 6, 7] as NumeroEjemplo[]).map((n) => ({ n, etiqueta: NOMBRES_EJEMPLO[n] }))

const CLAVE_CIRCUITO = 'neumalab.circuito-abierto'

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
  const [, setFotograma] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const [vista, setVista] = usePersistente<VistaApp>('neumalab.banco.vista', 'esquema')
  const [paletaPlegada, setPaletaPlegada] = usePersistente('neumalab.banco.paleta-plegada', false)
  const [inspectorAbierto, setInspectorAbierto] = usePersistente('neumalab.banco.inspector', true)
  const [pestanaInspector, setPestanaInspector] = useState<PestanaInspector>('propiedades')
  const [inferiorAbierto, setInferiorAbierto] = usePersistente('neumalab.banco.inferior', false)
  const [altoInferior, setAltoInferior] = usePersistente('neumalab.banco.alto-inferior', typeof window === 'undefined' ? 200 : Math.round(Math.min(200, Math.max(130, window.innerHeight * 0.2))))
  const [inferiorAmpliado, setInferiorAmpliado] = usePersistente('neumalab.banco.inferior-ampliado', false)
  const [pestanaInferior, setPestanaInferior] = useState<PestanaInferior>('registro')
  const [hoja, setHoja] = useState<'paleta' | 'inspector' | 'registro' | null>(null)
  // Laboratorio (el banco) o Estudiar; «Mi entrega» es un cajón sobre el laboratorio.
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
      if (seccion !== 'estudiar' && /^#(cascada|vdi|iso|vias)$/.test(url.hash)) url.hash = ''
      if (url.href !== window.location.href) window.history.replaceState(null, '', url)
    } catch {
      /* sin historial */
    }
  }, [seccion, entregaAbierta])
  const [ayuda, setAyuda] = useState(false)
  const [zoom, setZoom] = useState(100)
  const controles = useRef<ControlesPizarra | null>(null)
  const seleccion = useStore((s) => s.seleccion)
  const origenCable = useStore((s) => s.origenCable)

  // Al elegir una ficha se abre el inspector con sus propiedades.
  useEffect(() => {
    if (seleccion?.clase !== 'pieza') return
    if (!estrecha) setInspectorAbierto(true)
    setPestanaInspector((p) => (p === 'corte' ? p : 'propiedades'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion])
  // Al simular se abre el registro.
  useEffect(() => {
    if (modo !== 'simular') return
    setInferiorAbierto(true)
    setPestanaInferior('registro')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo])
  const estrecha = useEsEstrecha()
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
      try {
        const c = JSON.parse(localStorage.getItem(CLAVE_CIRCUITO) ?? 'null')
        if (c && typeof c.nombre === 'string') useStore.setState({ circuito: { nombre: c.nombre, ejemplo: c.ejemplo, modificado: !!c.modificado } })
      } catch {
        /* sin almacenamiento */
      }
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
    try {
      localStorage.setItem(CLAVE_CIRCUITO, JSON.stringify(circuito))
    } catch {
      /* sin almacenamiento */
    }
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
    const intervalo = setInterval(() => {
      nuevoMotor.tick(DT_POR_DEFECTO)
      setFotograma((f) => f + 1)
    }, 1000 / 30)
    return () => {
      clearInterval(intervalo)
      setMotor(null)
    }
  }, [modo])

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

  /** Nombre base de las descargas: sale de los datos de «Mi entrega». */
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

  /** Imágenes para «Mi entrega», tomadas del banco. */
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

  const zonaVista: Array<[VistaApp, string, string]> = [
    ['esquema', 'Esquema', 'Símbolos ISO 1219-1'],
    ['taller', 'Taller', 'Los componentes por dentro'],
    ['banco3d', '3D', 'El banco en tres dimensiones'],
    ['ambos', 'Esquema+Taller', 'Esquema y taller a la vez, sincronizados'],
  ]

  // Texto de la barra de estado según lo que está haciendo el alumno.
  const textoEstado = (() => {
    if (simulando)
      return tactil
        ? 'Simulando: mantén el dedo sobre las válvulas de pulsador · toca una biestable para conmutarla · toca la fuente para cortar el aire.'
        : 'Simulando: mantén pulsadas las válvulas de pulsador · clic en una biestable la conmuta · clic en la fuente corta el aire · Espacio detiene.'
    if (origenCable) return `Cableando desde ${origenCable.componente}.${origenCable.puerto}: ${tactil ? 'toca' : 'haz clic en'} el puerto de destino · Esc cancela.`
    if (seleccion?.clase === 'pieza') return `${seleccion.id} seleccionada: arrástrala para moverla · sus propiedades están a la derecha · Supr la borra.`
    if (seleccion?.clase === 'manguera') return `Manguera ${seleccion.id} seleccionada: Supr la quita.`
    if (bancoVacio) return 'Modo edición: arrastra una ficha desde la paleta al tablero, o carga un ejemplo.'
    return tactil
      ? 'Modo edición: toca un puerto y luego el de destino para unirlos · toca una ficha para ver sus propiedades.'
      : 'Modo edición: arrastra fichas desde la paleta · clic cerca de un puerto para cablear · Espacio simula.'
  })()

  const botonSimular = (
    <button
      onClick={() => setModo(simulando ? 'editar' : 'simular')}
      disabled={bancoVacio}
      title={bancoVacio ? 'Coloca al menos una ficha en el banco para poder simular' : 'Atajo: barra espaciadora'}
      style={{ ...botonPrimario(simulando), ...(bancoVacio ? { background: '#dfe4ea', color: '#51606f' } : {}), minHeight: 36, padding: estrecha ? '0.4rem 0.7rem' : '0.4rem 1rem' }}
      data-simular="si"
    >
      {simulando ? '■ Detener' : '▶ Simular'}
    </button>
  )
  const deshacerRehacer = !simulando && (
    <span style={{ display: 'flex', gap: 0 }}>
      <button onClick={deshacer} disabled={!puedeDeshacer} title="Deshacer (Ctrl+Z)" aria-label="Deshacer" className="boton-icono" style={{ opacity: puedeDeshacer ? 1 : 0.4 }}>
        ↶
      </button>
      {!estrecha && (
        <button onClick={rehacer} disabled={!puedeRehacer} title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer" className="boton-icono" style={{ opacity: puedeRehacer ? 1 : 0.4 }}>
          ↷
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
      style={{ padding: '0.3rem 0.4rem', width: estrecha ? '34vw' : 172, minHeight: 34, fontSize: '0.86rem' }}
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
  const itemsArchivo = [
    { texto: 'Nuevo diagrama', ayuda: 'Deja el tablero en blanco', onClick: () => confirmarDescarte('¿Empezar un diagrama nuevo?') && limpiarPizarra() },
    { texto: 'Abrir…', ayuda: 'Un circuito o una entrega (.json)', onClick: () => inputArchivo.current?.click() },
    {
      texto: 'Guardar',
      ayuda: 'Descarga el circuito para seguir editándolo',
      onClick: () => descargarJson({ version: 1, nombre: ejercicio || undefined, piezas, mangueras }, nombreSeguro(`${baseArchivo()}_circuito`, 'json')),
    },
    { texto: 'Copiar enlace para compartir', ayuda: 'El circuito viaja dentro del enlace', onClick: () => void compartir(), separar: true },
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
  ]
  const zoomHabilitado = vista !== 'banco3d'
  const grupoZoom = (
    <span className="grupo-zoom" role="group" aria-label="Zoom del tablero">
      <button onClick={() => controles.current?.alejar()} disabled={!zoomHabilitado} title="Alejar" aria-label="Alejar">
        −
      </button>
      <button onClick={() => controles.current?.cien()} disabled={!zoomHabilitado} title="Volver al 100 %" style={{ minWidth: 48, fontWeight: 600, fontSize: '0.82rem' }} data-zoom="si">
        {zoomHabilitado ? `${zoom}%` : '—'}
      </button>
      <button onClick={() => controles.current?.acercar()} disabled={!zoomHabilitado} title="Acercar" aria-label="Acercar">
        +
      </button>
      <button onClick={() => controles.current?.ajustar()} disabled={!zoomHabilitado} title="Ajustar: ver todo el circuito" aria-label="Ajustar" data-ajustar="si">
        ⤢
      </button>
      {controles.current?.hayPantallaCompleta !== false && (
        <button onClick={() => controles.current?.pantallaCompleta()} disabled={!zoomHabilitado} title="Tablero a pantalla completa" aria-label="Pantalla completa">
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
      style={{ display: 'none' }}
      onChange={(e) => {
        void abrirArchivo(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  const lienzo = (
    <div className="banco__lienzo" data-vista={vista}>
      {vista === 'banco3d' ? (
        <>
          <Suspense fallback={<p style={{ padding: 20, color: '#51606f' }}>Montando el banco…</p>}>
            <Banco3D motor={motor} llenar />
          </Suspense>
          {/* La pizarra sigue montada, oculta, para poder exportar el circuito. */}
          <div style={{ display: 'none' }}>
            <Pizarra motor={motor} vista="esquema" />
          </div>
        </>
      ) : (
        <>
          <div>
            {vista === 'ambos' && <span style={rotuloVista}>Esquema · ISO 1219-1</span>}
            <Pizarra motor={motor} vista={vista === 'taller' ? 'taller' : 'esquema'} llenar sinBarra controles={controles} onZoom={setZoom} />
          </div>
          {vista === 'ambos' && (
            <div>
              <span style={rotuloVista}>Taller · por dentro</span>
              <Pizarra motor={motor} vista="taller" soloLectura id="pizarra-taller-svg" llenar sinBarra />
            </div>
          )}
        </>
      )}
    </div>
  )

  const panelInferior = (
    <PanelInferior
      abierto={inferiorAbierto}
      onAbrir={setInferiorAbierto}
      alto={altoInferior}
      onAlto={setAltoInferior}
      ampliado={inferiorAmpliado}
      onAmpliar={setInferiorAmpliado}
      pestana={pestanaInferior}
      onPestana={setPestanaInferior}
      motor={motor}
      eventos={eventos}
    />
  )
  const inspector = (
    <Inspector
      pestana={pestanaInspector}
      onPestana={setPestanaInspector}
      onPlegar={() => (estrecha ? setHoja(null) : setInspectorAbierto(false))}
      motor={motor}
      avisos={avisosCircuito}
      hayCortes={hayCortes}
    />
  )

  const subnav = (
    <nav className="subnav" aria-label="Neumática" style={estrecha ? { borderBottom: '1px solid #e0e5eb', margin: '0 -10px', padding: '0 10px', background: '#fff' } : undefined}>
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
        title="Responder el enunciado y descargar la entrega, viendo tu circuito"
      >
        Mi entrega{alumno.nombre ? ` · ${alumno.nombre.split(' ')[0]}` : ''}
      </button>
    </nav>
  )

  return (
    <>
      {ranura && !estrecha && createPortal(subnav, ranura)}
      {estrecha && <div style={{ padding: '0 10px' }}>{subnav}</div>}

      {seccion === 'laboratorio' ? (
        <>
      <main className="banco" aria-label="Laboratorio de neumática" style={estrecha ? { height: 'calc(100dvh - var(--alto-barra-superior) - 45px)' } : entregaAbierta ? { marginRight: 480 } : undefined}>
        <h1 className="solo-lector">Unidad 1 · Neumática — laboratorio</h1>
        <div className="banco__barra" role="toolbar" aria-label="Herramientas del banco">
          {botonSimular}
          {deshacerRehacer}
          {selectorEjemplos}
          {!estrecha && (
            <span className="segmentado" role="radiogroup" aria-label="Vista">
              {zonaVista.map(([v, t, ayuda]) => (
                <button key={v} role="radio" aria-checked={vista === v} onClick={() => setVista(v)} title={ayuda} data-vista-boton={v}>
                  {t}
                </button>
              ))}
            </span>
          )}
          {!estrecha && grupoZoom}
          {!estrecha && simulando && interruptorAire}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {estrecha ? (
              <Menu
                etiqueta="⋯"
                datos="Mas"
                ancho={300}
                items={[
                  ...zonaVista.map(([v, t]) => ({ texto: `${vista === v ? '✓ ' : ''}Vista: ${t}`, onClick: () => setVista(v) })),
                  { texto: 'Ajustar el tablero', ayuda: 'Ver todo el circuito', onClick: () => controles.current?.ajustar(), separar: true },
                  { texto: 'Rehacer', onClick: rehacer, deshabilitado: !puedeRehacer || simulando, porque: 'No hay nada que rehacer' },
                  { texto: aire ? 'Cortar el aire' : 'Dar el aire', ayuda: `Aire: ${aire ? 'encendido' : 'cortado'}`, onClick: alternarAire },
                  ...itemsArchivo.map((it, i) => ({ ...it, separar: i === 0 })),
                  ...itemsExportar.map((it, i) => ({ ...it, separar: i === 0 })),
                  { texto: 'Gestos del banco', onClick: () => setAyuda(true), separar: true },
                ]}
              />
            ) : (
              <>
                <Menu etiqueta="Archivo" items={itemsArchivo} />
                <Menu etiqueta="Exportar" items={itemsExportar} />
                <button onClick={() => setAyuda(true)} className="boton-icono" style={{ border: '1px solid #c6ced6', background: '#fff', minWidth: 36, minHeight: 36 }} title="Atajos y gestos" aria-label="Atajos y gestos" data-ayuda="si">
                  ?
                </button>
              </>
            )}
            {inputOculto}
          </span>
        </div>

        {aviso && (
          <p role="status" style={estiloAviso}>
            {aviso}
          </p>
        )}

        {estrecha ? (
          <>
            {lienzo}
            <div className="banco__acciones-movil">
              <button onClick={() => setHoja('paleta')} disabled={simulando} title={simulando ? 'Detén la simulación para editar' : undefined}>
                ＋ Componentes
              </button>
              <button onClick={() => setHoja('inspector')}>Propiedades{avisosCircuito.length ? ` ⚠${avisosCircuito.length}` : ''}</button>
              <button onClick={() => setHoja('registro')}>Registro</button>
            </div>
          </>
        ) : (
          <div className="banco__cuerpo">
            <div className={`banco__paleta${paletaPlegada ? ' banco__paleta--plegada' : ''}`}>
              <Paleta plegada={paletaPlegada} onPlegar={setPaletaPlegada} deshabilitada={simulando} />
            </div>
            <div className="banco__centro">
              {lienzo}
              {panelInferior}
            </div>
            {!entregaAbierta && (
            <div className={`banco__inspector${inspectorAbierto ? '' : ' banco__inspector--plegado'}`}>
              {inspectorAbierto ? (
                inspector
              ) : (
                <div className="banco-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                  <button onClick={() => setInspectorAbierto(true)} className="boton-icono" title="Abrir el inspector (propiedades y vista en corte)" aria-label="Abrir el inspector">
                    «
                  </button>
                  {avisosCircuito.length > 0 && (
                    <span title={`${avisosCircuito.length} avisos del circuito`} style={{ marginTop: 6, color: '#7a4f00', fontSize: '0.8rem', fontWeight: 700 }}>
                      ⚠{avisosCircuito.length}
                    </span>
                  )}
                </div>
              )}
            </div>
            )}
          </div>
        )}

        <div className="banco__estado" role="status" aria-live="polite" data-estado-banco="si">
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={textoEstado}>
            {textoEstado}
          </span>
          {!estrecha && (
            <span style={{ color: '#51606f', whiteSpace: 'nowrap' }}>
              {piezas.length} fichas · {mangueras.length} mangueras
            </span>
          )}
          {!estrecha && avisosCircuito.length > 0 && (
            <button
              onClick={() => {
                setInspectorAbierto(true)
                setPestanaInspector('propiedades')
              }}
              style={{ border: 'none', background: 'transparent', color: '#7a4f00', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
            >
              ⚠ {avisosCircuito.length} {avisosCircuito.length === 1 ? 'aviso' : 'avisos'}
            </button>
          )}
        </div>
      </main>

      {estrecha && hoja && (
        <>
          <div className="hoja-fondo" onClick={() => setHoja(null)} />
          <div className="hoja" role="dialog" aria-label={hoja === 'paleta' ? 'Componentes' : hoja === 'inspector' ? 'Propiedades' : 'Registro'}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px 4px' }}>
              <strong style={{ fontSize: '0.95rem' }}>{hoja === 'paleta' ? 'Componentes' : hoja === 'inspector' ? 'Propiedades y vista en corte' : 'Registro y diagrama'}</strong>
              <button onClick={() => setHoja(null)} className="boton-icono" style={{ marginLeft: 'auto' }} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {hoja === 'paleta' && <Paleta deshabilitada={simulando} onElegida={() => setHoja(null)} />}
              {hoja === 'inspector' && inspector}
              {hoja === 'registro' && (
                <PanelInferior
                  abierto
                  fijo
                  onAbrir={() => undefined}
                  alto={Math.round(window.innerHeight * 0.6)}
                  onAlto={() => undefined}
                  pestana={pestanaInferior}
                  onPestana={setPestanaInferior}
                  motor={motor}
                  eventos={eventos}
                />
              )}
            </div>
          </div>
        </>
      )}

      {ayuda && <AyudaAtajos tactil={tactil} onCerrar={() => setAyuda(false)} />}

        </>
      ) : (
        <PaginaNeumaticaEstudiar alCargarCircuito={() => setSeccion('laboratorio')} />
      )}

      {entregaAbierta && (
        <aside className="cajon" aria-label="Mi entrega" data-cajon-entrega="si">
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #e0e5eb' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Mi entrega{alumno.nombre ? ` · ${alumno.nombre}` : ''}</h2>
            <button onClick={() => setEntregaAbierta(false)} className="boton-icono" style={{ marginLeft: 'auto' }} aria-label="Cerrar Mi entrega" title="Cerrar (tu trabajo queda guardado en este navegador)">
              ✕
            </button>
          </div>
          <div style={{ overflowY: 'auto', padding: '12px 16px 24px', flex: 1 }}>
            <PanelEntrega capturarCircuito={capturarCircuito} capturarFase={capturarFase} />
          </div>
        </aside>
      )}

      {/* Diagrama de fase fuera de la vista: de aquí salen el PNG y la imagen de la entrega. */}
      <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, width: 640, pointerEvents: 'none' }}>
        <DiagramaEspacioFase motor={motor} idSvg="diagrama-fase-exportar" />
      </div>
    </>
  )
}

/** «Estudiar»: la teoría y las autoevaluaciones de la unidad, con índice. */
function PaginaNeumaticaEstudiar({ alCargarCircuito }: { alCargarCircuito: () => void }) {
  return (
    <PaginaEstudiar
      etiqueta="Estudiar neumática"
      titulo="Estudiar · Neumática"
      descripcion="Teoría y autoevaluaciones de la unidad. Los circuitos de ejemplo se abren en el Laboratorio."
      pie="NeumaLab · MEC275 — Neumática industrial · Simbología ISO 1219-1"
      secciones={[
        { id: 'cascada', indice: 'Método cascada', titulo: 'Método cascada · secuencias con señales bloqueantes', contenido: <MetodoCascada alCargar={alCargarCircuito} /> },
        { id: 'vdi', indice: 'Simbología VDI 2860', titulo: 'Simbología VDI 2860 · funciones de manipulación', contenido: <SimbologiaVDI /> },
        { id: 'iso', indice: 'Simbología ISO 1219-1', titulo: 'Simbología ISO 1219-1 · componentes neumáticos', contenido: <SimbologiaISO /> },
        { id: 'vias', indice: 'Nº de vías y posiciones', titulo: 'Nº de vías y posiciones · nomenclatura de los orificios', contenido: <TablaNomenclatura /> },
      ]}
    />
  )
}

const rotuloVista: React.CSSProperties = {
  position: 'absolute',
  left: 10,
  bottom: 8,
  zIndex: 4,
  padding: '2px 8px',
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid #d0d5db',
  borderRadius: 6,
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#33475c',
}

