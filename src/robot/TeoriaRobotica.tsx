/**
 * Teoría de la unidad de robótica, escrita para el alumno: qué es un robot
 * industrial, fabricación en serie frente a robótica, tipos, componentes,
 * grados de libertad, cómo leer una ficha técnica y la programación
 * paramétrica con Rhino, Grasshopper y KUKA|prc.
 */
import type { ReactNode } from 'react'
import { ROBOTS } from './robots'

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
      <svg viewBox="0 0 620 240" width="100%" style={{ maxWidth: 680, display: 'block', margin: '0 auto 10px' }} role="img" aria-label="Componentes de un robot de base fija">
        {/* Manipulador */}
        <rect x={60} y={190} width={90} height={20} rx={4} fill="#2b3036" />
        <rect x={90} y={120} width={30} height={72} rx={6} fill="#f06a14" />
        <rect x={100} y={60} width={130} height={26} rx={10} fill="#f06a14" transform="rotate(-20 105 73)" />
        <rect x={215} y={40} width={90} height={18} rx={8} fill="#f06a14" />
        <rect x={300} y={42} width={14} height={40} rx={3} fill="#555" />
        <circle cx={105} cy={120} r={16} fill="#d85a0e" />
        <circle cx={220} cy={49} r={13} fill="#d85a0e" />
        {/* Controlador */}
        <rect x={420} y={90} width={80} height={120} rx={6} fill="#6b7580" />
        <rect x={432} y={104} width={56} height={34} rx={3} fill="#cfd6dc" />
        <path d="M150 205 C 250 230, 350 230, 420 190" fill="none" stroke="#2b3036" strokeWidth={4} />
        {/* Interfaz de control (teach pendant) */}
        <rect x={540} y={110} width={50} height={70} rx={8} fill="#2b3036" />
        <rect x={548} y={118} width={34} height={28} rx={3} fill="#9fe0a8" />
        <path d="M500 150 C 520 150, 520 150, 540 150" fill="none" stroke="#2b3036" strokeWidth={3} />
        {[
          [120, 26, '1 Manipulador (brazo)'],
          [455, 80, '2 Controlador'],
          [565, 100, '3 Interfaz de control'],
          [320, 100, 'Efector final'],
        ].map(([x, y, t]) => (
          <text key={String(t)} x={Number(x)} y={Number(y)} textAnchor="middle" fontSize={13} fontWeight={700} fill={TINTA}>
            {t}
          </text>
        ))}
      </svg>
      <Tabla
        cabeza={['Parte', 'Qué es']}
        filas={[
          [<strong>Manipulador</strong>, 'El brazo mecánico: eslabones unidos por articulaciones, movidos por actuadores (servomotores) a través de transmisiones (engranajes, reductores, correas).'],
          [<strong>Controlador</strong>, 'El computador del robot (armario): ejecuta el programa, calcula los movimientos y maneja los motores, las entradas y las salidas.'],
          [<strong>Interfaz de control (teach pendant)</strong>, 'El mando portátil (en KUKA, el smartPAD) para mover el robot a mano, enseñar puntos, escribir y probar programas.'],
          [<strong>Efector final</strong>, 'Lo que va en la punta: pinza, ventosa, husillo de fresado, soplete de soldadura, pistola de pintura…'],
          [<strong>Sensores</strong>, 'Posición de cada eje (encoders), fuerza, visión: le dicen al controlador qué está pasando.'],
        ]}
      />
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
      <p style={p}>
        En un KUKA de 6 ejes, A1, A2 y A3 llevan la muñeca a su lugar y A4, A5 y A6 orientan la herramienta. Cuando A5
        queda en 0°, A4 y A6 quedan alineados y el robot pierde un grado de libertad: es una{' '}
        <strong>singularidad</strong>, y cerca de ella A4 y A6 pueden girar muy rápido. El simulador te avisa cuando pasa.
      </p>
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
        Robots disponibles en este simulador (valores orientativos: confirma en la ficha oficial):
      </p>
      <Tabla
        cabeza={['Robot', 'Carga', 'Alcance', 'Repetibilidad', 'Peso', 'Montaje']}
        filas={ROBOTS.map((r) => [r.nombre, `${r.carga} kg`, `${r.alcance} mm`, `± ${r.repetibilidad} mm`, `${r.peso} kg`, r.montaje])}
      />
    </div>
  )
}

export function ProgramacionParametrica() {
  return (
    <div>
      <p style={p}>
        En la <strong>robótica paramétrica</strong> la trayectoria del robot se define con parámetros (largos, alturas,
        velocidades) que se pueden cambiar y ver el resultado al instante. En el curso se usa <strong>Rhinoceros 8</strong>{' '}
        (modelado 3D), <strong>Grasshopper</strong> (programación visual con componentes y cables) y el complemento{' '}
        <strong>KUKA|prc</strong> (Parametric Robot Control), que agrega los robots KUKA, simula y genera el código KRL.
      </p>
      <ol style={{ margin: '0 0 10px', paddingLeft: 20, lineHeight: 1.6 }}>
        <li>Modelar la pieza o traer el plano (DXF) a Rhino.</li>
        <li>Definir la trayectoria con componentes de Grasshopper (dividir curvas, crear planos).</li>
        <li>Configurar el robot, la herramienta y la base (el mesón y la pieza).</li>
        <li>Simular con el slider del Core y revisar el análisis (alcance, límites, singularidades).</li>
        <li>Exportar el código KUKA (archivos .src / .dat, lenguaje KRL).</li>
        <li>Cargarlo en el controlador y probarlo en modo manual reducido (T1) antes de producir.</li>
      </ol>
      <p style={p}>
        <strong>Estructura básica de una simulación en KUKA|prc (siete partes):</strong>
      </p>
      <Tabla
        cabeza={['Parte', 'Para qué', 'En esta app']}
        filas={[
          ['Puntos', 'Las coordenadas por donde pasa el robot.', 'Divide Length, Divide Curve, Discontinuity, Area…'],
          ['Planos', 'Dicen hacia dónde apunta la herramienta en cada punto.', 'XY Plane, Rotate Plane, Divide Curve (KUKA|prc)'],
          ['Comando', 'Convierte los planos en movimientos KRL.', 'LIN, PTP, CIR, AXIS, Set Digital Out, Wait, Custom KRL'],
          ['Robot', 'El robot simulado: tamaño, velocidades y límites de sus ejes.', 'Robot (5 modelos KUKA)'],
          ['Herramienta', 'Lo que va en el flange; define el TCP.', 'Tool'],
          ['Slider de simulación', 'Recorre la simulación en el tiempo (en KUKA|prc, un slider o KUKA|play).', 'La barra ▶ bajo la vista 3D'],
          ['Core', 'Junta todo, simula, analiza y genera el código KRL.', 'KUKA|prc Core'],
        ]}
      />
      <p style={{ ...p, marginTop: 10 }}>
        <strong>Colores de los componentes</strong> (igual que en Grasshopper): gris = funciona bien; naranjo = le faltan
        datos o hay un aviso; rojo = error (recibe un dato que no corresponde); verde = seleccionado.
      </p>
      <p style={p}>
        <strong>Movimientos:</strong> <strong>PTP</strong> mueve todos los ejes a la vez y llega lo más rápido posible,
        pero la herramienta no va en línea recta (para acercarse y alejarse). <strong>LIN</strong> lleva la herramienta en
        línea recta (para trabajar); es más lento. <strong>CIR</strong> hace un arco pasando por un punto auxiliar.{' '}
        <strong>AXIS</strong> da el ángulo de cada eje. <strong>Command Weaver</strong> combina listas de comandos;{' '}
        <strong>Set Digital Out</strong> y <strong>Wait</strong> manejan salidas (husillo, pinza) y esperas.
      </p>
      <p style={p}>
        <strong>El código KRL</strong> que se genera tiene la forma <code>DEF programa( ) … END</code>, fija la base (
        <code>$BASE</code>) y la herramienta (<code>$TOOL</code>), la velocidad (<code>$VEL.CP</code> en m/s para LIN y CIR)
        y luego los movimientos: <code>PTP {'{A1 …, A6 …}'}</code>, <code>LIN {'{X, Y, Z, A, B, C}'}</code>,{' '}
        <code>$OUT[1] = TRUE</code>, <code>WAIT SEC 2</code>.
      </p>
    </div>
  )
}

export function InstalarSoftware() {
  return (
    <div>
      <p style={p}>
        Esta unidad funciona en cualquier navegador (Windows, Mac, Linux o tablet). Si quieres usar el software del curso,
        se puede hacer <strong>sin crackear nada</strong>:
      </p>
      <ul style={{ margin: '0 0 8px', paddingLeft: 20, lineHeight: 1.6 }}>
        <li>
          <strong>Rhino 8</strong> tiene una evaluación gratuita y completa de 90 días, para Windows y Mac (rhino3d.com).
          Al terminar deja de guardar y de cargar complementos: instálalo cuando empiece la unidad.
        </li>
        <li>
          <strong>Grasshopper</strong> viene incluido en Rhino 8.
        </li>
        <li>
          <strong>KUKA|prc</strong> es gratuito para docencia e investigación en instituciones que son miembros de la
          Association for Robots in Architecture (la membresía cubre a profesores y estudiantes, también en sus
          computadores personales); también existe una versión Community. En Mac, conviene probarlo antes.
        </li>
      </ul>
      <p style={p}>
        Lo que armes aquí se traslada directo: los componentes tienen los mismos nombres (Divide Length, XY Plane, LIN,
        PTP, Core…) y el código KRL es el mismo lenguaje.
      </p>
    </div>
  )
}
