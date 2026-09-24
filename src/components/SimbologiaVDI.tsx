/**
 * Sección «Simbología VDI 2860»: tabla de referencia con las 24 funciones de
 * manipulación y un modo de práctica que reproduce el tipo de pregunta del
 * control (te dan el símbolo y pones el nombre, o al revés).
 */
import { useMemo, useState } from 'react'
import { FUNCIONES_VDI, SimboloVDI, type FuncionVDI } from '../symbols/SimbolosVDI'

const FAMILIAS: Array<{ id: FuncionVDI['familia']; titulo: string; pie: string }> = [
  {
    id: 'manipular',
    titulo: 'Manipular — marco cuadrado',
    pie: 'Funciones de manipulación: almacenar, sujetar, mover y orientar la pieza.',
  },
  {
    id: 'fabricar',
    titulo: 'Fabricar — marco circular',
    pie: 'Operaciones que cambian la pieza: darle forma, deformarla, tratarla o montarla.',
  },
  {
    id: 'controlar',
    titulo: 'Controlar — triángulo invertido',
    pie: 'Símbolo básico de las funciones de control del proceso.',
  },
]

/** Baraja estable para una ronda de práctica. */
function mezclar<T>(lista: T[]): T[] {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

export default function SimbologiaVDI() {
  const [practicando, setPracticando] = useState(false)
  const [ronda, setRonda] = useState(0)
  const [aciertos, setAciertos] = useState(0)
  const [intentos, setIntentos] = useState(0)
  const [elegida, setElegida] = useState<number | null>(null)

  const pregunta = useMemo(() => {
    const correcta = FUNCIONES_VDI[Math.floor(Math.random() * FUNCIONES_VDI.length)]
    const distractores = mezclar(FUNCIONES_VDI.filter((f) => f.n !== correcta.n)).slice(0, 3)
    return { correcta, opciones: mezclar([correcta, ...distractores]) }
    // `ronda` fuerza una pregunta nueva en cada vuelta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ronda])

  const responder = (n: number) => {
    if (elegida !== null) return
    setElegida(n)
    setIntentos((i) => i + 1)
    if (n === pregunta.correcta.n) setAciertos((a) => a + 1)
  }

  return (
    <>

      <p style={parrafo}>
        La norma alemana <strong>VDI 2860</strong> describe con símbolos las funciones de un proceso
        automatizado. En el control te piden completar la tabla en las dos direcciones —del símbolo
        al nombre y del nombre al símbolo—, y en la tarea se pide el diagrama de funcionamiento del
        autómata con esta simbología.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '0 0 12px' }}>
        <button
          onClick={() => {
            setPracticando((p) => !p)
            setAciertos(0)
            setIntentos(0)
            setElegida(null)
            setRonda((r) => r + 1)
          }}
          style={{ ...boton, background: practicando ? '#33475c' : '#12a35a' }}
        >
          {practicando ? 'Ver la tabla completa' : '▶ Practicar para el control'}
        </button>
        {practicando && intentos > 0 && (
          <span style={{ fontSize: '0.86rem', color: '#33475c' }}>
            Aciertos: <strong>{aciertos}</strong> de {intentos}
          </span>
        )}
      </div>

      {practicando ? (
        <div style={{ maxWidth: 520 }}>
          <p style={{ ...parrafo, margin: '0 0 8px' }}>¿Qué función representa este símbolo?</p>
          <div
            style={{
              width: 130,
              height: 130,
              margin: '0 auto 12px',
              padding: 10,
              border: '1px solid #dbe1e8',
              borderRadius: 10,
              background: '#fff',
            }}
          >
            <SimboloVDI n={pregunta.correcta.n} />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            {pregunta.opciones.map((op) => {
              const esCorrecta = op.n === pregunta.correcta.n
              const respondida = elegida !== null
              const fondo = !respondida
                ? '#fff'
                : esCorrecta
                  ? '#e7f7ef'
                  : op.n === elegida
                    ? '#fdf2f1'
                    : '#fff'
              const borde = !respondida
                ? '#c6ced6'
                : esCorrecta
                  ? '#12a35a'
                  : op.n === elegida
                    ? '#b3261e'
                    : '#c6ced6'
              return (
                <button
                  key={op.n}
                  onClick={() => responder(op.n)}
                  disabled={respondida}
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem 0.7rem',
                    borderRadius: 8,
                    border: `1.5px solid ${borde}`,
                    background: fondo,
                    fontSize: '0.88rem',
                    color: '#33475c',
                    cursor: respondida ? 'default' : 'pointer',
                  }}
                >
                  {op.nombre}
                </button>
              )
            })}
          </div>

          {elegida !== null && (
            <button
              onClick={() => {
                setElegida(null)
                setRonda((r) => r + 1)
              }}
              style={{ ...boton, background: '#1668c7', marginTop: 10 }}
            >
              Siguiente símbolo ▶
            </button>
          )}
        </div>
      ) : (
        FAMILIAS.map((fam) => {
          const funciones = FUNCIONES_VDI.filter((f) => f.familia === fam.id)
          return (
            <section key={fam.id} style={{ marginBottom: 18 }}>
              <h3 style={titulo}>{fam.titulo}</h3>
              <p style={{ ...parrafo, margin: '0 0 8px' }}>{fam.pie}</p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
                  gap: 8,
                }}
              >
                {funciones.map((f) => (
                  <div
                    key={f.n}
                    style={{
                      border: '1px solid #dbe1e8',
                      borderRadius: 8,
                      padding: '8px 6px',
                      background: '#fff',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ width: 62, height: 62, margin: '0 auto' }}>
                      <SimboloVDI n={f.n} />
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#5f6b78', marginTop: 4 }}>{f.n}</div>
                    <div style={{ fontSize: '0.74rem', color: '#33475c', lineHeight: 1.35 }}>
                      {f.nombre}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })
      )}
    </>
  )
}

const titulo: React.CSSProperties = { margin: '14px 0 4px', fontSize: '0.95rem', color: '#33475c' }
const parrafo: React.CSSProperties = {
  margin: '10px 0',
  fontSize: '0.9rem',
  color: '#33475c',
  lineHeight: 1.6,
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
