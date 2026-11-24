/* Gravitas · Mission Methodik — Fragenbank
   Sozialwissenschaftliche Methoden HS26 (Katharina Richter, PHSG)
   Alle Fragen sind neu formuliert und keine Prüfungsfragen.
   correct = Index der richtigen Option in opts (wird beim Spiel gemischt).
   Typen: funk (alle), duell (zwei Crews), mission (+3), wette (Einsatz 0–3), finale.
   status: "geprüft" = Termine 5–9; "entwurf" = Termine 10/11, nach der Sitzung anpassen. */

const PLANETEN = [
  { id: "erde", termin: 5, name: "Erde", titel: "Forschungsprozess und Begriffe", bild: "assets/erde.png", status: "geprüft" },
  { id: "mond", termin: 6, name: "Mond", titel: "Design, Stichprobe, Gütekriterien", bild: "assets/mond.png", status: "geprüft" },
  { id: "iss", termin: 7, name: "ISS", titel: "Daten beschreiben und lesen", bild: "assets/iss.png", status: "geprüft" },
  { id: "jupiter", termin: 8, name: "Jupiter", titel: "Forschungsfrage und Hypothese", bild: "assets/jupiter.png", status: "geprüft" },
  { id: "mars", termin: 9, name: "Mars", titel: "Erhebungsinstrument", bild: "assets/mars.png", status: "geprüft" },
  { id: "satellit", termin: 10, name: "Datensatellit", titel: "Daten auswerten in Jamovi", bild: "assets/satellit.png", status: "entwurf" },
  { id: "sonde", termin: 11, name: "Raumsonde", titel: "Wissenschaftskultur", bild: "assets/sonde.png", status: "entwurf" },
];

const FRAGEN = [
  // ---------------- ERDE · Termin 5
  { id: "E1", planet: "erde", typ: "funk",
    q: "Unser Experiment aus Termin 5: Konzentrationstest, dann Bewegungs- oder Mandala-Pause, dann nochmals Test. Was war die abhängige Variable (AV)?",
    opts: ["die Art der Pause", "der Zuwachs im Konzentrationstest", "die Anzahl Teilnehmende", "die Uhrzeit des Tests"], correct: 1,
    expl: "Die AV ist das, was gemessen wird und sich verändern soll: der Zuwachs im Konzentrationstest. Die Art der Pause haben wir festgelegt – sie ist die unabhängige Variable (UV)." },
  { id: "E2", planet: "erde", typ: "funk",
    q: "Welche dieser Variablen ist manifest, also direkt beobachtbar?",
    opts: ["Lesefreude", "Prüfungsangst", "Anzahl Schritte, die eine Smartwatch zählt", "Klassenklima"], correct: 2,
    expl: "Manifeste Variablen lassen sich direkt beobachten oder zählen. Lesefreude, Prüfungsangst und Klassenklima sind latent: Man erschliesst sie über Indikatoren, z. B. mehrere Fragebogen-Items." },
  { id: "E3", planet: "erde", typ: "duell",
    q: "Welches Beispiel ist ein Indikator für das Konstrukt «Hilfsbereitschaft in der Klasse»?",
    opts: ["«Hilfsbereitschaft ist eine soziale Kompetenz.»", "Wie oft ein Kind in der Gruppenarbeit einem anderen etwas erklärt", "die Klasse 2b", "ein Fragebogen"], correct: 1,
    expl: "Ein Indikator ist ein beobachtbares Verhalten oder Signal, das auf das Konstrukt hinweist. Die erste Option ist eine Definition, die Klasse ist die Stichprobe, der Fragebogen das Messinstrument." },
  { id: "E4", planet: "erde", typ: "mission", art: "Sortier-Mission",
    q: "Welche Reihenfolge der Operationalisierung stimmt?",
    opts: ["Konstrukt → Definition → Indikator → Messinstrument → Messwert",
           "Messwert → Indikator → Konstrukt → Definition → Messinstrument",
           "Messinstrument → Konstrukt → Messwert → Definition → Indikator",
           "Definition → Messwert → Konstrukt → Indikator → Messinstrument"], correct: 0,
    expl: "Operationalisieren heisst: vom abstrakten Konstrukt zur messbaren Zahl. Erst klären, was man meint (Definition), dann woran man es erkennt (Indikator), womit man es erfasst (Instrument) – und erst dann gibt es Messwerte." },
  { id: "E5", planet: "erde", typ: "wette",
    q: "Welches Skalenniveau hat die «Platzierung am Sporttag» (1., 2., 3. …)?",
    opts: ["nominal", "ordinal", "intervall", "Verhältnis (ratio)"], correct: 1,
    expl: "Die Plätze haben eine Reihenfolge, aber die Abstände sind unbekannt: Zwischen Platz 1 und 2 können 0.1 oder 10 Sekunden liegen. Das ist eine Ordinalskala." },

  // ---------------- MOND · Termin 6
  { id: "M1", planet: "mond", typ: "funk",
    q: "Eine Lehrerin teilt die Hälfte ihrer Klasse per Los einer neuen Lesemethode zu, die andere Hälfte liest wie bisher. Welches Design ist das?",
    opts: ["experimentell", "quasi-experimentell", "nicht-experimentell", "reine Beschreibung"], correct: 0,
    expl: "Die zufällige Zuteilung (Los) macht es experimentell. Würden ganze Klassen ohne Zufall verglichen, wäre es quasi-experimentell." },
  { id: "M2", planet: "mond", typ: "funk",
    q: "Eine Schule befragt dieselben Lernenden in der 1., 2. und 3. Sek zu ihrer Motivation. Das ist …",
    opts: ["ein Querschnitt", "ein Längsschnitt", "ein Experiment", "eine Einzelfallanalyse"], correct: 1,
    expl: "Dieselben Personen werden mehrmals über längere Zeit befragt: Längsschnitt. Ein Querschnitt misst einmal, zum Beispiel alle drei Stufen gleichzeitig." },
  { id: "M3", planet: "mond", typ: "duell",
    q: "Eine Studie über die Mediennutzung aller Jugendlichen im Kanton befragt nur die Mitglieder des Freifachs Informatik. Was ist das Hauptproblem?",
    opts: ["zu wenige Items", "Die Stichprobe ist nicht repräsentativ.", "Es fehlt eine Hypothese.", "falsches Skalenniveau"], correct: 1,
    expl: "Wer Informatik als Freifach wählt, nutzt Medien wohl anders als der Durchschnitt. Die Ergebnisse lassen sich nicht auf alle Jugendlichen im Kanton verallgemeinern." },
  { id: "M4", planet: "mond", typ: "mission", art: "Sabotage-Check",
    q: "«Meine neue Rechtschreib-App wirkt! Nach sechs Wochen App haben 80 % meiner Klasse im Diktat eine 5 oder besser.» Wo steckt der Fehler im Design?",
    opts: ["Sechs Wochen sind zu lang.", "Es fehlen Vortest und Vergleichsgruppe.", "Ein Diktat misst keine Rechtschreibung.", "Noten sind nominal."], correct: 1,
    expl: "Ohne Vortest weiss man nicht, wie gut die Klasse vorher war, ohne Vergleichsgruppe nicht, ob es ohne App genauso gekommen wäre. Erst der Vergleich macht eine Wirkungsaussage möglich." },
  { id: "M5", planet: "mond", typ: "wette",
    q: "Was erhöht die Reliabilität (Messgenauigkeit) eines Fragebogens zur Lesefreude am ehesten?",
    opts: ["eine einzige, sehr direkte Frage", "mehrere Items zum selben Konstrukt", "eine farbige Gestaltung", "Name auf jeden Bogen schreiben"], correct: 1,
    expl: "Mehrere Items gleichen Zufallsschwankungen einzelner Antworten aus. Deshalb messen gute Skalen ein Konstrukt mit drei bis zehn Items und bilden einen Mittelwert." },

  // ---------------- ISS · Termin 7
  { id: "I1", planet: "iss", typ: "funk",
    q: "Taschengeld pro Woche in einer Gruppe: 5, 5, 6, 7, 8, 10 und 60 Franken. Welcher Wert beschreibt die typische Person am besten?",
    opts: ["Mittelwert (14.40 Fr.)", "Median (7 Fr.)", "Spannweite (55 Fr.)", "Maximum (60 Fr.)"], correct: 1,
    expl: "Der Ausreisser von 60 Fr. zieht den Mittelwert nach oben – sechs von sieben Personen haben weniger. Der Median (mittlerer Wert der sortierten Reihe) bleibt robust." },
  { id: "I2", planet: "iss", typ: "funk",
    q: "Zwei Klassen haben im selben Test beide den Mittelwert 4.5. Klasse A: SD = 0.3, Klasse B: SD = 1.2. Was stimmt?",
    opts: ["Klasse B ist besser.", "In Klasse B liegen die Noten weiter auseinander.", "Klasse A hat mehr Ausreisser.", "Beide Klassen sind gleich verteilt."], correct: 1,
    expl: "Die Standardabweichung (SD) misst die Streuung um den Mittelwert. Bei gleichem Mittelwert sind die Noten in Klasse B viel unterschiedlicher, in A liegen fast alle nahe bei 4.5." },
  { id: "I3", planet: "iss", typ: "mission", art: "Schätz-Mission", visual: { kind: "scatter", r: -0.42, n: 40, xlab: "Bildschirmzeit am Abend", ylab: "Schlafdauer" },
    q: "Wie gross ist die Korrelation r in diesem Streudiagramm ungefähr?",
    opts: ["r ≈ −.80", "r ≈ −.40", "r ≈ 0", "r ≈ +.40"], correct: 1,
    expl: "Die Punkte fallen von links oben nach rechts unten (negativ), streuen aber stark: ein mittlerer negativer Zusammenhang. Bei r ≈ −.80 lägen sie eng an einer Linie, bei r ≈ 0 wäre kein Muster erkennbar." },
  { id: "I4", planet: "iss", typ: "duell", visual: { kind: "bars", labels: ["Schule A", "Schule B"], values: [96, 98], ymin: 95, ymax: 99, ylab: "Zufriedenheit in %" },
    q: "Das Diagramm soll zeigen: «Schule B ist viel zufriedener!» Welcher Trick steckt dahinter?",
    opts: ["Die Achse beginnt nicht bei 0.", "Es fehlt eine Legende.", "Die Farben sind irreführend.", "Es sind zu wenige Balken."], correct: 0,
    expl: "Die y-Achse beginnt bei 95 %. So wirkt ein Unterschied von 2 Prozentpunkten riesig. Mit einer Achse ab 0 wären die Balken fast gleich hoch." },
  { id: "I5", planet: "iss", typ: "wette",
    q: "Eine Studie mit 20 000 Lernenden findet: Wer regelmässig frühstückt, hat minimal bessere Noten, r = .05, p < .001. Was stimmt?",
    opts: ["Es ist ein starker Zusammenhang.", "Der Zusammenhang ist signifikant, aber praktisch kaum bedeutsam.", "Das Ergebnis ist Zufall.", "Frühstück verbessert die Noten."], correct: 1,
    expl: "Bei riesigen Stichproben werden schon winzige Zusammenhänge signifikant. r = .05 ist praktisch bedeutungslos. Und: Ein Zusammenhang belegt keine Wirkung." },

  // ---------------- JUPITER · Termin 8 (SOL)
  { id: "J1", planet: "jupiter", typ: "funk",
    q: "Welche Forschungsfrage ist am besten formuliert?",
    opts: ["Ist Gamen schlecht?", "Warum gamen Jungen zu viel?", "Wie viele Minuten gamen Lernende der 1. Sek in St. Gallen an einem Schultag?", "Sollte man Gamen verbieten?"], correct: 2,
    expl: "Gut: präzise (Minuten), mit Zielgruppe und Kontext, empirisch beantwortbar. «Ist … schlecht?» ist unpräzise, «Warum … zu viel?» unterstellt ein Ergebnis, «Sollte man …?» ist eine Wertfrage." },
  { id: "J2", planet: "jupiter", typ: "funk",
    q: "«Setzt sich Schulfreude aus mehreren unterscheidbaren Teilen zusammen?» Welcher Fragetyp ist das?",
    opts: ["Existenz", "Kovariation", "Struktur", "Ursache"], correct: 2,
    expl: "Strukturfragen fragen, wie etwas aufgebaut ist. Kovariation fragt nach Zusammenhängen, Ursache nach Wirkungen, Existenz danach, ob es etwas überhaupt gibt (Fragetypen nach Rost)." },
  { id: "J3", planet: "jupiter", typ: "duell",
    q: "H1: «Je mehr Lernende Sport treiben, desto besser schlafen sie.» Welche H0 passt?",
    opts: ["Je mehr Sport, desto schlechter der Schlaf.", "Sport und Schlafqualität hängen nicht zusammen.", "Wer Sport treibt, schläft gut.", "Sport verursacht guten Schlaf."], correct: 1,
    expl: "Die Nullhypothese sagt: kein Zusammenhang bzw. kein Unterschied. Geprüft wird H0 – passt sie sehr schlecht zu den Daten, wird sie verworfen." },
  { id: "J4", planet: "jupiter", typ: "mission", art: "Sabotage-Check",
    q: "Eine dieser Aussagen ist keine wissenschaftliche Hypothese. Welche?",
    opts: ["Lernende mit und ohne Tablet unterscheiden sich in ihrem Wortschatz.", "Je mehr Feedback Lernende erhalten, desto höher ist ihre Motivation.", "Mia aus der 1c liest lieber Comics als Romane.", "Lernende mit Hausaufgabenhilfe erreichen bessere Mathematiknoten als Lernende ohne."], correct: 2,
    expl: "Eine wissenschaftliche Hypothese gilt allgemein, über den Einzelfall hinaus, und ist widerlegbar. Eine Aussage über Mia ist ein Einzelfall." },
  { id: "J5", planet: "jupiter", typ: "wette",
    q: "«Unterscheiden sich Lernende mit und ohne Lerncoaching in ihrer Selbstwirksamkeit?» Was ist die unabhängige Variable?",
    opts: ["Selbstwirksamkeit", "Lerncoaching (ja/nein)", "die Lernenden", "der Unterschied"], correct: 1,
    expl: "Die UV ist der Einflussfaktor, nach dem die Gruppen gebildet werden: Lerncoaching ja/nein. Die Selbstwirksamkeit wird gemessen und ist die AV." },

  // ---------------- MARS · Termin 9
  { id: "R1", planet: "mars", typ: "funk",
    q: "Welches Item ist am besten formuliert?",
    opts: ["«Ich mache meine Hausaufgaben immer sorgfältig und pünktlich.»", "«Ich mache meine Hausaufgaben sorgfältig.»", "«Findest du nicht auch, dass Hausaufgaben wichtig sind?»", "«Hausaufgaben sind nicht unnötig.»"], correct: 1,
    expl: "Ein Item, ein Inhalt, keine Extremwörter wie «immer», nicht suggestiv, keine doppelte Verneinung. Die erste Option fragt zwei Dinge auf einmal (sorgfältig und pünktlich)." },
  { id: "R2", planet: "mars", typ: "funk",
    q: "Du willst die Zeit, die Lernende am Samstag draussen verbringen, mit ihrer Schlafdauer korrelieren. Welches Antwortformat eignet sich am besten?",
    opts: ["«Wie viele Minuten warst du am Samstag draussen?» ___ Minuten", "wenig / mittel / viel", "ja / nein", "«Erzähl, was du am Samstag gemacht hast.»"], correct: 0,
    expl: "Für eine Korrelation brauchst du möglichst metrische Daten. Minuten sind verhältnisskaliert. «wenig/mittel/viel» ist nur ordinal und ungenau, ja/nein nominal, die offene Frage müsste erst kodiert werden." },
  { id: "R3", planet: "mars", typ: "duell",
    q: "Wozu dient ein Pretest (Pilotierung) eines Fragebogens?",
    opts: ["die Hypothese zu bestätigen", "Unklarheiten in Items und Instruktion zu finden", "die Stichprobe zu vergrössern", "die Daten auszuwerten"], correct: 1,
    expl: "Im Pretest füllen Personen aus der Zielgruppe den Fragebogen probeweise aus. So zeigt sich, was missverstanden wird, bevor die eigentliche Erhebung startet." },
  { id: "R4", planet: "mars", typ: "mission", art: "Sabotage-Check",
    q: "Item: «Ich lese selten.» Antworten: trifft gar nicht zu – trifft eher nicht zu – trifft eher zu – trifft völlig zu. Was ist das Problem?",
    opts: ["Es gibt zu viele Stufen.", "«selten» und Zustimmungsskala vermischen sich und verwirren.", "Es fehlt eine neutrale Mitte.", "Die Skala ist nominal."], correct: 1,
    expl: "«Trifft völlig zu, dass ich selten lese» ist schwer zu deuten. Besser direkt nach der Häufigkeit fragen: «Wie oft liest du?» nie – selten – manchmal – oft." },
  { id: "R5", planet: "mars", typ: "wette",
    q: "Man weiss noch wenig darüber, wie Lehrpersonen den Einsatz von KI im Unterricht erleben. Welche Methode passt für einen ersten Zugang am besten?",
    opts: ["standardisierter Fragebogen", "halbstrukturiertes Interview", "Leistungstest", "Experiment mit Zufallszuteilung"], correct: 1,
    expl: "Wenn man ein Feld erst erkunden will, eignen sich offene Zugänge: Im Interview kann man nachfragen und auf Unerwartetes eingehen. Ein Fragebogen setzt voraus, dass man die Antwortmöglichkeiten schon kennt." },

  // ---------------- DATENSATELLIT · Termin 10 (Entwurf)
  { id: "S1", planet: "satellit", typ: "funk",
    q: "In der Spalte «Schlafdauer in Stunden» stehen: 7.5 · 8 · «sieben» · 0 · 6.5 · 25. Welche Einträge musst du vor der Auswertung prüfen?",
    opts: ["nur «sieben»", "«sieben», 0 und 25", "nur 25", "keine"], correct: 1,
    expl: "«sieben» ist Text statt Zahl, 0 und 25 Stunden sind unplausibel. Solche Werte korrigiert man nach festen Regeln oder setzt sie auf fehlend – und dokumentiert das." },
  { id: "S2", planet: "satellit", typ: "funk",
    q: "Was gilt für einen «tidy» Datensatz?",
    opts: ["Jede Zeile ist eine Beobachtung, jede Spalte eine Variable.", "Jede Zeile ist eine Variable.", "Gruppen werden mit Farben markiert.", "Eine Zelle kann mehrere Werte enthalten."], correct: 0,
    expl: "Tidy: eine Beobachtung pro Zeile, eine Variable pro Spalte, ein Wert pro Zelle. So kann Jamovi die Daten direkt lesen – Farben und Sammelzellen versteht ein Programm nicht." },
  { id: "S3", planet: "satellit", typ: "duell",
    q: "Pro Person gibt es eine Zeile mit den Spalten «Test_A» und «Test_B». Welches Format ist das?",
    opts: ["Wide-Format", "Long-Format", "kein gültiges Format", "Häufigkeitstabelle"], correct: 0,
    expl: "Wide: Wiederholte Messungen stehen nebeneinander in Spalten. Im Long-Format hätte jede Person zwei Zeilen, eine pro Messzeitpunkt." },
  { id: "S4", planet: "satellit", typ: "mission", art: "Jamovi-Mission",
    q: "Unterscheiden sich Bewegungs- und Mandala-Gruppe im Konzentrationszuwachs? Welches Verfahren wählst du in Jamovi?",
    opts: ["Korrelation", "t-Test für unabhängige Stichproben", "t-Test für abhängige (gepaarte) Stichproben", "Häufigkeitstabelle"], correct: 1,
    expl: "Zwei verschiedene Gruppen von Personen → t-Test für unabhängige Stichproben. Gepaart wäre er, wenn dieselben Personen zweimal gemessen werden (z. B. Test A und Test B)." },
  { id: "S5", planet: "satellit", typ: "wette",
    q: "Welcher Ergebnissatz ist korrekt berichtet?",
    opts: ["«Die Bewegungspause wirkt nicht.»", "«Die Gruppen unterschieden sich nicht signifikant, t(12) = −0.48, p = .64, d = 0.26.»", "«p = .64, also ist H0 bewiesen.»", "«Mandala ist 1.6 Punkte besser, das ist signifikant.»"], correct: 1,
    expl: "Ein guter Ergebnissatz nennt Befund, Prüfgrösse, p und Effektstärke – ohne mehr zu behaupten, als die Daten hergeben. Ein nicht signifikantes Ergebnis beweist H0 nicht." },

  // ---------------- RAUMSONDE · Termin 11 (Entwurf)
  { id: "W1", planet: "sonde", typ: "funk",
    q: "Was bedeutet Publikationsbias?",
    opts: ["Studien mit signifikanten Ergebnissen werden eher veröffentlicht.", "Zeitschriften veröffentlichen nur auf Englisch.", "Forschende zitieren vor allem sich selbst.", "Peer Review dauert sehr lange."], correct: 0,
    expl: "Wenn vor allem «erfolgreiche» Studien erscheinen, überschätzt die Literatur Effekte. Studien ohne Befund verschwinden in der Schublade." },
  { id: "W2", planet: "sonde", typ: "funk",
    q: "Schlagzeile: «Kaffee macht klüger!» Die Studie fand bei 30 Studierenden r = .20. Was ist das Problem?",
    opts: ["Dramatisierung: kleine Stichprobe, schwacher Zusammenhang, kausal formuliert", "Kaffee wurde nicht gemessen.", "r = .20 ist ein sehr starker Zusammenhang.", "Die Stichprobe ist zu gross."], correct: 0,
    expl: "Die Schlagzeile macht aus einem schwachen Zusammenhang in einer kleinen Stichprobe eine Wirkung. Seriöse Kommunikation nennt Unsicherheiten offen." },
  { id: "W3", planet: "sonde", typ: "duell",
    q: "Was passiert beim Peer Review?",
    opts: ["Fachleute begutachten ein Manuskript vor der Veröffentlichung.", "Studierende bewerten ihre Dozierenden.", "Die Rohdaten werden gelöscht.", "Die Leserschaft stimmt über die Annahme ab."], correct: 0,
    expl: "Unabhängige Fachleute prüfen Methode, Auswertung und Schlussfolgerungen und empfehlen Annahme, Überarbeitung oder Ablehnung. Fehlerfrei macht das eine Studie aber nicht." },
  { id: "W4", planet: "sonde", typ: "mission", art: "Sabotage-Check",
    q: "Welche Massnahme schützt die Daten von Lernenden am besten?",
    opts: ["Namen auf den Fragebogen schreiben lassen", "Code statt Name, Daten getrennt und geschützt speichern", "Rohdaten im Klassenchat teilen", "Fotos der Bögen per Mail verschicken"], correct: 1,
    expl: "Pseudonymisieren (Code statt Name) und die Zuordnungsliste getrennt, geschützt aufbewahren. Dazu gehören Information und Einverständnis – bei Minderjährigen auch der Eltern." },
  { id: "W5", planet: "sonde", typ: "wette",
    q: "Eine Forscherin entfernt nachträglich so lange «störende» Fälle, bis p < .05 wird. Wie nennt man das?",
    opts: ["Datenbereinigung", "p-Hacking", "Replikation", "Peer Review"], correct: 1,
    expl: "p-Hacking verfälscht Ergebnisse. Fälle darf man nur nach vorher festgelegten, offengelegten Regeln ausschliessen – nicht je nachdem, was herauskommt." },

  // ---------------- FINALE
  { id: "F1", planet: "finale", typ: "finale",
    q: "Ein Team untersucht: «Wie hängen Bildschirmzeit und Schlafdauer zusammen?» Ergebnis: r = −.45. Welche Aussage dürfen sie machen?",
    opts: ["«Bildschirmzeit verkürzt den Schlaf.»", "«Wer mehr Bildschirmzeit hat, schläft im Schnitt kürzer.»", "«Es gibt keinen Zusammenhang.»", "«Wenig Schlaf verursacht mehr Bildschirmzeit.»"], correct: 1,
    expl: "Eine Korrelation beschreibt einen Zusammenhang, keine Wirkung. Die Richtung könnte auch umgekehrt sein, oder eine Drittvariable wirkt. Kausal prüfen kann nur ein Experiment." },
];

const TYPEN = {
  funk: { name: "Funkspruch", info: "Alle Crews antworten. Richtig: +2 Kristalle", zeit: 30, icon: "📡" },
  duell: { name: "Asteroiden-Duell", info: "Zwei Crews treten an. Richtig, wenn der Gegner falsch liegt: +2 und 1 Kristall abschiessen. Beide richtig: je +1. Beide falsch: Zuschauer-Crews mit richtiger Antwort +1", zeit: 25, icon: "☄️" },
  mission: { name: "Spezialmission", info: "Alle Crews antworten. Richtig: +3 Kristalle", zeit: 45, icon: "🛰️" },
  wette: { name: "Treibstoff-Wette", info: "Erst Einsatz wählen (0–3), dann kommt die Frage. Richtig: Einsatz dazu, falsch: Einsatz weg", zeit: 30, icon: "🎲" },
  finale: { name: "Finale: Landung", info: "Setzt beliebig viele Kristalle. Richtig: Einsatz dazu, falsch: Einsatz weg", zeit: 40, icon: "🏁" },
};

const EREIGNISSE = [
  { id: "sturm", name: "Sonnensturm!", text: "Die nächste Runde zählt doppelt.", bild: "assets/explosion.png" },
  { id: "schwerelos", name: "Schwerelosigkeit!", text: "Die Crew auf dem letzten Platz bekommt +2 Kristalle Rückenwind.", bild: "assets/astronaut.png" },
];


/* ===== Training & Bestenliste =====
   Crews, die in der Bestenliste antreten (genau so schreiben wie im Seminar). */
const TRAINING_CREWS = ["Gruppe 1", "Gruppe 2", "Gruppe 3", "Gruppe 4", "Gruppe 5"];
/* Forschungsmodus im Training: erst auf true setzen, wenn die Studieninformation geklärt ist. */
const TRAINING_RESEARCH = false;

if (typeof module !== "undefined") module.exports = { PLANETEN, FRAGEN, TYPEN, EREIGNISSE, TRAINING_CREWS };
