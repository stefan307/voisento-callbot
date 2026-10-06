// Gespräche live aus ElevenLabs lesen.
//   node skripte/gespraeche.mjs liste [--agent inbound|outbound|<agent_id>] [--seit 2026-10-01] [--nummer 0151…] [--max 30]
//   node skripte/gespraeche.mjs zeige <conversation_id>
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { el, argumente, berlin, ziffern, agentKonfig } from '../lib/api.mjs';

const { pos, opt } = argumente();
const [befehl, id] = pos;

function agentId(name) {
  if (!name) return null;
  if (name.startsWith('agent_')) return name;
  const { agent_id } = agentKonfig(name);
  if (!agent_id) throw new Error(`agenten/${name}/agent.json hat noch keine agent_id`);
  return agent_id;
}

async function liste() {
  const max = Number(opt.max || 30);
  const p = new URLSearchParams({ page_size: String(Math.min(max, 100)) });
  const a = agentId(opt.agent);
  if (a) p.set('agent_id', a);
  if (opt.seit) p.set('call_start_after_unix', String(Math.floor(new Date(opt.seit + 'T00:00:00').getTime() / 1000)));

  const treffer = [];
  let cursor;
  do {
    if (cursor) p.set('cursor', cursor);
    const r = await el('/v1/convai/conversations?' + p);
    treffer.push(...r.conversations);
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor && treffer.length < max);

  let zeilen = treffer.slice(0, max);
  // Telefonnummern stehen nur im Einzelabruf.
  const mitNummer = await Promise.all(zeilen.map(async c => {
    const d = await el('/v1/convai/conversations/' + c.conversation_id);
    const pc = d.metadata?.phone_call || {};
    return { ...c, extern: pc.external_number || '', richtung: pc.direction || c.direction || '' };
  }));
  zeilen = opt.nummer ? mitNummer.filter(c => ziffern(c.extern).endsWith(ziffern(opt.nummer).slice(-9))) : mitNummer;

  for (const c of zeilen) {
    console.log([
      berlin(c.start_time_unix_secs),
      c.conversation_id,
      c.agent_name,
      c.richtung,
      c.extern,
      `${c.call_duration_secs}s`,
      c.call_summary_title || '',
    ].join(' | '));
  }
  if (!zeilen.length) console.log('Keine Gespräche gefunden.');
}

async function zeige(cid) {
  const d = await el('/v1/convai/conversations/' + cid);
  const pc = d.metadata?.phone_call || {};
  const dyn = d.conversation_initiation_client_data?.dynamic_variables || {};
  console.log(`# Gespräch ${cid}\n`);
  console.log(`- Agent: ${d.agent_name || d.agent_id}`);
  console.log(`- Beginn: ${berlin(d.metadata?.start_time_unix_secs)} (Europe/Berlin)`);
  console.log(`- Dauer: ${d.metadata?.call_duration_secs}s`);
  console.log(`- Richtung: ${pc.direction || '?'}, extern: ${pc.external_number || '?'}, eigene Nummer: ${pc.agent_number || '?'}`);
  console.log(`- Ende: ${d.metadata?.termination_reason || '?'}`);
  const auftrag = dyn.auftrag_titel || dyn.auftrag;
  if (auftrag) console.log(`- Auftrag: ${String(auftrag).split('\n')[0]}`);
  if (d.analysis?.transcript_summary) console.log(`\n## Zusammenfassung (ElevenLabs)\n\n${d.analysis.transcript_summary}`);
  const daten = d.analysis?.data_collection_results || {};
  if (Object.keys(daten).length) {
    console.log('\n## Erfasste Daten\n');
    for (const [k, v] of Object.entries(daten)) console.log(`- ${k}: ${v.value ?? '–'}`);
  }
  console.log('\n## Transkript\n');
  for (const t of d.transcript || []) {
    const zeit = `[${String(Math.floor(t.time_in_call_secs / 60)).padStart(2, '0')}:${String(t.time_in_call_secs % 60).padStart(2, '0')}]`;
    const wer = t.role === 'agent' ? 'Bot' : 'Gegenüber';
    if (t.message) console.log(`${zeit} **${wer}:** ${t.message}`);
    for (const tc of t.tool_calls || []) console.log(`${zeit} _Werkzeug ${tc.tool_name}: ${tc.params_as_json}_`);
  }
}

// Wartet, bis ElevenLabs das Gespräch fertig ausgewertet hat (Status done/failed), höchstens --max-min Minuten.
async function warte(cid) {
  const bis = Date.now() + Number(opt['max-min'] || 45) * 60_000;
  let letzter = '';
  while (Date.now() < bis) {
    const d = await el('/v1/convai/conversations/' + cid).catch(e => ({ status: 'abruffehler: ' + e.message.slice(0, 80) }));
    if (d.status !== letzter) { console.log(`${new Date().toLocaleTimeString('de-DE')} Status: ${d.status}`); letzter = d.status; }
    if (d.status === 'done' || d.status === 'failed') {
      // Die Auswertung (Zusammenfassung, Datenerfassung) kann kurz nach "done" erst nachkommen.
      if (d.status === 'done' && !d.analysis?.transcript_summary) { await new Promise(r => setTimeout(r, 10_000)); continue; }
      return;
    }
    await new Promise(r => setTimeout(r, 15_000));
  }
  console.log('Zeitlimit erreicht, Gespräch läuft evtl. noch.');
  process.exit(2);
}

try {
  if (befehl === 'liste') await liste();
  else if (befehl === 'zeige' && id) await zeige(id);
  else if (befehl === 'warte' && id) await warte(id);
  else console.log('Aufruf: liste [--agent …] [--seit JJJJ-MM-TT] [--nummer …] [--max N] | zeige <conversation_id> | warte <conversation_id> [--max-min 45]');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
