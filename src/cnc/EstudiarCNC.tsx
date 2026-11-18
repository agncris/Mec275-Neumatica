/**
 * Estudiar de CNC: la teoría, la ficha y la autoevaluación.
 * Se carga con `lazy` solo al entrar a Estudiar, para que el Laboratorio abra más rápido.
 */
import PaginaEstudiar, { type SeccionEstudio } from '../components/banco/PaginaEstudiar'
import Autoevaluacion from '../components/Autoevaluacion'
import FichaCNC from './FichaCNC'
import { PREGUNTAS_CNC } from './preguntasCNC'
import { Arcos, CodigosGM, Coordenadas, EstructuraBloque, Insertos, OrganizarPrograma, QueEsCNC, Torno, VentajasCNC } from './TeoriaCNC'
import { VER_TAREA_CNC } from '../unidades'

export const SECCIONES_CNC: SeccionEstudio[] = [
  { id: 'practica', indice: 'Autoevaluación', titulo: 'Autoevaluación · practica con preguntas al azar', contenido: <Autoevaluacion generadores={PREGUNTAS_CNC} /> },
  { id: 'ficha', indice: 'Ficha de repaso', titulo: 'Ficha de repaso · para imprimir', contenido: <FichaCNC /> },
  { id: 'que-es', indice: '¿Qué es el CNC?', titulo: '¿Qué es el CNC?', contenido: <QueEsCNC /> },
  { id: 'ventajas', indice: 'Ventajas y aplicaciones', titulo: 'Ventajas, limitaciones y aplicaciones', contenido: <VentajasCNC /> },
  { id: 'organizar', indice: 'Organizar la programación', titulo: 'Cómo organizar la programación', contenido: <OrganizarPrograma /> },
  { id: 'coordenadas', indice: 'Coordenadas', titulo: 'Coordenadas absolutas e incrementales (con práctica)', contenido: <Coordenadas /> },
  { id: 'bloque', indice: 'Estructura de un bloque', titulo: 'Estructura de un bloque de código G', contenido: <EstructuraBloque /> },
  { id: 'codigos', indice: 'Códigos G y M', titulo: 'Códigos G y M', contenido: <CodigosGM /> },
  { id: 'arcos', indice: 'Arcos G02 y G03', titulo: 'Arcos: G02 y G03', contenido: <Arcos /> },
  { id: 'torno', indice: 'El torno CNC', titulo: 'El torno CNC y sus operaciones', contenido: <Torno /> },
  { id: 'insertos', indice: 'Herramientas de corte', titulo: 'Herramientas de corte: código de los insertos', contenido: <Insertos /> },
  { id: 'como-usar', indice: 'Cómo usar el simulador', titulo: 'Cómo usar este simulador (y entregar tu tarea)', contenido: <ComoUsar /> },
]

function ComoUsar() {
  const li: React.CSSProperties = { marginBottom: 4 }
  return (
    <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55 }}>
      <li style={li}>
        <strong>Prepara la máquina:</strong> elige el centro de torneado o la fresadora, el material y las medidas del bruto.
        Revisa la lista de herramientas: en el torno se llaman con <code>T0101</code> (herramienta 1, corrector 1); en la
        fresadora con <code>T1 M06</code>. Puedes editarlas, agregar las tuyas o quitar las que no tengas.
      </li>
      <li style={li}>
        <strong>Escribe el programa</strong> en el editor (o abre un .cnc). Mientras escribes se revisa: los errores salen
        en rojo con su línea. Pon el cursor en una línea para ver qué hace cada palabra.
      </li>
      <li style={li}>
        <strong>Simula:</strong> ▶ Ciclo lo ejecuta completo, ⏭ Bloque a bloque avanza de a una línea, ⏮ Bloque
        anterior retrocede una línea, ⏩ Al final mecaniza todo de una vez y ⟲ Reiniciar vuelve al bruto entero. En el
        torno, «Vista en corte» parte la pieza por la mitad para ver agujeros y roscas. Cambia la velocidad para verlo más rápido.
      </li>
      <li style={li}>
        <strong>Como en la máquina real,</strong> se detiene con una alarma si la herramienta entra al material en rápido
        (G00), si corta con el husillo detenido, si avanza contra el filo, si el portaherramientas se entierra, si choca
        con las garras del plato, con el contrapunto o con la mesa, o si la broca se mueve de lado. El bruto no se come
        en un choque. Los consejos 💡 (por ejemplo, pasadas muy profundas) no detienen la simulación.
      </li>
      <li style={li}>
        <strong>Para el informe:</strong> «Trayectoria (PNG)» descarga el dibujo 2D con los puntos, «Copiar tabla» copia
        las coordenadas, «Guardar .cnc» descarga el programa (un archivo de texto que también abre CNC Simulator Pro) y
        «● Grabar video» graba la vista 3D mientras corre la simulación.{VER_TAREA_CNC && ' En «★ Tarea 3» (torno y latón, con tu programa aparte) está «Entregar», que reúne todo eso, el .cnc y el video con el nombre que pide el enunciado.'}
      </li>
      <li style={li}>
        <strong>Programas de CNC Simulator Pro:</strong> se abren tal cual. <code>$Millimeter</code>/<code>$Inch</code> fijan
        las unidades y <code>$AddRegPart 1</code> pone en el plato el bruto de «Preparación». Con <code>$AddRegPart</code> el
        cero del torno pasa a la cara de las garras, como en ese simulador (con un bruto de 100 mm y 23 mm en las garras,
        la cara queda en Z77); también puedes elegirlo en «Cero del programa». <code>G92 X… Z…</code> mueve el cero (la
        posición actual toma esas coordenadas), <code>ET2</code> llama una herramienta igual que <code>T2</code>, y
        <code>T… M6</code> la monta. En el torno funcionan los ciclos <code>G81</code>/<code>G83</code> (taladrado en el eje)
        y <code>G76</code> (roscado en dos bloques). Otras instrucciones <code>$</code> se ignoran. El punto programado de la
        herramienta de tronzado es su esquina derecha (hacia la cara).
      </li>
      <li style={li}>
        <strong>Para programar menos:</strong> en el torno, <code>G71 U… R…</code> + <code>G71 P… Q… U… W… F…</code> desbasta
        el perfil escrito entre los bloques N indicados en P y Q, y <code>G70 P… Q…</code> lo afina (solos, G70 y G71 siguen
        siendo pulgadas y milímetros). <code>M98 P1000 L3</code> llama tres veces al subprograma <code>O1000</code>, que se
        escribe después del M30 y termina con <code>M99</code>. En la fresadora, <code>G41</code>/<code>G42</code> con
        <code>D…</code> corren la fresa un radio a la izquierda o a la derecha del contorno (se programa con las medidas de la
        pieza) y <code>G40</code> la cancela; en el torno no se simula la compensación del radio de la punta.
      </li>
    </ol>
  )
}

export default function EstudiarCNC() {
  return (
    <PaginaEstudiar
      etiqueta="Estudiar CNC"
      titulo="Estudiar · CNC"
      descripcion="Teoría de la unidad. Los programas de ejemplo se abren en el Laboratorio."
      pie="MecLab · MEC275 — Unidad 3: Control Numérico Computarizado · código G"
      secciones={SECCIONES_CNC}
    />
  )
}
