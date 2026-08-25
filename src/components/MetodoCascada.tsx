/**
 * Sección «Método cascada»: explica cómo resolver secuencias con señales
 * bloqueantes. Incluye un divisor de grupos interactivo (funciona con
 * cualquier secuencia que escriba el alumno) y los dos circuitos de la
 * secuencia A+ B+ B− A− listos para cargar en la pizarra: el que se bloquea
 * y el resuelto por cascada.
 */
import { useState } from 'react'
import ExplicadorCascada from './ExplicadorCascada'
import { analizarSecuencia } from '../secuencias'
import { CIRCUITO_BLOQUEADO, CIRCUITO_CASCADA, type CircuitoPreparado } from '../circuitos/cascada'
import { CIRCUITO_TRES_GRUPOS } from '../circuitos/ejercicios'
import { useStore } from '../store'

const COLORES_GRUPO = ['#1668c7', '#12a35a', '#b3671a', '#8a3ab0']

const PASOS_EJEMPLO = [
  ['t = 0 s', 'Marcha + a0 → la cascada pasa a L1 → L1 pilota VA:14 → A+'],
  ['t = 1,3 s', 'a1 (alimentado desde L1) → VB:14 → B+'],
  ['t = 2,5 s', 'b1 (desde L1) → la cascada pasa a L2. Al vaciarse L1, la señal de a1 muere aunque el rodillo siga pisado'],
  ['t = 2,5 s', 'L2 pilota VB:12 → B−, ya sin conflicto'],
  ['t = 3,8 s', 'b0 (desde L2) → VA:12 → A−'],
  ['t = 5,1 s', 'a0 (desde L2) + marcha → vuelta a L1: el ciclo se repite'],
]

export default function MetodoCascada() {
  const cargarCircuito = useStore((s) => s.cargarCircuito)
  const [secuencia, setSecuencia] = useState('A+ B+ B- A-')
  const analisis = analizarSecuencia(secuencia)

  const cargar = (circuito: CircuitoPreparado) => {
    const { piezas } = useStore.getState()
    if (
      piezas.length > 0 &&
      !window.confirm(
        `¿Cargar este circuito?\nSe quitarán las ${piezas.length} fichas que hay en la pizarra.`,
      )
    ) {
      return
    }
    cargarCircuito(circuito)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>

      {/* 1 — La idea en una frase ------------------------------------------- */}
      <p style={{ ...parrafo, fontSize: '1rem', borderLeft: '3px solid #12a35a', paddingLeft: 12, marginTop: 14 }}>
        Un final de carrera no da un pulso: <strong>manda sin parar</strong> mientras esté pisado. Si
        esa orden estorba, la solución es quitarle el aire:{' '}
        <strong>sin aire no manda, aunque siga pisado</strong>.
      </p>

      {/* 2 — Explicador animado (la pieza central) --------------------------- */}
      <h3 style={titulo}>1 · Míralo paso a paso</h3>
      <p style={parrafo}>
        Compara los dos montajes de la secuencia <code style={codigo}>A+ B+ B− A−</code>. Dale a{' '}
        <strong>▶ Reproducir</strong>, o ve paso a paso para leer con calma lo que ocurre en cada
        instante.
      </p>
      <ExplicadorCascada />

      <h3 style={titulo}>2 · Compruébalo en la pizarra de verdad</h3>
      <p style={parrafo}>
        Los mismos dos circuitos, montados con fichas y mangueras. Cárgalos, pulsa{' '}
        <strong>▶ Simular</strong> y mantén la válvula <strong>M</strong>.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => cargar(CIRCUITO_BLOQUEADO)} style={{ ...boton, background: '#b3261e' }}>
          Cargar el montaje que se bloquea
        </button>
        <button onClick={() => cargar(CIRCUITO_CASCADA)} style={{ ...boton, background: '#12a35a' }}>
          Cargar el circuito en cascada
        </button>
      </div>
      <p style={pie}>
        El primero no mueve nada y avisa de que una válvula está pilotada por 12 y 14 a la vez. El
        segundo repite el ciclo solo, y el diagrama espacio-fase dibuja A+ B+ B− A− sin ayuda.
      </p>

      {/* 3 — Divisor de grupos ---------------------------------------------- */}
      <h3 style={titulo}>3 · Divide tu secuencia en grupos</h3>
      <p style={parrafo}>
        Se recorre la secuencia de izquierda a derecha y se cierra el grupo justo antes de que un
        actuador se repita. Escribe la tuya y compruébalo:
      </p>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '0 0 10px' }}>
        <span style={{ fontSize: '0.88rem', color: '#33475c' }}>Secuencia:</span>
        <input
          value={secuencia}
          onChange={(e) => setSecuencia(e.target.value)}
          placeholder="A+ B+ B- A-"
          spellCheck={false}
          style={{
            padding: '0.4rem 0.6rem',
            fontSize: '1rem',
            fontFamily: 'ui-monospace, Menlo, monospace',
            border: '1px solid #c6ced6',
            borderRadius: 6,
            minWidth: 220,
          }}
        />
        <span style={{ fontSize: '0.8rem', color: '#5a6b7d' }}>
          Prueba también <code style={codigo}>A+ A- B+ B-</code>
        </span>
      </label>

      {analisis.error && (
        <p style={{ ...parrafo, color: '#b3261e' }}>⚠ {analisis.error}</p>
      )}

      {analisis.grupos.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            {analisis.grupos.map((grupo, i) => (
              <div
                key={i}
                style={{
                  border: `2px solid ${COLORES_GRUPO[i % COLORES_GRUPO.length]}`,
                  borderRadius: 8,
                  padding: '0.4rem 0.7rem',
                  background: '#fff',
                }}
              >
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: COLORES_GRUPO[i % COLORES_GRUPO.length],
                    marginBottom: 2,
                  }}
                >
                  GRUPO {i + 1} · línea L{i + 1}
                </div>
                <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '1.02rem' }}>
                  {grupo.map((m) => m.texto).join('  ')}
                </div>
              </div>
            ))}
          </div>
          <p style={{ ...parrafo, margin: '0 0 6px' }}>
            <strong>{analisis.grupos.length}</strong>{' '}
            {analisis.grupos.length === 1 ? 'grupo' : 'grupos'} →{' '}
            {analisis.valvulasCascada === 0 ? (
              <>
                <strong>no hace falta cascada</strong>: no hay ninguna señal bloqueante en esta
                secuencia.
              </>
            ) : (
              <>
                hacen falta <strong>{analisis.valvulasCascada}</strong>{' '}
                {analisis.valvulasCascada === 1
                  ? 'válvula biestable de cascada'
                  : 'válvulas biestables de cascada'}{' '}
                (siempre una menos que grupos).
              </>
            )}
          </p>
        </>
      )}

      {/* 4 — Reglas de cableado --------------------------------------------- */}
      <h3 style={titulo}>4 · Las tres reglas de cableado</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={tabla}>
          <tbody>
            <tr style={{ background: '#f3f5f7' }}>
              <td style={{ ...celda, width: 260, fontWeight: 600 }}>
                El <strong>primer</strong> movimiento de cada grupo
              </td>
              <td style={celda}>lo manda directamente su línea de grupo</td>
            </tr>
            <tr>
              <td style={{ ...celda, fontWeight: 600 }}>Los <strong>demás</strong> movimientos</td>
              <td style={celda}>
                los manda el final de carrera del movimiento anterior, alimentado desde esa misma línea
              </td>
            </tr>
            <tr style={{ background: '#f3f5f7' }}>
              <td style={{ ...celda, fontWeight: 600 }}>
                El <strong>último</strong> final de carrera de un grupo
              </td>
              <td style={celda}>conmuta la cascada a la línea siguiente</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={pie}>
        El último final de carrera del último grupo vuelve a la línea 1, normalmente en serie con el
        pulsador de marcha: así el ciclo se repite mientras lo mantengas y se detiene al soltarlo.
      </p>

      {/* 5 — El ejemplo resuelto -------------------------------------------- */}
      <h3 style={titulo}>5 · Los tiempos del ejemplo resuelto</h3>
      <div style={{ overflowX: 'auto', marginTop: 6 }}>
        <table style={tabla}>
          <tbody>
            {PASOS_EJEMPLO.map(([t, texto], i) => (
              <tr key={i} style={{ background: i % 2 ? '#f3f5f7' : '#fff' }}>
                <td style={{ ...celda, width: 90, fontFamily: 'ui-monospace, Menlo, monospace', whiteSpace: 'nowrap' }}>
                  {t}
                </td>
                <td style={celda}>{texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={pie}>
        El momento clave es <strong>t = 2,5 s</strong>: ahí es donde el método hace su trabajo. Míralo
        también en el diagrama espacio-fase, que dibujará A+ B+ B− A− solo.
      </p>

      {/* 6 — Comprobación ---------------------------------------------------- */}
      <h3 style={titulo}>6 · Cómo comprobar que está bien montado</h3>
      <ul style={{ ...parrafo, paddingLeft: '1.2rem' }}>
        <li>
          <strong>Nunca puede haber dos líneas de grupo con presión a la vez.</strong> Es la regla de
          oro del método: si ves dos azules, está mal.
        </li>
        <li>Cada final de carrera cuelga de una línea de grupo, jamás de la red directa.</li>
        <li>Cada línea de grupo pilota directamente un solo movimiento: el primero de su grupo.</li>
      </ul>
      <h3 style={titulo}>7 · Con tres grupos: el circuito de la Actividad 2</h3>
      <p style={parrafo}>
        Con tres o más grupos las válvulas van encadenadas —de ahí el nombre—: cada una o alimenta su
        línea, o pasa el aire a la siguiente. Este es el circuito de la secuencia{' '}
        <code style={codigo}>A+ B+ | B− A− C+ | C−</code> del curso, con dos cilindros de doble
        efecto, un actuador giratorio, seis finales de carrera y dos válvulas de cascada.
      </p>
      <button onClick={() => cargar(CIRCUITO_TRES_GRUPOS)} style={{ ...boton, background: '#1668c7' }}>
        Cargar el circuito de tres grupos
      </button>
      <p style={pie}>
        Es un circuito grande: usa el <strong>zoom</strong> de la pizarra para trabajarlo cómodo.
        Existe también el <strong>método paso a paso</strong>, que gasta más válvulas pero escala
        mejor y no obliga a agrupar.
      </p>
    </>
  )
}


const titulo: React.CSSProperties = {
  margin: '18px 0 6px',
  fontSize: '0.95rem',
  color: '#33475c',
}

const parrafo: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: '0.9rem',
  color: '#33475c',
  lineHeight: 1.6,
}

const pie: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: '0.84rem',
  color: '#5a6b7d',
  lineHeight: 1.55,
}

const codigo: React.CSSProperties = {
  background: '#eef1f4',
  borderRadius: 4,
  padding: '0.05rem 0.3rem',
  fontFamily: 'ui-monospace, Menlo, monospace',
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

const tabla: React.CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  fontSize: '0.86rem',
  minWidth: 420,
}

const celda: React.CSSProperties = {
  border: '1px solid #d5dbe1',
  padding: '0.45rem 0.6rem',
  textAlign: 'left',
  verticalAlign: 'top',
  color: '#33475c',
  lineHeight: 1.5,
}
