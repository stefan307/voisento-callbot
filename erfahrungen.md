# Erfahrungen aus Anrufen

Vor jedem neuen Auftrag lesen. Nach jedem Anruf ergänzen, wenn etwas gefehlt hat oder schiefging.
Je Eintrag: Anlass, was fehlte oder schiefging, was ab jetzt gilt.

## Welche Angaben je Anlass gebraucht werden

| Anlass | Immer mitgeben | Oft gefragt |
|---|---|---|
| Arzt, Praxis | voller Name, Geburtsdatum, Krankenkasse | schon Patient?, Grund, Rückrufnummer |
| Restaurant | Nachname, Personenzahl, Rückrufnummer | Anlass, Kinderstuhl, Allergien |
| Versicherung | voller Name, Vertragsnummer | Adresse, Geburtsdatum, E-Mail, Kennzeichen |

Woher: Name, Geburtsdatum, Adresse, E-Mail und Telefon aus `profil.local.md`. Alles andere (Krankenkasse,
Vertrags- oder Versicherungsnummer, Kennzeichen …) vor dem Anruf beim Nutzer abfragen, nie speichern.
Nur Felder herausgeben, die der Anlass braucht.

## Einträge

- **06.10.2026, Arzttermin (Test):** Bot nannte nur den Vornamen. Bei Praxen immer voller Name und Geburtsdatum,
  sonst kann die Praxis den Patienten nicht finden.
- **06.10.2026, Tischreservierung (Test):** Auftrag als Wenn-dann-Regeln geschrieben, Bot las sie fast wörtlich vor.
  Aufträge als Ziel + Spielraum formulieren.
- **06.10.2026, Kfz-Schaden (Test):** Versicherung fragte nach Adresse, die nicht im Auftrag stand, daraufhin Übergabe.
  Bei Versicherungen Adresse gleich mitgeben, wenn der Nutzer sie freigegeben hat.
- **06.10.2026, Inbound (Test):** Anruf brach nach 0 Sekunden ab: „Missing required dynamic variables in first message“.
  Platzhalter-Standardwerte am Agenten gelten nicht bei echten eingehenden Anrufen, nur ausgehend liefert unser Skript sie mit.
  Im Inbound-Prompt und in der ersten Nachricht keine `{{…}}`-Variablen verwenden, Werte fest eintragen.
- **06.10.2026, Anruf unter Freunden:** Eine Zusatzstimme mit der Beschreibung „Immer wenn X spricht“ hat der Bot im
  ganzen Gespräch benutzt, obwohl der Auftrag sie nicht verlangte. Beschreibung von Zusatzstimmen immer als
  „nicht benutzen, außer der Auftrag verlangt es“ formulieren. Im Prompt steht die Regel jetzt auch.
- **08.10.2026, Make-Szenario Mitschneider:** Filter mit `text:contains` sprangen nie an. Make-Operatoren heißen
  `text:contain` / `text:notcontain` (ohne s); die Blueprint-Prüfung von Make meldet falsche Operatoren nicht.
  Operatoren aus einem laufenden Szenario abschreiben und nach dem Import mit einer nachgestellten Anfrage testen.
- **08.10.2026, Make-Import:** Nach „Blueprint importieren“ stand die Zeitplanung nicht mehr auf „sofort“. Anfragen
  landeten in der Warteschlange, der Webhook antwortete nur „Accepted“ statt mit Anweisungen. Nach jedem Import die
  Zeitplanung prüfen (die API-Variante setzt sie selbst).
