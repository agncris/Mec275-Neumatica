/**
 * MecBot: el alumno pregunta por escrito o hablando, y recibe una guía de
 * estudio. La respuesta la arma el servidor; aquí no hay clave ni soluciones.
 */
import { useEffect, useRef, useState } from 'react'

interface Mensaje {
  rol: 'alumno' | 'mecbot'
  texto: string
  /** Si es un fallo de red, el texto de la pregunta para reenviarla. */
  reenvio?: string
}

function IconoReenviar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 12a8 8 0 1 1-2.3-5.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const FALLO_RED = new Set(['red', 'ocupado'])

const AVISOS: Record<string, string> = {
  'sin-clave': 'Todavía no estoy conectado. El profesor tiene que poner la clave del modelo en el servidor.',
  'clave-invalida': 'La clave del servidor no está sirviendo. Hay que renovarla.',
  ocupado: 'Hay mucha gente preguntando. Espera un momento y vuelve a intentar.',
  cupo: 'Llegaste al tope de preguntas por ahora. Vuelve a intentar más tarde.',
  mensaje: 'Escribe una pregunta para poder ayudarte.',
  red: 'No pude responder ahora. Inténtalo de nuevo en un momento.',
}

type Reconocimiento = {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function crearReconocimiento(): Reconocimiento | null {
  const Ctor = (window as unknown as { SpeechRecognition?: new () => Reconocimiento; webkitSpeechRecognition?: new () => Reconocimiento }).SpeechRecognition
    || (window as unknown as { webkitSpeechRecognition?: new () => Reconocimiento }).webkitSpeechRecognition
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = 'es-CL'
  rec.interimResults = false
  return rec
}

export default function MecBot() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [borrador, setBorrador] = useState('')
  const [pensando, setPensando] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const [leer, setLeer] = useState(true)
  const listaRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<Reconocimiento | null>(null)
  const puedeHablar = typeof window !== 'undefined' && 'speechSynthesis' in window
  const puedeEscuchar = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight })
  }, [mensajes, pensando, abierto])

  useEffect(() => () => {
    recRef.current?.stop()
    window.speechSynthesis?.cancel()
  }, [])

  const decir = (texto: string) => {
    if (!leer || !puedeHablar) return
    window.speechSynthesis.cancel()
    const frase = new SpeechSynthesisUtterance(texto)
    frase.lang = 'es-CL'
    window.speechSynthesis.speak(frase)
  }

  const preguntar = async (texto: string, enVoz: boolean, historiaLista?: Mensaje[], despues: Mensaje[] = []) => {
    const limpio = texto.trim()
    if (!limpio || pensando) return
    const historia = historiaLista ?? [...mensajes, { rol: 'alumno' as const, texto: limpio }]
    setMensajes([...historia, ...despues])
    if (!historiaLista) setBorrador('')
    setPensando(true)
    const dejarFallo = (aviso: string) => {
      setMensajes([...historia, { rol: 'mecbot', texto: aviso, reenvio: limpio }, ...despues])
    }
    if (!navigator.onLine) {
      dejarFallo('Sin conexión no puedo responder. El resto de la app sigue funcionando.')
      setPensando(false)
      return
    }
    try {
      const res = await fetch('/api/mecbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensajes: historia
            .filter((m) => !m.reenvio)
            .slice(-10)
            .map(({ rol, texto: t }) => ({ rol, texto: t })),
        }),
      })
      const datos = (await res.json().catch(() => null)) as { texto?: string; error?: string } | null
      const codigo = datos?.error || ''
      const respuesta = datos?.texto?.trim() || AVISOS[codigo] || AVISOS.red
      const fallo = !datos?.texto?.trim() && (FALLO_RED.has(codigo) || !AVISOS[codigo])
      if (fallo) {
        dejarFallo(respuesta)
        return
      }
      setMensajes([...historia, { rol: 'mecbot', texto: respuesta }, ...despues])
      if (enVoz) decir(respuesta)
    } catch {
      dejarFallo(AVISOS.red)
    } finally {
      setPensando(false)
    }
  }

  const reenviar = (indice: number) => {
    const m = mensajes[indice]
    if (!m?.reenvio || pensando) return
    const previos = mensajes.slice(0, indice).filter((x) => !x.reenvio)
    const despues = mensajes.slice(indice + 1)
    void preguntar(m.reenvio, leer, previos, despues)
  }

  const escuchar = () => {
    if (escuchando) {
      recRef.current?.stop()
      setEscuchando(false)
      return
    }
    const rec = crearReconocimiento()
    if (!rec) return
    recRef.current = rec
    rec.onresult = (e) => {
      const dicho = e.results[0]?.[0]?.transcript || ''
      setEscuchando(false)
      if (dicho.trim()) void preguntar(dicho, true)
    }
    rec.onerror = () => setEscuchando(false)
    rec.onend = () => setEscuchando(false)
    setEscuchando(true)
    try {
      rec.start()
    } catch {
      setEscuchando(false)
    }
  }

  return (
    <div className="mecbot" data-mecbot="si">
      {abierto && (
        <section className="mecbot__panel" role="dialog" aria-label="MecBot">
          <header className="mecbot__cabeza">
            <strong>MecBot</strong>
            <span>Te guío para estudiar. No resuelvo las tareas.</span>
            <button type="button" className="mecbot__cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar MecBot">
              ✕
            </button>
          </header>
          <div className="mecbot__lista" ref={listaRef}>
            {mensajes.length === 0 && (
              <p className="mecbot__vacio">Pregunta por neumática, PLC, CNC o robótica: un concepto, un símbolo o cómo usar el simulador.</p>
            )}
            {mensajes.map((m, i) => (
              <div key={i} className={`mecbot__turno mecbot__turno--${m.rol}`}>
                <p className={`mecbot__globo mecbot__globo--${m.rol}`}>{m.texto}</p>
                {m.reenvio && (
                  <button
                    type="button"
                    className="mecbot__reenviar"
                    aria-label="Reenviar mensaje"
                    title="Reenviar"
                    disabled={pensando}
                    onClick={() => reenviar(i)}
                  >
                    <IconoReenviar />
                  </button>
                )}
              </div>
            ))}
            {pensando && <p className="mecbot__globo mecbot__globo--mecbot">Estoy pensando…</p>}
          </div>
          <form
            className="mecbot__form"
            onSubmit={(e) => {
              e.preventDefault()
              void preguntar(borrador, leer)
            }}
          >
            <input
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              placeholder={escuchando ? 'Te escucho…' : 'Escribe tu pregunta'}
              aria-label="Pregunta para MecBot"
              maxLength={700}
              disabled={pensando}
            />
            {puedeEscuchar && (
              <button type="button" className="mecbot__icono" aria-pressed={escuchando} onClick={escuchar} title={escuchando ? 'Dejar de escuchar' : 'Hablar'} disabled={pensando}>
                {escuchando ? '●' : '🎤'}
              </button>
            )}
            <button type="submit" className="mecbot__enviar" disabled={pensando || !borrador.trim()}>
              Enviar
            </button>
          </form>
          {puedeHablar && (
            <label className="mecbot__leer">
              <input type="checkbox" checked={leer} onChange={(e) => setLeer(e.target.checked)} />
              Leer la respuesta en voz alta
            </label>
          )}
          <p className="mecbot__aviso">Chat MecBot es una IA y puede cometer errores.</p>
        </section>
      )}
      <button type="button" className="mecbot__abrir" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        MecBot
      </button>
    </div>
  )
}
