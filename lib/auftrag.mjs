// Auftragsdateien: YAML-artiger Kopf zwischen --- und ---, danach freier Text.
// Bewusst ohne YAML-Bibliothek: nur "schluessel: wert" je Zeile.
import { readFileSync, writeFileSync } from 'node:fs';

export function lesen(pfad) {
  const text = readFileSync(pfad, 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${pfad}: Kopf zwischen --- fehlt`);
  const kopf = {};
  for (const zeile of m[1].split('\n')) {
    const k = zeile.match(/^([a-z_]+):\s*(.*)$/);
    if (k) kopf[k[1]] = k[2].replace(/^["']|["']$/g, '').trim();
  }
  return { kopf, text: m[2].trim() };
}

export function kopfSetzen(pfad, werte) {
  const text = readFileSync(pfad, 'utf8').replace(/\r\n/g, '\n');
  const [, kopfText, rest] = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const zeilen = kopfText.split('\n');
  for (const [k, v] of Object.entries(werte)) {
    const i = zeilen.findIndex(z => z.startsWith(k + ':'));
    const neu = `${k}: ${v}`;
    if (i >= 0) zeilen[i] = neu; else zeilen.push(neu);
  }
  writeFileSync(pfad, `---\n${zeilen.join('\n')}\n---\n${rest}`);
}
