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
    $("#ov-card").classList.remove("wide");
    $("#ov-card").innerHTML = html + (btnLabel ? `<div><button class="btn green" id="ov-btn">${btnLabel}</button></div>` : "");
    $("#overlay").classList.remove("hidden");
    if (btnLabel) $("#ov-btn").addEventListener("click", () => { SFX.click(); hideOverlay(); onClose && onClose(); });
  }
  function hideOverlay() { $("#overlay").classList.add("hidden"); }

  /* ---------- Runden-Ablauf ----------
     Ablauf pro Runde: (Planet-Intro) → Rundentyp-Karte → [Einsätze] → Frage → [Karten hoch: Antworten eintragen] → Auflösung mit Erklärung → Rennstand */
  const R = () => G.rounds[G.idx];

  function nextRound() {
    stopTimer(); hideOverlay();
    G.idx++;
    if (G.idx >= G.rounds.length) return blockDone();
    G.roundNo++;
    G.answers = {}; G.bets = {}; G.pAnswers = {}; G.pBets = {}; G.lastRes = null;
    G.crews.forEach((c) => (c.active = {}));
    G.double = G.nextDouble; G.nextDouble = false;
    const r = R();
    if (r.q.typ === "duell") {
      const n = G.crews.length, a = (2 * G.duelCount) % n;
      G.duel = [a, (a + 1) % n]; G.duelCount++;
    } else G.duel = null;
    show("#s-game"); renderTop(); clearQ(); renderCrewbar();
    if (r.first) {
      const p = r.planet;
      phase("intro"); SFX.whoosh();
      overlay(p.id === "finale"
        ? `<img src="assets/astronaut.png" alt=""><h2>Finale: Landung!</h2><p>Letzte Frage. Jede Crew setzt so viele Kristalle, wie sie will.</p>`
        : `<img src="${p.bild}" alt=""><h2>${esc(p.name)}</h2><p>Termin ${p.termin}: ${esc(p.titel)}</p><p class="small">${G.rounds.length} Runden</p>`,
        "Landen", () => typeSplash());
    } else typeSplash();
  }

  function typeSplash() {
    const r = R(), t = TYPEN[r.q.typ];
    phase("splash");
    const duel = G.duel ? `<p class="duel-line"><b style="color:${CREW_COLORS[G.duel[0]]}">${esc(G.crews[G.duel[0]].name)}</b> ⚔ <b style="color:${CREW_COLORS[G.duel[1]]}">${esc(G.crews[G.duel[1]].name)}</b></p><p class="small">Alle anderen sind Funkkontrolle: Liegen beide falsch, holen sie mit der richtigen Antwort +1.</p>` : "";
    overlay(`<div class="splash-ico">${t.icon}</div><h2>${esc(r.q.art || t.name)}</h2>${duel}<p>${esc(t.info)}${G.double ? "<br><b>☀️ Sonnensturm: Diese Runde zählt doppelt!</b>" : ""}</p>`, "Los ▶", () => {
      if (r.q.typ === "wette" || r.q.typ === "finale") phaseBet(); else phaseQuestion();
    });
  }

  function phase(p) { G.phase = p; updateNextBtn(); }

  function updateNextBtn() {
    const b = $("#btn-next");
    const L = { bet: G.mode === "beamer" ? "Einsätze eintragen ▶" : "Frage zeigen ▶", question: G.mode === "beamer" ? "Karten hoch! ▶" : "Auflösen ▶", reveal: "Rennstand ▶" };
    b.textContent = L[G.phase] || "Weiter ▶";
    b.classList.toggle("hidden", !L[G.phase]);
  }

  function renderTop() {
    const r = R(), t = TYPEN[r.q.typ];
    $("#tb-planet").src = r.planet.bild;
    $("#tb-title").textContent = r.planet.id === "finale" ? "Finale" : `${r.planet.name} · Termin ${r.planet.termin}`;
    $("#tb-type").innerHTML = `${t.icon} ${esc(r.q.art || t.name)}${G.double ? " <b>×2</b>" : ""}`;
    $("#tb-round").textContent = `Runde ${G.idx + 1}/${G.rounds.length}`;
    $("#timer-s").textContent = t.zeit;
  }

  function clearQ() {
    $("#qtext").textContent = ""; $("#opts").innerHTML = ""; $("#visual").classList.add("hidden");
    $("#postit").classList.add("hidden"); $("#g-body").classList.remove("reveal", "with-visual"); $("#bet-info").classList.add("hidden");
  }

  /* ---------- Crew-Leiste unten ---------- */
  function renderCrewbar() {
    $("#crewbar").innerHTML = G.crews.map((c, i) => {
      const inDuel = G.duel && G.duel.includes(i), res = G.lastRes && G.lastRes[i];
      let status = "";
      if (G.phase === "question" && G.mode === "online") { const st = onlineCrewStatus(i); status = st.done ? "✓" : `${st.text.split(" ")[0]}`; }
      if (G.phase === "bet") status = `Einsatz ${G.bets[i] ?? 0}`;
      if (res && (res.answered || res.delta)) status = `${res.letter} ${res.correct ? "✓" : "✗"}`;
      const jk = (k, ico) => (c.active[k] ? `<span class="jk-on">${ico}</span>` : c[k] ? `<span class="jk-av">${ico}</span>` : "");
      return `<div class="cchip ${inDuel ? "duel" : ""} ${G.duel && !inDuel ? "dim" : ""} ${res ? (res.correct ? "ok" : res.answered ? "bad" : "") : ""}" style="--c:${CREW_COLORS[i]}">
        <span class="cc-name">${inDuel ? "⚔ " : ""}${esc(c.name)}</span>
        <span class="cc-fuel"><img src="assets/kristall.png" alt="">${c.fuel}</span>
        <span class="cc-st">${status}</span><span class="cc-jk">${jk("shield", "🛡")}${jk("turbo", "⚡")}</span></div>`;
    }).join("");
  }

  /* ---------- Eingabe-Panel (Beamer-Modus) ---------- */
  function panel(kind) {
    const r = R();
    const rows = G.crews.map((c, i) => {
      const inDuel = G.duel && G.duel.includes(i);
      let btns = "";
      if (kind === "bet") {
        const mx = maxBet(i);
        const vals = r.q.typ === "finale" ? [...new Set([0, Math.floor(mx / 3), Math.floor((2 * mx) / 3), mx])] : [0, 1, 2, 3];
        btns = vals.map((v) => `<button class="pb bet ${(G.bets[i] ?? 0) === v ? "sel" : ""}" data-b="${v}" data-i="${i}">${v}</button>`).join("");
      } else {
        btns = LETTERS.map((L, p) => `<button class="pb ${G.answers[i] === p ? "sel" : ""}" style="background:${OPT_COLORS[p]}" data-a="${p}" data-i="${i}">${L}</button>`).join("");
      }
      const jk = (k, ico, lab) => { const used = !c[k] && !c.active[k]; return `<button class="pj ${c.active[k] ? "on" : ""}" data-j="${k}" data-i="${i}" ${used ? "disabled" : ""} title="${lab}">${ico}</button>`; };
      return `<div class="prow ${G.duel ? (inDuel ? "duel" : "spect") : ""}"><span class="pname" style="border-color:${CREW_COLORS[i]}">${esc(c.name)}${G.duel ? `<small>${inDuel ? "Duell" : "Funkkontrolle"}</small>` : ""}</span>
        <span class="pbtns">${btns}</span><span class="pjk">${jk("shield", "🛡", "Schild")}${jk("turbo", "⚡", "Turbo")}</span></div>`;
    }).join("");
    const head = kind === "bet" ? `<h2>Einsätze</h2><p class="small">Jede Crew sagt ihren Einsatz an. Joker jetzt ansagen: 🛡 kein Verlust · ⚡ Gewinn ×2</p>`
      : `<h2>Karten hoch!</h2><p class="small">Klicke für jede Crew den Buchstaben auf ihrer Karte an. Joker: 🛡 kein Verlust · ⚡ Gewinn ×2</p>`;
    overlay(`<div class="pcard">${head}<div class="prows">${rows}</div></div>`, kind === "bet" ? "Frage zeigen ▶" : "Auflösen ▶", () => (kind === "bet" ? phaseQuestion() : reveal()));
    $("#ov-card").classList.add("wide");
    $$("#ov-card .pb[data-a]").forEach((b) => b.addEventListener("click", () => { const i = +b.dataset.i, p = +b.dataset.a; G.answers[i] = G.answers[i] === p ? undefined : p; SFX.click(); panelRefresh(kind); }));
    $$("#ov-card .pb[data-b]").forEach((b) => b.addEventListener("click", () => { G.bets[+b.dataset.i] = +b.dataset.b; SFX.click(); panelRefresh(kind); }));
    $$("#ov-card .pj").forEach((b) => b.addEventListener("click", () => { toggleJoker(+b.dataset.i, b.dataset.j); panelRefresh(kind); }));
  }
  function panelRefresh(kind) { panel(kind); }

  /* --- Wette --- */
  function maxBet(ci) { return R().q.typ === "finale" ? Math.max(3, G.crews[ci].fuel) : 3; }
  function phaseBet() {
    phase("bet");
    const r = R();
    G.crews.forEach((c, i) => (G.bets[i] = 0));
    $("#qtext").innerHTML = `Wie sicher seid ihr beim Thema <b>«${esc(r.planet.id === "finale" ? "Zusammenhang und Wirkung" : r.planet.titel)}»</b>?`;
    $("#bet-info").classList.remove("hidden");
    $("#bet-info").innerHTML = r.q.typ === "finale" ? "Setzt 0 bis alle eure Kristalle.<br>Richtig: Einsatz dazu · Falsch: Einsatz weg" : "Setzt 0, 1, 2 oder 3 Kristalle.<br>Richtig: Einsatz dazu · Falsch: Einsatz weg";
    renderCrewbar();
    publish();
    if (G.mode === "beamer") panel("bet");
  }

  /* --- Frage --- */
  function phaseQuestion() {
    hideOverlay(); phase("question");
    const r = R(), q = r.q;
    $("#bet-info").classList.add("hidden");
    $("#qtext").textContent = q.q;
    const body = $("#g-body");
    if (q.visual) { body.classList.add("with-visual"); $("#visual").classList.remove("hidden"); $("#visual").innerHTML = visualSVG(q.visual); }
    const long = !!q.visual || q.opts.some((o) => o.length > 55);
    $("#opts").classList.toggle("one-col", long);
    $("#opts").innerHTML = r.order.map((oi, p) => `<div class="opt" data-p="${p}"><span class="L" style="background:${OPT_COLORS[p]}">${LETTERS[p]}</span><span class="ot">${esc(q.opts[oi])}</span><span class="who"></span></div>`).join("");
    renderCrewbar();
    startTimer(TYPEN[q.typ].zeit);
    publish();
  }

  /* --- Timer --- */
  function startTimer(sec) {
    stopTimer(); G.tLeft = sec; G.paused = false;
    $("#timer-s").textContent = sec; $("#timer").classList.remove("low");
    G.timer = setInterval(() => {
      if (G.paused) return;
      G.tLeft--;
      $("#timer-s").textContent = Math.max(0, G.tLeft);
      if (G.tLeft <= 5 && G.tLeft > 0) { $("#timer").classList.add("low"); SFX.tick(); }
      if (G.tLeft <= 0) {
        stopTimer(); SFX.alarm();
        if (G.mode === "beamer") { if (G.phase === "question") panel("answer"); }
        else setTimeout(() => G.phase === "question" && reveal(), 800);
      }
    }, 1000);
  }
  function stopTimer() { clearInterval(G.timer); G.timer = null; }
  $("#btn-plus10").addEventListener("click", () => { if (G.phase === "question") { G.tLeft = Math.max(0, G.tLeft) + 10; if (!G.timer) startTimer(G.tLeft); $("#timer-s").textContent = G.tLeft; publish(); } });
  $("#btn-pause").addEventListener("click", () => { G.paused = !G.paused; $("#btn-pause").textContent = G.paused ? "▶" : "⏸"; });
  $("#btn-sound").addEventListener("click", () => { $("#btn-sound").textContent = SFX.toggle() ? "🔊" : "🔇"; });

  function toggleJoker(i, k) {
    const c = G.crews[i];
    if (c.active[k]) { c.active[k] = false; c[k] = true; }
    else if (c[k]) { c.active[k] = true; c[k] = false; SFX.right(); }
    renderCrewbar(); publish();
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
      res[i] = { answered: a !== undefined && a !== null, correct: a === cp, letter: a != null ? LETTERS[a] : "–", delta: 0, hit: false };
    }
    const gain = (i, v) => { res[i].delta += v * mult * (G.crews[i].active.turbo ? 2 : 1); };
    const loss = (i, v) => { if (!G.crews[i].active.shield) res[i].delta -= v; else if (v) res[i].shielded = true; };

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
    } else {
      for (let i = 0; i < n; i++) {
        const bet = Math.min(G.bets[i] || 0, maxBet(i));
        res[i].bet = bet;
        if (res[i].correct) gain(i, bet); else loss(i, bet);
      }
    }
    G.prevFuel = G.crews.map((c) => c.fuel);
    G.crews.forEach((c, i) => (c.fuel = Math.max(0, c.fuel + res[i].delta)));
    G.lastRes = res;
    phase("reveal");

    $$(".opt").forEach((el) => {
      const p = +el.dataset.p;
      el.classList.add(p === cp ? "right" : "wrong");
      el.querySelector(".who").innerHTML = Object.keys(res).filter((i) => G.answers[i] === p).map((i) => `<i style="background:${CREW_COLORS[i]}" title="${esc(G.crews[i].name)}"></i>`).join("");
    });
    $("#g-body").classList.add("reveal");
    $("#opts").classList.add("one-col");
    $("#postit").classList.remove("hidden");
    $("#postit-h").textContent = `Richtig: ${LETTERS[cp]}`;
    $("#postit-t").innerHTML = esc(q.expl) + (r.planet.termin ? `<span class="ref">→ Termin ${r.planet.termin}: ${esc(r.planet.titel)}</span>` : "");
    renderCrewbar();
    Object.values(res).some((x) => x.correct) ? SFX.right() : SFX.wrong();

    const ts = new Date().toISOString();
    for (let i = 0; i < n; i++) {
      G.log.push({ ebene: "crew", zeit: ts, modus: G.mode, raum: G.room || "", runde: G.roundNo, frage_id: q.id, planet: r.planet.name, termin: r.planet.termin, typ: q.typ,
        crew: G.crews[i].name, pseudonym: "", antwort: res[i].letter, antwort_original: G.answers[i] != null ? r.order[G.answers[i]] : "", richtig: res[i].answered ? (res[i].correct ? 1 : 0) : "",
        einsatz: res[i].bet ?? "", joker: Object.keys(G.crews[i].active).filter((k) => G.crews[i].active[k]).join("+"), reaktionszeit_ms: "", kristalle_vorher: G.prevFuel[i], kristalle_nachher: G.crews[i].fuel });
    }
    if (G.mode === "online") logPlayers(r, cp, ts);
    publish({ reveal: true, cp, res });
  }

  /* ---------- Rennstand ---------- */
  function leader(i) { const m = Math.max(...G.crews.map((c) => c.fuel)); return m > 0 && G.crews[i].fuel === m; }
  function showRace() {
    phase("race");
    const res = G.lastRes || {}, prev = G.prevFuel || G.crews.map((c) => c.fuel);
    const scale = Math.max(12, ...G.crews.map((c) => c.fuel), ...prev) * 1.08;
    $("#track").innerHTML = G.crews.map((c, i) => `<div class="lane" data-i="${i}">
        <div class="lane-label"><span class="lane-flag" style="background:${CREW_COLORS[i]}"></span><span class="lane-name">${esc(c.name)}</span>
          <span class="lane-fuel"><img src="assets/kristall.png" alt=""><span class="fv">${prev[i]}</span></span></div>
        <div class="lane-road"><div class="shuttle" style="left:${(prev[i] / scale) * 100}%"><img src="assets/${leader(i) ? "shuttle_gold" : "shuttle"}.png" alt=""></div></div>
      </div>`).join("");
    const last = G.idx + 1 >= G.rounds.length;
    $("#btn-race-next").textContent = last ? (G.cur === "finale" ? "Siegerehrung ▶" : "Zur Sternenkarte ▶") : "Nächste Runde ▶";
    show("#s-race");
    setTimeout(() => {
      G.crews.forEach((c, i) => {
        const lane = $(`.lane[data-i="${i}"]`), road = lane.querySelector(".lane-road"), sh = road.querySelector(".shuttle"), x = res[i] || {};
        const left = (c.fuel / scale) * 100;
        sh.style.left = left + "%"; lane.querySelector(".fv").textContent = c.fuel;
        const txt = x.delta ? (x.delta > 0 ? "+" : "") + x.delta + (x.tempo ? " ⚡ Tempo" : "") + (x.steal ? " gestohlen" : "") : x.shielded ? "🛡 geschützt" : "";
        if (txt) { const d = document.createElement("div"); d.className = "delta " + (x.delta < 0 ? "minus" : "plus"); d.style.left = `calc(${left}% + 130px)`; d.textContent = txt; road.appendChild(d); }
        if (x.hit) {
          const a = document.createElement("img"); a.src = "assets/asteroid.png"; a.className = "asteroid"; road.appendChild(a);
          requestAnimationFrame(() => requestAnimationFrame(() => (a.style.left = left + "%")));
          setTimeout(() => { a.remove(); const b = document.createElement("img"); b.src = "assets/explosion.png"; b.className = "boom"; b.style.left = left + "%"; road.appendChild(b); SFX.boom(); }, 650);
        }
      });
      SFX.whoosh();
    }, 250);
  }
  $("#btn-race-next").addEventListener("click", () => { SFX.click(); nextRound(); });

  $("#btn-next").addEventListener("click", () => { SFX.unlock(); SFX.click(); onNext(); });
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key !== " " && e.key !== "ArrowRight") return;
    e.preventDefault();
    if (!$("#overlay").classList.contains("hidden")) { const b = $("#ov-btn"); b && b.click(); }
    else if (!$("#s-game").classList.contains("hidden")) onNext();
    else if (!$("#s-race").classList.contains("hidden")) $("#btn-race-next").click();
    else if (!$("#s-brief").classList.contains("hidden")) $("#brief-next").click();
  });
  function onNext() {
    if (G.phase === "bet") { if (G.mode === "beamer") panel("bet"); else phaseQuestion(); }
    else if (G.phase === "question") { if (G.mode === "beamer") { stopTimer(); panel("answer"); } else reveal(); }
    else if (G.phase === "reveal") showRace();
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
      renderCrewbar();
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
    renderCrewbar();
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
