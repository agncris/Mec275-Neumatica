/**
 * Imprime en Markdown lo que se entrega en cada tarea (sale de `src/tareas/entregables.ts`, el
 * mismo módulo que usa la interfaz). Para pegarlo en el enunciado:
 *
 *   npm run entregables              todas las tareas
 *   npm run entregables -- plc cnc   solo algunas (neumatica, plc, cnc, robotica)
 */
import { TAREAS, entregablesEnMarkdown, type IdTarea } from '../src/tareas/entregables'

const pedidas = process.argv.slice(2)
const validas = pedidas.filter((p): p is IdTarea => p in TAREAS)
const raras = pedidas.filter((p) => !(p in TAREAS))
if (raras.length) {
  console.error(`No conozco: ${raras.join(', ')}. Las tareas son: ${Object.keys(TAREAS).join(', ')}.`)
  process.exit(1)
}
process.stdout.write(entregablesEnMarkdown(validas.length ? validas : undefined))
