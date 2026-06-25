/**
 * Sonido de teclado mecánico realista (Web Audio), sin archivos.
 *
 * Clave del realismo: un teclado mecánico NO tiene graves (eso sonaría a
 * tambor). Es un "click" agudo y muy corto (ráfaga de ruido filtrada a
 * 2-5 kHz) + un "clack/cuerpo" de plástico (ruido por filtro resonante de
 * banda media, NUNCA un tono grave puro). Se sintetiza con ruido filtrado y
 * envolventes ultracortas, con variación aleatoria por pulsación y sonido
 * distinto al pulsar y al soltar. 4 perfiles de switch seleccionables.
 */

export type KeyProfile = 'blue' | 'brown' | 'red' | 'thock'

export const KEY_PROFILES: { id: KeyProfile; name: string; emoji: string }[] = [
  { id: 'blue', name: 'Azul', emoji: '🔵' },
  { id: 'brown', name: 'Marrón', emoji: '🟤' },
  { id: 'red', name: 'Rojo', emoji: '🔴' },
  { id: 'thock', name: 'Thock', emoji: '🟣' },
]

interface ProfileSpec {
  clickFreq: number // frecuencia del "click" agudo
  clickQ: number
  clickDur: number
  body: number // resonancia de "cuerpo/clack" (media, no grave)
  bodyQ: number
  bodyGain: number
  bodyDur: number
  hp: number // corte de graves
  bright: number // brillo del click
  doubleClick: boolean // switches clicky tienen doble transitorio
}

const SPECS: Record<KeyProfile, ProfileSpec> = {
  blue: {
    clickFreq: 4200, clickQ: 1.2, clickDur: 0.009,
    body: 820, bodyQ: 6, bodyGain: 0.16, bodyDur: 0.020,
    hp: 1800, bright: 1.0, doubleClick: true,
  },
  brown: {
    clickFreq: 2700, clickQ: 1.0, clickDur: 0.011,
    body: 700, bodyQ: 5, bodyGain: 0.2, bodyDur: 0.026,
    hp: 1200, bright: 0.72, doubleClick: false,
  },
  red: {
    clickFreq: 2100, clickQ: 0.9, clickDur: 0.012,
    body: 580, bodyQ: 4.5, bodyGain: 0.19, bodyDur: 0.03,
    hp: 950, bright: 0.55, doubleClick: false,
  },
  thock: {
    clickFreq: 1600, clickQ: 0.8, clickDur: 0.014,
    body: 400, bodyQ: 7, bodyGain: 0.3, bodyDur: 0.04,
    hp: 520, bright: 0.5, doubleClick: false,
  },
}

class KeyboardSound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  enabled = false
  volume = 0.5
  profile: KeyProfile = 'blue'

  private ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 1
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** Una ráfaga de ruido filtrada (un transitorio). */
  private burst(
    t: number,
    freq: number,
    q: number,
    dur: number,
    gain: number,
    hp: number,
  ) {
    const ctx = this.ctx!
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const k = 1 - i / len
      d[i] = (Math.random() * 2 - 1) * k * k // decaimiento rápido
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    let node: AudioNode = src
    if (hp) {
      const f = ctx.createBiquadFilter()
      f.type = 'highpass'
      f.frequency.value = hp
      node.connect(f)
      node = f
    }
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = q
    node.connect(bp)
    const g = ctx.createGain()
    g.gain.setValueAtTime(Math.max(0.0001, gain), t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.6)
    bp.connect(g).connect(this.master!)
    src.start(t)
    src.stop(t + dur * 1.8)
  }

  /** Pulsación de tecla. */
  click(strong = false) {
    if (!this.enabled) return
    try {
      this.ensure()
      const p = SPECS[this.profile]
      const t = this.ctx!.currentTime
      const rnd = 1 + (Math.random() * 0.26 - 0.13) // ±13% por tecla
      const vol = this.volume * (strong ? 1 : 0.86)
      // click agudo
      this.burst(t, p.clickFreq * rnd, p.clickQ, p.clickDur, vol * 0.9 * p.bright, p.hp)
      // cuerpo / clack (media frecuencia, plástico)
      this.burst(t, p.body * rnd, p.bodyQ, p.bodyDur, vol * p.bodyGain, 0)
      // segundo click (switches clicky)
      if (p.doubleClick) {
        this.burst(
          t + 0.006,
          p.clickFreq * 1.12 * rnd,
          p.clickQ * 1.3,
          p.clickDur * 0.8,
          vol * 0.5 * p.bright,
          p.hp,
        )
      }
    } catch {
      /* ignore */
    }
  }

  /** Soltar la tecla (más suave y apagado). */
  release() {
    if (!this.enabled) return
    try {
      this.ensure()
      const p = SPECS[this.profile]
      const t = this.ctx!.currentTime
      const rnd = 1 + (Math.random() * 0.2 - 0.1)
      const vol = this.volume * 0.38
      this.burst(t, p.clickFreq * 0.85 * rnd, p.clickQ, p.clickDur * 0.9, vol * 0.7 * p.bright, p.hp)
      this.burst(t, p.body * 0.9 * rnd, p.bodyQ, p.bodyDur * 0.7, vol * p.bodyGain * 0.6, 0)
    } catch {
      /* ignore */
    }
  }
}

export const keySound = new KeyboardSound()
