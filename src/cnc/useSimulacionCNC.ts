import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { nombreSeguro } from '../exportar'
import type { Estado } from './datosCNC'
import type { VistaCNC } from './Maquina3D'

/** Avanza la simulación mientras la máquina está en ciclo o va bloque a bloque. */
export function useBucleSimulacion({
  estado,
  setEstado,
  velocidad,
  vista,
  setTick,
}: {
  estado: Estado
  setEstado: (e: Estado) => void
  velocidad: number
  vista: MutableRefObject<VistaCNC>
  setTick: (f: (n: number) => number) => void
}) {
  const velRef = useRef(velocidad)
  velRef.current = velocidad
  useEffect(() => {
    if (estado !== 'corriendo' && estado !== 'bloque') return
    let vivo = true
    let antes = performance.now()
    let ultimoPintado = 0
    const bucle = () => {
      if (!vivo) return
      const ahora = performance.now()
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      const r = vista.current.sim.avanzar(dt * velRef.current, estado === 'bloque')
      if (r === 'sigue') {
        if (ahora - ultimoPintado > 90) {
          ultimoPintado = ahora
          setTick((t) => t + 1)
        }
        requestAnimationFrame(bucle)
        return
      }
      setEstado(r === 'fin-bloque' ? 'pausa' : r === 'parada' ? 'parada' : r === 'alarma' ? 'alarma' : 'fin')
      setTick((t) => t + 1)
    }
    requestAnimationFrame(bucle)
    return () => {
      vivo = false
    }
  }, [estado])
}

/** Graba en video el lienzo 3D de la máquina (`captureStream`). */
export function useGrabacionCNC({ nombre, avisar }: { nombre: string | undefined; avisar: (texto: string) => void }) {
  /** Nombre del próximo video (desde «Entregar» se nombra como pide el enunciado). */
  const nombreVideo = useRef<string | null>(null)
  const [grabando, setGrabando] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const grabadora = useRef<MediaRecorder | null>(null)
  const puedeGrabar = typeof window !== 'undefined' && 'MediaRecorder' in window
  const alternarGrabacion = () => {
    if (grabando) {
      grabadora.current?.stop()
      return
    }
    const c = canvasRef.current
    if (!c || !puedeGrabar) {
      avisar('Este navegador no permite grabar video de la vista 3D.')
      return
    }
    const flujo = c.captureStream(30)
    const tipo = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t))
    const rec = new MediaRecorder(flujo, tipo ? { mimeType: tipo, videoBitsPerSecond: 6_000_000 } : undefined)
    const partes: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data)
    rec.onstop = () => {
      setGrabando(false)
      const ext = (rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(partes, { type: rec.mimeType || 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nombreVideo.current ? `${nombreVideo.current}.${ext}` : nombreSeguro(`${nombre || 'simulacion'}_simulacion`, ext)
      nombreVideo.current = null
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      avisar(`Video descargado: ${a.download}`)
    }
    rec.start(500)
    grabadora.current = rec
    setGrabando(true)
    avisar('Grabando la vista 3D. Pulsa ▶ Ciclo para mecanizar y «■ Detener grabación» al terminar.')
  }
  return { grabando, canvasRef, nombreVideo, puedeGrabar, alternarGrabacion }
}
