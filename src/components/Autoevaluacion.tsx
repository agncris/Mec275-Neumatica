/**
 * Autoevaluación: preguntas generadas al azar (no son las de los controles ni
 * de las tareas), con la respuesta explicada al contestar y un marcador de
 * aciertos en esta sesión. Cada unidad aporta su generador de preguntas.
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

export default function Autoevaluacion({ generadores, descripcion }: { generadores: Array<{ tema: string; generar: Generador }>; descripcion?: string }) {
  const [temas, setTemas] = useState<string[]>(() => generadores.map((g) => g.tema))
  const [ronda, setRonda] = useState(0)
  const [elegida, setElegida] = useState<number | null>(null)
  const [marcador, setMarcador] = useState({ bien: 0, total: 0 })
  const pregunta = useMemo(() => {
    const activos = generadores.filter((g) => temas.includes(g.tema))
    const g = elegir(activos.length ? activos : generadores, Math.random)
    return g.generar(Math.random)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ronda])

  const responder = (i: number) => {
    if (elegida !== null) return
    setElegida(i)
    setMarcador((m) => ({ bien: m.bien + (i === pregunta.correcta ? 1 : 0), total: m.total + 1 }))
  }
  const otra = () => {
    setElegida(null)
    setRonda((r) => r + 1)
  }

  return (
    <div data-autoevaluacion="si">
      <p style={{ margin: '0 0 8px', color: '#33475c', lineHeight: 1.55 }}>
        {descripcion ?? 'Preguntas de práctica generadas al azar: cada vez son distintas. Al responder ves la explicación.'}
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: '0.82rem', color: '#51606f' }}>Temas:</span>
        {generadores.map((g) => {
          const activo = temas.includes(g.tema)
          return (
            <button
              key={g.tema}
              aria-pressed={activo}
              onClick={() => setTemas((t) => (activo ? (t.length > 1 ? t.filter((x) => x !== g.tema) : t) : [...t, g.tema]))}
              style={{ border: `1px solid ${activo ? '#33475c' : '#c6ced6'}`, background: activo ? '#33475c' : '#fff', color: activo ? '#fff' : '#33475c', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.8rem', cursor: 'pointer', minHeight: 30 }}
            >
              {g.tema}
            </button>
          )
        })}
        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#33475c', fontWeight: 600 }} aria-live="polite">
          {marcador.total > 0 ? `${marcador.bien} de ${marcador.total} correctas` : ''}
        </span>
      </div>
      <div style={{ border: '1px solid #dbe1e8', borderRadius: 10, padding: '12px 14px', background: '#fbfcfd' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#51606f', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{pregunta.tema}</div>
        <p style={{ margin: '4px 0 10px', fontWeight: 600, color: '#1c2733', lineHeight: 1.5 }} data-enunciado="si">
          {pregunta.enunciado}
        </p>
        {pregunta.figura && <div style={{ marginBottom: 10, overflowX: 'auto' }}>{pregunta.figura}</div>}
        <div style={{ display: 'grid', gap: 6 }}>
          {pregunta.opciones.map((op, i) => {
            const esCorrecta = i === pregunta.correcta
            const marcada = elegida === i
            const fondo = elegida === null ? '#fff' : esCorrecta ? '#e7f7ef' : marcada ? '#fdecea' : '#fff'
            const borde = elegida === null ? '#c6ced6' : esCorrecta ? '#0e7a43' : marcada ? '#b3261e' : '#e0e5eb'
            return (
              <button
                key={i}
                onClick={() => responder(i)}
                disabled={elegida !== null}
                data-opcion={i}
                data-correcta={elegida !== null && esCorrecta ? 'si' : undefined}
                style={{ textAlign: 'left', border: `1.5px solid ${borde}`, background: fondo, color: '#1c2733', borderRadius: 8, padding: '0.5rem 0.7rem', cursor: elegida === null ? 'pointer' : 'default', fontSize: '0.92rem', minHeight: 40, fontFamily: /^[A-Z]{1,3}[:\d]/.test(op) ? 'ui-monospace, Menlo, monospace' : 'inherit' }}
              >
                {elegida !== null && esCorrecta ? '✓ ' : elegida !== null && marcada ? '✗ ' : ''}
                {op}
              </button>
            )
          })}
        </div>
        {elegida !== null && (
          <div role="status" style={{ marginTop: 10, padding: '0.55rem 0.7rem', borderRadius: 8, background: elegida === pregunta.correcta ? '#e7f7ef' : '#fff4e5', color: '#26323f', fontSize: '0.9rem', lineHeight: 1.5 }}>
            <strong>{elegida === pregunta.correcta ? '¡Correcto! ' : 'No es esa. '}</strong>
            {pregunta.explicacion}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <button onClick={otra} style={{ border: 'none', background: '#1668c7', color: '#fff', borderRadius: 8, padding: '0.45rem 1rem', fontWeight: 600, cursor: 'pointer', minHeight: 38 }} data-otra-pregunta="si">
            {elegida === null ? 'Saltar' : 'Otra pregunta'} →
          </button>
        </div>
      </div>
    </div>
  )
}
