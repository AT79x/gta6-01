// Procedural sound: every effect and the music loop are synthesized with the
// WebAudio API — no audio files, no network. Silent until the player first
// interacts (browsers require a gesture), and safe to call before that.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let enabled = true;
  let musicStep = 0;

  // A simple bassline over a 16-step loop, late-afternoon drive feel.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
  const HAT = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || !enabled || ctx.state !== 'running') return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || !enabled || ctx.state !== 'running') return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function musicTick() {
    if (!ctx || !enabled || ctx.state !== 'running') return;
    const step = musicStep % 16;
    const bass = BASS[step];
    if (bass) tone(bass, 0.22, 'triangle', 0.16);
    if (HAT[step]) noise(0.03, 0.05, 6000);
    if (step === 0 || step === 8) tone(220, 0.3, 'sine', 0.05);
    musicStep += 1;
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (ctx && !musicTimer) musicTimer = window.setInterval(musicTick, 160);
    },
    setEngine(speed, topSpeed) {
      if (!ensure() || !enabled) return;
      if (ctx.state !== 'running') return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const ratio = topSpeed > 0 ? speed / topSpeed : 0;
      engineOsc.frequency.setTargetAtTime(55 + ratio * 165, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.02 + ratio * 0.05, ctx.currentTime, 0.1);
    },
    engineOff() {
      if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    },
    shoot() {
      noise(0.12, 0.5, 3000);
      tone(180, 0.08, 'square', 0.2, 60);
    },
    punch() {
      noise(0.08, 0.35, 700);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.2);
      window.setTimeout(() => tone(880, 0.12, 'sine', 0.2), 90);
    },
    cash() {
      tone(988, 0.1, 'sine', 0.2);
      window.setTimeout(() => tone(1319, 0.16, 'sine', 0.2), 100);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => tone(f, 0.18, 'triangle', 0.22), i * 110));
    },
    missionFail() {
      tone(220, 0.3, 'sawtooth', 0.15, 110);
    },
    siren() {
      tone(700, 0.22, 'sine', 0.08, 950);
      window.setTimeout(() => tone(950, 0.22, 'sine', 0.08, 700), 220);
    },
    horn() {
      tone(330, 0.18, 'square', 0.12);
      tone(415, 0.18, 'square', 0.1);
    },
    crash() {
      noise(0.25, 0.5, 500);
    },
    explosion() {
      noise(0.7, 0.7, 300);
      tone(60, 0.6, 'sine', 0.4, 30);
    },
    busted() {
      [392, 330, 262].forEach((f, i) => window.setTimeout(() => tone(f, 0.25, 'triangle', 0.2), i * 160));
    },
    toggle() {
      enabled = !enabled;
      if (master) master.gain.value = enabled ? 0.5 : 0;
      return enabled;
    },
  };
}
