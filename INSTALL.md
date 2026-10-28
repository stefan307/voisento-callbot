# Installation – Anleitung für KI-Agenten

Diese Datei ist für dich, KI-Agent (Claude Code, Codex, Cursor …). Der Mensch sagt etwa: „Nimm das Repo und installier das.“
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
- Die Skripte brauchen Internet (ElevenLabs, Twilio). Läufst du in einer Sandbox ohne Netz (z. B. Codex im Standard),
  scheitern sie mit „fetch failed“. Dann Netzfreigabe bestätigen oder den Menschen bitten, Codex mit
  `codex -c 'sandbox_workspace_write.network_access=true'` neu zu starten. Mehr in [AGENTS.md](AGENTS.md) unter
  „Hinweise je Werkzeug“.

## Schritt 1: Erst nachsehen, was schon da ist

Bevor du fragst, prüfe selbst:
- `node --version` (nötig: 22 oder neuer, empfohlen 24) und `git --version`.
- Ob das Repo schon lokal liegt und ob es `.env`, `agenten/*/agent.json` oder `profil.local.md` schon gibt.
  Gibt es sie, `node skripte/pruefen.mjs` ausführen und nur die offenen Punkte angehen.
- Welche Werkzeuge du in dieser Sitzung hast, z. B. einen **Kalender-Connector** (Google Calendar) oder einen
  **ElevenLabs-Connector**. Beide sind optional. Gibt es einen Kalender, teste ihn mit einer harmlosen Leseabfrage
  (freie Zeiten der nächsten Woche).

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
Frag außerdem, ob auf seiner Nummer **schon ein Bot läuft**, den er in ElevenLabs gebaut hat und der bleiben soll.
Dann nimmst du den **Override-Weg**: Es wird kein Agent angelegt, ausgehende Anrufe laufen über seinen bestehenden
Agenten (siehe [AGENTS.md](AGENTS.md), „Zwei Betriebsarten“). Schritt 6 und 7 sehen dann anders aus, steht jeweils dort.

Und frag, ob sein ElevenLabs-Konto auf einem **Data-Residency-Server** liegt (z. B. EU) und in welcher
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
Soll der dortige Bot bleiben, ist das der Override-Weg: nichts umhängen.

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

**Override-Weg:** Stimme und Übergabe hat sein Agent schon, gefragt wird nur nach dem Vornamen. Dann:
```
node skripte/konfig.mjs --name <Vorname> --agent <agent_id oder Name des bestehenden Agenten>
```
Die Nummer findet das Skript selbst (die am Agenten hängt), sonst mit `--nummer +49…` angeben. Agent und Nummer
bleiben unverändert. Danach `node skripte/pruefen.mjs`:
- Steht dort, dass das Überschreiben von Prompt und erster Nachricht nicht erlaubt ist, schaltet der Mensch das in
  der ElevenLabs-Oberfläche beim Agenten frei (Sicherheit/Overrides). Ohne das bricht jeder ausgehende Anruf ab.
- Fehlen Werkzeuge wie Tastentöne oder Mailbox-Erkennung, ist das nur ein Hinweis. Er entscheidet, ob er sie ergänzt.
- Nennt `pruefen.mjs` Variablen ohne festen Wert und braucht eines seiner Werkzeuge einen echten Wert, trägst du ihn
  mit ihm in `agenten/outbound/agent.json` unter `variablen` ein.

## Schritt 7: Agenten anlegen

```
node skripte/anlegen.mjs inbound
node skripte/anlegen.mjs outbound
node skripte/nummer.mjs zuordnen
```
Danach `node skripte/agent.mjs vergleich inbound` und `vergleich outbound`: beide müssen „gleich“ zeigen.

**Override-Weg:** Schritt entfällt. Die Skripte verweigern hier ohnehin die Arbeit, damit sein Agent unangetastet bleibt.

## Schritt 8: Persönliche Stammdaten

`profil.local.example.md` nach `profil.local.md` kopieren und den Menschen bitten, sie selbst auszufüllen:
Name, Geburtsdatum, Adresse, E-Mail, Telefon. Nur Stammdaten. Krankenkasse, Vertragsnummern usw. werden pro Anruf
abgefragt und nie gespeichert (siehe `AGENTS.md`). Die E-Mail ist auch die Kalender-Adresse für Terminaufträge.

## Schritt 9: Kalender

Hast du in Schritt 1 einen Kalender-Connector gefunden und die Leseabfrage hat geklappt, ist nichts zu tun.
Sonst: fragen, ob der Mensch einen Kalender verbinden möchte (in den Connector- bzw. MCP-Einstellungen seines KI-Werkzeugs).
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
   Tipp: Kennt der KI-Agent die IDs von Schlüsseln und Verbindung (`elevenlabs_key_id`, `twilio_key_id`,
   `mail_verbindung_id` in der lokalen Datei, z. B. per Make-Connector nachgesehen), sind sie beim nächsten Import
   schon vorausgewählt.
6. **Bot anbinden** (nicht auf dem Override-Weg, sein Agent bleibt unverändert): `node skripte/make.mjs werkzeug` hängt die Werkzeuge `anliegen_senden` (Mail an `mail_an`) und
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

## Schritt 10b (optional): Anrufer-Kontext für Rückrufe

Ruft jemand zurück, den der Outbound-Bot angerufen hat, weiß der Inbound-Bot sonst nicht, worum es ging. Mit diesem
kleinen Make-Szenario vermerkt `anruf.mjs` jeden Anruf, und der Bot schlägt bei einem Rückruf nach. Funktioniert auch
auf dem Override-Weg, dort bekommt der bestehende Agent nur dieses eine Werkzeug dazu, sonst ändert sich nichts.
Braucht ein Make-Konto (Free reicht, ein aktives Szenario), keinen Mitschneider.

1. `make/kontext.example.json` nach `make/kontext.local.json` kopieren.
2. Der Mensch legt in Make an:
   - einen **Datenspeicher** (Data store), z. B. „Callbot Anrufe“, mit einer neuen Datenstruktur mit den Feldern
     `nummer` (Text), `zeit` (Datum), `titel` (Text), `kurz` (Text), `conversation_id` (Text);
   - einen **Webhook** (Custom webhook), z. B. „callbot_kontext“. Die Adresse kommt als `hook_url` in die lokale Datei.
   Kennst du die IDs (Make-Connector), trag `hook_id` und `datastore_id` ein, dann sind sie beim Import schon gewählt.
3. `node skripte/make.mjs kontext-export` schreibt `make/kontext.import.json`. Er importiert sie als neues Szenario,
   wählt Webhook und Datenspeicher (in beiden Datenspeicher-Modulen), stellt die Zeitplanung auf „sofort“ und schaltet
   es ein.
4. `node skripte/make.mjs werkzeug` legt das Werkzeug `anrufer_kontext` an und hängt es an den Inbound-Agenten.
   Auf dem Override-Weg vorher fragen, denn das ist eine Änderung an seinem laufenden Bot (nur ein Werkzeug mehr).
5. **Prüfen ohne Anruf** (mit Node, nicht aus der Shell): `?step=eintragen` mit `nummer`, `titel`, `kurz`,
   `conversation_id` → Antwort `{"status":"ok"}`; danach `?step=abfragen` mit `anrufer` = dieselbe Nummer → Text mit
   dem Eintrag. Antwortet der Webhook nur „Accepted“, steht die Zeitplanung nicht auf „sofort“.
   Den Testeintrag danach in Make im Datenspeicher löschen.

## Schritt 11: Abschluss und Test

1. `node skripte/pruefen.mjs` zeigt überall `OK`.
2. **Inbound**: Der Mensch ruft die Bot-Nummer an und schildert ein Testanliegen. Danach
   `node skripte/gespraeche.mjs liste --agent inbound --max 1` und das Gespräch mit `zeige` öffnen.
3. **Outbound**: Testauftrag nach dem Muster von `auftraege/BEISPIEL_versicherung.md` an eine **zweite Nummer des
   Menschen**. Die Übergabe geht an die Übergabenummer, deshalb braucht es ein anderes Telefon, z. B. Festnetz.
   Zwei SIMs im selben Gerät blockieren sich. Erst nach „los“ starten, dann mit `warte` aufs Ende warten (oder ohne Hintergrund-Ausführung: nach dem Auflegen
   `zeige`) und auswerten. Auf dem Override-Weg ruft sein bestehender Agent an, mit dem Outbound-Prompt aus dem Repo.
4. Ergebnis zusammenfassen: was läuft, was fehlt.
