// Legt die lokalen Agent-Einstellungen an (agenten/<name>/agent.json, nicht im Repo).
//   node skripte/konfig.mjs --name Stefan --nummer +49… --uebergabe +49… [--in <Agentname>] [--out <Agentname>]
// --nummer     Twilio-Nummer der Bots
// --uebergabe  Handynummer, an die die Bots übergeben
// --in/--out   Namen bestehender Agenten in ElevenLabs; deren IDs werden gesucht und eingetragen.
//              Ohne Angabe bleiben die IDs leer und die Agenten werden mit anlegen.mjs neu erstellt.
// Bestehende agent.json werden nur mit --ueberschreiben ersetzt.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { el, argumente, agentKonfigPfad, ROOT } from '../lib/api.mjs';

const { opt } = argumente();
const e164 = v => /^\+\d{8,15}$/.test(v || '');
if (!opt.name || !e164(opt.nummer) || !e164(opt.uebergabe)) {
  console.log('Aufruf: node skripte/konfig.mjs --name <Vorname> --nummer +49… --uebergabe +49… [--in <Agentname>] [--out <Agentname>]');
  process.exitCode = 1;
} else {
  try {
    const { agents } = await el('/v1/convai/agents?page_size=100');
    const nummern = await el('/v1/convai/phone-numbers');
    const nr = nummern.find(n => n.phone_number === opt.nummer);
    console.log(nr ? `Nummer gefunden: ${nr.phone_number_id}` : 'Nummer noch nicht in ElevenLabs: erst in der ElevenLabs-Oberfläche importieren (Twilio, Region IE1), dann dieses Skript nochmal mit --ueberschreiben');
    for (const [name, agentName] of [['inbound', opt.in], ['outbound', opt.out]]) {
      const pfad = agentKonfigPfad(name);
      if (existsSync(pfad) && !opt.ueberschreiben) { console.log(`${name}: agent.json gibt es schon, unverändert (--ueberschreiben zum Ersetzen)`); continue; }
      const k = JSON.parse(readFileSync(join(ROOT, 'agenten', name, 'agent.example.json'), 'utf8'));
      k.im_auftrag_von = opt.name;
      k.phone_number = opt.nummer;
      k.uebergabe_nummer = opt.uebergabe;
      k.phone_number_id = nr ? nr.phone_number_id : null;
      if (agentName) {
        const a = agents.find(x => x.name === agentName);
        if (!a) throw new Error(`Agent "${agentName}" nicht gefunden`);
        k.name = a.name;
        k.agent_id = a.agent_id;
      } else {
        k.name = `Callbot_${opt.name}_${name === 'inbound' ? 'in' : 'out'}`;
      }
      writeFileSync(pfad, JSON.stringify(k, null, 2) + '\n');
      console.log(`${name}: agent.json geschrieben${k.agent_id ? ` (bestehender Agent ${k.name})` : ' (Agent noch anlegen: node skripte/anlegen.mjs ' + name + ')'}`);
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
