/**
 * Autoevaluación: una tanda de preguntas generadas al azar (no son las de los
 * controles ni de las tareas). El conteo es el largo de esa lista y el puntaje
 * cuenta los aciertos de la tanda. Cada unidad aporta sus generadores.
 */
import { useMemo, useState, type ReactNode } from 'react'

export interface Pregunta {
  /** De qué trata (se muestra como etiqueta). */
  tema: string
  enunciado: string
  /** Un dibujo que acompaña la pregunta (p. ej. un escalón Ladder). */
  figura?: ReactNode
  opciones: string[]
  correcta: number
  explicacion: string
}

export type Generador = (azar: () => number) => Pregunta

/** Elige un elemento al azar. */
export const elegir = <T,>(lista: T[], azar: () => number): T => lista[Math.floor(azar() * lista.length) % lista.length]

/** Mezcla las opciones y devuelve dónde quedó la correcta. */
export function mezclar(correcta: string, distractores: string[], azar: () => number): { opciones: string[]; correcta: number } {
  const unicas = [...new Set(distractores.filter((d) => d !== correcta))]
  const todas = [correcta, ...unicas.slice(0, 3)]
  for (let i = todas.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[todas[i], todas[j]] = [todas[j], todas[i]]
  }
  return { opciones: todas, correcta: todas.indexOf(correcta) }
}

type Fuente = { tema: string; generar: Generador }

/** Una pregunta por generador activo: el largo de la lista es el de esa fuente. */
function armarTanda(generadores: Fuente[], temas: string[]): Pregunta[] {
  const activos = generadores.filter((g) => temas.includes(g.tema))
  const fuente = activos.length ? activos : generadores
  const lista = fuente.map((g) => g.generar(Math.random))
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
  }
  return lista
}

function textoConteo(n: number): string {
  return n === 1 ? 'Esta práctica trae 1 pregunta.' : `Esta práctica trae ${n} preguntas.`
}

function textoPuntaje(aciertos: number, respondidas: number, posible: number): string {
  if (respondidas === 0) return `Puntaje: ${aciertos}. Total posible: ${posible}.`
  const palabra = respondidas === 1 ? 'respondida' : 'respondidas'
  return `Puntaje: ${aciertos} de ${respondidas} ${palabra}. Total posible: ${posible}.`
}

const botonPrimario: React.CSSProperties = {
  border: 'none',
  background: '#1668c7',
  color: '#fff',
  borderRadius: 8,
  padding: '0.45rem 1rem',
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: 38,
}

const botonSecundario: React.CSSProperties = {
  border: '1px solid #c6ced6',
  background: '#fff',
  color: '#33475c',
  borderRadius: 8,
  padding: '0.45rem 0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: 38,
}

export default function Autoevaluacion({ generadores, descripcion }: { generadores: Fuente[]; descripcion?: string }) {
  const [temas, setTemas] = useState<string[]>(() => generadores.map((g) => g.tema))
  const [tandaId, setTandaId] = useState(0)
  const [indice, setIndice] = useState(0)
  const [elegida, setElegida] = useState<number | null>(null)
  const [aciertos, setAciertos] = useState(0)
  const [respondidas, setRespondidas] = useState(0)
  const [racha, setRacha] = useState(0)
  const [cerrada, setCerrada] = useState(false)

  const temasClave = temas.slice().sort().join('|')
  const preguntas = useMemo(
    () => armarTanda(generadores, temas),
    // temasClave es el conjunto activo; tandaId pide otra lista con los mismos temas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [temasClave, tandaId, generadores],
  )

  const posible = preguntas.length
  const pregunta = preguntas[indice]

  const nuevaTanda = () => {
    setElegida(null)
    setIndice(0)
    setAciertos(0)
    setRespondidas(0)
    setRacha(0)
    setCerrada(false)
    setTandaId((id) => id + 1)
  }

  const alternarTema = (tema: string) => {
    const activo = temas.includes(tema)
    const siguiente = activo ? (temas.length > 1 ? temas.filter((x) => x !== tema) : temas) : [...temas, tema]
    if (siguiente === temas) return
    setTemas(siguiente)
    nuevaTanda()
  }

  const responder = (i: number) => {
    if (elegida !== null || !pregunta) return
    const acierto = i === pregunta.correcta
    setElegida(i)
    setRespondidas((n) => n + 1)
    if (acierto) {
      setAciertos((n) => n + 1)
      setRacha((n) => n + 1)
    } else {
      setRacha(0)
    }
  }

  const avanzar = () => {
    if (indice + 1 < preguntas.length) {
      setIndice((n) => n + 1)
      setElegida(null)
      return
    }
    setCerrada(true)
  }

  const aciertoActual = elegida !== null && pregunta !== undefined && elegida === pregunta.correcta
  const mensajeAcierto = aciertoActual ? (racha >= 2 ? `Racha de ${racha}.` : 'Sumaste un acierto.') : ''

  return (
    <div data-autoevaluacion="si">
      <style>{`
        @keyframes puntaje-salta {
          from { transform: translateY(6px); }
          to { transform: translateY(0); }
        }
        .puntaje-salta {
          display: inline-block;
          animation: puntaje-salta 180ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .puntaje-salta { animation: none; }
        }
      `}</style>
      <p style={{ margin: '0 0 8px', color: 'var(--tinta)', lineHeight: 1.55 }}>
        {descripcion ?? 'Preguntas de práctica generadas al azar: cada vez son distintas. Al responder ves la explicación.'}
      </p>
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 10, background: '#f4f7fb', border: '1px solid #d5dee8', display: 'grid', gap: 4 }}
      >
        <p data-conteo-preguntas="si" style={{ margin: 0, fontWeight: 700, color: 'var(--texto)', fontSize: '1rem' }}>
          {textoConteo(posible)}
        </p>
        <p data-puntaje="si" style={{ margin: 0, color: 'var(--texto)', fontSize: '0.95rem', lineHeight: 1.45 }}>
          {'Puntaje: '}<span key={aciertos} className="puntaje-salta" style={{ fontWeight: 800, fontSize: '1.35rem', fontVariantNumeric: 'tabular-nums', color: 'var(--azul)' }}>{aciertos}</span>{`${respondidas > 0 ? ` de ${respondidas} ${respondidas === 1 ? 'respondida' : 'respondidas'}` : ''}. Total posible: ${posible}.${racha >= 2 ? ` Racha de ${racha}.` : ''}`}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--tinta-suave)' }}>Temas:</span>
        {generadores.map((g) => {
          const activo = temas.includes(g.tema)
          return (
            <button
              key={g.tema}
              type="button"
              aria-pressed={activo}
              onClick={() => alternarTema(g.tema)}
              style={{ border: `1px solid ${activo ? '#33475c' : '#c6ced6'}`, background: activo ? 'var(--tinta)' : '#fff', color: activo ? '#fff' : 'var(--tinta)', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.8rem', cursor: 'pointer', minHeight: 30 }}
            >
              {g.tema}
            </button>
          )
        })}
      </div>
      {cerrada || !pregunta ? (
        <div style={{ border: '1px solid var(--borde-tenue)', borderRadius: 10, padding: '12px 14px', background: '#fbfcfd' }}>
          <p style={{ margin: '0 0 10px', color: 'var(--texto)', lineHeight: 1.5 }}>Terminaste esta tanda. {textoPuntaje(aciertos, respondidas, posible)}</p>
          <button type="button" onClick={nuevaTanda} style={botonPrimario} data-otra-tanda="si">
            Otra tanda
          </button>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--borde-tenue)', borderRadius: 10, padding: '12px 14px', background: '#fbfcfd' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--tinta-suave)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Pregunta {indice + 1} de {posible} · {pregunta.tema}
          </div>
          <p style={{ margin: '4px 0 10px', fontWeight: 600, color: 'var(--texto)', lineHeight: 1.5 }} data-enunciado="si">
            {pregunta.enunciado}
          </p>
          {pregunta.figura && <div style={{ marginBottom: 10, overflowX: 'auto' }}>{pregunta.figura}</div>}
          <div className="u-grid-6">
            {pregunta.opciones.map((op, i) => {
              const esCorrecta = i === pregunta.correcta
              const marcada = elegida === i
              const fondo = elegida === null ? '#fff' : esCorrecta ? '#e7f7ef' : marcada ? '#fdecea' : '#fff'
              const borde = elegida === null ? '#c6ced6' : esCorrecta ? '#0e7a43' : marcada ? '#b3261e' : '#e0e5eb'
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => responder(i)}
                  disabled={elegida !== null}
                  data-opcion={i}
                  data-correcta={elegida !== null && esCorrecta ? 'si' : undefined}
                  style={{ textAlign: 'left', border: `1.5px solid ${borde}`, background: fondo, color: 'var(--texto)', borderRadius: 8, padding: '0.5rem 0.7rem', cursor: elegida === null ? 'pointer' : 'default', fontSize: '0.92rem', minHeight: 40, fontFamily: /^[A-Z]{1,3}[:\d]/.test(op) ? 'ui-monospace, Menlo, monospace' : 'inherit' }}
                >
                  {elegida !== null && esCorrecta ? '✓ ' : elegida !== null && marcada ? '✗ ' : ''}
                  {op}
                </button>
              )
            })}
          </div>
          {elegida !== null && (
            <div role="status" style={{ marginTop: 10, padding: '0.55rem 0.7rem', borderRadius: 8, background: aciertoActual ? 'var(--fondo-verde)' : '#fff4e5', color: 'var(--tinta-oscura)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              <strong>{aciertoActual ? 'Correcto. ' : 'No es esa. '}</strong>
              {mensajeAcierto ? `${mensajeAcierto} ` : ''}
              {pregunta.explicacion}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {elegida !== null && indice + 1 >= posible ? (
              <button type="button" onClick={nuevaTanda} style={botonPrimario} data-otra-tanda="si">
                Otra tanda
              </button>
            ) : (
              <button type="button" onClick={avanzar} style={botonPrimario} data-otra-pregunta="si">
                {elegida === null ? 'Saltar' : 'Siguiente'}
              </button>
            )}
            {!(elegida !== null && indice + 1 >= posible) && (
              <button type="button" onClick={nuevaTanda} style={botonSecundario} data-otra-tanda="si">
                Otra tanda
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
