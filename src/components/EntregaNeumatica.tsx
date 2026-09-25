/**
 * Entregar la tarea de neumática. Lo que va en la plantilla del profesor:
 *   · el diagrama de funcionamiento VDI 2860 (se arma aquí y se descarga),
 *   · el diagrama espacio-fase de la simulación,
 *   · la lista de elementos del circuito,
 *   · la imagen del circuito.
 * Y el archivo del circuito, que se sube junto con el PDF y se vuelve a abrir
 * (y a simular) en la app.
 */
import { useRef, useState } from 'react'
import { analizarCircuito, inventarioDe } from '../engine'
import { crearEntrega } from '../entrega'
import { copiarTabla, descargarDataUrl, descargarTexto } from '../entregar'
import { exportarPng } from '../exportar'
import { rotuloPieza } from '../rotulos'
import { circuitoDesdeStore, useStore } from '../store'
import { FUNCIONES_VDI, SimboloVDI } from '../symbols/SimbolosVDI'
import CajonEntregar, { type PuntoRevision } from './banco/CajonEntregar'

interface Props {
  onCerrar: () => void
  capturarCircuito: () => Promise<string | { error: string }>
  capturarFase: () => Promise<string | { error: string }>
}

export default function EntregaNeumatica({ onCerrar, capturarCircuito, capturarFase }: Props) {
  const piezas = useStore((s) => s.piezas)
  const mangueras = useStore((s) => s.mangueras)
  const respuestas = useStore((s) => s.respuestas)
  const setRespuestas = useStore((s) => s.setRespuestas)
  const vdiRef = useRef<SVGSVGElement>(null)

  const imagen = async (capturar: () => Promise<string | { error: string }>, nombre: string) => {
    const r = await capturar()
    if (typeof r !== 'string') throw new Error(r.error)
    await descargarDataUrl(r, nombre)
    return `Descargada: ${nombre}. Pégala en tu presentación.`
  }

  const revisar = (): PuntoRevision[] => {
    const a = analizarCircuito(circuitoDesdeStore(piezas, mangueras))
    if (piezas.length === 0) return [{ ok: false, texto: 'Todavía no hay circuito en el banco.' }]
    return [
      {
        ok: a.erroresMontaje.length === 0,
        texto: a.erroresMontaje.length === 0 ? 'El circuito está bien montado: no hay puertos sueltos ni piezas mal configuradas.' : `Hay ${a.erroresMontaje.length} problema(s) de montaje. El primero: ${a.erroresMontaje[0]}`,
      },
      {
        ok: a.mandosManuales.length > 0,
        texto: a.mandosManuales.length > 0 ? 'Tiene una válvula de inicio (mando manual).' : 'No hay válvula de inicio: agrega una 3/2 con pulsador o con enclavamiento para arrancar el ciclo.',
      },
      {
        ok: !a.sinMovimiento,
        texto: a.sinMovimiento ? 'Al pulsar el inicio ningún actuador se mueve. Revisa la alimentación y los pilotajes.' : `Al pulsar el inicio se mueven los actuadores: ${a.secuenciaDetectada.slice(0, 12).join(' ') || '—'}`,
      },
      {
        ok: a.conflictos.length === 0,
        texto: a.conflictos.length === 0 ? 'Ninguna válvula recibe dos pilotajes opuestos a la vez.' : `Señales bloqueantes en: ${a.conflictos.join(', ')}. Revisa el método cascada.`,
      },
      {
        ok: a.cicloCompleto,
        texto: a.cicloCompleto ? 'El ciclo se cierra y se repite solo.' : 'El ciclo no se repite solo. Si el enunciado pide funcionamiento automático, revisa qué señal devuelve el sistema al primer grupo.',
      },
      {
        ok: (respuestas.vdi?.length ?? 0) > 0,
        texto: (respuestas.vdi?.length ?? 0) > 0 ? `Diagrama VDI armado con ${respuestas.vdi.length} funciones.` : 'Aún no armas el diagrama VDI (abajo).',
      },
    ]
  }

  const vdi = respuestas.vdi ?? []
  const [eligiendo, setEligiendo] = useState(false)
  const setVdi = (v: typeof vdi) => setRespuestas({ vdi: v })

  // Lámina del diagrama VDI para exportar: los símbolos en fila, unidos por flechas.
  const ANCHO_FICHA = 130
  const laminaVdi = (
    <svg ref={vdiRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${Math.max(1, vdi.length) * ANCHO_FICHA + 20} 200`} width={Math.max(1, vdi.length) * ANCHO_FICHA + 20} height={200} style={{ position: 'absolute', left: -99999, top: 0 }} aria-hidden>
      <rect width="100%" height="100%" fill="#fff" />
      {vdi.map((p, i) => {
        const f = FUNCIONES_VDI.find((x) => x.n === p.n)
        const x = 10 + i * ANCHO_FICHA
        return (
          <g key={i}>
            <g transform={`translate(${x + 20} 20) scale(0.9)`}>
              <SimboloVDI n={p.n} grupo />
            </g>
            {i < vdi.length - 1 && (
              <g>
                <line x1={x + 112} y1={65} x2={x + 128} y2={65} stroke="#14181d" strokeWidth={2} />
                <polygon points={`${x + 128},65 ${x + 121},60 ${x + 121},70`} fill="#14181d" />
              </g>
            )}
            <text x={x + 65} y={130} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1c2733" fontFamily="sans-serif">
              {i + 1}. {(f?.nombre ?? '').replace(/ \(.*\)$/, '')}
            </text>
            <text x={x + 65} y={150} textAnchor="middle" fontSize={11} fill="#33475c" fontFamily="sans-serif">
              {p.nota}
            </text>
          </g>
        )
      })}
    </svg>
  )

  const armadorVdi = (
    <div data-armador-vdi="si">
      <p style={pie}>
        Pon una función por cada cosa que hace la máquina, en orden, y anota a qué corresponde. La tabla completa está en «Estudiar › Simbología VDI 2860». Luego descárgalo en el paso siguiente.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {vdi.map((paso, i) => {
          const f = FUNCIONES_VDI.find((x) => x.n === paso.n)
          return (
            <div key={i} style={ficha}>
              <div style={{ width: 44, height: 44, margin: '0 auto' }}>
                <SimboloVDI n={paso.n} />
              </div>
              <div style={{ fontSize: '0.66rem', color: '#51606f', minHeight: '2.2em', lineHeight: 1.25 }}>{f?.nombre}</div>
              <input
                value={paso.nota}
                onChange={(e) => setVdi(vdi.map((q, k) => (k === i ? { ...q, nota: e.target.value } : q)))}
                placeholder="¿qué hace?"
                aria-label={`Nota de la función ${i + 1}`}
                style={{ width: '100%', fontSize: '0.72rem', padding: '0.2rem 0.3rem', border: '1px solid #c6ced6', borderRadius: 5 }}
              />
              <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 3 }}>
                <button onClick={() => i > 0 && setVdi(vdi.map((q, k) => (k === i - 1 ? vdi[i] : k === i ? vdi[i - 1] : q)))} style={mini} aria-label="Mover antes">
                  ←
                </button>
                <button onClick={() => i < vdi.length - 1 && setVdi(vdi.map((q, k) => (k === i + 1 ? vdi[i] : k === i ? vdi[i + 1] : q)))} style={mini} aria-label="Mover después">
                  →
                </button>
                <button onClick={() => setVdi(vdi.filter((_, k) => k !== i))} style={{ ...mini, color: '#b3261e' }} aria-label="Quitar">
                  ✕
                </button>
              </div>
            </div>
          )
        })}
        <button onClick={() => setEligiendo((v) => !v)} style={{ ...ficha, cursor: 'pointer', color: '#33475c' }} aria-expanded={eligiendo} data-agregar-vdi="si">
          <div style={{ fontSize: '1.5rem', lineHeight: 1.5 }}>＋</div>
          <div style={{ fontSize: '0.72rem' }}>Añadir función</div>
        </button>
      </div>
      {eligiendo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 5, padding: 8, border: '1px solid #dbe1e8', borderRadius: 8, marginTop: 8, maxHeight: 260, overflowY: 'auto' }}>
          {FUNCIONES_VDI.map((f) => (
            <button
              key={f.n}
              onClick={() => {
                setVdi([...vdi, { n: f.n, nota: '' }])
                setEligiendo(false)
              }}
              style={{ ...ficha, width: 'auto', cursor: 'pointer' }}
              data-vdi={f.n}
            >
              <div style={{ width: 36, height: 36, margin: '0 auto' }}>
                <SimboloVDI n={f.n} />
              </div>
              <div style={{ fontSize: '0.64rem', color: '#33475c', lineHeight: 1.25 }}>{f.nombre}</div>
            </button>
          ))}
        </div>
      )}
      {laminaVdi}
    </div>
  )

  return (
    <CajonEntregar
      unidad="Neumática"
      clave="neumalab.neumatica.entrega"
      trabajoSugerido="Trabajo-1"
      onCerrar={onCerrar}
      revisar={revisar}
      extra={{ titulo: 'Diagrama de funcionamiento VDI 2860', contenido: armadorVdi }}
      presentacion={[
        {
          id: 'vdi',
          tipo: 'imagen',
          titulo: 'Diagrama VDI 2860',
          detalle: 'Las funciones que armaste arriba, en orden y con tus notas.',
          deshabilitado: vdi.length === 0,
          porque: 'Primero arma el diagrama VDI (arriba).',
          hacer: async (base) => {
            if (!vdiRef.current) throw new Error('No se pudo dibujar el diagrama.')
            await exportarPng(vdiRef.current, `${base}_diagrama-VDI.png`)
            return `Descargada: ${base}_diagrama-VDI.png`
          },
        },
        {
          id: 'fase',
          tipo: 'imagen',
          titulo: 'Diagrama espacio-fase',
          detalle: 'Sale de la simulación: pulsa ▶ Simular y deja que el ciclo corra al menos una vez.',
          hacer: (base) => imagen(capturarFase, `${base}_diagrama-fase.png`),
        },
        {
          id: 'elementos',
          tipo: 'tabla',
          titulo: 'Elementos del circuito',
          detalle: 'Cantidad y tipo de cada elemento de tu circuito.',
          deshabilitado: piezas.length === 0,
          porque: 'Primero arma el circuito.',
          hacer: async () => {
            const inv = inventarioDe(circuitoDesdeStore(piezas, mangueras))
            const filas = [['Cantidad', 'Elemento', 'En el esquema'], ...inv.map((e) => [String(e.cantidad), e.nombre, piezas.filter((p) => p.tipo === e.tipo).map((p) => rotuloPieza(p, piezas)).join(', ')])]
            return (await copiarTabla(filas)) ? 'Tabla copiada: pégala en tu presentación (Ctrl+V).' : 'Tu navegador no dejó copiar. Prueba con otro navegador.'
          },
        },
        {
          id: 'circuito-png',
          tipo: 'imagen',
          titulo: 'Imagen del circuito',
          detalle: 'El esquema tal como está en el banco.',
          hacer: (base) => imagen(capturarCircuito, `${base}_circuito.png`),
        },
      ]}
      archivos={[
        {
          id: 'circuito',
          tipo: 'archivo',
          titulo: 'Tu circuito (NeumaLab)',
          detalle: 'Se abre en la app con Archivo › Abrir y se puede simular. Incluye tu diagrama VDI.',
          deshabilitado: piezas.length === 0,
          porque: 'Primero arma el circuito.',
          hacer: (base) => {
            const alumno = JSON.parse(localStorage.getItem('neumalab.alumno') ?? '{}') as { nombre?: string }
            const entrega = crearEntrega({ nombre: alumno.nombre ?? '', rol: '' }, base, respuestas, { piezas, mangueras })
            descargarTexto(JSON.stringify(entrega, null, 2), `${base}.json`, 'application/json')
            return `Descargado: ${base}.json`
          },
        },
      ]}
    />
  )
}

const pie: React.CSSProperties = { margin: '0 0 8px', fontSize: '0.82rem', color: '#51606f', lineHeight: 1.5 }
const ficha: React.CSSProperties = { width: 104, border: '1px solid #dbe1e8', borderRadius: 8, padding: '5px 4px', background: '#fff', textAlign: 'center' }
const mini: React.CSSProperties = { border: '1px solid #dbe1e8', background: '#fff', borderRadius: 4, fontSize: '0.72rem', padding: '0 5px', cursor: 'pointer', color: '#33475c', minHeight: 22 }
