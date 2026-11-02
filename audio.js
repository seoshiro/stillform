/** A small, gesture-activated, local Web Audio sound engine. No external audio. */
export class SoundEngine {
  context = null;
  master = null;
  layers = {};
  voices = [];
  playing = false;

  create() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('This browser does not support Web Audio. Try a recent Chrome, Safari, Firefox, or Edge.');
    this.context = new AudioContext();
    const ctx = this.context;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.knee.value = 20;
    limiter.ratio.value = 8;
    this.master.connect(limiter).connect(ctx.destination);

    // Two differently filtered channels share a seamless, eight-second noise bed.
    const buffer = ctx.createBuffer(2, ctx.sampleRate * 8, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let brown = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + white * 0.02) / 1.02;
        data[i] = brown * 3.5 + white * 0.16;
      }
      // Blend the ends to prevent a click at the loop boundary.
      const fade = Math.floor(ctx.sampleRate * 0.08);
      for (let i = 0; i < fade; i++) {
        const blend = i / fade;
        data[i] = data[i] * blend + data[data.length - fade + i] * (1 - blend);
      }
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'highpass';
    this.rainFilter.frequency.value = 850;
    const rainLow = ctx.createBiquadFilter();
    rainLow.type = 'lowpass';
    rainLow.frequency.value = 5500;
    const texture = ctx.createGain();
    noise.connect(this.rainFilter).connect(rainLow).connect(texture).connect(this.master);
    this.layers.texture = texture;

    this.tideFilter = ctx.createBiquadFilter();
    this.tideFilter.type = 'lowpass';
    this.tideFilter.frequency.value = 390;
    const tide = ctx.createGain();
    const depth = ctx.createGain();
    tide.gain.value = 0.6;
    const wave = ctx.createOscillator();
    wave.frequency.value = 0.09;
    const waveGain = ctx.createGain();
    waveGain.gain.value = 0.24;
    wave.connect(waveGain).connect(tide.gain);
    noise.connect(this.tideFilter).connect(tide).connect(depth).connect(this.master);
    this.layers.depth = depth;
    wave.start();
    noise.start();

    const drift = ctx.createGain();
    drift.connect(this.master);
    this.layers.drift = drift;
    [110, 164.81, 220, 277.18].forEach((frequency, index) => {
      const voice = ctx.createOscillator();
      voice.type = 'sine';
      voice.frequency.value = frequency;
      const level = ctx.createGain();
      level.gain.value = [0.17, 0.08, 0.045, 0.025][index];
      const breath = ctx.createOscillator();
      breath.frequency.value = 0.04 + index * 0.017;
      const breathGain = ctx.createGain();
      breathGain.gain.value = level.gain.value * 0.26;
      breath.connect(breathGain).connect(level.gain);
      voice.connect(level).connect(drift);
      voice.start();
      breath.start();
      this.voices.push(voice);
    });
  }

  setMix(mix, master) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const scales = { texture: 0.9, depth: 0.8, drift: 0.85 };
    Object.entries(this.layers).forEach(([key, gain]) => {
      gain.gain.setTargetAtTime(mix[key] / 100 * scales[key], now, 0.25);
    });
    this.master.gain.setTargetAtTime(this.playing ? master / 100 * 0.28 : 0, now, 0.12);
  }

  setScene(scene) {
    if (!this.context) return;
    const settings = {
      ember: { notes: [110, 164.81, 220, 277.18], rain: 850, tide: 390 },
      tidal: { notes: [130.81, 196, 261.63, 329.63], rain: 1250, tide: 600 },
      orbit: { notes: [98, 146.83, 196, 246.94], rain: 1900, tide: 240 },
    }[scene];
    const now = this.context.currentTime;
    this.voices.forEach((voice, i) => voice.frequency.setTargetAtTime(settings.notes[i], now, 0.8));
    this.rainFilter.frequency.setTargetAtTime(settings.rain, now, 0.8);
    this.tideFilter.frequency.setTargetAtTime(settings.tide, now, 0.8);
  }

  async play(scene, mix, master) {
    if (!this.context) this.create();
    await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Sound could not start. Please tap play again.');
    this.playing = true;
    this.setScene(scene);
    this.setMix(mix, master);
  }

  async pause() {
    if (!this.context) return;
    this.playing = false;
    this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.02);
    await this.context.suspend();
  }
}
