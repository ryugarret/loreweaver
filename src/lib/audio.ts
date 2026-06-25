/**
 * Motor de sonido ambiente 100% generativo (Web Audio API).
 * No usa archivos: sintetiza ruido filtrado en tiempo real, así funciona
 * offline y pesa cero. Ideal para concentrarse al escribir.
 *
 * Cada ambiente parte de ruido (blanco/marrón) NORMALIZADO (sin clipping) y se
 * moldea con filtros + LFOs para que suene a lo que dice, no a ruido plano:
 *   - lluvia: cuerpo grave + siseo con brillo y un leve titileo.
 *   - mar:    oleaje que sube de volumen y "rompe" (el filtro se abre) y baja.
 *   - viento: aullido (barrido del filtro) + ráfagas (modulación de volumen).
 *   - espacio: drone grave afinado (raíz + quinta) + filtro que evoluciona.
 * Entradas/salidas con fundido para no dar clicks al empezar o cambiar.
 */

export type Soundscape = 'rain' | 'ocean' | 'wind' | 'space'

export const SOUNDSCAPES: { id: Soundscape; name: string; emoji: string }[] = [
  { id: 'rain', name: 'Lluvia', emoji: '🌧️' },
  { id: 'ocean', name: 'Mar', emoji: '🌊' },
  { id: 'wind', name: 'Viento', emoji: '🍃' },
  { id: 'space', name: 'Espacio', emoji: '🌌' },
]

interface Voice {
  nodes: AudioNode[]
  out: GainNode
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private voices: Voice[] = []
  current: Soundscape | null = null
  volume = 0.5

  private ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** Ruido de 5 s, sin offset de DC y normalizado a pico ~0.9 (no clipea). */
  private noiseBuffer(kind: 'white' | 'brown'): AudioBuffer {
    const ctx = this.ctx!
    const len = ctx.sampleRate * 5
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    if (kind === 'white') {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    } else {
      let last = 0
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1
        last = (last + 0.02 * white) / 1.02
        data[i] = last
      }
    }
    // quitar offset de DC
    let mean = 0
    for (let i = 0; i < len; i++) mean += data[i]
    mean /= len
    // normalizar a pico 0.9
    let peak = 0
    for (let i = 0; i < len; i++) {
      data[i] -= mean
      const a = Math.abs(data[i])
      if (a > peak) peak = a
    }
    if (peak > 0) {
      const k = 0.9 / peak
      for (let i = 0; i < len; i++) data[i] *= k
    }
    return buffer
  }

  private noise(kind: 'white' | 'brown'): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource()
    src.buffer = this.noiseBuffer(kind)
    src.loop = true
    return src
  }

  private osc(freq: number, type: OscillatorType = 'sine'): OscillatorNode {
    const o = this.ctx!.createOscillator()
    o.type = type
    o.frequency.value = freq
    return o
  }

  private filter(type: BiquadFilterType, freq: number, q?: number): BiquadFilterNode {
    const f = this.ctx!.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    if (q !== undefined) f.Q.value = q
    return f
  }

  private gain(v: number): GainNode {
    const g = this.ctx!.createGain()
    g.gain.value = v
    return g
  }

  play(scape: Soundscape) {
    this.ensure()
    this.stop()
    const ctx = this.ctx!
    const t = ctx.currentTime
    this.current = scape

    // Salida del ambiente con fundido de entrada (evita clicks / crossfade).
    const out = this.gain(0)
    out.gain.setValueAtTime(0, t)
    out.gain.linearRampToValueAtTime(1, t + 0.8)
    out.connect(this.master!)

    let nodes: AudioNode[]

    if (scape === 'rain') {
      const src = this.noise('white')
      // cuerpo grave (lluvia cercana) + siseo brillante (gotas)
      const body = this.filter('lowpass', 900)
      const bodyG = this.gain(0.28)
      const hiss = this.filter('highpass', 1200)
      const hissLp = this.filter('lowpass', 7500)
      const hissG = this.gain(0.4)
      // leve titileo del siseo
      const lfo = this.osc(0.4)
      const lfoG = this.gain(0.08)
      lfo.connect(lfoG).connect(hissG.gain)
      src.connect(body).connect(bodyG).connect(out)
      src.connect(hiss).connect(hissLp).connect(hissG).connect(out)
      src.start()
      lfo.start()
      nodes = [src, body, bodyG, hiss, hissLp, hissG, lfo, lfoG]
    } else if (scape === 'ocean') {
      const src = this.noise('brown')
      const lp = this.filter('lowpass', 650)
      const g = this.gain(0.42)
      // una sola LFO lenta mueve volumen Y brillo: la ola sube, rompe y baja
      const lfo = this.osc(0.08)
      const swell = this.gain(0.26) // volumen 0.16–0.68
      const wash = this.gain(550) // corte 100–1200 (rompe = más brillo)
      lfo.connect(swell).connect(g.gain)
      lfo.connect(wash).connect(lp.frequency)
      src.connect(lp).connect(g).connect(out)
      src.start()
      lfo.start()
      nodes = [src, lp, g, lfo, swell, wash]
    } else if (scape === 'wind') {
      const src = this.noise('white')
      const bp = this.filter('bandpass', 500, 1.4)
      const g = this.gain(0.5)
      // aullido: barrido lento de la frecuencia del bandpass
      const howl = this.osc(0.06)
      const howlG = this.gain(420) // 80–920 Hz
      howl.connect(howlG).connect(bp.frequency)
      // ráfagas: modulación de volumen un poco más rápida
      const gust = this.osc(0.13)
      const gustG = this.gain(0.26)
      gust.connect(gustG).connect(g.gain)
      src.connect(bp).connect(g).connect(out)
      src.start()
      howl.start()
      gust.start()
      nodes = [src, bp, g, howl, howlG, gust, gustG]
    } else {
      // espacio: ruido marrón muy filtrado + drone grave afinado + evolución lenta
      const src = this.noise('brown')
      const lp = this.filter('lowpass', 320)
      const g = this.gain(0.34)
      const move = this.osc(0.03)
      const moveG = this.gain(140) // el corte respira 180–460 Hz
      move.connect(moveG).connect(lp.frequency)
      const d1 = this.osc(55, 'sine')
      const d2 = this.osc(82.5, 'sine') // quinta justa (55 * 3/2)
      const droneG = this.gain(0.09)
      d1.connect(droneG)
      d2.connect(droneG)
      droneG.connect(out)
      src.connect(lp).connect(g).connect(out)
      src.start()
      move.start()
      d1.start()
      d2.start()
      nodes = [src, lp, g, move, moveG, d1, d2, droneG]
    }

    this.voices.push({ nodes, out })
  }

  /** Funde a cero el ambiente actual y limpia los nodos sin clicks. */
  stop() {
    const ctx = this.ctx
    for (const v of this.voices) {
      if (ctx) {
        const t = ctx.currentTime
        try {
          v.out.gain.cancelScheduledValues(t)
          v.out.gain.setValueAtTime(v.out.gain.value, t)
          v.out.gain.linearRampToValueAtTime(0, t + 0.4)
        } catch {
          /* ignore */
        }
      }
      window.setTimeout(() => {
        for (const node of v.nodes) {
          try {
            if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
              ;(node as OscillatorNode).stop()
            }
            node.disconnect()
          } catch {
            /* ignore */
          }
        }
        try {
          v.out.disconnect()
        } catch {
          /* ignore */
        }
      }, 500)
    }
    this.voices = []
    this.current = null
  }

  setVolume(v: number) {
    this.volume = v
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
    }
  }
}

export const audio = new AudioEngine()
