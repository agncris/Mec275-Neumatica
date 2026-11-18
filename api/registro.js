/**
 * Registro de las conversaciones de MecBot, para investigación académica y para mejorar
 * el curso. El aviso que ve el alumno está en src/components/MecBot.tsx (AvisoPrivacidad):
 * si cambia lo que se guarda, se cambia también ese texto.
 *
 * Se guarda: la pregunta, la respuesta, la fecha, la unidad de la app y un número al azar
 * que agrupa una conversación (cambia cada vez que se abre la app).
 * No se guarda: nombre, correo, rol USM, IP, navegador ni ubicación. Antes de guardar se
 * borran del texto los correos, RUT, teléfonos y el nombre tras «soy» o «me llamo».
 *
 * Dos destinos, cada uno opcional:
 * - MEC_BOT_REGISTRO: ruta de un archivo local (una línea JSON por consulta). Solo en local:
 *   en Vercel el disco es de solo lectura.
 * - MEC_BOT_SUPABASE_URL y MEC_BOT_SUPABASE_KEY: tabla mecbot_registro en Supabase. La clave
 *   publicable solo puede insertar (no leer): leer se hace con la clave de respaldo.
 */

const UNIDADES = new Set(['neumatica', 'plc', 'cnc', 'robotica'])

/** Borra del texto lo que identifica a una persona: correos, RUT, teléfonos y nombres tras «soy». */
export function anonimizar(texto) {
  return String(texto || '')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[correo]')
    .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g, '[rut]')
    .replace(/(\+?56\s?)?\b9[\s-]?\d{4}[\s-]?\d{4}\b/g, '[teléfono]')
    // «soy Pedro Soto», «me llamo Ana»: el nombre con mayúscula que sigue.
    .replace(/\b([Ss]oy|[Mm]e llamo|[Mm]i nombre es)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+(\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+){0,3}/g, (_, frase) => `${frase} [nombre]`)
}

/** Lo que manda el navegador junto a la pregunta, ya validado. */
export function datosDeRegistro(cuerpo) {
  const unidad = typeof cuerpo?.unidad === 'string' && UNIDADES.has(cuerpo.unidad) ? cuerpo.unidad : null
  const conversacion = typeof cuerpo?.conversacion === 'string' && /^[a-z0-9]{8,32}$/.test(cuerpo.conversacion) ? cuerpo.conversacion : null
  // Solo `false` explícito apaga el registro: así lo marca la casilla «No guardar».
  const guardar = cuerpo?.guardar !== false
  return { unidad, conversacion, guardar }
}

export function filaDeRegistro(pregunta, respuesta, datos = {}) {
  return {
    fecha: new Date().toISOString(),
    unidad: datos.unidad ?? null,
    conversacion: datos.conversacion ?? null,
    pregunta: anonimizar(pregunta).slice(0, 2000),
    respuesta: anonimizar(respuesta).slice(0, 8000),
  }
}

async function aArchivo(ruta, fila) {
  try {
    const { appendFile } = await import('node:fs/promises')
    await appendFile(ruta, JSON.stringify(fila) + '\n', 'utf8')
  } catch (e) {
    console.error('mecbot: no se pudo escribir el registro', e && e.message)
  }
}

async function aSupabase(url, clave, fila) {
  const ctrl = new AbortController()
  const reloj = setTimeout(() => ctrl.abort(), 4000)
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/mecbot_registro`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { apikey: clave, Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(fila),
    })
    if (!res.ok) console.error('mecbot: Supabase no guardó el registro', res.status, (await res.text().catch(() => '')).slice(0, 200))
  } catch (e) {
    console.error('mecbot: no llegó a Supabase', e && e.name)
  } finally {
    clearTimeout(reloj)
  }
}

/** Guarda la consulta. Nunca lanza: si falla, el alumno igual recibe su respuesta. */
export async function registrar(pregunta, respuesta, datos = {}) {
  if (datos.guardar === false) return
  const ruta = process.env.MEC_BOT_REGISTRO
  const url = process.env.MEC_BOT_SUPABASE_URL
  const clave = process.env.MEC_BOT_SUPABASE_KEY
  if (!ruta && !(url && clave)) return
  const fila = filaDeRegistro(pregunta, respuesta, datos)
  await Promise.all([ruta ? aArchivo(ruta, fila) : null, url && clave ? aSupabase(url, clave, fila) : null])
}
