/**
 * Área derecha de Neumática, igual que en las otras unidades: la simulación
 * con su play dentro y la barra de tiempo debajo. Por defecto es el banco 3D
 * (con el cubo de vistas); «Por dentro» muestra los componentes en corte, en 2D.
 */
import { lazy, Suspense, type ReactNode } from 'react'
import type { Motor } from '../../engine'
import type { PlayEscena } from '../PlayEscena'
import Pizarra from '../Pizarra'
import { TituloArea } from './BancoDividido'

// El banco 3D arrastra three.js: se carga sólo cuando alguien lo abre.
const Banco3D = lazy(() => import('../../vista3d/Banco3D'))

export type VistaSimulacion = '3d' | 'dentro'

interface Props {
  motor: Motor | null
  vista: VistaSimulacion
  onVista: (v: VistaSimulacion) => void
  /** El navegador no dibuja en 3D: queda sólo «Por dentro». */
  sinWebGL: boolean
  onSinWebGL: () => void
  play: PlayEscena
  barraTiempo: ReactNode
}

export default function AreaSimulacionNeumatica({ motor, vista, onVista, sinWebGL, onSinWebGL, play, barraTiempo }: Props) {
  const opciones: Array<[VistaSimulacion, string, string]> = [
    ['3d', '3D', sinWebGL ? 'Tu navegador no dibuja en 3D' : 'El banco en tres dimensiones'],
    ['dentro', 'Por dentro', 'Los componentes por dentro, en 2D'],
  ]
  return (
    <>
      <TituloArea
        derecha={
          <span className="segmentado" role="radiogroup" aria-label="Cómo ver la simulación" style={{ marginLeft: 'auto' }}>
            {opciones.map(([v, texto, ayuda]) => (
              <button key={v} role="radio" aria-checked={vista === v} onClick={() => onVista(v)} disabled={v === '3d' && sinWebGL} title={ayuda} data-vista-sim={v}>
                {texto}
              </button>
            ))}
          </span>
        }
      >
        Simulación
      </TituloArea>
      <div className="relleno">
        <div className="escena-neumatica">
          {vista === '3d' && !sinWebGL ? (
            <Suspense fallback={<p className="u-vacio">Montando el banco…</p>}>
              <Banco3D motor={motor} llenar play={play} onSinWebGL={onSinWebGL} />
            </Suspense>
          ) : (
            <Pizarra motor={motor} vista="taller" id="pizarra-taller-svg" llenar play={play} />
          )}
        </div>
      </div>
      {barraTiempo}
    </>
  )
}
