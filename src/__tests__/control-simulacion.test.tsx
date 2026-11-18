// @vitest-environment jsdom
/**
 * Los controles de simulación que comparten las cuatro unidades: el play dentro de la escena
 * y la barra de tiempo bajo ella.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BotonPlayEscena } from '../components/PlayEscena'
import BarraTiempo from '../components/BarraTiempo'

afterEach(cleanup)

describe('play dentro de la escena', () => {
  it('parte en ▶ Reproducir y llama a onClick', () => {
    const onClick = vi.fn()
    render(<BotonPlayEscena play={{ etiqueta: '▶ Simular', onClick }} />)
    const boton = screen.getByRole('button', { name: 'Reproducir' })
    expect(boton.textContent).toBe('▶')
    expect(boton.getAttribute('data-play-escena')).toBe('si')
    fireEvent.click(boton)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('al correr muestra ❚❚ (pausa) o ■ (parar) según la unidad', () => {
    const { rerender } = render(<BotonPlayEscena play={{ etiqueta: 'x', onClick: () => {}, corriendo: true }} />)
    expect(screen.getByRole('button', { name: 'Pausa' }).textContent).toBe('❚❚')
    rerender(<BotonPlayEscena play={{ etiqueta: 'x', onClick: () => {}, corriendo: true, detiene: true }} />)
    expect(screen.getByRole('button', { name: 'Parar' }).textContent).toBe('■')
  })

  it('deshabilitado no responde', () => {
    const onClick = vi.fn()
    render(<BotonPlayEscena play={{ etiqueta: 'x', onClick, deshabilitado: true }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('barra de tiempo', () => {
  it('con total y onBuscar hay deslizador y el tiempo sale como «t / total s»', () => {
    const onBuscar = vi.fn()
    render(<BarraTiempo tiempo={3.25} total={10} onBuscar={onBuscar} velocidad={1} velocidades={[0.5, 1, 2]} onVelocidad={() => {}} />)
    expect(screen.getByText('3.3 / 10.0 s')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Tiempo de la simulación'), { target: { value: '5' } })
    expect(onBuscar).toHaveBeenCalledWith(5)
  })

  it('en tiempo real no inventa un deslizador: solo tiempo, velocidad y reiniciar', () => {
    const onVelocidad = vi.fn()
    const onReiniciar = vi.fn()
    render(<BarraTiempo tiempo={2} velocidad={1} velocidades={[0.5, 1, 2]} onVelocidad={onVelocidad} onReiniciar={onReiniciar} />)
    expect(screen.queryByLabelText('Tiempo de la simulación')).toBeNull()
    expect(screen.getByText('2.0 s')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Velocidad'), { target: { value: '2' } })
    expect(onVelocidad).toHaveBeenCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar' }))
    expect(onReiniciar).toHaveBeenCalledTimes(1)
  })
})
