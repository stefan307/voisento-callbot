# voisento-callbot

Inbound- und Outbound-Telefonbot für Stefan, gesteuert durch Claude. Laufzeit: ElevenLabs Agents (EU) und Twilio (IE1).
Node 24, keine Abhängigkeiten. Anleitung für die KI: [CLAUDE.md](CLAUDE.md).

**Einrichten:** Claude sagen „Nimm das Repo und installier das“, Claude folgt dann [INSTALL.md](INSTALL.md).
Stand prüfen jederzeit mit `node skripte/pruefen.mjs`.

| Befehl | Zweck |
|---|---|
| `node skripte/gespraeche.mjs liste [--agent inbound] [--seit 2026-10-01] [--nummer 0151…]` | Bot-Gespräche aus ElevenLabs |
| `node skripte/gespraeche.mjs zeige <conv_id>` | Transkript, Zusammenfassung, Werkzeugaufrufe |
| `node skripte/aufnahmen.mjs liste` / `transkript <RE…>` | passive Twilio-Mitschnitte, Transkription per scribe_v2 |
| `node skripte/anruf.mjs auftraege/<datei>.md [--ja]` | Outbound-Anruf, ohne `--ja` nur Vorschau |
| `node skripte/agent.mjs vergleich\|holen\|senden <name>` | Prompt Repo ↔ ElevenLabs abgleichen |
| `node skripte/konfig.mjs --name … --nummer +49… --uebergabe +49…` | lokale Agent-Einstellungen anlegen |
| `node skripte/pruefen.mjs` | Einrichtung prüfen (Schlüssel, Agenten, Nummer, Profil), ändert nichts |
| `node skripte/nummer.mjs zuordnen` | Twilio-Nummer dem Inbound-Agenten zuordnen |
| `node skripte/anlegen.mjs inbound\|outbound` | Agent einmalig in ElevenLabs anlegen (Werkzeuge, Datenerfassung, Stimme) |

## Stand und offene Punkte

Läuft und ist mit echten Anrufen getestet: ausgehende Anrufe aus Aufträgen (Versicherung mit Übergabe,
Tischreservierung, Arzttermin mit Kalendereintrag), Stimmwechsel im Gespräch, zeitgesteuerte Anrufe.
Eigene IDs, Nummern und Schlüssel stehen nur lokal (`.env`, `agenten/*/agent.json`, `profil.local.md`).

Offen:
1. Eingehender Bot im Praxistest. Bei echten eingehenden Anrufen keine `{{…}}`-Variablen in Prompt und Begrüßung
   verwenden, siehe `erfahrungen.md`.
2. Stilles Mitschneiden von Handy-Telefonaten (Mitschneide-Nummer per Konferenz zuschalten, Anrufer-Erkennung,
   Weiterleitung mit Aufnahme). `aufnahmen.mjs` für Transkripte steht schon.
3. Echte Telefonmenüs und Warteschleifen testen. Tastentöne laufen bei Twilio im Ton mit, manche Menüs erkennen sie nicht.
4. Anrufe aus Slack auslösen.
5. Live-Kalenderabgleich während des Gesprächs (heute schaut Claude vor dem Anruf in den Kalender).
