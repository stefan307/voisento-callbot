// Legt einen Agenten aus agenten/<name>/ in ElevenLabs an und schreibt die agent_id zurück.
//   node skripte/anlegen.mjs inbound|outbound
// Stimme, Spracherkennung und Aussprache-Wörterbuch entsprechen Voisento-Bots.
// Ist schon eine agent_id eingetragen, passiert nichts. Prompt-Änderungen danach mit agent.mjs senden.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { el, argumente, agentKonfig, agentKonfigPfad, ROOT } from '../lib/api.mjs';

const { pos } = argumente();
const name = pos[0];
if (!['inbound', 'outbound'].includes(name)) { console.log('Aufruf: node skripte/anlegen.mjs inbound|outbound'); process.exit(1); }

const ordner = join(ROOT, 'agenten', name);
const metaPfad = agentKonfigPfad(name);
const meta = agentKonfig(name);
if (meta.agent_id) { console.log(`Schon angelegt: ${meta.agent_id}`); process.exit(0); }

const prompt = readFileSync(join(ordner, 'prompt.md'), 'utf8').replace(/\r\n/g, '\n').trim();
const erste = readFileSync(join(ordner, 'erste-nachricht.txt'), 'utf8').replace(/\r\n/g, '\n').trim();

const system = (typ, beschreibung, params = {}, extra = {}) => ({
  type: 'system', name: typ, description: beschreibung,
  response_timeout_secs: 20, disable_interruptions: false, interruption_mode: 'allow',
  force_pre_tool_speech: false, pre_tool_speech: 'auto', assignments: [],
  tool_call_sound: null, tool_call_sound_behavior: 'auto', tool_error_handling_mode: 'auto',
  params: { system_tool_type: typ, ...params }, ...extra,
});

const uebergabe = bedingung => system('transfer_to_number',
  `Verbindet das Gespräch per Konferenz mit ${meta.im_auftrag_von}. Schreib in agent_message kurz, mit wem du sprichst und was offen ist.`,
  {
    transfers: [{
      custom_sip_headers: [],
      transfer_destination: { type: 'phone', phone_number: meta.uebergabe_nummer },
      phone_number: meta.uebergabe_nummer,
      transfer_type: 'conference',
      sip_refer_play_dialtone: true, uui: null, post_dial_digits: null, require_acceptance: false,
      condition: bedingung,
    }],
    transfer_rules: [],
    enable_client_message: true,
  });

const endCall = system('end_call', 'Beendet das Telefonat. Nach der Verabschiedung oder wenn der Auftrag erledigt bzw. nicht erledigbar ist.',
  {}, { disable_interruptions: true, interruption_mode: 'disable_during_tool' });

const builtIn = name === 'inbound'
  ? {
      end_call: endCall,
      transfer_to_number: uebergabe(`Nur wenn durchstellen_erlaubt = ja und der Anrufer ausdrücklich verbunden werden will, weil es dringend ist oder er ${meta.im_auftrag_von} persönlich sprechen möchte.`),
    }
  : {
      end_call: endCall,
      transfer_to_number: uebergabe(`Nur wenn uebergabe_erlaubt = ja und der im Auftrag genannte Übergabepunkt erreicht ist, das Gegenüber ${meta.im_auftrag_von} selbst sprechen will oder nur noch Angaben fehlen, die nicht im Auftrag stehen.`),
      skip_turn: system('skip_turn', 'Nichts sagen und weiter zuhören. Bei Wartemusik, Warteansagen, Stille in der Warteschleife oder wenn das Gegenüber etwas nachschaut.'),
      play_keypad_touch_tone: system('play_keypad_touch_tone', 'Tastenton senden, um in einem Telefonmenü eine Auswahl zu treffen oder eine Nummer einzugeben.',
        { use_out_of_band_dtmf: false, suppress_turn_after_dtmf: false }),
      voicemail_detection: system('voicemail_detection', 'Erkennt Mailbox oder Anrufbeantworter und beendet dann das Gespräch ohne Nachricht.',
        { voicemail_message: '' }),
    };

const platzhalter = name === 'inbound'
  ? { im_auftrag_von: meta.im_auftrag_von, durchstellen_erlaubt: 'ja' }
  : { im_auftrag_von: meta.im_auftrag_von, auftrag_titel: 'Testanruf', auftrag: 'Kein Auftrag übergeben. Sag freundlich, dass es sich um einen Testanruf handelt, und beende das Gespräch.', gegenueber: 'unbekannt', uebergabe_erlaubt: 'nein' };

const datenInbound = {
  anrufer_name: { type: 'string', description: 'Vor- und Nachname des Anrufers, falls genannt.' },
  firma: { type: 'string', description: 'Firma des Anrufers, falls genannt.' },
  rueckrufnummer: { type: 'string', description: 'Bestätigte Rückrufnummer im Format +49…' },
  anliegen: { type: 'string', description: 'Das Anliegen in ein bis zwei Sätzen.' },
  gewuenschte_aktion: { type: 'string', description: 'Was Stefan tun soll: zurückrufen, etwas schicken, entscheiden …' },
  frist: { type: 'string', description: 'Genannte Frist oder Dringlichkeit, sonst leer.' },
};
const datenOutbound = {
  ergebnis: { type: 'string', description: 'Ergebnis des Auftrags in einem Satz.' },
  auftrag_erledigt: { type: 'boolean', description: 'Nur true, wenn das im Auftrag genannte Ziel vollständig erreicht wurde (z. B. Schadennummer erhalten, Termin bestätigt). Eine Übergabe an Stefan allein ist kein erledigter Auftrag.' },
  vorgangsnummer: { type: 'string', description: 'Nur eine Nummer, die das Gegenüber neu vergeben und genannt hat (Schaden-, Vorgangs- oder Buchungsnummer). Nie Nummern aus dem Auftrag wie Vertrags- oder Kundennummer. Sonst leer.' },
  termin: { type: 'string', description: 'Vereinbarter Termin als JJJJ-MM-TT HH:MM (Ortszeit Berlin), aus dem Gesprächsdatum errechnet, sonst leer.' },
  ansprechpartner: { type: 'string', description: 'Name und Durchwahl des Gesprächspartners.' },
  uebergeben: { type: 'boolean', description: 'Nur true, wenn das Werkzeug transfer_to_number tatsächlich aufgerufen wurde. Ein Versprechen, dass Stefan sich meldet, ist keine Übergabe.' },
};

const body = {
  name: meta.name,
  tags: ['callbot', 'test'],
  conversation_config: {
    asr: { quality: 'high', provider: 'scribe_realtime', user_input_audio_format: 'ulaw_8000', keywords: ['Voisento', 'Stefan'] },
    turn: {
      // Outbound wartet in Warteschleifen: länger still bleiben, nie wegen Stille auflegen.
      turn_timeout: name === 'outbound' ? 20 : 7,
      silence_end_call_timeout: -1,
      mode: 'turn', turn_eagerness: 'normal', turn_model: 'turn_v3',
    },
    tts: {
      model_id: 'eleven_v3_conversational', voice_id: 'zKHQdbB8oaQ7roNTiDTK',
      agent_output_audio_format: 'ulaw_8000', optimize_streaming_latency: 3,
      stability: 0.5, speed: 1.0, similarity_boost: 0.8,
      pronunciation_dictionary_locators: [{ pronunciation_dictionary_id: 'MEfhaZOfTF6G88qESWzR', version_id: null }],
    },
    conversation: { max_duration_seconds: name === 'outbound' ? 2400 : 600 },
    agent: {
      language: 'de',
      first_message: erste,
      dynamic_variables: { dynamic_variable_placeholders: platzhalter },
      prompt: { prompt, llm: meta.llm, temperature: name === 'outbound' ? 0.5 : 0.2, built_in_tools: builtIn },
    },
  },
  platform_settings: {
    data_collection: name === 'inbound' ? datenInbound : datenOutbound,
  },
};

try {
  const r = await el('/v1/convai/agents/create', { method: 'POST', body });
  meta.agent_id = r.agent_id;
  writeFileSync(metaPfad, JSON.stringify(meta, null, 2) + '\n');
  console.log(`Angelegt: ${meta.name} → ${r.agent_id}`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
