/**
 * Sonido de la máquina CNC, sintetizado con Web Audio: el zumbido del
 * husillo (más agudo cuanto más rápido gira), el chirrido del corte cuando
 * la herramienta arranca material y el silbido de los ejes en avance rápido.
 */
export class SonidoCNC {
  private ctx: AudioContext | null = null
  private husillo: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null
  private corte: { gain: GainNode; filtro: BiquadFilterNode } | null = null
  private ejes: { osc: OscillatorNode; gain: GainNode } | null = null

  activar(): void {
    const Ctor: typeof AudioContext | undefined =
      typeof window === 'undefined'
        ? undefined
        : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    if (!this.ctx) {
      try {
        this.ctx = new Ctor()
      } catch {
        return
      }
      const ctx = this.ctx
      const master = ctx.createGain()
      master.gain.value = 0.5
      const comp = ctx.createDynamicsCompressor()
      master.connect(comp).connect(ctx.destination)

      // Husillo: dos osciladores filtrados.
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      const filtro = ctx.createBiquadFilter()
      filtro.type = 'lowpass'
      filtro.frequency.value = 900
      const g = ctx.createGain()
      g.gain.value = 0
      osc.connect(filtro)
      osc2.connect(filtro)
      filtro.connect(g).connect(master)
      osc.start()
      osc2.start()
      this.husillo = { osc, osc2, gain: g }

      // Corte: ruido filtrado.
      const n = ctx.sampleRate
      const buf = ctx.createBuffer(1, n, n)
      const d = buf.getChannelData(0)
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
      const ruido = ctx.createBufferSource()
      ruido.buffer = buf
      ruido.loop = true
      const fc = ctx.createBiquadFilter()
      fc.type = 'bandpass'
      fc.frequency.value = 2400
      fc.Q.value = 1.4
      const gc = ctx.createGain()
      gc.gain.value = 0
      ruido.connect(fc).connect(gc).connect(master)
      ruido.start()
      this.corte = { gain: gc, filtro: fc }

      // Servos de los ejes.
      const oe = ctx.createOscillator()
      oe.type = 'triangle'
      oe.frequency.value = 520
      const ge = ctx.createGain()
      ge.gain.value = 0
      oe.connect(ge).connect(master)
      oe.start()
      this.ejes = { osc: oe, gain: ge }
    }
    void this.ctx.resume()
  }

  /** rpm del husillo, cuánto corta (0–1) y si se mueve en rápido. */
  actualizar(rpm: number, corte: number, rapido: boolean): void {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    if (this.husillo) {
      const f = 40 + rpm / 30
      this.husillo.osc.frequency.setTargetAtTime(f, t, 0.15)
      this.husillo.osc2.frequency.setTargetAtTime(f * 2.01, t, 0.15)
      this.husillo.gain.gain.setTargetAtTime(rpm > 0 ? 0.08 : 0, t, 0.2)
    }
    if (this.corte) {
      this.corte.gain.gain.setTargetAtTime(Math.min(0.35, corte * 0.35), t, 0.05)
      this.corte.filtro.frequency.setTargetAtTime(1800 + Math.min(rpm, 4000) / 2, t, 0.1)
    }
    if (this.ejes) this.ejes.gain.gain.setTargetAtTime(rapido ? 0.03 : 0, t, 0.05)
  }

  callar(): void {
    this.actualizar(0, 0, false)
  }

  cerrar(): void {
    void this.ctx?.close()
    this.ctx = null
    this.husillo = null
    this.corte = null
    this.ejes = null
  }
}
