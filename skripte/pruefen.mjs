// Prüft die Einrichtung Schritt für Schritt, ohne etwas zu verändern.
//   node skripte/pruefen.mjs                 → alles, was zur lokalen Einrichtung passt
//   node skripte/pruefen.mjs --nur-outbound  → nur, was für ausgehende Anrufe nötig ist
// Im Override-Modus (agenten/outbound/agent.json: "modus": "override") wird automatisch nur Outbound geprüft.
// Jede Zeile beginnt mit OK, FEHLT, FEHLER oder HINWEIS. Nur FEHLT und FEHLER zählen als offen.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { el, tw, twZugang, elKey, agentKonfigPfad, argumente, benoetigteVariablen, overrideFreigaben, EL_BASIS, TW_BASIS, ROOT } from '../lib/api.mjs';

const { opt } = argumente();
let fehler = 0;
const ok = t => console.log('OK      ' + t);
const fehlt = t => { fehler++; console.log('FEHLT   ' + t); };
const kaputt = t => { fehler++; console.log('FEHLER  ' + t); };
const hinweis = t => console.log('HINWEIS ' + t);

const lies = name => existsSync(agentKonfigPfad(name)) ? JSON.parse(readFileSync(agentKonfigPfad(name), 'utf8')) : null;
const outbound = lies('outbound');
const inbound = lies('inbound');
const override = outbound?.modus === 'override';
const nurOutbound = override || !!opt['nur-outbound'];
const mitschnitt = existsSync(join(ROOT, 'make', 'mitschneider.local.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'make', 'mitschneider.local.json'), 'utf8')) : null;

if (override) console.log('(Override-Modus: geprüft wird nur, was für ausgehende Anrufe über den bestehenden Agenten nötig ist)\n');
else if (nurOutbound) console.log('(nur Outbound)\n');

const major = Number(process.versions.node.split('.')[0]);
major >= 22 ? ok(`Node ${process.versions.node}`) : kaputt(`Node ${process.versions.node}, nötig ist 22 oder neuer (empfohlen 24)`);

// ElevenLabs
let elOk = false;
try {
  elKey();
  await el('/v1/convai/agents?page_size=1');
  ok(`ElevenLabs-Schlüssel gilt (${EL_BASIS})`);
  elOk = true;
} catch (e) {
  if (/fehlt/.test(e.message)) fehlt('ELEVENLABS_API_KEY in .env');
  else if (/data residency stack|global server/.test(e.message)) kaputt('ElevenLabs-Schlüssel gehört zu einem anderen Server: ELEVENLABS_API_BASE in .env setzen (z. B. EU-Residency)');
  else if (/invalid/i.test(e.message)) kaputt('ElevenLabs-Schlüssel ungültig oder gelöscht');
  else kaputt('ElevenLabs: ' + e.message.slice(0, 200));
}

// Twilio
let twOk = false;
try {
  twZugang();
  await tw('/IncomingPhoneNumbers.json?PageSize=1');
  ok(`Twilio-Schlüssel gilt (${TW_BASIS})`);
  twOk = true;
} catch (e) {
  if (/fehlt/.test(e.message)) fehlt('TWILIO_ACCOUNT_SID / TWILIO_KEY_SID / TWILIO_KEY_SECRET in .env');
  else if (/20003|401/.test(e.message)) kaputt('Twilio lehnt ab: Schlüssel falsch oder aus einer anderen Region als TWILIO_API_BASE');
  else kaputt('Twilio: ' + e.message.slice(0, 200));
}

// Agenten
const zuPruefen = nurOutbound ? ['outbound'] : ['inbound', 'outbound'];
for (const name of zuPruefen) {
  const meta = name === 'outbound' ? outbound : inbound;
  if (!meta) { fehlt(`agenten/${name}/agent.json: node skripte/konfig.mjs`); continue; }
  const pflicht = override ? ['im_auftrag_von', 'phone_number'] : ['im_auftrag_von', 'uebergabe_nummer', 'phone_number'];
  for (const feld of pflicht) if (!meta[feld]) fehlt(`agenten/${name}/agent.json: ${feld}`);
  if (meta.uebergabe_nummer && !/^\+\d{8,15}$/.test(meta.uebergabe_nummer)) kaputt(`agenten/${name}/agent.json: uebergabe_nummer muss +49… sein`);
  if (!elOk) continue;
  if (!meta.agent_id) { fehlt(override ? 'agent_id fehlt: node skripte/konfig.mjs --name … --agent <ID oder Name>' : `Agent ${name} noch nicht angelegt: node skripte/anlegen.mjs ${name}`); continue; }
  let a;
  try { a = await el('/v1/convai/agents/' + meta.agent_id); }
  catch { kaputt(`Agent ${name} (${meta.agent_id}) gibt es in diesem Konto nicht${override ? '' : '. agent_id in agent.json auf null setzen und neu anlegen'}`); continue; }
  ok(`Agent ${name}: ${a.name}${override ? ' (bestehender Agent, Override-Modus)' : ''}`);
  if (name !== 'outbound') continue;

  // Was ein ausgehender Anruf über diesen Agenten braucht
  if (override) {
    const frei = overrideFreigaben(a);
    if (frei.prompt && frei.erste_nachricht) ok('Überschreiben von Prompt und erster Nachricht ist erlaubt');
    else kaputt(`Überschreiben nicht erlaubt (Prompt: ${frei.prompt ? 'ja' : 'nein'}, erste Nachricht: ${frei.erste_nachricht ? 'ja' : 'nein'}): in ElevenLabs beim Agenten freischalten, sonst bricht der Anruf ab`);
  }
  const bt = a.conversation_config?.agent?.prompt?.built_in_tools || {};
  const gewuenscht = ['end_call', 'transfer_to_number', 'skip_turn', 'play_keypad_touch_tone', 'voicemail_detection'];
  const ohne = gewuenscht.filter(w => !bt[w]);
  if (!ohne.length) ok('Werkzeuge für Outbound vorhanden (Auflegen, Übergabe, Warten, Tastentöne, Mailbox)');
  else hinweis(`Am Agenten fehlen: ${ohne.join(', ')}. Der Outbound-Prompt rechnet damit (z. B. Warteschleife, Telefonmenü); in ElevenLabs ergänzen, falls gebraucht`);
  if (override) {
    const benoetigt = await benoetigteVariablen(a);
    const platzhalter = a.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders || {};
    const eigene = ['auftrag_titel', 'auftrag', 'gegenueber', 'im_auftrag_von', 'uebergabe_erlaubt'];
    const ohneWert = benoetigt.filter(n => !eigene.includes(n) && meta.variablen?.[n] === undefined && (platzhalter[n] === undefined || platzhalter[n] === ''));
    if (benoetigt.length) ok(`Variablen des Agenten werden mitgeschickt: ${benoetigt.join(', ')}`);
    if (ohneWert.length) hinweis(`Ohne festen Wert, gehen leer mit: ${ohneWert.join(', ')}. Falls ein Werkzeug sie braucht: in agenten/outbound/agent.json unter "variablen" eintragen`);
  }
}

// Nummer
const nummerMeta = nurOutbound ? outbound : (inbound || outbound);
// Zeigt die Nummer in Twilio wirklich auf das Mitschneider-Szenario? Nur dann ist die ElevenLabs-Zuordnung egal.
let twNummer = null;
if (twOk && nummerMeta?.phone_number) {
  twNummer = (await tw('/IncomingPhoneNumbers.json?PhoneNumber=' + encodeURIComponent(nummerMeta.phone_number))).incoming_phone_numbers[0] || null;
}
const ueberMake = !!(mitschnitt?.hook_url && twNummer && twNummer.voice_url === mitschnitt.hook_url + '?step=eingang');
if (elOk && nummerMeta?.phone_number) {
  const nummern = await el('/v1/convai/phone-numbers');
  const n = nummern.find(x => x.phone_number === nummerMeta.phone_number);
  if (!n) fehlt(`Nummer ${nummerMeta.phone_number} ist nicht in ElevenLabs importiert: in der ElevenLabs-Oberfläche importieren (Twilio), dann node skripte/konfig.mjs --ueberschreiben …`);
  else {
    if (n.phone_number_id !== nummerMeta.phone_number_id) kaputt(`phone_number_id in agent.json passt nicht, richtig wäre ${n.phone_number_id}`);
    else ok(`Nummer ${nummerMeta.phone_number} in ElevenLabs (${n.phone_number_id})`);
    if (n.supports_outbound === false) kaputt('Die Nummer ist in ElevenLabs nicht für ausgehende Anrufe freigegeben');
    if (!nurOutbound && !ueberMake) {
      if (n.assigned_agent?.agent_id === inbound?.agent_id) ok('Nummer ist dem Inbound-Agenten zugeordnet');
      else if (!n.assigned_agent) fehlt('Nummer ist keinem Agenten zugeordnet: node skripte/nummer.mjs zuordnen');
      else fehlt(`Nummer hängt eingehend am Agenten „${n.assigned_agent.agent_name}“. Nur umhängen (node skripte/nummer.mjs zuordnen), wenn die Nummer wirklich für den Callbot gedacht ist; läuft dort ein Bot, der bleiben soll, stattdessen den Override-Modus nutzen (node skripte/konfig.mjs --agent …)`);
    } else if (n.assigned_agent) {
      hinweis(`Eingehend hängt die Nummer in ElevenLabs an „${n.assigned_agent.agent_name}“; für ausgehende Anrufe egal, wird nicht verändert`);
    }
  }
}
if (twOk && nummerMeta?.phone_number) {
  const n = twNummer;
  if (!n) {
    // Eigene Nummer nur als Absender freigeschaltet (Verified Caller ID): für ausgehende Anrufe in Ordnung.
    const v = await tw('/OutgoingCallerIds.json?PhoneNumber=' + encodeURIComponent(nummerMeta.phone_number)).catch(() => ({ outgoing_caller_ids: [] }));
    if (v.outgoing_caller_ids?.length) ok(`Nummer ist in Twilio als Verified Caller ID freigeschaltet (nur ausgehend)`);
    else kaputt(`Nummer ${nummerMeta.phone_number} nicht im Twilio-Konto unter ${TW_BASIS}. Andere Region? TWILIO_API_BASE prüfen`);
  } else if (ueberMake) {
    ok('Twilio leitet Anrufe an das Mitschneider-Szenario in Make (so gewollt)');
  } else if (/elevenlabs\.io/.test(n.voice_url || '')) {
    ok('Twilio leitet eingehende Anrufe an ElevenLabs');
  } else if (nurOutbound) {
    hinweis(`Eingehende Anrufe gehen in Twilio an ${n.voice_url || 'nichts'}; für ausgehende Anrufe egal`);
  } else {
    kaputt(`Twilio Voice-URL zeigt auf ${n.voice_url || 'nichts'}, erwartet ElevenLabs. Nummer in ElevenLabs (neu) importieren`);
  }
}

if (existsSync(join(ROOT, 'profil.local.md'))) ok('profil.local.md vorhanden');
else hinweis('profil.local.md fehlt (Stammdaten für Aufträge, Vorlage: profil.local.example.md); Claude fragt dann pro Auftrag nach');

console.log(fehler ? `\n${fehler} Punkt(e) offen.` : '\nAlles eingerichtet.');
process.exitCode = fehler ? 1 : 0;
