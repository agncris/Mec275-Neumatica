/**
 * Panel acoplado bajo el lienzo de neumática: el registro «¿Qué está
 * pasando?» (en orden, con lo último abajo) y el diagrama espacio-fase.
 */
import type { Motor } from '../../engine'
import DiagramaEspacioFase from '../DiagramaEspacioFase'
import PanelAcoplado from './PanelAcoplado'

export type PestanaInferior = 'registro' | 'fase'

interface Props {
  abierto: boolean
  onAbrir: (a: boolean) => void
  alto: number
  onAlto: (h: number) => void
  ampliado?: boolean
  onAmpliar?: (a: boolean) => void
  pestana: PestanaInferior
  onPestana: (p: PestanaInferior) => void
  motor: Motor | null
  eventos: Array<{ t: number; mensaje: string }>
  fijo?: boolean
}

/** Alto con el que el diagrama de fase se lee bien sin ampliar el panel. */
const ALTO_FASE = 340

export default function PanelInferior({ abierto, onAbrir, alto, onAlto, ampliado, onAmpliar, pestana, onPestana, motor, eventos, fijo }: Props) {
  const registro =
    eventos.length === 0 ? (
      <p style={{ color: '#51606f', margin: 0, fontSize: '0.88rem' }}>
        {motor ? 'Simulación corriendo. Acciona una válvula para ver los eventos.' : 'Pulsa ▶ Simular y acciona las válvulas: aquí aparece lo que va ocurriendo, en orden.'}
      </p>
    ) : (
      <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', lineHeight: 1.55, fontSize: '0.88rem' }} data-registro="si">
        {eventos.map((e, i) => (
          <li key={`${e.t}-${i}`} style={{ opacity: i === eventos.length - 1 ? 1 : 0.8 }}>
            <code style={{ color: '#51606f', marginRight: 8 }}>t={e.t.toFixed(1)} s</code>
            {e.mensaje}
          </li>
        ))}
      </ol>
    )

  return (
    <PanelAcoplado<PestanaInferior>
      etiqueta="Registro y diagrama"
      pestanas={[
        { id: 'registro', titulo: '¿Qué está pasando?', contador: eventos.length, contenido: registro, seguirFinal: true },
        { id: 'fase', titulo: 'Diagrama espacio-fase', contenido: <DiagramaEspacioFase motor={motor} /> },
      ]}
      abierto={abierto}
      onAbrir={onAbrir}
      alto={alto}
      onAlto={onAlto}
      ampliado={ampliado}
      onAmpliar={onAmpliar}
      pestana={pestana}
      onPestana={(p) => {
        onPestana(p)
        // El diagrama necesita más alto que el registro: si el panel está bajo, crece.
        if (p === 'fase' && !fijo && alto < ALTO_FASE) onAlto(Math.min(ALTO_FASE, Math.round(window.innerHeight * 0.45)))
      }}
      fijo={fijo}
    />
  )
}
