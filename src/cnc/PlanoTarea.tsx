import ProcesoTarea, { enlaceEstudiar, type PasoProceso } from '../components/banco/ProcesoTarea'
import { botonSuave } from './estilos'
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

function pasoCnc(codigo: string): PasoProceso {
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

/** El plano de la tarea, con el proceso arriba y un solo paso abierto. */
export default function PlanoTarea({ codigo, checklist, onEstudiar, onEjemplo }: { codigo: string; checklist: PuntoRevision[]; onEstudiar: (ancla: string) => void; onEjemplo: () => void }) {
  const paso = pasoCnc(codigo)
  return (
    <div data-plano-tarea="si">
      <ProcesoTarea etapas={ETAPAS_CNC} paso={paso}>
        <p style={{ margin: '8px 0 0' }}>
          <button type="button" onClick={onEjemplo} style={botonSuave}>
            Ver ejemplo guiado
          </button>{' '}
          <button type="button" onClick={() => onEstudiar(paso.id === 'revisar' ? 'torno' : 'codigos')} style={enlaceEstudiar}>
            ¿No recuerdas el código de este paso? → Estudiar
          </button>
        </p>
      </ProcesoTarea>
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
