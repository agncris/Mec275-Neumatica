import { enlaceEstudiar } from '../components/banco/ProcesoTarea'
import { type ResultadoGcode } from './gcode'


export default function Revision({ resultado, errores, avisos, irA, onEstudiar }: { resultado: ResultadoGcode; errores: ResultadoGcode['diagnosticos']; avisos: ResultadoGcode['diagnosticos']; irA: (n: number) => void; onEstudiar: (ancla: string) => void }) {
  const sinC = resultado.sinComentario
  return (
    <div className="u-mt-8" data-revision-cnc="si">
      {errores.length === 0 && avisos.length === 0 && (
        <p style={{ margin: '3px 0', color: 'var(--verde-oscuro)', fontSize: '0.86rem' }}>✓ El programa no tiene errores de escritura.</p>
      )}
      {[...errores, ...avisos].map((d, i) => (
        <p
          key={i}
          onClick={() => irA(d.linea)}
          style={{ margin: '3px 0', fontSize: '0.86rem', cursor: 'pointer', color: d.nivel === 'error' ? 'var(--rojo)' : d.nivel === 'aviso' ? 'var(--naranjo-aviso)' : 'var(--tinta-tenue)' }}
        >
          {d.nivel === 'error' ? '✕' : d.nivel === 'aviso' ? '⚠' : 'ℹ'} Línea {d.linea + 1}: {d.texto}
        </p>
      ))}
      {errores.length > 0 && (
        <p style={{ margin: '3px 0', fontSize: '0.82rem', color: 'var(--tinta-tenue)' }}>
          Con errores, la máquina ejecuta el programa sólo hasta la línea anterior al primer error.{' '}
          <button type="button" onClick={() => onEstudiar('bloque')} style={enlaceEstudiar}>
            ¿Cómo se escribe un bloque? → Estudiar
          </button>
        </p>
      )}
      {sinC.length > 0 && (
        <p style={{ margin: '3px 0', fontSize: '0.82rem', color: 'var(--tinta-tenue)' }}>
          ℹ {sinC.length === 1 ? 'Una línea no tiene' : `${sinC.length} líneas no tienen`} comentario:{' '}
          {sinC.slice(0, 12).map((n, i) => (
            <span key={n}>
              {i ? ', ' : ''}
              <a href="#" onClick={(e) => (e.preventDefault(), irA(n))}>
                {n + 1}
              </a>
            </span>
          ))}
          {sinC.length > 12 ? '…' : ''}. Comentar cada línea ( … ) ayuda a entender y revisar el programa.
        </p>
      )}
    </div>
  )
}
