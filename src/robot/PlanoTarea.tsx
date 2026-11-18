import { BarraEjemplo as BarraEjemploTarea } from '../components/banco/EjemploTarea'
import { enlaceEstudiar } from './estilos'
import type { ItemAvance, PasoTarea } from './guiaTarea'
import type { PuntoRevisionTarea } from './tarea4'

/** Barra del ejemplo: va por encima de las pestañas del panel, no dentro de Plano. */
export function BarraEjemplo({ ejemplo, onEjemplo, onVolver, onSeguir }: { ejemplo: boolean; onEjemplo: () => void; onVolver: () => void; onSeguir: () => void }) {
  return (
    <BarraEjemploTarea
      ejemplo={ejemplo}
      aviso="Estás viendo el ejemplo del contorno. No es tu entrega."
      etiquetaVer="Ver el ejemplo del contorno"
      onVer={onEjemplo}
      onVolver={onVolver}
      etiquetaSeguir="Seguir con este contorno"
      tituloSeguir="Deja este contorno en tu tarea, en lugar de lo que tenías"
      onSeguir={onSeguir}
    />
  )
}

/** El plano de la tarea, con el proceso arriba y un solo paso abierto. */
export default function PlanoTarea({ paso, avance, checklist, onEstudiar, ejemplo }: { paso: PasoTarea; avance: ItemAvance[]; checklist: PuntoRevisionTarea[]; onEstudiar: (ancla: string) => void; ejemplo: boolean }) {
  return (
    <div data-plano-tarea="si" style={{ fontSize: '0.84rem', color: 'var(--texto)', lineHeight: 1.45 }}>
      <section className="proceso" aria-label="Proceso de la tarea" data-paso-ahora={ejemplo ? 'ejemplo' : paso.id}>
        {ejemplo ? (
          <>
            <p style={{ margin: 0, fontWeight: 700 }}>Ejemplo del contorno. No es tu entrega.</p>
            <p style={{ margin: '6px 0 0' }}>Curve (CONTORNO) → Offset +2,5 → Move Z −5 → Toolpath → husillo encendido, espera y apagado → Core. Sirve para mirar cómo se conecta. Las nueve ranuras quedan para tu tarea.</p>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 4px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--tinta-suave)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {paso.grupo} · paso {paso.numero} de {paso.total}
            </p>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={paso.total} aria-valuenow={avance.filter((a) => a.hecho).length} style={{ height: 6, borderRadius: 3, background: '#e3e8ee', margin: '0 0 10px', overflow: 'hidden' }}>
              <div style={{ width: `${(avance.filter((a) => a.hecho).length / paso.total) * 100}%`, height: '100%', background: 'var(--verde)' }} />
            </div>
            <p style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 750 }}>{paso.titulo}</p>
            {paso.pista && (
              <p data-pista-tarea="si" style={{ margin: '0 0 8px', padding: '6px 8px', borderRadius: 6, background: '#fff4e0', border: '1px solid #f0c987', color: '#6b4200' }}>
                <strong>Te falta esto:</strong> {paso.pista}
              </p>
            )}
            <ol style={{ margin: '0 0 8px', paddingLeft: 20 }}>
              {paso.pasos.map((t) => <li key={t} style={{ marginBottom: 2 }}>{t}</li>)}
            </ol>
            <p style={{ margin: '0 0 4px' }}><strong>Dónde:</strong> {paso.donde}</p>
            <p style={{ margin: '0 0 4px' }}><strong>Listo cuando:</strong> {paso.listo}</p>
            <p className="u-parrafo"><strong>Por qué:</strong> {paso.por}</p>
            <details data-todos-los-pasos="si" style={{ marginTop: 4 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 650 }}>Ver todos los pasos ({avance.filter((a) => a.hecho).length} de {paso.total} hechos)</summary>
              <ol style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
                {avance.map((a, n) => (
                  <li key={a.id} aria-current={a.ahora ? 'step' : undefined} style={{ display: 'flex', gap: 6, padding: '2px 0', color: a.hecho ? 'var(--verde)' : a.ahora ? '#0b4f9c' : 'var(--tinta-suave)', fontWeight: a.ahora ? 700 : 500 }}>
                    <span aria-hidden="true" style={{ width: 16, flex: 'none' }}>{a.hecho ? '✓' : a.ahora ? '→' : '○'}</span>
                    <span>{n + 1}. {a.titulo}</span>
                  </li>
                ))}
              </ol>
            </details>
          </>
        )}
      </section>
      <p className="u-parrafo">La fresa de 5 mm recorre el contorno (Offset +2,5) y las nueve ranuras (Offset −2,5), baja 5 mm y se acerca con PTP. Plancha de 250 × 250 mm. Los chaflanes y los arcos ya vienen en el DXF.</p>
      <p style={{ margin: '0 0 2px', fontWeight: 700 }}>Criterios de éxito</p>
      <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
        <li>El recorrido sigue el contorno y las ranuras sin chocar.</li>
        <li>No hay singularidades ni ejes fuera de su límite.</li>
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
