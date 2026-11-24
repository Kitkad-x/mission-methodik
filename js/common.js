/* Gemeinsame Hilfsfunktionen: Mischen, Töne, Farben */
const LETTERS = ["A", "B", "C", "D"];
const OPT_COLORS = ["#e4572e", "#3a86ff", "#f4b400", "#2a9d8f"];
const CREW_COLORS = ["#ff6b6b", "#4dabf7", "#ffd43b", "#69db7c", "#da77f2", "#ffa94d"];

function shuffleIdx(n) {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* --- Töne mit WebAudio (keine Dateien nötig) --- */
const SFX = (() => {
  let ctx = null, on = true;
  function c() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; }
  function tone(freq, dur, type = "sine", vol = 0.15, when = 0, slideTo = null) {
    if (!on) return;
    try {
      const a = c(), o = a.createOscillator(), g = a.createGain();
      const t0 = a.currentTime + when;
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  function noise(dur, vol = 0.2) {
    if (!on) return;
    try {
      const a = c(), buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 900;
      s.buffer = buf; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(a.destination); s.start();
    } catch (e) {}
  }
  return {
    toggle() { on = !on; return on; },
    get on() { return on; },
    unlock() { try { c().resume(); } catch (e) {} },
    click() { tone(660, 0.06, "square", 0.05); },
    tick() { tone(1200, 0.05, "square", 0.04); },
    right() { tone(523, 0.12, "triangle", 0.18); tone(659, 0.12, "triangle", 0.18, 0.1); tone(784, 0.25, "triangle", 0.18, 0.2); },
    wrong() { tone(220, 0.35, "sawtooth", 0.08, 0, 110); },
    whoosh() { tone(200, 0.5, "sine", 0.12, 0, 900); },
    boom() { noise(0.6, 0.35); tone(90, 0.5, "sine", 0.25, 0, 40); },
    alarm() { tone(880, 0.15, "square", 0.08); tone(660, 0.15, "square", 0.08, 0.18); tone(880, 0.15, "square", 0.08, 0.36); },
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, "triangle", 0.16, i * 0.15)); tone(1046, 0.8, "triangle", 0.16, 0.65); },
  };
})();
