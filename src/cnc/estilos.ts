import type { CSSProperties } from 'react'

/** Estilos que comparten los paneles de la unidad CNC. */
export const botonSuave: CSSProperties = {
  border: '1px solid #c6ced6',
  background: '#fff',
  color: '#33475c',
  padding: '0.35rem 0.75rem',
  borderRadius: 7,
  fontSize: '0.85rem',
  cursor: 'pointer',
}
export const selector: CSSProperties = { padding: '0.3rem 0.4rem' }
export const rotulo: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#5a6b7d' }
export const celda: CSSProperties = { padding: '4px 8px', borderBottom: '1px solid #eef1f4', verticalAlign: 'top' }
export const celdaNum: CSSProperties = { padding: '2px 6px', textAlign: 'right', borderBottom: '1px solid #eef1f4' }
