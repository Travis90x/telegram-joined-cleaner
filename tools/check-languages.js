#!/usr/bin/env node
// Controlla i file di lingua nella cartella languages/.
// Uso: node tools/check-languages.js
//
// Errori (exit code 1): JSON non valido, nome del file non valido, chiavi che l'inglese non ha,
// valori che non sono testo, segnaposto ({0}, {1}...) che l'inglese non ha, testi troppo lunghi.
// Avvisi: chiavi mancanti (restano in inglese) e segnaposto dell'inglese che mancano.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'languages');
const CODE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const placeholders = (s) => new Set(String(s).match(/\{\d+\}/g) || []);

let errors = 0;
let warnings = 0;
const err = (file, msg) => { errors++; console.log('ERRORE  ' + file + ': ' + msg); };
const warn = (file, msg) => { warnings++; console.log('avviso  ' + file + ': ' + msg); };

const load = (file) => {
  try { return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); }
  catch (e) { err(file, 'JSON non valido (' + e.message + ')'); return null; }
};

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
if (!files.includes('en.json')) { console.log('ERRORE  manca languages/en.json (è il riferimento)'); process.exit(1); }
const en = load('en.json');
if (!en) process.exit(1);
const enKeys = Object.keys(en);

for (const file of files) {
  const code = file.replace(/\.json$/, '');
  if (!CODE.test(code)) { err(file, 'nome non valido: usa un codice lingua minuscolo come it, fr, pt-BR'); continue; }
  const data = load(file);
  if (!data || typeof data !== 'object' || Array.isArray(data)) { if (data) err(file, 'deve essere un oggetto JSON'); continue; }
  if (typeof data._name !== 'string' || !data._name.trim()) err(file, '"_name" mancante: è il nome della lingua mostrato nel menu (es. "Français")');
  for (const key of Object.keys(data)) {
    if (!enKeys.includes(key)) { err(file, 'chiave sconosciuta "' + key + '" (non esiste in en.json)'); continue; }
    const v = data[key];
    if (typeof v !== 'string' || !v.trim()) { err(file, '"' + key + '" deve essere un testo non vuoto'); continue; }
    if (v.length > (key === '_name' ? 40 : 600)) err(file, '"' + key + '" è troppo lungo');
    if (key === '_name') continue;
    const allowed = placeholders(en[key]);
    const used = placeholders(v);
    const extra = Array.from(used).filter((p) => !allowed.has(p));
    if (extra.length) err(file, '"' + key + '" usa segnaposto che l\'inglese non ha: ' + extra.join(' '));
    const missingPh = Array.from(allowed).filter((p) => !used.has(p));
    if (missingPh.length && code !== 'en') warn(file, '"' + key + '" non usa ' + missingPh.join(' ') + ' (l\'informazione non verrà mostrata)');
  }
  const missing = enKeys.filter((k) => !(k in data));
  if (missing.length) warn(file, missing.length + ' chiavi mancanti, resteranno in inglese: ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? ', ...' : ''));
  console.log('ok      ' + file + ' (' + (enKeys.length - missing.length) + '/' + enKeys.length + ' chiavi)');
}

console.log('\n' + files.length + ' file controllati: ' + errors + ' errori, ' + warnings + ' avvisi.');
process.exit(errors ? 1 : 0);
