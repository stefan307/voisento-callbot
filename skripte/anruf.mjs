// Outbound-Anruf aus einer Auftragsdatei starten.
//   node skripte/anruf.mjs auftraege/2026-10-06_versicherung.md          → zeigt nur, was passieren würde
//   node skripte/anruf.mjs auftraege/2026-10-06_versicherung.md --ja     → ruft wirklich an
//   … --ja --um 12:59                                                   → wartet bis 12:59 (Ortszeit Berlin, heute), ruft dann an
// Nach dem Start werden conversation_id und Status in den Kopf der Auftragsdatei geschrieben.
//
// Zwei Modi (Feld "modus" in agenten/outbound/agent.json):
//   eigener Agent (Standard): der Outbound-Agent aus dem Repo, der Auftrag reist als Variablen mit.
//   "override": ein bestehender Agent (meist der laufende Inbound-Agent auf der eigenen Nummer) ruft an.
//     Das Skript setzt agenten/outbound/prompt.md mit dem Auftrag zusammen und schickt es als
//     conversation_config_override (Prompt + leere erste Nachricht). Am Agenten selbst ändert sich nichts.
//     Voraussetzung: Am Agenten ist das Überschreiben von Prompt und erster Nachricht erlaubt
//     (node skripte/pruefen.mjs zeigt es).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { el, argumente, agentKonfig, benoetigteVariablen, overrideFreigaben, ROOT } from '../lib/api.mjs';
import { lesen, kopfSetzen } from '../lib/auftrag.mjs';

const { pos, opt } = argumente();
const datei = pos[0];
if (!datei) { console.log('Aufruf: node skripte/anruf.mjs <auftragsdatei> [--ja]'); process.exit(1); }

let agent;
try { agent = agentKonfig('outbound'); } catch (e) { console.error(e.message); process.exit(1); }
const override = agent.modus === 'override';
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
console.log(`Modus: ${override ? 'Override über bestehenden Agenten' : 'eigener Outbound-Agent'}`);
console.log(`Auftragstext (${text.length} Zeichen):\n${text}\n`);

if (!agent.agent_id || !agent.phone_number_id) {
  console.error('agenten/outbound/agent.json: agent_id oder phone_number_id fehlt'); process.exit(1);
}

// Bereitet den Override vor; wirft bei einem Problem (kein process.exit nach fetch, siehe erfahrungen.md).
async function overrideVorbereiten() {
  {
    const live = await el('/v1/convai/agents/' + agent.agent_id);
    const frei = overrideFreigaben(live);
    if (!frei.prompt || !frei.erste_nachricht) {
      throw new Error(`Agent "${live.name}" erlaubt das Überschreiben nicht (Prompt: ${frei.prompt ? 'ja' : 'nein'}, erste Nachricht: ${frei.erste_nachricht ? 'ja' : 'nein'}).
`
        + 'In ElevenLabs bei diesem Agenten das Überschreiben von System-Prompt und erster Nachricht erlauben, dann erneut versuchen.');
    }
    // Übergabe läuft über das transfer_to_number des bestehenden Agenten, also an dessen eingestellte Ziele.
    // Fehlt das Werkzeug, darf der Bot keine Übergabe anbieten, die er nicht kann.
    const ziele = (live.conversation_config?.agent?.prompt?.built_in_tools?.transfer_to_number?.params?.transfers || [])
      .map(t => t.transfer_destination?.phone_number || t.phone_number || t.transfer_destination?.sip_uri).filter(Boolean);
    if (uebergabe && !ziele.length) {
      variablen.uebergabe_erlaubt = 'nein';
      console.log('Achtung: Der Agent hat kein Übergabe-Werkzeug (transfer_to_number). Übergabe für diesen Anruf abgeschaltet.');
    } else if (uebergabe) {
      console.log(`Übergabe geht an das, was am Agenten eingestellt ist: ${ziele.join(', ')}. Ist das nicht ${agent.im_auftrag_von}, Ziel in ElevenLabs prüfen.`);
    }

    // Prompt aus dem Repo mit dem Auftrag füllen; {{system__…}} setzt ElevenLabs selbst ein.
    const vorlage = readFileSync(join(ROOT, 'agenten', 'outbound', 'prompt.md'), 'utf8').replace(/\r\n/g, '\n').trim();
    const offen = new Set();
    const prompt = vorlage.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (ganz, n) => {
      if (n.startsWith('system__')) return ganz;
      if (variablen[n] === undefined) { offen.add(n); return ganz; }
      return String(variablen[n]);
    });
    if (offen.size) throw new Error('Im Outbound-Prompt fehlen Werte für: ' + [...offen].join(', '));

    // Variablen, die Werkzeuge und Prompt des bestehenden Agenten brauchen, müssen beim Start mitkommen,
    // sonst bricht ElevenLabs ab. Werte: agent.json → "variablen", sonst Platzhalter am Agenten, sonst leer.
    const benoetigt = await benoetigteVariablen(live);
    const platzhalter = live.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders || {};
    const zusatz = {};
    const leer = [];
    for (const n of benoetigt) {
      if (variablen[n] !== undefined) continue;
      if (agent.variablen?.[n] !== undefined) zusatz[n] = String(agent.variablen[n]);
      else if (platzhalter[n] !== undefined && platzhalter[n] !== null) zusatz[n] = String(platzhalter[n]);
      else { zusatz[n] = ''; leer.push(n); }
    }
    if (Object.keys(zusatz).length) console.log(`Variablen des Agenten: ${Object.entries(zusatz).map(([k, v]) => `${k}="${v}"`).join(', ')}`);
    if (leer.length) console.log(`Hinweis: ohne Wert, leer mitgeschickt: ${leer.join(', ')} (Werte in agent.json → "variablen" festlegen)`);

    anfrage.conversation_initiation_client_data = {
      dynamic_variables: { ...zusatz, ...variablen },
      conversation_config_override: { agent: { prompt: { prompt }, first_message: '' } },
    };
    console.log(`Agent: ${live.name} (Prompt ${prompt.length} Zeichen per Override, erste Nachricht leer)\n`);
  }
}

let bereit = true;
if (override) {
  try { await overrideVorbereiten(); } catch (e) { console.error(e.message); bereit = false; process.exitCode = 1; }
}

if (bereit && !opt.ja) console.log('Nur Vorschau. Mit --ja wird wirklich angerufen.');
else if (bereit) await anrufen();

// Anrufer-Kontext (make/kontext.local.json): den Anruf vermerken, damit der Inbound-Bot bei einem Rückruf weiß,
// worum es ging. Nur Titel und die Kopfzeile "kurz", nie den Auftragstext: den hört jeder, der von dort anruft.
async function kontextEintragen(conversation_id) {
  const pfad = join(ROOT, 'make', 'kontext.local.json');
  if (!existsSync(pfad)) return;
  const { hook_url } = JSON.parse(readFileSync(pfad, 'utf8'));
  if (!hook_url) return;
  try {
    const res = await fetch(hook_url + '?step=eintragen', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nummer: kopf.nummer, titel: kopf.titel, kurz: kopf.kurz || '', conversation_id }),
    });
    const antwort = await res.text();
    if (!res.ok || !/ok/.test(antwort)) throw new Error(`${res.status} ${antwort.slice(0, 100)}`);
    console.log('Für Rückrufe vermerkt (Anrufer-Kontext).');
  } catch (e) {
    console.error(`Hinweis: Anrufer-Kontext nicht vermerkt (${e.message}). Der Anruf selbst läuft.`);
  }
}

async function anrufen() {
  if (opt.um) {
    const m = String(opt.um).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) { console.error('--um erwartet HH:MM'); process.exitCode = 1; return; }
    // Abstand bis zur Zielzeit über die Berliner Wanduhr rechnen, damit Sommer-/Winterzeit stimmt.
    const jetzt = new Date();
    const berlin = new Date(jetzt.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const ziel = new Date(berlin); ziel.setHours(Number(m[1]), Number(m[2]), 0, 0);
    const ms = ziel - berlin;
    if (ms < 0) { console.error(`${opt.um} ist heute schon vorbei.`); process.exitCode = 1; return; }
    kopfSetzen(datei, { status: 'geplant', geplant_um: opt.um });
    console.log(`Warte bis ${opt.um} Uhr (${Math.round(ms / 60000)} Min) …`);
    await new Promise(r => setTimeout(r, ms));
  }
  try {
    const r = await el('/v1/convai/twilio/outbound-call', { method: 'POST', body: anfrage });
    if (!r.success) throw new Error(r.message || JSON.stringify(r));
    kopfSetzen(datei, { status: 'angerufen', conversation_id: r.conversation_id, call_sid: r.callSid || '', gestartet: new Date().toISOString() });
    console.log(`Anruf läuft: ${r.conversation_id}`);
    console.log(`Ergebnis nach dem Auflegen: node skripte/gespraeche.mjs zeige ${r.conversation_id}`);
    await kontextEintragen(r.conversation_id);
  } catch (e) {
    kopfSetzen(datei, { status: 'fehler', fehler: JSON.stringify(e.message.slice(0, 200)) });
    console.error(e.message);
    process.exitCode = 1;
  }
}
