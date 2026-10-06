// Prüft die Einrichtung Schritt für Schritt, ohne etwas zu verändern.
//   node skripte/pruefen.mjs
// Jede Zeile beginnt mit OK, FEHLT oder FEHLER, dahinter steht, was zu tun ist.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { el, tw, twZugang, elKey, agentKonfigPfad, ROOT } from '../lib/api.mjs';

let fehler = 0;
const ok = t => console.log('OK     ' + t);
const fehlt = t => { fehler++; console.log('FEHLT  ' + t); };
const kaputt = t => { fehler++; console.log('FEHLER ' + t); };

const major = Number(process.versions.node.split('.')[0]);
major >= 22 ? ok(`Node ${process.versions.node}`) : kaputt(`Node ${process.versions.node}, nötig ist 22 oder neuer (empfohlen 24)`);

// ElevenLabs
let elOk = false;
try {
  elKey();
  await el('/v1/convai/agents?page_size=1');
  ok('ElevenLabs-Schlüssel gilt (EU-Residency, Agenten lesbar)');
  elOk = true;
} catch (e) {
  if (/fehlt/.test(e.message)) fehlt('ELEVENLABS_API_KEY in .env');
  else if (/data residency stack|global server/.test(e.message)) kaputt('ElevenLabs-Schlüssel gehört nicht zum EU-Stack');
  else if (/invalid/i.test(e.message)) kaputt('ElevenLabs-Schlüssel ungültig oder gelöscht');
  else kaputt('ElevenLabs: ' + e.message.slice(0, 200));
}

// Twilio
let twOk = false;
try {
  twZugang();
  await tw('/IncomingPhoneNumbers.json?PageSize=1');
  ok('Twilio-Schlüssel gilt (Region IE1)');
  twOk = true;
} catch (e) {
  if (/fehlt/.test(e.message)) fehlt('TWILIO_KEY_SID / TWILIO_KEY_SECRET in .env');
  else if (/20003|401/.test(e.message)) kaputt('Twilio lehnt ab: Schlüssel falsch oder nicht für Region IE1 erstellt');
  else kaputt('Twilio: ' + e.message.slice(0, 200));
}

// Agenten und Nummer
for (const name of ['inbound', 'outbound']) {
  if (!existsSync(agentKonfigPfad(name))) { fehlt(`agenten/${name}/agent.json: node skripte/konfig.mjs`); continue; }
  const meta = JSON.parse(readFileSync(agentKonfigPfad(name), 'utf8'));
  for (const feld of ['im_auftrag_von', 'uebergabe_nummer', 'phone_number']) {
    if (!meta[feld]) fehlt(`agenten/${name}/agent.json: ${feld}`);
  }
  if (meta.uebergabe_nummer && !/^\+\d{8,15}$/.test(meta.uebergabe_nummer)) kaputt(`agenten/${name}/agent.json: uebergabe_nummer muss +49… sein`);
  if (!elOk) continue;
  if (!meta.agent_id) { fehlt(`Agent ${name} noch nicht angelegt: node skripte/anlegen.mjs ${name}`); continue; }
  try {
    const a = await el('/v1/convai/agents/' + meta.agent_id);
    ok(`Agent ${name}: ${a.name}`);
  } catch {
    kaputt(`Agent ${name} (${meta.agent_id}) gibt es in diesem Konto nicht. agent_id in agent.json auf null setzen und neu anlegen`);
  }
}

const meta = existsSync(agentKonfigPfad('inbound')) ? JSON.parse(readFileSync(agentKonfigPfad('inbound'), 'utf8')) : {};
if (elOk && meta.phone_number) {
  const nummern = await el('/v1/convai/phone-numbers');
  const n = nummern.find(x => x.phone_number === meta.phone_number);
  if (!n) fehlt(`Nummer ${meta.phone_number} ist nicht in ElevenLabs importiert: node skripte/nummer.mjs importieren`);
  else {
    if (n.phone_number_id !== meta.phone_number_id) kaputt(`phone_number_id in agent.json passt nicht, richtig wäre ${n.phone_number_id}`);
    else ok(`Nummer ${meta.phone_number} in ElevenLabs (${n.phone_number_id})`);
    if (n.assigned_agent?.agent_id === meta.agent_id) ok('Nummer ist dem Inbound-Agenten zugeordnet');
    else fehlt(`Nummer ist ${n.assigned_agent ? 'einem anderen Agenten (' + n.assigned_agent.agent_name + ')' : 'keinem Agenten'} zugeordnet: node skripte/nummer.mjs zuordnen`);
  }
}
if (twOk && meta.phone_number) {
  const r = await tw('/IncomingPhoneNumbers.json?PhoneNumber=' + encodeURIComponent(meta.phone_number));
  const n = r.incoming_phone_numbers[0];
  if (!n) kaputt(`Nummer ${meta.phone_number} nicht im Twilio-Konto (IE1). Steht sie in US1? Region in der Twilio-Konsole prüfen`);
  else if (/elevenlabs\.io/.test(n.voice_url || '') && /eu\.residency/.test(n.voice_url)) ok('Twilio leitet Anrufe an ElevenLabs EU');
  else kaputt(`Twilio Voice-URL zeigt auf ${n.voice_url || 'nichts'}, erwartet ElevenLabs EU. Nummer in ElevenLabs neu importieren`);
}

existsSync(join(ROOT, 'profil.local.md')) ? ok('profil.local.md vorhanden') : fehlt('profil.local.md (Vorlage: profil.local.example.md)');

console.log(fehler ? `\n${fehler} Punkt(e) offen.` : '\nAlles eingerichtet.');
process.exitCode = fehler ? 1 : 0;
