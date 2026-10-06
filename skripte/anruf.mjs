// Outbound-Anruf aus einer Auftragsdatei starten.
//   node skripte/anruf.mjs auftraege/2026-10-06_versicherung.md          → zeigt nur, was passieren würde
//   node skripte/anruf.mjs auftraege/2026-10-06_versicherung.md --ja     → ruft wirklich an
//   … --ja --um 12:59                                                   → wartet bis 12:59 (Ortszeit Berlin, heute), ruft dann an
// Nach dem Start werden conversation_id und Status in den Kopf der Auftragsdatei geschrieben.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { el, argumente, agentKonfig } from '../lib/api.mjs';
import { lesen, kopfSetzen } from '../lib/auftrag.mjs';

const { pos, opt } = argumente();
const datei = pos[0];
if (!datei) { console.log('Aufruf: node skripte/anruf.mjs <auftragsdatei> [--ja]'); process.exit(1); }

const agent = agentKonfig('outbound');
const { kopf, text } = lesen(datei);

const fehlt = ['nummer', 'titel'].filter(k => !kopf[k]);
if (fehlt.length) { console.error(`Im Kopf fehlt: ${fehlt.join(', ')}`); process.exit(1); }
if (!/^\+\d{8,15}$/.test(kopf.nummer)) { console.error(`nummer muss im Format +49… sein, ist "${kopf.nummer}"`); process.exit(1); }
if (kopf.status && kopf.status !== 'offen' && !opt.nochmal) {
  console.error(`Auftrag hat Status "${kopf.status}". Mit --nochmal erneut anrufen.`); process.exit(1);
}

// Die Zielnummer steht fest im transfer_to_number-Werkzeug des Agenten; der Auftrag schaltet sie nur frei.
const uebergabe = kopf.uebergabe === 'ja';
const variablen = {
  auftrag_titel: kopf.titel,
  auftrag: text,
  gegenueber: kopf.gegenueber || 'unbekannt',
  im_auftrag_von: kopf.im_auftrag_von || agent.im_auftrag_von,
  uebergabe_erlaubt: uebergabe ? 'ja' : 'nein',
};

const anfrage = {
  agent_id: agent.agent_id,
  agent_phone_number_id: agent.phone_number_id,
  to_number: kopf.nummer,
  conversation_initiation_client_data: { dynamic_variables: variablen },
  telephony_call_config: { ringing_timeout_secs: Number(kopf.klingeln_s || 40) },
};

console.log(`Anruf an ${kopf.nummer} (${variablen.gegenueber}) – ${kopf.titel}`);
console.log(`Übergabe an ${agent.im_auftrag_von}: ${uebergabe ? 'ja' : 'nein'}`);
console.log(`Auftragstext (${text.length} Zeichen):\n${text}\n`);

if (!opt.ja) { console.log('Nur Vorschau. Mit --ja wird wirklich angerufen.'); process.exit(0); }
if (!agent.agent_id || !agent.phone_number_id) {
  console.error('agenten/outbound/agent.json: agent_id oder phone_number_id fehlt'); process.exit(1);
}

if (opt.um) {
  const m = String(opt.um).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) { console.error('--um erwartet HH:MM'); process.exit(1); }
  // Abstand bis zur Zielzeit über die Berliner Wanduhr rechnen, damit Sommer-/Winterzeit stimmt.
  const jetzt = new Date();
  const berlin = new Date(jetzt.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const ziel = new Date(berlin); ziel.setHours(Number(m[1]), Number(m[2]), 0, 0);
  const ms = ziel - berlin;
  if (ms < 0) { console.error(`${opt.um} ist heute schon vorbei.`); process.exit(1); }
  kopfSetzen(datei, { status: 'geplant', geplant_um: opt.um });
  console.log(`Warte bis ${opt.um} Uhr (${Math.round(ms / 60000)} Min) …`);
  await new Promise(r => setTimeout(r, ms));
}

try {
  const r = await el('/v1/convai/twilio/outbound-call', { method: 'POST', body: anfrage });
  if (!r.success) throw new Error(r.message || JSON.stringify(r));
  kopfSetzen(datei, { status: 'angerufen', conversation_id: r.conversation_id, call_sid: r.callSid || '', gestartet: new Date().toISOString() });
  console.log(`Anruf läuft: ${r.conversation_id}`);
  console.log(`Ergebnis später: node skripte/gespraeche.mjs zeige ${r.conversation_id}`);
} catch (e) {
  kopfSetzen(datei, { status: 'fehler', fehler: JSON.stringify(e.message.slice(0, 200)) });
  console.error(e.message);
  process.exitCode = 1;
}
