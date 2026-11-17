/**
 * Estudiar de PLC: la teoría, la ficha y la autoevaluación.
 * Se carga con `lazy` solo al entrar a Estudiar, para que el Laboratorio abra más rápido.
 */
import PaginaEstudiar, { type SeccionEstudio } from '../components/banco/PaginaEstudiar'
import Autoevaluacion from '../components/Autoevaluacion'
import FichaPLC from './FichaPLC'
import { PREGUNTAS_PLC } from './preguntasPLC'
import { CicloScan, ComponentesPLC, ElegirPLC, EntradasSalidas, QueEsPLC, Sensores, SimbolosLadder } from './TeoriaPLC'

export const SECCIONES_PLC: SeccionEstudio[] = [
  { id: 'practica', indice: 'Autoevaluación', titulo: 'Autoevaluación · practica con preguntas al azar', contenido: <Autoevaluacion generadores={PREGUNTAS_PLC} /> },
  { id: 'ficha', indice: 'Ficha de repaso', titulo: 'Ficha de repaso · para imprimir', contenido: <FichaPLC /> },
  { id: 'que-es', indice: '¿Qué es un PLC?', titulo: '¿Qué es un PLC y para qué se usa?', contenido: <QueEsPLC /> },
  { id: 'componentes', indice: 'Componentes', titulo: 'Componentes de un PLC', contenido: <ComponentesPLC /> },
  { id: 'entradas-salidas', indice: 'Entradas y salidas', titulo: 'Entradas, salidas y direcciones', contenido: <EntradasSalidas /> },
  { id: 'elegir', indice: 'Cómo elegir un PLC', titulo: '¿Cómo elegir un PLC?', contenido: <ElegirPLC /> },
  { id: 'sensores', indice: 'Sensores', titulo: 'Sensores que se conectan al PLC', contenido: <Sensores /> },
  { id: 'ladder', indice: 'Ladder', titulo: 'Programación Ladder · contactos y bobinas', contenido: <SimbolosLadder /> },
  { id: 'scan', indice: 'Ciclo de scan', titulo: 'Cómo ejecuta el PLC tu programa: el ciclo de scan', contenido: <CicloScan /> },
]


export default function EstudiarPLC() {
  return (
    <PaginaEstudiar
      etiqueta="Estudiar PLC"
      titulo="Estudiar · PLC"
      descripcion="Teoría de la unidad. Los programas de ejemplo y los ejercicios se abren en el Laboratorio."
      pie="NeumaLab · MEC275 — Unidad 2: Controlador Lógico Programable · Ladder"
      secciones={SECCIONES_PLC}
    />
  )
}
