/**
 * Validación estática del circuito con mensajes pedagógicos, independiente de
 * la simulación (se puede mostrar antes de darle al botón "Simular").
 */
import { MODELOS } from './componentes'
import { claveNodo } from './solver'
import { esActuador } from './tipos'
import type { Circuito } from './tipos'

export function validarCircuito(circuito: Circuito): string[] {
  const mensajes: string[] = []
  const porId = new Map(circuito.componentes.map((c) => [c.id, c]))

  // Ids repetidos: el motor sólo conservaría uno de ellos y el circuito
  // se comportaría de forma imprevisible.
  const vistos = new Set<string>()
  for (const comp of circuito.componentes) {
    if (vistos.has(comp.id)) {
      mensajes.push(
        `Hay dos componentes con el id repetido "${comp.id}". Cambia uno: cada ficha necesita una designación única.`,
      )
    }
    vistos.add(comp.id)
  }

  // Finales de carrera: necesitan saber a qué cilindro vigilan.
  for (const comp of circuito.componentes) {
    if (comp.tipo !== 'finalCarrera') continue
    const idCilindro = typeof comp.params?.cilindro === 'string' ? comp.params.cilindro : ''
    if (!idCilindro) {
      mensajes.push(
        `El final de carrera ${comp.id} no tiene asignado ningún cilindro: nunca se accionará. Elígelo en el panel de propiedades.`,
      )
      continue
    }
    const objetivo = porId.get(idCilindro)
    if (!objetivo) {
      mensajes.push(
        `El final de carrera ${comp.id} vigila el cilindro "${idCilindro}", que no está en la pizarra.`,
      )
    } else if (!esActuador(objetivo.tipo)) {
      mensajes.push(
        `El final de carrera ${comp.id} apunta a ${idCilindro}, que no es un cilindro: sólo los cilindros accionan rodillos.`,
      )
    } else if (objetivo.tipo === 'motorNeumatico') {
      mensajes.push(
        `El final de carrera ${comp.id} vigila a ${idCilindro}, que es un motor de giro continuo: un final de carrera no detecta bien un eje que nunca se detiene. Usa un Sensor de paso (motor) en su lugar.`,
      )
    }
  }

  // Sensor de paso: necesita saber a qué motor de giro continuo vigila.
  for (const comp of circuito.componentes) {
    if (comp.tipo !== 'sensorGiro') continue
    const idMotor = typeof comp.params?.motor === 'string' ? comp.params.motor : ''
    if (!idMotor) {
      mensajes.push(
        `El sensor de paso ${comp.id} no tiene asignado ningún motor: nunca se accionará. Elígelo en el panel de propiedades.`,
      )
      continue
    }
    const objetivoMotor = porId.get(idMotor)
    if (!objetivoMotor) {
      mensajes.push(`El sensor de paso ${comp.id} vigila el motor "${idMotor}", que no está en la pizarra.`)
    } else if (objetivoMotor.tipo !== 'motorNeumatico') {
      mensajes.push(
        `El sensor de paso ${comp.id} apunta a ${idMotor}, que no es un motor de giro continuo.`,
      )
    }
  }

  const conManguera = new Set<string>()
  for (const m of circuito.mangueras) {
    for (const extremo of [m.a, m.b]) {
      const comp = porId.get(extremo.componente)
      const modelo = comp ? MODELOS[comp.tipo] : undefined
      if (!comp) {
        mensajes.push(`La manguera ${m.id} apunta a un componente que no existe: ${extremo.componente}.`)
      } else if (modelo && !modelo.puertos.some((p) => p.id === extremo.puerto)) {
        mensajes.push(
          `La manguera ${m.id} apunta a un puerto que ${comp.id} (${modelo.nombre}) no tiene: ${extremo.puerto}.`,
        )
      }
      conManguera.add(claveNodo(extremo.componente, extremo.puerto))
    }
  }

  for (const comp of circuito.componentes) {
    const modelo = MODELOS[comp.tipo]
    if (!modelo) {
      mensajes.push(`Tipo de componente desconocido: ${comp.tipo} (${comp.id}).`)
      continue
    }
    for (const puerto of modelo.puertos) {
      // Los puertos de escape pueden quedar libres (ventean a la atmósfera) y
      // los opcionales (pilotajes) pueden no usarse.
      if (puerto.rol === 'escape' || puerto.opcional) continue
      if (!conManguera.has(claveNodo(comp.id, puerto.id))) {
        mensajes.push(
          `El puerto ${puerto.id} de ${comp.id} (${modelo.nombre}) no está conectado a ninguna manguera: por ahí no puede circular aire.`,
        )
      }
    }
  }

  return mensajes
}
