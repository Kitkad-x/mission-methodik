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

/* --- Grafiken für Spezialmissionen (Streudiagramm, Balken) --- */
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function visualSVG(v) {
  const W = 450, H = 400, m = 50;
  const axis = `<line x1="${m}" y1="${H - m}" x2="${W - 15}" y2="${H - m}" stroke="#333" stroke-width="2"/><line x1="${m}" y1="15" x2="${m}" y2="${H - m}" stroke="#333" stroke-width="2"/>`;
  if (v.kind === "scatter") {
    const R1 = rng(4242), n = v.n || 40;
    let x = Array.from({ length: n }, () => gauss(R1)), e = Array.from({ length: n }, () => gauss(R1));
    const z = (a) => { const mu = a.reduce((s, t) => s + t, 0) / a.length, sd = Math.sqrt(a.reduce((s, t) => s + (t - mu) ** 2, 0) / a.length); return a.map((t) => (t - mu) / sd); };
    x = z(x); let ez = z(e); const b = ez.reduce((s, t, i) => s + t * x[i], 0) / n; ez = z(ez.map((t, i) => t - b * x[i]));
    const y = x.map((t, i) => v.r * t + Math.sqrt(1 - v.r * v.r) * ez[i]);
    const sx = (t) => m + 15 + ((t + 2.6) / 5.2) * (W - m - 40), sy = (t) => H - m - 15 - ((t + 2.6) / 5.2) * (H - m - 40);
    const pts = x.map((t, i) => `<circle cx="${sx(Math.max(-2.5, Math.min(2.5, t))).toFixed(1)}" cy="${sy(Math.max(-2.5, Math.min(2.5, y[i]))).toFixed(1)}" r="7" fill="#1f6f8b" fill-opacity=".8"/>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}">${axis}${pts}<text x="${(W + m) / 2}" y="${H - 14}" text-anchor="middle" font-size="18" fill="#333">${esc(v.xlab)} →</text><text x="18" y="${(H - m) / 2}" text-anchor="middle" font-size="18" fill="#333" transform="rotate(-90 18 ${(H - m) / 2})">${esc(v.ylab)} →</text></svg>`;
  }
  if (v.kind === "bars") {
    const span = v.ymax - v.ymin, bw = 110;
    const sy = (t) => H - m - ((t - v.ymin) / span) * (H - m - 30);
    let s = axis;
    for (let t = v.ymin; t <= v.ymax; t++) s += `<text x="${m - 8}" y="${sy(t) + 6}" text-anchor="end" font-size="18" fill="#333">${t}</text><line x1="${m}" x2="${W - 15}" y1="${sy(t)}" y2="${sy(t)}" stroke="#ddd"/>`;
    v.values.forEach((val, i) => {
      const x = m + 60 + i * 190;
      s += `<rect x="${x}" y="${sy(val)}" width="${bw}" height="${H - m - sy(val)}" fill="${i ? "#e4572e" : "#3a86ff"}"/><text x="${x + bw / 2}" y="${H - m + 26}" text-anchor="middle" font-size="20" fill="#333">${esc(v.labels[i])}</text><text x="${x + bw / 2}" y="${sy(val) - 8}" text-anchor="middle" font-size="20" font-weight="700" fill="#333">${val} %</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}">${s}<text x="16" y="${(H - m) / 2}" text-anchor="middle" font-size="16" fill="#333" transform="rotate(-90 16 ${(H - m) / 2})">${esc(v.ylab)}</text></svg>`;
  }
  return "";
}

