import { botonPrimario, botonSecundario } from '../components/ui'
import { TituloArea } from '../components/banco/BancoDividido'
import EditorNodos from './EditorNodos'
import Mando, { type PuntoEnsenado } from './Mando'
import { Propiedades } from './PanelParametros'
import type { PasoTarea } from './guiaTarea'
import type { Modo } from './datosRobot'
import type { Definicion, Herramienta, evaluar } from './nodos'
import type { robotPorId } from './robots'
import type { MutableRefObject } from 'react'

/** El panel izquierdo: el lienzo de nodos con sus propiedades, o el mando manual. */
export default function AreaPrograma({
  modo,
  def,
  setDef,
  evaluacion,
  dxfCapas,
  seleccion,
  setSeleccion,
  nodoSel,
  pasoTarea,
  enunciado,
  setEnunciado,
  ejemploEnTarea,
  entregando = false,
  volverDelEjemplo,
  seguirConElEjemplo,
  deshacer,
  puedeDeshacer,
  setPlegado,
  modeloM,
  herrMando,
  qMando,
  setQMando,
  setModeloMando,
  puntos,
  setPuntos,
  reproduciendo,
  setReproduciendo,
  tRef,
  exportarKRL,
}: {
  modo: Modo
  def: Definicion
  setDef: (d: Definicion) => void
  evaluacion: ReturnType<typeof evaluar>
  dxfCapas: string[]
  seleccion: string | null
  setSeleccion: (id: string | null) => void
  nodoSel: Definicion['nodos'][number] | null
  pasoTarea: PasoTarea | null
  enunciado: string | null
  setEnunciado: (t: string | null) => void
  ejemploEnTarea: boolean
  /** El cajón de Entregar está abierto. */
  entregando?: boolean
  volverDelEjemplo: () => void
  seguirConElEjemplo: () => void
  deshacer: () => void
  puedeDeshacer: boolean
  setPlegado: (p: 'abierto' | 'riel' | 'oculto') => void
  modeloM: ReturnType<typeof robotPorId>
  herrMando: Herramienta
  qMando: number[]
  setQMando: (q: number[]) => void
  setModeloMando: (id: string) => void
  puntos: PuntoEnsenado[]
  setPuntos: (p: PuntoEnsenado[]) => void
  reproduciendo: boolean
  setReproduciendo: (v: boolean) => void
  tRef: MutableRefObject<number>
  exportarKRL: () => void
}) {
  return (
  modo === 'visual' ? (
    <>
      <TituloArea
        derecha={
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="boton-icono" title="Colapsar el programa" aria-label="Colapsar el programa" onClick={() => setPlegado('riel')}>
              «
            </button>
          </span>
        }
      >
        Programa
        {def.dxf ? <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--tinta-suave)' }}>· {def.dxf.nombre}</span> : null}
      </TituloArea>
      {enunciado && (
        <p data-enunciado="si" style={{ margin: '0 0 6px', padding: '6px 10px', background: '#eef4fb', border: '1px solid #c9d9ee', borderRadius: 6, fontSize: '0.84rem', color: 'var(--texto)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span className="u-flex-1">{enunciado}</span>
          <button onClick={() => setEnunciado(null)} aria-label="Ocultar el enunciado" title="Ocultar el enunciado" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>
            ✕
          </button>
        </p>
      )}
      {ejemploEnTarea && (
        <div className="tarea-ejemplo" data-ejemplo-tarea="si">
          <p>
            <strong>Esto es un ejemplo del contorno, no tu entrega.</strong> Curve en CONTORNO, Offset +2,5, Move en Z −5 y Toolpath. Las ranuras no están. Tu tarea sigue guardada.
          </p>
          <span>
            <button type="button" onClick={volverDelEjemplo} style={botonPrimario()} data-volver-tarea="si">
              Volver a mi tarea
            </button>
            <button type="button" onClick={seguirConElEjemplo} style={botonSecundario} data-seguir-ejemplo="si" title="Deja este contorno en tu tarea, en lugar de lo que tenías">
              Seguir con este contorno
            </button>
          </span>
        </div>
      )}
      <div className="relleno">
        <EditorNodos def={def} evaluacion={evaluacion} onCambiar={setDef} seleccion={seleccion} onSeleccionar={setSeleccion} alto="100%" guia={ejemploEnTarea ? undefined : (pasoTarea ?? undefined)} mirandoEjemplo={ejemploEnTarea} soloLienzo={entregando} onDeshacer={deshacer} puedeDeshacer={puedeDeshacer} />
      </div>
      {evaluacion.ciclo && <p style={{ color: 'var(--rojo-error)', fontSize: '0.86rem', margin: '6px 0 0' }}>⚠ Hay un ciclo en los cables.</p>}
      <div style={{ maxHeight: 150, overflow: 'auto', flex: 'none' }}>
        <Propiedades
          key={nodoSel?.id ?? 'nada'}
          nodo={nodoSel}
          evaluacion={evaluacion}
          onParam={(clave, valor) => nodoSel && setDef({ ...def, nodos: def.nodos.map((n) => (n.id === nodoSel.id ? { ...n, params: { ...n.params, [clave]: valor } } : n)) })}
          onBorrar={() => {
            if (!nodoSel) return
            setDef({ ...def, nodos: def.nodos.filter((n) => n.id !== nodoSel.id), cables: def.cables.filter((c) => c.de !== nodoSel.id && c.a !== nodoSel.id) })
            setSeleccion(null)
          }}
          onDuplicar={() => {
            if (!nodoSel) return
            let k = 1
            while (def.nodos.some((n) => n.id === `${nodoSel.id}_${k}`)) k++
            const id = `${nodoSel.id}_${k}`
            setDef({ ...def, nodos: [...def.nodos, { ...nodoSel, id, x: nodoSel.x + 30, y: nodoSel.y + 30, params: { ...nodoSel.params } }] })
            setSeleccion(id)
          }}
          capas={dxfCapas}
          enfocar={pasoTarea?.enfocar}
          cables={nodoSel ? def.cables.filter((c) => c.a === nodoSel.id) : []}
          onDesconectar={(c) => setDef({ ...def, cables: def.cables.filter((k) => k !== c) })}
        />
      </div>
    </>
  ) : (
    <>
    <TituloArea
      derecha={
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" className="boton-icono" title="Colapsar el mando" aria-label="Colapsar el mando" onClick={() => setPlegado('riel')}>
            «
          </button>
        </span>
      }
    >
      Mando manual
    </TituloArea>
    <Mando
      modelo={modeloM}
      herramienta={herrMando}
      pedestal={0}
      q={qMando}
      onQ={(q) => {
        setReproduciendo(false)
        setQMando(q)
      }}
      puntos={puntos}
      onPuntos={(p) => {
        setReproduciendo(false)
        setPuntos(p)
      }}
      onModelo={(id) => {
        setModeloMando(id)
        setQMando([0, -80, 100, 0, 60, 0])
        setPuntos([])
      }}
      reproduciendo={reproduciendo}
      onReproducir={() => {
        if (reproduciendo) return setReproduciendo(false)
        tRef.current = 0
        setReproduciendo(true)
      }}
      onExportar={exportarKRL}
    />
    </>
  )
  )
}
