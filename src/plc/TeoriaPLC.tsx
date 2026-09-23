/**
 * Teoría de la unidad de PLC, escrita para el alumno: qué es un PLC, sus
 * partes, cómo elegirlo, los sensores que se le conectan, los símbolos
 * Ladder y cómo ejecuta el programa (el ciclo de scan).
 */
import type { ReactNode } from 'react'

const TINTA = '#33475c'

const p: React.CSSProperties = { margin: '0 0 0.6rem', lineHeight: 1.55, color: '#26323f' }
const tabla: React.CSSProperties = { borderCollapse: 'collapse', width: '100%', fontSize: '0.9rem' }
const th: React.CSSProperties = { textAlign: 'left', background: '#33475c', color: '#fff', padding: '6px 8px' }
const td: React.CSSProperties = { borderBottom: '1px solid #e0e5eb', padding: '6px 8px', verticalAlign: 'middle' }

export function QueEsPLC() {
  return (
    <div>
      <p style={p}>
        Un <strong>PLC</strong> (<em>Programmable Logic Controller</em>, controlador lógico programable) es un computador
        industrial que controla y automatiza máquinas: lee lo que pasa en el proceso a través de sus{' '}
        <strong>entradas</strong> (pulsadores, sensores, finales de carrera), toma decisiones lógicas según el programa
        que tiene cargado y actúa a través de sus <strong>salidas</strong> (motores, electroválvulas, solenoides, pilotos,
        alarmas). Nació en los años 70 para reemplazar los tableros de relés: cambiar el funcionamiento de una máquina
        pasó a ser cambiar el programa, no recablear, y además aguanta el ambiente de una planta industrial.
      </p>
      <p style={p}>
        <strong>Dónde se usa:</strong> manufactura (movimientos de las piezas de una máquina), generación de energía,
        procesamiento de alimentos, agricultura… tanto para mover mecanismos como para controlar parámetros del proceso
        (nivel, presión, temperatura). Para supervisarlo se le conectan una <strong>HMI</strong> (<em>Human Machine
        Interface</em>, la pantalla del operador) o un sistema <strong>SCADA</strong> (<em>Supervisory Control and Data
        Acquisition</em>, la supervisión de toda la planta).
      </p>
      <p style={p}>
        <strong>Lenguajes:</strong> <strong>Ladder</strong> o KOP (escalera, el que usas en esta unidad), bloques de
        funciones (FUP), lista de instrucciones textual (AWL) y SFC / Grafcet, entre otros.
      </p>
    </div>
  )
}

export function ComponentesPLC() {
  const partes: Array<[string, string]> = [
    ['CPU (unidad central de procesamiento)', 'El cerebro: ejecuta el programa, procesa las señales de entrada, hace las operaciones lógicas, genera las salidas y coordina al resto de los componentes.'],
    ['Módulos de entrada', 'La interfaz con los sensores y pulsadores: convierten las señales físicas (tensión, corriente, contacto abierto o cerrado) en valores que la CPU entiende.'],
    ['Módulos de salida', 'Reciben lo que decide la CPU y lo convierten en señales físicas para mover motores, válvulas, solenoides, pilotos o alarmas. Muchos llevan un relé por salida: por eso se oye un clic al activarlas.'],
    ['Memoria', 'Guarda el programa, los datos y los parámetros. Parte de ella retiene la información aunque se corte la energía, para que el proceso pueda continuar.'],
    ['Interfaces de comunicación', 'Para intercambiar datos con una HMI, un SCADA u otros PLC de la red industrial.'],
    ['Fuente de poder', 'Alimenta el sistema de forma estable: soporta fluctuaciones de tensión, aísla y protege frente a cortes.'],
  ]
  return (
    <div>
      <svg viewBox="0 0 560 230" width="100%" style={{ maxWidth: 620, display: 'block', margin: '0 auto 10px' }} role="img" aria-label="Arquitectura de un PLC">
        <defs>
          <marker id="flecha-plc" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill={TINTA} />
          </marker>
        </defs>
        <Bloque x={200} y={8} w={160} h={36} texto="Fuente de poder" color="#e9e6de" />
        <line x1={280} y1={44} x2={280} y2={70} stroke={TINTA} strokeWidth={2} markerEnd="url(#flecha-plc)" />
        <rect x={180} y={72} width={200} height={120} rx={10} fill="#3b4149" />
        <text x={280} y={98} textAnchor="middle" fill="#fff" fontWeight={700} fontSize={16}>CPU</text>
        <Bloque x={196} y={110} w={80} h={30} texto="Memoria" color="#d7dade" pequeno />
        <Bloque x={284} y={110} w={80} h={30} texto="Comunic." color="#d7dade" pequeno />
        <text x={280} y={172} textAnchor="middle" fill="#cfd6de" fontSize={11}>programa · lógica · coordinación</text>
        <Bloque x={10} y={100} w={140} h={60} texto="Módulos de entrada" color="#dff5e7" />
        <Bloque x={410} y={100} w={140} h={60} texto="Módulos de salida" color="#fff0dc" />
        <line x1={150} y1={130} x2={178} y2={130} stroke={TINTA} strokeWidth={2} markerEnd="url(#flecha-plc)" />
        <line x1={382} y1={130} x2={408} y2={130} stroke={TINTA} strokeWidth={2} markerEnd="url(#flecha-plc)" />
        <text x={80} y={186} textAnchor="middle" fontSize={11.5} fill="#5a6b7d">sensores, pulsadores</text>
        <text x={480} y={186} textAnchor="middle" fontSize={11.5} fill="#5a6b7d">motores, válvulas, pilotos</text>
        <text x={280} y={216} textAnchor="middle" fontSize={11.5} fill="#5a6b7d">HMI · SCADA · otros PLC ⇄ interfaces de comunicación</text>
      </svg>
      <table style={tabla}>
        <tbody>
          {partes.map(([n, d]) => (
            <tr key={n}>
              <td style={{ ...td, fontWeight: 700, width: '32%' }}>{n}</td>
              <td style={td}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ ...p, marginTop: 10 }}>
        En la <strong>planta 3D</strong> de esta sección el PLC está montado en su riel con estos módulos: la fuente, la
        CPU (con la tarjeta de memoria y el puerto de comunicación) y los módulos de entradas y salidas, con un LED por
        borne que se enciende cuando esa entrada o salida está activa.
      </p>
    </div>
  )
}

function Bloque({ x, y, w, h, texto, color, pequeno }: { x: number; y: number; w: number; h: number; texto: string; color: string; pequeno?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={color} stroke={TINTA} strokeWidth={1.2} />
      <text x={x + w / 2} y={y + h / 2 + (pequeno ? 4 : 5)} textAnchor="middle" fontSize={pequeno ? 11.5 : 13.5} fontWeight={600} fill={TINTA}>
        {texto}
      </text>
    </g>
  )
}

export function EntradasSalidas() {
  return (
    <div>
      <p style={p}>
        Cada entrada y cada salida es un <strong>borne</strong> del PLC con su dirección. En esta aplicación (como en
        los PLC del laboratorio) las entradas son <code>I0.0 … I0.7</code> y las salidas <code>Q0.0 … Q0.7</code>. Además
        el PLC tiene memoria interna que no sale a ningún borne: las <strong>marcas</strong> <code>M0.0 … M1.7</code>,
        los <strong>temporizadores</strong> <code>T0 … T7</code> y los <strong>contadores</strong> <code>C0 … C7</code>.
      </p>
      <p style={p}>
        En el borne de entrada llega la señal del pulsador o sensor (con su común, <em>COM</em>); una barrera de
        aislamiento separa esa tensión de la electrónica del PLC. En la salida, un relé (o un transistor) cierra el
        circuito de la carga: una lámpara, la bobina de una electroválvula, un contactor de motor.
      </p>
      <p style={p}>
        Por eso, antes de programar, se hace la <strong>tabla de asignación</strong>: cada elemento físico con su símbolo,
        su dirección y qué hace. Es lo primero que se pide en un ejercicio de PLC, y en la aplicación la tienes a mano en
        la <em>Tabla de símbolos</em>.
      </p>
    </div>
  )
}

export function ElegirPLC() {
  const criterios: Array<[string, string]> = [
    ['Cantidad de entradas y salidas', '¿Cuántos sensores, pulsadores y actuadores hay que conectar? Deja margen.'],
    ['Capacidad de programa y memoria', '¿Qué tan largo y complejo es el programa? ¿Cuántos datos debe guardar?'],
    ['Tipo de comunicación', '¿Con qué debe hablar? HMI, SCADA, otros PLC; protocolos como Ethernet/IP, Profibus, RS-232.'],
    ['Escalabilidad', '¿Se podrá ampliar con más módulos si la máquina crece?'],
    ['Software', '¿Qué entorno de programación usa y qué lenguajes admite?'],
    ['Precio', 'El del equipo, pero también el de los módulos, licencias y repuestos.'],
    ['Soporte técnico', '¿Hay representante, documentación y repuestos cerca?'],
    ['Marca', 'La que ya se usa en la planta simplifica la mantención y la formación del personal.'],
  ]
  const tamanos: Array<[string, string]> = [
    ['Micro PLC', 'hasta unas 32 E/S'],
    ['PLC pequeño', 'hasta unas 128 E/S'],
    ['PLC mediano', 'hasta unas 1024 E/S'],
    ['PLC grande', 'hasta unas 4096 E/S'],
    ['PLC muy grande', 'hasta unas 8192 E/S'],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
      <table style={tabla}>
        <thead>
          <tr>
            <th style={th}>Criterio</th>
            <th style={th}>Pregunta que te haces</th>
          </tr>
        </thead>
        <tbody>
          {criterios.map(([c, d], i) => (
            <tr key={c}>
              <td style={{ ...td, fontWeight: 700 }}>
                {String(i + 1).padStart(2, '0')} · {c}
              </td>
              <td style={td}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <p style={p}>
          <strong>Tamaños en la industria.</strong> A más entradas y salidas, más complejidad y más costo; las gamas se
          solapan:
        </p>
        <table style={tabla}>
          <tbody>
            {tamanos.map(([n, d]) => (
              <tr key={n}>
                <td style={{ ...td, fontWeight: 700 }}>{n}</td>
                <td style={td}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ ...p, marginTop: 8, fontSize: '0.86rem', color: '#5a6b7d' }}>
          Los dos ejercicios de esta unidad caben de sobra en un micro PLC: usan 6 y 7 de sus E/S.
        </p>
      </div>
    </div>
  )
}

export function Sensores() {
  const sensores: Array<[string, string, string]> = [
    ['Final de carrera', 'Contacto mecánico: una palanca o rodillo que la pieza o el vástago empuja.', 'Posición de un cilindro, puerta cerrada.'],
    ['Inductivo', 'Genera un campo magnético alterno y detecta cuando un metal entra en él. Sin contacto, sólo metales.', 'Presencia de piezas metálicas, posición de un vástago.'],
    ['Capacitivo', 'Detecta el cambio de capacidad que produce cualquier material cerca de su cara: metal, plástico, madera, líquidos, granos.', 'Nivel de un líquido o de un material a granel a través de la pared de un depósito.'],
    ['Fotoeléctrico', 'Un emisor de luz y un receptor: detecta cuando un objeto corta o refleja el haz.', 'Cajas en una cinta, piezas en una plataforma (S0 del elevador).'],
    ['Magnético de nivel (flotador)', 'Un flotador con un imán sube con el líquido y acciona un contacto magnético (reed) al llegar a su altura.', 'Estanque lleno o vacío (S1 y S2 del ejercicio 1).'],
    ['Presostato', 'Cierra o abre un contacto cuando la presión llega a un valor ajustado.', 'Compresor, circuito neumático con presión suficiente.'],
  ]
  return (
    <div>
      <p style={p}>
        Los sensores le cuentan al PLC qué está pasando. Casi todos los de esta unidad son <strong>digitales</strong>:
        están activos o no, y entran al PLC como un 1 o un 0 en su borne.
      </p>
      <table style={tabla}>
        <thead>
          <tr>
            <th style={th}>Sensor</th>
            <th style={th}>Cómo detecta</th>
            <th style={th}>Ejemplo de uso</th>
          </tr>
        </thead>
        <tbody>
          {sensores.map(([n, c, u]) => (
            <tr key={n}>
              <td style={{ ...td, fontWeight: 700 }}>{n}</td>
              <td style={td}>{c}</td>
              <td style={td}>{u}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Símbolos Ladder
// ---------------------------------------------------------------------------
function Simbolo({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 90 40" width={90} height={40} aria-hidden>
      {children}
    </svg>
  )
}

const contacto = (nc = false) => (
  <Simbolo>
    <line x1={0} y1={20} x2={36} y2={20} stroke={TINTA} strokeWidth={2} />
    <line x1={54} y1={20} x2={90} y2={20} stroke={TINTA} strokeWidth={2} />
    <line x1={36} y1={8} x2={36} y2={32} stroke={TINTA} strokeWidth={2.6} />
    <line x1={54} y1={8} x2={54} y2={32} stroke={TINTA} strokeWidth={2.6} />
    {nc && <line x1={32} y1={31} x2={58} y2={9} stroke={TINTA} strokeWidth={2} />}
  </Simbolo>
)

const bobina = (letra = '') => (
  <Simbolo>
    <line x1={0} y1={20} x2={36} y2={20} stroke={TINTA} strokeWidth={2} />
    <line x1={54} y1={20} x2={90} y2={20} stroke={TINTA} strokeWidth={2} />
    <path d="M 38 7 A 17 17 0 0 0 38 33" fill="none" stroke={TINTA} strokeWidth={2.6} />
    <path d="M 52 7 A 17 17 0 0 1 52 33" fill="none" stroke={TINTA} strokeWidth={2.6} />
    <text x={45} y={25} fontSize={13} fontWeight={700} textAnchor="middle" fill={TINTA}>
      {letra}
    </text>
  </Simbolo>
)

const caja = (t: string) => (
  <Simbolo>
    <line x1={0} y1={20} x2={22} y2={20} stroke={TINTA} strokeWidth={2} />
    <line x1={68} y1={20} x2={90} y2={20} stroke={TINTA} strokeWidth={2} />
    <rect x={22} y={4} width={46} height={32} rx={3} fill="#fff" stroke={TINTA} strokeWidth={2} />
    <text x={45} y={25} fontSize={12} fontWeight={700} textAnchor="middle" fill={TINTA}>
      {t}
    </text>
  </Simbolo>
)

export function SimbolosLadder() {
  const contactos: Array<[ReactNode, string, string]> = [
    [contacto(), 'Normalmente abierto (NA)', 'Pasa corriente cuando la dirección está a 1 (ON).'],
    [contacto(true), 'Normalmente cerrado (NC)', 'Pasa corriente cuando la dirección está a 0 (OFF).'],
  ]
  const bobinas: Array<[ReactNode, string, string]> = [
    [bobina(), 'Bobina (salida)', 'Con corriente: la dirección a 1. Sin corriente: a 0.'],
    [bobina('/'), 'Bobina inversa', 'Con corriente: a 0. Sin corriente: a 1.'],
    [bobina('P'), 'Transición positiva', 'Al pasar de sin corriente a con corriente: a 1 durante un barrido.'],
    [bobina('N'), 'Transición negativa', 'Al pasar de con corriente a sin corriente: a 1 durante un barrido.'],
    [bobina('L'), 'Enclavar: L, latch (Set)', 'Con corriente: a 1, y se queda así hasta que un Reset la apague. Sin corriente: sigue igual.'],
    [bobina('U'), 'Desenclavar: U, unlatch (Reset)', 'Con corriente: a 0, y se queda así hasta un Set. Sin corriente: sigue igual.'],
    [caja('TON'), 'Temporizador a la conexión', 'Su contacto se cierra cuando lleva el tiempo PT con corriente; al perderla vuelve a cero.'],
    [caja('TOF'), 'Temporizador a la desconexión', 'Su contacto se cierra con corriente y se abre cuando lleva el tiempo PT sin ella.'],
    [caja('CTU'), 'Contador ascendente', 'Suma uno en cada flanco de subida; su contacto se cierra al llegar a PV. Se reinicia con Reset.'],
    [caja('CTD'), 'Contador descendente', 'Parte de PV y resta uno en cada flanco; su contacto se cierra al llegar a 0.'],
  ]
  const fila = ([s, n, d]: [ReactNode, string, string]) => (
    <tr key={n}>
      <td style={{ ...td, width: 100 }}>{s}</td>
      <td style={{ ...td, fontWeight: 700 }}>{n}</td>
      <td style={td}>{d}</td>
    </tr>
  )
  return (
    <div>
      <p style={p}>
        Ladder (escalera) es un lenguaje gráfico que imita los esquemas eléctricos de relés. Tiene dos{' '}
        <strong>líneas verticales</strong>, la izquierda es la tensión y la derecha la tierra, y entre ellas los{' '}
        <strong>escalones</strong> (<em>rungs</em>): líneas horizontales con los contactos a la izquierda y la bobina a
        la derecha. Contactos en <strong>serie</strong> son un Y (AND); en <strong>paralelo</strong>, un O (OR); un
        contacto <strong>cerrado</strong> es un NO (NOT).
      </p>
      <table style={tabla}>
        <thead>
          <tr>
            <th style={th}>Símbolo</th>
            <th style={th}>Contacto</th>
            <th style={th}>Pasa corriente cuando…</th>
          </tr>
        </thead>
        <tbody>{contactos.map(fila)}</tbody>
      </table>
      <table style={{ ...tabla, marginTop: 10 }}>
        <thead>
          <tr>
            <th style={th}>Símbolo</th>
            <th style={th}>Bobina / bloque</th>
            <th style={th}>Resultado</th>
          </tr>
        </thead>
        <tbody>{bobinas.map(fila)}</tbody>
      </table>
    </div>
  )
}

export function CicloScan() {
  return (
    <div>
      <p style={p}>
        El PLC no ejecuta el programa «de una vez», sino en <strong>barridos</strong> (<em>scan</em>) que repite sin
        parar, muchas veces por segundo:
      </p>
      <ol style={{ margin: '0 0 0.6rem', paddingLeft: '1.3rem', lineHeight: 1.6 }}>
        <li>
          <strong>Lee las entradas</strong> y guarda su estado en la memoria (la imagen de entradas).
        </li>
        <li>
          <strong>Resuelve los escalones de arriba abajo</strong>, uno tras otro. Lo que escribe un escalón ya lo leen
          los escalones de más abajo en ese mismo barrido.
        </li>
        <li>
          <strong>Actualiza las salidas</strong> con lo que quedó escrito al terminar.
        </li>
      </ol>
      <p style={p}>Dos consecuencias que conviene tener presentes al programar:</p>
      <ul style={{ margin: '0 0 0.6rem', paddingLeft: '1.3rem', lineHeight: 1.6 }}>
        <li>
          Si una misma salida tiene <strong>bobina en dos escalones</strong>, manda sólo la última: la de arriba queda
          pisada en cada barrido. Junta las condiciones en paralelo en un solo escalón, o usa Set y Reset. La aplicación
          te avisa si pasa.
        </li>
        <li>
          Con Set y Reset sobre la misma dirección, <strong>gana el escalón que va después</strong> cuando los dos
          tienen corriente a la vez. El orden de los escalones es parte del programa.
        </li>
      </ul>
      <p style={p}>
        En la aplicación, el programa se ejecuta así, unas 50 veces por segundo, contra la planta simulada. Con el PLC
        en <strong>RUN</strong>, el diagrama se pinta como en los simuladores: los tramos con tensión en verde, los
        contactos cerrados rellenos y las bobinas activas encendidas.
      </p>
    </div>
  )
}
