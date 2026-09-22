/**
 * Sonido del banco 3D, sintetizado con Web Audio (sin grabaciones): lo que
 * se oye en el laboratorio de neumática.
 *
 *  - Válvula: el «chac» seco de la corredera al conmutar.
 *  - Rodillo: el clic fino del microinterruptor del final de carrera.
 *  - Tope: el golpe sordo del émbolo contra la culata al final de la carrera.
 *  - Escape: el soplido del aire por el silenciador; de golpe cuando se
 *    ventea una línea, sostenido mientras una cámara se vacía.
 *  - Motor neumático: el silbido de las paletas, más agudo cuanto más gira.
 *
 * Cada sonido se coloca a izquierda o derecha según dónde esté la pieza en
 * pantalla, así se sabe de oído qué válvula ha soplado.
 */
import type { TipoGolpe } from './oido'

type Contexto = AudioContext

export class SonidoBanco {
  private ctx: Contexto | null = null
  private master: GainNode | null = null
  private ruido: AudioBuffer | null = null
  private siseo: { gain: GainNode; pan: StereoPannerNode } | null = null
  private silbido: { osc: OscillatorNode; filtro: BiquadFilterNode; gain: GainNode } | null = null
  private volumen = 0.8

  /** Crea o reanuda el audio. Hay que llamarlo desde un gesto del usuario. */
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
      // Un compresor al final evita saturar cuando suenan varias cosas a la vez.
      const limitador = ctx.createDynamicsCompressor()
      limitador.threshold.value = -10
      limitador.ratio.value = 6
      limitador.connect(ctx.destination)
      this.master = ctx.createGain()
      this.master.gain.value = this.volumen
      this.master.connect(limitador)
      this.ruido = crearRuido(ctx)
      this.siseo = this.crearSiseo()
      this.silbido = this.crearSilbido()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
  }

  get activo(): boolean {
    return this.ctx?.state === 'running'
  }

  setVolumen(v: number): void {
    this.volumen = v
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03)
  }

  /** Corta los sonidos sostenidos (al pausar, salir de la vista o silenciar). */
  callar(): void {
    this.continuo(0, 0)
    this.motor(0)
  }

  cerrar(): void {
    const ctx = this.ctx
    this.ctx = null
    this.siseo = null
    this.silbido = null
    if (ctx) void ctx.close().catch(() => {})
  }

  golpe(tipo: TipoGolpe, intensidad: number, pan: number): void {
    const ctx = this.listo()
    if (!ctx) return
    const t = ctx.currentTime + 0.005
    const salida = this.panear(pan)
    const i = intensidad
    switch (tipo) {
      case 'valvula':
        // Corredera metálica: chasquido brillante + cuerpo grave muy corto.
        this.rafagaRuido(salida, t, { frec: 2300, q: 1.4, pico: 0.55 * i, ataque: 0.001, caida: 0.018 })
        this.rafagaRuido(salida, t + 0.004, { frec: 5200, q: 2, pico: 0.18 * i, ataque: 0.0005, caida: 0.008 })
        this.tono(salida, t, { desde: 260, hasta: 110, pico: 0.3 * i, caida: 0.045, forma: 'triangle' })
        break
      case 'rodillo':
        // Microinterruptor: clic seco y agudo, casi sin cuerpo.
        this.rafagaRuido(salida, t, { frec: 4200, q: 3, pico: 0.32 * i, ataque: 0.0005, caida: 0.006 })
        this.tono(salida, t, { desde: 1400, hasta: 900, pico: 0.08 * i, caida: 0.012, forma: 'square' })
        break
      case 'bola':
        this.rafagaRuido(salida, t, { frec: 3200, q: 4, pico: 0.12 * i, ataque: 0.0005, caida: 0.01 })
        break
      case 'tope':
        // Émbolo contra la culata: golpe sordo que resuena en el perfil de aluminio.
        this.tono(salida, t, { desde: 120, hasta: 48, pico: 0.9 * i, caida: 0.16, forma: 'sine' })
        this.rafagaRuido(salida, t, { frec: 700, q: 0.9, pico: 0.45 * i, ataque: 0.001, caida: 0.05 })
        this.rafagaRuido(salida, t, { frec: 2800, q: 1.5, pico: 0.16 * i, ataque: 0.0005, caida: 0.012 })
        this.tono(salida, t + 0.002, { desde: 1850, hasta: 1800, pico: 0.03 * i, caida: 0.25, forma: 'sine' })
        break
      case 'llave':
        this.rafagaRuido(salida, t, { frec: 1500, q: 1, pico: 0.35 * i, ataque: 0.002, caida: 0.03 })
        this.tono(salida, t, { desde: 320, hasta: 180, pico: 0.2 * i, caida: 0.06, forma: 'triangle' })
        break
    }
  }

  /** Descarga de una línea por un escape: «pssht» que se apaga en medio segundo. */
  rafaga(intensidad: number, pan: number): void {
    const ctx = this.listo()
    if (!ctx) return
    const t = ctx.currentTime + 0.005
    const salida = this.panear(pan)
    const dur = 0.25 + intensidad * 0.45
    this.rafagaRuido(salida, t, { frec: 3600, q: 0.6, pico: 0.5 * intensidad, ataque: 0.008, caida: dur / 3.5, largo: dur })
    this.rafagaRuido(salida, t, { frec: 900, q: 0.7, pico: 0.18 * intensidad, ataque: 0.01, caida: dur / 5, largo: dur })
  }

  /** Soplido sostenido de las cámaras que se vacían (0 = nada). */
  continuo(intensidad: number, pan: number): void {
    const ctx = this.ctx
    if (!ctx || !this.siseo) return
    const t = ctx.currentTime
    this.siseo.gain.gain.setTargetAtTime(Math.min(1, intensidad) * 0.3, t, intensidad > 0 ? 0.04 : 0.09)
    this.siseo.pan.pan.setTargetAtTime(limitar(pan), t, 0.05)
  }

  /** Silbido del motor neumático, en vueltas/s (0 = parado). */
  motor(velocidad: number): void {
    const ctx = this.ctx
    if (!ctx || !this.silbido) return
    const t = ctx.currentTime
    const f = 180 + velocidad * 900
    this.silbido.osc.frequency.setTargetAtTime(f, t, 0.15)
    this.silbido.filtro.frequency.setTargetAtTime(f * 2, t, 0.15)
    this.silbido.gain.gain.setTargetAtTime(velocidad > 0 ? Math.min(0.09, 0.03 + velocidad * 0.1) : 0, t, 0.12)
  }

  // --- piezas de síntesis -------------------------------------------------------

  private listo(): Contexto | null {
    return this.ctx && this.ctx.state === 'running' && this.master ? this.ctx : null
  }

  private panear(pan: number): AudioNode {
    const ctx = this.ctx!
    const p = ctx.createStereoPanner()
    p.pan.value = limitar(pan)
    p.connect(this.master!)
    return p
  }

  private rafagaRuido(
    destino: AudioNode,
    t: number,
    o: { frec: number; q: number; pico: number; ataque: number; caida: number; largo?: number },
  ): void {
    const ctx = this.ctx!
    const fuente = ctx.createBufferSource()
    fuente.buffer = this.ruido
    const largo = o.largo ?? o.ataque + o.caida * 7
    // Cada ráfaga empieza en un punto distinto del ruido: no suenan todas iguales.
    const desfase = Math.random() * Math.max(0, 1.9 - largo)
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'bandpass'
    filtro.frequency.value = o.frec * (0.93 + Math.random() * 0.14)
    filtro.Q.value = o.q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(Math.max(0.0002, o.pico), t + o.ataque)
    g.gain.setTargetAtTime(0.0001, t + o.ataque, o.caida)
    fuente.connect(filtro).connect(g).connect(destino)
    fuente.start(t, desfase, largo + 0.02)
  }

  private tono(
    destino: AudioNode,
    t: number,
    o: { desde: number; hasta: number; pico: number; caida: number; forma: OscillatorType },
  ): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = o.forma
    osc.frequency.setValueAtTime(o.desde, t)
    osc.frequency.exponentialRampToValueAtTime(o.hasta, t + o.caida * 2)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(o.pico, t + 0.002)
    g.gain.setTargetAtTime(0.0001, t + 0.002, o.caida / 2.5)
    osc.connect(g).connect(destino)
    osc.start(t)
    osc.stop(t + o.caida * 5 + 0.05)
  }

  private crearSiseo() {
    const ctx = this.ctx!
    const fuente = ctx.createBufferSource()
    fuente.buffer = this.ruido
    fuente.loop = true
    const alto = ctx.createBiquadFilter()
    alto.type = 'highpass'
    alto.frequency.value = 900
    const banda = ctx.createBiquadFilter()
    banda.type = 'peaking'
    banda.frequency.value = 3800
    banda.gain.value = 6
    const gain = ctx.createGain()
    gain.gain.value = 0
    const pan = ctx.createStereoPanner()
    fuente.connect(alto).connect(banda).connect(gain).connect(pan).connect(this.master!)
    fuente.start()
    return { gain, pan }
  }

  private crearSilbido() {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 180
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'bandpass'
    filtro.Q.value = 3
    filtro.frequency.value = 360
    const gain = ctx.createGain()
    gain.gain.value = 0
    osc.connect(filtro).connect(gain).connect(this.master!)
    osc.start()
    return { osc, filtro, gain }
  }
}

const limitar = (pan: number) => Math.max(-1, Math.min(1, pan))

/** Dos segundos de ruido blanco, la materia prima de soplidos y chasquidos. */
function crearRuido(ctx: Contexto): AudioBuffer {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}
