# Installation – Anleitung für Claude

Diese Datei ist für dich, Claude. Der Mensch sagt etwa: „Nimm das Repo und installier das.“
Du richtest die beiden Telefonbots in **seinen eigenen Konten** ein (ElevenLabs, Twilio, Kalender) und gehst
die Schritte **der Reihe nach** mit ihm durch. Nach jedem Schritt prüfst du, ob er geklappt hat, und gehst erst dann
weiter. Am Ende muss `node skripte/pruefen.mjs` überall `OK` zeigen.

## Regeln für die Installation

- **Schlüssel und Tokens laufen nie durch den Chat.** Du legst `.env` an, der Mensch trägt die Werte selbst ein.
  Schreibt er dir trotzdem einen Schlüssel in den Chat, sag ihm, dass er ihn nach der Einrichtung neu erzeugen sollte.
- Gib Schlüssel nie aus, auch nicht teilweise. Prüfe sie nur über `pruefen.mjs`.
- Eigene Daten (Name, Nummern, IDs, Profil) gehören nur in die lokalen Dateien `.env`, `agenten/*/agent.json`
  und `profil.local.md`. Diese Dateien werden nie committet.
- Software installierst du nur nach Rückfrage.
- Menüpfade in fremden Oberflächen (ElevenLabs, Twilio, Google) schreibst du nicht aus dem Gedächtnis vor. Sie ändern sich.
  Beschreib, was gesucht wird, und schau bei Bedarf gemeinsam im Browser nach.
- Ein Testanruf geht nach außen und kostet Geld: nur nach ausdrücklichem „los“.
- Frag gebündelt: lieber eine Nachricht mit drei Fragen als drei Nachrichten.

## Schritt 1: Erst nachsehen, was schon da ist

Bevor du fragst, prüfe selbst:
- `node --version` (nötig: 22 oder neuer, empfohlen 24) und `git --version`.
- Ob das Repo schon lokal liegt und ob es `.env`, `agenten/*/agent.json` oder `profil.local.md` schon gibt.
  Gibt es sie, `node skripte/pruefen.mjs` ausführen und nur die offenen Punkte angehen.
- Welche Werkzeuge du in dieser Sitzung hast: einen **Kalender-Connector** (z. B. Google Calendar) und einen
  **ElevenLabs-Connector**. Teste den Kalender mit einer harmlosen Leseabfrage (freie Zeiten der nächsten Woche).

Fasse dem Menschen in wenigen Zeilen zusammen, was vorhanden ist und was fehlt.
Fehlt Node oder Git, frag, ob du es installieren sollst (unter Windows z. B. `winget install OpenJS.NodeJS.LTS`).
Es gibt keine npm-Abhängigkeiten.

## Schritt 2: Konten klären

Der Mensch braucht:
- ein **ElevenLabs-Konto** mit Zugang zu ElevenLabs Agents;
- ein **Twilio-Konto** mit einer Telefonnummer, die Anrufe annehmen und tätigen kann.

Nur für den Mitschneider (Schritt 10, optional) zusätzlich:
- ein **Make-Konto** (Free reicht zum Testen, siehe Schritt 10);
- ein **Postfach, aus dem Make Mails verschicken darf** (SMTP, Gmail oder Microsoft 365). Darüber gehen die
  aufgenommenen Anliegen raus. Er legt es in Make selbst als Verbindung an, weil dafür eine Anmeldung nötig ist;
- eine **Empfänger-Adresse** für diese Mails (meist seine eigene);
- eine **eigene Twilio-Nummer** nur für den Mitschneider.

Frag, ob das schon existiert. Wenn nicht: Er legt es selbst an, du legst keine Konten an.
Frag außerdem, ob sein ElevenLabs-Konto auf einem **Data-Residency-Server** liegt (z. B. EU) und in welcher
**Twilio-Region** die Nummer liegt (Standard US1, sonst z. B. Irland). Weiß er es nicht, findet `pruefen.mjs` es in
Schritt 4 heraus: die Fehlermeldung nennt dann den falschen Server.

## Schritt 3: Schlüssel in `.env`

1. `.env.example` nach `.env` kopieren.
2. Dem Menschen sagen, welche Werte er selbst eintragen muss:
   - **ELEVENLABS_API_KEY**: API-Schlüssel mit diesen Rechten (mehr braucht es nicht):

     | Recht in ElevenLabs | wofür | Skripte |
     |---|---|---|
     | ElevenLabs Agents: lesen | Agenten, Gespräche, Nummern lesen | `gespraeche.mjs`, `agent.mjs vergleich`, `pruefen.mjs`, `konfig.mjs` |
     | ElevenLabs Agents: schreiben | Agenten und Werkzeuge anlegen/ändern, Nummer zuordnen, ausgehende Anrufe | `anlegen.mjs`, `agent.mjs senden`, `nummer.mjs`, `anruf.mjs`, `make.mjs werkzeug` |
     | Voices: lesen | Stimmen auflisten | `konfig.mjs stimmen` (optional, Stimme geht auch per ID) |
     | Speech to Text | Twilio-Mitschnitte transkribieren | `aufnahmen.mjs transkript` (optional, nur mit Mitschneider) |

     Fehlt ein Recht, meldet die API „missing the permission …“; der Schlüssel stimmt dann, nur das Recht fehlt.
   - **ELEVENLABS_API_BASE**: nur bei Data-Residency-Konten, z. B. `https://api.eu.residency.elevenlabs.io`.
   - **TWILIO_ACCOUNT_SID**: Konto-SID, beginnt mit `AC`.
   - **TWILIO_KEY_SID / TWILIO_KEY_SECRET**: ein Twilio-API-Schlüssel (SID beginnt mit `SK`) aus derselben Region wie die Nummer.
   - **TWILIO_API_BASE**: nur außerhalb von US1, z. B. `https://api.dublin.ie1.twilio.com`.
3. Warten, bis er „fertig“ sagt.

## Schritt 4: Schlüssel prüfen

`node skripte/pruefen.mjs`. Die Zeilen für Node, ElevenLabs und Twilio müssen `OK` sein. Typische Fehler:

| Meldung | Bedeutung |
|---|---|
| gehört zu einem anderen Server | `ELEVENLABS_API_BASE` fehlt oder ist falsch (Data-Residency-Konto) |
| ungültig oder gelöscht | Schlüssel falsch kopiert oder widerrufen |
| fehlende Berechtigung / missing permission | Schlüssel stimmt, ein Recht aus Schritt 3 fehlt |
| Twilio lehnt ab | Schlüssel aus einer anderen Region als `TWILIO_API_BASE`, oder Secret falsch |

Die Punkte zu Agenten, Nummer und Profil sind jetzt noch offen, das ist richtig.

## Schritt 5: Nummer in ElevenLabs

Die Twilio-Nummer muss einmalig in ElevenLabs importiert werden. Das macht der Mensch in der ElevenLabs-Oberfläche
bei den Telefonnummern (Anbieter Twilio, passende Region). Die Twilio-Zugangsdaten trägt er dort selbst ein.
Ist die Nummer schon importiert und an einen anderen Agenten gebunden, frag, ob sie für die Bots umgehängt werden darf.

## Schritt 6: Name, Übergabe, Stimme

Frag gebündelt:
- Für wen telefonieren die Bots? Der **Vorname** steht in den Ansagen („digitaler Assistent von …“).
- An welche Nummer sollen die Bots **übergeben**? Meist das eigene Handy.
- Welche **Stimme**? Zeig ihm Vorschläge mit `node skripte/konfig.mjs stimmen` (oder `--suche deutsch`).
  Er kann sich die Stimmen in der ElevenLabs-Oberfläche anhören und auch eine eigene wählen.

Dann:
```
node skripte/konfig.mjs --name <Vorname> --nummer +49… --uebergabe +49… --stimme <voice_id>
```
Das schreibt `agenten/inbound/agent.json` und `agenten/outbound/agent.json` und findet die ID der importierten Nummer.
Den Vornamen setzen die Skripte selbst in die Prompts ein. In den Dateien im Repo musst du nichts ersetzen.

## Schritt 7: Agenten anlegen

```
node skripte/anlegen.mjs inbound
node skripte/anlegen.mjs outbound
node skripte/nummer.mjs zuordnen
```
Danach `node skripte/agent.mjs vergleich inbound` und `vergleich outbound`: beide müssen „gleich“ zeigen.

## Schritt 8: Persönliche Stammdaten

`profil.local.example.md` nach `profil.local.md` kopieren und den Menschen bitten, sie selbst auszufüllen:
Name, Geburtsdatum, Adresse, E-Mail, Telefon. Nur Stammdaten. Krankenkasse, Vertragsnummern usw. werden pro Anruf
abgefragt und nie gespeichert (siehe `CLAUDE.md`). Die E-Mail ist auch die Kalender-Adresse für Terminaufträge.

## Schritt 9: Kalender

Hast du in Schritt 1 einen Kalender-Connector gefunden und die Leseabfrage hat geklappt, ist nichts zu tun.
Sonst: fragen, ob der Mensch einen Kalender verbinden möchte (in den Connector-Einstellungen von Claude).
Ohne Kalender funktioniert alles andere. Den Spielraum für Termine fragst du dann bei jedem Auftrag ab.

## Schritt 10 (optional): Mitschneider über Make

Nur wenn der Mensch eingehende Anrufe über eine eigene Nummer laufen lassen will:
- Anrufer → Inbound-Bot (Hinweis auf die Aufzeichnung, Anliegen aufnehmen, Mail);
- will der Anrufer ihn sprechen → Weiterleitung an sein Handy mit Aufnahme; nicht abgenommen → zurück zum Bot;
- holt er die Nummer selbst per Konferenz dazu → stummer Mitschnitt.

Voraussetzungen siehe Schritt 2 (Make-Konto, Postfach als Mail-Verbindung in Make, Empfänger-Adresse, eigene Nummer).
Eingerichtet wird **über die Make-Oberfläche per Import**. Das geht in jedem Make-Tarif, auch im Free-Plan
(dort 2 aktive Szenarien und 1.000 Credits im Monat, reicht zum Testen und für einige hundert Anrufe).

1. **Werte festlegen:** `make/mitschneider.example.json` nach `make/mitschneider.local.json` kopieren und mit ihm
   ausfüllen: `weiterleiten_an` (sein Handy), `eigene_nummern` (von dort nur mitschneiden), `mail_an`, Ansagetexte.
   Wichtig: Holt er die Nummer per Konferenz dazu, hört die Ansage nur er selbst, nicht sein Gesprächspartner
   (Twilio sieht nur seine Leitung und erkennt das Zusammenführen nicht). Den Hinweis auf die Aufzeichnung gibt er
   seinem Gesprächspartner deshalb selbst, bevor er die Nummer dazuholt. Die Ansage ist nur seine Bestätigung.
2. **Webhook anlegen:** Er legt in Make einen neuen Webhook (Custom webhook) an, z. B. „callbot_mitschneider“, und
   gibt dir die Adresse. Sie kommt als `hook_url` in `make/mitschneider.local.json`. Ist ein Make-Connector verbunden,
   kannst du Adresse und ID (`hook_id`) auch selbst nachsehen; mit ID ist der Webhook nach dem Import schon gewählt.
   Die Adresse wird gebraucht, weil Twilio beim Durchstellen eine volle Adresse verlangt.
3. **Exportieren:** `node skripte/make.mjs export` schreibt `make/mitschneider.import.json`.
4. **Importieren:** Er legt in Make ein neues Szenario an, „Blueprint importieren“, Datei wählen. Dann in den Modulen
   auswählen bzw. dort anlegen:
   - erstes Modul: den Webhook aus Schritt 2 (falls nicht schon gewählt);
   - „Nicht abgenommen“ und „Kunde: Inbound-Bot übernimmt“: ElevenLabs-Schlüssel (API-Key, Header `xi-api-key`);
   - „Bot stellt durch“: Twilio-Schlüssel (Basic Auth: API-Key-SID als Benutzer, Secret als Passwort);
   - „Anliegen per Mail“: seine Mail-Verbindung.
   Speichern, Szenario einschalten.
5. **Zeitplanung prüfen:** Nach einem Import steht sie nicht mehr auf „sofort“ (immediately). Dann landen Anrufe in
   der Warteschlange und Twilio bekommt keine Anweisungen. Auf „sofort“ stellen und speichern.
   Tipp: Kennt Claude die IDs von Schlüsseln und Verbindung (`elevenlabs_key_id`, `twilio_key_id`,
   `mail_verbindung_id` in der lokalen Datei, z. B. per Make-Connector nachgesehen), sind sie beim nächsten Import
   schon vorausgewählt.
6. **Bot anbinden:** `node skripte/make.mjs werkzeug` hängt die Werkzeuge `anliegen_senden` (Mail an `mail_an`) und
   `durchstellen` (über Make, mit Rückweg) an den Inbound-Bot und entfernt dessen eingebaute Weiterleitung.
7. **Prüfen ohne Anruf:** nachgestellte Anfragen an den Webhook schicken, mit Node (aus der Shell gehen Umlaute kaputt):
   `?step=eingang` mit `From` = eigene Nummer → Antwort mit `<Start><Recording>`; mit fremder Nummer → TwiML von
   ElevenLabs; `?step=anliegen` mit einer Test-Meldung → Mail kommt bei `mail_an` an. Antwortet der Webhook nur mit
   „Accepted“, steht die Zeitplanung nicht auf „sofort“ oder ein Filter greift nicht.
8. **Nummer umstellen:** Erst wenn die Nummer feststeht und er zustimmt: `node skripte/make.mjs nummer +49…` zeigt die
   bisherige Einstellung, mit `--ja` wird sie auf das Szenario umgestellt.

Spätere Änderungen (Ansagen, Klingeldauer, Ziel): Werte in der lokalen Datei bzw. Vorlage ändern, `export`, neu
importieren, Zeitplanung prüfen.

**Optional, nur mit Make-API (laut Make ab Tarif „Core“):** Mit `MAKE_API_TOKEN`, `MAKE_API_BASE` und `MAKE_TEAM_ID`
in `.env` (Rechte siehe `.env.example`) kann `node skripte/make.mjs einspielen` Webhook, Schlüssel und Szenario
selbst anlegen bzw. aktualisieren und aktivieren; `make.mjs verbindungen` listet die Mail-Verbindungen mit ID,
`make.mjs holen` den aktuellen Stand. Was in der lokalen Datei schon steht, legt `einspielen` nicht neu an.

## Schritt 11: Abschluss und Test

1. `node skripte/pruefen.mjs` zeigt überall `OK`.
2. **Inbound**: Der Mensch ruft die Bot-Nummer an und schildert ein Testanliegen. Danach
   `node skripte/gespraeche.mjs liste --agent inbound --max 1` und das Gespräch mit `zeige` öffnen.
3. **Outbound**: Testauftrag nach dem Muster von `auftraege/BEISPIEL_versicherung.md` an eine **zweite Nummer des
   Menschen**. Die Übergabe geht an die Übergabenummer, deshalb braucht es ein anderes Telefon, z. B. Festnetz.
   Zwei SIMs im selben Gerät blockieren sich. Erst nach „los“ starten, dann mit `warte` aufs Ende warten und auswerten.
4. Ergebnis zusammenfassen: was läuft, was fehlt.
