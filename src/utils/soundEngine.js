// Procedural Web Audio API Sound Engine for Ordo Realitas VTT
// Generates atmospheric background drones and instant tabletop/paranormal SFX without external assets

class OrdoSoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientNodes = null;
    this.activeTrack = null;
    this.volume = 0.65;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return true;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  stopAmbient() {
    if (this.ambientNodes) {
      try {
        this.ambientNodes.forEach((n) => {
          if (n.stop) n.stop();
          if (n.disconnect) n.disconnect();
        });
      } catch {
        // ignore already stopped nodes
      }
      this.ambientNodes = null;
    }
    this.activeTrack = null;
  }

  playAmbient(trackId) {
    if (!this.init()) return null;
    if (this.activeTrack === trackId) {
      this.stopAmbient();
      return null;
    }
    this.stopAmbient();
    this.activeTrack = trackId;

    const now = this.ctx.currentTime;
    const nodes = [];
    const trackGain = this.ctx.createGain();
    trackGain.gain.setValueAtTime(0.01, now);
    trackGain.gain.linearRampToValueAtTime(0.28, now + 1.2);
    trackGain.connect(this.masterGain);
    nodes.push(trackGain);

    if (trackId === 'investigacao') {
      // Dark Noir Sub-Drone
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.value = 55; // A1
      osc2.frequency.value = 82.41; // E2
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(trackGain);
      osc1.start();
      osc2.start();
      nodes.push(osc1, osc2, filter);
    } else if (trackId === 'membrana') {
      // Unsettling Dissonant Paranormal Drone
      const freqs = [61.74, 65.41, 92.5, 130.81];
      freqs.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'sawtooth';
        osc.frequency.value = f;
        lfo.frequency.value = 0.15 + idx * 0.07;
        lfoGain.gain.value = 2.5;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 240;
        osc.connect(filter);
        filter.connect(trackGain);
        osc.start();
        lfo.start();
        nodes.push(osc, lfo, lfoGain, filter);
      });
    } else if (trackId === 'combate') {
      // Pulsing Aggressive Bass Drone
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.value = 46.25; // F#1
      filter.type = 'lowpass';
      filter.frequency.value = 140;
      lfo.type = 'square';
      lfo.frequency.value = 2.2; // 132 BPM pulse
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      osc.connect(filter);
      filter.connect(trackGain);
      osc.start();
      lfo.start();
      nodes.push(osc, lfo, lfoGain, filter);
    } else if (trackId === 'chuva') {
      // Filtered Pink/White Noise Rain
      const bufferSize = this.ctx.sampleRate * 3;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 950;
      whiteNoise.connect(filter);
      filter.connect(trackGain);
      whiteNoise.start();
      nodes.push(whiteNoise, filter);
    }

    this.ambientNodes = nodes;
    return this.activeTrack;
  }

  playSFX(type) {
    if (!this.init()) return;
    const now = this.ctx.currentTime;

    if (type === 'door_knock') {
      // 3 heavy wooden knocks
      [0, 0.24, 0.52].forEach((offset) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(135, now + offset);
        osc.frequency.exponentialRampToValueAtTime(38, now + offset + 0.14);
        gain.gain.setValueAtTime(0.85, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.17);
      });
    } else if (type === 'door_creak') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.linearRampToValueAtTime(165, now + 0.25);
      osc.frequency.linearRampToValueAtTime(240, now + 0.55);
      filter.type = 'bandpass';
      filter.frequency.value = 520;
      filter.Q.value = 6;
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.62);
    } else if (type === 'door_locked') {
      // Metallic rattle
      [0, 0.09].forEach((offset) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(420, now + offset);
        osc.frequency.exponentialRampToValueAtTime(110, now + offset + 0.07);
        gain.gain.setValueAtTime(0.35, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.085);
      });
    } else if (type === 'glass_break') {
      // High frequency noise burst + metallic shards
      const bufferSize = this.ctx.sampleRate * 0.45;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.12));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1800;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.6;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);

      [2400, 3100, 4200, 5100].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.18, now + i * 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.18);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.2);
      });
    } else if (type === 'whispers') {
      // Eerie modulated bandpass noise ("Outro Lado" whispers)
      const bufferSize = this.ctx.sampleRate * 1.6;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.linearRampToValueAtTime(1600, now + 0.7);
      filter.frequency.linearRampToValueAtTime(650, now + 1.5);
      filter.Q.value = 8;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.6);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);
    } else if (type === 'heartbeat') {
      // Double thump lub-dub
      [
        { t: 0, f: 65 },
        { t: 0.18, f: 52 },
        { t: 0.75, f: 68 },
        { t: 0.93, f: 54 },
      ].forEach(({ t, f }) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + t);
        osc.frequency.exponentialRampToValueAtTime(24, now + t + 0.15);
        gain.gain.setValueAtTime(0.9, now + t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.17);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + t);
        osc.stop(now + t + 0.18);
      });
    } else if (type === 'dice_roll') {
      // Clattering polyhedral dice on wood table
      [0, 0.07, 0.16, 0.27, 0.39].forEach((t, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320 + idx * 55, now + t);
        osc.frequency.exponentialRampToValueAtTime(95, now + t + 0.045);
        gain.gain.setValueAtTime(0.35 * Math.pow(0.78, idx), now + t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.05);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + t);
        osc.stop(now + t + 0.055);
      });
    } else if (type === 'ritual') {
      // Deep paranormal resonance chord
      [110, 146.83, 164.81, 220].forEach((f) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * 1.04, now + 1.1);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(120, now + 1.2);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 1.3);
      });
    }
  }
}

export const soundEngine = new OrdoSoundEngine();
