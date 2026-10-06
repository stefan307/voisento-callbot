# Callbot: Anleitung für Claude

> Soll das Repo erst eingerichtet werden („installier das“)? Dann zuerst [INSTALL.md](INSTALL.md).

Zwei Telefonbots für den Nutzer (Name in `agenten/*/agent.json` → `im_auftrag_von`), Laufzeit ist ElevenLabs mit Twilio.
Dieses Repo ist die einzige Quelle für Prompts und Aufträge. Gesprächsdaten werden **nicht** hier
gespeichert, sondern bei Bedarf live gelesen.

- **Inbound** (`agenten/inbound/`): nimmt Anrufe an, nimmt das Anliegen auf, stellt auf Wunsch zum Nutzer durch.
- **Outbound** (`agenten/outbound/`): ruft mit einem Auftrag an (Termin, Versicherung …), bedient Telefonmenüs, übergibt an den Nutzer.
- **Passive Mitschnitte**: Anrufe, die Twilio direkt zum Nutzer weiterleitet und dabei aufzeichnet. Kein Bot im Gespräch.

## Was der Nutzer typischerweise fragt und wie du es erledigst

### „Was kam heute rein?“ / „Mach mir Todos aus den Anrufen“
1. `node skripte/gespraeche.mjs liste --agent inbound --seit JJJJ-MM-TT`
2. `node skripte/aufnahmen.mjs liste --seit JJJJ-MM-TT` (passive Mitschnitte)
3. Jedes relevante Gespräch öffnen: `gespraeche.mjs zeige <conv_id>` bzw. `aufnahmen.mjs transkript <RE…>`
4. Todos im Chat ausgeben, je Todo: **wer** (Name/Firma + Nummer), **was** zu tun ist, **bis wann**,
   **Quelle** (Datum, Uhrzeit, conversation_id / RE-SID). Unklare Stellen kennzeichnen. Transkripte
   verhören sich bei Namen und Zahlen.
5. Nur wenn der Nutzer es verlangt, Todos woanders ablegen (Aufgabenliste, Ticketsystem …). Standard ist: nur im Chat.

### Vor jedem Auftrag
- `erfahrungen.md` lesen: welche Angaben der Anlass braucht, was bei früheren Anrufen fehlte.
- Stammdaten aus `profil.local.md` übernehmen (nur lokal, nie committen), aber nur die Felder, die der Anlass braucht.
  Fehlt die Datei oder ein nötiges Feld, frag den Nutzer einmal und trag es dort ein.
- In `profil.local.md` stehen nur Stammdaten: Name, Geburtsdatum, Adresse, E-Mail, Telefon.
  **Alles andere** (Krankenkasse, Vertrags- und Versicherungsnummern, Kennzeichen, Gesundheitsangaben …) fragst du
  vor dem Anruf beim Nutzer ab, und zwar in **einer** gebündelten Rückfrage. Das wird nirgends gespeichert, auch nicht in
  `profil.local.md` oder `erfahrungen.md`. Diese Rückfrage hat Vorrang vor „ohne Rückfrage abarbeiten“ beim Termin-Ablauf.
- Nach dem Anruf: Hat etwas gefehlt oder ist etwas schiefgelaufen, einen Eintrag in `erfahrungen.md` ergänzen.

### „Ruf bei … an und …“
1. Auftrag als `auftraege/JJJJ-MM-TT_<kurzname>.md` nach dem Muster von `BEISPIEL_versicherung.md` anlegen.
   - `nummer` im Format `+49…`. Nie raten, bei Zweifel nachfragen.
   - Unter „Diese Angaben darfst du herausgeben“ **nur** Daten, die der Nutzer ausdrücklich genannt hat.
   - Festlegen, ab wann der Nutzer übernimmt (`uebergabe: ja`), und was passieren soll, wenn die Übergabe scheitert.
   - Als **Ziel + Spielraum** schreiben, nicht als Ablaufskript („Wunsch: morgen 10 Uhr. Okay ist alles zwischen 9:30 und 11.“).
     Wenn-dann-Regeln liest der Bot sonst fast wörtlich vor und klingt steif.
   - Annahmen, die der Nutzer nicht genannt hat (Tag, Name, Rückrufnummer …), vor dem Anruf ausdrücklich zeigen.
2. Vorschau zeigen: `node skripte/anruf.mjs <datei>`
3. **Erst nach ausdrücklichem Ja des Nutzers** im Chat: `node skripte/anruf.mjs <datei> --ja`.
   Ein Ja gilt für genau diesen einen Anruf.
4. Ergebnis später mit `gespraeche.mjs zeige <conversation_id>` (steht dann im Kopf der Auftragsdatei)
   lesen und dem Nutzer berichten. Status im Kopf auf `erledigt` oder `offen` setzen.

### „Ich brauch einen Termin bei …“ (Termin mit Kalender)
Ein Auftrag des Nutzers wie „Ich brauch einen Arzttermin wegen X, Nummer Y“ ist zugleich die Freigabe für diesen
einen Anruf. Du arbeitest die Kette ohne Rückfrage ab und meldest dich erst mit dem Ergebnis.
Rückfragen nur, wenn Nummer oder Anlass fehlen oder Daten herausgegeben werden müssten, die der Nutzer nicht genannt hat.

1. **Kalender lesen** (Google-Kalender-Connector, `suggest_time` für die Kalender-Adresse des Nutzers (E-Mail aus `profil.local.md`), Zeitzone Europe/Berlin):
   nächste 10 Werktage ab morgen, 8 bis 18 Uhr. Gesucht sind Lücken, die für den Termin plus 30 Minuten Puffer
   vor und nach dem Termin reichen. Standard ist 60 Minuten Termin, also 2 Stunden Lücke.
   Hat der Nutzer etwas vorgegeben („nur vormittags“, „nicht nächste Woche“), gilt das.
2. **Auftrag schreiben** mit dem Spielraum als kurze Liste in Alltagssprache,
   z. B. „Mi 7.10. 8:30–12, Do 8.10. ganztags bis 16 Uhr“. Gib dem Bot 5 bis 8 Fenster, nicht mehr.
   Diese Fenster sind die Anfangszeiten, zu denen der Termin beginnen darf, also schon ohne Puffer und ohne Termindauer.
3. **Anruf starten**: `node skripte/anruf.mjs <datei> --ja`.
4. **Warten** bis zum Ende: `node skripte/gespraeche.mjs warte <conversation_id>`, im Hintergrund laufen lassen.
5. **Protokoll lesen**: `gespraeche.mjs zeige <conversation_id>`. Maßgeblich ist das Transkript, die erfasste
   Zeile `termin` ist nur eine Hilfe. Datum aus dem Gesprächsdatum nachrechnen.
6. **Eintragen**, nur wenn eindeutig vereinbart und im Spielraum: Kalendereintrag mit Titel
   „<Anlass> – <Praxis/Firma>“, Ort, falls genannt, und in der Beschreibung Telefonnummer, Mitbringen-Hinweise und die
   conversation_id. Keine Teilnehmer, keine Einladungsmails.
7. **Rückmeldung an den Nutzer** in wenigen Zeilen: Termin (Wochentag, Datum, Uhrzeit), was mitzubringen ist,
   ob eingetragen, Auffälligkeiten im Gespräch. Kein Termin vereinbart: angebotene Alternativen nennen, nichts eintragen.
8. Status im Kopf der Auftragsdatei auf `erledigt` oder `offen` setzen.

### „Ändere, wie der Bot …“
1. `node skripte/agent.mjs vergleich <inbound|outbound>`. Steht da „unterschiedlich“, wurde in der ElevenLabs-Oberfläche
   geändert: erst `holen`, Diff mit dem Nutzer klären.
2. `prompt.md` / `erste-nachricht.txt` bearbeiten, Diff zeigen.
3. `node skripte/agent.mjs senden <name>` nach Freigabe, dann committen.

## Regeln

- Ein ausgehender Anruf ist nach außen sichtbar und kostet Geld: nie ohne Freigabe für genau diesen Anruf.
- Gesprächsinhalte und Kundennummern nicht in Dateien im Repo schreiben, außer der Nutzer verlangt es.
  Auftragsdateien enthalten Daten, die herausgegeben werden sollen. Vor dem Commit prüfen, ob sie ins Repo gehören.
- Server für ElevenLabs und Twilio stehen in `.env` (`ELEVENLABS_API_BASE`, `TWILIO_API_BASE`), nie fest in den Code schreiben.
- Schlüssel nie ausgeben. Sie kommen aus `.env` oder den Ablagen, die in `lib/api.mjs` stehen.
- Bot-Texte ohne Gedankenstriche schreiben, denn sie werden vorgelesen.
