/**
 * Sección «Simbología ISO 1219-1»: tabla de referencia con los símbolos de
 * componentes neumáticos (actuadores, válvulas, unidad de mantenimiento…) y
 * un modo de práctica que reproduce el tipo de pregunta del control (te dan
 * el símbolo y pones el nombre, o al revés). Reutiliza los mismos símbolos
 * SVG que dibuja el circuito, para que lo que se practica aquí sea
 * exactamente lo que se ve al montar la pizarra.
 */
import { useMemo, useState } from 'react'
import type { Params } from '../engine'
import { DESCRIPTORES } from './descriptores'
import { SimboloFRL, SimboloPieza } from '../symbols/Simbolos'

interface ComponenteISO {
  n: number
  nombre: string
  familia: 'actuadores' | 'valvulas' | 'auxiliares'
  tipo: string
  params: Params
}

const COMPONENTES_ISO: ComponenteISO[] = [
  {
    n: 1,
    nombre: 'Cilindro (actuador) de simple efecto, retorno por muelle',
    familia: 'actuadores',
    tipo: 'cilindroSimpleEfecto',
    params: {},
  },
  {
    n: 2,
    nombre: 'Cilindro (actuador) de doble efecto',
    familia: 'actuadores',
    tipo: 'cilindroDobleEfecto',
    params: {},
  },
  {
    n: 3,
    nombre: 'Actuador giratorio (semi-giratorio, ángulo limitado)',
    familia: 'actuadores',
    tipo: 'actuadorGiratorio',
    params: { angulo: 180 },
  },
  {
    n: 4,
    nombre: 'Motor neumático (giro continuo)',
    familia: 'actuadores',
    tipo: 'motorNeumatico',
    params: {},
  },
  {
    n: 5,
    nombre: 'Válvula 3 vías 2 posiciones, normalmente cerrada (NC), accionamiento por botonera, retorno por muelle',
    familia: 'valvulas',
    tipo: 'valvula32',
    params: { reposo: 'NC', accionamiento: 'pulsador' },
  },
  {
    n: 6,
    nombre: 'Válvula 3 vías 2 posiciones, normalmente abierta (NA), accionamiento por botonera, retorno por muelle',
    familia: 'valvulas',
    tipo: 'valvula32',
    params: { reposo: 'NA', accionamiento: 'pulsador' },
  },
  {
    n: 7,
    nombre: 'Válvula 3/2 con accionamiento por rodillo (final de carrera), retorno por muelle',
    familia: 'valvulas',
    tipo: 'valvula32',
    params: { reposo: 'NC', accionamiento: 'rodillo' },
  },
  {
    n: 8,
    nombre: 'Válvula 4 vías 2 posiciones (4/2)',
    familia: 'valvulas',
    tipo: 'valvula42',
    params: { modo: 'monoestable', accionamiento: 'pulsador' },
  },
  {
    n: 9,
    nombre: 'Válvula 5 vías 2 posiciones (5/2), accionamiento por botonera, retorno por muelle',
    familia: 'valvulas',
    tipo: 'valvula52',
    params: { modo: 'monoestable', accionamiento: 'pulsador' },
  },
  {
    n: 10,
    nombre: 'Válvula 5/2, accionamiento neumático, retorno por muelle',
    familia: 'valvulas',
    tipo: 'valvula52',
    params: { modo: 'monoestable', accionamiento: 'pilotaje' },
  },
  {
    n: 11,
    nombre: 'Válvula 5/2 biestable (memoria), accionamiento y retorno neumático',
    familia: 'valvulas',
    tipo: 'valvula52',
    params: { modo: 'biestable' },
  },
  {
    n: 12,
    nombre: 'Regulador de caudal unidireccional (con antirretorno)',
    familia: 'valvulas',
    tipo: 'reguladorCaudal',
    params: { apertura: 0.5 },
  },
  {
    n: 13,
    nombre: 'Válvula de escape rápido',
    familia: 'valvulas',
    tipo: 'escapeRapido',
    params: {},
  },
  {
    n: 14,
    nombre: 'Válvula selectora «O» (lógica OR)',
    familia: 'valvulas',
    tipo: 'valvulaO',
    params: {},
  },
  {
    n: 15,
    nombre: 'Válvula de simultaneidad «Y» (lógica AND, mando bimanual)',
    familia: 'valvulas',
    tipo: 'valvulaY',
    params: {},
  },
  {
    n: 16,
    nombre: 'Temporizador neumático (retardo a la conexión)',
    familia: 'valvulas',
    tipo: 'temporizador',
    params: { retardo: 2 },
  },
  {
    n: 17,
    nombre: 'Unidad de mantenimiento (Filtro-Regulador-Lubricador, FRL)',
    familia: 'auxiliares',
    tipo: 'frl',
    params: {},
  },
  {
    n: 18,
    nombre: 'Compresor + unidad de mantenimiento (fuente de aire)',
    familia: 'auxiliares',
    tipo: 'fuente',
    params: { presion: 6, encendida: true },
  },
  {
    n: 19,
    nombre: 'Manómetro',
    familia: 'auxiliares',
    tipo: 'manometro',
    params: {},
  },
]

const FAMILIAS: Array<{ id: ComponenteISO['familia']; titulo: string; pie: string }> = [
  {
    id: 'actuadores',
    titulo: 'Actuadores',
    pie: 'Los elementos que hacen el trabajo mecánico: avanzan, giran un ángulo fijo o giran sin parar.',
  },
  {
    id: 'valvulas',
    titulo: 'Válvulas',
    pie: 'Distribuidoras, de bloqueo, reguladoras y lógicas: gobiernan por dónde pasa el aire.',
  },
  {
    id: 'auxiliares',
    titulo: 'Preparación del aire y lectura',
    pie: 'Acondicionan el aire antes de usarlo y permiten leer la presión de una línea.',
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

function SimboloISO({ item }: { item: ComponenteISO }) {
  const desc = DESCRIPTORES[item.tipo]
  const ancho = desc?.ancho ?? 100
  const alto = desc?.alto ?? 100
  return (
    <svg viewBox={`-6 -6 ${ancho + 12} ${alto + 12}`} style={{ width: '100%', height: '100%' }}>
      {item.tipo === 'frl' ? <SimboloFRL /> : <SimboloPieza tipo={item.tipo} params={item.params} vivo={null} />}
    </svg>
  )
}

export default function SimbologiaISO() {
  const [practicando, setPracticando] = useState(false)
  const [ronda, setRonda] = useState(0)
  const [aciertos, setAciertos] = useState(0)
  const [intentos, setIntentos] = useState(0)
  const [elegida, setElegida] = useState<number | null>(null)

  const pregunta = useMemo(() => {
    const correcta = COMPONENTES_ISO[Math.floor(Math.random() * COMPONENTES_ISO.length)]
    const distractores = mezclar(COMPONENTES_ISO.filter((f) => f.n !== correcta.n)).slice(0, 3)
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
        La norma <strong>ISO 1219-1</strong> fija los símbolos de los componentes neumáticos. En el
        control te piden completar la tabla en las dos direcciones —del símbolo al nombre y del
        nombre al símbolo— para actuadores, válvulas y la unidad de mantenimiento.
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
          style={{ ...boton, background: practicando ? '#33475c' : '#0e7a43' }}
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
          <p style={{ ...parrafo, margin: '0 0 8px' }}>¿Qué componente es este símbolo?</p>
          <div
            style={{
              width: 190,
              height: 140,
              margin: '0 auto 12px',
              padding: 10,
              border: '1px solid #dbe1e8',
              borderRadius: 10,
              background: '#fff',
            }}
          >
            <SimboloISO item={pregunta.correcta} />
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
          const items = COMPONENTES_ISO.filter((f) => f.familia === fam.id)
          return (
            <section key={fam.id} style={{ marginBottom: 18 }}>
              <h3 style={titulo}>{fam.titulo}</h3>
              <p style={{ ...parrafo, margin: '0 0 8px' }}>{fam.pie}</p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
                  gap: 8,
                }}
              >
                {items.map((f) => (
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
                    <div style={{ width: '100%', height: 74, margin: '0 auto' }}>
                      <SimboloISO item={f} />
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#33475c', lineHeight: 1.35, marginTop: 4 }}>
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
