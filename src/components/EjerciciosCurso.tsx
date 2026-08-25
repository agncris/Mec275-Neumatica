/**
 * Sección «Ejercicios y evaluaciones del curso»: reúne los enunciados de las
 * actividades y de la tarea de la unidad de neumática, junto con lo que hay
 * que entregar y los circuitos que ya se pueden cargar en la pizarra.
 */
import { CIRCUITO_TRES_GRUPOS } from '../circuitos/ejercicios'
import { useStore } from '../store'

interface Ejercicio {
  clave: string
  titulo: string
  enunciado: string
  pide: string[]
  cargar?: () => void
  notaCarga?: string
}

export default function EjerciciosCurso() {
  const cargarCircuito = useStore((s) => s.cargarCircuito)

  const cargar = (datos: { piezas: typeof CIRCUITO_TRES_GRUPOS.piezas; mangueras: typeof CIRCUITO_TRES_GRUPOS.mangueras }) => {
    const { piezas } = useStore.getState()
    if (
      piezas.length > 0 &&
      !window.confirm(`¿Cargar este circuito?\nSe quitarán las ${piezas.length} fichas de la pizarra.`)
    ) {
      return
    }
    cargarCircuito(datos)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const ejercicios: Ejercicio[] = [
    {
      clave: 'act1',
      titulo: 'Actividad en clase 1 · Dispositivo de fresado',
      enunciado:
        'El cilindro A traslada las piezas del depósito al dispositivo de sujeción. El cilindro B las sujeta. El avance lo hace la unidad C. Tras el fresado, el cilindro D expulsa la pieza. La unidad de avance vuelve a su posición inicial. C y D regresan simultáneamente y la máquina trabaja en forma automática.',
      pide: [
        'Indicar la secuencia de automatización.',
        'Realizar el diagrama de fase.',
        'Diseñar el circuito neumático, con inicio de accionamiento manual.',
      ],
    },
    {
      clave: 'act2',
      titulo: 'Actividad en clase 2 / Evaluación N.º 1 · Secuencia de tres grupos',
      enunciado:
        'Sistema automatizado de tres actuadores con secuencia A+ B+ | B− A− C+ | C−. Se compone de 2 cilindros de doble efecto, 1 actuador rotacional, 3 válvulas 5/2, 6 finales de carrera 3/2, 1 válvula 3/2 manual de inicio, unidad de mantenimiento y fuente de aire comprimido.',
      pide: [
        'Explicar qué sucede con cada componente al activar el sistema de forma manual.',
        'Describir la secuencia identificando actuadores, activadores y grupos.',
        'Dibujar el diagrama de fase del sistema.',
      ],
      cargar: () => cargar(CIRCUITO_TRES_GRUPOS),
      notaCarga:
        'Carga el circuito resuelto, pulsa ▶ Simular y mantén la válvula M: la secuencia se repite sola y el diagrama de fase se dibuja mientras corre.',
    },
    {
      clave: 'tarea',
      titulo: 'Tarea 1 · Impresión bilateral por tampón',
      enunciado:
        'Una pieza ya impresa por una cara es sujetada por una mordaza que la eleva separándola de la línea de transporte, la gira 180° y la vuelve a colocar sobre la línea. A continuación la línea avanza lo suficiente para que el tampón descienda e imprima sobre la cara vacía. El movimiento debe repetirse de forma automática.',
      pide: [
        'Diagrama de funcionamiento del autómata según la norma VDI 2860 (15 pts).',
        'Identificar la secuencia, los grupos y los activadores (20 pts).',
        'Identificar los elementos necesarios del circuito (15 pts).',
        'Dibujar el diagrama de fase de cada actuador (20 pts).',
        'Diseñar el circuito neumático completo (30 pts).',
      ],
      notaCarga:
        'La unidad elevadora y el tampón son cilindros de doble efecto; la unidad giratoria es el actuador giratorio de la paleta, configurado a 180°.',
    },
  ]

  return (
    <>

      <p style={parrafo}>
        Los enunciados de la unidad, con lo que hay que entregar en cada uno. Todo el trabajo se
        puede hacer aquí: monta el circuito en la pizarra, simúlalo para comprobar que la secuencia
        es la correcta y exporta las láminas desde la barra de arriba.
      </p>

      {ejercicios.map((ej) => (
        <section key={ej.clave} style={tarjeta}>
          <h3 style={titulo}>{ej.titulo}</h3>
          <p style={{ ...parrafo, margin: '0 0 8px' }}>{ej.enunciado}</p>
          <p style={{ ...parrafo, margin: '0 0 4px', fontWeight: 600 }}>Se pide:</p>
          <ol style={{ ...parrafo, margin: '0 0 8px', paddingLeft: '1.3rem' }}>
            {ej.pide.map((linea, i) => (
              <li key={i}>{linea}</li>
            ))}
          </ol>
          {ej.cargar && (
            <button onClick={ej.cargar} style={boton}>
              Cargar el circuito en la pizarra
            </button>
          )}
          {ej.notaCarga && <p style={pie}>{ej.notaCarga}</p>}
        </section>
      ))}

      <h3 style={titulo}>Qué entregar</h3>
      <p style={parrafo}>
        Escribe tu nombre en el campo <strong>Trabajo</strong> de la barra superior (por ejemplo{' '}
        <code style={codigo}>Nombre_Apellido_Tarea-1</code>) y usa los botones de esa misma fila:
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={tabla}>
          <thead>
            <tr style={{ background: '#8a97a5', color: '#fff' }}>
              <th style={{ ...celda, width: 170 }}>Botón</th>
              <th style={celda}>Para qué sirve</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...celda, fontWeight: 600 }}>Circuito (PNG)</td>
              <td style={celda}>La lámina del circuito, para pegar en el informe PDF.</td>
            </tr>
            <tr style={{ background: '#f3f5f7' }}>
              <td style={{ ...celda, fontWeight: 600 }}>Circuito (SVG)</td>
              <td style={celda}>La misma lámina en vectorial: no se pixela al imprimir o ampliar.</td>
            </tr>
            <tr>
              <td style={{ ...celda, fontWeight: 600 }}>Diagrama de fase (PNG)</td>
              <td style={celda}>
                El diagrama recorrido-tiempo con la secuencia A+ / A− ya marcada. Exporta mientras la
                simulación está corriendo.
              </td>
            </tr>
            <tr style={{ background: '#f3f5f7' }}>
              <td style={{ ...celda, fontWeight: 600 }}>Guardar</td>
              <td style={celda}>
                El archivo <code style={codigo}>.json</code> del circuito. Es el equivalente al{' '}
                <code style={codigo}>.ct</code> de FluidSim: se puede volver a abrir con «Abrir» y
                seguir editándolo, y sirve para que el profesor revise el montaje.
              </td>
            </tr>
            <tr>
              <td style={{ ...celda, fontWeight: 600 }}>Compartir</td>
              <td style={celda}>
                Un enlace que lleva el circuito dentro. Útil para consultar dudas sin adjuntar nada.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}

const titulo: React.CSSProperties = { margin: '14px 0 6px', fontSize: '0.95rem', color: '#33475c' }
const parrafo: React.CSSProperties = {
  margin: '10px 0',
  fontSize: '0.9rem',
  color: '#33475c',
  lineHeight: 1.6,
}
const pie: React.CSSProperties = { margin: '8px 0 0', fontSize: '0.84rem', color: '#5a6b7d', lineHeight: 1.55 }
const codigo: React.CSSProperties = {
  background: '#eef1f4',
  borderRadius: 4,
  padding: '0.05rem 0.3rem',
  fontFamily: 'ui-monospace, Menlo, monospace',
}
const tarjeta: React.CSSProperties = {
  border: '1px solid #dbe1e8',
  borderRadius: 10,
  padding: '0.8rem 1rem',
  marginBottom: 12,
  background: '#fdfdfc',
}
const boton: React.CSSProperties = {
  border: 'none',
  background: '#1668c7',
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
