// Twilio-Nummer in ElevenLabs bringen und dem Inbound-Agenten zuordnen.
//   node skripte/nummer.mjs importieren   → importiert phone_number aus agenten/inbound/agent.json
//   node skripte/nummer.mjs zuordnen      → eingehende Anrufe gehen an den Inbound-Agenten
// Für den Import braucht es in .env das Auth-Token der Region (TWILIO_AUTH_TOKEN_IE1). Twilio verlangt es,
// damit ElevenLabs die Signaturen eingehender Anrufe prüfen kann. Es wird nur hier gelesen und nie ausgegeben.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { el, twZugang, argumente, agentKonfig, agentKonfigPfad } from '../lib/api.mjs';

const { pos } = argumente();
const befehl = pos[0];
const pfade = ['inbound', 'outbound'].map(agentKonfigPfad);
const inbound = agentKonfig('inbound');

function idEintragen(id) {
  for (const p of pfade) {
    const m = JSON.parse(readFileSync(p, 'utf8'));
    m.phone_number_id = id;
    writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
  }
}

try {
  if (befehl === 'importieren') {
    const vorhanden = (await el('/v1/convai/phone-numbers')).find(n => n.phone_number === inbound.phone_number);
    const { konto } = twZugang();
    const token = process.env.TWILIO_AUTH_TOKEN_IE1;
    if (vorhanden) {
      idEintragen(vorhanden.phone_number_id);
      console.log(`Schon importiert: ${vorhanden.phone_number_id} (in agent.json eingetragen)`);
    } else if (!token) {
      console.error('TWILIO_AUTH_TOKEN_IE1 fehlt in .env');
      process.exitCode = 1;
    } else {
      const r = await el('/v1/convai/phone-numbers', {
        method: 'POST',
        body: {
          provider: 'twilio',
          phone_number: inbound.phone_number,
          label: `Callbot ${inbound.im_auftrag_von}`,
          sid: konto,
          token,
          region_config: { region_id: 'ie1', token, edge_location: 'dublin' },
          enable_sms: false,
        },
      });
      idEintragen(r.phone_number_id);
      console.log(`Importiert: ${r.phone_number_id}`);
    }
  } else if (befehl === 'zuordnen') {
    if (!inbound.agent_id || !inbound.phone_number_id) throw new Error('agent_id oder phone_number_id fehlt in agenten/inbound/agent.json');
    await el('/v1/convai/phone-numbers/' + inbound.phone_number_id, { method: 'PATCH', body: { agent_id: inbound.agent_id } });
    console.log(`${inbound.phone_number} → ${inbound.name}`);
  } else {
    console.log('Aufruf: node skripte/nummer.mjs importieren|zuordnen');
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
