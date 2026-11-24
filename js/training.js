/* Gravitas · Mission Methodik — Training & Crew-Bestenliste */
(() => {
  const V = document.getElementById("view");
  const LS = {
    get: (k, d) => { try { const v = localStorage.getItem("mm_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem("mm_" + k, JSON.stringify(v)); } catch (e) {} },
  };
  const T = { online: false, crew: LS.get("crew", null), consent: LS.get("consent", null), code: LS.get("code", ""), best: LS.get("best", {}), runs: LS.get("runs", {}) };
  const PTS = { funk: 2, duell: 2, mission: 3 };
  const ZEIT = { funk: 30, duell: 15, mission: 45, wette: 30, finale: 40 };

  const render = (h) => { V.innerHTML = h; window.scrollTo(0, 0); };
  function head() {
    const hc = document.getElementById("h-crew");
    if (T.crew != null && TRAINING_CREWS[T.crew]) { hc.classList.remove("hidden"); hc.textContent = TRAINING_CREWS[T.crew]; hc.style.border = `2px solid ${CREW_COLORS[T.crew % 6]}`; }
  }
  document.getElementById("h-home").onclick = (e) => { e.preventDefault(); stop(); home(); };

  async function start() {
    render(`<img src="assets/shuttle_gold.png" class="shuttle" alt=""><h1>Training</h1><p style="text-align:center">Verbinde mit der Bodenstation …</p>`);
    if (NET.configured()) {
      try { await NET.init(); T.online = true; } catch (e) { T.online = false; }
    }
    if (T.crew == null) return crewView();
    if (TRAINING_RESEARCH && T.consent == null) return consentView();
    home();
  }

  /* ---------- Crew ---------- */
  function crewView() {
    render(`<h1>Mission Methodik</h1><div class="card"><h2>Zu welcher Crew gehörst du?</h2><p class="small">Deine Punkte zählen für deine Crew in der Bestenliste. Du kannst das später ändern.</p>` +
      TRAINING_CREWS.map((c, i) => `<button class="btn grey" data-c="${i}" style="border-color:${CREW_COLORS[i % 6]}">${esc(c)}</button>`).join("") + `</div>`);
    V.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => {
      T.crew = +b.dataset.c; LS.set("crew", T.crew); head();
      if (T.online) NET.ref(`training/crewOf/${NET.uid}`).set(T.crew);
      if (TRAINING_RESEARCH && T.consent == null) consentView(); else home();
    }));
  }

  /* ---------- Einverständnis ---------- */
  function consentView() {
    render(`<h2>Bevor es losgeht</h2><div class="card"><div class="consent-text">
      <p><b>Freiwillige Teilnahme an einer Studie</b></p>
      <p>Katharina Richter (PH St.Gallen) untersucht, wie Lernspiele das Wiederholen von Methodenwissen unterstützen. Gespeichert werden deine Antworten, ob sie richtig waren, deine Antwortzeit, deine Crew und der Zeitpunkt – zusammen mit einem Code, den du selbst bildest. <b>Dein Name wird nicht erfasst.</b></p>
      <p>Die Daten liegen auf Servern von Google Firebase in der EU, werden nur für Forschung und die Verbesserung der Lehre genutzt und nicht mit Noten verknüpft. Die Teilnahme ist freiwillig. Ohne Einverständnis trainierst du ganz normal, deine Antworten werden aber nicht gespeichert. Widerruf jederzeit per E-Mail mit deinem Code.</p></div></div>
      <div class="card"><p><b>Dein persönlicher Code</b></p><div class="code-in">
        <div><label>Erste 2 Buchstaben Vorname deiner Mutter</label><input id="c1" maxlength="2"></div>
        <div><label>Dein Geburtstag (Tag, 2-stellig)</label><input id="c2" maxlength="2" inputmode="numeric"></div>
        <div><label>Erste 2 Buchstaben deines Geburtsorts</label><input id="c3" maxlength="2"></div></div>
        <button class="btn" id="yes">Einverstanden</button><button class="btn grey" id="no">Nicht einverstanden – nur trainieren</button></div>`);
    document.getElementById("yes").onclick = () => {
      const c = (document.getElementById("c1").value + document.getElementById("c2").value.padStart(2, "0") + document.getElementById("c3").value).toUpperCase();
      if (!/^[A-ZÄÖÜ]{2}\d{2}[A-ZÄÖÜ]{2}$/.test(c)) return alert("Bitte alle drei Felder ausfüllen.");
      T.consent = true; T.code = c; LS.set("consent", true); LS.set("code", c); home();
    };
    document.getElementById("no").onclick = () => { T.consent = false; LS.set("consent", false); home(); };
  }

  /* ---------- Startseite ---------- */
  function totalMine() { return Object.values(T.best).reduce((a, b) => a + b, 0); }
  function home() {
    head();
    render(`<img src="assets/shuttle_gold.png" class="shuttle" alt=""><h1>Training</h1>
      <div class="card"><p>Fliege allein oder mit deiner Crew zu einem Planeten und beantworte 5 Fragen. <b>Dein bester Durchgang pro Planet</b> zählt für ${esc(TRAINING_CREWS[T.crew] || "deine Crew")}.</p>
      <p class="small">Deine Kristalle insgesamt: <b>${totalMine()}</b>${T.online ? "" : " · offline: Bestenliste nicht verfügbar"}</p></div>
      <button class="btn" id="go">🚀 Planet wählen</button>
      <button class="btn grey" id="lb" ${T.online ? "" : "disabled"}>🏆 Crew-Bestenliste</button>
      <button class="btn grey" id="cr">Crew wechseln</button>`);
    document.getElementById("go").onclick = planets;
    document.getElementById("lb").onclick = () => leaderboard("gesamt");
    document.getElementById("cr").onclick = crewView;
  }

  const maxFor = (pid) => FRAGEN.filter((f) => f.planet === pid).reduce((s, f) => s + (f.typ === "wette" ? 3 : PTS[f.typ] || 0), 0);

  function planets() {
    render(`<h2>Wähle deinen Planeten</h2>` + PLANETEN.map((p) => `<button class="btn planet" data-p="${p.id}"><img src="${p.bild}" alt="">
      <span class="pt">Termin ${p.termin} · ${esc(p.name)}<small>${esc(p.titel)}${p.status === "entwurf" ? " · Entwurf" : ""}</small></span>
      <span class="best">${T.best[p.id] != null ? `🏅 ${T.best[p.id]}/${maxFor(p.id)}` : "neu"}</span></button>`).join(""));
    V.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => run(b.dataset.p)));
  }

  /* ---------- Ein Durchgang ---------- */
  let R = null, timer = null;
  function stop() { clearInterval(timer); timer = null; }

  function run(pid) {
    const qs = FRAGEN.filter((f) => f.planet === pid).map((q) => ({ q, order: shuffleIdx(4) }));
    T.runs[pid] = (T.runs[pid] || 0) + 1; LS.set("runs", T.runs);
    R = { pid, planet: PLANETEN.find((p) => p.id === pid), qs, i: 0, score: 0, right: 0, attempt: T.runs[pid] };
    SFX.unlock(); SFX.whoosh(); round();
  }

  function topBar(q) {
    const t = TYPEN[q.typ];
    const name = q.typ === "duell" ? "Asteroiden-Abwehr" : q.art || t.name;
    return `<div class="top"><span class="badge">${t.icon} ${esc(name)}</span><span class="small">Frage ${R.i + 1}/${R.qs.length} · 💎 ${R.score}</span></div>`;
  }

  function round() {
    stop();
    if (R.i >= R.qs.length) return finish();
    const { q } = R.qs[R.i];
    if (q.typ === "wette") {
      render(topBar(q) + `<div class="card"><h2>Treibstoff-Wette</h2><p>Thema: <b>${esc(R.planet.titel)}</b>. Wie viele Kristalle setzt du? Richtig: dazu · falsch: weg.</p>
        <div class="bets">${[0, 1, 2, 3].map((v) => `<button class="btn" data-b="${v}">${v}</button>`).join("")}</div></div>`);
      V.querySelectorAll("[data-b]").forEach((b) => (b.onclick = () => { R.bet = +b.dataset.b; SFX.click(); question(); }));
    } else { R.bet = 0; question(); }
  }

  function question() {
    const { q, order } = R.qs[R.i];
    const zeit = ZEIT[q.typ] || 30;
    let h = topBar(q);
    if (q.typ === "duell") h += `<p class="small">☄️ Ein Asteroid fliegt auf dich zu! Antworte in ${zeit} Sekunden richtig: +2. Falsch oder zu spät: −1.</p>`;
    h += `<div class="top"><span></span><span class="timer" id="t">⏱ ${zeit}</span></div><div class="q">${esc(q.q)}</div>`;
    if (q.visual) h += `<div class="vis">${visualSVG(q.visual)}</div>`;
    h += order.map((oi, p) => `<button class="opt" data-p="${p}"><b style="background:${OPT_COLORS[p]}">${LETTERS[p]}</b><span>${esc(q.opts[oi])}</span></button>`).join("");
    render(h);
    const t0 = Date.now();
    let left = zeit;
    timer = setInterval(() => {
      left--; const el = document.getElementById("t");
      if (el) { el.textContent = "⏱ " + Math.max(0, left); el.classList.toggle("low", left <= 5); }
      if (left <= 5 && left > 0) SFX.tick();
      if (left <= 0) { stop(); answer(null, Date.now() - t0); }
    }, 1000);
    V.querySelectorAll(".opt").forEach((b) => (b.onclick = () => { stop(); answer(+b.dataset.p, Date.now() - t0); }));
  }

  function answer(p, rt) {
    const { q, order } = R.qs[R.i];
    const cp = order.indexOf(q.correct), ok = p === cp;
    let delta = 0;
    if (q.typ === "wette") delta = ok ? R.bet : -R.bet;
    else if (q.typ === "duell") delta = ok ? 2 : -1;
    else delta = ok ? PTS[q.typ] || 2 : 0;
    R.score = Math.max(0, R.score + delta); if (ok) R.right++;
    ok ? SFX.right() : q.typ === "duell" ? SFX.boom() : SFX.wrong();
    if (T.online && TRAINING_RESEARCH && T.consent) {
      NET.ref("training/research").push({ zeit: new Date().toISOString(), modus: "training", code: T.code, crew: TRAINING_CREWS[T.crew] || "", planet: R.planet.name, termin: R.planet.termin,
        frage_id: q.id, typ: q.typ, antwort: p != null ? LETTERS[p] : "", antwort_original: p != null ? order[p] : "", richtig: ok ? 1 : 0, einsatz: q.typ === "wette" ? R.bet : "", reaktionszeit_ms: rt, versuch: R.attempt });
    }
    let h = topBar(q) + `<div class="q">${esc(q.q)}</div>`;
    h += order.map((oi, k) => `<div class="opt ${k === cp ? "right" : k === p ? "wrongsel" : "dim"}"><b style="background:${OPT_COLORS[k]}">${LETTERS[k]}</b><span>${esc(q.opts[oi])}</span></div>`).join("");
    h += `<p class="big ${ok ? "ok" : "bad"}">${ok ? "✓" : p == null ? "⏱" : "✗"}</p><p style="text-align:center">${delta > 0 ? "+" : ""}${delta} Kristalle${q.typ === "duell" ? (ok ? " – Asteroid abgewehrt!" : " – Treffer!") : ""}</p>`;
    h += `<div class="expl">${esc(q.expl)}<span class="ref">→ Termin ${R.planet.termin}: ${esc(R.planet.titel)}</span></div>`;
    h += `<button class="btn" id="nx">${R.i + 1 < R.qs.length ? "Nächste Frage ▶" : "Zum Ergebnis ▶"}</button>`;
    render(h);
    document.getElementById("nx").onclick = () => { R.i++; round(); };
  }

  async function finish() {
    const max = maxFor(R.pid), prev = T.best[R.pid];
    const better = prev == null || R.score > prev;
    if (better) { T.best[R.pid] = R.score; LS.set("best", T.best); }
    if (T.online) {
      NET.ref(`training/best/${NET.uid}/${R.pid}`).transaction((cur) => (cur == null || R.score > cur ? R.score : cur));
      NET.ref(`training/crewOf/${NET.uid}`).set(T.crew);
    }
    SFX.fanfare();
    render(`<img src="assets/shuttle_gold.png" class="shuttle" alt=""><h1>Gelandet!</h1>
      <div class="card" style="text-align:center"><p>${esc(R.planet.name)} · Termin ${R.planet.termin}</p><p class="big">💎 ${R.score}<span class="small"> / ${max}</span></p>
      <p>${R.right} von ${R.qs.length} richtig${better ? (prev == null ? " · erster Flug!" : ` · neuer Rekord (vorher ${prev})!`) : ` · dein Rekord bleibt ${prev}`}</p></div>
      <button class="btn" id="again">Nochmals fliegen</button><button class="btn grey" id="other">Anderer Planet</button>
      <button class="btn grey" id="lb" ${T.online ? "" : "disabled"}>🏆 Crew-Bestenliste</button>`);
    document.getElementById("again").onclick = () => run(R.pid);
    document.getElementById("other").onclick = planets;
    document.getElementById("lb").onclick = () => leaderboard(R.pid);
  }

  /* ---------- Bestenliste ---------- */
  async function leaderboard(tab) {
    render(`<h2>🏆 Crew-Bestenliste</h2><p class="small">Lade …</p>`);
    let best = {}, crewOf = {};
    try {
      best = (await NET.ref("training/best").get()).val() || {};
      crewOf = (await NET.ref("training/crewOf").get()).val() || {};
    } catch (e) { return render(`<div class="card"><p class="err">Bestenliste nicht erreichbar.</p></div>`); }
    const sums = TRAINING_CREWS.map(() => ({ pts: 0, members: 0 }));
    Object.entries(best).forEach(([uid, planets]) => {
      const c = crewOf[uid]; if (c == null || !sums[c]) return;
      const v = tab === "gesamt" ? Object.values(planets || {}).reduce((a, b) => a + (+b || 0), 0) : +(planets || {})[tab] || 0;
      if (v > 0) { sums[c].pts += v; sums[c].members++; }
    });
    const rows = sums.map((s, i) => ({ ...s, i })).sort((a, b) => b.pts - a.pts);
    const max = Math.max(1, ...rows.map((r) => r.pts));
    const tabs = [["gesamt", "Gesamt"], ...PLANETEN.map((p) => [p.id, p.name])];
    render(`<h2>🏆 Crew-Bestenliste</h2><div class="tabs">${tabs.map(([id, n]) => `<button data-t="${id}" class="${id === tab ? "on" : ""}">${esc(n)}</button>`).join("")}</div>
      <div class="card">${rows.map((r, k) => `<div class="lb-row ${r.i === T.crew ? "me" : ""}"><span class="lb-rank">${k + 1}</span>
        <div class="lb-bar"><div class="lb-fill" style="width:${(r.pts / max) * 100}%;background:${CREW_COLORS[r.i % 6]}"></div><span class="lb-name">${esc(TRAINING_CREWS[r.i])} · ${r.members} 👩‍🚀</span></div>
        <span class="lb-pts">${r.pts}</span></div>`).join("")}</div>
      <p class="small">Gezählt wird der beste Durchgang jeder Person pro Planet. Je mehr Crew-Mitglieder trainieren, desto weiter fliegt eure Crew.</p>
      <button class="btn" id="go">🚀 Weiter trainieren</button>`);
    V.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => leaderboard(b.dataset.t)));
    document.getElementById("go").onclick = planets;
  }

  start();
})();
