/**
 * Preguntas de práctica de PLC, generadas al azar: leer un escalón Ladder,
 * instrucciones, direcciones (apunte y LogixPro), ciclo de scan y sensores.
 */
import { elegir, mezclar, type Generador } from '../components/Autoevaluacion'
import { formatear } from './notacion'

// ---------------------------------------------------------------------------
// Leer un escalón: bloques en serie; cada bloque, uno o dos contactos en paralelo.
// ---------------------------------------------------------------------------
interface Contacto {
  dir: string
  nc: boolean
}
type Bloque = Contacto[]

const pasa = (c: Contacto, e: Record<string, boolean>) => (c.nc ? !e[c.dir] : !!e[c.dir])

const TINTA = '#33475c'

function DibujoEscalon({ bloques, salida }: { bloques: Bloque[]; salida: string }) {
  const ANCHO_BLOQUE = 110
  const alto = bloques.some((b) => b.length > 1) ? 110 : 70
  const ancho = 30 + bloques.length * ANCHO_BLOQUE + 130
  const contacto = (x: number, y: number, c: Contacto) => (
    <g key={`${x}-${y}`}>
      <line x1={x} y1={y} x2={x + 38} y2={y} stroke={TINTA} strokeWidth={2} />
      <line x1={x + 38} y1={y - 12} x2={x + 38} y2={y + 12} stroke={TINTA} strokeWidth={2.6} />
      <line x1={x + 54} y1={y - 12} x2={x + 54} y2={y + 12} stroke={TINTA} strokeWidth={2.6} />
      {c.nc && <line x1={x + 34} y1={y + 11} x2={x + 58} y2={y - 11} stroke={TINTA} strokeWidth={2} />}
      <line x1={x + 54} y1={y} x2={x + ANCHO_BLOQUE} y2={y} stroke={TINTA} strokeWidth={2} />
      <text x={x + 46} y={y - 17} textAnchor="middle" fontSize={12} fontWeight={700} fill={TINTA} fontFamily="ui-monospace, monospace">
        {c.dir}
      </text>
    </g>
  )
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} width={Math.min(ancho, 640)} style={{ maxWidth: '100%', display: 'block', background: '#fff', border: '1px solid #e0e5eb', borderRadius: 8 }} role="img" aria-label="Escalón Ladder">
      <line x1={10} y1={8} x2={10} y2={alto - 8} stroke={TINTA} strokeWidth={4} />
      <line x1={ancho - 10} y1={8} x2={ancho - 10} y2={alto - 8} stroke={TINTA} strokeWidth={4} />
      <line x1={10} y1={40} x2={30} y2={40} stroke={TINTA} strokeWidth={2} />
      {bloques.map((b, i) => {
        const x = 30 + i * ANCHO_BLOQUE
        return (
          <g key={i}>
            {contacto(x, 40, b[0])}
            {b[1] && (
              <>
                {contacto(x, 85, b[1])}
                <line x1={x + 4} y1={40} x2={x + 4} y2={85} stroke={TINTA} strokeWidth={2} />
                <line x1={x + ANCHO_BLOQUE - 4} y1={40} x2={x + ANCHO_BLOQUE - 4} y2={85} stroke={TINTA} strokeWidth={2} />
                <line x1={x} y1={85} x2={x + 4} y2={85} stroke="#fff" strokeWidth={3} />
              </>
            )}
          </g>
        )
      })}
      {(() => {
        const x = 30 + bloques.length * ANCHO_BLOQUE
        return (
          <g>
            <line x1={x} y1={40} x2={x + 40} y2={40} stroke={TINTA} strokeWidth={2} />
            <path d={`M ${x + 46} 27 A 14 14 0 0 0 ${x + 46} 53`} fill="none" stroke={TINTA} strokeWidth={2.6} />
            <path d={`M ${x + 62} 27 A 14 14 0 0 1 ${x + 62} 53`} fill="none" stroke={TINTA} strokeWidth={2.6} />
            <line x1={x + 68} y1={40} x2={ancho - 10} y2={40} stroke={TINTA} strokeWidth={2} />
            <text x={x + 54} y={20} textAnchor="middle" fontSize={12} fontWeight={700} fill={TINTA} fontFamily="ui-monospace, monospace">
              {salida}
            </text>
          </g>
        )
      })()}
    </svg>
  )
}

const leerEscalon: Generador = (azar) => {
  const entradas = ['I0.0', 'I0.1', 'I0.2', 'I0.3']
  const nBloques = 2 + Math.floor(azar() * 2)
  const usadas = [...entradas].sort(() => azar() - 0.5)
  let k = 0
  const bloques: Bloque[] = Array.from({ length: nBloques }, () => {
    const dos = azar() < 0.4 && k < usadas.length - 1
    const b: Bloque = [{ dir: usadas[k++ % usadas.length], nc: azar() < 0.35 }]
    if (dos) b.push({ dir: usadas[k++ % usadas.length], nc: azar() < 0.35 })
    return b
  })
  const estado: Record<string, boolean> = Object.fromEntries(entradas.map((d) => [d, azar() < 0.5]))
  const activa = bloques.every((b) => b.some((c) => pasa(c, estado)))
  const bloqueo = bloques.find((b) => !b.some((c) => pasa(c, estado)))
  return {
    tema: 'Leer Ladder',
    enunciado: `Con ${entradas.map((d) => `${d} = ${estado[d] ? 1 : 0}`).join(', ')}, ¿cuánto vale Q0.0 al terminar el barrido?`,
    figura: <DibujoEscalon bloques={bloques} salida="Q0.0" />,
    opciones: ['1 (la bobina se activa)', '0 (la bobina no se activa)'],
    correcta: activa ? 0 : 1,
    explicacion: activa
      ? 'Hay un camino con corriente de izquierda a derecha: en cada tramo en serie pasa al menos uno de sus contactos (el NA pasa con 1, el NC con 0).'
      : `El tramo de ${bloqueo?.map((c) => `${c.dir} ${c.nc ? 'NC' : 'NA'}`).join(' ∥ ')} corta la corriente: ${bloqueo
          ?.map((c) => `${c.dir} ${c.nc ? 'NC está a 1, así que abre' : 'NA está a 0, así que abre'}`)
          .join(' y ')}.`,
  }
}

// ---------------------------------------------------------------------------
export const INSTRUCCIONES: Array<[string, string]> = [
  ['Contacto NA (XIC)', 'deja pasar la corriente cuando su dirección está a 1'],
  ['Contacto NC (XIO)', 'deja pasar la corriente cuando su dirección está a 0'],
  ['Bobina (OTE)', 'vale 1 mientras le llega corriente y 0 cuando deja de llegarle'],
  ['Enclavar, Set (OTL)', 'pone su dirección a 1 y la deja así aunque ya no le llegue corriente'],
  ['Desenclavar, Reset (OTU)', 'pone su dirección a 0 (deshace un enclavamiento)'],
  ['Temporizador TON', 'se activa cuando lleva el tiempo preajustado recibiendo corriente'],
  ['Temporizador TOF', 'sigue activo un tiempo después de que deja de recibir corriente'],
  ['Temporizador RTO', 'acumula el tiempo con corriente y lo conserva sin ella, hasta un Reset'],
  ['Contador CTU', 'suma uno en cada flanco de subida de su entrada'],
  ['Contador CTD', 'resta uno en cada flanco de subida de su entrada'],
  ['One shot (ONS)', 'deja pasar la corriente un solo barrido, justo cuando llega'],
]

const instruccion: Generador = (azar) => {
  const [nombre, que] = elegir(INSTRUCCIONES, azar)
  const { opciones, correcta } = mezclar(nombre, INSTRUCCIONES.map((x) => x[0]).sort(() => azar() - 0.5), azar)
  return { tema: 'Instrucciones', enunciado: `¿Qué instrucción ${que}?`, opciones, correcta, explicacion: `${nombre}: ${que}.` }
}

const direccion: Generador = (azar) => {
  const esEntrada = azar() < 0.5
  const bit = Math.floor(azar() * 8)
  const dir = `${esEntrada ? 'I' : 'Q'}0.${bit}`
  const ab = formatear(dir, 'ab')
  const haciaAb = azar() < 0.5
  const correcta = haciaAb ? ab : dir
  const otros = haciaAb
    ? [formatear(`${esEntrada ? 'Q' : 'I'}0.${bit}`, 'ab'), formatear(`${esEntrada ? 'I' : 'Q'}0.${(bit + 1) % 8}`, 'ab'), `${esEntrada ? 'I' : 'O'}:${esEntrada ? 2 : 1}/${String(bit).padStart(2, '0')}`]
    : [`${esEntrada ? 'Q' : 'I'}0.${bit}`, `${esEntrada ? 'I' : 'Q'}0.${(bit + 1) % 8}`, `${esEntrada ? 'I' : 'Q'}1.${bit}`]
  const m = mezclar(correcta, otros, azar)
  return {
    tema: 'Direcciones',
    enunciado: haciaAb ? `La ${esEntrada ? 'entrada' : 'salida'} ${dir} del apunte, ¿cómo se escribe en LogixPro?` : `La dirección ${ab} de LogixPro, ¿cómo se escribe en la notación del apunte?`,
    ...m,
    explicacion: `En LogixPro las entradas van en el archivo I:1 y las salidas en O:2, con el bit en dos cifras: ${dir} = ${ab}.`,
  }
}

const SCAN: Array<{ p: string; ok: string; mal: string[]; porque: string }> = [
  {
    p: '¿Qué hace el PLC al comenzar cada barrido (scan)?',
    ok: 'Lee todas las entradas y guarda su estado en la memoria',
    mal: ['Escribe las salidas', 'Resuelve el último escalón', 'Espera a que cambie una entrada'],
    porque: 'El barrido es: 1) leer entradas, 2) resolver los escalones de arriba abajo, 3) actualizar las salidas.',
  },
  {
    p: '¿En qué orden resuelve el PLC los escalones?',
    ok: 'De arriba abajo, uno tras otro',
    mal: ['De abajo arriba', 'Todos a la vez', 'Sólo los que tienen una entrada que cambió'],
    porque: 'Lo que escribe un escalón ya lo leen los de más abajo en ese mismo barrido.',
  },
  {
    p: 'Si la misma salida tiene bobina en dos escalones, ¿cuál manda?',
    ok: 'La del último escalón',
    mal: ['La del primer escalón', 'La que esté a 1', 'Ninguna: el PLC da error y se detiene'],
    porque: 'Las salidas se escriben al final del barrido con lo que quedó escrito; el escalón de más abajo pisa al de arriba.',
  },
  {
    p: '¿Cuándo cambian las salidas físicas del PLC?',
    ok: 'Al final de cada barrido',
    mal: ['Apenas se resuelve su escalón', 'Sólo al pasar de STOP a RUN', 'Cada un segundo'],
    porque: 'El PLC escribe las salidas en el paso 3 del barrido, con la imagen de salidas que quedó al resolver el programa.',
  },
]

const scan: Generador = (azar) => {
  const q = elegir(SCAN, azar)
  const m = mezclar(q.ok, q.mal, azar)
  return { tema: 'Ciclo de scan', enunciado: q.p, ...m, explicacion: q.porque }
}

export const SENSORES: Array<[string, string]> = [
  ['Inductivo', 'detecta sin contacto sólo piezas metálicas'],
  ['Capacitivo', 'detecta cualquier material (también plásticos, líquidos o granos), incluso a través de la pared de un depósito'],
  ['Fotoeléctrico', 'detecta cuando un objeto corta o refleja un haz de luz'],
  ['Final de carrera', 'es un contacto mecánico que la pieza o el vástago empuja'],
  ['Magnético de nivel (flotador)', 'lleva un imán que sube con el líquido y acciona un contacto reed'],
  ['Presostato', 'cambia su contacto cuando la presión llega a un valor ajustado'],
]

const sensor: Generador = (azar) => {
  const [nombre, que] = elegir(SENSORES, azar)
  const m = mezclar(nombre, SENSORES.map((s) => s[0]).sort(() => azar() - 0.5), azar)
  return { tema: 'Sensores', enunciado: `¿Qué sensor ${que}?`, ...m, explicacion: `${nombre}: ${que}.` }
}

export const PREGUNTAS_PLC = [
  { tema: 'Leer Ladder', generar: leerEscalon },
  { tema: 'Instrucciones', generar: instruccion },
  { tema: 'Direcciones', generar: direccion },
  { tema: 'Ciclo de scan', generar: scan },
  { tema: 'Sensores', generar: sensor },
]
