/**
 * Panel "Vista en corte": muestra el interior animado del componente elegido.
 * En modo Simular se sincroniza con el motor (posiciones y presiones reales).
 * En modo Editar permite explorar la pieza: mantener accionada una válvula, o
 * meterle aire a un cilindro para ver cómo se desplaza el émbolo.
 */
import { useEffect, useRef, useState } from 'react'
import type { Motor } from '../engine'
import { CorteCilindroDoble, CorteCilindroSimple } from '../realistic/CortesCilindro'
import { CorteValvula32, CorteValvula42, CorteValvula52 } from '../realistic/CortesValvula'
import { DESCRIPTORES } from './descriptores'
import { useStore, type Pieza } from '../store'

const CON_CORTE = [
  'valvula32',
  'valvula42',
  'valvula52',
  'cilindroSimpleEfecto',
  'cilindroDobleEfecto',
]

const PUERTOS: Record<string, string[]> = {
  valvula32: ['1', '2', '3'],
  valvula42: ['1', '2', '3', '4', '12', '14'],
  valvula52: ['1', '2', '3', '4', '5', '12', '14'],
  cilindroSimpleEfecto: ['1'],
  cilindroDobleEfecto: ['A', 'B'],
}

const esValvula = (tipo: string) => tipo.startsWith('valvula')

export default function VistaCorte({ motor }: { motor: Motor | null }) {
  const piezas = useStore((s) => s.piezas)
  const seleccion = useStore((s) => s.seleccion)
  const disponibles = piezas.filter((p) => CON_CORTE.includes(p.tipo))

  const [idElegida, setIdElegida] = useState<string | null>(null)
  const [accionadaDemo, setAccionadaDemo] = useState(false)
  const [posDemo, setPosDemo] = useState(0)
  const [aireDemo, setAireDemo] = useState<'A' | 'B' | null>(null)

  // La pieza seleccionada en la pizarra manda; si no, la última elegida aquí
  const idSeleccionada =
    seleccion?.clase === 'pieza' && disponibles.some((p) => p.id === seleccion.id) ? seleccion.id : null
  const pieza: Pieza | undefined =
    disponibles.find((p) => p.id === (idSeleccionada ?? idElegida)) ?? disponibles[0]

  const enVivo = motor !== null && pieza !== undefined && motor.circuito.componentes.some((c) => c.id === pieza.id)

  // Al cambiar de componente, la demostración vuelve a su estado de reposo
  useEffect(() => {
    setAccionadaDemo(false)
    setAireDemo(null)
    setPosDemo(0)
  }, [pieza?.id])

  // Animación del émbolo en la demo de modo Editar. El intervalo se detiene al
  // llegar al destino: sin esto la página nunca dejaría de repintarse.
  const posRef = useRef(0)
  posRef.current = posDemo
  useEffect(() => {
    if (enVivo || !pieza || esValvula(pieza.tipo)) return
    const simple = pieza.tipo === 'cilindroSimpleEfecto'
    const objetivo = simple ? (accionadaDemo ? 1 : 0) : aireDemo === 'A' ? 1 : aireDemo === 'B' ? 0 : null
    if (objetivo === null || Math.abs(objetivo - posRef.current) < 1e-3) return

    let pos = posRef.current
    const paso = 0.028
    const id = setInterval(() => {
      if (Math.abs(objetivo - pos) < paso) {
        setPosDemo(objetivo)
        clearInterval(id)
        return
      }
      pos += Math.sign(objetivo - pos) * paso
      setPosDemo(pos)
    }, 33)
    return () => clearInterval(id)
  }, [enVivo, pieza, accionadaDemo, aireDemo])

  if (!pieza) return null

  const { tipo, params } = pieza
  const biestable = params.modo === 'biestable'
  const pilotaje = biestable || params.accionamiento === 'pilotaje'
  const na = params.reposo === 'NA'

  // ---- estado a dibujar: real (motor) o de demostración ----
  let accionada = accionadaDemo
  let posicion = posDemo
  const presiones: Record<string, number> = {}

  if (enVivo && motor) {
    for (const p of PUERTOS[tipo] ?? []) presiones[p] = motor.presionEn(pieza.id, p)
    const estado = motor.estadoDe<{ accionada?: boolean; posicion?: number }>(pieza.id)
    accionada = estado.accionada ?? false
    posicion = estado.posicion ?? 0
  } else if (tipo === 'valvula32') {
    const abierta = na ? !accionada : accionada
    Object.assign(presiones, { '1': 6, '2': abierta ? 6 : 0, '3': 0 })
  } else if (tipo === 'valvula42' || tipo === 'valvula52') {
    Object.assign(presiones, {
      '1': 6,
      '2': accionada ? 0 : 6,
      '4': accionada ? 6 : 0,
      '3': 0,
      '5': 0,
      '14': pilotaje && accionada ? 6 : 0,
      '12': 0,
    })
  } else if (tipo === 'cilindroSimpleEfecto') {
    presiones['1'] = accionadaDemo ? 6 : 0
  } else {
    presiones['A'] = aireDemo === 'A' ? 6 : 0
    presiones['B'] = aireDemo === 'B' ? 6 : 0
  }

  // ---- explicación contextual ----
  let leyenda: string
  if (tipo === 'valvula32') {
    const abierta = na ? !accionada : accionada
    leyenda = abierta
      ? 'El vástago está abajo: la junta inferior se separa de su asiento y el aire pasa de 1 a 2. Arriba, la otra junta cierra el escape 3.'
      : 'El muelle mantiene el vástago arriba: la junta inferior cierra la alimentación 1, y la salida 2 se vacía a la atmósfera por 3.'
  } else if (tipo === 'valvula42') {
    leyenda = accionada
      ? 'La corredera se ha desplazado: alimenta 1→4 y devuelve el aire de 2 al escape común 3.'
      : 'En reposo la corredera alimenta 1→2 y comunica 4 con el escape común 3.'
  } else if (tipo === 'valvula52') {
    leyenda = accionada
      ? 'La corredera se ha desplazado: alimenta 1→4 y el aire de 2 sale por el escape 3.'
      : 'En reposo la corredera alimenta 1→2 y el aire de 4 sale por el escape 5.'
  } else if (tipo === 'cilindroSimpleEfecto') {
    leyenda =
      (presiones['1'] ?? 0) > 0.1
        ? 'Entra aire por el único orificio: la presión empuja el émbolo y comprime el muelle.'
        : 'Sin presión, el muelle empuja el émbolo de vuelta y el aire sale por el mismo orificio.'
  } else {
    const pA = presiones['A'] ?? 0
    const pB = presiones['B'] ?? 0
    leyenda =
      pA > pB + 0.3
        ? 'Entra aire por A: empuja el émbolo hacia fuera mientras la cámara B se vacía por su orificio.'
        : pB > pA + 0.3
          ? 'Entra aire por B: el émbolo retrocede mientras la cámara A se vacía.'
          : 'Sin diferencia de presión entre A y B el émbolo se queda quieto.'
  }

  return (
    <div>
      {/* selector de componente */}
      {disponibles.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {disponibles.map((p) => {
            const activa = p.id === pieza.id
            return (
              <button
                key={p.id}
                onClick={() => {
                  setIdElegida(p.id)
                  useStore.getState().seleccionar(null)
                }}
                style={{
                  border: `1px solid ${activa ? '#33475c' : '#c6ced6'}`,
                  background: activa ? '#33475c' : '#fff',
                  color: activa ? '#fff' : '#33475c',
                  borderRadius: 999,
                  padding: '0.22rem 0.7rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {p.id}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.92rem', color: '#33475c' }}>
          {pieza.id} — {DESCRIPTORES[tipo]?.nombre}
          {tipo === 'valvula32' ? (na ? ' NA' : ' NC') : ''}
          {esValvula(tipo) && tipo !== 'valvula32' ? (biestable ? ' biestable' : ' monoestable') : ''}
        </strong>

        {enVivo ? (
          <span style={{ fontSize: '0.8rem', color: '#12a35a', fontWeight: 600 }}>
            ● sincronizada con la simulación
          </span>
        ) : esValvula(tipo) ? (
          <button
            onPointerDown={() => {
              setAccionadaDemo(true)
              // Escuchador global: así se suelta aunque el puntero salga del botón
              window.addEventListener('pointerup', () => setAccionadaDemo(false), { once: true })
            }}
            style={{ ...botonDemo, background: accionadaDemo ? '#0a8a4a' : '#12a35a' }}
          >
            Accionar (mantener)
          </button>
        ) : tipo === 'cilindroSimpleEfecto' ? (
          <button
            onClick={() => setAccionadaDemo((v) => !v)}
            style={{ ...botonDemo, background: accionadaDemo ? '#1668c7' : '#8a97a5' }}
          >
            {accionadaDemo ? 'Con aire' : 'Sin aire'}
          </button>
        ) : (
          <span style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setAireDemo('A')}
              style={{ ...botonDemo, background: aireDemo === 'A' ? '#1668c7' : '#8a97a5' }}
            >
              Aire por A
            </button>
            <button
              onClick={() => setAireDemo('B')}
              style={{ ...botonDemo, background: aireDemo === 'B' ? '#1668c7' : '#8a97a5' }}
            >
              Aire por B
            </button>
          </span>
        )}
      </div>

      <div style={{ maxWidth: tipo === 'valvula32' ? 290 : 430, margin: '0 auto' }}>
        {tipo === 'valvula32' && <CorteValvula32 accionada={accionada} presiones={presiones} na={na} />}
        {tipo === 'valvula42' && <CorteValvula42 accionada={accionada} presiones={presiones} pilotaje={pilotaje} />}
        {tipo === 'valvula52' && (
          <CorteValvula52 accionada={accionada} presiones={presiones} biestable={biestable} pilotaje={pilotaje} />
        )}
        {tipo === 'cilindroSimpleEfecto' && <CorteCilindroSimple posicion={posicion} presiones={presiones} />}
        {tipo === 'cilindroDobleEfecto' && <CorteCilindroDoble posicion={posicion} presiones={presiones} />}
      </div>

      <p style={{ margin: '8px 0 0', fontSize: '0.86rem', color: '#33475c', lineHeight: 1.5 }}>{leyenda}</p>
      <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#5a6b7d' }}>
        <span style={{ color: '#1f7bd4', fontWeight: 700 }}>■</span> aire a presión ·{' '}
        <span style={{ color: '#8fc7ea', fontWeight: 700 }}>■</span> comunicado con la atmósfera
      </p>
    </div>
  )
}

const botonDemo: React.CSSProperties = {
  border: 'none',
  color: '#fff',
  borderRadius: 6,
  padding: '0.3rem 0.7rem',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
  touchAction: 'none',
}
