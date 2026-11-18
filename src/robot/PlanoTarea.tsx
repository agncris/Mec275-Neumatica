import { enlaceEstudiar } from './estilos'
import type { PuntoRevisionTarea } from './tarea4'

/** Lo que se consulta mientras se arma la tarea: qué se pide, los criterios y la lámina. La guía de pasos va sobre el programa. */
export default function PlanoTarea({ checklist, onEstudiar }: { checklist: PuntoRevisionTarea[]; onEstudiar: (ancla: string) => void }) {
  return (
    <div data-plano-tarea="si" style={{ fontSize: '0.84rem', color: 'var(--texto)', lineHeight: 1.45 }}>
      <p className="u-parrafo">La fresa de 5 mm recorre el contorno (Offset +2,5) y las nueve ranuras (Offset −2,5), baja 5 mm y se acerca con PTP. Plancha de 250 × 250 mm. Los chaflanes y los arcos ya vienen en el DXF.</p>
      <p style={{ margin: '0 0 2px', fontWeight: 700 }}>Criterios de éxito</p>
      <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
        <li>El recorrido sigue el contorno y las ranuras sin chocar.</li>
        <li>La muñeca no gira de golpe y ningún eje pasa de su límite.</li>
        <li>El programa KRL se puede leer.</li>
      </ul>
      <p className="u-m-0-0-6">
        <button type="button" onClick={() => onEstudiar('parametrica')} style={enlaceEstudiar}>
          ¿No recuerdas la diferencia entre LIN y CIR? → Estudiar
        </button>
      </p>
      {checklist.length > 0 && (
        <ul className="checklist-tarea" data-checklist-tarea="si">
          {checklist.map((p) => (
            <li key={p.texto} className={p.ok ? 'checklist-tarea__item checklist-tarea__item--ok' : 'checklist-tarea__item checklist-tarea__item--falta'}>
              <span className="checklist-tarea__marca" aria-hidden="true">{p.ok ? '✓' : '☐'}</span>
              <span>{p.texto}</span>
            </li>
          ))}
        </ul>
      )}
      <a href="/plano-tarea4-robotica.png" target="_blank" rel="noreferrer" title="Abrir la lámina en grande">
        <img src="/plano-tarea4-robotica.png" alt="Lámina de la Tarea 4: plancha de 250 por 250 mm con chaflanes, una cruz de ranuras rectas, cuatro ranuras en arco de radios 100 y 110 mm y un agujero cuadrado central" style={{ width: '100%', maxWidth: 900, height: 'auto', display: 'block', border: '1px solid var(--borde-tenue)', borderRadius: 6, background: '#fff' }} />
      </a>
    </div>
  )
}
