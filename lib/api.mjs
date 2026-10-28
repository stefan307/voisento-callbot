// Gemeinsame Zugänge zu ElevenLabs und Twilio. Server/Region kommen aus .env (siehe .env.example).
// Schlüssel kommen ausschließlich aus .env im Repo (siehe .env.example) oder aus Umgebungsvariablen.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function ladeEnv() {
  const datei = join(ROOT, '.env');
  if (!existsSync(datei)) return;
  for (const zeile of readFileSync(datei, 'utf8').split(/\r?\n/)) {
    const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
ladeEnv();

// Standard sind die globalen Server. EU-Residency-Konten: https://api.eu.residency.elevenlabs.io,
// Twilio-Region Irland: https://api.dublin.ie1.twilio.com
export const EL_BASIS = process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io';
export const TW_BASIS = process.env.TWILIO_API_BASE || 'https://api.twilio.com';

export function elKey() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error('ELEVENLABS_API_KEY fehlt in .env');
  return k;
}

export function twZugang() {
  const sid = process.env.TWILIO_KEY_SID, geheim = process.env.TWILIO_KEY_SECRET, konto = process.env.TWILIO_ACCOUNT_SID;
  if (!sid || !geheim || !konto) throw new Error('Twilio-Zugang fehlt in .env (TWILIO_ACCOUNT_SID, TWILIO_KEY_SID, TWILIO_KEY_SECRET)');
  return { sid, geheim, konto };
}

export async function el(pfad, { method = 'GET', body, form } = {}) {
  const headers = { 'xi-api-key': elKey() };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(EL_BASIS + pfad, { method, headers, body: payload });
  const text = await res.text();
  if (!res.ok) throw new Error(`ElevenLabs ${method} ${pfad}: ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

export async function tw(pfad, { roh = false } = {}) {
  const { sid, geheim, konto } = twZugang();
  const url = pfad.startsWith('http') ? pfad : `${TW_BASIS}/2010-04-01/Accounts/${konto}${pfad}`;
  const res = await fetch(url, { headers: { authorization: 'Basic ' + Buffer.from(`${sid}:${geheim}`).toString('base64') } });
  if (!res.ok) throw new Error(`Twilio GET ${pfad}: ${res.status} ${(await res.text()).slice(0, 400)}`);
  return roh ? Buffer.from(await res.arrayBuffer()) : res.json();
}

// Nur Ziffern vergleichen, führende 0 wird zu 49 (wie in anrufprotokolle).
export function ziffern(nummer = '') {
  let d = String(nummer).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '49' + d.slice(1);
  return d;
}

export function berlin(unixSek) {
  return new Date(unixSek * 1000).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
}

export function argumente(argv = process.argv.slice(2)) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) opt[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) opt[k] = argv[++i];
      else opt[k] = true;
    } else pos.push(a);
  }
  return { pos, opt };
}

// Agent-Einstellungen (IDs, Nummern, Name) liegen nur lokal in agenten/<name>/agent.json,
// die Vorlage dazu ist agent.example.json. Anlegen: node skripte/konfig.mjs
export function agentKonfig(name) {
  const datei = join(ROOT, 'agenten', name, 'agent.json');
  if (!existsSync(datei)) throw new Error(`agenten/${name}/agent.json fehlt. Erst einrichten: node skripte/konfig.mjs (siehe INSTALL.md)`);
  return JSON.parse(readFileSync(datei, 'utf8'));
}

// Der Inbound-Agent bekommt den Namen fest eingesetzt (bei eingehenden Anrufen werden {{…}} nicht ersetzt).
// Outbound behält die Variablen, die liefert anruf.mjs bei jedem Anruf mit.
export function fuerAgent(name, text, meta) {
  if (name !== 'inbound') return text;
  let t = text.replaceAll('{{im_auftrag_von}}', meta.im_auftrag_von);
  // Ohne lokalen Wert bleibt {{durchstellen_erlaubt}} stehen: dann liefert Make ihn bei jedem Anruf mit.
  if (meta.durchstellen_erlaubt) t = t.replaceAll('{{durchstellen_erlaubt}}', meta.durchstellen_erlaubt);
  return t;
}

// Umkehrung für "holen": den eingesetzten Namen wieder zur Variablen machen.
export function ausAgent(name, text, meta) {
  if (name !== 'inbound' || !meta.im_auftrag_von) return text;
  return text.replaceAll(meta.im_auftrag_von, '{{im_auftrag_von}}');
}

// Welche {{Variablen}} braucht ein bestehender Agent? Aus Prompt, erster Nachricht, eingebauten Werkzeugen und
// den Werkzeugen (tool_ids). ElevenLabs bricht ein Gespräch ab, wenn eine davon beim Start fehlt
// ("Missing required dynamic variables …"); die Platzhalter am Agenten greifen dabei nicht.
// system__-Variablen setzt ElevenLabs selbst und werden ausgelassen.
export async function benoetigteVariablen(agentDoc) {
  const ag = agentDoc.conversation_config?.agent || {};
  const namen = new Set();
  const sammeln = text => {
    for (const m of String(text || '').matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) namen.add(m[1]);
    for (const m of String(text || '').matchAll(/"dynamic_variable"\s*:\s*"([A-Za-z0-9_]+)"/g)) namen.add(m[1]);
  };
  sammeln(ag.prompt?.prompt);
  sammeln(ag.first_message);
  sammeln(JSON.stringify(ag.prompt?.built_in_tools || {}));
  for (const id of ag.prompt?.tool_ids || []) {
    const t = await el('/v1/convai/tools/' + id).catch(() => null);
    if (t) sammeln(JSON.stringify(t.tool_config));
  }
  return [...namen].filter(n => !n.startsWith('system__')).sort();
}

// Darf ein Gespräch Prompt und erste Nachricht des Agenten überschreiben? (Voraussetzung für den Override-Modus)
export function overrideFreigaben(agentDoc) {
  const o = agentDoc.platform_settings?.overrides?.conversation_config_override?.agent || {};
  return { prompt: !!o.prompt?.prompt, erste_nachricht: !!o.first_message };
}

// Override-/Live-Modus: der Agent gehört nicht dem Repo (meist der laufende Bot auf der eigenen Nummer).
// Skripte, die Agent oder Nummer verändern, verweigern dann die Arbeit.
export function fremderAgent(meta) {
  return meta?.modus === 'override' || meta?.modus === 'live';
}

export function sperreBeiFremdemAgent(meta, was) {
  if (!fremderAgent(meta)) return false;
  console.error(`${was} ist gesperrt: "${meta.name}" ist ein bestehender Agent (modus ${meta.modus}), nicht einer aus dem Repo.`);
  console.error('Sonst würde der dort gebaute Prompt bzw. die Nummer überschrieben. Änderungen am Agenten in der ElevenLabs-Oberfläche vornehmen.');
  process.exitCode = 1;
  return true;
}

export function agentKonfigPfad(name) {
  return join(ROOT, 'agenten', name, 'agent.json');
}

export { ROOT };
