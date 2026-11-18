import { type PasoProceso } from '../components/banco/ProcesoTarea'
import { revisarPrograma, escalonVacio, type ProgramaPLC } from './ladder'
import { NOMBRE_TAREA } from './datosPLC'

export const ETAPAS_SILO = ['Nombrar', 'Marcha', 'Cinta', 'Llenar', 'Pilotos', 'Probar']

export function dirsPrograma(p: ProgramaPLC): { contactos: Set<string>; bobinas: Set<string> } {
  const contactos = new Set<string>()
  const bobinas = new Set<string>()
  for (const e of p.escalones) {
    for (const fila of e.celdas) for (const c of fila) if (c.tipo === 'contacto') contactos.add(c.dir)
    for (const b of e.bobinas) if (b) bobinas.add(b.dir)
  }
  return { contactos, bobinas }
}

const ENTRADAS_TAREA: Array<[string, string]> = [
  ['I0.0', 'START'],
  ['I0.1', 'STOP'],
  ['I0.3', 'PROX'],
  ['I0.4', 'LEVEL'],
]
const PILOTOS: Array<[string, string]> = [
  ['Q0.2', 'RUN'],
  ['Q0.3', 'FILL'],
  ['Q0.4', 'FULL'],
]

/**
 * Lo que está a medias en el programa, dicho como falta y no como respuesta. `undefined` si no hay
 * nada que avisar. Mira solo lo que el paso en curso ya pide.
 */
export function pistaSilo(p: ProgramaPLC, id: string): string | undefined {
  const { contactos, bobinas } = dirsPrograma(p)
  const nombrados = new Set(p.simbolos.filter((s) => s.nombre.trim()).map((s) => s.dir))
  const marcas = [...bobinas].filter((d) => d.startsWith('M'))
  if (id === 'nombrar') {
    const sin = ENTRADAS_TAREA.filter(([d]) => !nombrados.has(d))
    if (sin.length > 0 && sin.length < ENTRADAS_TAREA.length) return `Falta el nombre de ${sin.map(([d, n]) => `${d} (${n})`).join(' y ')}.`
    return undefined
  }
  if (id === 'marcha') {
    if (contactos.has('I0.0') && !contactos.has('I0.1')) return 'Ya lees START, pero falta STOP (I0.1) para poder parar.'
    if (contactos.has('I0.1') && !contactos.has('I0.0')) return 'Ya lees STOP, pero falta START (I0.0) para poder arrancar.'
    if (bobinas.size > 0) return 'Hay una bobina, pero ninguna es una marca (M) que recuerde la marcha.'
    return undefined
  }
  if (marcas.length > 0 && ![...contactos].some((d) => d.startsWith('M'))) return 'La marca M quedó sin usar: ningún contacto la lee.'
  if (id === 'llenar' && bobinas.has('Q0.1') && !contactos.has('I0.3') && !contactos.has('I0.4')) return 'La válvula Q0.1 no depende de PROX ni de LEVEL.'
  if (id === 'probar') {
    const sin = PILOTOS.filter(([d]) => !bobinas.has(d))
    if (sin.length > 0) return `Faltan pilotos: ${sin.map(([d, n]) => `${d} (${n})`).join(', ')}.`
  }
  const aviso = revisarPrograma(p)[0]
  return aviso ? `El diagrama avisa: ${aviso}` : undefined
}

export function pasoSilo(p: ProgramaPLC): PasoProceso {
  const paso = pasoSiloBase(p)
  const pista = pistaSilo(p, paso.id)
  return pista ? { ...paso, pista } : paso
}

function pasoSiloBase(p: ProgramaPLC): PasoProceso {
  const { contactos, bobinas } = dirsPrograma(p)
  const total = ETAPAS_SILO.length
  const base = { total }
  const nombrados = new Set(p.simbolos.filter((s) => s.nombre.trim()).map((s) => s.dir))
  if (!['I0.0', 'I0.1', 'I0.3', 'I0.4'].every((d) => nombrados.has(d))) {
    return { ...base, id: 'nombrar', numero: 1, titulo: 'Ponerle nombre a las entradas', donde: 'La pestaña E/S, en el panel de la derecha.', accion: 'Escribe el nombre de START, STOP, PROX y LEVEL. El cableado de la planta ya dice qué es cada una.', listo: 'Esas cuatro entradas tienen nombre.' }
  }
  if (![...bobinas].some((d) => d.startsWith('M'))) {
    return { ...base, id: 'marcha', numero: 2, titulo: 'Dejar el sistema en marcha', donde: 'El primer escalón del diagrama.', accion: 'Un contacto de START y uno de STOP, y una bobina de marca (M). La marca recuerda que se pulsó marcha.', listo: 'Hay una bobina M.' }
  }
  if (!bobinas.has('Q0.0')) {
    return { ...base, id: 'cinta', numero: 3, titulo: 'Mover la cinta', donde: 'Un escalón nuevo, debajo de la marcha.', accion: 'La bobina Q0.0 es el motor. Piensa cuándo debe avanzar y cuándo debe parar: el sensor PROX (I0.3) dice si hay una caja en posición.', listo: 'Hay una bobina Q0.0.' }
  }
  if (!bobinas.has('Q0.1') || (!contactos.has('I0.3') && !contactos.has('I0.4'))) {
    return { ...base, id: 'llenar', numero: 4, titulo: 'Llenar la caja', donde: 'Otro escalón.', accion: 'Q0.1 abre la válvula. PROX dice que la caja está debajo; LEVEL (I0.4) dice que ya está llena. Decide con cuál cortas el llenado.', listo: 'Hay una bobina Q0.1 y un contacto de PROX o de LEVEL.' }
  }
  if (!['Q0.2', 'Q0.3', 'Q0.4'].some((d) => bobinas.has(d))) {
    return { ...base, id: 'pilotos', numero: 5, titulo: 'Encender los pilotos', donde: 'Escalones aparte, uno por piloto.', accion: 'RUN (Q0.2) cuando el sistema está en marcha, FILL (Q0.3) mientras llena y FULL (Q0.4) cuando LEVEL está activo.', listo: 'Hay al menos una bobina Q0.2, Q0.3 o Q0.4.' }
  }
  return { ...base, id: 'probar', numero: 6, titulo: 'Probarlo con la planta', donde: '▶ RUN, a la izquierda, y la pestaña Registro.', accion: 'Pulsa START. Mira si la cinta para bajo el silo, si la caja se llena y si después sigue. STOP tiene que poder parar.', listo: 'En el registro no queda el aviso de una caja que pasó sin llenar.' }
}

export function checklistSilo(p: ProgramaPLC): Array<{ ok: boolean; texto: string }> {
  const { contactos, bobinas } = dirsPrograma(p)
  const avisos = revisarPrograma(p)
  const tiene = (dirs: string[]) => dirs.every((d) => contactos.has(d) || bobinas.has(d))
  return [
    { ok: contactos.size > 0 && bobinas.size > 0, texto: contactos.size > 0 && bobinas.size > 0 ? 'Hay contactos y bobinas.' : 'El diagrama todavía no tiene un contacto y una bobina.' },
    { ok: tiene(['I0.0', 'I0.1']), texto: tiene(['I0.0', 'I0.1']) ? 'Usa START y STOP.' : 'Faltan START (I0.0) o STOP (I0.1).' },
    { ok: contactos.has('I0.3') && contactos.has('I0.4'), texto: contactos.has('I0.3') && contactos.has('I0.4') ? 'Lee PROX y LEVEL.' : 'Falta leer PROX (I0.3) o LEVEL (I0.4).' },
    { ok: bobinas.has('Q0.0') && bobinas.has('Q0.1'), texto: bobinas.has('Q0.0') && bobinas.has('Q0.1') ? 'Comanda la cinta y la válvula.' : 'Falta la bobina del motor (Q0.0) o de la válvula (Q0.1).' },
    { ok: ['Q0.2', 'Q0.3', 'Q0.4'].every((d) => bobinas.has(d)), texto: ['Q0.2', 'Q0.3', 'Q0.4'].every((d) => bobinas.has(d)) ? 'Los tres pilotos tienen bobina.' : 'Falta un piloto: RUN (Q0.2), FILL (Q0.3) o FULL (Q0.4).' },
    { ok: avisos.length === 0, texto: avisos.length === 0 ? 'El diagrama no tiene avisos de escritura.' : avisos[0] },
  ]
}

export function ejemploGuiadoSilo(): ProgramaPLC {
  const marcha = escalonVacio()
  marcha.comentario = 'Memoria de marcha. La cinta, la válvula y los pilotos van en los escalones de abajo.'
  marcha.celdas[0][0] = { tipo: 'contacto', modo: 'NA', dir: 'I0.0' }
  marcha.celdas[0][1] = { tipo: 'contacto', modo: 'NC', dir: 'I0.1' }
  marcha.bobinas[0] = { tipo: 'normal', dir: 'M0.0' }
  return {
    version: 1,
    tipo: 'programa-plc',
    nombre: NOMBRE_TAREA,
    planta: 'silo',
    simbolos: [
      { dir: 'I0.0', nombre: 'START', descripcion: 'Pulsador de marcha' },
      { dir: 'I0.1', nombre: 'STOP', descripcion: 'Pulsador de paro' },
      { dir: 'M0.0', nombre: 'MARCHA', descripcion: 'El sistema quedó en marcha' },
    ],
    escalones: [marcha, escalonVacio()],
  }
}
