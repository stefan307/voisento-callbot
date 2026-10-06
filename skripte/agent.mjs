// Agenten als Code: Prompt und erste Nachricht liegen in agenten/<name>/, ElevenLabs ist nur die Laufzeit.
//   node skripte/agent.mjs vergleich <name>   → Unterschied Repo ↔ ElevenLabs zeigen
//   node skripte/agent.mjs holen <name>       → Stand aus ElevenLabs ins Repo schreiben
//   node skripte/agent.mjs senden <name>      → Stand aus dem Repo nach ElevenLabs schreiben
// agenten/<name>/agent.json braucht dafür eine agent_id (Agent einmal in ElevenLabs anlegen).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { el, argumente, agentKonfig, fuerAgent, ausAgent, ROOT } from '../lib/api.mjs';

const { pos } = argumente();
const [befehl, name] = pos;
if (!befehl || !name) { console.log('Aufruf: vergleich|holen|senden <name>'); process.exit(1); }

const ordner = join(ROOT, 'agenten', name);
const meta = agentKonfig(name);
if (!meta.agent_id) { console.error(`agenten/${name}/agent.json: agent_id fehlt`); process.exit(1); }

const lokal = () => ({
  prompt: fuerAgent(name, readFileSync(join(ordner, 'prompt.md'), 'utf8').replace(/\r\n/g, '\n').trim(), meta),
  erste: fuerAgent(name, existsSync(join(ordner, 'erste-nachricht.txt'))
    ? readFileSync(join(ordner, 'erste-nachricht.txt'), 'utf8').replace(/\r\n/g, '\n').trim() : '', meta),
});

const live = async () => {
  const a = await el('/v1/convai/agents/' + meta.agent_id);
  const ag = a.conversation_config?.agent || {};
  return { prompt: (ag.prompt?.prompt || '').trim(), erste: (ag.first_message || '').trim(), roh: a };
};

try {
  if (befehl === 'vergleich') {
    const [l, r] = [lokal(), await live()];
    console.log(`Prompt: ${l.prompt === r.prompt ? 'gleich' : `UNTERSCHIEDLICH (Repo ${l.prompt.length}, live ${r.prompt.length} Zeichen)`}`);
    console.log(`Erste Nachricht: ${l.erste === r.erste ? 'gleich' : 'UNTERSCHIEDLICH'}`);
  } else if (befehl === 'holen') {
    const r = await live();
    writeFileSync(join(ordner, 'prompt.md'), ausAgent(name, r.prompt, meta) + '\n');
    writeFileSync(join(ordner, 'erste-nachricht.txt'), ausAgent(name, r.erste, meta) + '\n');
    // Restliche Konfiguration nur zum Nachlesen, wird nicht zurückgeschrieben.
    writeFileSync(join(ordner, 'live-konfig.json'), JSON.stringify({
      conversation_config: r.roh.conversation_config,
      platform_settings: r.roh.platform_settings,
    }, null, 2) + '\n');
    console.log('Geholt. Mit git diff prüfen.');
  } else if (befehl === 'senden') {
    const l = lokal();
    await el('/v1/convai/agents/' + meta.agent_id, {
      method: 'PATCH',
      body: { conversation_config: { agent: { prompt: { prompt: l.prompt }, first_message: l.erste } } },
    });
    console.log('Gesendet.');
  } else {
    console.log('Unbekannter Befehl'); process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
