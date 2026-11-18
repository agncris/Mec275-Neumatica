/**
 * Estudiar de Neumática: la teoría y las autoevaluaciones. Se carga con `lazy`
 * solo al entrar a Estudiar, para que el Laboratorio abra más rápido.
 */
import PaginaEstudiar from '../banco/PaginaEstudiar'
import TablaNomenclatura from '../TablaNomenclatura'
import MetodoCascada from '../MetodoCascada'
import SimbologiaVDI from '../SimbologiaVDI'
import SimbologiaISO from '../SimbologiaISO'
import FichaNeumatica from './FichaNeumatica'
import Autoevaluacion from '../Autoevaluacion'
import { PREGUNTAS_NEUMATICA } from './preguntasNeumatica'

export default function EstudiarNeumatica({ alCargarCircuito }: { alCargarCircuito: () => void }) {
  return (
    <PaginaEstudiar
      etiqueta="Estudiar neumática"
      titulo="Estudiar · Neumática"
      descripcion="Teoría y autoevaluaciones de la unidad. Los circuitos de ejemplo se abren en el Laboratorio."
      pie="MecLab · MEC275 — Neumática industrial · Simbología ISO 1219-1"
      secciones={[
        { id: 'practica', indice: 'Autoevaluación', titulo: 'Autoevaluación · practica con preguntas al azar', contenido: <Autoevaluacion generadores={PREGUNTAS_NEUMATICA} /> },
        { id: 'ficha', indice: 'Ficha de repaso', titulo: 'Ficha de repaso · para imprimir', contenido: <FichaNeumatica /> },
        { id: 'cascada', indice: 'Método cascada', titulo: 'Método cascada · secuencias con señales bloqueantes', contenido: <MetodoCascada alCargar={alCargarCircuito} /> },
        { id: 'vdi', indice: 'Simbología VDI 2860', titulo: 'Simbología VDI 2860 · funciones de manipulación', contenido: <SimbologiaVDI /> },
        { id: 'iso', indice: 'Simbología ISO 1219-1', titulo: 'Simbología ISO 1219-1 · componentes neumáticos', contenido: <SimbologiaISO /> },
        { id: 'vias', indice: 'Nº de vías y posiciones', titulo: 'Nº de vías y posiciones · nomenclatura de los orificios', contenido: <TablaNomenclatura /> },
      ]}
    />
  )
}
