import { enlaceEstudiar } from './estilos'
import type { Simulacion } from './movimiento'

function ideaDe(texto: string): { idea: string; ancla: string; pregunta: string } | null {
  if (/singularidad|configuración/i.test(texto)) return { idea: 'La muñeca quedó estirada y dos ejes giran de golpe. Inclina un poco la herramienta.', ancla: 'grados', pregunta: '¿Qué es una singularidad?' }
  if (/alcance/i.test(texto)) return { idea: 'Ese punto está más lejos de lo que el brazo puede estirarse. Acerca la pieza o cambia el robot.', ancla: 'ficha-tecnica', pregunta: '¿Qué es el alcance?' }
  if (/fuera de su rango|cerca del límite/i.test(texto)) return { idea: 'Una articulación no puede girar tanto. Cambia la posición de la pieza o cómo apunta la herramienta.', ancla: 'grados', pregunta: '¿Qué son los límites de los ejes?' }
  if (/husillo/i.test(texto)) return { idea: 'La fresa tiene que estar girando antes de tocar el material, y apagada al terminar.', ancla: 'parametrica', pregunta: '¿Qué es el husillo?' }
  return null
}

export default function Analisis({ sim, onIr, onEstudiar }: { sim: Simulacion; onIr: (p: Simulacion['problemas'][number]) => void; onEstudiar: (ancla: string) => void }) {
  return (
    <div className="u-mt-8" data-lista-analisis="si">
      <p style={{ margin: '0 0 4px', fontSize: '0.84rem', color: 'var(--tinta)' }}>
        <strong>Análisis:</strong> {sim.muestras.length} posiciones calculadas · recorrido lineal {Math.round(sim.largoCorte)} mm · tiempo {sim.tiempo.toFixed(1)} s
      </p>
      {sim.problemas.length === 0 && <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--verde-oscuro)' }}>El robot llega a todos los puntos sin salirse de lo que sus ejes pueden girar.</p>}
      {sim.problemas.slice(0, 12).map((p, i) => {
        const idea = ideaDe(p.texto)
        return (
          <div key={i} style={{ margin: '6px 0' }}>
            <p style={{ margin: 0, fontSize: '0.84rem', color: p.nivel === 'error' ? 'var(--rojo)' : 'var(--naranjo-aviso)', cursor: 'pointer' }} onClick={() => onIr(p)} title="Ir a ese momento">
              {p.nivel === 'error' ? '✕' : '⚠'} {p.t.toFixed(1)} s · {p.texto}
            </p>
            {idea && (
              <p style={{ margin: '1px 0 0 16px', fontSize: '0.8rem', color: 'var(--tinta)' }}>
                {idea.idea}{' '}
                <button type="button" onClick={() => onEstudiar(idea.ancla)} style={enlaceEstudiar}>
                  {idea.pregunta} → Estudiar
                </button>
              </p>
            )}
          </div>
        )
      })}
      {sim.problemas.length > 12 && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--tinta-tenue)' }}>… y {sim.problemas.length - 12} más.</p>}
    </div>
  )
}
