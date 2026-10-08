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

Frag, ob beides schon existiert. Wenn nicht: Er legt es selbst an, du legst keine Konten an.
Frag außerdem, ob sein ElevenLabs-Konto auf einem **Data-Residency-Server** liegt (z. B. EU) und in welcher
**Twilio-Region** die Nummer liegt (Standard US1, sonst z. B. Irland). Weiß er es nicht, findet `pruefen.mjs` es in
Schritt 4 heraus: die Fehlermeldung nennt dann den falschen Server.

## Schritt 3: Schlüssel in `.env`

1. `.env.example` nach `.env` kopieren.
2. Dem Menschen sagen, welche Werte er selbst eintragen muss:
   - **ELEVENLABS_API_KEY**: API-Schlüssel mit den Rechten *ElevenLabs Agents* (lesen und schreiben), *Voices* (lesen)
     und *Speech to Text*.
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

Nur wenn der Mensch eingehende Anrufe mitschneiden will: Ansage, Weiterleitung an sein Handy mit Aufnahme,
Rückfall auf den Inbound-Bot, wenn er nicht rangeht, und stummes Mitschneiden, wenn er die Nummer per Konferenz dazuholt.
Er braucht dafür **ein eigenes Make-Konto** und **eine eigene Twilio-Nummer**, die nur dafür da ist.

1. `make/mitschneider.example.json` nach `make/mitschneider.local.json` kopieren. Mit ihm ausfüllen: an welche Nummer
   weitergeleitet wird, welche Nummern als „eigene“ gelten (von dort nur mitschneiden), Ansagetexte.
2. **Frag nach seinem Make-Tarif.** Die Make-API gibt es laut Make erst ab „Core“; im Free-Plan außerdem nur
   2 aktive Szenarien und 1.000 Credits im Monat (reicht zum Testen und für einige hundert Anrufe).
   Ist ein Make-Connector in dieser Sitzung verbunden, kannst du Zone und Team-ID damit nachsehen.
3. **Mit Make-API (Core oder höher):**
   - Er legt in Make einen API-Token an (Rechte siehe `.env.example`) und trägt `MAKE_API_TOKEN`, `MAKE_API_BASE` und
     `MAKE_TEAM_ID` selbst in `.env` ein.
   - `node skripte/make.mjs vorschau`, dann `node skripte/make.mjs einspielen`. Das legt Webhook, Schlüssel und Szenario
     in seinem Make an und schaltet es aktiv.
4. **Ohne Make-API (Free-Plan):**
   - Er legt in Make per Hand einen Webhook an (Custom webhook) und gibt dir dessen Adresse; die Webhook-ID steht in
     der Webhook-Übersicht. Beides kommt als `hook_url` und `hook_id` in `make/mitschneider.local.json`.
   - `node skripte/make.mjs export` schreibt `make/mitschneider.import.json`.
   - Er importiert die Datei in Make („Blueprint importieren“), wählt im Modul „Nicht abgenommen“ den ElevenLabs-Schlüssel
     aus bzw. legt ihn dort an (API-Key, Header `xi-api-key`), speichert und schaltet das Szenario ein.
   - Spätere Änderungen laufen genauso: `export`, neu importieren.
5. Erst wenn die Nummer feststeht und er zustimmt: `node skripte/make.mjs nummer +49…` zeigt die bisherige Einstellung,
   mit `--ja` wird die Nummer auf das Szenario umgestellt.

## Schritt 11: Abschluss und Test

1. `node skripte/pruefen.mjs` zeigt überall `OK`.
2. **Inbound**: Der Mensch ruft die Bot-Nummer an und schildert ein Testanliegen. Danach
   `node skripte/gespraeche.mjs liste --agent inbound --max 1` und das Gespräch mit `zeige` öffnen.
3. **Outbound**: Testauftrag nach dem Muster von `auftraege/BEISPIEL_versicherung.md` an eine **zweite Nummer des
   Menschen**. Die Übergabe geht an die Übergabenummer, deshalb braucht es ein anderes Telefon, z. B. Festnetz.
   Zwei SIMs im selben Gerät blockieren sich. Erst nach „los“ starten, dann mit `warte` aufs Ende warten und auswerten.
4. Ergebnis zusammenfassen: was läuft, was fehlt.
