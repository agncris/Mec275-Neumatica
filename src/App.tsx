/**
 * NeumaLab — laboratorio virtual de neumática (MEC275).
 *
 * Dos modos, como un banco de taller:
 *  - Editar: colocar fichas, cablear puertos, ajustar parámetros.
 *  - Simular: el motor corre a 30 Hz; se accionan las válvulas y se ve el aire
 *    circular, las correderas conmutar y los vástagos moverse.
 */
import { BarraHerramientas, botonPrimario, botonSecundario, botonTerciario, CabeceraUnidad, COLOR, estiloAviso, Etiquetado, Menu, useTactil } from './components/ui'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { DT_POR_DEFECTO, Motor, validarCircuito } from './engine'
import Paleta from './components/Paleta'
import Pizarra, { type Vista } from './components/Pizarra'

// El banco 3D arrastra three.js: se carga sólo cuando alguien lo abre.
const Banco3D = lazy(() => import('./vista3d/Banco3D'))
type VistaApp = Vista | 'banco3d'
import Propiedades from './components/Propiedades'
import VistaCorte from './components/VistaCorte'
import DiagramaEspacioFase from './components/DiagramaEspacioFase'
import TablaNomenclatura from './components/TablaNomenclatura'
import { Seccion } from './components/Seccion'
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
import { exportarPng, exportarSvg, nombreSeguro } from './exportar'
import { esEntrega, normalizarRespuestas } from './entrega'

const EJEMPLOS: Array<{ n: NumeroEjemplo; etiqueta: string }> = ([1, 2, 3, 4, 5, 6, 7] as NumeroEjemplo[]).map((n) => ({ n, etiqueta: NOMBRES_EJEMPLO[n] }))

const CLAVE_CIRCUITO = 'neumalab.circuito-abierto'

/** Detecta pantallas estrechas para reordenar la interfaz en tablet/móvil. */
function useEsEstrecha(): boolean {
  const [estrecha, setEstrecha] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const alCambiar = (e: MediaQueryListEvent) => setEstrecha(e.matches)
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])
  return estrecha
}

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
  const [vista, setVista] = useState<VistaApp>('esquema')
  const [paralela, setParalela] = useState(false)
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
      setAviso(id === 'diagrama-fase-svg' ? 'Todavía no hay diagrama: acciona el circuito hasta que un cilindro complete una carrera.' : 'No hay nada que exportar todavía.')
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

  const eventos = motor ? motor.eventos.slice(-6).reverse() : []
  const avisosCircuito =
    modo === 'editar' ? validarCircuito(circuitoDesdeStore(piezas, mangueras)) : (motor?.advertencias ?? [])
  const bancoVacio = piezas.length === 0
  const hayCortes = piezas.some((p) => p.tipo.startsWith('valvula') || p.tipo.startsWith('cilindro'))

  return (
    <main style={{ maxWidth: 1320, margin: '0 auto', padding: estrecha ? '0.8rem' : '1.25rem 1.5rem' }}>
      <CabeceraUnidad titulo="Unidad 1 · Neumática" descripcion="Arma el circuito con la simbología ISO y simúlalo" />

      <BarraHerramientas
        derecha={
          <>
            <Menu
              etiqueta="Archivo"
              items={[
                { texto: 'Nuevo diagrama', ayuda: 'Deja el tablero en blanco', onClick: () => confirmarDescarte('¿Empezar un diagrama nuevo?') && limpiarPizarra() },
                { texto: 'Abrir…', ayuda: 'Un circuito o una entrega (.json)', onClick: () => inputArchivo.current?.click() },
                {
                  texto: 'Guardar',
                  ayuda: 'Descarga el circuito para seguir editándolo',
                  onClick: () => descargarJson({ version: 1, nombre: ejercicio || undefined, piezas, mangueras }, nombreSeguro(`${baseArchivo()}_circuito`, 'json')),
                },
                { texto: 'Copiar enlace para compartir', ayuda: 'El circuito viaja dentro del enlace', onClick: () => void compartir(), separar: true },
              ]}
            />
            <Menu
              etiqueta="Exportar"
              items={[
                { texto: 'Circuito (PNG)', ayuda: 'Imagen para pegar en el informe', onClick: () => void exportarLamina('pizarra-svg', 'circuito', 'png'), deshabilitado: bancoVacio, porque: 'Primero coloca fichas en el tablero' },
                { texto: 'Circuito (SVG)', ayuda: 'Dibujo vectorial, se amplía sin perder calidad', onClick: () => void exportarLamina('pizarra-svg', 'circuito', 'svg'), deshabilitado: bancoVacio, porque: 'Primero coloca fichas en el tablero' },
                {
                  texto: 'Diagrama de fase (PNG)',
                  ayuda: 'El diagrama espacio-fase de la simulación',
                  onClick: () => void exportarLamina('diagrama-fase-svg', 'diagrama-fase', 'png'),
                  deshabilitado: modo !== 'simular',
                  porque: 'Disponible mientras simulas (▶ Simular)',
                },
              ]}
            />
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
          </>
        }
      >
        <button
          onClick={() => setModo(modo === 'simular' ? 'editar' : 'simular')}
          disabled={bancoVacio}
          title={bancoVacio ? 'Coloca al menos una ficha en el banco para poder simular' : 'Atajo: barra espaciadora'}
          style={{ ...botonPrimario(modo === 'simular'), ...(bancoVacio ? { background: '#dfe4ea', color: '#51606f' } : {}) }}
        >
          {modo === 'simular' ? '■ Detener' : '▶ Simular'}
        </button>

        {modo === 'editar' && (
          <span style={{ display: 'flex', gap: 2 }}>
            <button onClick={deshacer} disabled={!puedeDeshacer} title="Deshacer (Ctrl+Z)" aria-label="Deshacer" style={{ ...botonTerciario, opacity: puedeDeshacer ? 1 : 0.4 }}>
              ↶ Deshacer
            </button>
            <button onClick={rehacer} disabled={!puedeRehacer} title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer" style={{ ...botonTerciario, opacity: puedeRehacer ? 1 : 0.4 }}>
              ↷
            </button>
          </span>
        )}

        {modo === 'simular' && (
          <button onClick={alternarAire} aria-pressed={aire} style={{ ...botonSecundario, color: aire ? '#fff' : COLOR.pizarra, background: aire ? COLOR.azul : '#fff' }}>
            Aire {aire ? 'ON' : 'OFF'}
          </button>
        )}

        <Etiquetado texto="Ejemplos">
          <select
            value={circuito ? 'actual' : ''}
            title={circuito ? `Abierto: ${circuito.nombre}${circuito.modificado ? ' (modificado)' : ''}` : undefined}
            data-selector-ejemplos="si"
            onChange={(e) => {
              const n = Number(e.target.value) as NumeroEjemplo
              if (!n) return
              const etiqueta = EJEMPLOS.find((x) => x.n === n)?.etiqueta ?? ''
              if (confirmarDescarte(`¿Cargar el ejemplo «${etiqueta}»?`)) cargarEjemplo(n)
              e.target.value = ''
            }}
            style={{ padding: '0.35rem 0.4rem', maxWidth: 'min(260px, calc(100vw - 120px))', minHeight: 36 }}
          >
            <option value="">— elige un circuito —</option>
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
        </Etiquetado>
      </BarraHerramientas>

      {aviso && (
        <p role="status" style={estiloAviso}>
          {aviso}
        </p>
      )}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexDirection: estrecha ? 'column' : 'row' }}>
        {modo === 'editar' && <Paleta horizontal={estrecha} />}
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <div
            style={{
              display: paralela ? 'grid' : 'block',
              gridTemplateColumns: paralela ? 'repeat(auto-fit, minmax(320px, 1fr))' : undefined,
              gap: 10,
            }}
          >
            <div style={{ maxWidth: '100%' }}>
              {paralela && <p style={rotuloVista}>Esquema · simbología ISO 1219-1</p>}
              {!paralela && vista === 'banco3d' ? (
                <>
                  <Suspense fallback={<p style={{ padding: 20, color: '#5a6b7d' }}>Montando el banco…</p>}>
                    <Banco3D motor={motor} />
                  </Suspense>
                  {/* La pizarra sigue montada, oculta, para poder exportar el circuito. */}
                  <div style={{ display: 'none' }}>
                    <Pizarra motor={motor} vista="esquema" />
                  </div>
                </>
              ) : (
                <Pizarra motor={motor} vista={paralela || vista === 'banco3d' ? 'esquema' : vista} />
              )}
            </div>
            {paralela && (
              <div style={{ maxWidth: '100%' }}>
                <p style={rotuloVista}>Taller · el componente por dentro</p>
                <Pizarra
                  motor={motor}
                  vista="taller"
                  soloLectura
                  id="pizarra-taller-svg"
                />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '6px 2px 0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#5a6b7d' }}>Vista:</span>
            {(
              [
                ['esquema', 'Esquema'],
                ['taller', 'Taller'],
                ['banco3d', 'Banco 3D'],
              ] as Array<[VistaApp, string]>
            ).map(([v, etiqueta]) => (
              <button
                key={v}
                onClick={() => {
                  setVista(v)
                  setParalela(false)
                }}
                disabled={paralela}
                style={{
                  ...botonSuave,
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.78rem',
                  opacity: paralela ? 0.5 : 1,
                  background: !paralela && vista === v ? '#33475c' : '#fff',
                  color: !paralela && vista === v ? '#fff' : '#33475c',
                }}
              >
                {etiqueta}
              </button>
            ))}
            <button
              onClick={() => setParalela((p) => !p)}
              title="Muestra el esquema y el taller a la vez, sincronizados"
              style={{
                ...botonSuave,
                padding: '0.15rem 0.5rem',
                fontSize: '0.78rem',
                background: paralela ? '#0e7a43' : '#fff',
                color: paralela ? '#fff' : '#33475c',
              }}
            >
              {paralela ? '✓ En paralelo' : 'Ver en paralelo'}
            </button>
            <span style={{ width: 10 }} />
            <span style={{ fontSize: '0.8rem', color: '#5a6b7d' }}>
              {tactil
                ? 'Dos dedos para acercar o alejar · arrastra el fondo para moverte · «Ajustar» encuadra todo el circuito'
                : 'Rueda para zoom · arrastra el fondo para moverte · los botones del panel ajustan la vista y la abren a pantalla completa'}
            </span>
          </div>
          <p style={{ margin: '6px 2px', fontSize: '0.82rem', color: '#5a6b7d' }}>
            {modo === 'editar'
              ? tactil
                ? 'Toca una ficha de la paleta para agregarla (o arrástrala) · toca un puerto y luego el de destino para unirlos · toca una ficha para ver sus propiedades'
                : 'Clic cerca de un puerto para cablear (son magnéticos) · Supr borra la selección · Esc cancela · Espacio simula'
              : tactil
                ? 'Mantén el dedo sobre las válvulas de pulsador · toca una biestable para conmutarla · toca la fuente para cortar el aire'
                : 'Mantén pulsadas las válvulas de pulsador · clic en una biestable la conmuta a mano · clic en la fuente corta el aire'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <section style={{ ...tarjeta, flex: '2 1 380px', minWidth: 0 }}>
          {modo === 'editar' ? (
            <>
              <h2 style={subtitulo}>Propiedades</h2>
              <Propiedades />
            </>
          ) : (
            <>
              <h2 style={subtitulo}>¿Qué está pasando?</h2>
              {eventos.length === 0 ? (
                <p style={{ color: '#5a6b7d', margin: 0 }}>
                  Simulación corriendo. Acciona una válvula para ver los eventos.
                </p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.6 }}>
                  {eventos.map((e, i) => (
                    <li key={`${e.t}-${i}`} style={{ opacity: i === 0 ? 1 : 0.6 }}>
                      <code>t={e.t.toFixed(1)}s</code> — {e.mensaje}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {avisosCircuito.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {avisosCircuito.map((a, i) => (
                <p key={i} style={{ color: '#8a5b00', margin: '3px 0', fontSize: '0.87rem' }}>
                  ⚠ {a}
                </p>
              ))}
            </div>
          )}
        </section>

        {hayCortes && (
          <section style={{ ...tarjeta, flex: '1 1 360px', maxWidth: estrecha ? '100%' : 540, minWidth: 0 }}>
            <h2 style={subtitulo}>Vista en corte — así funciona por dentro</h2>
            <VistaCorte motor={motor} />
          </section>
        )}
      </div>

      {modo === 'simular' && (
        <section style={tarjeta}>
          <h2 style={subtitulo}>Diagrama espacio-fase (recorrido-tiempo)</h2>
          <DiagramaEspacioFase motor={motor} />
        </section>
      )}

      <section style={tarjeta}>
        <Seccion
          titulo={
            alumno.nombre
              ? `Mi entrega · ${alumno.nombre}${alumno.rol ? ` (${alumno.rol})` : ''}`
              : 'Mi entrega · responder el enunciado y descargar'
          }
        >
          <PanelEntrega />
        </Seccion>
      </section>

      <section style={tarjeta}>
        <Seccion titulo="Método cascada · secuencias con señales bloqueantes">
          <MetodoCascada />
        </Seccion>
      </section>

      <section style={tarjeta}>
        <Seccion titulo="Simbología VDI 2860 · funciones de manipulación">
          <SimbologiaVDI />
        </Seccion>
      </section>

      <section style={tarjeta}>
        <Seccion titulo="Simbología ISO 1219-1 · componentes neumáticos">
          <SimbologiaISO />
        </Seccion>
      </section>

      <section style={tarjeta}>
        <Seccion titulo="Nº de vías y posiciones · nomenclatura de los orificios">
          <TablaNomenclatura />
        </Seccion>
      </section>

      <footer style={{ margin: '1.5rem 0 0.5rem', color: '#5f6b78', fontSize: '0.8rem', textAlign: 'center' }}>
        NeumaLab · MEC275 — Neumática industrial · Simbología ISO 1219-1
      </footer>
    </main>
  )
}

const tarjeta: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e0e5eb',
  borderRadius: 10,
  padding: '1rem 1.25rem',
  marginTop: 12,
  boxShadow: '0 1px 3px rgba(28, 39, 51, 0.06)',
}

const subtitulo: React.CSSProperties = {
  margin: '0 0 0.6rem',
  fontSize: '1rem',
  color: '#33475c',
}

const rotuloVista: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#5a6b7d',
  letterSpacing: '0.02em',
}

const botonSuave: React.CSSProperties = {
  border: '1px solid #c6ced6',
  background: '#fff',
  color: '#33475c',
  borderRadius: 6,
  padding: '0.35rem 0.7rem',
  cursor: 'pointer',
  fontSize: '0.84rem',
}
