/**
 * Portada de NeumaLab: elige la unidad del curso. La unidad 1 (neumática)
 * es el laboratorio de siempre; las unidades 2 (PLC) y 3 (CNC) se cargan
 * sólo cuando alguien las abre.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import App from './App'

const UnidadPLC = lazy(() => import('./plc/UnidadPLC'))
const UnidadCNC = lazy(() => import('./cnc/UnidadCNC'))

type Unidad = 'neumatica' | 'plc' | 'cnc'
const UNIDADES: Unidad[] = ['neumatica', 'plc', 'cnc']
const CLAVE = 'neumalab.unidad'

function unidadInicial(): Unidad {
  if (typeof window === 'undefined') return 'neumatica'
  // Un enlace compartido de un circuito abre siempre neumática.
  if (/[#&]c=/.test(window.location.hash)) return 'neumatica'
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
    document.title =
      unidad === 'plc'
        ? 'NeumaLab — Laboratorio virtual de PLC'
        : unidad === 'cnc'
          ? 'NeumaLab — Simulador de CNC'
          : 'NeumaLab — Laboratorio virtual de neumática'
  }, [unidad])

  const pestanas: Array<[Unidad, string, string]> = [
    ['neumatica', 'Unidad 1 · Neumática', 'Circuitos neumáticos, método cascada y banco 3D'],
    ['plc', 'Unidad 2 · PLC', 'Programación Ladder y plantas del laboratorio en 3D'],
    ['cnc', 'Unidad 3 · CNC', 'Código G, torno y fresadora con simulación de mecanizado en 3D'],
  ]
  return (
    <>
      <nav
        aria-label="Unidades del curso"
        style={{ maxWidth: 1320, margin: '0 auto', padding: '0.7rem 1.5rem 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}
      >
        {pestanas.map(([id, texto, titulo]) => {
          const activa = unidad === id
          return (
            <button
              key={id}
              title={titulo}
              aria-current={activa ? 'page' : undefined}
              onClick={() => setUnidad(id)}
              style={{
                border: `2px solid ${activa ? '#33475c' : '#c6ced6'}`,
                background: activa ? '#33475c' : '#fff',
                color: activa ? '#fff' : '#33475c',
                borderRadius: 999,
                padding: '0.35rem 1rem',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              {texto}
            </button>
          )
        })}
      </nav>
      {unidad === 'neumatica' ? (
        <App />
      ) : (
        <Suspense fallback={<p style={{ padding: 24, color: '#5a6b7d', textAlign: 'center' }}>Abriendo la unidad…</p>}>
          {unidad === 'plc' ? <UnidadPLC /> : <UnidadCNC />}
        </Suspense>
      )}
    </>
  )
}
