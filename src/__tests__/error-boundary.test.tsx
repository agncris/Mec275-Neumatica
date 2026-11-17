// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ErrorBoundary from '../components/ErrorBoundary'

function Roto(): never {
  throw new Error('prueba')
}

describe('ErrorBoundary de unidad', () => {
  afterEach(cleanup)

  it('si un hijo lanza, muestra el aviso con los dos botones', () => {
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary alVolver={() => {}}>
        <Roto />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert').textContent).toContain('Algo falló en esta unidad')
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Volver a Neumática' })).toBeTruthy()
    silencio.mockRestore()
  })

  it('«Volver a Neumática» llama a alVolver', () => {
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {})
    const alVolver = vi.fn()
    render(
      <ErrorBoundary alVolver={alVolver}>
        <Roto />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Neumática' }))
    expect(alVolver).toHaveBeenCalledTimes(1)
    silencio.mockRestore()
  })

  it('sin errores deja pasar a los hijos', () => {
    render(
      <ErrorBoundary alVolver={() => {}}>
        <p>todo bien</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('todo bien')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
