/**
 * La guía de la Tarea 4, en un solo lugar: sobre el programa, donde se trabaja.
 * Dice qué paso toca, qué hacer y por qué (el criterio de robótica). El ejemplo
 * del contorno se abre desde aquí y, mientras se mira, esta tarjeta es el aviso
 * con «Volver a mi tarea».
 */
import type { ItemAvance, PasoTarea } from './guiaTarea'

export default function GuiaTarjeta({
  paso,
  avance,
  ejemplo,
  onVerEjemplo,
  onVolver,
  onSeguir,
}: {
  paso: PasoTarea
  avance: ItemAvance[]
  ejemplo: boolean
  onVerEjemplo: () => void
  onVolver: () => void
  onSeguir: () => void
}) {
  if (ejemplo) {
    return (
      <section className="guia-tarea guia-tarea--ejemplo" data-ejemplo-tarea="si" aria-label="Ejemplo del contorno">
        <p className="guia-tarea__titulo">Estás viendo el ejemplo del contorno. No es tu entrega.</p>
        <p className="guia-tarea__texto">Mira cómo se conecta: Curve (CONTORNO), Offset +2,5, Move en Z −5, Toolpath y el husillo. Las ranuras quedan para ti. Tu tarea sigue guardada.</p>
        <div className="guia-tarea__botones">
          <button type="button" className="guia-tarea__principal" onClick={onVolver} data-volver-tarea="si">
            Volver a mi tarea
          </button>
          <button type="button" className="guia-tarea__secundario" onClick={onSeguir} data-seguir-ejemplo="si" title="Deja este contorno en tu tarea, en lugar de lo que tenías">
            Seguir con este contorno
          </button>
        </div>
      </section>
    )
  }
  const hechos = avance.filter((a) => a.hecho).length
  return (
    <section className="guia-tarea" data-guia-paso={paso.id} aria-label="Guía de la tarea">
      <div className="guia-tarea__cabeza">
        <span className="guia-tarea__etapa">
          {paso.grupo} · paso {paso.numero} de {paso.total}
        </span>
        <div className="guia-tarea__barra" role="progressbar" aria-valuemin={0} aria-valuemax={paso.total} aria-valuenow={hechos} aria-label="Avance de la tarea">
          <div style={{ width: `${(hechos / paso.total) * 100}%` }} />
        </div>
        <button type="button" className="guia-tarea__enlace" onClick={onVerEjemplo} data-ver-ejemplo="si" title="Abre un contorno ya armado para mirarlo. Tu tarea queda guardada.">
          Ver un ejemplo
        </button>
      </div>
      <p className="guia-tarea__titulo">{paso.titulo}</p>
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
        <summary>Cómo se hace, paso a paso</summary>
        <ol>
          {paso.pasos.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
        <p>
          <strong>Listo cuando:</strong> {paso.listo}
        </p>
      </details>
      <details className="guia-tarea__mas" data-todos-los-pasos="si">
        <summary>
          Ver los {paso.total} pasos ({hechos} hechos)
        </summary>
        <ol className="guia-tarea__lista">
          {avance.map((a, n) => (
            <li key={a.id} aria-current={a.ahora ? 'step' : undefined} data-estado={a.hecho ? 'hecho' : a.ahora ? 'ahora' : 'falta'}>
              <span aria-hidden="true">{a.hecho ? '✓' : a.ahora ? '→' : '○'}</span>
              <span>
                {n + 1}. {a.titulo}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}
