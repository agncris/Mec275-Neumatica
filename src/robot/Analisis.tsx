import { enlaceEstudiar } from './estilos'
import type { Simulacion } from './movimiento'

type Problema = Simulacion['problemas'][number]

/**
 * Los criterios con que se revisa un programa de robot, en el orden en que se piensan:
 * llegar, no pasarse de los ejes, que la muñeca no gire de golpe, no chocar y, si corta,
 * el husillo. Cada uno junta los avisos de la simulación que le corresponden.
 */
const CRITERIOS: Array<{ id: string; ok: string; mal: string; es: RegExp; idea: string; ancla: string; pregunta: string; husillo?: boolean }> = [
  {
    id: 'alcance',
    ok: 'Llega a todos los puntos.',
    mal: 'Hay puntos a los que no llega.',
    es: /alcance/i,
    idea: 'El punto está más lejos de lo que el brazo se estira. Acerca la pieza o usa un robot más grande.',
    ancla: 'ficha-tecnica',
    pregunta: '¿Qué es el alcance?',
  },
  {
    id: 'ejes',
    ok: 'Ningún eje pasa de su límite.',
    mal: 'Algún eje pasa de su límite o queda justo.',
    es: /fuera de su rango|cerca del límite/i,
    idea: 'Cada articulación gira hasta cierto ángulo. Cambia cómo apunta la herramienta o dónde está la pieza.',
    ancla: 'grados',
    pregunta: '¿Hasta dónde gira cada eje?',
  },
  {
    id: 'muneca',
    ok: 'No cambia de postura de golpe.',
    mal: 'Cambia de postura de golpe en algún tramo.',
    es: /muñeca|salto brusco/i,
    idea: 'Pasa cuando un eje llega al final de su giro y tiene que dar la vuelta, o con la muñeca estirada (A5 cerca de 0°), donde A4 y A6 giran mucho para seguir el camino. Inclina un poco la herramienta o mueve la pieza.',
    ancla: 'grados',
    pregunta: '¿Por qué el robot gira de golpe?',
  },
  {
    id: 'choque',
    ok: 'No choca con la plancha ni con el mesón.',
    mal: 'Algo choca con la plancha o con el mesón.',
    es: /^choque/i,
    idea: 'Revisa la Z de los puntos: la cara de la plancha es Z 0 y la fresa baja solo el espesor.',
    ancla: 'parametrica',
    pregunta: '¿Dónde está el cero de la pieza?',
  },
  {
    id: 'husillo',
    ok: 'El husillo se enciende antes de cortar y se apaga al final.',
    mal: 'El husillo no se enciende a tiempo o queda encendido.',
    es: /husillo/i,
    idea: 'La fresa tiene que estar girando antes de tocar el material, y apagada al volver a HOME.',
    ancla: 'parametrica',
    pregunta: '¿Qué es el husillo?',
    husillo: true,
  },
]

export default function Analisis({ sim, onIr, onEstudiar, conHusillo = true }: { sim: Simulacion; onIr: (p: Problema) => void; onEstudiar: (ancla: string) => void; conHusillo?: boolean }) {
  const usados = new Set<Problema>()
  const filas = CRITERIOS.filter((c) => !c.husillo || conHusillo).map((c) => {
    const suyos = sim.problemas.filter((p) => c.es.test(p.texto))
    suyos.forEach((p) => usados.add(p))
    return { c, suyos }
  })
  const otros = sim.problemas.filter((p) => !usados.has(p))
  const ir = (p: Problema) => (
    <button type="button" className="revision__ir" onClick={() => onIr(p)} title="Lleva la simulación a ese instante">
      Ver en {p.t.toFixed(1)} s
    </button>
  )
  return (
    <div className="u-mt-8" data-lista-analisis="si">
      <p className="revision__titulo">¿Lo hace bien?</p>
      <ul className="revision">
        {filas.map(({ c, suyos }) => {
          const error = suyos.some((p) => p.nivel === 'error')
          const estado = suyos.length === 0 ? 'ok' : error ? 'error' : 'aviso'
          return (
            <li key={c.id} className="revision__item" data-estado={estado} data-criterio={c.id}>
              <p className="revision__linea">
                <span aria-hidden="true">{estado === 'ok' ? '✓' : estado === 'error' ? '✕' : '⚠'}</span>
                <strong>{estado === 'ok' ? c.ok : c.mal}</strong>
              </p>
              {suyos.length > 0 && (
                <>
                  <p className="revision__detalle">
                    {suyos[0].texto} {ir(suyos[0])}
                    {suyos.length > 1 && <span className="revision__mas"> y {suyos.length - 1} vez(es) más.</span>}
                  </p>
                  <p className="revision__detalle">
                    {c.idea}{' '}
                    <button type="button" onClick={() => onEstudiar(c.ancla)} style={enlaceEstudiar}>
                      {c.pregunta} → Estudiar
                    </button>
                  </p>
                </>
              )}
            </li>
          )
        })}
      </ul>
      {otros.length > 0 && (
        <>
          <p className="revision__titulo">Otros avisos</p>
          {otros.slice(0, 8).map((p, i) => (
            <p key={i} className="revision__detalle" data-nivel={p.nivel}>
              {p.nivel === 'error' ? '✕' : '⚠'} {p.texto} {ir(p)}
            </p>
          ))}
        </>
      )}
      <p className="revision__resumen">
        {sim.muestras.length} posiciones calculadas · recorrido de corte {Math.round(sim.largoCorte)} mm · {sim.tiempo.toFixed(1)} s
      </p>
    </div>
  )
}
