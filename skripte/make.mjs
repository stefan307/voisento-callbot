// Make-Szenario "Mitschneider" aus der Vorlage im Repo erzeugen und per Make-API einspielen.
//   node skripte/make.mjs vorschau                 → zeigt, welche Werte fehlen; schreibt nichts
//   node skripte/make.mjs einspielen               → legt Webhook/Schlüssel/Szenario an bzw. aktualisiert sie und schaltet aktiv
//   node skripte/make.mjs holen                    → aktuellen Stand aus Make nach make/mitschneider.live.json (zum Vergleichen)
//   node skripte/make.mjs nummer +49… [--ja]       → Twilio-Nummer auf den Webhook zeigen lassen (ohne --ja nur anzeigen)
//
// Vorlage: make/mitschneider.blueprint.json (Platzhalter %%NAME%%, keine persönlichen Daten).
// Eigene Werte: make/mitschneider.local.json (Vorlage make/mitschneider.example.json, nicht im Repo).
// Zugang: MAKE_API_TOKEN, MAKE_API_BASE, MAKE_TEAM_ID in .env. Es ist immer der Make-Zugang des Nutzers.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { argumente, agentKonfig, el, tw, EL_BASIS, TW_BASIS, twZugang, ROOT } from '../lib/api.mjs';

const VORLAGE = join(ROOT, 'make', 'mitschneider.blueprint.json');
const LOKAL = join(ROOT, 'make', 'mitschneider.local.json');
const LIVE = join(ROOT, 'make', 'mitschneider.live.json');

const { pos, opt } = argumente();
const befehl = pos[0];

function makeZugang() {
  const token = process.env.MAKE_API_TOKEN, basis = process.env.MAKE_API_BASE, team = Number(process.env.MAKE_TEAM_ID);
  if (!token || !basis || !team) throw new Error('MAKE_API_TOKEN, MAKE_API_BASE und MAKE_TEAM_ID in .env setzen (siehe .env.example)');
  return { token, basis: basis.replace(/\/$/, ''), team };
}

async function make(pfad, { method = 'GET', body } = {}) {
  const { token, basis } = makeZugang();
  const res = await fetch(basis + pfad, {
    method,
    headers: { authorization: 'Token ' + token, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Make ${method} ${pfad}: ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

function lokal() {
  if (!existsSync(LOKAL)) throw new Error('make/mitschneider.local.json fehlt (Vorlage: make/mitschneider.example.json)');
  return JSON.parse(readFileSync(LOKAL, 'utf8'));
}
const speichern = k => writeFileSync(LOKAL, JSON.stringify(k, null, 2) + '\n');

// Text für XML (TwiML) und JSON-String (register-call) unschädlich machen.
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonText = s => JSON.stringify(String(s)).slice(1, -1);

function werte(k) {
  const agent = existsSync(join(ROOT, 'agenten', 'inbound', 'agent.json')) ? agentKonfig('inbound') : {};
  return {
    SZENARIO_NAME: k.szenario_name || 'Callbot Mitschneider',
    HOOK_ID: k.hook_id,
    HOOK_URL: k.hook_url,
    WEITERLEITEN_AN: k.weiterleiten_an,
    EIGENE_NUMMERN: (k.eigene_nummern || []).join(','),
    KLINGELN_SEKUNDEN: k.klingeln_sekunden ?? 15,
    MAX_SEKUNDEN: k.max_sekunden ?? 14400,
    ANSAGE_WEITERLEITUNG: xml(k.ansage_weiterleitung || ''),
    ANSAGE_MITSCHNITT: xml(k.ansage_mitschnitt || ''),
    ERSTE_NACHRICHT_RUECKWEG: jsonText(k.erste_nachricht_rueckweg || ''),
    AGENT_ID: agent.agent_id,
    ELEVENLABS_API_BASE: EL_BASIS,
    ELEVENLABS_KEY_ID: k.elevenlabs_key_id,
  };
}

function fuellen(w) {
  let text = readFileSync(VORLAGE, 'utf8');
  const fehlt = new Set();
  // Zahlen-IDs ohne Anführungszeichen einsetzen, alles andere als Text.
  text = text.replace(/"%%(HOOK_ID|ELEVENLABS_KEY_ID)%%"/g, (_, n) => {
    if (w[n] == null || w[n] === '') { fehlt.add(n); return '0'; }
    return String(Number(w[n]));
  });
  text = text.replace(/%%([A-Z_0-9]+)%%/g, (_, n) => {
    if (w[n] == null || w[n] === '') { fehlt.add(n); return `%%${n}%%`; }
    return String(w[n]).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  });
  return { blueprint: JSON.parse(text), fehlt: [...fehlt] };
}

async function einspielen() {
  const { team } = makeZugang();
  const k = lokal();
  for (const feld of ['weiterleiten_an', 'eigene_nummern', 'ansage_weiterleitung', 'ansage_mitschnitt', 'erste_nachricht_rueckweg']) {
    if (!k[feld] || (Array.isArray(k[feld]) && !k[feld].length)) throw new Error(`make/mitschneider.local.json: ${feld} fehlt`);
  }
  const agent = agentKonfig('inbound');
  if (!agent.agent_id) throw new Error('Inbound-Agent fehlt (node skripte/anlegen.mjs inbound)');

  if (!k.hook_id) {
    const r = await make('/hooks', { method: 'POST', body: { name: `${k.szenario_name || 'Callbot Mitschneider'} (Twilio)`, teamId: team, typeName: 'gateway-webhook', method: false, headers: false, stringify: false } });
    k.hook_id = r.hook.id; k.hook_url = r.hook.url; speichern(k);
    console.log(`Webhook angelegt: ${k.hook_url}`);
  }
  if (!k.elevenlabs_key_id) {
    // API-Schlüssel für register-call als Make-Schlüssel hinterlegen (Header xi-api-key).
    const r = await make('/keys', { method: 'POST', body: { teamId: team, name: 'callbot-elevenlabs', typeName: 'apikeyauth', parameters: { key: process.env.ELEVENLABS_API_KEY, placement: 'header', name: 'xi-api-key' } } });
    k.elevenlabs_key_id = r.key.id; speichern(k);
    console.log(`ElevenLabs-Schlüssel in Make hinterlegt (ID ${k.elevenlabs_key_id})`);
  }

  // Der Bot bekommt auf dem Rückweg eine eigene Begrüßung; dafür muss er das Überschreiben erlauben.
  const a = await el('/v1/convai/agents/' + agent.agent_id);
  const ov = a.platform_settings?.overrides?.conversation_config_override?.agent || {};
  if (!ov.first_message) {
    await el('/v1/convai/agents/' + agent.agent_id, { method: 'PATCH', body: { platform_settings: { overrides: { conversation_config_override: { agent: { first_message: true } } } } } });
    console.log('Inbound-Agent: Begrüßung darf jetzt pro Anruf überschrieben werden');
  }

  const { blueprint, fehlt } = fuellen(werte(k));
  if (fehlt.length) throw new Error('Werte fehlen: ' + fehlt.join(', '));
  if (!k.scenario_id) {
    const r = await make('/scenarios', { method: 'POST', body: { teamId: team, blueprint: JSON.stringify(blueprint), scheduling: JSON.stringify({ type: 'immediately' }) } });
    k.scenario_id = r.scenario.id; speichern(k);
    console.log(`Szenario angelegt: ${k.scenario_id}`);
  } else {
    await make(`/scenarios/${k.scenario_id}`, { method: 'PATCH', body: { blueprint: JSON.stringify(blueprint) } });
    console.log(`Szenario aktualisiert: ${k.scenario_id}`);
  }
  await make(`/scenarios/${k.scenario_id}/start`, { method: 'POST' }).catch(e => {
    if (!/already|IM306/i.test(e.message)) throw e;
  });
  console.log('Szenario ist aktiv.');
}

try {
  if (befehl === 'vorschau') {
    const k = existsSync(LOKAL) ? lokal() : {};
    const { fehlt } = fuellen(werte(k));
    console.log(fehlt.length ? 'Noch offen: ' + fehlt.join(', ') + '\n(HOOK_ID/HOOK_URL/ELEVENLABS_KEY_ID legt "einspielen" selbst an)' : 'Vorlage vollständig befüllbar.');
  } else if (befehl === 'einspielen') {
    await einspielen();
  } else if (befehl === 'holen') {
    const k = lokal();
    if (!k.scenario_id) throw new Error('Noch kein Szenario eingespielt');
    const r = await make(`/scenarios/${k.scenario_id}/blueprint`);
    writeFileSync(LIVE, JSON.stringify(r.response?.blueprint ?? r, null, 2) + '\n');
    console.log('Gespeichert: make/mitschneider.live.json');
  } else if (befehl === 'nummer') {
    const nummer = pos[1];
    const k = lokal();
    if (!/^\+\d{8,15}$/.test(nummer || '')) throw new Error('Aufruf: node skripte/make.mjs nummer +49… [--ja]');
    if (!k.hook_url) throw new Error('Erst einspielen, dann gibt es eine Webhook-Adresse');
    twZugang();
    const r = await tw('/IncomingPhoneNumbers.json?PhoneNumber=' + encodeURIComponent(nummer));
    const n = r.incoming_phone_numbers[0];
    if (!n) throw new Error(`Nummer ${nummer} nicht im Twilio-Konto unter ${TW_BASIS}`);
    console.log(`${nummer}: bisher ${n.voice_method} ${n.voice_url || '(leer)'}`);
    console.log(`neu:     POST ${k.hook_url}`);
    if (!opt.ja) { console.log('Nur Anzeige. Mit --ja wird umgestellt (die bisherige Einstellung steht oben, falls ihr zurück wollt).'); }
    else {
      const { sid, geheim, konto } = twZugang();
      const res = await fetch(`${TW_BASIS}/2010-04-01/Accounts/${konto}/IncomingPhoneNumbers/${n.sid}.json`, {
        method: 'POST',
        headers: { authorization: 'Basic ' + Buffer.from(`${sid}:${geheim}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ VoiceUrl: k.hook_url, VoiceMethod: 'POST' }),
      });
      if (!res.ok) throw new Error(`Twilio: ${res.status} ${(await res.text()).slice(0, 300)}`);
      k.nummer = nummer; k.nummer_vorher = `${n.voice_method} ${n.voice_url || ''}`.trim(); speichern(k);
      console.log('Umgestellt.');
    }
  } else {
    console.log('Aufruf: node skripte/make.mjs vorschau|einspielen|holen|nummer +49… [--ja]');
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
