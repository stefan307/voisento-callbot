# voisento-callbot

Inbound- und Outbound-Telefonbot für eine Person, gesteuert durch Claude. Laufzeit: ElevenLabs Agents und Twilio,
jeweils mit eigenem Konto.
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
| `node skripte/konfig.mjs stimmen` / `--name … --nummer +49… --uebergabe +49… --stimme <id>` | Stimme aussuchen, lokale Agent-Einstellungen anlegen |
| `node skripte/pruefen.mjs` | Einrichtung prüfen (Schlüssel, Agenten, Nummer, Profil), ändert nichts |
| `node skripte/nummer.mjs zuordnen` | Twilio-Nummer dem Inbound-Agenten zuordnen |
| `node skripte/make.mjs export\|werkzeug\|nummer +49…` | Mitschneider: Szenario zum Import in Make erzeugen, Bot anbinden, Nummer umstellen (optional mit Make-API: `einspielen`, `holen`, `verbindungen`) |
| `node skripte/anlegen.mjs inbound\|outbound` | Agent einmalig in ElevenLabs anlegen (Werkzeuge, Datenerfassung, Stimme) |

## Stand

Mit echten Anrufen getestet:
- **Outbound:** Aufträge (Versicherung mit Übergabe, Tischreservierung, Arzttermin mit Kalendereintrag),
  Stimmwechsel im Gespräch, zeitgesteuerte Anrufe.
- **Mitschneider (Make) mit Inbound-Bot:** Weiterleitung mit Aufnahme auf zwei Spuren; nicht abgenommen →
  Bot nimmt das Anliegen auf → Mail; Nummer per Konferenz dazuholen → stummer Mitschnitt.

Eigene IDs, Nummern und Schlüssel stehen nur lokal (`.env`, `agenten/*/agent.json`, `make/*.local.json`,
`profil.local.md`).
