/* Online-Anbindung über Firebase Realtime Database (compat-SDK, lädt nur im Online-Modus) */
const NET = window.NET_OVERRIDE || (() => {
  const V = "10.12.2";
  let db = null, uid = null, offset = 0;

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("Konnte " + src + " nicht laden. Internet?"));
      document.head.appendChild(s);
    });
  }

  function configured() {
    return typeof FIREBASE_CONFIG !== "undefined" && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL;
  }

  async function init() {
    if (db) return uid;
    if (!configured()) throw new Error("Firebase ist noch nicht eingerichtet (js/firebase-config.js).");
    await loadScript(`https://www.gstatic.com/firebasejs/${V}/firebase-app-compat.js`);
    await loadScript(`https://www.gstatic.com/firebasejs/${V}/firebase-auth-compat.js`);
    await loadScript(`https://www.gstatic.com/firebasejs/${V}/firebase-database-compat.js`);
    firebase.initializeApp(FIREBASE_CONFIG);
    const cred = await firebase.auth().signInAnonymously();
    uid = cred.user.uid;
    db = firebase.database();
    db.ref(".info/serverTimeOffset").on("value", (s) => (offset = s.val() || 0));
    return uid;
  }

  const now = () => Date.now() + offset;
  const ref = (p) => db.ref(p);
  const TS = () => firebase.database.ServerValue.TIMESTAMP;

  function code() {
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    return Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
  }

  async function createRoom(settings, crews) {
    for (let i = 0; i < 10; i++) {
      const c = code();
      const snap = await ref("rooms/" + c + "/host").get();
      if (!snap.exists()) {
        await ref("rooms/" + c).set({ host: uid, created: TS(), settings, crews, state: { phase: "lobby" } });
        return c;
      }
    }
    throw new Error("Kein freier Raumcode gefunden.");
  }

  return { init, configured, now, ref, TS, createRoom, get uid() { return uid; } };
})();
