# Installation – Anleitung für Claude

Diese Datei ist für dich, Claude. Der Mensch sagt etwa: „Nimm das Repo und installier das.“
Du gehst die Schritte **der Reihe nach** mit ihm durch. Nach jedem Schritt prüfst du, ob er geklappt hat,
und gehst erst dann weiter. Am Ende muss `node skripte/pruefen.mjs` überall `OK` zeigen.

## Regeln für die Installation

- **Schlüssel und Tokens laufen nie durch den Chat.** Du legst `.env` an, der Mensch trägt die Werte selbst ein.
  Schreibt er dir trotzdem einen Schlüssel in den Chat, sag ihm, dass er ihn nach der Einrichtung neu erzeugen sollte.
- Gib Schlüssel nie aus, auch nicht teilweise. Prüfe sie nur über `pruefen.mjs`.
- Software installierst du nur nach Rückfrage.
- Menüpfade in fremden Oberflächen (ElevenLabs, Twilio, Google) schreibst du nicht aus dem Gedächtnis vor. Die ändern sich.
  Beschreib, was gesucht wird. Wenn der Mensch es nicht findet, schau mit ihm gemeinsam im Browser nach.
- Ein Testanruf geht nach außen und kostet Geld: nur nach ausdrücklichem „los“.
- Frag gebündelt: lieber eine Nachricht mit drei Fragen als drei Nachrichten.

## Schritt 0: Welcher Fall liegt vor?

Frag den Menschen:

- **A) Bestehende Agenten weiterverwenden.** Die Bots laufen schon in ElevenLabs und sollen auf diesem Rechner
  weiter gesteuert werden. Dann: Schritte 1 bis 4 (in Schritt 4 die Namen der bestehenden Agenten mitgeben), danach 7 bis 9.
- **B) Neue Einrichtung.** Eigene Bot-Nummer, eigener Name, eigene Übergabenummer, eventuell anderes ElevenLabs- oder
  Twilio-Konto. Dann alle Schritte.

## Schritt 1: Voraussetzungen

- `node --version` muss 22 oder neuer sein, empfohlen ist 24. Sonst nach Rückfrage installieren,
  unter Windows z. B. `winget install OpenJS.NodeJS.LTS`.
- `git --version` muss vorhanden sein.
- Liegt das Repo noch nicht lokal vor: klonen, z. B. `gh repo clone stefan307/voisento-callbot`, und in den Ordner wechseln.
- Es gibt keine npm-Abhängigkeiten. `npm install` ist nicht nötig.

## Schritt 2: Schlüssel in `.env`

1. `.env.example` nach `.env` kopieren. `.env` steht in `.gitignore`.
2. Dem Menschen sagen, welche Werte er eintragen muss und woher sie kommen:
   - **ELEVENLABS_API_KEY**: ein API-Schlüssel aus dem ElevenLabs-Konto. Das Voisento-Konto liegt auf dem
     **EU-Residency-Stack**. Rechte: ElevenLabs Agents lesen und schreiben, Speech to Text.
   - **TWILIO_ACCOUNT_SID**: die Konto-SID, beginnt mit `AC`.
   - **TWILIO_KEY_SID / TWILIO_KEY_SECRET**: ein Twilio-API-Schlüssel (SID beginnt mit `SK`), der **in der Region
     IE1 (Irland)** erstellt wurde. Ein Schlüssel aus US1 wird von IE1 abgelehnt (Fehler 20003).
   - **TWILIO_AUTH_TOKEN_IE1**: nur nötig, wenn in Schritt 5 eine Nummer neu importiert wird.
3. Warten, bis er „fertig“ sagt. Dann weiter mit Schritt 3.

## Schritt 3: Prüfen

`node skripte/pruefen.mjs` ausführen. Die ersten Zeilen (Node, ElevenLabs, Twilio) müssen `OK` sein.
Typische Fehler:

| Meldung | Bedeutung |
|---|---|
| gehört nicht zum EU-Stack | Schlüssel stammt aus einem globalen Konto; `lib/api.mjs` nutzt `api.eu.residency.elevenlabs.io` |
| ungültig oder gelöscht | Schlüssel falsch kopiert oder widerrufen |
| fehlende Berechtigung | Schlüssel stimmt, aber ein Recht fehlt (z. B. Agents schreiben) |
| Twilio lehnt ab | Schlüssel nicht in IE1 erstellt oder Secret falsch |

Fall A: Zeigen auch Agenten und Nummer `OK`, weiter mit Schritt 7.

## Schritt 4: Wer, welche Nummern?

Die eigenen Einstellungen (Name, Nummern, Agent-IDs) liegen nur lokal in `agenten/*/agent.json`, nicht im Repo.
Frag gebündelt:
- Für wen telefoniert der Bot? Der **Vorname** steht in den Ansagen („digitaler Assistent von …“).
- An welche Handynummer soll der Bot **übergeben**?
- Welche **Twilio-Nummer** bekommt der Bot? Sie muss im Twilio-Konto in Region IE1 liegen.
- Fall A: Wie heißen die bestehenden Agenten in ElevenLabs?

Dann:
```
node skripte/konfig.mjs --name <Vorname> --nummer +49… --uebergabe +49… [--in <Inbound-Agent>] [--out <Outbound-Agent>]
```
Mit `--in`/`--out` sucht das Skript die IDs der bestehenden Agenten, ohne bleiben sie leer und werden in Schritt 6 angelegt.

In `CLAUDE.md`, `erfahrungen.md`, `agenten/inbound/prompt.md`, `agenten/inbound/erste-nachricht.txt` und
`skripte/anlegen.mjs` kommt der Vorname „Stefan“ wörtlich vor. Bei einer anderen Person durch deren Vornamen ersetzen.
(Im Inbound-Prompt steht er fest, weil Variablen bei echten eingehenden Anrufen nicht ersetzt werden.)

## Schritt 5: Nummer in ElevenLabs (nur Fall B)

`node skripte/nummer.mjs importieren`
- Ist die Nummer schon in ElevenLabs, wird nur die `phone_number_id` eingetragen.
- Sonst braucht es `TWILIO_AUTH_TOKEN_IE1` in `.env`. Danach setzt ElevenLabs die Voice-URL der Nummer in Twilio selbst.
- Hängt die Nummer schon an einem anderen Agenten, frag nach, bevor du sie umhängst. Dort laufen sonst Anrufe ins Leere.

## Schritt 6: Agenten anlegen (nur Fall B)

```
node skripte/anlegen.mjs inbound
node skripte/anlegen.mjs outbound
node skripte/nummer.mjs zuordnen
```

`anlegen.mjs` nutzt Stimme und Aussprache-Wörterbuch aus dem Voisento-Konto. In einem anderen ElevenLabs-Konto gibt es die
nicht: dann `voice_id` und `pronunciation_dictionary_locators` in `skripte/anlegen.mjs` anpassen. Eine Stimme
sucht ihr gemeinsam aus.

## Schritt 7: Persönliche Stammdaten

`profil.local.example.md` nach `profil.local.md` kopieren und den Menschen bitten, die Datei selbst auszufüllen:
Name, Geburtsdatum, Adresse, E-Mail, Telefon. Nur Stammdaten. Krankenkasse, Vertragsnummern usw. werden pro Anruf
abgefragt und nie gespeichert (siehe `CLAUDE.md`).

## Schritt 8: Google-Kalender

Für den Termin-Ablauf braucht Claude Lesezugriff und Schreibzugriff auf den Kalender, über den Google-Kalender-Connector
in Claude. Prüfen: freie Zeiten der nächsten Woche für die eigene Adresse abfragen (`suggest_time`).
Fehlt der Connector, muss der Mensch ihn in den Claude-Einstellungen unter Connectors verbinden.
Ohne Kalender funktioniert alles andere. Den Spielraum für Termine fragst du dann jeweils ab.

## Schritt 9: Abschluss und Test

1. `node skripte/pruefen.mjs` zeigt überall `OK`.
2. **Inbound**: Der Mensch ruft die Bot-Nummer an und schildert ein Testanliegen. Danach
   `node skripte/gespraeche.mjs liste --agent inbound --max 1` und das Gespräch mit `zeige` öffnen.
3. **Outbound**: Testauftrag nach dem Muster von `auftraege/BEISPIEL_versicherung.md` an eine **zweite Nummer des
   Menschen**. Die Übergabe geht ans Handy, deshalb braucht es ein anderes Telefon, z. B. Festnetz. Zwei SIMs im selben
   Gerät blockieren sich. Erst nach „los“ starten, dann mit `warte` aufs Ende warten und auswerten.
4. Ergebnis zusammenfassen: was läuft, was fehlt. `agent.json`, `.env` und `profil.local.md` bleiben lokal und werden nie committet.
