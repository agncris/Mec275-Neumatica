/**
 * Teoría de la unidad de robótica, escrita para el alumno: qué es un robot
 * industrial, fabricación en serie frente a robótica, tipos, componentes,
 * grados de libertad, cómo leer una ficha técnica y la programación
 * paramétrica en NeumaLab (Programación visual).
 */
import { createContext, useContext, type ReactNode } from 'react'
import { VER_TAREA_ROBOTICA } from '../unidades'
import { FiguraAlcance, FiguraGrados, FiguraMovimientos, FiguraSvg } from './animaciones'
import { DemoAlcance, DemoEjes, DemoMovimientos } from './Demo3D'
import { ROBOTS } from './robots'

/** El botón «probarlo» de Estudiar llama a esto para abrir el Laboratorio o la Tarea. */
export const PracticaRobot = createContext<(destino: 'laboratorio' | 'tarea') => void>(() => {})

export function SaltarAPractica({ children, destino = 'laboratorio' }: { children: string; destino?: 'laboratorio' | 'tarea' }) {
  const ir = useContext(PracticaRobot)
  if (destino === 'tarea' && !VER_TAREA_ROBOTICA) return null
  return (
    <p style={{ margin: '0.75rem 0 0' }}>
      <button type="button" onClick={() => ir(destino)} style={{ border: '1px solid var(--borde)', background: '#fff', color: 'var(--azul)', fontWeight: 650, borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.86rem' }}>
        {children}
      </button>
    </p>
  )
}

const TINTA = '#33475c'
const p: React.CSSProperties = { margin: '0 0 0.6rem', lineHeight: 1.55, color: '#26323f' }
const th: React.CSSProperties = { textAlign: 'left', background: TINTA, color: '#fff', padding: '6px 8px' }
const td: React.CSSProperties = { borderBottom: '1px solid #e0e5eb', padding: '6px 8px', verticalAlign: 'top' }

function Tabla({ cabeza, filas }: { cabeza: string[]; filas: ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.9rem' }}>
        <thead>
          <tr>
            {cabeza.map((c) => (
              <th key={c} style={th}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              {f.map((c, j) => (
                <td key={j} style={td}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function QueEsRobot() {
  return (
    <div>
      <p style={p}>
        En la industria se acepta como robot un <strong>«dispositivo programado para el manejo de materiales»</strong>,
        según la patente de <strong>George C. Devol (EE. UU., 1954)</strong>. De ahí viene también la idea de{' '}
        <strong>teach-in / playback</strong>: al robot se le <em>enseña</em> una secuencia de posiciones y después la{' '}
        <em>reproduce</em> las veces que haga falta. Puedes probarlo con el <strong>mando manual</strong> de esta unidad.
      </p>
      <p style={p}>
        La tecnología nace de juntar dos ideas: el <strong>control numérico</strong> de las máquinas herramienta (lo que
        viste en la unidad de CNC) y la <strong>manipulación remota</strong> (los brazos que manejaban material peligroso
        a distancia).
      </p>
    </div>
  )
}

export function SerieVsRobotica() {
  return (
    <div>
      <Tabla
        cabeza={['Fabricación en serie', 'Robótica industrial']}
        filas={[
          ['Dedicada a un producto', 'Flexible y reprogramable'],
          ['Cambiar el producto exige rehacer la línea (retooling costoso)', 'Cambiar el producto es cargar otro programa'],
          ['Alto volumen, poca variedad', 'Volumen medio, mucha variedad'],
          ['Baja flexibilidad', 'Alta flexibilidad'],
        ]}
      />
      <p style={{ ...p, marginTop: 10 }}>
        El gran aporte de los robots industriales es la <strong>flexibilidad</strong> de las líneas de producción.
      </p>
    </div>
  )
}

export function TiposGenerales() {
  const rama = (t: string, hijos: string[]) => (
    <div style={{ border: `1px solid #c6ced6`, borderRadius: 8, padding: '6px 10px', background: '#f7f9fb', minWidth: 190 }}>
      <strong style={{ color: TINTA }}>{t}</strong>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
        {hijos.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </div>
  )
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        {rama('Base fija', ['SCARA', 'Cilíndrico', 'Esférico o polar', 'Angular o antropomórfico', 'Cartesiano (pórtico)', 'Paralelo (delta)'])}
        {rama('Móvil', ['AGV (vehículo guiado automáticamente)', 'AMR (robot móvil autónomo)'])}
        {rama('Biónico / zoomórfico', ['Humanoide', 'Cuadrúpedo («perro robot»)', 'Hexápodo o araña'])}
      </div>
      <p style={p}>Los de base fija son los más usados en manufactura; más abajo puedes mover cada uno en 3D.</p>
    </div>
  )
}

export function Componentes() {
  return (
    <div>
      <FiguraSvg viewBox="0 0 620 248" ariaLabel="Componentes de un robot de base fija: el brazo sale de la base y termina en el efector" etiqueta="La pinza abre y cierra. Es el efector final: lo que va en la punta. El controlador y el smartPAD quedan al lado, unidos por el cable.">
        {/* Base y columna, unidas al hombro */}
        <rect x={58} y={200} width={100} height={18} rx={4} fill="#2b3036" />
        <rect x={93} y={132} width={30} height={72} rx={6} fill="#f06a14" />
        {/* Hombro en (108, 132): el brazo y el antebrazo salen de esa articulación */}
        <g transform="translate(108 132) rotate(-32)">
          <rect x={0} y={-14} width={122} height={28} rx={12} fill="#f06a14" />
          <circle cx={0} cy={0} r={16} fill="#d85a0e" />
          <g transform="translate(122 0) rotate(26)">
            <rect x={0} y={-10} width={96} height={20} rx={9} fill="#f06a14" />
            <circle cx={0} cy={0} r={12} fill="#d85a0e" />
            <g transform="translate(96 0)">
              <rect x={0} y={-7} width={14} height={14} rx={2} fill="#5c656e" />
              <rect x={10} y={-18} width={7} height={16} rx={2} fill="#2b3036">
                <animate attributeName="y" values="-18;-26;-18" dur="2.4s" repeatCount="indefinite" />
              </rect>
              <rect x={10} y={2} width={7} height={16} rx={2} fill="#2b3036">
                <animate attributeName="y" values="2;10;2" dur="2.4s" repeatCount="indefinite" />
              </rect>
            </g>
          </g>
        </g>
        {/* Controlador, cableado a la base */}
        <rect x={420} y={98} width={80} height={120} rx={6} fill="#6b7580" />
        <rect x={432} y={112} width={56} height={34} rx={3} fill="#cfd6dc" />
        <path d="M158 210 C 250 236, 350 236, 420 198" fill="none" stroke="#2b3036" strokeWidth={4} />
        {/* smartPAD, unido al controlador */}
        <rect x={540} y={118} width={50} height={70} rx={8} fill="#2b3036" />
        <rect x={548} y={126} width={34} height={28} rx={3} fill="#9fe0a8" />
        <path d="M500 158 H 540" fill="none" stroke="#2b3036" strokeWidth={3} />
        <text x={175} y={28} textAnchor="middle" fontSize={13} fontWeight={700} fill={TINTA}>
          Estructura mecánica (brazo)
        </text>
        <text x={455} y={88} textAnchor="middle" fontSize={13} fontWeight={700} fill={TINTA}>
          Controlador
        </text>
        <text x={565} y={108} textAnchor="middle" fontSize={13} fontWeight={700} fill={TINTA}>
          smartPAD
        </text>
        <text x={318} y={128} textAnchor="middle" fontSize={13} fontWeight={700} fill={TINTA}>
          Efector final
        </text>
      </FiguraSvg>
      <p style={p}>
        Un robot de base fija tiene <strong>seis partes básicas</strong>:
      </p>
      <Tabla
        cabeza={['Parte', 'Qué es']}
        filas={[
          [<strong>Estructura mecánica</strong>, 'Los eslabones y las articulaciones: el brazo.'],
          [<strong>Actuadores</strong>, 'Motores, servos y cilindros que mueven cada articulación.'],
          [<strong>Transmisiones</strong>, 'Engranajes, correas y husillos que llevan el movimiento del actuador a la articulación.'],
          [<strong>Sensores</strong>, 'Posición de cada eje (encoders), fuerza y visión: le dicen al controlador qué está pasando.'],
          [<strong>Controlador</strong>, 'El computador y el software (el armario): ejecuta el programa, calcula los movimientos y maneja los motores, las entradas y las salidas.'],
          [<strong>Efector final</strong>, 'Lo que va en la punta: pinza, ventosa, husillo de fresado, soplete de soldadura, pistola de pintura…'],
        ]}
      />
      <p style={{ ...p, marginTop: 10 }}>
        <strong>Dato aparte:</strong> la <strong>interfaz de control</strong> (teach pendant; en KUKA, el smartPAD) es el mando portátil para mover el robot a mano, enseñar puntos y probar programas. Se conecta al controlador; no es una de las seis partes.
      </p>
    </div>
  )
}

export function GradosLibertad() {
  return (
    <div>
      <p style={p}>
        Los <strong>grados de libertad (GDL)</strong> son los movimientos independientes que puede hacer el robot: uno por
        articulación. Para dejar un objeto en cualquier <strong>posición</strong> hacen falta 3 (X, Y, Z) y para darle
        cualquier <strong>orientación</strong>, otros 3. Por eso el robot industrial típico, el antropomórfico, tiene{' '}
        <strong>6 GDL</strong>; un SCARA tiene 4 (X, Y, Z y giro de la herramienta) y un cartesiano, 3.
      </p>
      <FiguraGrados />
      <p style={p}>Ahora muévelo tú: es el mismo robot de la simulación.</p>
      <DemoEjes />
      <p style={p}>
        En un KUKA de 6 ejes, A1, A2 y A3 llevan la muñeca a su lugar y A4, A5 y A6 orientan la herramienta. Cuando A5
        queda en 0°, A4 y A6 quedan alineados y el robot pierde un grado de libertad: es una{' '}
        <strong>singularidad</strong>, y cerca de ella A4 y A6 pueden girar muy rápido. El simulador te avisa cuando pasa.
      </p>
      <SaltarAPractica>Ver una singularidad en el Laboratorio</SaltarAPractica>
    </div>
  )
}

export function FichaTecnica() {
  return (
    <div>
      <p style={p}>
        Para elegir el robot de un trabajo se revisa su ficha técnica. El ejemplo del apunte es el <strong>KR 50 R2100</strong>
        (carga media):
      </p>
      <Tabla
        cabeza={['Dato', 'KR 50 R2100', 'Qué significa']}
        filas={[
          ['Carga', '50 kg', 'Peso máximo en el flange, incluida la herramienta.'],
          ['Repetibilidad', '± 0,05 mm', 'Cuánto se aleja al volver una y otra vez al mismo punto.'],
          ['Alcance máximo', '2101 mm', 'Distancia máxima al centro de la muñeca: define el campo de trabajo.'],
          ['Número de ejes', '6', 'Grados de libertad.'],
          ['Peso', '533 kg', 'Para dimensionar el pedestal y la fundación.'],
          ['Montaje', 'Suelo, pared, techo, ángulo', 'Cómo se puede instalar.'],
          ['Mantenimiento', 'Cambio de aceite a las 20 000 h', 'Intervalos de servicio.'],
        ]}
      />
      <p style={{ ...p, marginTop: 10 }}>
        El <strong>campo de trabajo</strong> muestra, en vista lateral y superior, hasta dónde llega la muñeca; el{' '}
        <strong>diagrama de cargas</strong>, cuánto peso soporta según lo lejos del flange que esté el centro de gravedad.
      </p>
      <FiguraAlcance />
      <p style={p}>Y aquí, con el robot en 3D: aleja la pieza hasta que ya no llegue.</p>
      <DemoAlcance />
      <p style={p}>
        Robots disponibles en este simulador (valores orientativos: confirma en la ficha oficial):
      </p>
      <Tabla
        cabeza={['Robot', 'Carga', 'Alcance', 'Repetibilidad', 'Peso', 'Montaje']}
        filas={ROBOTS.map((r) => [r.nombre, `${r.carga} kg`, `${r.alcance} mm`, `± ${r.repetibilidad} mm`, `${r.peso} kg`, r.montaje])}
      />
      <SaltarAPractica>Elegir un robot en el Laboratorio</SaltarAPractica>
    </div>
  )
}

export function ProgramacionParametrica() {
  return (
    <div>
      <p style={p}>
        En la <strong>robótica paramétrica</strong> la trayectoria del robot se define con parámetros (largos, alturas,
        velocidades) que se pueden cambiar y ver el resultado al instante. En MEC275 eso se hace en esta app,{' '}
        <strong>NeumaLab</strong>, en <strong>Programación visual</strong>: cambias un número en un bloque y el recorrido
        se actualiza al momento.
      </p>
      <ol style={{ margin: '0 0 10px', paddingLeft: 20, lineHeight: 1.6 }}>
        <li>El plano DXF de la tarea ya está cargado.</li>
        <li>Curve lee la capa.</li>
        <li>Offset, Move y los bloques de trayectoria arman el recorrido.</li>
        <li>El robot, la herramienta y la base (el mesón y la pieza) están en el Core.</li>
        <li>▶ simula y Análisis revisa alcance, límites y singularidades.</li>
        <li>Exportar saca el KRL (.src).</li>
      </ol>
      <p style={p}>
        Ese archivo .src es el que después se carga en el controlador y se prueba en modo manual reducido (T1) antes de producir.
      </p>
      <p style={p}>
        <strong>Partes de una simulación en Programación visual:</strong>
      </p>
      <Tabla
        cabeza={['Parte', 'Para qué', 'Bloques']}
        filas={[
          ['Plano', 'El DXF de la tarea ya está cargado. Curve lee las curvas de una capa.', 'Curve'],
          ['Recorrido', 'Compensa el trazo, lo baja y arma los puntos y los planos del camino.', 'Offset, Move, Divide Length, XY Plane, Toolpath'],
          ['Comandos', 'Convierten el camino en movimientos y en salidas (husillo, pinza, esperas).', 'LIN, PTP, CIR, Toolpath, Set Digital Out, Wait'],
          ['Robot', 'El robot simulado: tamaño, velocidades y límites de sus ejes.', 'Robot'],
          ['Herramienta', 'Lo que va en el flange; define el TCP.', 'Tool'],
          ['Base', 'Dónde están el mesón y la pieza respecto del robot.', 'Core'],
          ['Simulación', '▶ recorre el programa. Análisis revisa alcance, límites y singularidades. Exportar entrega el KRL (.src).', 'Core, ▶, Análisis, Exportar'],
        ]}
      />
      <p style={{ ...p, marginTop: 10 }}>
        <strong>Colores de los bloques</strong>: la franja de arriba dice el grupo (naranjo, Movimientos; azul, Robot; verde,
        Herramientas; morado, Trayectoria; gris, Utilidades). El borde y el fondo dicen el estado: gris y blanco cuando
        funciona; naranjo cuando le faltan datos o hay un aviso; rojo cuando ese bloque recibe un dato que no corresponde,
        como curvas donde se piden puntos; azul cuando está seleccionado.
      </p>
      <FiguraMovimientos />
      <p style={p}>Pruébalo con el robot: elige el movimiento y mira el recorrido de la herramienta.</p>
      <DemoMovimientos />
      <p style={p}>
        <strong>PTP</strong> mueve todos los ejes a la vez y llega lo más rápido posible,
        pero la herramienta no va en línea recta (para acercarse y alejarse). <strong>LIN</strong> lleva la herramienta en
        línea recta (para trabajar); es más lento. <strong>CIR</strong> hace un arco pasando por un punto auxiliar.{' '}
        <strong>AXIS</strong> da el ángulo de cada eje. <strong>Command Weaver</strong> combina listas de comandos;{' '}
        <strong>Set Digital Out</strong> y <strong>Wait</strong> manejan salidas (husillo, pinza) y esperas.
      </p>
      <p style={p}>
        <strong>El código KRL</strong> que se genera tiene la forma <code>DEF programa( ) … END</code>, fija la base (
        <code>$BASE</code>) y la herramienta (<code>$TOOL</code>), la velocidad (<code>$VEL.CP</code> en m/s para LIN y CIR)
        y luego los movimientos: <code>PTP {'{A1 …, A6 …}'}</code>, <code>LIN {'{X, Y, Z, A, B, C}'}</code>,{' '}
        <code>$OUT[1] = TRUE</code>, <code>WAIT SEC 2</code>. Las posiciones X, Y, Z de LIN y CIR van <strong>relativas a
        la base</strong> (<code>$BASE</code>, la cara superior de la plancha): <code>Z -5</code> en una plancha de 5 mm
        atraviesa la plancha. En el mundo, esa altura es la del mesón menos 5 mm.
      </p>
      <SaltarAPractica>Armar un recorrido en el Laboratorio</SaltarAPractica>
      <SaltarAPractica destino="tarea">Aplicarlo en la Tarea</SaltarAPractica>
    </div>
  )
}
