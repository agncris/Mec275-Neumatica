import { useEffect, useRef, useState } from 'react'
import { nombreSeguro } from '../exportar'
import type { Simulacion } from './movimiento'

/**
 * El estado de la reproducción de la simulación: si corre, a qué velocidad,
 * el tiempo actual (`tRef`, que no repinta por sí solo: `setTick` lo hace) y la
 * grabación de video del lienzo 3D.
 */
export function useReproduccion({ nombre, avisar }: { nombre: string | undefined; avisar: (texto: string) => void }) {
  const nombreVideo = useRef<string | null>(null)
  const [reproduciendo, setReproduciendo] = useState(false)
  const [velocidad, setVelocidad] = useState(1)
  const [grabando, setGrabando] = useState(false)
  const [, setTick] = useState(0)
  const tRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const grabadora = useRef<MediaRecorder | null>(null)

  const puedeGrabar = typeof window !== 'undefined' && 'MediaRecorder' in window
  const alternarGrabacion = () => {
    if (grabando) return grabadora.current?.stop()
    const c = canvasRef.current
    if (!c || !puedeGrabar) return avisar('Este navegador no permite grabar video.')
    const tipo = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t))
    const rec = new MediaRecorder(c.captureStream(30), tipo ? { mimeType: tipo, videoBitsPerSecond: 6_000_000 } : undefined)
    const partes: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data)
    rec.onstop = () => {
      setGrabando(false)
      const ext = (rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm'
      const url = URL.createObjectURL(new Blob(partes, { type: rec.mimeType || 'video/webm' }))
      const a = document.createElement('a')
      a.href = url
      a.download = nombreVideo.current ? `${nombreVideo.current}.${ext}` : nombreSeguro(`${nombre || 'robot'}_simulacion`, ext)
      nombreVideo.current = null
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      avisar(`Video descargado: ${a.download}`)
    }
    rec.start(500)
    grabadora.current = rec
    setGrabando(true)
    avisar('Grabando la vista 3D: pulsa ▶ y «■ Detener grabación» al terminar.')
  }

  // La grabación que parte desde Entregar se detiene sola cuando termina el recorrido:
  // así el alumno no tiene que acordarse de pulsar «Detener grabación».
  const corrioGrabando = useRef(false)
  useEffect(() => {
    if (!grabando) {
      corrioGrabando.current = false
      return
    }
    if (reproduciendo) {
      corrioGrabando.current = true
      return
    }
    if (corrioGrabando.current && nombreVideo.current) {
      corrioGrabando.current = false
      // Un segundo más, para que el último cuadro quede en el video.
      const reloj = setTimeout(() => grabadora.current?.state === 'recording' && grabadora.current.stop(), 1000)
      return () => clearTimeout(reloj)
    }
  }, [grabando, reproduciendo])

  return { reproduciendo, setReproduciendo, velocidad, setVelocidad, grabando, setTick, tRef, canvasRef, nombreVideo, puedeGrabar, alternarGrabacion }
}

/** Avanza el tiempo mientras se reproduce. Se detiene solo al llegar al final. */
export function useBucleReproduccion({
  reproduciendo,
  setReproduciendo,
  simActiva,
  velocidad,
  tRef,
  setTick,
  aplicarTiempo,
}: {
  reproduciendo: boolean
  setReproduciendo: (v: boolean) => void
  simActiva: Simulacion | null
  velocidad: number
  tRef: { current: number }
  setTick: (f: (n: number) => number) => void
  aplicarTiempo: (t: number) => void
}) {
  const velRef = useRef(velocidad)
  velRef.current = velocidad
  useEffect(() => {
    if (!reproduciendo || !simActiva) return
    let vivo = true
    let antes = performance.now()
    let ultimo = 0
    const bucle = () => {
      if (!vivo) return
      const ahora = performance.now()
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      tRef.current = Math.min(simActiva.tiempo, tRef.current + dt * velRef.current)
      aplicarTiempo(tRef.current)
      if (ahora - ultimo > 100) {
        ultimo = ahora
        setTick((n) => n + 1)
      }
      if (tRef.current >= simActiva.tiempo) {
        setReproduciendo(false)
        setTick((n) => n + 1)
        return
      }
      requestAnimationFrame(bucle)
    }
    requestAnimationFrame(bucle)
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reproduciendo, simActiva])
}
