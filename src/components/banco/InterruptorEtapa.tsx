/**
 * El interruptor «Armar / Probar» de la barra, igual en Robótica y en CNC.
 * Armar: el programa ocupa el ancho. Probar: la simulación ocupa el ancho.
 * Mientras se mira el ejemplo en Probar, al lado va «Volver a mi tarea».
 */
export type EtapaTrabajo = 'armar' | 'probar'

export default function InterruptorEtapa({
  etapa,
  onEtapa,
  estrecha,
  armar,
  probar,
  volver,
}: {
  etapa: EtapaTrabajo
  onEtapa: (e: EtapaTrabajo) => void
  estrecha: boolean
  /** Texto de «① …» (largo y corto). */
  armar: [string, string]
  /** Texto de «② …» (largo y corto). */
  probar: [string, string]
  /** Si se pasa y estamos en Probar, aparece «Volver a mi tarea». */
  volver?: () => void
}) {
  const textos: Record<EtapaTrabajo, [string, string]> = { armar, probar }
  return (
    <>
      <span className="segmentado segmentado--etapa" role="radiogroup" aria-label="Qué estás haciendo">
        {(['armar', 'probar'] as EtapaTrabajo[]).map((e) => (
          <button key={e} role="radio" aria-checked={etapa === e} onClick={() => onEtapa(e)} data-etapa={e} style={{ minHeight: 34 }}>
            {textos[e][estrecha ? 1 : 0]}
          </button>
        ))}
      </span>
      {volver && etapa === 'probar' && (
        <button type="button" onClick={volver} className="boton-volver-tarea" data-volver-tarea="si">
          Volver a mi tarea
        </button>
      )}
    </>
  )
}
