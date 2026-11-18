/**
 * Estudiar de Robótica: la teoría, la ficha, la autoevaluación y las demos 3D.
 * Se carga con `lazy` solo al entrar a Estudiar, para que el Laboratorio abra más rápido.
 */
import { lazy, Suspense } from 'react'
import PaginaEstudiar, { type SeccionEstudio } from '../components/banco/PaginaEstudiar'
import Autoevaluacion from '../components/Autoevaluacion'
import FichaRobot from './FichaRobot'
import { PREGUNTAS_ROBOT } from './preguntasRobot'
import { Componentes, FichaTecnica, GradosLibertad, PracticaRobot, ProgramacionParametrica, QueEsRobot, SerieVsRobotica, SaltarAPractica, TiposGenerales } from './TeoriaRobotica'

const TiposRobot = lazy(() => import('./TiposRobot'))

export const SECCIONES_ROBOT: SeccionEstudio[] = [
  { id: 'practica', indice: 'Autoevaluación', titulo: 'Autoevaluación · practica con preguntas al azar', contenido: <Autoevaluacion generadores={PREGUNTAS_ROBOT} /> },
  { id: 'ficha', indice: 'Ficha de repaso', titulo: 'Ficha de repaso · para imprimir', contenido: <FichaRobot /> },
  {
    id: 'tipos-3d',
    indice: 'Tipos de robots en 3D',
    titulo: 'Tipos de robots de base fija (en 3D)',
    contenido: (
      <Suspense fallback={<p>Cargando…</p>}>
        <TiposRobot />
      </Suspense>
    ),
  },
  { id: 'que-es', indice: '¿Qué es un robot industrial?', titulo: '¿Qué es un robot industrial?', contenido: <QueEsRobot /> },
  { id: 'serie', indice: 'Fabricación en serie', titulo: 'Fabricación en serie y robótica industrial', contenido: <SerieVsRobotica /> },
  { id: 'tipos', indice: 'Tipos de robots', titulo: 'Tipos de robots', contenido: <TiposGenerales /> },
  { id: 'componentes', indice: 'Componentes', titulo: 'Componentes de un robot de base fija', contenido: <Componentes /> },
  { id: 'grados', indice: 'Grados de libertad', titulo: 'Grados de libertad y singularidades', contenido: <GradosLibertad /> },
  { id: 'ficha-tecnica', indice: 'Ficha técnica', titulo: 'Ficha técnica: cómo elegir el robot', contenido: <FichaTecnica /> },
  { id: 'parametrica', indice: 'Programación paramétrica', titulo: 'Programación paramétrica en MecLab', contenido: <ProgramacionParametrica /> },
  { id: 'como-usar', indice: 'Cómo usar esta unidad', titulo: 'Cómo usar esta unidad', contenido: <ComoUsar /> },
]

function ComoUsar() {
  const li: React.CSSProperties = { marginBottom: 4 }
  return (
    <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55 }}>
      <li style={li}>
        <strong>Programación visual:</strong> elige un bloque en Movimientos, Robot, Herramientas, Trayectoria o Utilidades y arrástralo al lienzo (o haz clic). Conecta la salida, a la derecha, con la entrada, a la izquierda. Todo se recalcula al instante.
      </li>
      <li style={li}>
        <strong>Plano DXF:</strong> «Abrir DXF» trae las curvas de tu plano (líneas, arcos, círculos, polilíneas); el componente
        Curve (Crv) las entrega, filtradas por capa si quieres. El ejemplo 3 trae un plano de práctica.
      </li>
      <li style={li}>
        <strong>La base:</strong> en el Core defines dónde está la pieza respecto del robot (X, Y y la altura del mesón). La
        herramienta apunta en contra de la Z de cada plano: con planos XY, baja vertical sobre la pieza.
      </li>
      <li style={li}>
        <strong>Simular y analizar:</strong> ▶ recorre el programa (como KUKA|play). La trayectoria se pinta verde si todo va
        bien, naranjo si hay avisos (cerca de un límite o de una singularidad) y roja si hay errores (fuera de alcance, fuera
        del rango de un eje, saltos bruscos, choques del brazo o la herramienta con el mesón o la plancha). Haz clic en un
        problema para ir a ese momento.
      </li>
      <li style={li}>
        <strong>Entregar:</strong> a Aula van el PDF de la plantilla, el json y el video. «Guardar definición» baja el json
        (con el plano); «● Grabar video» graba la simulación. «Exportar KRL» descarga el .src para el controlador: no se
        sube. «Croquis…» baja la pieza acotada y el posicionamiento (planta y elevación) para pegarlos en la plantilla; la
        ficha técnica del robot está en el panel de la derecha.
      </li>
      <li style={li}>
        <SaltarAPractica>Abrir el Laboratorio</SaltarAPractica>
        <SaltarAPractica destino="tarea">Abrir la Tarea</SaltarAPractica>
      </li>
      <li style={li}>
        <strong>Mando manual:</strong> mueve el robot eje por eje o en X/Y/Z, graba puntos PTP o LIN y reprodúcelos: es el
        teach-in/playback.
      </li>
      <li style={li}>
        <strong>Otro robot:</strong> en el componente Robot elige «Personalizado» y escribe las medidas de sus eslabones (d1,
        a1, a2, a3, d4, d6) sacadas de su ficha; los rangos y velocidades se toman del modelo parecido que elijas.
      </li>
      <li style={li}>
        <strong>El trabajo se hace en MecLab.</strong> Los bloques se llaman como en Grasshopper (Curve, LIN, PTP, Core).
        Los robots tienen los rangos y velocidades de sus fichas y una geometría muy parecida a la real. El código KRL es
        de estudio: revísalo antes de usarlo en un robot real.
      </li>
    </ol>
  )
}

export default function EstudiarRobotica({ setSeccion }: { setSeccion: (destino: 'laboratorio' | 'tarea') => void }) {
  return (
    <PracticaRobot.Provider value={setSeccion}>
      <PaginaEstudiar
        etiqueta="Estudiar robótica"
        titulo="Estudiar · Robótica"
        descripcion="Teoría de la unidad. Al final de cada tema puedes probarlo en el Laboratorio o en la Tarea."
        pie="MecLab · MEC275 — Unidad 4: Robótica industrial"
        secciones={SECCIONES_ROBOT}
      />
    </PracticaRobot.Provider>
  )
}
