/* Gravitas · Mission Methodik — Spielleitung (Beamer) */
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  /* ---------- Bühne skalieren ---------- */
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    $("#stage").style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener("resize", fit); fit();

  function show(id) { $$(".screen").forEach((e) => e.classList.add("hidden")); $(id).classList.remove("hidden"); }

  /* ---------- Spielzustand ---------- */
  const G = {
    mode: "beamer", amode: "person", research: false,
    crews: [], rounds: [], idx: -1, phase: "", answers: {}, bets: {}, double: false, nextDouble: false,
    duelCount: 0, log: [], room: null, players: {}, pAnswers: {}, pBets: {}, timer: null, tLeft: 0, paused: false,
    startedAt: 0, unsub: [],
  };
  const T0 = new Date();

  /* ---------- Setup ---------- */
  let nCrews = 5;
  const savedNames = [];
  function renderCrewInputs() {
    const box = $("#crew-names");
    const cur = $$("#crew-names input").map((i) => i.value);
    cur.forEach((v, i) => (savedNames[i] = v));
    box.innerHTML = "";
    for (let i = 0; i < nCrews; i++) {
      const inp = document.createElement("input");
      inp.value = savedNames[i] || `Gruppe ${i + 1}`;
      inp.maxLength = 18;
      inp.style.borderColor = CREW_COLORS[i];
      box.appendChild(inp);
    }
    $("#crew-count").textContent = nCrews;
  }
  $$("[data-crews]").forEach((b) => b.addEventListener("click", () => {
    nCrews = Math.max(2, Math.min(6, nCrews + Number(b.dataset.crews))); renderCrewInputs(); SFX.click();
  }));

  function renderPlanets() {
    const box = $("#planet-list");
    box.innerHTML = PLANETEN.map((p) => `
      <label class="planet-row"><input type="checkbox" value="${p.id}" ${p.termin <= 8 ? "checked" : ""}>
        <img src="${p.bild}" alt=""> <span><b>${p.name}</b> · Termin ${p.termin}: ${esc(p.titel)}</span>
        ${p.status === "entwurf" ? '<span class="tag">Entwurf</span>' : ""}</label>`).join("");
    $$("#planet-list input, #opt-finale").forEach((i) => i.addEventListener("change", roundInfo));
    roundInfo();
  }
  function selectedPlanets() { return $$("#planet-list input:checked").map((i) => i.value); }
  function roundInfo() {
    const n = FRAGEN.filter((f) => selectedPlanets().includes(f.planet)).length + ($("#opt-finale").checked ? 1 : 0);
    $("#round-info").textContent = `${n} Runden · ca. ${Math.round(n * 1.4)} Minuten`;
  }

  function onlineAvailable() {
    if (!NET.configured()) return "Online-Modus: zuerst Firebase einrichten (siehe Anleitung, Datei js/firebase-config.js).";
    if (location.protocol === "file:") return "Online-Modus läuft nur über die Internetadresse (GitHub Pages), nicht als lokale Datei.";
    return "";
  }
  function setupModeUI() {
    const msg = onlineAvailable();
    const onlineRadio = $('input[name=mode][value=online]');
    onlineRadio.disabled = !!msg;
    $("#lbl-online").style.opacity = msg ? 0.5 : 1;
    $("#online-hint").textContent = msg;
    const online = $('input[name=mode]:checked').value === "online";
    $("#online-opts").classList.toggle("hidden", !online);
  }
  $$('input[name=mode]').forEach((r) => r.addEventListener("change", setupModeUI));

  $("#btn-start").addEventListener("click", () => {
    SFX.unlock(); SFX.whoosh(); renderCrewInputs(); renderPlanets(); setupModeUI(); show("#s-setup");
  });

  $("#btn-go").addEventListener("click", async () => {
    SFX.unlock();
    const planets = selectedPlanets();
    if (!planets.length && !$("#opt-finale").checked) return alert("Bitte mindestens einen Planeten wählen.");
    G.mode = $('input[name=mode]:checked').value;
    G.amode = $('input[name=amode]:checked').value;
    G.research = G.mode === "online" && $("#opt-research").checked;
    G.events = $("#opt-events").checked;
    G.crews = $$("#crew-names input").map((i, k) => ({ name: i.value.trim() || `Crew ${k + 1}`, fuel: 0, shield: true, turbo: true, active: {} }));
    buildBlocks(planets, $("#opt-finale").checked, $("#opt-shuffle").checked);
    G.idx = -1; G.roundNo = 0; G.duelCount = 0; G.log = []; G.double = false; G.nextDouble = false; G.blocksDone = 0; G.done = {};
    if (G.mode === "online") {
      try { await startOnline(); } catch (e) { alert("Online-Modus nicht möglich: " + e.message); return; }
    } else {
      briefing(() => showMap());
    }
  });

  function buildBlocks(planets, finale, shuffle) {
    G.blocks = {}; G.order = [...planets];
    planets.forEach((pid, pIdx) => {
      const qs = FRAGEN.filter((f) => f.planet === pid);
      G.blocks[pid] = qs.map((q, k) => ({
        q, planet: PLANETEN.find((p) => p.id === pid), planetIdx: pIdx,
        first: k === 0, last: k === qs.length - 1, order: shuffle ? shuffleIdx(q.opts.length) : [0, 1, 2, 3],
      }));
    });
    G.hasFinale = finale;
    if (finale) {
      const q = FRAGEN.find((f) => f.typ === "finale");
      G.blocks.finale = [{ q, planet: { id: "finale", name: "Landung", termin: "", titel: "Finale", bild: "assets/astronaut.png" }, planetIdx: planets.length, first: true, last: true, order: shuffle ? shuffleIdx(4) : [0, 1, 2, 3] }];
    }
    G.journey = [...planets.map((id) => PLANETEN.find((p) => p.id === id)), ...(finale ? [{ id: "finale", bild: "assets/astronaut.png" }] : [])];
    G.rounds = [];
  }

  /* ---------- Sternenkarte ---------- */
  const MAP_POS = [[260, 690], [560, 430], [860, 650], [1120, 380], [1390, 610], [1600, 330], [1180, 820], [700, 860]];
  function leaders() { const m = Math.max(...G.crews.map((c) => c.fuel)); return G.crews.map((c, i) => i).filter((i) => G.crews[i].fuel === m); }
  function showMap() {
    stopTimer(); hideOverlay(); phase("map");
    const L = leaders();
    if (!G.chooser || !L.includes(G.chooser.i) || G.chooser.at !== G.blocksDone) {
      G.chooser = { i: L[Math.floor(Math.random() * L.length)], tie: L.length > 1, at: G.blocksDone };
    }
    const ch = G.chooser, cname = G.crews[ch.i].name;
    const open = G.order.filter((id) => !G.done[id]);
    const allZero = G.crews.every((c) => c.fuel === 0);
    $("#map-leader").innerHTML = allZero
      ? `🎲 Noch hat keine Crew Kristalle. Das Los bestimmt: <b style="color:${CREW_COLORS[ch.i]}">${esc(cname)}</b> wählt das erste Ziel.`
      : `👑 <b style="color:${CREW_COLORS[ch.i]}">${esc(cname)}</b> führt${ch.tie ? " (Gleichstand – das Los hat entschieden)" : ""} und wählt das nächste Ziel.`;
    if (!open.length) $("#map-leader").innerHTML = "Alle Planeten erkundet – jetzt zur Landung!";
    const nP = G.order.length, pts = G.order.map((id, k) => [nP === 1 ? 960 : 260 + (k * 1400) / (nP - 1), k % 2 ? 420 : 720]);
    let path = "";
    for (let k = 1; k < pts.length; k++) path += `<line x1="${pts[k - 1][0]}" y1="${pts[k - 1][1]}" x2="${pts[k][0]}" y2="${pts[k][1]}"/>`;
    $("#map-planets").innerHTML = `<svg class="map-path" viewBox="0 0 1920 1080">${path}</svg>` + G.order.map((id, k) => {
      const p = PLANETEN.find((x) => x.id === id), [x, y] = pts[k], done = G.done[id];
      return `<button class="map-planet ${done ? "done" : ""}" data-id="${id}" style="left:${x}px;top:${y}px" ${done ? "disabled" : ""}>
        <img src="${p.bild}" alt=""><span class="mp-t">Termin ${p.termin} · ${esc(p.name)}</span><span class="mp-s">${esc(p.titel)}</span>
        <span class="mp-b">${done ? "✓ erkundet" : G.blocks[id].length + " Runden"}${p.status === "entwurf" ? " · Entwurf" : ""}</span></button>`;
    }).join("");
    $("#map-score").innerHTML = G.crews.map((c, i) => `<span class="chip" style="border-color:${CREW_COLORS[i]}">${esc(c.name)} <b>${c.fuel}</b> <img src="assets/kristall.png" alt=""></span>`).join("");
    $("#btn-finale").classList.toggle("hidden", !G.hasFinale);
    $("#btn-finale").classList.toggle("pulse", !open.length);
    $$(".map-planet:not(.done)").forEach((b) => b.addEventListener("click", () => { SFX.whoosh(); startBlock(b.dataset.id); }));
    show("#s-map");
    publish({ map: true, chooser: ch.i, open });
  }
  function startBlock(id) {
    G.cur = id; G.rounds = G.blocks[id]; G.idx = -1;
    show("#s-game"); renderTrack(); clearQ();
    nextRound();
  }
  function blockDone() {
    G.done[G.cur] = true;
    if (G.cur === "finale") return endGame();
    G.blocksDone++;
    const k = G.blocksDone;
    const ev = !G.events || !G.order.some((id) => !G.done[id]) ? null : k % 2 === 0 ? EREIGNISSE[0] : k >= 3 ? EREIGNISSE[1] : null;
    if (ev) {
      SFX.alarm();
      let extra = "";
      if (ev.id === "sturm") G.nextDouble = true;
      if (ev.id === "schwerelos") {
        const min = Math.min(...G.crews.map((c) => c.fuel));
        const last = G.crews.filter((c) => c.fuel === min);
        last.forEach((c) => (c.fuel += 2));
        extra = `<p class="small">${last.map((c) => esc(c.name)).join(", ")}: +2 Kristalle</p>`;
      }
      publish({ event: ev.id });
      overlay(`<img src="${ev.bild}" alt=""><h2>${ev.name}</h2><p>${ev.id === "sturm" ? "Die erste Runde auf dem nächsten Planeten zählt doppelt." : ev.text}</p>${extra}`, "Zur Sternenkarte", () => showMap());
    } else showMap();
  }
  $("#btn-finale").addEventListener("click", () => { SFX.whoosh(); startBlock("finale"); });
  $("#btn-endnow").addEventListener("click", () => { if (confirm("Spiel jetzt beenden und zur Siegerehrung?")) endGame(); });

  /* ---------- Briefing (Erklärung für alle) ---------- */
  const BRIEF = [
    { img: "assets/shuttle_gold.png", h: "Eure Mission", t: "Jede Gruppe ist eine <b>Shuttle-Crew</b>. Für richtige Antworten gibt es <b>Treibstoff-Kristalle</b>, und euer Shuttle fliegt auf der Rennstrecke nach vorn. Die führende Crew fliegt im goldenen Shuttle." },
    { img: "assets/jupiter.png", h: "Die Sternenkarte", t: "Jeder Planet steht für eine Sitzung und hat <b>5 Runden</b>. Nach jedem Planeten geht es zurück zur Karte: <b>Die führende Crew wählt das nächste Ziel.</b> Unterwegs warten Ereignisse wie der Sonnensturm (doppelte Punkte)." },
    { img: "assets/stoppuhr.png", h: "So antwortet ihr", t: "", mode: true },
    { img: "assets/asteroid.png", h: "Vier Rundentypen", t: "<div class='brief-grid'><div><b>📡 Funkspruch</b><br>Alle antworten. Richtig: +2</div><div><b>☄️ Asteroiden-Duell</b><br>Zwei Crews. Wer richtig liegt, während der Gegner falsch liegt: +2, und der Gegner verliert 1</div><div><b>🛰️ Spezialmission</b><br>Schätzen, sortieren, Fehler finden. Richtig: +3</div><div><b>🎲 Treibstoff-Wette</b><br>Erst 0–3 Kristalle setzen, dann die Frage. Richtig: dazu, falsch: weg</div></div>" },
    { img: "assets/kristall.png", h: "Zwei Joker pro Crew", t: "<b>🛡 Schild</b> schützt euch eine Runde lang vor jedem Verlust.<br><b>⚡ Turbo</b> verdoppelt euren Gewinn in einer Runde.<br>Jeder Joker gilt einmal im ganzen Spiel. Sagt ihn an, bevor aufgelöst wird. Im <b>Finale</b> dürft ihr beliebig viele Kristalle setzen." },
    { img: "assets/postit.png", h: "Mitnehmen", t: "Nach jeder Frage erklärt ein <b>Post-it</b> die Lösung, auch wenn ihr richtig lagt. Es sind keine Prüfungsfragen, sondern ein Rückblick auf unsere Sitzungen." },
  ];
  let bIdx = 0, bDone = null;
  function briefing(done) { bDone = done; bIdx = 0; show("#s-brief"); drawBrief(); }
  function drawBrief() {
    const b = BRIEF[bIdx];
    const t = b.mode ? (G.mode === "beamer"
      ? "Jede Crew hat <b>Antwortkarten A–D</b>. Besprecht euch leise. Wenn die Zeit abläuft und es heisst <b>«Karten hoch!»</b>, haltet ihr eure Karte hoch. Nicht vorher, sonst sehen die anderen eure Antwort!"
      : "Ihr antwortet auf dem <b>Handy</b>. Tippt auf A, B, C oder D. Eine Antwort pro Frage, ändern geht nicht. " + (G.amode === "person" ? "Jede Person antwortet, für die Crew zählt die <b>Mehrheit</b>." : "Ein Handy pro Crew antwortet.") + " Die schnellste richtige Crew bekommt beim Funkspruch <b>+1 Tempo-Bonus</b>.") : b.t;
    $("#brief-card").innerHTML = `<img src="${b.img}" alt=""><h2>${b.h}</h2><div class="brief-t">${t}</div>`;
    $("#brief-dots").innerHTML = BRIEF.map((x, i) => `<i class="${i === bIdx ? "on" : ""}"></i>`).join("");
    $("#brief-prev").style.visibility = bIdx ? "visible" : "hidden";
    $("#brief-next").textContent = bIdx === BRIEF.length - 1 ? "Los geht's! 🚀" : "Weiter ▶";
  }
  $("#brief-prev").addEventListener("click", () => { if (bIdx > 0) { bIdx--; SFX.click(); drawBrief(); } });
  $("#brief-next").addEventListener("click", () => { SFX.click(); if (bIdx < BRIEF.length - 1) { bIdx++; drawBrief(); } else { SFX.whoosh(); bDone && bDone(); } });
  $("#brief-skip").addEventListener("click", () => { SFX.click(); bDone && bDone(); });

  /* ---------- Bedienhilfe (für die Spielleitung) ---------- */
  function helpOverlay() {
    overlay(`<h2>Bedienung</h2><table class="help">
      <tr><td><b>Weiter ▶</b> oder Leertaste / →</td><td>nächster Schritt: Frage zeigen, auflösen, nächste Runde</td></tr>
      <tr><td><span class="kb" style="background:${OPT_COLORS[0]}">A</span><span class="kb" style="background:${OPT_COLORS[1]}">B</span><span class="kb" style="background:${OPT_COLORS[2]}">C</span><span class="kb" style="background:${OPT_COLORS[3]}">D</span> in einer Spur</td><td>Antwort der Crew einklicken (Beamer-Modus); nochmals klicken = löschen</td></tr>
      <tr><td><span class="kb" style="background:#6c5ce7">0</span>–<span class="kb" style="background:#6c5ce7">3</span> in einer Spur</td><td>Einsatz bei der Wette einklicken</td></tr>
      <tr><td>🛡 ⚡ in einer Spur</td><td>Joker der Crew aktivieren (vor dem Auflösen); nochmals klicken = zurücknehmen</td></tr>
      <tr><td><b>+10 s</b> · <b>⏸</b> · <b>🔊</b></td><td>Zeit verlängern · Timer anhalten · Ton an/aus</td></tr>
      <tr><td>Sternenkarte</td><td>Planeten anklicken, den die führende Crew ansagt · «Finale» startet die Landung · «Spiel beenden» geht direkt zur Siegerehrung</td></tr>
      <tr><td>Siegerehrung</td><td>«Daten herunterladen (CSV)» speichert alle Antworten der Runden</td></tr>
      <tr><td><b>?</b></td><td>diese Hilfe · <b>📖</b> Briefing für die Crews nochmals zeigen</td></tr>
    </table>`, "Schliessen", () => {});
  }
  $$(".btn-help").forEach((b) => b.addEventListener("click", () => { SFX.click(); helpOverlay(); }));
  $$(".btn-brief").forEach((b) => b.addEventListener("click", () => { SFX.click(); const back = G.phase === "map" ? "#s-map" : "#s-game"; briefing(() => show(back)); }));

  /* ---------- Countdown & Overlays ---------- */
  function overlay(html, btnLabel, onClose) {
    $("#ov-card").innerHTML = html + (btnLabel ? `<div><button class="btn green" id="ov-btn">${btnLabel}</button></div>` : "");
    $("#overlay").classList.remove("hidden");
    if (btnLabel) $("#ov-btn").addEventListener("click", () => { SFX.click(); hideOverlay(); onClose && onClose(); });
  }
  function hideOverlay() { $("#overlay").classList.add("hidden"); }

  function countdown(done) {
    show("#s-game"); renderTrack(); clearQ();
    let n = 3;
    const step = () => {
      if (n === 0) { hideOverlay(); SFX.whoosh(); done(); return; }
      overlay(`<div class="countdown">${n}</div><p class="small">Triebwerke zünden …</p>`);
      SFX.tick(); n--; setTimeout(step, 800);
    };
    step();
  }

  /* ---------- Runden-Ablauf ---------- */
  const R = () => G.rounds[G.idx];

  function nextRound() {
    stopTimer();
    G.idx++;
    if (G.idx >= G.rounds.length) return blockDone();
    G.roundNo++;
    G.answers = {}; G.bets = {}; G.pAnswers = {}; G.pBets = {};
    G.crews.forEach((c) => (c.active = {}));
    G.double = G.nextDouble; G.nextDouble = false;
    const r = R();
    if (r.q.typ === "duell") {
      const n = G.crews.length;
      const a = (2 * G.duelCount) % n; let b = (a + 1) % n;
      G.duel = [a, b]; G.duelCount++;
    } else G.duel = null;
    renderTop(); clearQ(); renderTrack();
    if (r.first) {
      const p = r.planet;
      phase("intro");
      SFX.whoosh();
      overlay(p.id === "finale"
        ? `<img src="assets/astronaut.png" alt=""><h2>Finale: Landung!</h2><p>Letzte Chance. Jede Crew setzt so viele Kristalle, wie sie will.</p>`
        : `<img src="${p.bild}" alt=""><h2>${esc(p.name)}</h2><p>Termin ${p.termin}: ${esc(p.titel)}</p><p class="small">${p.status === "entwurf" ? "" : "5 Runden"}</p>`,
        "Landen", () => startRoundBody());
    } else startRoundBody();
  }

  function startRoundBody() {
    const r = R();
    if (r.q.typ === "wette" || r.q.typ === "finale") phaseBet(); else phaseQuestion();
  }

  function phase(p) { G.phase = p; updateNextBtn(); }

  function updateNextBtn() {
    const b = $("#btn-next");
    const L = { intro: "Los ▶", bet: "Frage zeigen ▶", question: "Auflösen ▶", reveal: G.idx + 1 >= G.rounds.length ? (G.cur === "finale" ? "Siegerehrung ▶" : "Zur Sternenkarte ▶") : "Nächste Runde ▶" };
    b.textContent = L[G.phase] || "Weiter ▶";
  }

  function renderTop() {
    const r = R(), t = TYPEN[r.q.typ];
    $("#tb-planet").src = r.planet.bild;
    $("#tb-termin").textContent = r.planet.termin ? `Termin ${r.planet.termin}` : "Finale";
    $("#tb-title").textContent = r.planet.id === "finale" ? "Landung" : r.planet.name + " · " + r.planet.titel;
    $("#tb-type").textContent = `${t.icon} ${r.q.art || t.name}${G.double ? " · ×2 Sonnensturm" : ""}`;
    $("#tb-round").textContent = `Runde ${G.idx + 1} / ${G.rounds.length}`;
    $("#journey").innerHTML = G.journey.map((p) => `<img src="${p.bild}" class="${p.id === G.cur ? "now" : G.done[p.id] ? "done" : ""}" alt="">`).join("");
    $("#timer-s").textContent = t.zeit;
  }

  function clearQ() {
    $("#qtext").textContent = ""; $("#opts").innerHTML = ""; $("#visual").classList.add("hidden");
    $("#postit").classList.add("hidden"); $("#side-info").innerHTML = ""; $("#side-info").classList.remove("hidden");
    $("#duel-banner").classList.add("hidden");
  }

  /* --- Wette --- */
  function maxBet(ci) { return R().q.typ === "finale" ? Math.max(3, G.crews[ci].fuel) : 3; }
  function phaseBet() {
    phase("bet");
    const r = R();
    $("#qtext").innerHTML = `${TYPEN[r.q.typ].icon} ${esc(TYPEN[r.q.typ].name)}: Wie sicher seid ihr beim Thema <b>«${esc(r.planet.id === "finale" ? "Zusammenhang und Wirkung" : r.planet.titel)}»</b>?`;
    $("#side-info").innerHTML = `${esc(TYPEN[r.q.typ].info)}.<br><br>${G.mode === "beamer" ? "Jede Crew sagt ihren Einsatz an – du klickst ihn in der Spur ein." : "Die Crews wählen ihren Einsatz auf dem Handy."}<br><br>Joker jetzt aktivieren: 🛡 Schild (kein Verlust) · ⚡ Turbo (Gewinn ×2)`;
    G.crews.forEach((c, i) => (G.bets[i] = 0));
    renderTrack();
    publish();
  }

  /* --- Frage --- */
  function phaseQuestion() {
    phase("question");
    const r = R(), q = r.q;
    if (G.duel) {
      $("#duel-banner").classList.remove("hidden");
      $("#duel-banner").innerHTML = `☄️ ${esc(G.crews[G.duel[0]].name)} gegen ${esc(G.crews[G.duel[1]].name)} – alle anderen können als Funkkontrolle stehlen`;
    }
    $("#qtext").textContent = q.q;
    if (q.visual) { $("#visual").classList.remove("hidden"); $("#visual").innerHTML = visualSVG(q.visual); }
    const opts = $("#opts");
    opts.classList.toggle("one-col", !!q.visual || q.opts.some((o) => o.length > 60));
    opts.innerHTML = r.order.map((oi, p) => `<div class="opt" data-p="${p}"><span class="L" style="background:${OPT_COLORS[p]}">${LETTERS[p]}</span><span>${esc(q.opts[oi])}</span><span class="who"></span></div>`).join("");
    $("#side-info").innerHTML = `<b>${esc(TYPEN[q.typ].name)}</b><br>${esc(TYPEN[q.typ].info)}.` +
      (G.mode === "beamer" ? `<br><br>Nach Ablauf der Zeit: <b>Karten hoch!</b> Dann die Antworten in den Spuren einklicken.` : `<br><br>Antwortet jetzt auf dem Handy!`);
    renderTrack();
    startTimer(TYPEN[q.typ].zeit);
    publish();
  }

  /* --- Timer --- */
  function startTimer(sec) {
    stopTimer(); G.tLeft = sec; G.paused = false; G.qStart = Date.now();
    $("#timer-s").textContent = sec; $("#timer").classList.remove("low");
    G.timer = setInterval(() => {
      if (G.paused) return;
      G.tLeft--;
      $("#timer-s").textContent = Math.max(0, G.tLeft);
      if (G.tLeft <= 5 && G.tLeft > 0) { $("#timer").classList.add("low"); SFX.tick(); }
      if (G.tLeft <= 0) {
        stopTimer(); SFX.alarm();
        if (G.mode === "beamer") { overlay(`<h2>Karten hoch!</h2><p>Zeigt eure Antwortkarte.</p>`, "OK", () => {}); }
        else setTimeout(() => G.phase === "question" && reveal(), 800);
      }
    }, 1000);
  }
  function stopTimer() { clearInterval(G.timer); G.timer = null; }
  $("#btn-plus10").addEventListener("click", () => { if (G.timer || G.phase === "question") { G.tLeft += 10; if (!G.timer && G.phase === "question") startTimer(G.tLeft); $("#timer-s").textContent = G.tLeft; publish(); } });
  $("#btn-pause").addEventListener("click", () => { G.paused = !G.paused; $("#btn-pause").textContent = G.paused ? "▶" : "⏸"; });
  $("#btn-sound").addEventListener("click", () => { $("#btn-sound").textContent = SFX.toggle() ? "🔊" : "🔇"; });

  /* ---------- Spuren (Crews) ---------- */
  function leader(i) { const m = Math.max(...G.crews.map((c) => c.fuel)); return m > 0 && G.crews[i].fuel === m; }
  function scaleMax() { return Math.max(12, ...G.crews.map((c) => c.fuel)) * 1.08; }

  function renderTrack() {
    const tr = $("#track");
    const r = G.idx >= 0 ? R() : null;
    tr.innerHTML = G.crews.map((c, i) => {
      const inDuel = G.duel && G.duel.includes(i);
      return `<div class="lane ${inDuel ? "duel" : ""} ${G.duel && !inDuel ? "dim" : ""}" data-i="${i}">
        <div class="lane-label"><span class="lane-flag" style="background:${CREW_COLORS[i]}"></span><span class="lane-name">${esc(c.name)}</span>
          <span class="lane-fuel"><img src="assets/kristall.png" alt="">${c.fuel}</span></div>
        <div class="lane-road"><div class="shuttle" style="left:${(c.fuel / scaleMax()) * 100}%"><img src="assets/${leader(i) ? "shuttle_gold" : "shuttle"}.png" alt=""></div></div>
        <div class="lane-input">${laneControls(i)}</div>
      </div>`;
    }).join("");
    bindLane();
  }

  function laneControls(i) {
    const c = G.crews[i];
    const jk = (k, ico, title) => {
      const used = !c[k] && !c.active[k];
      const can = G.phase === "bet" || G.phase === "question";
      return `<button class="jk ${used ? "used" : ""} ${c.active[k] ? "active" : ""}" data-j="${k}" data-i="${i}" title="${title}" ${(!can || used) ? "disabled" : ""}>${ico}</button>`;
    };
    let h = jk("shield", "🛡", "Schild: kein Verlust in dieser Runde") + jk("turbo", "⚡", "Turbo: Gewinn ×2 in dieser Runde");
    if (G.phase === "bet") {
      const mx = maxBet(i), b = G.bets[i] ?? 0;
      if (G.mode === "beamer") {
        const vals = R().q.typ === "finale" ? [...new Set([0, Math.floor(mx / 3), Math.floor((2 * mx) / 3), mx])] : [0, 1, 2, 3].filter((v) => v <= mx);
        h += vals.map((v) => `<button class="ib bet ${b === v ? "sel" : ""}" data-b="${v}" data-i="${i}">${v}</button>`).join("");
      } else h += `<span class="pill">Einsatz: ${b}</span>`;
    } else if (G.phase === "question") {
      if (G.mode === "beamer") {
        h += LETTERS.map((L, p) => `<button class="ib ${G.answers[i] === p ? "sel" : ""}" style="background:${OPT_COLORS[p]}" data-a="${p}" data-i="${i}">${L}</button>`).join("");
      } else {
        const st = onlineCrewStatus(i);
        h += `<span class="pill ${st.done ? "ok" : ""}">${st.text}</span>`;
      }
    } else if (G.phase === "reveal" && G.lastRes) {
      const res = G.lastRes[i];
      if (res && res.answered) h += `<span class="pill ${res.correct ? "ok" : "bad"}">${res.letter} ${res.correct ? "✓" : "✗"}</span>`;
      else if (res && res.part) h += `<span class="pill">–</span>`;
    }
    return h;
  }

  function bindLane() {
    $$(".ib[data-a]").forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.i, p = +b.dataset.a;
      G.answers[i] = G.answers[i] === p ? undefined : p; SFX.click(); refreshLane(i);
    }));
    $$(".ib[data-b]").forEach((b) => b.addEventListener("click", () => { G.bets[+b.dataset.i] = +b.dataset.b; SFX.click(); refreshLane(+b.dataset.i); }));
    $$(".jk").forEach((b) => b.addEventListener("click", () => toggleJoker(+b.dataset.i, b.dataset.j)));
  }
  function refreshLane(i) {
    const lane = $(`.lane[data-i="${i}"] .lane-input`);
    if (lane) { lane.innerHTML = laneControls(i); bindLane(); }
  }
  function toggleJoker(i, k) {
    const c = G.crews[i];
    if (c.active[k]) { c.active[k] = false; c[k] = true; }
    else if (c[k]) { c.active[k] = true; c[k] = false; SFX.right(); }
    refreshLane(i); publish();
  }

  /* ---------- Auswertung ---------- */
  function reveal() {
    if (G.phase !== "question") return;
    stopTimer(); hideOverlay();
    const r = R(), q = r.q, cp = r.order.indexOf(q.correct);
    if (G.mode === "online") collectOnline();
    const n = G.crews.length, mult = G.double ? 2 : 1;
    const res = {};
    for (let i = 0; i < n; i++) {
      const a = G.answers[i];
      res[i] = { answered: a !== undefined && a !== null, correct: a === cp, letter: a != null ? LETTERS[a] : "–", delta: 0, part: true, hit: false };
    }
    const gain = (i, v) => { const c = G.crews[i]; res[i].delta += v * mult * (c.active.turbo ? 2 : 1); };
    const loss = (i, v) => { if (!G.crews[i].active.shield) res[i].delta -= v; else res[i].shielded = true; };

    if (q.typ === "funk" || q.typ === "mission") {
      const pts = q.typ === "funk" ? 2 : 3;
      for (let i = 0; i < n; i++) if (res[i].correct) gain(i, pts);
      if (G.mode === "online" && q.typ === "funk") {
        const fast = Object.entries(G.crewTimes || {}).filter(([i]) => res[i] && res[i].correct).sort((x, y) => x[1] - y[1])[0];
        if (fast) { gain(+fast[0], 1); res[+fast[0]].tempo = true; }
      }
    } else if (q.typ === "duell") {
      const [a, b] = G.duel, ca = res[a].correct, cb = res[b].correct;
      if (ca && !cb) { gain(a, 2); loss(b, 1); res[b].hit = true; }
      else if (cb && !ca) { gain(b, 2); loss(a, 1); res[a].hit = true; }
      else if (ca && cb) { gain(a, 1); gain(b, 1); }
      else for (let i = 0; i < n; i++) if (i !== a && i !== b && res[i].correct) { gain(i, 1); res[i].steal = true; }
      for (let i = 0; i < n; i++) if (i !== a && i !== b && !res[i].steal) res[i].part = res[i].answered;
    } else { // wette, finale
      for (let i = 0; i < n; i++) {
        const bet = Math.min(G.bets[i] || 0, maxBet(i));
        res[i].bet = bet;
        if (res[i].correct) gain(i, bet); else loss(i, bet);
      }
    }
    const before = G.crews.map((c) => c.fuel);
    G.crews.forEach((c, i) => (c.fuel = Math.max(0, c.fuel + res[i].delta)));
    G.lastRes = res;
    phase("reveal");

    // Optionen markieren
    $$(".opt").forEach((el) => {
      const p = +el.dataset.p;
      el.classList.add(p === cp ? "right" : "wrong");
      const who = Object.keys(res).filter((i) => G.answers[i] === p).map((i) => `<i style="background:${CREW_COLORS[i]}"></i>`).join("");
      el.querySelector(".who").innerHTML = who;
    });
    // Post-it
    $("#side-info").classList.add("hidden");
    $("#postit").classList.remove("hidden");
    $("#postit-h").textContent = `Richtig: ${LETTERS[cp]}`;
    $("#postit-t").innerHTML = esc(q.expl) + (r.planet.termin ? `<span class="ref">→ Termin ${r.planet.termin}: ${esc(r.planet.titel)}</span>` : "");

    renderTrack();
    animateResults(res);
    const anyRight = Object.values(res).some((x) => x.correct);
    anyRight ? SFX.right() : SFX.wrong();
    if (Object.values(res).some((x) => x.hit)) setTimeout(SFX.boom, 500);

    // Protokoll
    const ts = new Date().toISOString();
    for (let i = 0; i < n; i++) {
      G.log.push({ ebene: "crew", zeit: ts, modus: G.mode, raum: G.room || "", runde: G.roundNo, frage_id: q.id, planet: r.planet.name, termin: r.planet.termin, typ: q.typ,
        crew: G.crews[i].name, pseudonym: "", antwort: res[i].letter, antwort_original: G.answers[i] != null ? r.order[G.answers[i]] : "", richtig: res[i].answered ? (res[i].correct ? 1 : 0) : "",
        einsatz: res[i].bet ?? "", joker: Object.keys(G.crews[i].active).filter((k) => G.crews[i].active[k]).join("+"), reaktionszeit_ms: "", kristalle_vorher: before[i], kristalle_nachher: G.crews[i].fuel });
    }
    if (G.mode === "online") logPlayers(r, cp, ts);
    publish({ reveal: true, cp, res });
  }

  function animateResults(res) {
    Object.entries(res).forEach(([i, x]) => {
      const lane = $(`.lane[data-i="${i}"] .lane-road`);
      if (!lane) return;
      const sh = lane.querySelector(".shuttle");
      const left = parseFloat(sh.style.left);
      if (x.delta) {
        const d = document.createElement("div");
        d.className = "delta " + (x.delta > 0 ? "plus" : "minus");
        d.style.left = `calc(${left}% + 120px)`;
        d.textContent = (x.delta > 0 ? "+" : "") + x.delta + (x.tempo ? " ⚡Tempo" : "") + (x.steal ? " (gestohlen)" : "");
        lane.appendChild(d);
      } else if (x.shielded) {
        const d = document.createElement("div"); d.className = "delta plus"; d.style.left = `calc(${left}% + 120px)`; d.textContent = "🛡 geschützt"; lane.appendChild(d);
      }
      if (x.hit) {
        const a = document.createElement("img"); a.src = "assets/asteroid.png"; a.className = "asteroid"; lane.appendChild(a);
        requestAnimationFrame(() => requestAnimationFrame(() => (a.style.left = left + "%")));
        const b = document.createElement("img"); b.src = "assets/explosion.png"; b.className = "boom"; b.style.left = left + "%";
        setTimeout(() => { a.remove(); lane.appendChild(b); }, 650);
      }
    });
  }

  function afterReveal() { nextRound(); }

  $("#btn-next").addEventListener("click", () => { SFX.unlock(); SFX.click(); onNext(); });
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === " " || e.key === "ArrowRight") { e.preventDefault(); if (!$("#overlay").classList.contains("hidden")) { const b = $("#ov-btn"); b && b.click(); } else if (!$("#s-game").classList.contains("hidden")) onNext(); else if (!$("#s-brief").classList.contains("hidden")) $("#brief-next").click(); }
  });
  function onNext() {
    if (G.phase === "bet") phaseQuestion();
    else if (G.phase === "question") reveal();
    else if (G.phase === "reveal") afterReveal();
  }

  /* ---------- Visuals ---------- */
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

  /* ---------- Ende ---------- */
  function endGame() {
    stopTimer(); phase("end");
    const ranked = G.crews.map((c, i) => ({ ...c, i })).sort((a, b) => b.fuel - a.fuel);
    const order = ranked.length >= 3 ? [ranked[1], ranked[0], ranked[2], ...ranked.slice(3)] : ranked;
    const maxF = Math.max(1, ranked[0].fuel);
    $("#podium").innerHTML = order.map((c) => {
      const rank = ranked.indexOf(c) + 1;
      const h = 120 + (c.fuel / maxF) * 330 * (rank <= 3 ? 1 : 0.6);
      return `<div class="pod"><img src="assets/shuttle.png" alt=""><div class="nm" style="color:${CREW_COLORS[c.i]}">${esc(c.name)}</div>
        <div class="bar" style="height:${h}px"><span class="rank">${rank}.</span>${c.fuel} <img src="assets/kristall.png" style="height:40px;margin:6px auto" alt=""></div></div>`;
    }).join("");
    show("#s-end"); SFX.fanfare(); confetti();
    publish({ end: true, ranking: ranked.map((c) => ({ name: c.name, fuel: c.fuel })) });
  }

  function confetti() {
    const cv = $("#confetti"), ctx = cv.getContext("2d"); cv.width = 1920; cv.height = 1080;
    const P = Array.from({ length: 220 }, () => ({ x: Math.random() * 1920, y: -Math.random() * 600, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 4, s: 6 + Math.random() * 8, c: CREW_COLORS[Math.floor(Math.random() * 6)], a: Math.random() * 6 }));
    let t = 0;
    (function f() {
      ctx.clearRect(0, 0, 1920, 1080);
      P.forEach((p) => { p.x += p.vx; p.y += p.vy; p.a += 0.1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (++t < 360) requestAnimationFrame(f); else ctx.clearRect(0, 0, 1920, 1080);
    })();
  }

  $("#btn-csv").addEventListener("click", () => {
    const cols = ["ebene", "zeit", "modus", "raum", "runde", "frage_id", "planet", "termin", "typ", "crew", "pseudonym", "antwort", "antwort_original", "richtig", "einsatz", "joker", "reaktionszeit_ms", "kristalle_vorher", "kristalle_nachher"];
    const csv = [cols.join(";"), ...G.log.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `MissionMethodik_${T0.toISOString().slice(0, 10)}${G.room ? "_" + G.room : ""}.csv`;
    a.click();
  });
  $("#btn-again").addEventListener("click", () => { cleanupOnline(); show("#s-setup"); });

  /* =========================================================
     ONLINE-MODUS
     ========================================================= */
  async function startOnline() {
    await NET.init();
    const settings = { amode: G.amode, research: G.research, total: G.rounds.length };
    G.room = await NET.createRoom(settings, G.crews.map((c) => c.name));
    const base = location.href.replace(/[^/]*(\?.*)?(#.*)?$/, "");
    const url = `${base}play.html?r=${G.room}`;
    const qr = qrcode(0, "M"); qr.addData(url); qr.make();
    $("#qr").innerHTML = qr.createImgTag(8, 0);
    $("#join-url").textContent = url;
    $("#room-code").textContent = G.room;
    show("#s-lobby");
    const pref = NET.ref(`rooms/${G.room}/players`);
    const h = pref.on("value", (s) => { G.players = s.val() || {}; renderLobby(); if (G.phase === "question" || G.phase === "bet") { onlineTick(); } });
    G.unsub.push(() => pref.off("value", h));
    renderLobby();
  }

  function crewMembers(i) {
    const list = Object.entries(G.players).filter(([, p]) => p.crew === i).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0));
    return G.amode === "crew" ? list.slice(0, 1) : list;
  }
  function renderLobby() {
    $("#lobby-crews").innerHTML = G.crews.map((c, i) => `<div class="lobby-crew"><span style="color:${CREW_COLORS[i]}">■ ${esc(c.name)}</span><span>${crewMembers(i).length} 👩‍🚀</span></div>`).join("") +
      `<p class="hint">Insgesamt ${Object.keys(G.players).length} Personen verbunden${G.research ? " · Forschungsmodus aktiv" : ""}.</p>`;
  }
  $("#btn-lobby-go").addEventListener("click", () => { SFX.unlock(); publish({ brief: true }); briefing(() => showMap()); });

  let roundRefs = [];
  function listenRound() {
    roundRefs.forEach((f) => f()); roundRefs = [];
    const i = G.roundNo;
    const aRef = NET.ref(`rooms/${G.room}/answers/${i}`);
    const ha = aRef.on("value", (s) => { G.pAnswers = s.val() || {}; onlineTick(); });
    const bRef = NET.ref(`rooms/${G.room}/bets/${i}`);
    const hb = bRef.on("value", (s) => { G.pBets = s.val() || {}; aggregateBets(); });
    const jRef = NET.ref(`rooms/${G.room}/jokerReq/${i}`);
    const hj = jRef.on("child_added", (s) => {
      const ci = +s.key, req = s.val() || {};
      Object.keys(req).forEach((k) => { const c = G.crews[ci]; if (c && c[k] && !c.active[k]) toggleJoker(ci, k); });
    });
    const hj2 = jRef.on("child_changed", (s) => {
      const ci = +s.key, req = s.val() || {};
      Object.keys(req).forEach((k) => { const c = G.crews[ci]; if (c && c[k] && !c.active[k]) toggleJoker(ci, k); });
    });
    roundRefs.push(() => aRef.off("value", ha), () => bRef.off("value", hb), () => jRef.off("child_added", hj), () => jRef.off("child_changed", hj2));
  }

  function aggregateBets() {
    G.crews.forEach((c, i) => {
      const vals = crewMembers(i).map(([u]) => G.pBets[u] && G.pBets[u].bet).filter((v) => v != null).sort((a, b) => a - b);
      if (vals.length) G.bets[i] = Math.min(maxBet(i), vals[Math.floor((vals.length - 1) / 2)]);
      refreshLane(i);
    });
  }

  function crewAnswer(i) {
    const mem = crewMembers(i), votes = {}, firstT = {};
    let answered = 0;
    mem.forEach(([u]) => {
      const a = G.pAnswers[u]; if (!a || a.opt == null) return;
      answered++; votes[a.opt] = (votes[a.opt] || 0) + 1;
      firstT[a.opt] = Math.min(firstT[a.opt] ?? Infinity, a.rt ?? Infinity);
    });
    const opts = Object.keys(votes).map(Number);
    if (!opts.length) return { opt: undefined, answered, total: mem.length };
    opts.sort((x, y) => votes[y] - votes[x] || firstT[x] - firstT[y]);
    return { opt: opts[0], answered, total: mem.length, t: firstT[opts[0]] };
  }
  function onlineCrewStatus(i) {
    const a = crewAnswer(i);
    if (!a.total) return { text: "niemand verbunden", done: true };
    return { text: `${a.answered}/${a.total} geantwortet`, done: a.answered >= a.total };
  }
  function onlineTick() {
    if (G.phase !== "question") return;
    G.crews.forEach((c, i) => refreshLane(i));
    const relevant = G.duel ? G.duel : G.crews.map((c, i) => i);
    const all = relevant.every((i) => { const a = crewAnswer(i); return !a.total || a.answered >= a.total; });
    const anyone = relevant.some((i) => crewAnswer(i).total);
    if (all && anyone) setTimeout(() => G.phase === "question" && reveal(), 900);
  }
  function collectOnline() {
    G.crewTimes = {};
    G.crews.forEach((c, i) => { const a = crewAnswer(i); G.answers[i] = a.opt; if (a.opt != null) G.crewTimes[i] = a.t; });
  }

  function logPlayers(r, cp, ts) {
    Object.entries(G.pAnswers).forEach(([u, a]) => {
      const p = G.players[u]; if (!p) return;
      const consent = !!p.consent;
      if (G.research && !consent) return;
      const row = { ebene: "person", zeit: ts, modus: "online-" + G.amode, raum: G.room, runde: G.roundNo, frage_id: r.q.id, planet: r.planet.name, termin: r.planet.termin, typ: r.q.typ,
        crew: G.crews[p.crew] ? G.crews[p.crew].name : "", pseudonym: G.research ? p.code || "" : "", antwort: a.opt != null ? LETTERS[a.opt] : "", antwort_original: a.opt != null ? r.order[a.opt] : "",
        richtig: a.opt === cp ? 1 : 0, einsatz: G.pBets[u] ? G.pBets[u].bet : "", joker: "", reaktionszeit_ms: a.rt ?? "", kristalle_vorher: "", kristalle_nachher: "" };
      G.log.push(row);
      if (G.research) NET.ref(`research/${G.room}`).push(row);
    });
  }

  function publish(extra = {}) {
    if (G.mode !== "online" || !G.room) return;
    const base = { fuel: G.crews.map((c) => c.fuel) };
    if (extra.brief) return NET.ref(`rooms/${G.room}/state`).set({ ...base, phase: "brief" });
    if (extra.map) return NET.ref(`rooms/${G.room}/state`).set({ ...base, phase: "map", chooser: extra.chooser, open: extra.open.map((id) => PLANETEN.find((p) => p.id === id).name) });
    if (extra.end) return NET.ref(`rooms/${G.room}/state`).set({ ...base, phase: "end", ranking: extra.ranking });
    const r = R();
    if (!r) return;
    if (extra.reveal === undefined && (G.phase === "bet" || G.phase === "question") && G.listenIdx !== G.roundNo) { G.listenIdx = G.roundNo; listenRound(); }
    const st = {
      phase: G.phase, idx: G.roundNo, nr: G.idx + 1, total: G.rounds.length, typ: r.q.typ, typName: TYPEN[r.q.typ].name,
      planet: r.planet.name, termin: r.planet.termin || "", titel: r.planet.titel || "",
      duel: G.duel || null, double: !!G.double,
      fuel: G.crews.map((c) => c.fuel), jokers: G.crews.map((c) => ({ shield: c.shield, turbo: c.turbo, active: c.active })),
      maxBet: G.crews.map((c, i) => maxBet(i)), bets: G.crews.map((c, i) => G.bets[i] ?? 0),
    };
    if (G.phase === "question" || G.phase === "reveal") {
      st.q = r.q.q; st.opts = r.order.map((oi) => r.q.opts[oi]); st.dauer = G.tLeft; st.start = NET.TS();
      if (r.q.visual) st.visual = true;
    }
    if (extra.reveal) {
      st.correct = extra.cp; st.expl = r.q.expl;
      st.res = Object.fromEntries(Object.entries(extra.res).map(([i, x]) => [i, { delta: x.delta, correct: x.correct, answered: x.answered }]));
    }
    if (extra.event) st.event = extra.event;
    if (extra.end) st.ranking = extra.ranking;
    NET.ref(`rooms/${G.room}/state`).set(st);
  }

  function cleanupOnline() { roundRefs.forEach((f) => f()); G.unsub.forEach((f) => f()); roundRefs = []; G.unsub = []; G.room = null; G.listenIdx = null; }

  // Test-Hook (nur für automatische Tests)
  window.__G = G;
})();
