/**
 * NeumaLab — laboratorio virtual de neumática (MEC275).
 *
 * Dos modos, como un banco de taller:
 *  - Editar: colocar fichas, cablear puertos, ajustar parámetros.
 *  - Simular: el motor corre a 30 Hz; se accionan las válvulas y se ve el aire
 *    circular, las correderas conmutar y los vástagos moverse.
 */
import { useEffect, useRef, useState } from 'react'
import { DT_POR_DEFECTO, Motor, validarCircuito } from './engine'
import Paleta from './components/Paleta'
import Pizarra from './components/Pizarra'
import Propiedades from './components/Propiedades'
import VistaCorte from './components/VistaCorte'
import DiagramaEspacioFase from './components/DiagramaEspacioFase'
import TablaNomenclatura from './components/TablaNomenclatura'
import { circuitoDesdeStore, useStore, type NumeroEjemplo } from './store'
import {
  descargarJson,
  enlaceCompartir,
  guardarLocal,
  leerArchivo,
  leerDeUrl,
  leerLocal,
} from './persistencia'

const EJEMPLOS: Array<{ n: NumeroEjemplo; etiqueta: string }> = [
  { n: 1, etiqueta: '1 · Simple efecto con 3/2' },
  { n: 2, etiqueta: '2 · Control de velocidad' },
  { n: 3, etiqueta: '3 · Biestable con memoria' },
  { n: 4, etiqueta: '4 · Ciclo automático (finales de carrera)' },
  { n: 5, etiqueta: '5 · Mando bimanual (válvula Y)' },
  { n: 6, etiqueta: '6 · Encadenar dos cilindros (rodillo)' },
]

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
  const {
    setModo,
    setAire,
    cargarEjemplo,
    cargarCircuito,
    limpiarPizarra,
    borrarSeleccion,
    cancelarCable,
  } = useStore()

  const [motor, setMotor] = useState<Motor | null>(null)
  const [, setFotograma] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const estrecha = useEsEstrecha()
  const inputArchivo = useRef<HTMLInputElement>(null)

  // --- carga inicial: primero la URL compartida, si no la copia local -------
  useEffect(() => {
    const deUrl = leerDeUrl()
    if (deUrl) {
      cargarCircuito(deUrl)
      setAviso('Circuito abierto desde un enlace compartido.')
      return
    }
    const local = leerLocal()
    if (local && local.piezas.length > 0) cargarCircuito(local)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pegar un enlace en una pestaña ya abierta sólo cambia el fragmento y no
  // recarga la página: hay que atender el cambio para abrir ese circuito.
  useEffect(() => {
    const alCambiarHash = () => {
      const deUrl = leerDeUrl()
      if (deUrl) {
        cargarCircuito(deUrl)
        setAviso('Circuito abierto desde un enlace compartido.')
      }
    }
    window.addEventListener('hashchange', alCambiarHash)
    return () => window.removeEventListener('hashchange', alCambiarHash)
  }, [cargarCircuito])

  // --- copia de trabajo automática ------------------------------------------
  useEffect(() => {
    guardarLocal({ version: 1, piezas, mangueras })
  }, [piezas, mangueras])

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
      if ((e.key === 'Delete' || e.key === 'Backspace') && modo === 'editar' && !enCampo) {
        borrarSeleccion()
      }
      if (e.key === ' ' && !enCampo) {
        e.preventDefault()
        setModo(modo === 'simular' ? 'editar' : 'simular')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modo, borrarSeleccion, cancelarCable, setModo])

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

  const abrirArchivo = async (archivo: File | undefined) => {
    if (!archivo) return
    try {
      const datos = await leerArchivo(archivo)
      cargarCircuito(datos)
      setAviso(`Circuito «${archivo.name}» abierto.`)
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo leer el archivo.')
    }
  }

  const eventos = motor ? motor.eventos.slice(-6).reverse() : []
  const avisosCircuito =
    modo === 'editar' ? validarCircuito(circuitoDesdeStore(piezas, mangueras)) : (motor?.advertencias ?? [])
  const hayCortes = piezas.some((p) => p.tipo.startsWith('valvula') || p.tipo.startsWith('cilindro'))

  return (
    <main style={{ maxWidth: 1320, margin: '0 auto', padding: estrecha ? '0.8rem' : '1.25rem 1.5rem' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          marginBottom: '0.8rem',
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: estrecha ? '1.25rem' : '1.45rem' }}>NeumaLab</h1>
        <span
          style={{
            background: '#33475c',
            color: '#fff',
            borderRadius: 999,
            padding: '0.15rem 0.6rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.03em',
          }}
        >
          MEC275
        </span>
        <p style={{ margin: 0, color: '#5a6b7d', fontSize: '0.9rem' }}>
          Laboratorio virtual de neumática — arma el circuito y simúlalo
        </p>
      </header>

      {/* barra de herramientas */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <button
          onClick={() => setModo(modo === 'simular' ? 'editar' : 'simular')}
          title="Atajo: barra espaciadora"
          style={{
            ...boton,
            background: modo === 'simular' ? '#33475c' : '#12a35a',
            padding: '0.55rem 1.3rem',
            fontSize: '0.98rem',
          }}
        >
          {modo === 'simular' ? '■ Detener' : '▶ Simular'}
        </button>

        {modo === 'simular' && (
          <button onClick={alternarAire} style={{ ...boton, background: aire ? '#1668c7' : '#8a97a5' }}>
            Aire {aire ? 'ON' : 'OFF'}
          </button>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#5a6b7d' }}>
          Ejemplos:
          <select
            value=""
            onChange={(e) => {
              const n = Number(e.target.value) as NumeroEjemplo
              if (!n) return
              const etiqueta = EJEMPLOS.find((x) => x.n === n)?.etiqueta ?? ''
              if (confirmarDescarte(`¿Cargar el ejemplo «${etiqueta}»?`)) cargarEjemplo(n)
              e.target.value = ''
            }}
            style={{ padding: '0.3rem 0.4rem', maxWidth: 250 }}
          >
            <option value="">— elige un circuito —</option>
            {EJEMPLOS.map((ej) => (
              <option key={ej.n} value={ej.n}>
                {ej.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <span style={{ marginLeft: estrecha ? 0 : 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={compartir} style={botonSuave} title="Copia un enlace con el circuito dentro">
            Compartir
          </button>
          <button
            onClick={() => descargarJson({ version: 1, piezas, mangueras })}
            style={botonSuave}
          >
            Guardar
          </button>
          <button onClick={() => inputArchivo.current?.click()} style={botonSuave}>
            Abrir
          </button>
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
          <button
            onClick={() => confirmarDescarte('¿Vaciar la pizarra?') && limpiarPizarra()}
            style={{ ...botonSuave, border: 'none', background: 'transparent', color: '#8a4a45', textDecoration: 'underline' }}
          >
            Vaciar
          </button>
        </span>
      </div>

      {aviso && (
        <p
          role="status"
          style={{
            margin: '0 0 10px',
            padding: '0.5rem 0.8rem',
            background: '#e7f7ef',
            border: '1px solid #a9dcc4',
            borderRadius: 8,
            color: '#0a6b3c',
            fontSize: '0.88rem',
          }}
        >
          {aviso}
        </p>
      )}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexDirection: estrecha ? 'column' : 'row' }}>
        {modo === 'editar' && <Paleta horizontal={estrecha} />}
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Pizarra motor={motor} />
          <p style={{ margin: '6px 2px', fontSize: '0.82rem', color: '#5a6b7d' }}>
            {modo === 'editar'
              ? 'Clic cerca de un puerto para cablear (son magnéticos) · Supr borra la selección · Esc cancela · Espacio simula'
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
        <TablaNomenclatura />
      </section>

      <footer style={{ margin: '1.5rem 0 0.5rem', color: '#8a97a5', fontSize: '0.8rem', textAlign: 'center' }}>
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

const boton: React.CSSProperties = {
  border: 'none',
  color: '#fff',
  padding: '0.45rem 0.9rem',
  borderRadius: 8,
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
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
