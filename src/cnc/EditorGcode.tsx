/**
 * Editor de código G con números de línea y colores: cada tipo de palabra
 * (N, G, M, coordenadas, arcos, F/S, T, comentarios) tiene su color, la línea
 * que está ejecutando la máquina se marca en amarillo y las que tienen
 * errores o avisos en rojo o ámbar.
 *
 * Es un <textarea> normal (se puede pegar, deshacer con Ctrl+Z, etc.) con el
 * texto coloreado dibujado detrás.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react'
import type { Diagnostico } from './gcode'

export interface EditorGcodeRef {
  irALinea: (n: number) => void
}

const ALTO_LINEA = 20
const PAD = 8

const COLORES: Record<string, string> = {
  N: '#8a97a5',
  G: '#1668c7',
  M: '#8e3fb8',
  T: '#9c5a12',
  F: '#c75d00',
  S: '#c75d00',
  X: '#18794e',
  Y: '#18794e',
  Z: '#18794e',
  U: '#2f9e6a',
  V: '#2f9e6a',
  W: '#2f9e6a',
  I: '#0f8b8d',
  J: '#0f8b8d',
  K: '#0f8b8d',
  R: '#0f8b8d',
}

function colorear(linea: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\([^)]*\)?|;.*$|\/\/.*$|^\s*%.*$|^\s*\$.*$|[A-Za-z]\s*[+-]?(?:\d+\.?\d*|\.\d+)|\s+|.)/g
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(linea))) {
    const t = m[0]
    if (!t) break
    let estilo: React.CSSProperties | undefined
    if (t.startsWith('(') || t.startsWith(';') || t.startsWith('//')) estilo = { color: '#7b8794', fontStyle: 'italic' }
    else if (/^\s*[%$]/.test(t)) estilo = { color: '#5f6b78' }
    else if (/^[A-Za-z]/.test(t)) {
      const c = COLORES[t[0].toUpperCase()]
      estilo = { color: c ?? '#1c2733', fontWeight: t[0].toUpperCase() === 'G' || t[0].toUpperCase() === 'M' ? 700 : 500 }
    }
    out.push(
      <span key={k++} style={estilo}>
        {t}
      </span>,
    )
  }
  return out
}

interface Props {
  codigo: string
  onCambiar: (c: string) => void
  lineaActiva: number | null
  diagnosticos: Diagnostico[]
  onCursor: (n: number) => void
  soloLectura?: boolean
  /** En píxeles, o '100%' para llenar el área. */
  alto?: number | string
}

const EditorGcode = forwardRef<EditorGcodeRef, Props>(function EditorGcode(
  { codigo, onCambiar, lineaActiva, diagnosticos, onCursor, soloLectura, alto = 420 },
  ref,
) {
  const area = useRef<HTMLTextAreaElement>(null)
  const fondo = useRef<HTMLDivElement>(null)
  const margen = useRef<HTMLDivElement>(null)
  const lineas = useMemo(() => codigo.split('\n'), [codigo])
  const nivelDe = useMemo(() => {
    const m = new Map<number, 'error' | 'aviso' | 'info'>()
    for (const d of diagnosticos) {
      const previo = m.get(d.linea)
      if (!previo || d.nivel === 'error' || (d.nivel === 'aviso' && previo === 'info')) m.set(d.linea, d.nivel)
    }
    return m
  }, [diagnosticos])

  const sincronizar = () => {
    const a = area.current
    if (!a) return
    if (fondo.current) {
      fondo.current.style.transform = `translate(${-a.scrollLeft}px, ${-a.scrollTop}px)`
    }
    if (margen.current) margen.current.style.transform = `translateY(${-a.scrollTop}px)`
  }

  const avisarCursor = () => {
    const a = area.current
    if (!a) return
    const n = a.value.slice(0, a.selectionStart).split('\n').length - 1
    onCursor(n)
  }

  useImperativeHandle(ref, () => ({
    irALinea(n: number) {
      const a = area.current
      if (!a) return
      const ls = a.value.split('\n')
      let ini = 0
      for (let i = 0; i < n && i < ls.length; i++) ini += ls[i].length + 1
      a.focus()
      a.setSelectionRange(ini, ini + (ls[n]?.length ?? 0))
      a.scrollTop = Math.max(0, n * ALTO_LINEA - a.clientHeight / 2)
      sincronizar()
      onCursor(n)
    },
  }))

  // Mientras corre, la línea activa queda a la vista.
  useEffect(() => {
    const a = area.current
    if (!a || lineaActiva === null) return
    const y = lineaActiva * ALTO_LINEA + PAD
    if (y < a.scrollTop + ALTO_LINEA || y > a.scrollTop + a.clientHeight - ALTO_LINEA * 2) {
      a.scrollTop = Math.max(0, y - a.clientHeight / 3)
      sincronizar()
    }
  }, [lineaActiva])

  const fuente: React.CSSProperties = {
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
    fontSize: 13,
    lineHeight: `${ALTO_LINEA}px`,
    tabSize: 4,
    whiteSpace: 'pre',
    letterSpacing: 0,
  }

  return (
    <div
      style={{ display: 'flex', border: '1px solid #c6ced6', borderRadius: 8, overflow: 'hidden', height: alto, background: '#fff' }}
      data-editor-gcode="si"
    >
      <div style={{ width: 44, flex: '0 0 44px', background: '#f1f4f7', borderRight: '1px solid #e0e5eb', overflow: 'hidden', position: 'relative' }}>
        <div ref={margen} style={{ ...fuente, paddingTop: PAD, textAlign: 'right', color: '#5f6b78', fontSize: 11 }}>
          {lineas.map((_, i) => {
            const nivel = nivelDe.get(i)
            return (
              <div key={i} style={{ height: ALTO_LINEA, paddingRight: 6, color: nivel === 'error' ? '#c62828' : nivel === 'aviso' ? '#b26a00' : undefined, fontWeight: nivel && nivel !== 'info' ? 700 : 400 }}>
                {nivel === 'error' ? '✕ ' : nivel === 'aviso' ? '! ' : ''}
                {i + 1}
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div ref={fondo} aria-hidden style={{ ...fuente, position: 'absolute', top: 0, left: 0, padding: PAD, minWidth: '100%', pointerEvents: 'none' }}>
          {lineas.map((l, i) => {
            const nivel = nivelDe.get(i)
            const bg = i === lineaActiva ? '#fff2a8' : nivel === 'error' ? '#fde7e7' : nivel === 'aviso' ? '#fff5e0' : undefined
            return (
              <div key={i} style={{ height: ALTO_LINEA, background: bg, margin: `0 -${PAD}px`, padding: `0 ${PAD}px` }}>
                {l ? colorear(l) : ' '}
              </div>
            )
          })}
        </div>
        <textarea
          ref={area}
          value={codigo}
          readOnly={soloLectura}
          spellCheck={false}
          wrap="off"
          aria-label="Programa en código G"
          onChange={(e) => onCambiar(e.target.value)}
          onScroll={sincronizar}
          onSelect={avisarCursor}
          onKeyUp={avisarCursor}
          onClick={avisarCursor}
          style={{
            ...fuente,
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            padding: PAD,
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: 'transparent',
            color: 'transparent',
            caretColor: '#1c2733',
            overflow: 'auto',
          }}
        />
      </div>
    </div>
  )
})

export default EditorGcode
