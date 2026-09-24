/**
 * Dos formas de escribir las direcciones del PLC:
 *  - «Siemens» (la del apunte): I0.3, Q0.1, M0.1, T0, C0, MW0 (registros).
 *  - «LogixPro / Allen-Bradley» (la del simulador LogixPro y de RSLogix):
 *    I:1/03, O:2/01, B3:0/1, T4:0, C5:0, con los bits T4:0/DN, C5:0/CU y
 *    los acumulados T4:0.ACC, y los registros enteros N7:0.
 * Internamente la aplicación guarda siempre la primera; esta es sólo la
 * forma de mostrarlas.
 */
export type Notacion = 'siemens' | 'ab'

const dosCifras = (n: number) => String(n).padStart(2, '0')

export function formatear(dir: string, notacion: Notacion): string {
  if (!dir) return dir
  // Registros enteros: palabras de marcas en Siemens (MW0, MW2…), archivo N7 en LogixPro.
  const n = /^N(\d+)$/.exec(dir)
  if (n) return notacion === 'ab' ? `N7:${n[1]}` : `MW${Number(n[1]) * 2}`
  if (notacion === 'siemens') return dir
  let m = /^I0\.([0-7])$/.exec(dir)
  if (m) return `I:1/${dosCifras(Number(m[1]))}`
  m = /^Q0\.([0-7])$/.exec(dir)
  if (m) return `O:2/${dosCifras(Number(m[1]))}`
  m = /^M([01])\.([0-7])$/.exec(dir)
  if (m) return `B3:0/${Number(m[1]) * 8 + Number(m[2])}`
  m = /^([TC])([0-7])(?:\.(DN|TT|EN|CU|ACC))?$/.exec(dir)
  if (m) {
    const archivo = m[1] === 'T' ? 'T4' : 'C5'
    const base = `${archivo}:${m[2]}`
    if (!m[3]) return base
    return m[3] === 'ACC' ? `${base}.ACC` : `${base}/${m[3]}`
  }
  return dir
}

/** Nombre de la instrucción en cada notación (LogixPro usa los mnemónicos de RSLogix). */
export const MNEMONICOS = {
  NA: { siemens: '┤ ├', ab: 'XIC' },
  NC: { siemens: '┤/├', ab: 'XIO' },
  normal: { siemens: '( )', ab: 'OTE' },
  // Enclavar / desenclavar: (L) y (U), como en las láminas del curso.
  set: { siemens: '(L)', ab: 'OTL' },
  reset: { siemens: '(U)', ab: 'OTU' },
} as const
