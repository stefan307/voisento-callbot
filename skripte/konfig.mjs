// Legt die lokalen Agent-Einstellungen an (agenten/<name>/agent.json, nicht im Repo).
//   node skripte/konfig.mjs stimmen [--suche <Text>]
//       → listet Stimmen im ElevenLabs-Konto (zum Aussuchen)
//   node skripte/konfig.mjs --name <Vorname> --nummer +49… --uebergabe +49… --stimme <voice_id>
//       --nummer     Twilio-Nummer der Bots (muss in ElevenLabs importiert sein)
//       --uebergabe  Handynummer, an die die Bots übergeben
//       --stimme     voice_id der Stimme für beide Bots
// Bestehende agent.json werden nur mit --ueberschreiben ersetzt; vorhandene agent_id bleibt dabei erhalten.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { el, argumente, agentKonfigPfad, ROOT } from '../lib/api.mjs';

const { pos, opt } = argumente();
const e164 = v => /^\+\d{8,15}$/.test(v || '');

try {
  if (pos[0] === 'stimmen') {
    const p = new URLSearchParams({ page_size: '50' });
    if (opt.suche) p.set('search', opt.suche);
    const r = await el('/v2/voices?' + p);
    for (const v of r.voices) {
      const l = v.labels || {};
      console.log([v.voice_id, v.name, v.category, l.gender, l.accent || l.language, l.description].filter(Boolean).join(' | '));
    }
    if (!r.voices.length) console.log('Keine Stimmen gefunden.');
  } else if (!opt.name || !e164(opt.nummer) || !e164(opt.uebergabe) || !opt.stimme) {
    console.log('Aufruf: node skripte/konfig.mjs --name <Vorname> --nummer +49… --uebergabe +49… --stimme <voice_id>');
    console.log('        node skripte/konfig.mjs stimmen [--suche <Text>]');
    process.exitCode = 1;
  } else {
    const nummern = await el('/v1/convai/phone-numbers');
    const nr = nummern.find(n => n.phone_number === opt.nummer);
    console.log(nr ? `Nummer gefunden: ${nr.phone_number_id}` : 'Nummer noch nicht in ElevenLabs: erst in der ElevenLabs-Oberfläche importieren (Twilio), dann dieses Skript nochmal mit --ueberschreiben');
    for (const name of ['inbound', 'outbound']) {
      const pfad = agentKonfigPfad(name);
      const alt = existsSync(pfad) ? JSON.parse(readFileSync(pfad, 'utf8')) : null;
      if (alt && !opt.ueberschreiben) { console.log(`${name}: agent.json gibt es schon, unverändert (--ueberschreiben zum Ersetzen)`); continue; }
      const k = JSON.parse(readFileSync(join(ROOT, 'agenten', name, 'agent.example.json'), 'utf8'));
      k.name = alt?.name || `Callbot_${opt.name}_${name === 'inbound' ? 'in' : 'out'}`;
      k.agent_id = alt?.agent_id || null;
      k.im_auftrag_von = opt.name;
      k.phone_number = opt.nummer;
      k.phone_number_id = nr ? nr.phone_number_id : null;
      k.uebergabe_nummer = opt.uebergabe;
      k.voice_id = opt.stimme;
      writeFileSync(pfad, JSON.stringify(k, null, 2) + '\n');
      console.log(`${name}: agent.json geschrieben${k.agent_id ? '' : ` (Agent anlegen: node skripte/anlegen.mjs ${name})`}`);
    }
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
