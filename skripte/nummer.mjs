// Twilio-Nummer dem Inbound-Agenten zuordnen.
//   node skripte/nummer.mjs zuordnen   → eingehende Anrufe gehen an den Inbound-Agenten
// Neue Nummern werden einmalig in der ElevenLabs-Oberfläche importiert (Twilio);
// die phone_number_id trägt danach skripte/konfig.mjs ein.
import { el, argumente, agentKonfig } from '../lib/api.mjs';

const { pos } = argumente();
const inbound = agentKonfig('inbound');

try {
  if (pos[0] === 'zuordnen') {
    if (!inbound.agent_id || !inbound.phone_number_id) throw new Error('agent_id oder phone_number_id fehlt in agenten/inbound/agent.json');
    await el('/v1/convai/phone-numbers/' + inbound.phone_number_id, { method: 'PATCH', body: { agent_id: inbound.agent_id } });
    console.log(`${inbound.phone_number} → ${inbound.name}`);
  } else {
    console.log('Aufruf: node skripte/nummer.mjs zuordnen');
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
