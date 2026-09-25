/**
 * Portada de NeumaLab: elige la unidad del curso. La unidad 1 (neumática)
 * es el laboratorio de siempre; las unidades 2 (PLC), 3 (CNC) y 4 (robótica)
 * se cargan sólo cuando alguien las abre.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import App from './App'

const UnidadPLC = lazy(() => import('./plc/UnidadPLC'))
const UnidadCNC = lazy(() => import('./cnc/UnidadCNC'))
const UnidadRobotica = lazy(() => import('./robot/UnidadRobotica'))

type Unidad = 'neumatica' | 'plc' | 'cnc' | 'robotica'
const UNIDADES: Unidad[] = ['neumatica', 'plc', 'cnc', 'robotica']
const CLAVE = 'neumalab.unidad'

function unidadInicial(): Unidad {
  if (typeof window === 'undefined') return 'neumatica'
  // Un enlace compartido de un circuito abre siempre neumática.
  if (/[#&]c=/.test(window.location.hash)) return 'neumatica'
  // Los enlaces con un trabajo de otra unidad abren esa unidad.
  if (/[#&]plc=/.test(window.location.hash)) return 'plc'
  if (/[#&]cnc=/.test(window.location.hash)) return 'cnc'
  if (/[#&]rob=/.test(window.location.hash)) return 'robotica'
  const param = new URLSearchParams(window.location.search).get('unidad')
  if (UNIDADES.includes(param as Unidad)) return param as Unidad
  try {
    const guardada = localStorage.getItem(CLAVE)
    return UNIDADES.includes(guardada as Unidad) ? (guardada as Unidad) : 'neumatica'
  } catch {
    return 'neumatica'
  }
}

export default function Raiz() {
  const [unidad, setUnidad] = useState<Unidad>(unidadInicial)
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, unidad)
    } catch {
      /* sin almacenamiento */
    }
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('unidad') !== unidad) {
        url.searchParams.set('unidad', unidad)
        window.history.replaceState(null, '', url)
      }
    } catch {
      /* sin historial */
    }
    window.scrollTo({ top: 0 })
    document.title =
      unidad === 'plc'
        ? 'NeumaLab — Laboratorio virtual de PLC'
        : unidad === 'cnc'
          ? 'NeumaLab — Simulador de CNC'
          : unidad === 'robotica'
            ? 'NeumaLab — Robótica paramétrica'
            : 'NeumaLab — Laboratorio virtual de neumática'
  }, [unidad])

  // Otra unidad empieza en su laboratorio: la sección y el ancla de la anterior no valen.
  const cambiarUnidad = (id: Unidad) => {
    if (id === unidad) return
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('vista')
      url.hash = ''
      window.history.replaceState(null, '', url)
    } catch {
      /* sin historial */
    }
    setUnidad(id)
  }

  const pestanas: Array<[Unidad, string, string, string]> = [
    ['neumatica', '1', 'Neumática', 'Circuitos neumáticos, método cascada y banco 3D'],
    ['plc', '2', 'PLC', 'Programación Ladder y plantas del laboratorio en 3D'],
    ['cnc', '3', 'CNC', 'Código G, torno y fresadora con simulación de mecanizado en 3D'],
    ['robotica', '4', 'Robótica', 'Robots KUKA: programación por nodos (como Grasshopper + KUKA|prc), mando y simulación 3D'],
  ]
  return (
    <>
      <div className="barra-superior">
        <div className="barra-superior__fila">
          <a
            href="?"
            onClick={(e) => {
              e.preventDefault()
              cambiarUnidad('neumatica')
            }}
            style={{ display: 'flex', alignItems: 'baseline', gap: 8, textDecoration: 'none', color: '#1c2733', flexShrink: 0 }}
            title="NeumaLab · laboratorio virtual del curso MEC275"
            className="barra-superior__marca"
          >
            <strong style={{ fontSize: '1.08rem', letterSpacing: '-0.01em' }}>NeumaLab</strong>
            <span className="barra-superior__curso" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#51606f' }}>
              MEC275
            </span>
          </a>
          <nav aria-label="Unidades del curso" className="pestanas-unidad">
            {pestanas.map(([id, n, texto, titulo]) => (
              <button key={id} title={titulo} aria-current={unidad === id ? 'page' : undefined} onClick={() => cambiarUnidad(id)} className="pestana-unidad">
                <span className="pestana-unidad__n">{n}</span>
                {texto}
              </button>
            ))}
          </nav>
          {/* Aquí cada unidad puede poner su navegación de segundo nivel. */}
          <div id="barra-unidad" className="barra-superior__extra" />
        </div>
      </div>
      {unidad === 'neumatica' ? (
        <App />
      ) : (
        <Suspense fallback={<p style={{ padding: 24, color: '#5a6b7d', textAlign: 'center' }}>Abriendo la unidad…</p>}>
          {unidad === 'plc' ? <UnidadPLC /> : unidad === 'cnc' ? <UnidadCNC /> : <UnidadRobotica />}
        </Suspense>
      )}
    </>
  )
}
