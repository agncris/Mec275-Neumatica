/**
 * Portada de NeumaLab: elige la unidad del curso. La unidad 1 (neumática)
 * es el laboratorio de siempre; la unidad 2 (PLC) se carga sólo cuando
 * alguien la abre.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import App from './App'

const UnidadPLC = lazy(() => import('./plc/UnidadPLC'))

type Unidad = 'neumatica' | 'plc'
const CLAVE = 'neumalab.unidad'

function unidadInicial(): Unidad {
  if (typeof window === 'undefined') return 'neumatica'
  // Un enlace compartido de un circuito abre siempre neumática.
  if (/[#&]c=/.test(window.location.hash)) return 'neumatica'
  const param = new URLSearchParams(window.location.search).get('unidad')
  if (param === 'plc' || param === 'neumatica') return param
  try {
    return localStorage.getItem(CLAVE) === 'plc' ? 'plc' : 'neumatica'
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
      unidad === 'plc' ? 'NeumaLab — Laboratorio virtual de PLC' : 'NeumaLab — Laboratorio virtual de neumática'
  }, [unidad])

  const pestanas: Array<[Unidad, string, string]> = [
    ['neumatica', 'Unidad 1 · Neumática', 'Circuitos neumáticos, método cascada y banco 3D'],
    ['plc', 'Unidad 2 · PLC', 'Programación Ladder y plantas del laboratorio en 3D'],
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
        <Suspense fallback={<p style={{ padding: 24, color: '#5a6b7d', textAlign: 'center' }}>Abriendo la unidad de PLC…</p>}>
          <UnidadPLC />
        </Suspense>
      )}
    </>
  )
}
