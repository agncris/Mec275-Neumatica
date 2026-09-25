/**
 * Editor de diagramas Ladder: la escalera entre las dos barras de tensión,
 * escalón por escalón. Se elige una herramienta (contacto, bobina, rama…) y
 * se hace clic en la casilla. Con el PLC en RUN se ve la corriente: los
 * tramos con tensión en verde, los contactos cerrados rellenos y las bobinas
 * activadas encendidas.
 */
import { useEffect, useState } from 'react'
import {
  COLUMNAS,
  CONTADORES,
  ENTRADAS,
  MARCAS,
  SALIDAS,
  TEMPORIZADORES,
  BITS_TC,
  SIMBOLO_COMPARADOR,
  VALORES,
  areaDe,
  baseDe,
  clonarPrograma,
  colaCableada,
  escalonVacio,
  esContador,
  esDatos,
  esTemporizador,
  PALABRAS,
  type Bobina,
  type Celda,
  type Comparador,
  type EstadoPLC,
  type FlujoEscalon,
  type ProgramaPLC,
  type TipoBobina,
} from './ladder'
import { MNEMONICOS, formatear, type Notacion } from './notacion'

type Herramienta =
  | 'seleccionar'
  | 'NA'
  | 'NC'
  | 'cable'
  | 'rama'
  | 'borrar'
  | 'ONS'
  | 'CMP'
  | TipoBobina

interface Seleccion {
  escalon: number
  fila: number
  /** Columna de contactos, o 'bobina'. */
  col: number | 'bobina'
}

interface Props {
  programa: ProgramaPLC
  onCambiar: (p: ProgramaPLC) => void
  /** Con el PLC en RUN: la corriente de cada escalón y la memoria. */
  flujos: FlujoEscalon[] | null
  estado: EstadoPLC | null
  editable: boolean
  notacion: Notacion
}

// Geometría del dibujo.
const X0 = 46
const CW = 84
const FH = 66
const CAB = 30
const BOB = 128
const XB = X0 + COLUMNAS * CW
const XR = XB + BOB
const ANCHO = XR + 16
const SEP = 12

const TINTA = '#33475c'
const VERDE = '#12a35a'
const AZUL = '#1668c7'

const NOMBRES_BOBINA: Record<TipoBobina, string> = {
  normal: 'Bobina ( )',
  negada: 'Bobina negada (/)',
  flancoP: 'Flanco positivo (P)',
  flancoN: 'Flanco negativo (N)',
  set: 'Enclavar (L / Set)',
  reset: 'Desenclavar (U / Reset)',
  TON: 'Temporizador TON',
  TOF: 'Temporizador TOF',
  RTO: 'Temporizador retentivo RTO',
  CTU: 'Contador CTU',
  CTD: 'Contador CTD',
  MOV: 'Mover MOV',
  ADD: 'Sumar ADD',
  SUB: 'Restar SUB',
  MUL: 'Multiplicar MUL',
  DIV: 'Dividir DIV',
}

/** Signo de cada operación, para dibujarla y explicarla. */
const SIGNO: Partial<Record<TipoBobina, string>> = { ADD: '+', SUB: '−', MUL: '×', DIV: '÷' }

/** Las instrucciones que se dibujan como caja (no como bobina redonda). */
const esCaja = (t: TipoBobina) => esTemporizador(t) || esContador(t) || esDatos(t)

const herramientas = (n: Notacion): Array<{ id: Herramienta; icono: string; texto: string; titulo: string; grupo: number }> => [
  { id: 'seleccionar', icono: '↖', texto: 'Elegir', grupo: 0, titulo: 'Seleccionar: clic en un elemento para ver y cambiar su dirección' },
  { id: 'NA', icono: MNEMONICOS.NA[n], texto: 'Contacto NA', grupo: 1, titulo: 'Contacto normalmente abierto (XIC): deja pasar cuando su dirección está a 1' },
  { id: 'NC', icono: MNEMONICOS.NC[n], texto: 'Contacto NC', grupo: 1, titulo: 'Contacto normalmente cerrado (XIO): deja pasar cuando su dirección está a 0' },
  { id: 'cable', icono: '──', texto: 'Cable', grupo: 1, titulo: 'Cable: une dos tramos de una misma fila' },
  { id: 'rama', icono: '┃', texto: 'Rama', grupo: 1, titulo: 'Rama: une (o separa) dos filas en un nodo para hacer un paralelo' },
  { id: 'ONS', icono: 'ONS', texto: 'Un pulso', grupo: 1, titulo: 'One shot: deja pasar la corriente un solo barrido, cuando llega' },
  { id: 'CMP', icono: '≥ =', texto: 'Comparar', grupo: 1, titulo: 'Comparar: deja pasar si el acumulado de un temporizador o contador cumple la condición (EQU, GRT, LES…)' },
  { id: 'normal', icono: MNEMONICOS.normal[n], texto: 'Bobina', grupo: 2, titulo: 'Bobina (OTE): vale 1 mientras le llega corriente' },
  { id: 'set', icono: MNEMONICOS.set[n], texto: 'Enclavar', grupo: 2, titulo: 'Enclavar, L / Set (OTL): la pone a 1 y ahí queda hasta que la desenclaves' },
  { id: 'reset', icono: MNEMONICOS.reset[n], texto: 'Desenclavar', grupo: 2, titulo: 'Desenclavar, U / Reset (OTU; RES en temporizadores y contadores): la pone a 0' },
  { id: 'negada', icono: '(/)', texto: 'Negada', grupo: 2, titulo: 'Bobina negada: vale 1 mientras NO le llega corriente (al revés que la bobina normal)' },
  { id: 'flancoP', icono: '(P)', texto: 'Flanco ↑', grupo: 2, titulo: 'Flanco positivo: vale 1 un solo barrido cuando llega la corriente' },
  { id: 'flancoN', icono: '(N)', texto: 'Flanco ↓', grupo: 2, titulo: 'Flanco negativo: vale 1 un solo barrido cuando se va la corriente' },
  { id: 'TON', icono: 'TON', texto: 'Retardo', grupo: 3, titulo: 'Temporizador a la conexión: se activa tras el tiempo con corriente' },
  { id: 'TOF', icono: 'TOF', texto: 'Retardo off', grupo: 3, titulo: 'Temporizador a la desconexión: sigue activo un tiempo tras perder la corriente' },
  { id: 'RTO', icono: 'RTO', texto: 'Retentivo', grupo: 3, titulo: 'Temporizador retentivo: acumula el tiempo con corriente y lo guarda sin ella; se reinicia con Reset (RES)' },
  { id: 'CTU', icono: 'CTU', texto: 'Cuenta ↑', grupo: 3, titulo: 'Contador ascendente: suma uno en cada flanco de subida' },
  { id: 'CTD', icono: 'CTD', texto: 'Cuenta ↓', grupo: 3, titulo: 'Contador descendente: resta uno en cada flanco de subida' },
  { id: 'MOV', icono: 'MOV', texto: 'Mover', grupo: 4, titulo: 'MOV: copia un valor (constante, registro o acumulado) a un registro N mientras tiene corriente' },
  { id: 'ADD', icono: 'ADD', texto: 'Sumar', grupo: 4, titulo: 'ADD: guarda A + B en un registro N mientras tiene corriente' },
  { id: 'SUB', icono: 'SUB', texto: 'Restar', grupo: 4, titulo: 'SUB: guarda A − B en un registro N' },
  { id: 'MUL', icono: 'MUL', texto: 'Multiplicar', grupo: 4, titulo: 'MUL: guarda A × B en un registro N' },
  { id: 'DIV', icono: 'DIV', texto: 'Dividir', grupo: 4, titulo: 'DIV: guarda A ÷ B (entero) en un registro N' },
  { id: 'borrar', icono: '✕', texto: 'Borrar', grupo: 5, titulo: 'Borrar el elemento de la casilla (también con Supr)' },
]

const esBobina = (h: Herramienta): h is TipoBobina =>
  !['seleccionar', 'NA', 'NC', 'cable', 'rama', 'borrar', 'ONS', 'CMP'].includes(h)

/** Alto de un escalón en el dibujo. */
const altoEscalon = (filas: number) => CAB + filas * FH

export default function EditorLadder({ programa, onCambiar, flujos, estado, editable, notacion }: Props) {
  const [herramienta, setHerramienta] = useState<Herramienta>('seleccionar')
  const [sel, setSel] = useState<Seleccion | null>(null)
  const [escalonSel, setEscalonSel] = useState<number | null>(null)
  /** Aviso breve cuando se usa una herramienta en la columna que no le toca. */
  const [pista, setPista] = useState<string | null>(null)
  useEffect(() => {
    if (!pista) return
    const id = setTimeout(() => setPista(null), 3500)
    return () => clearTimeout(id)
  }, [pista])

  const fmt = (dir: string) => formatear(dir, notacion)
  /** Nombre del símbolo; en un bit de temporizador o contador, el del T/C más el bit. */
  const nombre = (dir: string) => {
    const propio = programa.simbolos.find((s) => s.dir === dir)?.nombre
    if (propio) return propio
    const base = baseDe(dir)
    const deBase = base !== dir ? programa.simbolos.find((s) => s.dir === base)?.nombre : ''
    return deBase ? `${deBase}.${dir.split('.')[1]}` : ''
  }

  // Si el programa cambia por fuera (ejemplo, nuevo…), la selección ya no vale.
  useEffect(() => {
    setSel((s) => {
      if (!s) return s
      const e = programa.escalones[s.escalon]
      return e && e.celdas[s.fila] ? s : null
    })
  }, [programa])

  const cambiar = (mutar: (p: ProgramaPLC) => void) => {
    const p = clonarPrograma(programa)
    mutar(p)
    onCambiar(p)
  }

  // Supr borra lo seleccionado.
  useEffect(() => {
    if (!editable) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        aplicar('borrar', sel)
        setSel(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const aplicar = (h: Herramienta, s: Seleccion) => {
    if (h === 'seleccionar' || h === 'rama') {
      setSel(s)
      return
    }
    if (s.col === 'bobina') {
      if (h === 'borrar') {
        cambiar((p) => (p.escalones[s.escalon].bobinas[s.fila] = null))
        return
      }
      if (!esBobina(h)) {
        setPista('Esa es la columna de las bobinas: los contactos, cables y ramas van en las casillas de la izquierda.')
        return
      }
      cambiar((p) => {
        const antes = p.escalones[s.escalon].bobinas[s.fila]
        const nueva: Bobina = { tipo: h, dir: '' }
        // Conserva la dirección si sigue teniendo sentido para el nuevo tipo.
        if (antes?.dir && direccionesPara(h).includes(antes.dir)) nueva.dir = antes.dir
        if (esTemporizador(h)) nueva.preset = antes?.preset && esTemporizador(antes.tipo) ? antes.preset : 2
        if (esContador(h)) nueva.preset = antes?.preset && esContador(antes.tipo) ? antes.preset : 3
        if (esDatos(h)) {
          nueva.a = antes && esDatos(antes.tipo) ? antes.a : h === 'MOV' ? '0' : 'N0'
          if (h !== 'MOV') nueva.b = antes && esDatos(antes.tipo) && antes.b ? antes.b : '1'
        }
        p.escalones[s.escalon].bobinas[s.fila] = nueva
      })
      setSel(s)
      return
    }
    const col = s.col
    if (esBobina(h)) {
      setPista('Las bobinas van en la última columna, a la derecha, pegadas a la barra.')
      return
    }
    cambiar((p) => {
      const celdas = p.escalones[s.escalon].celdas[s.fila]
      const antes = celdas[col]
      let nueva: Celda
      if (h === 'NA' || h === 'NC') nueva = { tipo: 'contacto', modo: h, dir: antes.tipo === 'contacto' ? antes.dir : '' }
      else if (h === 'ONS') nueva = { tipo: 'ons' }
      else if (h === 'CMP') nueva = antes.tipo === 'comparar' ? antes : { tipo: 'comparar', op: 'GEQ', fuente: '', valor: 1 }
      else if (h === 'cable') nueva = { tipo: 'cable' }
      else nueva = { tipo: 'vacio' }
      celdas[col] = nueva
    })
    if (h === 'NA' || h === 'NC' || h === 'CMP') setSel(s)
  }

  const alternarEnlace = (escalon: number, fila: number, nodo: number) =>
    cambiar((p) => {
      const e = p.escalones[escalon]
      e.enlaces[fila][nodo] = !e.enlaces[fila][nodo]
    })

  const agregarFila = (i: number) =>
    cambiar((p) => {
      const e = p.escalones[i]
      e.celdas.push(Array.from({ length: COLUMNAS }, () => ({ tipo: 'vacio' }) as Celda))
      e.bobinas.push(null)
      e.enlaces.push(Array(COLUMNAS + 1).fill(false))
    })
  const quitarFila = (i: number) =>
    cambiar((p) => {
      const e = p.escalones[i]
      if (e.celdas.length <= 1) return
      e.celdas.pop()
      e.bobinas.pop()
      e.enlaces.pop()
    })
  const moverEscalon = (i: number, d: number) =>
    cambiar((p) => {
      const j = i + d
      if (j < 0 || j >= p.escalones.length) return
      ;[p.escalones[i], p.escalones[j]] = [p.escalones[j], p.escalones[i]]
    })
  const borrarEscalon = (i: number) =>
    cambiar((p) => {
      p.escalones.splice(i, 1)
      if (p.escalones.length === 0) p.escalones.push(escalonVacio())
    })

  // --- dibujo -------------------------------------------------------------------
  let y = 8
  const posiciones = programa.escalones.map((e) => {
    const top = y
    y += altoEscalon(e.celdas.length) + SEP
    return top
  })
  const altoTotal = y + 4

  const trazo = (on: boolean) => ({ stroke: on ? VERDE : TINTA, strokeWidth: on ? 3.4 : 2 })

  const elementos: JSX.Element[] = []
  programa.escalones.forEach((e, i) => {
    const top = posiciones[i]
    const flujo = flujos?.[i]
    const filas = e.celdas.length
    const seleccionado = escalonSel === i
    // Cabecera: número y comentario.
    elementos.push(
      <g key={`cab-${i}`}>
        <rect
          x={4}
          y={top}
          width={ANCHO - 8}
          height={altoEscalon(filas)}
          rx={6}
          fill={seleccionado ? '#f1f6fd' : '#fafbfc'}
          stroke={seleccionado ? AZUL : '#e3e8ee'}
          onClick={() => setEscalonSel(i)}
        />
        <text x={12} y={top + 19} fontSize={12} fontWeight={700} fill={TINTA}>
          {String(i).padStart(3, '0')}
        </text>
        <text x={X0 + 8} y={top + 19} fontSize={11.5} fill="#5a6b7d" fontStyle="italic">
          {recortar(e.comentario ?? '', 92)}
        </text>
      </g>,
    )
    if (editable) {
      const botones: Array<[string, string, () => void]> = [
        ['＋ rama', 'Añade una fila para montar un paralelo', () => agregarFila(i)],
        ['− rama', 'Quita la última fila', () => quitarFila(i)],
        ['↑', 'Sube el escalón', () => moverEscalon(i, -1)],
        ['↓', 'Baja el escalón', () => moverEscalon(i, 1)],
        ['✕', 'Borra el escalón', () => borrarEscalon(i)],
      ]
      let bx = ANCHO - 14
      for (const [txt, titulo, fn] of [...botones].reverse()) {
        const w = txt.length > 2 ? 52 : 22
        bx -= w + 4
        elementos.push(
          <g key={`b-${i}-${txt}`} onClick={(ev) => (ev.stopPropagation(), fn())} style={{ cursor: 'pointer' }}>
            <title>{titulo}</title>
            <rect x={bx} y={top + 5} width={w} height={19} rx={4} fill="#fff" stroke="#c6ced6" />
            <text x={bx + w / 2} y={top + 18.5} fontSize={11} textAnchor="middle" fill={TINTA}>
              {txt}
            </text>
          </g>,
        )
      }
    }

    for (let f = 0; f < filas; f++) {
      const yf = top + CAB + FH / 2 + f * FH
      const nodos = flujo?.nodos[f]
      const cola = colaCableada(e, f)
      for (let c = 0; c < COLUMNAS; c++) {
        const x = X0 + c * CW
        const celda = e.celdas[f][c]
        const conduce = !!flujo?.conducen[f][c]
        const entra = !!nodos?.[c]
        const sale = entra && conduce
        const esSel = sel?.escalon === i && sel.fila === f && sel.col === c
        const clave = `${i}-${f}-${c}`
        const implicito = celda.tipo === 'vacio' && c >= cola && !!e.bobinas[f]
        if (celda.tipo === 'cable' || implicito) {
          elementos.push(<line key={`w${clave}`} x1={x} y1={yf} x2={x + CW} y2={yf} {...trazo(sale)} />)
        } else if (celda.tipo === 'contacto') {
          const cx = x + CW / 2
          const colorBarra = conduce && flujos ? VERDE : TINTA
          elementos.push(
            <g key={`c${clave}`}>
              <line x1={x} y1={yf} x2={cx - 9} y2={yf} {...trazo(entra)} />
              <line x1={cx + 9} y1={yf} x2={x + CW} y2={yf} {...trazo(sale)} />
              {conduce && flujos && <rect x={cx - 9} y={yf - 13} width={18} height={26} fill="#d8f3e5" />}
              <line x1={cx - 9} y1={yf - 14} x2={cx - 9} y2={yf + 14} stroke={colorBarra} strokeWidth={2.6} />
              <line x1={cx + 9} y1={yf - 14} x2={cx + 9} y2={yf + 14} stroke={colorBarra} strokeWidth={2.6} />
              {celda.modo === 'NC' && <line x1={cx - 12} y1={yf + 13} x2={cx + 12} y2={yf - 13} stroke={colorBarra} strokeWidth={2} />}
              <text x={cx} y={yf - 20} fontSize={12} fontWeight={700} textAnchor="middle" fill={celda.dir ? TINTA : '#b3261e'}>
                {celda.dir ? recortar(nombre(celda.dir) || fmt(celda.dir), 12) : '???'}
              </text>
              <text x={cx} y={yf + 28} fontSize={10.5} textAnchor="middle" fill="#5a6b7d">
                {celda.dir && nombre(celda.dir) ? fmt(celda.dir) : ''}
              </text>
            </g>,
          )
        } else if (celda.tipo === 'ons' || celda.tipo === 'comparar') {
          const cx = x + CW / 2
          const ancho = celda.tipo === 'ons' ? 40 : 70
          const on = conduce && !!flujos
          elementos.push(
            <g key={`k${clave}`}>
              <line x1={x} y1={yf} x2={cx - ancho / 2} y2={yf} {...trazo(entra)} />
              <line x1={cx + ancho / 2} y1={yf} x2={x + CW} y2={yf} {...trazo(sale)} />
              <rect x={cx - ancho / 2} y={yf - 16} width={ancho} height={32} rx={4} fill={on ? '#d8f3e5' : '#fff'} stroke={on ? VERDE : TINTA} strokeWidth={2} />
              {celda.tipo === 'ons' ? (
                <text x={cx} y={yf + 4.5} fontSize={12} fontWeight={700} textAnchor="middle" fill={TINTA}>
                  ONS
                </text>
              ) : (
                <>
                  <text x={cx} y={yf - 3} fontSize={10.5} fontWeight={700} textAnchor="middle" fill={TINTA}>
                    {celda.op}
                  </text>
                  <text x={cx} y={yf + 11} fontSize={10} textAnchor="middle" fill={celda.fuente ? TINTA : '#b3261e'}>
                    {celda.fuente
                      ? `${recortar(nombre(celda.fuente) || fmt(celda.fuente), 9)} ${SIMBOLO_COMPARADOR[celda.op]} ${celda.fuenteB ? recortar(fmt(celda.fuenteB), 7) : celda.valor}`
                      : '???'}
                  </text>
                  {estado && celda.fuente && (
                    <text x={cx} y={yf + 28} fontSize={10} fontWeight={700} textAnchor="middle" fill={VERDE}>
                      = {formatoValor(celda.fuente, estado)}
                    </text>
                  )}
                </>
              )}
            </g>,
          )
        }
        elementos.push(
          <rect
            key={`h${clave}`}
            data-celda={`${i}-${f}-${c}`}
            x={x + 2}
            y={yf - FH / 2 + 2}
            width={CW - 4}
            height={FH - 4}
            rx={5}
            fill={esSel ? 'rgba(22,104,199,0.08)' : 'transparent'}
            stroke={esSel ? AZUL : 'transparent'}
            strokeDasharray={esSel ? '4 3' : undefined}
            style={{ cursor: editable ? 'pointer' : 'default' }}
            onClick={() => {
              setEscalonSel(i)
              if (editable) aplicar(herramienta === 'rama' ? 'seleccionar' : herramienta, { escalon: i, fila: f, col: c })
              else setSel({ escalon: i, fila: f, col: c })
            }}
          />,
        )
      }
      // Bobina.
      const b = e.bobinas[f]
      const cx = XB + BOB / 2
      const activa = !!flujo?.bobinas[f]
      const esSel = sel?.escalon === i && sel.fila === f && sel.col === 'bobina'
      if (b) {
        elementos.push(
          <g key={`bob${i}-${f}`}>
            <line x1={XB} y1={yf} x2={cx - (esCaja(b.tipo) ? 34 : 14)} y2={yf} {...trazo(activa)} />
            {dibujarBobina(b, cx, yf, activa && !!flujos, estado, nombre(b.dir), fmt, notacion)}
            <line x1={cx + (esCaja(b.tipo) ? 34 : 14)} y1={yf} x2={XR} y2={yf} stroke={TINTA} strokeWidth={2} />
          </g>,
        )
      }
      elementos.push(
        <rect
          key={`hb${i}-${f}`}
          x={XB + 2}
          y={yf - FH / 2 + 2}
          width={BOB - 4}
          height={FH - 4}
          rx={5}
          fill={esSel ? 'rgba(22,104,199,0.08)' : 'transparent'}
          stroke={esSel ? AZUL : b || !editable ? 'transparent' : '#dfe4ea'}
          strokeDasharray="4 3"
          style={{ cursor: editable ? 'pointer' : 'default' }}
          onClick={() => {
            setEscalonSel(i)
            if (editable) aplicar(herramienta === 'rama' ? 'seleccionar' : herramienta, { escalon: i, fila: f, col: 'bobina' })
            else setSel({ escalon: i, fila: f, col: 'bobina' })
          }}
        />,
      )
    }
    // Enlaces verticales (paralelos).
    for (let f = 0; f < filas - 1; f++) {
      for (let n = 1; n <= COLUMNAS; n++) {
        const x = X0 + n * CW
        const y1 = top + CAB + FH / 2 + f * FH
        const on = e.enlaces[f][n]
        const tension = !!flujo && !!flujo.nodos[f][n] && !!flujo.nodos[f + 1][n]
        if (on) elementos.push(<line key={`e${i}-${f}-${n}`} x1={x} y1={y1} x2={x} y2={y1 + FH} {...trazo(tension)} />)
        if (on && flujo) {
          elementos.push(<circle key={`p${i}-${f}-${n}`} cx={x} cy={y1} r={2.8} fill={tension ? VERDE : TINTA} />)
          elementos.push(<circle key={`q${i}-${f}-${n}`} cx={x} cy={y1 + FH} r={2.8} fill={tension ? VERDE : TINTA} />)
        }
        if (editable && herramienta === 'rama') {
          elementos.push(
            <g key={`z${i}-${f}-${n}`} onClick={() => alternarEnlace(i, f, n)} style={{ cursor: 'pointer' }}>
              <title>{on ? 'Quitar la unión' : 'Unir estas dos filas aquí'}</title>
              <rect x={x - 8} y={y1 + 6} width={16} height={FH - 12} rx={4} fill={on ? 'rgba(22,104,199,0.15)' : 'rgba(22,104,199,0.06)'} stroke={AZUL} strokeDasharray="3 2" />
            </g>,
          )
        }
      }
    }
  })

  // Barras de tensión.
  const barras = (
    <g>
      <line x1={X0} y1={4} x2={X0} y2={altoTotal - 4} stroke={flujos ? VERDE : TINTA} strokeWidth={5} />
      <line x1={XR} y1={4} x2={XR} y2={altoTotal - 4} stroke={TINTA} strokeWidth={5} />
    </g>
  )

  const celdaSel = sel ? programa.escalones[sel.escalon]?.celdas[sel.fila] : null
  const elementoSel = sel && celdaSel ? (sel.col === 'bobina' ? programa.escalones[sel.escalon].bobinas[sel.fila] : celdaSel[sel.col]) : null

  return (
    <div>
      {editable && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, position: 'sticky', top: -8, zIndex: 2, background: '#fff', padding: '4px 0' }} role="toolbar" aria-label="Herramientas Ladder">
          {herramientas(notacion).map((h, i, todas) => (
            <span key={h.id} style={{ display: 'contents' }}>
              {i > 0 && todas[i - 1].grupo !== h.grupo && <span style={{ width: 6 }} aria-hidden />}
              <button
                title={h.titulo}
                onClick={() => setHerramienta(h.id)}
                aria-pressed={herramienta === h.id}
                aria-label={`${h.texto} ${h.icono}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  minWidth: 52,
                  padding: '0.2rem 0.35rem',
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: `1px solid ${herramienta === h.id ? AZUL : '#c6ced6'}`,
                  background: herramienta === h.id ? AZUL : '#fff',
                  color: herramienta === h.id ? '#fff' : TINTA,
                }}
              >
                <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.84rem', fontWeight: 700 }}>{h.icono}</span>
                <span style={{ fontSize: '0.64rem', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{h.texto}</span>
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ overflowX: 'auto', border: '1px solid #e0e5eb', borderRadius: 8, background: '#fff' }}>
        <svg
          id="ladder-svg"
          viewBox={`0 0 ${ANCHO} ${altoTotal}`}
          width="100%"
          style={{ minWidth: 560, display: 'block', fontFamily: 'system-ui, sans-serif' }}
          role="img"
          aria-label="Diagrama Ladder"
        >
          <rect x={0} y={0} width={ANCHO} height={altoTotal} fill="#fff" />
          {elementos}
          {barras}
        </svg>
      </div>
      {editable && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => cambiar((p) => p.escalones.push(escalonVacio()))}
            style={{ border: `1px solid ${AZUL}`, color: AZUL, background: '#fff', borderRadius: 6, padding: '0.3rem 0.7rem', cursor: 'pointer', fontWeight: 600 }}
          >
            ＋ Escalón
          </button>
          <span style={{ fontSize: '0.8rem', color: pista ? '#8a5b00' : '#5a6b7d', fontWeight: pista ? 700 : 400 }} role={pista ? 'status' : undefined}>
            {pista ? `⚠ ${pista}` : herramienta === 'rama'
              ? 'Haz clic en las franjas azules para unir dos filas en ese punto (así se arma un paralelo).'
              : herramienta === 'seleccionar'
                ? 'Elige una herramienta y haz clic en una casilla. Las bobinas van en la última columna.'
                : esBobina(herramienta)
                  ? 'Haz clic en la columna de la derecha (bobinas) para colocarla.'
                  : 'Haz clic en una casilla de contactos para colocarlo.'}
          </span>
        </div>
      )}
      {sel && elementoSel !== undefined && (
        <Propiedades
          fmt={fmt}
          programa={programa}
          sel={sel}
          editable={editable}
          onCambiar={cambiar}
          onCerrar={() => setSel(null)}
        />
      )}
      {editable && escalonSel !== null && programa.escalones[escalonSel] && (
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: '0.84rem', color: '#5a6b7d' }}>
          Comentario del escalón {String(escalonSel).padStart(3, '0')}:
          <input
            value={programa.escalones[escalonSel].comentario ?? ''}
            onChange={(ev) => cambiar((p) => (p.escalones[escalonSel].comentario = ev.target.value))}
            placeholder="Qué hace este escalón, en tus palabras"
            style={{ flex: 1, minWidth: 200, padding: '0.25rem 0.4rem' }}
          />
        </label>
      )}
    </div>
  )
}

function direccionesPara(tipo: TipoBobina): string[] {
  if (esTemporizador(tipo)) return TEMPORIZADORES
  if (esContador(tipo)) return CONTADORES
  if (tipo === 'reset') return [...SALIDAS, ...MARCAS, ...TEMPORIZADORES, ...CONTADORES, ...PALABRAS]
  if (esDatos(tipo)) return PALABRAS
  return [...SALIDAS, ...MARCAS]
}

function Propiedades({
  fmt,
  programa,
  sel,
  editable,
  onCambiar,
  onCerrar,
}: {
  fmt: (d: string) => string
  programa: ProgramaPLC
  sel: Seleccion
  editable: boolean
  onCambiar: (m: (p: ProgramaPLC) => void) => void
  onCerrar: () => void
}) {
  const e = programa.escalones[sel.escalon]
  const opciones = (dirs: string[]) =>
    dirs.map((d) => {
      const s = programa.simbolos.find((x) => x.dir === d)
      return (
        <option key={d} value={d}>
          {fmt(d)}
          {s?.nombre ? ` · ${s.nombre}` : ''}
          {s?.descripcion ? ` — ${recortar(s.descripcion, 40)}` : ''}
        </option>
      )
    })
  const grupos = (dirs: string[]) => {
    const por = (area: string, titulo: string) => {
      const d = dirs.filter((x) => areaDe(x) === area)
      return d.length ? <optgroup label={titulo}>{opciones(d)}</optgroup> : null
    }
    return (
      <>
        <option value="">— elige una dirección —</option>
        {por('I', 'Entradas (I)')}
        {por('Q', 'Salidas (Q)')}
        {por('M', 'Marcas internas (M)')}
        {por('T', 'Temporizadores (T) · DN terminó, TT contando, EN con corriente')}
        {por('C', 'Contadores (C) · DN llegó a la cuenta, CU con corriente')}
        {por('N', 'Registros enteros (N)')}
      </>
    )
  }
  const caja: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
    padding: '0.5rem 0.7rem',
    background: '#f4f7fb',
    border: '1px solid #d7e2ef',
    borderRadius: 8,
    fontSize: '0.86rem',
    color: TINTA,
  }
  if (sel.col === 'bobina') {
    const b = e.bobinas[sel.fila]
    if (!b) return null
    return (
      <div style={caja}>
        <strong>{NOMBRES_BOBINA[b.tipo]}</strong>
        <label>
          Dirección{' '}
          <select
            disabled={!editable}
            value={b.dir}
            onChange={(ev) => onCambiar((p) => ((p.escalones[sel.escalon].bobinas[sel.fila] as Bobina).dir = ev.target.value))}
          >
            {grupos(direccionesPara(b.tipo))}
          </select>
        </label>
        {esDatos(b.tipo) && (
          <>
            <label>
              A <Operando fmt={fmt} valor={b.a ?? ''} disabled={!editable} onCambiar={(x) => onCambiar((p) => ((p.escalones[sel.escalon].bobinas[sel.fila] as Bobina).a = x))} />
            </label>
            {b.tipo !== 'MOV' && (
              <label>
                {SIGNO[b.tipo]} B{' '}
                <Operando fmt={fmt} valor={b.b ?? ''} disabled={!editable} onCambiar={(x) => onCambiar((p) => ((p.escalones[sel.escalon].bobinas[sel.fila] as Bobina).b = x))} />
              </label>
            )}
          </>
        )}
        {(esTemporizador(b.tipo) || esContador(b.tipo)) && (
          <label>
            {esTemporizador(b.tipo) ? 'Tiempo (s)' : 'Cuenta'}{' '}
            <input
              type="number"
              disabled={!editable}
              min={esTemporizador(b.tipo) ? 0.1 : 1}
              step={esTemporizador(b.tipo) ? 0.1 : 1}
              value={b.preset ?? 1}
              onChange={(ev) =>
                onCambiar((p) => ((p.escalones[sel.escalon].bobinas[sel.fila] as Bobina).preset = Math.max(0, Number(ev.target.value) || 0)))
              }
              style={{ width: 70 }}
            />
          </label>
        )}
        <span style={{ color: '#5a6b7d' }}>{explicarBobina(b)}</span>
        <button onClick={onCerrar} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5a6b7d' }}>
          ✕
        </button>
      </div>
    )
  }
  const celda = e.celdas[sel.fila][sel.col]
  if (celda.tipo === 'comparar') {
    const poner = (m: (c: Extract<Celda, { tipo: 'comparar' }>) => void) =>
      onCambiar((p) => {
        const c = p.escalones[sel.escalon].celdas[sel.fila][sel.col as number]
        if (c.tipo === 'comparar') m(c)
      })
    return (
      <div style={caja}>
        <strong>Comparar</strong>
        <select disabled={!editable} value={celda.fuente} onChange={(ev) => poner((c) => (c.fuente = ev.target.value))}>
          <option value="">— elige qué comparar —</option>
          <optgroup label="Acumulado de temporizador (segundos)">
            {VALORES.filter((v) => v.startsWith('T')).map((v) => (
              <option key={v} value={v}>
                {fmt(v)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Cuenta de contador">
            {VALORES.filter((v) => v.startsWith('C')).map((v) => (
              <option key={v} value={v}>
                {fmt(v)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Registro entero">
            {PALABRAS.map((v) => (
              <option key={v} value={v}>
                {fmt(v)}
              </option>
            ))}
          </optgroup>
        </select>
        <select disabled={!editable} value={celda.op} onChange={(ev) => poner((c) => (c.op = ev.target.value as Comparador))}>
          {(Object.keys(SIMBOLO_COMPARADOR) as Comparador[]).map((op) => (
            <option key={op} value={op}>
              {op} ({SIMBOLO_COMPARADOR[op]})
            </option>
          ))}
        </select>
        <Operando
          fmt={fmt}
          disabled={!editable}
          valor={celda.fuenteB ?? String(celda.valor)}
          onCambiar={(x) =>
            poner((c) => {
              if (/^[+-]?\d+(\.\d+)?$/.test(x.trim()) || x.trim() === '') {
                c.valor = Number(x) || 0
                delete c.fuenteB
              } else c.fuenteB = x
            })
          }
        />
        <span style={{ color: '#5a6b7d' }}>Deja pasar la corriente mientras la comparación sea verdadera.</span>
        <button onClick={onCerrar} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5a6b7d' }}>
          ✕
        </button>
      </div>
    )
  }
  if (celda.tipo !== 'contacto') return null
  return (
    <div style={caja}>
      <strong>Contacto</strong>
      <label>
        <select
          disabled={!editable}
          value={celda.modo}
          onChange={(ev) =>
            onCambiar((p) => {
              const c = p.escalones[sel.escalon].celdas[sel.fila][sel.col as number]
              if (c.tipo === 'contacto') c.modo = ev.target.value as 'NA' | 'NC'
            })
          }
        >
          <option value="NA">Normalmente abierto ┤ ├</option>
          <option value="NC">Normalmente cerrado ┤/├</option>
        </select>
      </label>
      <label>
        Dirección{' '}
        <select
          disabled={!editable}
          value={celda.dir}
          onChange={(ev) =>
            onCambiar((p) => {
              const c = p.escalones[sel.escalon].celdas[sel.fila][sel.col as number]
              if (c.tipo === 'contacto') c.dir = ev.target.value
            })
          }
        >
          {grupos([
            ...ENTRADAS,
            ...SALIDAS,
            ...MARCAS,
            ...BITS_TC,
            // Un programa antiguo puede tener «T0» a secas (equivale a T0.DN).
            ...(celda.dir && !BITS_TC.includes(celda.dir) && /^[TC]\d$/.test(celda.dir) ? [celda.dir] : []),
          ])}
        </select>
      </label>
      <span style={{ color: '#5a6b7d' }}>
        {celda.modo === 'NA' ? 'Deja pasar la corriente cuando su dirección vale 1.' : 'Deja pasar la corriente cuando su dirección vale 0.'}
      </span>
      <button onClick={onCerrar} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5a6b7d' }}>
        ✕
      </button>
    </div>
  )
}

/** Un operando: una constante o una dirección con valor (registro, acumulado). */
function Operando({ fmt, valor, onCambiar, disabled }: { fmt: (d: string) => string; valor: string; onCambiar: (x: string) => void; disabled: boolean }) {
  const esConst = valor.trim() === '' || /^[+-]?\d+(\.\d+)?$/.test(valor.trim())
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <select disabled={disabled} value={esConst ? '#' : valor} onChange={(e) => onCambiar(e.target.value === '#' ? '0' : e.target.value)}>
        <option value="#">constante</option>
        <optgroup label="Registros">
          {PALABRAS.map((v) => (
            <option key={v} value={v}>
              {fmt(v)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Acumulados">
          {VALORES.filter((v) => !v.startsWith('N')).map((v) => (
            <option key={v} value={v}>
              {fmt(v)}
            </option>
          ))}
        </optgroup>
      </select>
      {esConst && <input type="number" step="any" disabled={disabled} value={valor} onChange={(e) => onCambiar(e.target.value)} style={{ width: 70 }} />}
    </span>
  )
}

function explicarBobina(b: Bobina): string {
  switch (b.tipo) {
    case 'MOV':
      return 'Mientras tiene corriente, copia A en el registro de destino.'
    case 'ADD':
    case 'SUB':
    case 'MUL':
    case 'DIV':
      return `Mientras tiene corriente, guarda A ${SIGNO[b.tipo]} B en el registro de destino (entero de 16 bits${b.tipo === 'DIV' ? ', sin decimales' : ''}). Ojo: se ejecuta en cada barrido; para hacerlo una sola vez, antepón un ONS.`
    case 'normal':
      return 'Vale 1 mientras le llega corriente.'
    case 'negada':
      return 'Vale 1 mientras NO le llega corriente.'
    case 'set':
      return 'Con corriente la pone a 1; queda así aunque la corriente se vaya.'
    case 'reset':
      return 'Con corriente la pone a 0 (en un temporizador o contador, lo reinicia).'
    case 'flancoP':
      return 'Vale 1 un solo barrido, justo cuando llega la corriente.'
    case 'flancoN':
      return 'Vale 1 un solo barrido, justo cuando se va la corriente.'
    case 'TON':
      return 'Con corriente cuenta el tiempo; al llegar, su contacto se cierra. Sin corriente vuelve a cero.'
    case 'TOF':
      return 'Con corriente su contacto está cerrado; al perderla, sigue cerrado el tiempo indicado.'
    case 'RTO':
      return 'Acumula el tiempo con corriente y lo guarda sin ella; al llegar se cierra su contacto. Se reinicia con Reset (RES).'
    case 'CTU':
      return 'Suma uno en cada flanco de subida; al llegar a la cuenta, su contacto se cierra.'
    case 'CTD':
      return 'Parte de la cuenta y resta uno en cada flanco; al llegar a cero, su contacto se cierra.'
  }
}

function dibujarBobina(
  b: Bobina,
  cx: number,
  y: number,
  activa: boolean,
  estado: EstadoPLC | null,
  nombre: string,
  fmt: (d: string) => string,
  _notacion: Notacion,
) {
  const color = activa ? VERDE : TINTA
  const etiqueta = b.dir ? recortar(nombre || fmt(b.dir), 14) : '???'
  if (esDatos(b.tipo)) {
    const op = (x?: string) => (x && /^[A-Z]/.test(x) ? fmt(x) : x ?? '?')
    const expr = b.tipo === 'MOV' ? op(b.a) : `${op(b.a)} ${SIGNO[b.tipo]} ${op(b.b)}`
    return (
      <g>
        <rect x={cx - 34} y={y - 22} width={68} height={44} rx={4} fill={activa ? '#eefaf3' : '#fff'} stroke={color} strokeWidth={2} />
        <text x={cx} y={y - 8} fontSize={11} fontWeight={700} textAnchor="middle" fill={TINTA}>
          {b.tipo} → {b.dir ? fmt(b.dir) : '???'}
        </text>
        <text x={cx} y={y + 6} fontSize={10} textAnchor="middle" fill="#5a6b7d">
          {recortar(expr, 16)}
        </text>
        {estado && b.dir && (
          <text x={cx} y={y + 18} fontSize={10.5} fontWeight={700} textAnchor="middle" fill={VERDE}>
            = {estado.palabras?.[b.dir] ?? 0}
          </text>
        )}
        <text x={cx} y={y - 27} fontSize={11.5} fontWeight={700} textAnchor="middle" fill={b.dir ? TINTA : '#b3261e'}>
          {nombre ? recortar(nombre, 14) : ''}
        </text>
      </g>
    )
  }
  if (esTemporizador(b.tipo) || esContador(b.tipo)) {
    let valor = ''
    if (estado && b.dir) {
      if (esTemporizador(b.tipo)) {
        const tm = estado.temporizadores[b.dir]
        valor = `${(tm?.acumulado ?? 0).toFixed(1)} s`
      } else {
        valor = `${estado.contadores[b.dir]?.valor ?? (b.tipo === 'CTD' ? b.preset ?? 0 : 0)}`
      }
    }
    const hecho = !!estado && !!b.dir && (esTemporizador(b.tipo) ? estado.temporizadores[b.dir]?.hecho : estado.contadores[b.dir]?.hecho)
    return (
      <g>
        <rect x={cx - 34} y={y - 22} width={68} height={44} rx={4} fill={hecho ? '#d8f3e5' : activa ? '#eefaf3' : '#fff'} stroke={color} strokeWidth={2} />
        <text x={cx} y={y - 8} fontSize={11} fontWeight={700} textAnchor="middle" fill={TINTA}>
          {b.tipo} {b.dir ? fmt(b.dir) : '???'}
        </text>
        <text x={cx} y={y + 6} fontSize={10.5} textAnchor="middle" fill="#5a6b7d">
          {esTemporizador(b.tipo) ? `PT ${(b.preset ?? 0).toFixed(1)} s` : `PV ${b.preset ?? 0}`}
        </text>
        {valor && (
          <text x={cx} y={y + 18} fontSize={10.5} fontWeight={700} textAnchor="middle" fill={VERDE}>
            {valor}
          </text>
        )}
        <text x={cx} y={y - 27} fontSize={11.5} fontWeight={700} textAnchor="middle" fill={b.dir ? TINTA : '#b3261e'}>
          {nombre ? recortar(nombre, 14) : ''}
        </text>
      </g>
    )
  }
  const esTC = /^[TCN]/.test(b.dir)
  const letra: Record<string, string> = {
    normal: '',
    negada: '/',
    flancoP: 'P',
    flancoN: 'N',
    set: 'L',
    reset: esTC ? 'RES' : 'U',
  }
  return (
    <g>
      {activa && <circle cx={cx} cy={y} r={13} fill="#d8f3e5" />}
      <path d={`M ${cx - 8} ${y - 14} A 18 18 0 0 0 ${cx - 8} ${y + 14}`} fill="none" stroke={color} strokeWidth={2.6} />
      <path d={`M ${cx + 8} ${y - 14} A 18 18 0 0 1 ${cx + 8} ${y + 14}`} fill="none" stroke={color} strokeWidth={2.6} />
      <text x={cx} y={y + 4} fontSize={letra[b.tipo].length > 1 ? 8.5 : 13} fontWeight={700} textAnchor="middle" fill={color}>
        {letra[b.tipo]}
      </text>
      <text x={cx} y={y - 20} fontSize={12} fontWeight={700} textAnchor="middle" fill={b.dir ? TINTA : '#b3261e'}>
        {etiqueta}
      </text>
      <text x={cx} y={y + 28} fontSize={10.5} textAnchor="middle" fill="#5a6b7d">
        {b.dir && nombre ? fmt(b.dir) : ''}
      </text>
      {/* En RUN, el valor que quedó en la salida: con la bobina negada (/)
          «tener corriente» y «salida a 1» no son lo mismo. */}
      {estado && b.dir && /^[QM]/.test(b.dir) && (
        <text
          x={cx + 24}
          y={y + 5}
          fontSize={11}
          fontWeight={700}
          fill={estado.bits[b.dir] ? VERDE : '#8a97a5'}
        >
          = {estado.bits[b.dir] ? 1 : 0}
        </text>
      )}
    </g>
  )
}

function formatoValor(fuente: string, estado: EstadoPLC): string {
  const base = baseDe(fuente)
  if (base.startsWith('N')) return String(estado.palabras?.[base] ?? 0)
  if (base.startsWith('T')) return `${(estado.temporizadores[base]?.acumulado ?? 0).toFixed(1)} s`
  return String(estado.contadores[base]?.valor ?? 0)
}

const recortar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)
