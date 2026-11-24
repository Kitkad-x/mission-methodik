/* Gravitas · Mission Methodik — Handy der Crew */
(() => {
  const V = document.getElementById("view");
  const P = { room: null, settings: {}, crews: [], crew: null, consent: false, code: "", state: null, myAnswer: null, shownAt: 0, lastIdx: -1, players: {}, timer: null };
  const params = new URLSearchParams(location.search);

  function render(html) { V.innerHTML = html; }
  function head() {
    document.getElementById("h-room").textContent = P.room ? `Raum ${P.room}` : "Mission Methodik";
    const hc = document.getElementById("h-crew");
    if (P.crew != null) { hc.classList.remove("hidden"); hc.textContent = P.crews[P.crew]; hc.style.border = `2px solid ${CREW_COLORS[P.crew]}`; }
  }

  /* ---------- Einstieg ---------- */
  async function start() {
    const r = (params.get("r") || "").toUpperCase();
    if (!NET.configured()) return render(`<div class="card"><p class="err">Der Online-Modus ist noch nicht eingerichtet.</p></div>`);
    try { await NET.init(); } catch (e) { return render(`<div class="card"><p class="err">${esc(e.message)}</p></div>`); }
    if (r) joinRoom(r); else askCode();
  }

  function askCode(msg = "") {
    render(`<img src="assets/shuttle.png" class="shuttle" alt=""><h1>Mission Methodik</h1>
      <div class="card"><p>Gib den Raumcode vom Beamer ein:</p><input type="text" id="code" maxlength="4" autocomplete="off">
      ${msg ? `<p class="err">${esc(msg)}</p>` : ""}<button class="btn" id="go">Einsteigen</button></div>`);
    document.getElementById("go").onclick = () => joinRoom(document.getElementById("code").value.trim().toUpperCase());
  }

  async function joinRoom(code) {
    if (!/^[A-Z]{4}$/.test(code)) return askCode("Der Code hat vier Buchstaben.");
    const snap = await NET.ref(`rooms/${code}`).get();
    if (!snap.exists()) return askCode("Diesen Raum gibt es nicht (mehr).");
    const d = snap.val();
    P.room = code; P.settings = d.settings || {}; P.crews = d.crews || [];
    head();
    const me = d.players && d.players[NET.uid];
    if (me) { P.crew = me.crew; P.consent = !!me.consent; P.code = me.code || ""; head(); return listen(); }
    if (P.settings.research) consentView(); else crewView();
  }

  /* ---------- Einverständnis (Forschungsmodus) ---------- */
  function consentView() {
    render(`<h2>Bevor es losgeht</h2>
      <div class="card"><div class="consent-text">
        <p><b>Freiwillige Teilnahme an einer Studie</b></p>
        <p>Katharina Richter (PH St.Gallen) untersucht, wie Lernspiele das Wiederholen von Methodenwissen unterstützen. Dafür werden während des Spiels gespeichert: deine gewählten Antworten, ob sie richtig waren, deine Antwortzeit und deine Crew – zusammen mit einem Code, den du gleich selbst bildest. <b>Dein Name wird nicht erfasst.</b> Die Dozentin kann den Code keiner Person zuordnen.</p>
        <p>Die Daten liegen auf Servern von Google Firebase in der EU, werden nur für Forschung und die Verbesserung der Lehre verwendet und nicht mit Noten oder dem Leistungsnachweis verknüpft. Ergebnisse werden nur zusammengefasst veröffentlicht.</p>
        <p>Die Teilnahme ist freiwillig. Wenn du nicht einverstanden bist, spielst du ganz normal mit, aber deine Antworten werden nicht gespeichert. Du kannst dein Einverständnis später zurückziehen: Melde deinen Code per E-Mail, dann werden deine Daten gelöscht.</p>
      </div></div>
      <div class="card"><p><b>Dein persönlicher Code</b> (immer gleich bilden, damit Spiele verschiedener Sitzungen zusammengehören):</p>
        <div class="code-in">
          <div><label>Erste 2 Buchstaben des Vornamens deiner Mutter</label><input type="text" id="c1" maxlength="2"></div>
          <div><label>Dein Geburtstag (nur Tag, 2-stellig)</label><input type="text" id="c2" maxlength="2" inputmode="numeric"></div>
          <div><label>Erste 2 Buchstaben deines Geburtsorts</label><input type="text" id="c3" maxlength="2"></div>
        </div>
        <p class="small" id="cprev"></p>
        <button class="btn" id="yes">Einverstanden – Antworten mit Code speichern</button>
        <button class="btn grey" id="no">Nicht einverstanden – nur mitspielen</button></div>`);
    const upd = () => {
      const c = (document.getElementById("c1").value + document.getElementById("c2").value.padStart(2, "0") + document.getElementById("c3").value).toUpperCase();
      document.getElementById("cprev").textContent = "Code: " + c;
      return c;
    };
    ["c1", "c2", "c3"].forEach((id) => (document.getElementById(id).oninput = upd));
    document.getElementById("yes").onclick = () => {
      const c = upd();
      if (!/^[A-ZÄÖÜ]{2}\d{2}[A-ZÄÖÜ]{2}$/.test(c)) return alert("Bitte alle drei Felder ausfüllen (2 Buchstaben, 2 Ziffern, 2 Buchstaben).");
      P.consent = true; P.code = c; crewView();
    };
    document.getElementById("no").onclick = () => { P.consent = false; P.code = ""; crewView(); };
  }

  /* ---------- Crew wählen ---------- */
  async function crewView() {
    const snap = await NET.ref(`rooms/${P.room}/players`).get();
    const players = snap.val() || {};
    const count = P.crews.map((c, i) => Object.values(players).filter((p) => p.crew === i).length);
    render(`<h2>Wähle deine Crew</h2>` + P.crews.map((c, i) => {
      const taken = P.settings.amode === "crew" && count[i] > 0;
      return `<button class="btn grey crewbtn" data-i="${i}"><i style="background:${CREW_COLORS[i]}"></i>${esc(c)}<span class="small" style="margin-left:auto">${taken ? "Funkgerät besetzt – du schaust zu" : count[i] + " an Bord"}</span></button>`;
    }).join(""));
    V.querySelectorAll(".crewbtn").forEach((b) => (b.onclick = async () => {
      P.crew = +b.dataset.i;
      await NET.ref(`rooms/${P.room}/players/${NET.uid}`).set({ crew: P.crew, joined: NET.TS(), consent: P.consent, code: P.consent ? P.code : "" });
      head(); listen();
    }));
  }

  /* ---------- Spielzustand verfolgen ---------- */
  function listen() {
    NET.ref(`rooms/${P.room}/players`).on("value", (s) => (P.players = s.val() || {}));
    NET.ref(`rooms/${P.room}/state`).on("value", (s) => { P.state = s.val(); draw(); });
  }

  function iAmActive() {
    if (P.settings.amode !== "crew") return true;
    const mates = Object.entries(P.players).filter(([, p]) => p.crew === P.crew).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0));
    return !mates.length || mates[0][0] === NET.uid;
  }

  function jokerBar(st) {
    if (!st.jokers) return "";
    const j = st.jokers[P.crew] || {};
    const b = (k, label) => {
      const active = j.active && j.active[k];
      const can = j[k] && !active;
      return `<button class="btn ${active ? "active" : ""}" data-j="${k}" ${can && iAmActive() ? "" : "disabled"}>${label}${active ? " aktiv" : ""}</button>`;
    };
    return `<div class="jokers">${b("shield", "🛡 Schild")}${b("turbo", "⚡ Turbo")}</div>`;
  }
  function bindJokers(st) {
    V.querySelectorAll("[data-j]").forEach((btn) => (btn.onclick = () => {
      NET.ref(`rooms/${P.room}/jokerReq/${st.idx}/${P.crew}/${btn.dataset.j}`).transaction((cur) => cur || NET.uid);
      btn.disabled = true;
    }));
  }

  function stopTimer() { clearInterval(P.timer); P.timer = null; }

  function draw() {
    const st = P.state;
    stopTimer();
    if (!st || st.phase === "lobby" || !st.phase) {
      return render(`<img src="assets/shuttle.png" class="shuttle" alt=""><h1>Bereit zum Start</h1><div class="card"><p>Du bist in <b>${esc(P.crews[P.crew])}</b>. Schau auf den Beamer – gleich geht es los!</p>${P.settings.research ? `<p class="small">${P.consent ? "Forschung: einverstanden · Code " + esc(P.code) : "Forschung: nicht einverstanden – deine Antworten werden nicht gespeichert."}</p>` : ""}</div>`);
    }
    if (st.phase === "brief") return render(`<img src="assets/shuttle.png" class="shuttle" alt=""><h1>Briefing</h1><div class="card"><p>Schau auf den Beamer: Dort werden die Spielregeln erklärt.</p></div>`);
    if (st.phase === "map") {
      const mine = st.chooser === P.crew, open = st.open || [];
      let h = `<h1>Sternenkarte</h1><div class="card">`;
      if (mine && open.length) {
        h += `<p><b>👑 Ihr führt und wählt das nächste Ziel!</b>${P.settings.amode === "person" ? " Einigt euch – das erste Tippen zählt." : ""}</p>` +
          open.map((o) => `<button class="btn" data-pick="${esc(o.id)}">🪐 ${esc(o.name)}</button>`).join("");
      } else {
        h += `<p><b>${esc(P.crews[st.chooser] || "")}</b> wählt das nächste Ziel.</p><p>${open.map((o) => "🪐 " + esc(o.name)).join("<br>") || "Alle Planeten erkundet – gleich kommt die Landung!"}</p>`;
      }
      h += `</div><div class="card">${P.crews.map((c, i) => `<p style="margin:4px 0">${i === P.crew ? "<b>" : ""}${esc(c)}: ${st.fuel ? st.fuel[i] : 0} Kristalle${i === P.crew ? "</b>" : ""}</p>`).join("")}</div>`;
      render(h);
      V.querySelectorAll("[data-pick]").forEach((b) => (b.onclick = () => {
        NET.ref(`rooms/${P.room}/mapPick`).set({ id: b.dataset.pick, crew: P.crew, at: st.at ?? 0, by: NET.uid });
        V.querySelectorAll("[data-pick]").forEach((x) => (x.disabled = true));
        b.textContent = "✔ " + b.textContent;
      }));
      return;
    }
    if (st.idx !== P.lastIdx) { P.lastIdx = st.idx; P.myAnswer = null; P.shownAt = 0; }
    const top = `<p class="small">Runde ${st.nr || ""}/${st.total} · ${esc(st.planet)}${st.termin ? " · Termin " + st.termin : ""} · ${esc(st.typName)}${st.double ? " · ×2" : ""}</p>`;
    const fuel = st.fuel ? `<p class="small">Eure Kristalle: <b>${st.fuel[P.crew]}</b></p>` : "";

    if (st.phase === "end") {
      const rank = (st.ranking || []).findIndex((r) => r.name === P.crews[P.crew]) + 1;
      return render(`<img src="assets/shuttle.png" class="shuttle" alt=""><h1>Gelandet!</h1><div class="card"><p class="big">${rank ? rank + "." : ""}</p><p style="text-align:center">${esc(P.crews[P.crew])} – ${st.fuel ? st.fuel[P.crew] : ""} Kristalle</p></div><p class="small">Danke fürs Mitspielen!</p>`);
    }
    if (st.phase === "intro") return render(top + `<div class="card"><h2>${esc(st.planet)}</h2><p>${esc(st.titel)}</p><p>Schau auf den Beamer …</p></div>` + fuel);

    if (st.phase === "bet") {
      const mx = st.maxBet ? st.maxBet[P.crew] : 3;
      const vals = st.typ === "finale" ? [...new Set([0, Math.floor(mx / 3), Math.floor((2 * mx) / 3), mx])] : [0, 1, 2, 3].filter((v) => v <= mx);
      render(top + `<div class="card"><h2>${esc(st.typName)}</h2><p>Wie viele Kristalle setzt ${P.settings.amode === "person" ? "du (der mittlere Einsatz eurer Crew zählt)" : "eure Crew"}? Richtig: Einsatz dazu, falsch: Einsatz weg.</p>
        <div class="bets">${vals.map((v) => `<button class="btn" data-b="${v}" ${iAmActive() ? "" : "disabled"}>${v}</button>`).join("")}</div>
        <p class="small" id="betinfo"></p></div>` + jokerBar(st) + fuel);
      V.querySelectorAll("[data-b]").forEach((b) => (b.onclick = () => {
        NET.ref(`rooms/${P.room}/bets/${st.idx}/${NET.uid}`).set({ bet: +b.dataset.b, crew: P.crew });
        V.querySelectorAll("[data-b]").forEach((x) => x.classList.toggle("sel", x === b));
        document.getElementById("betinfo").textContent = "Einsatz gesendet: " + b.dataset.b;
      }));
      bindJokers(st);
      return;
    }

    if (st.phase === "question" || st.phase === "reveal") {
      const reveal = st.phase === "reveal";
      const inDuel = !st.duel || st.duel.includes(P.crew);
      if (!P.shownAt) P.shownAt = Date.now();
      let h = top;
      if (st.duel) h += `<p><b>☄️ Duell: ${esc(P.crews[st.duel[0]])} gegen ${esc(P.crews[st.duel[1]])}</b>${inDuel ? "" : "<br><span class='small'>Ihr seid Funkkontrolle: Liegen beide falsch, holt ihr mit der richtigen Antwort +1.</span>"}</p>`;
      if (!reveal) h += `<div class="timer" id="t"></div>`;
      h += `<div class="q">${esc(st.q)}</div>`;
      if (st.visual) h += `<p class="small">📊 Die Grafik siehst du am Beamer.</p>`;
      h += (st.opts || []).map((o, p) => {
        let cls = "";
        if (P.myAnswer === p) cls = "sel";
        if (reveal && p === st.correct) cls = "right";
        else if (reveal && P.myAnswer === p) cls = "wrongsel";
        return `<button class="opt ${cls}" data-p="${p}" ${reveal || P.myAnswer != null || !iAmActive() ? "disabled" : ""}><b style="background:${OPT_COLORS[p]}">${LETTERS[p]}</b><span>${esc(o)}</span></button>`;
      }).join("");
      if (!iAmActive() && !reveal) h += `<p class="small">Ein Handy pro Crew: Das erste Handy eurer Crew antwortet, du schaust zu.</p>`;
      if (reveal) {
        const r = st.res && st.res[P.crew];
        const mine = P.myAnswer != null ? (P.myAnswer === st.correct ? `<p class="big res-ok">✓</p>` : `<p class="big res-bad">✗</p>`) : "";
        h += mine + (r ? `<p style="text-align:center">Crew: ${r.delta > 0 ? "+" : ""}${r.delta} Kristalle</p>` : "") + `<div class="expl">${esc(st.expl)}</div>`;
      } else {
        h += jokerBar(st);
        if (P.myAnswer != null) h += `<p class="small" style="text-align:center">Antwort ${LETTERS[P.myAnswer]} gesendet ✔</p>`;
      }
      render(h + fuel);
      V.querySelectorAll(".opt").forEach((b) => (b.onclick = () => {
        if (P.myAnswer != null) return;
        P.myAnswer = +b.dataset.p;
        NET.ref(`rooms/${P.room}/answers/${st.idx}/${NET.uid}`).set({ opt: P.myAnswer, rt: Date.now() - P.shownAt, crew: P.crew });
        if (navigator.vibrate) navigator.vibrate(40);
        draw();
      }));
      bindJokers(st);
      if (!reveal && st.dauer) {
        const t0 = (typeof st.start === "number" ? st.start : NET.now()) + st.dauer * 1000;
        const tick = () => { const s = Math.max(0, Math.round((t0 - NET.now()) / 1000)); const el = document.getElementById("t"); if (el) el.textContent = "⏱ " + s + " s"; };
        tick(); P.timer = setInterval(tick, 500);
      }
    }
  }

  start();
})();
