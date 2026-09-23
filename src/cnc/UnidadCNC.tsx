/**
 * Unidad 3 · CNC: escribir un programa en código G y simular el mecanizado
 * en un centro de torneado o en una fresadora, en 3D, como en CNC Simulator
 * Pro: preparación de la máquina (material, bruto, herramientas), ejecución
 * continua o bloque a bloque, alarmas de la máquina, trayectoria en 2D con
 * sus coordenadas, explicación de cada bloque y exportación del .cnc y del
 * video de la simulación.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Seccion } from '../components/Seccion'
import { exportarPng, nombreSeguro } from '../exportar'
import EditorGcode, { type EditorGcodeRef } from './EditorGcode'
import { EJEMPLOS_CNC, programaNuevo } from './ejemplos'
import { explicarBloque, interpretar, type ResultadoGcode } from './gcode'
import {
  CONFIG_INICIAL,
  HERRAMIENTAS_FRESA,
  HERRAMIENTAS_TORNO,
  MATERIALES,
  material as materialDe,
  nombreHerramienta,
  posicionCasa,
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
  const resultado: ResultadoGcode = useMemo(() => interpretar(codigo, maquina, casa), [codigo, maquina, casa])

  const vista = useRef<VistaCNC>({ sim: new SimuladorCNC(resultado, config, casa), trayectoria, sonido })
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

  const exportarPlano = async () => {
    const svg = document.querySelector('[data-plano2d]') as SVGSVGElement | null
    if (!svg) return
    const archivo = nombreSeguro(`${nombres[maquina] || 'programa'}_trayectoria`, 'png')
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
      a.download = nombreSeguro(`${nombres[maquina] || 'simulacion'}_simulacion`, ext)
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
    corriendo: ['EN CICLO', '#12a35a'],
    bloque: ['BLOQUE A BLOQUE', '#1668c7'],
    pausa: ['EN PAUSA', '#ffa726'],
    parada: ['PARADA M00', '#ffa726'],
    alarma: ['ALARMA', '#c62828'],
    fin: ['FIN DE PROGRAMA', '#33475c'],
  }

  return (
    <main style={{ maxWidth: 1320, margin: '0 auto', padding: '0.4rem 1.5rem 1.25rem' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: '0.8rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.45rem' }}>NeumaLab · CNC</h1>
        <span style={chip}>MEC275</span>
        <p style={{ margin: 0, color: '#5a6b7d', fontSize: '0.9rem' }}>Escribe tu programa en código G y mira cómo la máquina mecaniza la pieza</p>
      </header>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <label style={rotulo}>
          Máquina:
          <select value={maquina} onChange={(e) => cambiarMaquina(e.target.value as TipoMaquina)} style={selector} data-selector-maquina="si">
            <option value="torno">Centro de torneado (torno)</option>
            <option value="fresadora">Fresadora de 3 ejes</option>
          </select>
        </label>
        <button onClick={nuevo} style={{ ...boton, background: '#fff', color: '#1668c7', border: '2px solid #1668c7', padding: '0.45rem 1rem' }}>
          ＋ Nuevo programa
        </button>
        <label style={rotulo}>
          Ejemplos:
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value
              e.target.value = ''
              cargarEjemplo(v)
            }}
            style={{ ...selector, maxWidth: 'min(300px, calc(100vw - 130px))' }}
            data-ejemplos-cnc="si"
          >
            <option value="">— elige un ejemplo —</option>
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
        </label>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={guardarCnc} style={botonSuave} title="Descarga el programa como archivo .cnc (texto), el que se entrega">
            Guardar .cnc
          </button>
          <button onClick={() => inputArchivo.current?.click()} style={botonSuave} title="Abre un .cnc, .nc, .gcode o .txt">
            Abrir
          </button>
          <button onClick={() => void exportarPlano()} style={botonSuave} title="Imagen de la trayectoria 2D con sus puntos, para el informe">
            Trayectoria (PNG)
          </button>
          <button
            onClick={alternarGrabacion}
            disabled={!puedeGrabar}
            style={{ ...botonSuave, color: grabando ? '#fff' : '#c62828', background: grabando ? '#c62828' : '#fff', borderColor: '#c62828', opacity: puedeGrabar ? 1 : 0.5 }}
            title="Graba la vista 3D en video (para entregar la simulación)"
          >
            {grabando ? '■ Detener grabación' : '● Grabar video'}
          </button>
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
        </span>
      </div>

      {aviso && (
        <p role="status" style={avisoOk}>
          {aviso}
        </p>
      )}

      <Preparacion config={config} setConfig={setConfig} bloqueado={estado === 'corriendo' || estado === 'bloque'} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: 14, alignItems: 'start', marginTop: 12 }}>
        <section style={{ ...tarjeta, marginTop: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {estado === 'corriendo' ? (
              <button onClick={() => setEstado('pausa')} style={{ ...boton, background: '#ffa726', padding: '0.5rem 1rem' }} data-control="pausa">
                ❚❚ Pausa
              </button>
            ) : (
              <button
                onClick={() => correr('corriendo')}
                disabled={!resultado.pasos.length}
                title={hayErrores ? 'Hay errores: la máquina corre hasta la línea anterior al primer error' : 'Ejecuta el programa completo'}
                style={{ ...boton, background: '#12a35a', padding: '0.5rem 1rem', opacity: resultado.pasos.length ? 1 : 0.5 }}
                data-control="ciclo"
              >
                {estado === 'parada' ? '▶ Continuar' : '▶ Ciclo'}
              </button>
            )}
            <button onClick={() => correr('bloque')} disabled={!resultado.pasos.length || estado === 'corriendo'} style={botonSuave} title="Ejecuta un bloque (una línea) y se detiene" data-control="bloque">
              ⏭ Bloque a bloque
            </button>
            <button onClick={reiniciar} style={botonSuave} title="Vuelve al inicio con el bruto entero" data-control="reiniciar">
              ⟲ Reiniciar
            </button>
            <button onClick={alFinal} disabled={!resultado.pasos.length} style={botonSuave} title="Mecaniza todo de una vez" data-control="final">
              ⏩ Al final
            </button>
            <label style={{ ...rotulo, marginLeft: 'auto' }}>
              Velocidad
              <select value={velocidad} onChange={(e) => setVelocidad(Number(e.target.value))} style={selector}>
                {VELOCIDADES.map((v) => (
                  <option key={v} value={v}>
                    ×{v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <h2 style={{ ...subtitulo, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Programa · {nombres[maquina]}
            <span style={{ ...estadoChip, background: textoEstado[estado][1] }} data-estado-cnc={estado}>
              {textoEstado[estado][0]}
            </span>
          </h2>
          <EditorGcode
            ref={editor}
            codigo={codigo}
            onCambiar={setCodigo}
            lineaActiva={lineaActiva}
            diagnosticos={resultado.diagnosticos}
            onCursor={setCursor}
            soloLectura={estado === 'corriendo' || estado === 'bloque'}
          />
          <Revision resultado={resultado} errores={errores} avisos={avisosProg} irA={irA} />
        </section>

        <section style={{ ...tarjeta, marginTop: 0 }}>
          <h2 style={subtitulo}>{torno ? 'Centro de torneado' : 'Fresadora de 3 ejes'} · {mat.nombre}</h2>
          {sim.alarma && (
            <div role="alert" style={alarma} data-alarma-cnc="si">
              <strong>⚠ ALARMA en la línea {sim.alarma.linea + 1}:</strong> {sim.alarma.texto}{' '}
              <button onClick={() => irA(sim.alarma!.linea)} style={{ ...botonSuave, padding: '1px 8px', marginLeft: 6 }}>
                Ir a la línea
              </button>
            </div>
          )}
          {estado === 'parada' && <div style={{ ...alarma, background: '#fff5e0', borderColor: '#f0c36d', color: '#7a4b00' }}>Programa detenido por M00/M01. Pulsa ▶ Continuar.</div>}
          <Suspense fallback={<p style={{ padding: 20, color: '#5a6b7d' }}>Preparando la máquina…</p>}>
            <Maquina3D vista={vista} onCanvas={(c) => (canvasRef.current = c)} />
          </Suspense>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: '0.85rem', color: '#33475c' }}>
            <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="checkbox" checked={trayectoria} onChange={(e) => setTrayectoria(e.target.checked)} /> Trayectoria
            </label>
            <label style={{ display: 'flex', gap: 5, alignItems: 'center' }} title="Husillo, corte y ejes; se activa al hacer clic en la vista 3D">
              <input type="checkbox" checked={sonido} onChange={(e) => setSonido(e.target.checked)} /> Sonido
            </label>
            <span style={{ color: '#5a6b7d' }}>Arrastra para girar la vista, rueda para acercar.</span>
          </div>
          <Tablero
            sim={sim}
            torno={torno}
            paso={paso}
            ultimo={ultimo}
            modal={estadoModal}
            tiempoTotal={resultado.tiempoTotal}
            volumen={volumen}
            volumenInicial={volumenInicial}
          />
          {sim.consejos.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {sim.consejos.map((c, i) => (
                <p key={i} style={{ color: '#8a5b00', margin: '3px 0', fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => irA(c.linea)}>
                  💡 Línea {c.linea + 1}: {c.texto}
                </p>
              ))}
            </div>
          )}
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: 14, alignItems: 'start', marginTop: 14 }}>
        <section style={{ ...tarjeta, marginTop: 0 }}>
          <h2 style={subtitulo}>Trayectoria 2D {torno ? '(plano Z-X)' : '(vista desde arriba)'}</h2>
          <Plano2D programa={resultado} sim={sim} config={config} lineas={lineas} seleccionada={cursor} onElegirLinea={irA} />
        </section>
        <section style={{ ...tarjeta, marginTop: 0 }}>
          <h2 style={subtitulo}>Explicar el bloque · línea {lineaExplicada + 1}</h2>
          <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#5a6b7d' }}>Pon el cursor en una línea del programa para ver qué hace cada palabra.</p>
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
            <p style={{ color: '#8a97a5', fontSize: '0.86rem' }}>Línea vacía.</p>
          )}
          <h2 style={{ ...subtitulo, marginTop: 14 }}>Tabla de coordenadas</h2>
          <TablaPuntos resultado={resultado} torno={torno} lineas={lineas} irA={irA} seleccionada={cursor} casa={casa} />
        </section>
      </div>

      <section style={tarjeta}>
        <Seccion titulo="¿Qué es el CNC?">
          <QueEsCNC />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Ventajas, limitaciones y aplicaciones">
          <VentajasCNC />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Cómo organizar la programación">
          <OrganizarPrograma />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Coordenadas absolutas e incrementales (con práctica)">
          <Coordenadas />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Estructura de un bloque de código G">
          <EstructuraBloque />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Códigos G y M">
          <CodigosGM />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Arcos: G02 y G03">
          <Arcos />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="El torno CNC y sus operaciones">
          <Torno />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Herramientas de corte: código de los insertos">
          <Insertos />
        </Seccion>
      </section>
      <section style={tarjeta}>
        <Seccion titulo="Cómo usar este simulador (y entregar tu trabajo)">
          <ComoUsar />
        </Seccion>
      </section>
    </main>
  )
}

// ---------------------------------------------------------------------------
function Preparacion({ config, setConfig, bloqueado }: { config: ConfigCNC; setConfig: (f: (c: ConfigCNC) => ConfigCNC) => void; bloqueado: boolean }) {
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
  const herramientas = torno ? HERRAMIENTAS_TORNO : HERRAMIENTAS_FRESA
  return (
    <section style={{ ...tarjeta, marginTop: 0 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <h2 style={{ ...subtitulo, margin: 0, alignSelf: 'center' }}>Preparación</h2>
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
          </>
        ) : (
          <>
            {num(config.fresa.largo, (v) => setConfig((c) => ({ ...c, fresa: { ...c.fresa, largo: v } })), 10, 300, 'Largo X (mm)')}
            {num(config.fresa.ancho, (v) => setConfig((c) => ({ ...c, fresa: { ...c.fresa, ancho: v } })), 10, 300, 'Ancho Y (mm)')}
            {num(config.fresa.alto, (v) => setConfig((c) => ({ ...c, fresa: { ...c.fresa, alto: v } })), 3, 100, 'Alto Z (mm)')}
          </>
        )}
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#5a6b7d', flex: '1 1 260px' }}>
          {torno
            ? `Cero pieza: en la cara frontal, sobre el eje. El bruto va de Z${config.torno.sobremetal} a Z${config.torno.sobremetal - config.torno.largo}; las garras llegan hasta Z${config.torno.sobremetal - config.torno.largo + config.torno.agarre}. X se programa en diámetro.`
            : 'Cero pieza: esquina delantera izquierda de la cara superior. Z negativo corta hacia abajo.'}{' '}
          Avance orientativo para {materialDe(config.material).nombre.toLowerCase()}: {materialDe(config.material).avance.join('–')} mm/min.
        </p>
      </div>
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', color: '#33475c', fontWeight: 600, fontSize: '0.9rem' }}>
          Herramientas disponibles {torno ? 'en la torreta' : 'en el almacén'} ({herramientas.length})
        </summary>
        <div style={{ overflowX: 'auto', marginTop: 6 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                {['T', 'Herramienta', 'Para qué sirve', torno ? 'Cómo llamarla' : 'Cómo montarla'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', background: '#33475c', color: '#fff', padding: '4px 8px' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {herramientas.map((h) => (
                <tr key={h.t}>
                  <td style={celda}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: `#${h.color.toString(16).padStart(6, '0')}`, marginRight: 5 }} />
                    T{h.t}
                  </td>
                  <td style={celda}>{h.nombre}</td>
                  <td style={celda}>{h.uso}</td>
                  <td style={{ ...celda, fontFamily: 'ui-monospace, Menlo, monospace' }}>{torno ? `T${String(h.t).padStart(2, '0')}${String(h.t).padStart(2, '0')}` : `T${h.t} M06`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const p = sim.pos
  const act = paso ?? ultimo
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
}: {
  resultado: ResultadoGcode
  torno: boolean
  lineas: string[]
  irA: (n: number) => void
  seleccionada: number | null
  casa: { x: number; y: number; z: number }
}) {
  const [copiado, setCopiado] = useState(false)
  const filas = useMemo(() => {
    let previo = casa
    return resultado.puntos.map((p) => {
      const d = { x: p.pos.x - previo.x, y: p.pos.y - previo.y, z: p.pos.z - previo.z }
      previo = p.pos
      const n = /^\s*N(\d+)/i.exec(lineas[p.linea] ?? '')
      return { ...p, d, n: n ? `N${n[1]}` : `L${p.linea + 1}` }
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
  if (!filas.length) return <p style={{ color: '#8a97a5', fontSize: '0.86rem' }}>El programa todavía no mueve la máquina.</p>
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
      <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#8a97a5' }}>Punto de partida: posición de referencia {textoPunto(casa, torno)}.</p>
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
        fresadora con <code>T1 M06</code>.
      </li>
      <li style={li}>
        <strong>Escribe el programa</strong> en el editor (o abre un .cnc). Mientras escribes se revisa: los errores salen
        en rojo con su línea. Pon el cursor en una línea para ver qué hace cada palabra.
      </li>
      <li style={li}>
        <strong>Simula:</strong> ▶ Ciclo lo ejecuta completo, ⏭ Bloque a bloque avanza de a una línea, ⏩ Al final
        mecaniza todo de una vez y ⟲ Reiniciar vuelve al bruto entero. Cambia la velocidad para verlo más rápido.
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
        <strong>Diferencias con CNC Simulator Pro:</strong> las instrucciones propias de ese programa que empiezan con{' '}
        <code>$</code> (como <code>$Millimeter</code>) se aceptan pero se ignoran, salvo las de unidades; la compensación de
        radio (G41/G42) no se simula. En el torno, el punto programado de la herramienta de tronzado es su esquina
        derecha (hacia la cara).
      </li>
    </ol>
  )
}

// ---------------------------------------------------------------------------
const tarjeta: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e0e5eb',
  borderRadius: 10,
  padding: '1rem 1.25rem',
  marginTop: 12,
  boxShadow: '0 1px 3px rgba(28, 39, 51, 0.06)',
  minWidth: 0,
}
const subtitulo: React.CSSProperties = { margin: '0 0 0.6rem', fontSize: '1.05rem', color: '#33475c' }
const boton: React.CSSProperties = { border: 'none', color: '#fff', padding: '0.45rem 0.9rem', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }
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
const chip: React.CSSProperties = { background: '#33475c', color: '#fff', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.03em' }
const estadoChip: React.CSSProperties = { color: '#fff', borderRadius: 6, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }
const avisoOk: React.CSSProperties = {
  margin: '0 0 10px',
  padding: '0.5rem 0.8rem',
  background: '#e7f7ef',
  border: '1px solid #a9dcc4',
  borderRadius: 8,
  color: '#0a6b3c',
  fontSize: '0.88rem',
}
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
