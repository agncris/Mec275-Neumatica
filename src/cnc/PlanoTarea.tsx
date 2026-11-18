import ProcesoTarea, { enlaceEstudiar, type PasoProceso } from '../components/banco/ProcesoTarea'
import { type PuntoRevision } from './trabajo'

const ETAPAS_CNC = ['Unidades', 'Husillo', 'Acercar', 'Cortar', 'Cerrar', 'Revisar']

/** Código sin comentarios, para ver qué instrucciones ya escribió el alumno. */
function codigoUtil(codigo: string): string {
  return codigo.replace(/\(.*?\)/g, ' ').replace(/;.*/g, ' ')
}

/** Una sola pasada recta. No trae las cotas de la pieza. */
export const EJEMPLO_GUIADO_TORNO = `%
( Ejemplo a medias: una pasada recta. No es la pieza del plano. )
N10 G21 G90 G94          ( milímetros, absolutas, mm/min )
N20 T0101                ( herramienta de desbaste )
N30 M03 S800             ( husillo horario )
N40 G00 X42 Z2           ( acercarse sin tocar )
N50 G01 Z-10 F120        ( una recta de ejemplo: cámbiala por las cotas del plano )
N60 G00 X46              ( retirar )
N70 G00 Z2               ( volver )
( Aquí siguen las demás pasadas. Los arcos van con G02 o G03. )
N900 G28                 ( volver a la referencia )
N910 M05                 ( parar el husillo )
N920 M30                 ( fin de programa )
%
`

/**
 * Lo que está a medias en el programa, dicho como falta y no como respuesta. `undefined` si no hay nada
 * que avisar. Solo mira lo que el paso ya pide: unidades, velocidad S, avance F y parada del husillo.
 */
export function pistaCnc(codigo: string): string | undefined {
  const u = codigoUtil(codigo)
  if (/\bG20\b/i.test(u) && !/\bG21\b/i.test(u)) return 'Hay G20, que trabaja en pulgadas. La tarea va en milímetros.'
  if (/\bM0?[34]\b/i.test(u) && !/\bS\s*\d/i.test(u)) return 'Hay M03 o M04, pero no veo la velocidad S del husillo.'
  if (/\bG0?[123]\b/i.test(u) && !/\bF\s*\d/i.test(u)) return 'Hay un corte, pero no veo el avance F.'
  if (/\bM(30|0?2)\b/i.test(u) && !/\bM0?5\b/i.test(u)) return 'El programa termina, pero el husillo no se detiene con M05.'
  return undefined
}

export function pasoCnc(codigo: string): PasoProceso {
  const paso = pasoCncBase(codigo)
  const pista = pistaCnc(codigo)
  return pista ? { ...paso, pista } : paso
}

function pasoCncBase(codigo: string): PasoProceso {
  const u = codigoUtil(codigo)
  const total = ETAPAS_CNC.length
  const base = { total }
  if (!/\bG21\b/i.test(u)) {
    return { ...base, id: 'unidades', numero: 1, titulo: 'Trabajar en milímetros', donde: 'La primera línea útil del programa.', accion: 'Escribe G21. Al lado, entre paréntesis, di que son milímetros.', listo: 'En el programa se lee G21.' }
  }
  if (!/\bM0?[34]\b/i.test(u)) {
    return { ...base, id: 'husillo', numero: 2, titulo: 'Prender el husillo', donde: 'Debajo de G21, antes de mover la herramienta.', accion: 'Escribe M03 y la velocidad S (por ejemplo M03 S800). M03 gira en sentido horario.', listo: 'Hay un M03 o un M04 con su S.' }
  }
  if (!/\bG00\b/i.test(u)) {
    return { ...base, id: 'acercar', numero: 3, titulo: 'Acercarse sin cortar', donde: 'Antes del primer corte.', accion: 'Con G00 lleva la herramienta cerca del bruto, sin tocarlo. En el torno, X es diámetro.', listo: 'Hay un G00 antes del corte.' }
  }
  if (!/\bG0?[123]\b/i.test(u)) {
    return { ...base, id: 'cortar', numero: 4, titulo: 'Cortar con las cotas del plano', donde: 'Debajo del acercamiento.', accion: 'G01 corta en recta y G02 o G03 en arco. Pon el avance con F. Saca las medidas de la lámina, no las inventes.', listo: 'Hay al menos un G01, G02 o G03.' }
  }
  if (!/\bM(30|0?2)\b/i.test(u)) {
    return { ...base, id: 'cerrar', numero: 5, titulo: 'Terminar el programa', donde: 'La última línea útil.', accion: 'Para el husillo con M05 y cierra con M30.', listo: 'El programa termina en M30 o M02.' }
  }
  return { ...base, id: 'revisar', numero: 6, titulo: 'Probar el ciclo y leer el checklist', donde: 'El botón ▶ Ciclo, junto a la máquina, y el checklist del panel derecho.', accion: 'Corre el ciclo. Si salta una alarma o una pasada queda muy profunda, vuelve a esa línea. El checklist no califica: avisa lo que falta.', listo: 'El checklist del panel derecho queda en verde y la simulación llega al final.' }
}

/** El proceso de la tarea: el paso en curso, el avance, lo que falta y, cuando ya se puede, el botón para probar. */
export function GuiaCNC({ codigo, onEstudiar, onProbar, onVerPlano, onVerEjemplo }: { codigo: string; onEstudiar: (ancla: string) => void; onProbar?: () => void; onVerPlano?: () => void; onVerEjemplo?: () => void }) {
  const paso = pasoCnc(codigo)
  return (
    <ProcesoTarea etapas={ETAPAS_CNC} paso={paso} progreso>
      {onProbar && (paso.id === 'cerrar' || paso.id === 'revisar') && (
        <button type="button" className="guia-tarea__principal guia-tarea__probar" onClick={onProbar} data-ir-probar="si">
          Probar en la máquina →
        </button>
      )}
      <p className="u-m-8-0-0">
        <button type="button" onClick={() => onEstudiar(paso.id === 'revisar' ? 'torno' : 'codigos')} style={enlaceEstudiar}>
          ¿No recuerdas el código de este paso? → Estudiar
        </button>
      </p>
      {onVerPlano && (
        <p className="u-m-8-0-0">
          <button type="button" onClick={onVerPlano} style={enlaceEstudiar} data-ver-plano="si">
            Ver el plano y el checklist
          </button>
        </p>
      )}
      {onVerEjemplo && (
        <p className="u-m-8-0-0">
          <button type="button" onClick={onVerEjemplo} style={enlaceEstudiar} data-ver-ejemplo="si" title="Abre un programa a medias para mirarlo. Tu tarea queda guardada.">
            Ver un ejemplo
          </button>
        </p>
      )}
    </ProcesoTarea>
  )
}

/** El plano de la tarea. Con `sinProceso` el proceso no se repite (ya está a la vista junto al programa). */
export default function PlanoTarea({ codigo, checklist, onEstudiar, ejemplo, sinProceso = false, onProbar }: { codigo: string; checklist: PuntoRevision[]; onEstudiar: (ancla: string) => void; ejemplo: boolean; sinProceso?: boolean; onProbar?: () => void }) {
  return (
    <div data-plano-tarea="si">
      {ejemplo ? (
        <section className="proceso" aria-label="Proceso de la tarea" data-paso-ahora="ejemplo">
          <p style={{ margin: 0, fontWeight: 700 }}>Ejemplo guiado. No es tu entrega.</p>
          <p style={{ margin: '6px 0 0' }}>Una pasada recta con husillo y fin. Sirve para mirar cómo se arma un programa. Las cotas del plano quedan para tu tarea.</p>
        </section>
      ) : (
        !sinProceso && <GuiaCNC codigo={codigo} onEstudiar={onEstudiar} onProbar={onProbar} />
      )}
      <p style={{ margin: '8px 0 6px', fontSize: '0.82rem', color: 'var(--tinta-suave)' }}>
        Pieza 1, cotas en mm. En el torno, X se programa en diámetro y el cero del programa va en la cara frontal, sobre el eje.
      </p>
      {checklist.length > 0 && (
        <ul style={{ margin: '0 0 8px', paddingLeft: 0, listStyle: 'none' }} data-checklist-tarea="si">
          {checklist.map((p) => (
            <li key={p.texto} style={{ margin: '2px 0', fontSize: '0.84rem', color: p.ok ? 'var(--verde-oscuro)' : 'var(--naranjo-aviso)' }}>
              {p.ok ? '✓' : '☐'} {p.texto}
            </li>
          ))}
        </ul>
      )}
      <a href="/plano-tarea3-cnc.png" target="_blank" rel="noreferrer" title="Abrir el plano en grande">
        <img src="/plano-tarea3-cnc.png" alt="Plano de fabricación de la Tarea 3: pieza 1 con ranuras, tramo cónico, tramo curvo, hombro de Ø80 y punta redondeada de Ø40" style={{ width: '100%', maxWidth: 900, height: 'auto', display: 'block', border: '1px solid var(--borde-tenue)', borderRadius: 6, background: '#fff' }} />
      </a>
    </div>
  )
}
