/**
 * Límite de error por unidad: si algo falla al dibujar una unidad, la página no
 * queda en blanco. Se avisa y se ofrece recargar o volver a Neumática. No borra
 * nada: el trabajo vive en el almacenamiento del navegador.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Vuelve a Neumática (la unidad de inicio). */
  alVolver: () => void
}

type Estado = { fallo: Error | null }

export default class ErrorBoundary extends Component<Props, Estado> {
  state: Estado = { fallo: null }

  static getDerivedStateFromError(fallo: Error): Estado {
    return { fallo }
  }

  componentDidCatch(fallo: Error, info: ErrorInfo) {
    console.error('Falló una unidad de NeumaLab:', fallo, info.componentStack)
  }

  render() {
    if (!this.state.fallo) return this.props.children
    return (
      <div role="alert" style={{ maxWidth: 520, margin: '48px auto', padding: '0 16px', textAlign: 'center', color: '#33475c' }}>
        <h2 style={{ margin: '0 0 8px' }}>Algo falló en esta unidad</h2>
        <p style={{ margin: '0 0 16px', color: '#51606f' }}>Tu trabajo sigue guardado en este navegador. Recarga la página o vuelve a Neumática.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => window.location.reload()}>
            Recargar
          </button>
          <button
            type="button"
            onClick={() => {
              this.setState({ fallo: null })
              this.props.alVolver()
            }}
          >
            Volver a Neumática
          </button>
        </div>
      </div>
    )
  }
}
