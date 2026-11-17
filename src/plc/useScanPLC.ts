import type { MutableRefObject } from 'react'
import type { SimPLC } from './Planta3D'
import type { Notacion } from './notacion'
import { ENTRADAS, SALIDAS, estadoInicial, scan, type FlujoEscalon, type ProgramaPLC } from './ladder'
import { PLANTAS } from './plantas'
import { formatear } from './notacion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DT, type Evento } from './datosPLC'

/**
 * El bucle del PLC: pasa a RUN con la memoria limpia, hace un barrido del programa y
 * 20 ms de física de la planta cada 20 ms, anota lo que cambia y permite pausar y
 * ejecutar un barrido a la vez.
 */
export function useScanPLC({
  simRef,
  programaRef,
  forzadosRef,
  notacionRef,
  flujosRef,
  eventosRef,
  avisoPlantaRef,
  corriendo,
  setFotograma,
}: {
  simRef: MutableRefObject<SimPLC>
  programaRef: MutableRefObject<ProgramaPLC>
  forzadosRef: MutableRefObject<Record<string, boolean>>
  notacionRef: MutableRefObject<Notacion>
  flujosRef: MutableRefObject<FlujoEscalon[] | null>
  eventosRef: MutableRefObject<Evento[]>
  avisoPlantaRef: MutableRefObject<{ mensaje: string; hasta: number } | null>
  corriendo: boolean
  setFotograma: (f: (n: number) => number) => void
}) {
  // RUN / STOP: al pasar a RUN el PLC arranca con la memoria limpia.
  const primeraVez = useRef(true)
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    simRef.current.corriendo = corriendo
    simRef.current.estado = estadoInicial()
    flujosRef.current = null
    registrar(corriendo ? 'PLC en RUN: empieza a ejecutar el programa' : 'PLC en STOP: todas las salidas a 0')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corriendo])

  const nombre = useCallback(
    (dir: string) => {
      const s = programaRef.current.simbolos.find((x) => x.dir === dir)
      const d = formatear(dir, notacionRef.current)
      return s?.nombre ? `${s.nombre} (${d})` : d
    },
    [],
  )

  function registrar(mensaje: string, esAviso = false) {
    const lista = eventosRef.current
    lista.push({ t: simRef.current.planta ? (simRef.current.estado.t ?? 0) : 0, mensaje, aviso: esAviso })
    if (lista.length > 60) lista.splice(0, lista.length - 60)
  }

  // Paso a paso: en RUN se puede pausar y ejecutar un barrido a la vez.
  const [pausado, setPausado] = useState(false)
  const pausadoRef = useRef(false)
  pausadoRef.current = pausado
  const barridosRef = useRef(0)
  useEffect(() => {
    if (!corriendo) setPausado(false)
    barridosRef.current = 0
  }, [corriendo])

  // Un paso del bucle: un barrido del PLC (en RUN) y 20 ms de física de la planta.
  const pasoRef = useRef<() => void>(() => {})
  pasoRef.current = () => {
    const sim = simRef.current
    const estado = sim.estado
    const antes = { ...estado.bits }
    const entradas = { ...sim.mandos, ...sim.planta.sensores() }
    // Los pulsadores NC de la planta dan 1 en reposo y 0 al pulsarlos.
    for (const m of PLANTAS[sim.planta.id].mandos) if (m.nc) entradas[m.dir] = !sim.mandos[m.dir]
    if (sim.corriendo) {
      const r = scan(programaRef.current, estado, entradas, DT, forzadosRef.current)
      flujosRef.current = r.flujos
      barridosRef.current++
    } else {
      // En STOP las entradas se siguen viendo, pero las salidas están a 0.
      const fz = forzadosRef.current
      for (const d of ENTRADAS) estado.bits[d] = d in fz ? fz[d] : !!entradas[d]
      for (const d of SALIDAS) estado.bits[d] = d in fz ? fz[d] : false
      estado.t += DT
    }
    const salidas: Record<string, boolean> = {}
    for (const d of SALIDAS) salidas[d] = estado.bits[d]
    sim.planta.paso(salidas, DT)
    // Qué cambió, contado con los nombres de la tabla de símbolos.
    for (const d of [...ENTRADAS, ...SALIDAS]) {
      if (antes[d] !== estado.bits[d]) {
        const n = nombre(d)
        registrar(`${n} ${estado.bits[d] ? 'se activa (1)' : 'se desactiva (0)'}`)
      }
    }
    for (const e of sim.planta.eventos.splice(0)) {
      registrar(`🏭 ${e.mensaje}`, e.aviso)
      if (e.aviso) avisoPlantaRef.current = { mensaje: e.mensaje, hasta: Date.now() + 7000 }
    }
  }

  // El bucle: scan del PLC + física de la planta, 50 veces por segundo (se detiene en pausa).
  useEffect(() => {
    let tiempo = 0
    const id = setInterval(() => {
      if (simRef.current.corriendo && pausadoRef.current) return
      pasoRef.current()
      tiempo += DT
      if (tiempo >= 0.066) {
        tiempo = 0
        setFotograma((f) => f + 1)
      }
    }, DT * 1000)
    return () => clearInterval(id)
  }, [nombre])

  const unBarrido = () => {
    pasoRef.current()
    setFotograma((f) => f + 1)
  }
  return { pausado, setPausado, barridosRef, unBarrido }
}
