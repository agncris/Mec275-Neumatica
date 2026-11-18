/**
 * La guía de la Tarea 4, sobre el programa. Arriba, el mapa: las cuatro etapas
 * del proceso con los bloques que hay que armar, marcados según lo que ya está
 * en el lienzo. Abajo, solo lo que toca ahora: qué hacer y por qué.
 * Mientras se mira el ejemplo, esta tarjeta es el aviso con «Volver a mi tarea».
 */
import type { EtapaMapa, PasoTarea } from './guiaTarea'

export default function GuiaTarjeta({
  paso,
  etapas,
  ejemplo,
  onVerEjemplo,
  onVolver,
}: {
  paso: PasoTarea
  etapas: EtapaMapa[]
  ejemplo: boolean
  onVerEjemplo: () => void
  onVolver: () => void
}) {
  if (ejemplo) {
    return (
      <section className="guia-tarea guia-tarea--ejemplo" data-ejemplo-tarea="si" aria-label="Ejemplo del contorno">
        <p className="guia-tarea__titulo">Estás viendo un ejemplo. No es tu entrega.</p>
        <p className="guia-tarea__texto">Es solo el contorno: Curve (CONTORNO), Offset +2,5, Move Z -5, Toolpath y el husillo, todo al Core. Pulsa ▶ para verlo cortar. Tu tarea sigue guardada tal como la dejaste.</p>
        <div className="guia-tarea__botones">
          <button type="button" className="guia-tarea__principal" onClick={onVolver} data-volver-tarea="si">
            Volver a mi tarea
          </button>
        </div>
      </section>
    )
  }
  const piezas = etapas.flatMap((e) => e.piezas)
  const hechas = piezas.filter((p) => p.estado === 'hecho').length
  const etapaAhora = etapas.find((e) => e.piezas.some((p) => p.estado === 'ahora'))
  return (
    <section className="guia-tarea" data-guia-paso={paso.id} aria-label="Guía de la tarea">
      <div className="guia-tarea__cabeza">
        <span className="guia-tarea__etapa">
          Tarea 4 · {hechas} de {piezas.length} listos
        </span>
        <div className="guia-tarea__barra" role="progressbar" aria-valuemin={0} aria-valuemax={piezas.length} aria-valuenow={hechas} aria-label="Avance de la tarea">
          <div style={{ width: `${(hechas / piezas.length) * 100}%` }} />
        </div>
        <button type="button" className="guia-tarea__enlace" onClick={onVerEjemplo} data-ver-ejemplo="si" title="Abre un contorno ya armado para mirarlo. Tu tarea queda guardada.">
          Ver un ejemplo
        </button>
      </div>
      {hechas === 0 && <p className="guia-tarea__dado">El robot, la fresa de 5 mm y el Core con la plancha ya están puestos. Tú armas por dónde pasa la fresa y cuándo corta.</p>}
      {/* Las cuatro etapas del proceso en una línea; los bloques, solo de la etapa en curso. */}
      <ol className="mapa-tarea" aria-label="Etapas de la tarea">
        {etapas.map((e, n) => {
          const lista = e.piezas.every((p) => p.estado === 'hecho')
          return (
            <li key={e.id} className="mapa-tarea__etapa" data-estado={lista ? 'hecha' : e === etapaAhora ? 'ahora' : 'falta'} aria-current={e === etapaAhora ? 'step' : undefined}>
              <span className="mapa-tarea__num" aria-hidden="true">{lista ? '✓' : n + 1}</span>
              {e.titulo}
            </li>
          )
        })}
      </ol>
      {etapaAhora && (
        <p className="mapa-tarea__piezas" aria-label={`Bloques de la etapa ${etapaAhora.titulo}`}>
          {etapaAhora.piezas.map((p, k) => (
            <span key={p.id} className="mapa-tarea__fila">
              {k > 0 && <span className="mapa-tarea__flecha" aria-hidden="true">→</span>}
              <span className="mapa-tarea__pieza" data-estado={p.estado}>
                {p.estado === 'hecho' ? '✓ ' : ''}
                {p.texto}
              </span>
            </span>
          ))}
        </p>
      )}
      <div className="guia-tarea__ahora">
        <p className="guia-tarea__titulo">Ahora: {paso.titulo}</p>
        {/* Si el bloque ya está a medias, la pista dice lo mismo que la acción pero más preciso: va sola. */}
        {paso.pista ? (
          <p className="guia-tarea__pista" data-pista-tarea="si">
            <strong>Te falta esto:</strong> {paso.pista}
          </p>
        ) : (
          <p className="guia-tarea__texto">{paso.accion}</p>
        )}
        <p className="guia-tarea__por">
          <strong>Por qué:</strong> {paso.por}
        </p>
        <details className="guia-tarea__mas">
          <summary>Cómo se hace, clic a clic</summary>
          <ol>
            {paso.pasos.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <p>
            <strong>Listo cuando:</strong> {paso.listo}
          </p>
        </details>
      </div>
    </section>
  )
}
