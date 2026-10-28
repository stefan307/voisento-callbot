// Legt die lokalen Agent-Einstellungen an (agenten/<name>/agent.json, nicht im Repo).
//   node skripte/konfig.mjs stimmen [--suche <Text>]
//       → listet Stimmen im ElevenLabs-Konto (zum Aussuchen)
//
//   Eigene Agenten aus dem Repo (werden danach mit anlegen.mjs erstellt):
//   node skripte/konfig.mjs --name <Vorname> --nummer +49… --uebergabe +49… --stimme <voice_id>
//       --nummer     Twilio-Nummer der Bots (muss in ElevenLabs importiert sein)
//       --uebergabe  Handynummer, an die die Bots übergeben
//       --stimme     voice_id der Stimme für beide Bots
//
//   Override-Modus mit einem bestehenden Agenten (z. B. dem laufenden Bot auf der eigenen Nummer):
//   node skripte/konfig.mjs --name <Vorname> --agent <agent_id oder Name> [--nummer +49…]
//       Outbound-Anrufe laufen über diesen Agenten per Override (siehe anruf.mjs). Am Agenten und an der Nummer
//       ändert sich nichts; anlegen.mjs, nummer.mjs und agent.mjs senden/holen sind in diesem Modus gesperrt.
//       Ohne --nummer wird die Nummer genommen, die in ElevenLabs an diesem Agenten hängt.
//
// Bestehende agent.json werden nur mit --ueberschreiben ersetzt; vorhandene agent_id bleibt dabei erhalten.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { el, argumente, agentKonfigPfad, ROOT } from '../lib/api.mjs';

const { pos, opt } = argumente();
const e164 = v => /^\+\d{8,15}$/.test(v || '');

function schreiben(name, k) {
  writeFileSync(agentKonfigPfad(name), JSON.stringify(k, null, 2) + '\n');
}

function vorhanden(name) {
  const pfad = agentKonfigPfad(name);
  return existsSync(pfad) ? JSON.parse(readFileSync(pfad, 'utf8')) : null;
}

async function bestehenderAgent() {
  const { agents } = await el('/v1/convai/agents?page_size=100');
  const a = agents.find(x => x.agent_id === opt.agent) || agents.filter(x => x.name === opt.agent);
  const treffer = Array.isArray(a) ? a : [a];
  if (!treffer.length || !treffer[0]) throw new Error(`Agent "${opt.agent}" nicht gefunden (ID oder genauen Namen angeben)`);
  if (treffer.length > 1) throw new Error(`Mehrere Agenten heißen "${opt.agent}", bitte die agent_id angeben: ${treffer.map(x => x.agent_id).join(', ')}`);
  return treffer[0];
}

try {
  if (pos[0] === 'stimmen') {
    const p = new URLSearchParams({ page_size: '50' });
    if (opt.suche) p.set('search', opt.suche);
    const r = await el('/v2/voices?' + p);
    for (const v of r.voices) {
      const l = v.labels || {};
      console.log([v.voice_id, v.name, v.category, l.gender, l.accent || l.language, l.description].filter(Boolean).join(' | '));
    }
    if (!r.voices.length) console.log('Keine Stimmen gefunden.');
  } else if (opt.agent) {
    // Override-Modus
    if (!opt.name) throw new Error('--name fehlt (Vorname für die Ansagen)');
    const a = await bestehenderAgent();
    const nummern = await el('/v1/convai/phone-numbers');
    let nr;
    if (opt.nummer) {
      if (!e164(opt.nummer)) throw new Error('--nummer muss im Format +49… sein');
      nr = nummern.find(n => n.phone_number === opt.nummer);
      if (!nr) throw new Error(`Nummer ${opt.nummer} ist nicht in ElevenLabs importiert`);
    } else {
      const amAgent = nummern.filter(n => n.assigned_agent?.agent_id === a.agent_id);
      if (amAgent.length !== 1) throw new Error(amAgent.length ? `Am Agenten hängen mehrere Nummern (${amAgent.map(n => n.phone_number).join(', ')}), bitte --nummer angeben` : 'Am Agenten hängt keine Nummer, bitte --nummer angeben');
      nr = amAgent[0];
    }
    console.log(`Agent: ${a.name} (${a.agent_id})`);
    console.log(`Nummer: ${nr.phone_number} (${nr.phone_number_id})${nr.assigned_agent?.agent_id && nr.assigned_agent.agent_id !== a.agent_id ? `, eingehend hängt sie an „${nr.assigned_agent.agent_name}“ (bleibt so)` : ''}`);
    for (const name of ['outbound', 'inbound']) {
      const alt = vorhanden(name);
      if (alt && !opt.ueberschreiben) { console.log(`${name}: agent.json gibt es schon, unverändert (--ueberschreiben zum Ersetzen)`); continue; }
      const gemeinsam = { name: a.name, agent_id: a.agent_id, phone_number: nr.phone_number, phone_number_id: nr.phone_number_id, im_auftrag_von: opt.name };
      if (name === 'outbound') {
        schreiben(name, { modus: 'override', ...gemeinsam, ...(opt.uebergabe ? { uebergabe_nummer: opt.uebergabe } : {}), variablen: alt?.variablen || {} });
        console.log('outbound: agent.json geschrieben (modus override)');
      } else {
        // Nur zum Lesen (gespraeche.mjs --agent inbound); der Agent selbst wird vom Repo nicht verändert.
        schreiben(name, { modus: 'live', ...gemeinsam });
        console.log('inbound: agent.json geschrieben (modus live, nur lesen)');
      }
    }
  } else if (!opt.name || !e164(opt.nummer) || !e164(opt.uebergabe) || !opt.stimme) {
    console.log('Aufruf: node skripte/konfig.mjs --name <Vorname> --nummer +49… --uebergabe +49… --stimme <voice_id>');
    console.log('        node skripte/konfig.mjs --name <Vorname> --agent <agent_id oder Name> [--nummer +49…]   (Override-Modus)');
    console.log('        node skripte/konfig.mjs stimmen [--suche <Text>]');
    process.exitCode = 1;
  } else {
    const nummern = await el('/v1/convai/phone-numbers');
    const nr = nummern.find(n => n.phone_number === opt.nummer);
    console.log(nr ? `Nummer gefunden: ${nr.phone_number_id}` : 'Nummer noch nicht in ElevenLabs: erst in der ElevenLabs-Oberfläche importieren (Twilio), dann dieses Skript nochmal mit --ueberschreiben');
    for (const name of ['inbound', 'outbound']) {
      const alt = vorhanden(name);
      if (alt && !opt.ueberschreiben) { console.log(`${name}: agent.json gibt es schon, unverändert (--ueberschreiben zum Ersetzen)`); continue; }
      const k = JSON.parse(readFileSync(join(ROOT, 'agenten', name, 'agent.example.json'), 'utf8'));
      k.name = alt?.name || `Callbot_${opt.name}_${name === 'inbound' ? 'in' : 'out'}`;
      k.agent_id = alt?.modus === 'override' || alt?.modus === 'live' ? null : (alt?.agent_id || null);
      k.im_auftrag_von = opt.name;
      k.phone_number = opt.nummer;
      k.phone_number_id = nr ? nr.phone_number_id : null;
      k.uebergabe_nummer = opt.uebergabe;
      k.voice_id = opt.stimme;
      schreiben(name, k);
      console.log(`${name}: agent.json geschrieben${k.agent_id ? '' : ` (Agent anlegen: node skripte/anlegen.mjs ${name})`}`);
    }
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
