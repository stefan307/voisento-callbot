// Passive Mitschnitte aus Twilio lesen und bei Bedarf transkribieren.
//   node skripte/aufnahmen.mjs liste [--seit 2026-10-01] [--nummer 0151…] [--max 20]
//   node skripte/aufnahmen.mjs transkript <RE…>
// Die Audiodatei wird nur im Speicher gehalten und direkt an ElevenLabs-STT (EU) geschickt.
import { tw, el, argumente, ziffern } from '../lib/api.mjs';

const { pos, opt } = argumente();
const [befehl, id] = pos;

const anrufCache = new Map();
async function anruf(sid) {
  if (!sid) return {};
  if (!anrufCache.has(sid)) anrufCache.set(sid, tw(`/Calls/${sid}.json`).catch(() => ({})));
  return anrufCache.get(sid);
}

// Bei einer Weiterleitung hängt die Aufnahme am Kind-Call; Anrufer steht am Eltern-Call.
async function beteiligte(rec) {
  const c = await anruf(rec.call_sid);
  const eltern = c.parent_call_sid ? await anruf(c.parent_call_sid) : null;
  return {
    anrufer: (eltern || c).from || '',
    angerufen: c.to || '',
    twilioNummer: eltern ? eltern.to : c.to,
  };
}

function zeit(iso) {
  return new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
}

async function liste() {
  const max = Number(opt.max || 20);
  const p = new URLSearchParams({ PageSize: String(Math.min(max, 100)) });
  if (opt.seit) p.set('DateCreated>', opt.seit);
  const r = await tw('/Recordings.json?' + p);
  let zeilen = await Promise.all(r.recordings.map(async rec => ({ rec, ...(await beteiligte(rec)) })));
  if (opt.nummer) {
    const z = ziffern(opt.nummer).slice(-9);
    zeilen = zeilen.filter(x => ziffern(x.anrufer).endsWith(z) || ziffern(x.angerufen).endsWith(z));
  }
  for (const { rec, anrufer, angerufen } of zeilen) {
    console.log([zeit(rec.date_created), rec.sid, `von ${anrufer}`, `an ${angerufen}`, `${rec.duration}s`, `${rec.channels} Kanal`].join(' | '));
  }
  if (!zeilen.length) console.log('Keine Aufnahmen gefunden.');
}

async function transkript(sid) {
  const rec = await tw(`/Recordings/${sid}.json`);
  const { anrufer, angerufen } = await beteiligte(rec);
  const mp3 = await tw(`/Recordings/${sid}.mp3?RequestedChannels=${rec.channels || 1}`, { roh: true });

  const form = new FormData();
  form.set('model_id', 'scribe_v2');
  form.set('language_code', 'de');
  form.set('file', new Blob([mp3], { type: 'audio/mpeg' }), `${sid}.mp3`);
  if (Number(rec.channels) === 2) {
    form.set('use_multi_channel', 'true');
    form.set('multichannel_output_style', 'combined');
  } else {
    form.set('diarize', 'true');
  }
  const r = await el('/v1/speech-to-text', { method: 'POST', form });

  // Bei Dual-Aufnahme einer Weiterleitung: Kanal 0 = Anrufer, Kanal 1 = angerufene Seite.
  const name = w => w.channel_index !== undefined
    ? (w.channel_index === 0 ? 'Anrufer' : 'Angerufen')
    : `Sprecher ${(w.speaker_id || '').replace('speaker_', '')}`;

  console.log(`# Aufnahme ${sid}\n`);
  console.log(`- Beginn: ${zeit(rec.date_created)} (Europe/Berlin), Dauer ${rec.duration}s`);
  console.log(`- Anrufer: ${anrufer}, angerufen: ${angerufen}`);
  console.log('- Transkript automatisch erstellt (scribe_v2), Namen und Zahlen können verhört sein\n');

  const woerter = (r.words || (r.transcripts || []).flatMap(t => t.words)).filter(w => w.type === 'word' || w.type === 'spacing');
  woerter.sort((a, b) => a.start - b.start);
  let aktuell = null, satz = '', start = 0;
  const raus = () => {
    if (satz.trim()) {
      const s = Math.floor(start);
      console.log(`[${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}] **${aktuell}:** ${satz.trim()}`);
    }
  };
  for (const w of woerter) {
    if (w.type !== 'word') { satz += w.text; continue; }
    const wer = name(w);
    if (wer !== aktuell) { raus(); aktuell = wer; satz = ''; start = w.start; }
    satz += w.text;
  }
  raus();
}

try {
  if (befehl === 'liste') await liste();
  else if (befehl === 'transkript' && id) await transkript(id);
  else console.log('Aufruf: liste [--seit JJJJ-MM-TT] [--nummer …] [--max N] | transkript <RE…>');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
