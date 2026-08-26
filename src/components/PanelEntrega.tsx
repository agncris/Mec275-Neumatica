/**
 * Panel «Mi entrega»: aquí se responden las preguntas del enunciado, se
 * contrasta lo escrito contra la simulación del propio circuito y se descarga
 * un único archivo con todo dentro. Ese mismo archivo se puede volver a abrir
 * en la aplicación, así que la entrega sigue siendo ejecutable.
 */
import { useMemo, useState } from 'react'
import { analizarCircuito, coincideSecuencia, inventarioDe } from '../engine'
import { FUNCIONES_VDI, SimboloVDI } from '../symbols/SimbolosVDI'
import { analizarSecuencia } from '../secuencias'
import { crearEntrega } from '../entrega'
import { descargarJson } from '../persistencia'
import { nombreSeguro } from '../exportar'
import { circuitoDesdeStore, useStore } from '../store'

export default function PanelEntrega() {
  const piezas = useStore((s) => s.piezas)
  const mangueras = useStore((s) => s.mangueras)
  const alumno = useStore((s) => s.alumno)
  const ejercicio = useStore((s) => s.ejercicio)
  const respuestas = useStore((s) => s.respuestas)
  const { setAlumno, setEjercicio, setRespuestas } = useStore()

  const [eligiendoVdi, setEligiendoVdi] = useState(false)
  const [analisis, setAnalisis] = useState<ReturnType<typeof analizarCircuito> | null>(null)

  const grupos = useMemo(() => analizarSecuencia(respuestas.secuencia), [respuestas.secuencia])

  const comprobar = () => {
    setAnalisis(analizarCircuito(circuitoDesdeStore(piezas, mangueras)))
  }

  const usarInventario = () => {
    const inv = inventarioDe(circuitoDesdeStore(piezas, mangueras))
    if (inv.length === 0) return
    setRespuestas({
      elementos: inv.map((e) => `${e.cantidad} × ${e.nombre}`).join('\n'),
    })
  }

  const descargar = () => {
    const entrega = crearEntrega(alumno, ejercicio, respuestas, { piezas, mangueras })
    const base = [alumno.nombre, ejercicio].filter(Boolean).join('_') || 'entrega'
    descargarJson(entrega as never, nombreSeguro(base, 'json'))
  }

  const añadirVdi = (n: number) => {
    setRespuestas({ vdi: [...respuestas.vdi, { n, nota: '' }] })
    setEligiendoVdi(false)
  }
  const cambiarNota = (i: number, nota: string) => {
    const vdi = respuestas.vdi.map((p, k) => (k === i ? { ...p, nota } : p))
    setRespuestas({ vdi })
  }
  const quitarVdi = (i: number) => {
    setRespuestas({ vdi: respuestas.vdi.filter((_, k) => k !== i) })
  }
  const moverVdi = (i: number, delta: number) => {
    const vdi = [...respuestas.vdi]
    const j = i + delta
    if (j < 0 || j >= vdi.length) return
    ;[vdi[i], vdi[j]] = [vdi[j], vdi[i]]
    setRespuestas({ vdi })
  }

  const declarada = grupos.movimientos.map((m) => m.texto)
  const secuenciaOk =
    analisis !== null && declarada.length > 0 && coincideSecuencia(declarada, analisis.secuenciaDetectada)

  return (
    <div>
      <p style={parrafo}>
        Aquí respondes lo que te pida el enunciado y lo dejas todo junto. Cuando termines, pulsa{' '}
        <strong>Comprobar mi trabajo</strong>: la aplicación simula tu circuito y te dice si hace de
        verdad lo que has escrito. Después, <strong>Descargar mi entrega</strong> te da un único
        archivo con las respuestas y el circuito dentro — ese es el que tienes que enviar.
      </p>

      {/* Identificación ------------------------------------------------- */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <label style={campo}>
          Nombre y apellido
          <input
            value={alumno.nombre}
            onChange={(e) => setAlumno({ ...alumno, nombre: e.target.value })}
            placeholder="Ana Pérez"
            style={entrada}
          />
        </label>
        <label style={campo}>
          Rol USM
          <input
            value={alumno.rol}
            onChange={(e) => setAlumno({ ...alumno, rol: e.target.value })}
            placeholder="202012345-6"
            style={entrada}
          />
        </label>
        <label style={campo}>
          Título del trabajo
          <input
            value={ejercicio}
            onChange={(e) => setEjercicio(e.target.value)}
            placeholder="Tarea 1"
            style={entrada}
          />
        </label>
      </div>

      {/* 1 · Diagrama VDI ------------------------------------------------ */}
      <h3 style={titulo}>Diagrama de funcionamiento (VDI 2860)</h3>
      <p style={pie}>
        Describe el proceso paso a paso con los símbolos de la norma: añade una función por cada
        cosa que hace la máquina y anota a qué elemento corresponde. Si no sabes cuál es cada
        símbolo, tienes la tabla completa en la sección «Simbología VDI 2860».
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start', margin: '8px 0' }}>
        {respuestas.vdi.map((paso, i) => {
          const f = FUNCIONES_VDI.find((x) => x.n === paso.n)
          return (
            <div key={i} style={fichaVdi}>
              <div style={{ width: 48, height: 48, margin: '0 auto' }}>
                <SimboloVDI n={paso.n} />
              </div>
              <div style={{ fontSize: '0.66rem', color: '#5a6b7d', minHeight: '2.2em', lineHeight: 1.25 }}>
                {f?.nombre}
              </div>
              <input
                value={paso.nota}
                onChange={(e) => cambiarNota(i, e.target.value)}
                placeholder="¿a qué corresponde?"
                style={{ ...entrada, fontSize: '0.7rem', padding: '0.2rem 0.3rem', width: '100%' }}
              />
              <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 3 }}>
                <button onClick={() => moverVdi(i, -1)} style={miniBoton} title="Mover antes">←</button>
                <button onClick={() => moverVdi(i, 1)} style={miniBoton} title="Mover después">→</button>
                <button onClick={() => quitarVdi(i)} style={{ ...miniBoton, color: '#b3261e' }} title="Quitar">✕</button>
              </div>
            </div>
          )
        })}
        <button onClick={() => setEligiendoVdi((v) => !v)} style={{ ...fichaVdi, cursor: 'pointer', color: '#33475c' }}>
          <div style={{ fontSize: '1.6rem', lineHeight: 1.6 }}>＋</div>
          <div style={{ fontSize: '0.72rem' }}>Añadir función</div>
        </button>
      </div>

      {eligiendoVdi && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 6,
            padding: 10,
            border: '1px solid #dbe1e8',
            borderRadius: 8,
            marginBottom: 12,
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          {FUNCIONES_VDI.map((f) => (
            <button key={f.n} onClick={() => añadirVdi(f.n)} style={{ ...fichaVdi, cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, margin: '0 auto' }}>
                <SimboloVDI n={f.n} />
              </div>
              <div style={{ fontSize: '0.64rem', color: '#33475c', lineHeight: 1.25 }}>{f.nombre}</div>
            </button>
          ))}
        </div>
      )}

      {/* 2 · Secuencia --------------------------------------------------- */}
      <h3 style={titulo}>Secuencia, grupos y activadores</h3>
      <label style={{ ...campo, maxWidth: 340 }}>
        Secuencia de automatización
        <input
          value={respuestas.secuencia}
          onChange={(e) => setRespuestas({ secuencia: e.target.value })}
          placeholder="A+ B+ B- A-"
          spellCheck={false}
          style={{ ...entrada, fontFamily: 'ui-monospace, Menlo, monospace' }}
        />
      </label>
      {grupos.error && <p style={{ ...pie, color: '#b3261e' }}>⚠ {grupos.error}</p>}
      {grupos.grupos.length > 0 && (
        <p style={pie}>
          Grupos: {grupos.grupos.map((g, i) => `${i + 1}) ${g.map((m) => m.texto).join(' ')}`).join('  ·  ')} →{' '}
          <strong>
            {grupos.valvulasCascada === 0
              ? 'sin señales bloqueantes, no hace falta cascada'
              : `${grupos.valvulasCascada} válvula${grupos.valvulasCascada > 1 ? 's' : ''} de cascada`}
          </strong>
        </p>
      )}
      <label style={{ ...campo, maxWidth: '100%' }}>
        Activadores de cada movimiento
        <textarea
          value={respuestas.activadores}
          onChange={(e) => setRespuestas({ activadores: e.target.value })}
          placeholder={'marcha + a0 → A+\na1 → B+\nb1 → cambio de grupo\n…'}
          rows={4}
          style={{ ...entrada, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.82rem' }}
        />
      </label>

      {/* 3 · Elementos --------------------------------------------------- */}
      <h3 style={titulo}>Elementos necesarios</h3>
      <button onClick={usarInventario} style={{ ...boton, background: '#1668c7', marginBottom: 6 }}>
        Rellenar con el inventario de mi circuito
      </button>
      <label style={{ ...campo, maxWidth: '100%' }}>
        <textarea
          value={respuestas.elementos}
          onChange={(e) => setRespuestas({ elementos: e.target.value })}
          placeholder={'2 × Cilindro de doble efecto\n1 × Actuador giratorio\n…'}
          rows={5}
          style={{ ...entrada, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.82rem' }}
        />
      </label>

      {/* 4 y 5 ------------------------------------------------------------ */}
      <h3 style={titulo}>Diagrama de fase y circuito</h3>
      <p style={pie}>
        Los dos salen del banco: monta el circuito arriba y pulsa <strong>▶ Simular</strong>. El
        diagrama de fase se dibuja solo mientras corre, con la secuencia A+ / A− marcada. Si tu
        informe lleva imágenes, descárgalas con «Circuito (PNG)» y «Diagrama de fase (PNG)» de la
        barra de arriba.
      </p>
      <label style={{ ...campo, maxWidth: '100%' }}>
        Observaciones (opcional)
        <textarea
          value={respuestas.comentarios}
          onChange={(e) => setRespuestas({ comentarios: e.target.value })}
          rows={3}
          style={entrada}
        />
      </label>

      {/* Comprobación ----------------------------------------------------- */}
      <h3 style={titulo}>Antes de entregar</h3>
      <p style={pie}>
        La comprobación no corrige tu trabajo ni te pone nota: sólo contrasta lo que has escrito con
        lo que hace tu circuito al simularlo, para que no entregues nada que no funcione.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={comprobar} style={{ ...boton, background: '#12a35a' }}>
          Comprobar mi trabajo
        </button>
        <button onClick={descargar} style={{ ...boton, background: '#33475c' }}>
          Descargar mi entrega
        </button>
      </div>

      {analisis && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
          <Comprobacion
            ok={analisis.erroresMontaje.length === 0}
            bien="El circuito está bien montado: no hay puertos sueltos ni fichas mal configuradas."
            mal={`Hay ${analisis.erroresMontaje.length} problema(s) de montaje: ${analisis.erroresMontaje[0]}`}
          />
          <Comprobacion
            ok={!analisis.sinMovimiento}
            bien={`El circuito se mueve: ${analisis.actuadores.length} actuador(es) trabajando.`}
            mal="Ningún actuador llega a moverse. Revisa la alimentación y los pilotajes."
          />
          <Comprobacion
            ok={analisis.conflictos.length === 0}
            bien="Ninguna válvula recibe dos pilotajes opuestos a la vez."
            mal={`Señales bloqueantes en: ${analisis.conflictos.join(', ')}. Aplica el método cascada.`}
          />
          <Comprobacion
            ok={analisis.cicloCompleto}
            bien="El ciclo se cierra y se repite: el sistema es automático."
            mal="El ciclo no se repite. Comprueba que el último activador devuelve el sistema al primer grupo."
          />
          <Comprobacion
            ok={secuenciaOk}
            bien={`La secuencia que declaras coincide con la que ejecuta el circuito: ${analisis.secuenciaDetectada.slice(0, 8).join(' ')}`}
            mal={
              declarada.length === 0
                ? 'Escribe arriba la secuencia para poder contrastarla.'
                : `El circuito ejecuta ${analisis.secuenciaDetectada.slice(0, 8).join(' ') || '(nada)'}, y tú has declarado ${declarada.join(' ')}.`
            }
          />
        </ul>
      )}
    </div>
  )
}

function Comprobacion({ ok, bien, mal }: { ok: boolean; bien: string; mal: string }) {
  return (
    <li
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        padding: '0.45rem 0.6rem',
        borderRadius: 7,
        border: `1px solid ${ok ? '#a9dcc4' : '#f0c36d'}`,
        background: ok ? '#f2fbf6' : '#fdf6e3',
        fontSize: '0.86rem',
        color: '#33475c',
        lineHeight: 1.45,
      }}
    >
      <span style={{ fontWeight: 700, color: ok ? '#0a6b3c' : '#8a5b00' }}>{ok ? '✓' : '⚠'}</span>
      <span>{ok ? bien : mal}</span>
    </li>
  )
}

const titulo: React.CSSProperties = { margin: '18px 0 4px', fontSize: '0.95rem', color: '#33475c' }
const parrafo: React.CSSProperties = { margin: '0 0 12px', fontSize: '0.9rem', color: '#33475c', lineHeight: 1.6 }
const pie: React.CSSProperties = { margin: '4px 0 8px', fontSize: '0.82rem', color: '#5a6b7d', lineHeight: 1.5 }
const campo: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  fontSize: '0.82rem',
  color: '#33475c',
  flex: '1 1 200px',
}
const entrada: React.CSSProperties = {
  padding: '0.35rem 0.5rem',
  border: '1px solid #c6ced6',
  borderRadius: 6,
  fontSize: '0.86rem',
  fontFamily: 'inherit',
  width: '100%',
}
const fichaVdi: React.CSSProperties = {
  width: 118,
  border: '1px solid #dbe1e8',
  borderRadius: 8,
  padding: '6px 5px',
  background: '#fff',
  textAlign: 'center',
}
const miniBoton: React.CSSProperties = {
  border: '1px solid #dbe1e8',
  background: '#fff',
  borderRadius: 4,
  fontSize: '0.7rem',
  padding: '0 4px',
  cursor: 'pointer',
  color: '#33475c',
}
const boton: React.CSSProperties = {
  border: 'none',
  color: '#fff',
  padding: '0.45rem 0.9rem',
  borderRadius: 8,
  fontSize: '0.88rem',
  fontWeight: 600,
  cursor: 'pointer',
}
