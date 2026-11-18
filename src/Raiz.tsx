/**
 * Portada de MecLab: elige la unidad del curso. La unidad 1 (neumática)
 * es el laboratorio de siempre; todas las unidades se cargan sólo cuando alguien
 * las abre (la de neumática, que es la de siempre, empieza a bajar de inmediato).
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import MecBot from './components/MecBot'
import { useDesplazarEnBordes } from './desplazarEnBordes'
import { unidadVisible, VER_CNC, VER_ROBOTICA, type Unidad } from './unidades'
import { CLAVES, guardarTexto, leerTexto } from './persistencia'

const cargarNeumatica = () => import('./App')
const UnidadNeumatica = lazy(cargarNeumatica)
const UnidadPLC = lazy(() => import('./plc/UnidadPLC'))
// Las unidades no publicadas quedan fuera de la compilación (ver unidades.ts).
const UnidadCNC = VER_CNC ? lazy(() => import('./cnc/UnidadCNC')) : null
const UnidadRobotica = VER_ROBOTICA ? lazy(() => import('./robot/UnidadRobotica')) : null

const UNIDADES = (['neumatica', 'plc', 'cnc', 'robotica'] as Unidad[]).filter(unidadVisible)
const CLAVE = CLAVES.unidad

function unidadInicial(): Unidad {
  if (typeof window === 'undefined') return 'neumatica'
  // Un enlace compartido de un circuito abre siempre neumática.
  if (/[#&]c=/.test(window.location.hash)) return 'neumatica'
  // Los enlaces con un trabajo de otra unidad abren esa unidad.
  if (/[#&]plc=/.test(window.location.hash)) return 'plc'
  if (/[#&]cnc=/.test(window.location.hash) && unidadVisible('cnc')) return 'cnc'
  if (/[#&]rob=/.test(window.location.hash) && unidadVisible('robotica')) return 'robotica'
  const param = new URLSearchParams(window.location.search).get('unidad')
  if (UNIDADES.includes(param as Unidad)) return param as Unidad
  const guardada = leerTexto(CLAVE)
  return UNIDADES.includes(guardada as Unidad) ? (guardada as Unidad) : 'neumatica'
}

// Si se abre en neumática, el trozo empieza a bajar ya, sin esperar al primer dibujo.
if (typeof window !== 'undefined' && unidadInicial() === 'neumatica') void cargarNeumatica()

export default function Raiz() {
  useDesplazarEnBordes()
  const [unidad, setUnidad] = useState<Unidad>(unidadInicial)
  // Sin internet la app sigue funcionando (service worker): se avisa para que nadie se preocupe.
  const [sinConexion, setSinConexion] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  useEffect(() => {
    const cambiar = () => setSinConexion(!navigator.onLine)
    window.addEventListener('online', cambiar)
    window.addEventListener('offline', cambiar)
    return () => {
      window.removeEventListener('online', cambiar)
      window.removeEventListener('offline', cambiar)
    }
  }, [])
  useEffect(() => {
    guardarTexto(CLAVE, unidad)
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
        ? 'MecLab — Laboratorio virtual de PLC'
        : unidad === 'cnc'
          ? 'MecLab — Simulador de CNC'
          : unidad === 'robotica'
            ? 'MecLab — Robótica paramétrica'
            : 'MecLab — Laboratorio virtual de neumática'
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
  ].filter(([id]) => UNIDADES.includes(id as Unidad)) as Array<[Unidad, string, string, string]>
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
            style={{ display: 'flex', alignItems: 'baseline', gap: 8, textDecoration: 'none', color: 'var(--texto)', flexShrink: 0 }}
            title="MecLab · laboratorio virtual del curso MEC275"
            className="barra-superior__marca"
          >
            <strong style={{ fontSize: '1.08rem', letterSpacing: '-0.01em' }}>MecLab</strong>
            <span className="barra-superior__curso" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--tinta-suave)' }}>
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
      {sinConexion && (
        <p role="status" data-sin-conexion="si" style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 90, margin: 0, padding: '0.35rem 0.7rem', background: 'var(--tinta)', color: '#fff', borderRadius: 8, fontSize: '0.82rem', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
          Sin conexión: la app funciona igual y tu trabajo se guarda en este navegador.
        </p>
      )}
      <MecBot unidad={unidad} />
      <ErrorBoundary key={unidad} alVolver={() => cambiarUnidad('neumatica')}>
        <Suspense fallback={<p role="status" style={{ padding: 24, color: 'var(--tinta-tenue)', textAlign: 'center' }}>{unidad === 'neumatica' ? 'Abriendo el laboratorio…' : 'Abriendo la unidad…'}</p>}>
          {unidad === 'neumatica' ? <UnidadNeumatica /> : unidad === 'plc' ? <UnidadPLC /> : unidad === 'cnc' && UnidadCNC ? <UnidadCNC /> : unidad === 'robotica' && UnidadRobotica ? <UnidadRobotica /> : null}
        </Suspense>
      </ErrorBoundary>
    </>
  )
}
