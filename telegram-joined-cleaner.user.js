// ==UserScript==
// @name         Telegram Joined Cleaner
// @namespace    https://github.com/Travis90x/telegram-joined-cleaner
// @version      0.5.0
// @description  On Telegram Web K, archives (or, after confirmation, deletes) the chats that only contain the "... joined Telegram" notice.
// @description:it  Su Telegram Web K archivia (o, dopo conferma, cancella) le chat che contengono solo l'avviso "... joined Telegram".
// @author       Travis90x
// @license      MIT
// @homepageURL  https://github.com/Travis90x/telegram-joined-cleaner
// @supportURL   https://github.com/Travis90x/telegram-joined-cleaner/issues
// @downloadURL  https://raw.githubusercontent.com/Travis90x/telegram-joined-cleaner/main/telegram-joined-cleaner.user.js
// @updateURL    https://raw.githubusercontent.com/Travis90x/telegram-joined-cleaner/main/telegram-joined-cleaner.user.js
// @match        https://web.telegram.org/k/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window.self) return;
  if (window.__telegramJoinedCleaner) return;

  const VERSION = '0.5.0';

  // ===================================================================
  // Testi di Telegram che lo script riconosce
  // Telegram Web K mostra frasi e voci di menu nella lingua scelta dall'utente nelle sue impostazioni.
  // Qui ci sono i testi INGLESI (gli unici provati a mano su Telegram vero): servono da riserva.
  // Se Telegram ha salvato nel browser il proprio pacchetto lingua, lo script ne legge i testi della
  // lingua in uso (vedi "Testi di Telegram letti dal suo pacchetto lingua") e li usa al posto di questi;
  // quelli inglesi restano comunque tra le alternative.
  // (Non c'entra con la lingua del pannello dello script: vedi languages/.)
  // ===================================================================
  const DEFAULT_TEXTS = {
    joined: [{ pre: '', post: ' joined Telegram' }], // anteprima = pre + titolo + post
    deletedAccount: ['Deleted Account'],
    archivedChats: ['Archived Chats'],
    menuArchive: ['Archive'],
    menuUnarchive: ['Unarchive'],
    menuSelect: ['Select'],
    menuDelete: ['Delete'],
    popupDeleteButton: ['Delete'],
    selectedBar: [/^(\d+) chats? selected$/], // confrontata con il testo già ripulito (vedi cleanText)
  };
  let TEXTS = DEFAULT_TEXTS; // i testi in uso: quelli di Telegram nella sua lingua, se letti, altrimenti l'inglese
  let telegramLang = { code: null, fromPack: false }; // da dove vengono i testi in uso

  const SETTINGS = {
    onlyDeletedAccounts: false, // casella nel pannello: false = solo chat con nome, true = solo "Deleted Account"
    archiveLimitPerRun: 80, // dopo ~100 archiviazioni di fila Telegram rallenta
    deleteBatchSize: 40, // provato con 38
    maxConsecutiveErrors: 3,
  };

  const state = { running: false, stop: false };

  // Esposto per i collaudi e per chi vuole guardare dalla console; viene completato più sotto.
  const debugApi = window.__telegramJoinedCleaner = { version: VERSION, settings: SETTINGS };

  // ===================================================================
  // Lingue del pannello e dei messaggi
  // L'inglese è incorporato qui sotto (serve sempre, anche senza rete, e
  // fa da riserva per le stringhe mancanti). Le altre lingue sono i file
  // languages/<codice>.json del repository: lo script legge l'elenco dei
  // file presenti nella cartella e propone nel pannello le lingue trovate.
  // Per aggiungerne una basta aggiungere un file nella cartella languages/.
  // Questa copia dell'inglese deve restare uguale a languages/en.json.
  // ===================================================================
  const REPO = 'Travis90x/telegram-joined-cleaner';
  const LANG_API = 'https://api.github.com/repos/' + REPO + '/contents/languages?ref=main';
  const LANG_RAW = 'https://raw.githubusercontent.com/' + REPO + '/main/languages/';
  const SCRIPT_URL = 'https://raw.githubusercontent.com/' + REPO + '/main/telegram-joined-cleaner.user.js';

  const EN = {
    _name: 'English',
    close: 'Close',
    lang_label: 'Language',
    ready: 'Ready.',
    opt_only_deleted: 'Only "Deleted Account" (deleted accounts only)',
    btn_dry: 'Dry run',
    btn_archive: 'Archive',
    btn_delete: 'Delete…',
    btn_stop: 'Stop',
    btn_cancel: 'Cancel',
    btn_copy: 'Copy log',
    btn_copied: 'Copied ✓',
    btn_clear: 'Clear log',
    copy_failed: 'Could not copy: select the log text by hand.',
    btn_update: 'Update languages/script',
    upd_start: 'Checking for updates…',
    upd_langs_ok: 'Languages updated: {0}.',
    upd_langs_fail: 'Cannot read the list of languages from GitHub (network blocked or limit reached): keeping the known ones.',
    upd_script_same: 'The script is up to date (version {0}).',
    upd_script_new: 'Version {0} of the script is available (you have {1}).',
    upd_script_fail: 'Cannot check the script version on GitHub.',
    upd_script_confirm: 'Update the script to version {0}? The Tampermonkey install page opens, where you must confirm.',
    upd_script_open: 'Open the update page',
    upd_script_opened: 'Update page opened. If Tampermonkey does not offer it, use "Install from URL" (see the README).',
    tg_lang_pack: 'Telegram language: {0} (the texts of Telegram are read from its own language pack).',
    tg_lang_default: 'Telegram language not read: using the English texts.',
    lang_load_failed: 'Cannot load the language "{0}": keeping the current one.',
    stop_requested: 'Stop requested…',
    busy: 'An operation is already running.',
    unexpected: 'Unexpected error: {0}',
    no_list: 'Cannot find the chat list (or more than one is in view). No action taken.',
    selection_mode: 'Telegram is in selection mode: leave the selection and try again.',
    in_archive: 'You are in the archive: go back to the main list to archive.',
    loc_main: 'main list',
    loc_archive: 'archive',
    where_main: 'in the main list',
    where_archive: 'in the archive',
    tab_suffix: ', tab «{0}»',
    archiving: 'Archiving…',
    archive_progress: 'Archived {0} (already archived {1}, errors {2})…',
    archive_summary: 'Archiving: {0}. Archived {1}, already archived {2}, errors {3}.',
    limit_hint: 'Wait a few minutes and press "{0}" again to continue.',
    error_chat: 'Error on a chat: {0}',
    r_done: 'finished',
    r_stopped: 'stopped by the user',
    r_lost: 'chat list lost',
    r_limit: 'per-run limit of {0} reached',
    r_errors: 'stopped: {0} errors in a row',
    r_list_changed: 'the open list changed',
    r_after_error: 'stopped after an error',
    w_row_not_in_view: 'row not in view',
    w_menu_item: 'menu item "{0}" not found or ambiguous',
    w_state_unchanged: 'state unchanged after the click',
    w_first_not_found: 'first chat not found',
    w_selection_off: 'selection mode not activated',
    w_covered: 'a chat is covered by another element: enlarge the window',
    w_unexpected_selected: '{0} unexpected chats selected',
    w_not_selected: '{0} chats not selected',
    w_bar_mismatch: 'the bar shows {0} selected instead of {1}',
    w_bar_missing: 'selection bar not visible',
    w_sel_differs: 'selection differs from {0}',
    w_more_missing: 'three-dots button not found',
    w_popup_missing: 'Telegram confirmation dialog not found or showing a different number',
    w_popup_btn: 'button "{0}" not unique',
    w_popup_stuck: 'after confirming, the dialog or the selection stayed open',
    del_counting: 'Counting chats {0}…',
    del_stopped_nothing: 'Stopped by the user. Nothing was deleted.',
    del_none: 'No chats to delete {0} ({1} chats seen).',
    kind_named: 'with only the "joined" notice',
    kind_deleted: 'of deleted accounts with only the "joined" notice',
    del_confirm: 'PERMANENT deletion {0}: {1} chats {2}. The other {3} chats will not be touched.',
    del_yes: 'Yes, delete {0}',
    del_cancelled: 'Deletion cancelled. Nothing was deleted.',
    del_progress: 'Deleting {0} chats… ({1} of {2} done)',
    del_error: 'Error: {0}.',
    del_selection_left: 'The selection is still active: leave it with the X at the top left before retrying.',
    del_summary: 'Deletion: {0}. Deleted {1} of {2}.',
    del_final: 'Final check: {1} "joined-only" chats of the chosen type remain {0}.',
    dry_status: 'Dry run in progress ({0})…',
    mode_named: 'named chats only',
    mode_deleted: 'only "Deleted Account"',
    dry_result: 'Dry run ({0}): {1} chats seen, {2} with only "joined" ({3} named, {4} "Deleted Account"). Current setting: {5}. Would be touched: {6}. Nothing was modified.',
    dry_nothing: 'No "joined-only" chats in this list ({0} chats seen). Possible causes: they are already archived (they disappear from the "All" tab: try the "Contacts" tab or open the archive) or the script could not read the texts of Telegram in your language (see the README).',
    dry_note: 'Note: in the "Contacts" tab already archived chats stay in the list and are counted.',
  };

  const LANG_KEY = 'telegramJoinedCleaner.lang'; // lingua scelta dall'utente
  const CACHE_PREFIX = 'telegramJoinedCleaner.cache.'; // elenco lingue e file scaricati
  const LANG_CODE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/; // it, en, pt-BR, zh-Hans...
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // elenco e file si riscaricano al massimo una volta al giorno
  const FETCH_TIMEOUT_MS = 8000;
  const MAX_PACK_CHARS = 60000;
  const MAX_LANGUAGES = 40;

  const packs = { en: EN }; // codice lingua -> stringhe già caricate e controllate
  let available = ['en']; // lingue conosciute (dalla cartella languages/ del repository)
  let lang = 'en'; // lingua in uso

  const storeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const storeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* senza storage: niente cache */ } };
  const cacheGet = (name) => {
    try { const o = JSON.parse(storeGet(CACHE_PREFIX + name)); return o && typeof o.t === 'number' ? o : null; } catch (e) { return null; }
  };
  const cacheSet = (name, data) => storeSet(CACHE_PREFIX + name, JSON.stringify({ t: Date.now(), data }));
  const isFresh = (o) => !!o && Date.now() - o.t < CACHE_TTL_MS;

  // Traduce una chiave sostituendo {0}, {1}... Se la lingua non ha la chiave, usa l'inglese.
  const tr = (key, ...args) => {
    const pack = packs[lang] || EN;
    const s = (typeof pack[key] === 'string' ? pack[key] : EN[key]) || key;
    return s.replace(/\{(\d+)\}/g, (m, i) => (args[Number(i)] === undefined ? m : String(args[Number(i)])));
  };
  // Un messaggio si descrive con M(chiave, ...parametri) e si traduce solo quando lo si mostra:
  // così il registro si riscrive nella lingua nuova se l'utente la cambia. J() incolla più pezzi.
  const M = (key, ...args) => ({ key, args });
  const J = (...parts) => ({ parts });
  const render = (d) => {
    if (d === null || d === undefined) return '';
    if (typeof d === 'string' || typeof d === 'number') return String(d);
    if (d.parts) return d.parts.map(render).join('');
    return tr(d.key, ...d.args.map(render));
  };

  const placeholders = (s) => new Set(s.match(/\{\d+\}/g) || []);

  // Un file di lingua arriva dalla rete: tengo solo le chiavi note, solo testo, con lunghezza
  // limitata e senza segnaposto che l'inglese non ha. Le stringhe mancanti restano in inglese.
  function sanitizePack(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    try { if (JSON.stringify(data).length > MAX_PACK_CHARS) return null; } catch (e) { return null; }
    const pack = {};
    let count = 0;
    for (const key of Object.keys(EN)) {
      const v = data[key];
      if (key === '_name') { if (typeof v === 'string' && v.trim() && v.length <= 40) pack._name = v.trim(); continue; }
      if (typeof v !== 'string' || !v || v.length > 600) continue;
      const allowed = placeholders(EN[key]);
      if (Array.from(placeholders(v)).some((p) => !allowed.has(p))) continue;
      pack[key] = v;
      count++;
    }
    return count > 0 ? pack : null;
  }

  async function getBody(url, kind) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS) : null;
    try {
      // niente cookie e niente indirizzo della pagina di Telegram verso GitHub
      const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl ? ctl.signal : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return kind === 'text' ? await r.text() : await r.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  const getJson = (url) => getBody(url, 'json');
  const getText = (url) => getBody(url, 'text');

  const setAvailable = (codes) => {
    const set = new Set(['en']);
    for (const c of codes) if (typeof c === 'string' && LANG_CODE.test(c)) set.add(c);
    available = Array.from(set).slice(0, MAX_LANGUAGES + 1).sort();
  };

  // Elenco delle lingue = file .json nella cartella languages/ del repository (GitHub API).
  // Restituisce null se non raggiungibile e non c'è nemmeno una copia in cache.
  const listCodes = (items) => (Array.isArray(items) ? items : [])
    .filter((i) => i && i.type === 'file' && typeof i.name === 'string')
    .map((i) => (/^(.+)\.json$/.exec(i.name) || [])[1])
    .filter((c) => c && LANG_CODE.test(c))
    .slice(0, MAX_LANGUAGES);

  async function loadAvailable() {
    const cached = cacheGet('list');
    if (isFresh(cached) && Array.isArray(cached.data)) return cached.data;
    try {
      const codes = listCodes(await getJson(LANG_API));
      if (codes.length) { cacheSet('list', codes); return codes; }
    } catch (e) { /* rete bloccata o limite di GitHub: uso la copia in cache */ }
    return cached && Array.isArray(cached.data) ? cached.data : null;
  }

  // Carica le stringhe di una lingua: memoria, cache fresca, rete, cache scaduta. null se non riesce.
  async function loadPack(code, refreshIfStale) {
    if (code === 'en') return EN;
    const cached = cacheGet('pack.' + code);
    if (packs[code] && !(refreshIfStale && !isFresh(cached))) return packs[code];
    if (isFresh(cached)) { const p = sanitizePack(cached.data); if (p) return (packs[code] = p); }
    try {
      const data = await getJson(LANG_RAW + code + '.json');
      const p = sanitizePack(data);
      if (p) { cacheSet('pack.' + code, data); return (packs[code] = p); }
    } catch (e) { /* uso la copia in cache, se c'è */ }
    const old = cached && sanitizePack(cached.data);
    if (old) return (packs[code] = old);
    return packs[code] || null;
  }

  // Aggiornamento forzato (pulsante del pannello): legge subito l'elenco da GitHub ignorando la cache e riscarica la
  // lingua in uso. Se l'elenco non è raggiungibile solleva un errore e lascia la cache com'era.
  async function refreshLanguages() {
    const codes = listCodes(await getJson(LANG_API));
    if (!codes.length) throw new Error('empty list');
    cacheSet('list', codes);
    setAvailable(codes);
    // le altre lingue si riscaricheranno quando servono
    for (const c of Object.keys(packs)) if (c !== 'en' && c !== lang) delete packs[c];
    try {
      Object.keys(localStorage)
        .filter((k) => k.indexOf(CACHE_PREFIX + 'pack.') === 0 && k !== CACHE_PREFIX + 'pack.' + lang)
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* senza storage non c'è cache da svuotare */ }
    if (lang !== 'en') {
      if (available.indexOf(lang) < 0) { lang = 'en'; return; } // lingua tolta dal repository
      try {
        const data = await getJson(LANG_RAW + lang + '.json');
        const p = sanitizePack(data);
        if (p) { cacheSet('pack.' + lang, data); packs[lang] = p; }
      } catch (e) { /* resto con le stringhe che ho */ }
    }
  }

  // Versione dello script pubblicata su GitHub (riga @version del file), oppure null.
  async function fetchRemoteVersion() {
    const text = await getText(SCRIPT_URL);
    const m = /\/\/\s*@version\s+(\S+)/.exec(text);
    return m && /^\d+(\.\d+){1,3}$/.test(m[1]) ? m[1] : null;
  }
  const cmpVersions = (a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (x[i] || 0) - (y[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  };

  const intlName = (code) => {
    try {
      const n = new Intl.DisplayNames([code], { type: 'language' }).of(code);
      return n ? n.charAt(0).toLocaleUpperCase(code) + n.slice(1) : code;
    } catch (e) { return code; }
  };
  const langName = (code) => (packs[code] && packs[code]._name) || intlName(code);

  // Lingua che corrisponde a quella del browser (it-IT -> it-IT, poi it), altrimenti l'inglese.
  function pickByBrowser(list) {
    const wanted = navigator.languages && navigator.languages.length ? Array.from(navigator.languages) : [navigator.language || 'en'];
    for (const w of wanted) {
      const lw = String(w).toLowerCase();
      const exact = list.find((c) => c.toLowerCase() === lw);
      if (exact) return exact;
      const base = lw.split('-')[0];
      const near = list.find((c) => c.toLowerCase() === base) || list.find((c) => c.toLowerCase().split('-')[0] === base);
      if (near) return near;
    }
    return 'en';
  }

  // Con una versione nuova dello script la cache delle lingue si svuota: così le lingue aggiunte o corrette nel
  // frattempo compaiono subito, senza aspettare le 24 ore.
  (function resetCacheOnNewVersion() {
    if (storeGet(CACHE_PREFIX + 'version') === VERSION) return;
    try {
      Object.keys(localStorage).filter((k) => k.indexOf(CACHE_PREFIX) === 0).forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* senza storage non c'è cache */ }
    storeSet(CACHE_PREFIX + 'version', VERSION);
  })();

  const storedLang = (() => { const v = storeGet(LANG_KEY); return v && LANG_CODE.test(v) ? v : null; })();

  // Partenza senza rete: se l'elenco e la lingua scelta sono già in cache le uso subito (niente lampo in inglese).
  (function startFromCache() {
    const list = cacheGet('list');
    if (list && Array.isArray(list.data)) setAvailable(list.data);
    const initial = storedLang && available.indexOf(storedLang) >= 0 ? storedLang : pickByBrowser(available);
    if (initial === 'en') return;
    const c = cacheGet('pack.' + initial);
    const p = c && sanitizePack(c.data);
    if (p) { packs[initial] = p; lang = initial; }
  })();

  // ===================================================================
  // Utilità
  // ===================================================================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const isShown = (el) => {
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  };
  const isInView = (el) => {
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth;
  };
  // Le voci di menu iniziano con un'icona (un carattere speciale) e le frasi possono avere simboli e punteggiatura:
  // prima di confrontare tengo solo lettere, numeri e spazi di qualsiasi alfabeto.
  const cleanText = (s) => (s || '').replace(/[^\p{L}\p{M}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  // Solo spazi e caratteri invisibili (per confrontare le anteprime, dove la punteggiatura conta).
  const wsClean = (s) => (s || '').replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  const asList = (x) => (Array.isArray(x) ? x : [x]);

  const jump = (el, top) => {
    try { el.scrollTo({ top, behavior: 'instant' }); } catch (e) { el.scrollTop = top; }
  };
  const centerRow = (row) => {
    try { row.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e) { row.scrollIntoView({ block: 'center' }); }
  };

  const rowsIn = (c) => c.querySelectorAll('a[data-peer-id]');
  const rowSelector = (id) => 'a[data-peer-id="' + id + '"]'; // gli id che usiamo sono solo numerici
  const rowId = (a) => a.getAttribute('data-peer-id');
  const rowTitle = (a) => ((a.querySelector('.peer-title') || {}).textContent || '').trim();
  const rowPreview = (a) => ((a.querySelector('.dialog-subtitle') || {}).textContent || '').trim();

  // Chat con un utente (id positivo) la cui anteprima è SOLO "<titolo> joined Telegram".
  // Attenzione: si basa solo sull'anteprima dell'ultimo messaggio.
  const isJoinedRow = (a) => {
    const t = rowTitle(a);
    const s = wsClean(rowPreview(a));
    return /^\d+$/.test(rowId(a)) && t.length > 0 && TEXTS.joined.some((j) => s === wsClean(j.pre + t + j.post));
  };
  const isDeletedTitle = (t) => TEXTS.deletedAccount.indexOf(t) >= 0;
  // Con la casella spenta si trattano solo le chat con nome; accesa, solo quelle di account eliminati.
  const isWantedTitle = (t) => isDeletedTitle(t) === SETTINGS.onlyDeletedAccounts;
  const isTargetRow = (a) => isJoinedRow(a) && isWantedTitle(rowTitle(a));

  // La lista in vista: deve essercene UNA sola, altrimenti non si procede.
  function findScroller() {
    let c = Array.from(document.querySelectorAll('.scrollable-y')).filter((x) => Array.from(rowsIn(x)).some(isInView));
    if (c.length > 1) c = c.filter((x) => x.classList.contains('chatlist-parts'));
    return c.length === 1 ? c[0] : null;
  }

  function isArchiveOpen() {
    const want = TEXTS.archivedChats.map(cleanText);
    return Array.from(document.querySelectorAll('span, div, h1, h2, h3')).some(
      (el) => el.childElementCount === 0 && !el.closest('.btn-menu') && isShown(el) && want.indexOf(cleanText(el.textContent)) >= 0
    );
  }

  // Nome della scheda (cartella) attiva, per esempio "All" o "Contacts": serve solo a informare l'utente.
  // Se la struttura della pagina non è quella attesa restituisce una stringa vuota.
  function activeTabName() {
    try {
      const el = Array.from(document.querySelectorAll('.menu-horizontal-div-item')).find((e) => e.classList.contains('active') && isShown(e));
      if (!el) return '';
      const label = el.querySelector('.text-super');
      const name = label ? label.textContent : el.textContent.replace(/\s*\d+\s*$/, '');
      return name.trim().slice(0, 30);
    } catch (e) { return ''; }
  }

  const selectionBar = () => Array.from(document.querySelectorAll('.chatlist-selection-header')).find(isShown) || null;
  const selectionCount = () => {
    const b = selectionBar();
    if (!b) return 0;
    const text = cleanText(b.textContent);
    for (const re of TEXTS.selectedBar) {
      const m = re.exec(text);
      if (m) return Number(m[1]);
    }
    return 0;
  };

  // ===================================================================
  // Testi di Telegram letti dal suo pacchetto lingua
  // Telegram Web K salva nel browser (IndexedDB "tweb-common", archivio "session", chiave "langPack") il pacchetto
  // con tutte le sue frasi nella lingua scelta nelle impostazioni, anche prima del primo accesso. Da lì lo script
  // prende i testi che gli servono (avviso "joined Telegram", Archive, Select, Delete...): così funziona con
  // qualsiasi lingua di Telegram senza tradurli a mano. Si legge e basta, non si scrive niente e non si invia
  // niente. Se la lettura non riesce (browser senza indexedDB.databases(), struttura cambiata...) restano i testi inglesi.
  // ===================================================================
  // In certi browser e contesti IndexedDB può non rispondere mai: la lettura ha un limite di tempo.
  // Restituisce il pacchetto, null se non c'è o non si può leggere, undefined se non ha risposto in tempo.
  function readTelegramLangPack() {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(undefined), IDB_TIMEOUT_MS);
      readTelegramLangPackNow().then(
        (v) => { clearTimeout(timer); resolve(v); },
        () => { clearTimeout(timer); resolve(null); }
      );
    });
  }

  async function readTelegramLangPackNow() {
    try {
      if (!window.indexedDB || typeof indexedDB.databases !== 'function') return null;
      const dbs = await indexedDB.databases();
      if (!dbs.some((d) => d && d.name === 'tweb-common')) return null; // non lo creo io se non esiste
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('tweb-common');
        req.onupgradeneeded = () => { try { req.transaction.abort(); } catch (e) { /* niente da fare */ } };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('blocked'));
      });
      try {
        if (!db.objectStoreNames.contains('session')) return null;
        return await new Promise((resolve, reject) => {
          const r = db.transaction('session', 'readonly').objectStore('session').get('langPack');
          r.onsuccess = () => resolve(r.result || null);
          r.onerror = () => reject(r.error);
        });
      } finally {
        db.close();
      }
    } catch (e) {
      return null;
    }
  }

  const IDB_TIMEOUT_MS = 3000;
  const uniqueTexts = (arr) => Array.from(new Set(arr.filter((x) => typeof x === 'string' && x.trim())));
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Costruisce i testi in uso dal pacchetto lingua; null se il pacchetto non ha la forma attesa.
  function textsFromPack(pack) {
    if (!pack || !Array.isArray(pack.strings) || pack.strings.length < 100) return null;
    const by = new Map();
    // Il pacchetto contiene prima le frasi inglesi e poi quelle della lingua scelta: l'ultima occorrenza vince.
    for (const s of pack.strings) if (s && typeof s.key === 'string') by.set(s.key, s);
    const one = (key) => {
      const s = by.get(key);
      return s && typeof s.value === 'string' && s.value.trim() ? s.value.trim() : null;
    };
    const forms = (key) => {
      const s = by.get(key);
      return s ? ['zero_value', 'one_value', 'two_value', 'few_value', 'many_value', 'other_value'].map((f) => s[f]).filter((v) => typeof v === 'string' && v.trim()) : [];
    };
    const label = (key, fallback) => uniqueTexts([one(key)].concat(fallback));

    const T = {
      joined: DEFAULT_TEXTS.joined.slice(),
      deletedAccount: label('HiddenName', DEFAULT_TEXTS.deletedAccount),
      archivedChats: label('ArchivedChats', DEFAULT_TEXTS.archivedChats),
      menuArchive: label('Archive', DEFAULT_TEXTS.menuArchive),
      menuUnarchive: label('Unarchive', DEFAULT_TEXTS.menuUnarchive),
      menuSelect: label('Message.Context.Select', DEFAULT_TEXTS.menuSelect),
      menuDelete: label('Delete', DEFAULT_TEXTS.menuDelete),
      popupDeleteButton: label('Delete', DEFAULT_TEXTS.popupDeleteButton),
      selectedBar: [],
    };
    // "%@ joined Telegram": il nome può stare all'inizio, in mezzo o alla fine, a seconda della lingua.
    const j = one('Chat.Service.PeerJoinedTelegram');
    const m = j && /%(?:\d+\$)?[@s]/.exec(j);
    if (m) T.joined.unshift({ pre: j.slice(0, m.index), post: j.slice(m.index + m[0].length) });
    // "%d chat selected" / "%d chats selected": una forma per ogni plurale della lingua.
    for (const f of forms('ChatsSelected')) {
      const parts = f.split(/%(?:\d+\$)?d/);
      if (parts.length === 2) T.selectedBar.push(new RegExp('^' + parts.map((p) => escapeRe(cleanText(p))).join('\\s*(\\d+)\\s*') + '$'));
    }
    T.selectedBar = T.selectedBar.concat(DEFAULT_TEXTS.selectedBar);
    return T;
  }

  let lastPackSignature = null;
  // Rilegge il pacchetto lingua di Telegram (la lingua può cambiare mentre la pagina è aperta) e aggiorna TEXTS.
  async function refreshTexts() {
    const pack = await readTelegramLangPack();
    if (pack === undefined) return; // nessuna risposta in tempo: tengo i testi che ho e riprovo alla prossima operazione
    const signature = pack ? [pack.lang_code, pack.version, pack.strings && pack.strings.length].join(':') : 'none';
    if (signature === lastPackSignature) return;
    lastPackSignature = signature;
    const T = textsFromPack(pack);
    if (T) { TEXTS = T; telegramLang = { code: String(pack.lang_code || '?'), fromPack: true }; }
    else { TEXTS = DEFAULT_TEXTS; telegramLang = { code: null, fromPack: false }; }
  }

  // ===================================================================
  // Menu
  // ===================================================================
  const contextMenus = () => Array.from(document.querySelectorAll('.btn-menu.contextmenu')).filter((m) => m.classList.contains('active') && isShown(m));
  const activeMenus = () => Array.from(document.querySelectorAll('.btn-menu')).filter((m) => m.classList.contains('active') && isShown(m));
  const menuItems = (menus) => menus.flatMap((m) => Array.from(m.querySelectorAll('.btn-menu-item')).filter(isShown));
  // Voci di menu il cui testo (ripulito) è uno dei testi attesi; `labels` è un testo o un elenco di alternative.
  const byLabel = (items, labels) => {
    const want = asList(labels).map(cleanText);
    return items.filter((i) => want.indexOf(cleanText(i.textContent)) >= 0);
  };

  // Non si usa il tasto Esc: su Telegram Web K ha aperto la ricerca globale.
  async function closeMenus() {
    for (let k = 0; k < 3 && activeMenus().length; k++) {
      for (const t of ['mousedown', 'mouseup', 'click']) {
        document.body.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, clientX: innerWidth - 40, clientY: innerHeight / 2 }));
      }
      await sleep(500);
    }
  }

  // Apre il menu contestuale della riga. null = riga non in vista; [] = voci attese non comparse.
  async function openMenuOn(row, labels) {
    await closeMenus();
    centerRow(row);
    await sleep(450);
    const r = row.getBoundingClientRect();
    // Riga ben al centro, oppure (prime e ultime righe, che non si possono centrare) tutta dentro la lista.
    const sr = (row.closest('.scrollable-y') || document.body).getBoundingClientRect();
    const centered = r.top >= 120 && r.bottom <= innerHeight - 20;
    const inside = r.top >= sr.top && r.bottom <= sr.bottom + 1;
    if (!centered && !inside) return null;
    row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, composed: true, view: window,
      clientX: r.x + Math.min(r.width / 2, 150), clientY: r.y + r.height / 2, button: 2, buttons: 2,
    }));
    const want = asList(labels).map(cleanText);
    for (let i = 0; i < 25; i++) {
      await sleep(120);
      const items = menuItems(contextMenus());
      if (items.some((it) => want.indexOf(cleanText(it.textContent)) >= 0)) return items;
    }
    return [];
  }

  // ===================================================================
  // Scansione (sola lettura)
  // ===================================================================
  // Scorre la lista dall'alto al basso e restituisce Map id -> {title, joined}.
  async function scanList(sc) {
    jump(sc, 0);
    await sleep(700);
    const rows = new Map();
    let y = 0;
    let lastHeight = 0;
    let stableEnd = 0;
    for (let guard = 0; guard < 600 && !state.stop; guard++) {
      for (const a of rowsIn(sc)) rows.set(rowId(a), { title: rowTitle(a), joined: isJoinedRow(a) });
      const maxY = sc.scrollHeight - sc.clientHeight;
      if (y >= maxY) {
        await sleep(1200); // in fondo: aspetto che Telegram carichi altre chat
        if (sc.scrollHeight === lastHeight) { if (++stableEnd >= 2) break; } else stableEnd = 0;
        lastHeight = sc.scrollHeight;
        if (sc.scrollHeight - sc.clientHeight <= y) continue;
      }
      y = Math.min(y + 450, sc.scrollHeight - sc.clientHeight);
      jump(sc, y);
      await sleep(300);
    }
    jump(sc, 0);
    return rows;
  }

  // ===================================================================
  // Archiviazione
  // ===================================================================
  async function archiveRow(sc, row) {
    const id = rowId(row);
    const items = await openMenuOn(row, [].concat(TEXTS.menuArchive, TEXTS.menuUnarchive));
    if (!items) return { ok: false, id, why: M('w_row_not_in_view') };
    const arch = byLabel(items, TEXTS.menuArchive);
    const unarch = byLabel(items, TEXTS.menuUnarchive);
    if (!arch.length && unarch.length) { await closeMenus(); return { skip: true, id }; }
    if (arch.length !== 1) { await closeMenus(); return { ok: false, id, why: M('w_menu_item', TEXTS.menuArchive[0]) }; }
    arch[0].click();
    await sleep(1800);
    const still = sc.querySelector(rowSelector(id));
    if (!still) return { ok: true, id }; // nella scheda "All" la riga sparisce
    // nella scheda "Contacts" la riga resta: controllo che il menu ora offra "Unarchive"
    const items2 = await openMenuOn(still, [].concat(TEXTS.menuArchive, TEXTS.menuUnarchive));
    const done = !!items2 && byLabel(items2, TEXTS.menuUnarchive).length === 1 && byLabel(items2, TEXTS.menuArchive).length === 0;
    await closeMenus();
    return done ? { ok: true, id } : { ok: false, id, why: M('w_state_unchanged') };
  }

  async function archiveRun() {
    if (isArchiveOpen()) { ui.log(M('in_archive')); return; }
    if (selectionBar()) { ui.log(M('selection_mode')); return; }
    if (!findScroller()) { ui.log(M('no_list')); return; }

    const S = { archived: 0, skipped: 0, failed: 0, consecutive: 0 };
    const doneIds = new Set(); // archiviate o già archiviate: non si ripassano
    let reason = M('r_done');
    ui.setStatus(M('archiving'));

    passes:
    for (let pass = 1; pass <= 3; pass++) {
      if (state.stop) { reason = M('r_stopped'); break; }
      let sc = findScroller();
      if (!sc) { reason = M('r_lost'); break; }
      jump(sc, 0);
      await sleep(900);
      const failedThisPass = new Set();
      let progress = 0;
      let lastHeight = 0;
      let stableEnd = 0;

      for (let guard = 0; guard < 6000; guard++) {
        if (state.stop) { reason = M('r_stopped'); break passes; }
        sc = findScroller();
        if (!sc) { reason = M('r_lost'); break passes; }

        let row = null;
        for (const a of rowsIn(sc)) {
          const id = rowId(a);
          if (doneIds.has(id) || failedThisPass.has(id)) continue;
          if (isTargetRow(a)) { row = a; break; }
        }

        if (row) {
          if (S.archived >= SETTINGS.archiveLimitPerRun) { reason = M('r_limit', SETTINGS.archiveLimitPerRun); break passes; }
          const id = rowId(row);
          const res = await archiveRow(sc, row);
          if (res.skip) { S.skipped++; doneIds.add(id); }
          else if (res.ok) { S.archived++; progress++; S.consecutive = 0; doneIds.add(id); }
          else {
            S.failed++; S.consecutive++; failedThisPass.add(id);
            ui.log(M('error_chat', res.why));
            if (S.consecutive >= SETTINGS.maxConsecutiveErrors) { reason = M('r_errors', S.consecutive); break passes; }
          }
          ui.setStatus(M('archive_progress', S.archived, S.skipped, S.failed));
          continue;
        }

        // nessuna chat da trattare tra quelle in vista: scorro di poco e riprovo
        const before = sc.scrollTop;
        jump(sc, sc.scrollTop + Math.round(sc.clientHeight * 0.6));
        await sleep(600);
        const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 5;
        if (atBottom || sc.scrollTop === before) {
          await sleep(1500);
          if (sc.scrollHeight === lastHeight) { if (++stableEnd >= 2) break; } else stableEnd = 0;
          lastHeight = sc.scrollHeight;
        } else stableEnd = 0;
      }
      if (progress === 0) break;
    }

    await closeMenus();
    ui.log(M('archive_summary', reason, S.archived, S.skipped, S.failed));
    if (reason.key === 'r_limit') ui.log(M('limit_hint', M('btn_archive')));
  }

  // ===================================================================
  // Cancellazione (definitiva, solo dopo conferma nel pannello): dalla lista aperta,
  // che sia l'archivio o la lista principale.
  // ===================================================================
  async function bringIntoView(sc, id) {
    let row = sc.querySelector(rowSelector(id));
    if (!row) {
      jump(sc, 0);
      await sleep(600);
      let y = 0;
      for (let g = 0; g < 600 && !row; g++) {
        row = sc.querySelector(rowSelector(id));
        if (row) break;
        const maxY = sc.scrollHeight - sc.clientHeight;
        if (y >= maxY) break;
        y = Math.min(y + 450, maxY);
        jump(sc, y);
        await sleep(300);
      }
    }
    if (!row) return null;
    centerRow(row);
    await sleep(450);
    return row;
  }

  // Le prime `limit` chat da cancellare, nell'ordine in cui compaiono.
  async function collectTargets(sc, limit) {
    jump(sc, 0);
    await sleep(700);
    const ids = [];
    let y = 0;
    let lastHeight = 0;
    let stableEnd = 0;
    for (let guard = 0; guard < 600 && !state.stop; guard++) {
      for (const a of rowsIn(sc)) {
        if (isTargetRow(a) && ids.indexOf(rowId(a)) < 0) { ids.push(rowId(a)); if (ids.length >= limit) return ids; }
      }
      const maxY = sc.scrollHeight - sc.clientHeight;
      if (y >= maxY) {
        await sleep(1200);
        if (sc.scrollHeight === lastHeight) { if (++stableEnd >= 2) break; } else stableEnd = 0;
        lastHeight = sc.scrollHeight;
        if (sc.scrollHeight - sc.clientHeight <= y) continue;
      }
      y = Math.min(y + 350, sc.scrollHeight - sc.clientHeight);
      jump(sc, y);
      await sleep(400);
    }
    return ids;
  }

  // Un clic "vero" su una riga in modalità selezione (a.click() da solo non basta).
  async function pressRow(row) {
    const r = row.getBoundingClientRect();
    const cx = r.x + Math.min(r.width / 2, 150);
    const cy = r.y + r.height / 2;
    const target = document.elementFromPoint(cx, cy);
    if (!target || !row.contains(target)) return false; // qualcosa copre la riga (es. il pannello)
    const mk = (type, C) => new C(type, {
      bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0,
      buttons: type === 'mouseup' || type === 'click' || type === 'pointerup' ? 0 : 1,
      pointerId: 1, pointerType: 'mouse', isPrimary: true,
    });
    for (const [t, C] of [['pointerdown', PointerEvent], ['mousedown', MouseEvent], ['pointerup', PointerEvent], ['mouseup', MouseEvent], ['click', MouseEvent]]) {
      target.dispatchEvent(mk(t, C));
      await sleep(35);
    }
    await sleep(150);
    return true;
  }

  // Clic completo (pointer, mouse e click) su un pulsante: certi controlli di Telegram Web K, per esempio i tre puntini
  // della barra di selezione, si aprono così e non con el.click() (verificato sul Telegram vero).
  async function pressElement(el) {
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const target = hit && (hit === el || el.contains(hit)) ? hit : el;
    for (const [t, C] of [['pointerdown', PointerEvent], ['mousedown', MouseEvent], ['pointerup', PointerEvent], ['mouseup', MouseEvent], ['click', MouseEvent]]) {
      target.dispatchEvent(new C(t, {
        bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0,
        buttons: t === 'mouseup' || t === 'click' || t === 'pointerup' ? 0 : 1, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      }));
      await sleep(35);
    }
    await sleep(150);
  }

  // Esce dalla modalità selezione con la "X" della barra (button.close, verificata sul Telegram vero).
  async function cancelSelection() {
    const bar = selectionBar();
    if (!bar) return true;
    const x = bar.querySelector('button.close, .sidebar-close-button');
    if (x) { await pressElement(x); await sleep(900); }
    return !selectionBar();
  }

  const isSelectedRow = (a) => /selected/.test(a.className);

  // Insieme degli id selezionati, leggendo tutta la lista.
  async function readSelectedIds(sc) {
    jump(sc, 0);
    await sleep(600);
    const sel = new Set();
    let y = 0;
    for (let g = 0; g < 600; g++) {
      for (const a of rowsIn(sc)) if (isSelectedRow(a)) sel.add(rowId(a));
      const maxY = sc.scrollHeight - sc.clientHeight;
      if (y >= maxY) break;
      y = Math.min(y + 400, maxY);
      jump(sc, y);
      await sleep(300);
    }
    jump(sc, 0);
    return sel;
  }

  // Seleziona esattamente le chat in `ids`. Restituisce {ok, why}.
  async function selectRows(sc, ids) {
    const want = new Set(ids);
    const first = await bringIntoView(sc, ids[0]);
    if (!first) return { ok: false, why: M('w_first_not_found') };
    const items = await openMenuOn(first, TEXTS.menuSelect);
    const sel = items ? byLabel(items, TEXTS.menuSelect) : [];
    if (sel.length !== 1) { await closeMenus(); return { ok: false, why: M('w_menu_item', TEXTS.menuSelect[0]) }; }
    sel[0].click();
    await sleep(900);
    if (selectionCount() < 1) return { ok: false, why: M('w_selection_off') };

    for (let round = 0; round < 3; round++) {
      if (state.stop) return { ok: false, why: M('r_stopped') };
      const have = await readSelectedIds(sc);
      const missing = ids.filter((id) => !have.has(id));
      if (missing.length === 0) break;
      for (const id of missing) {
        const row = await bringIntoView(sc, id);
        if (!row) continue;
        if (!(await pressRow(row))) return { ok: false, why: M('w_covered') };
      }
    }

    const final = await readSelectedIds(sc);
    const extra = Array.from(final).filter((id) => !want.has(id));
    const missing = ids.filter((id) => !final.has(id));
    if (extra.length) return { ok: false, why: M('w_unexpected_selected', extra.length) };
    if (missing.length) return { ok: false, why: M('w_not_selected', missing.length) };
    if (selectionCount() !== ids.length) return { ok: false, why: M('w_bar_mismatch', selectionCount(), ids.length) };
    return { ok: true };
  }

  // Dalla barra di selezione: tre puntini > Delete > conferma nella finestra di Telegram.
  async function deleteSelected(n) {
    const bar = selectionBar();
    if (!bar) return { ok: false, why: M('w_bar_missing') };
    if (selectionCount() !== n) return { ok: false, why: M('w_sel_differs', n) };
    const more = Array.from(bar.querySelectorAll('.btn-menu-toggle')).filter(isShown)[0];
    if (!more) return { ok: false, why: M('w_more_missing') };
    await closeMenus();
    // I tre puntini si aprono con il clic completo; se non basta provo anche con .click()
    let del = [];
    for (const how of ['press', 'click']) {
      if (how === 'press') await pressElement(more); else more.click();
      for (let i = 0; i < 12 && !del.length; i++) {
        await sleep(150);
        del = byLabel(menuItems(activeMenus()), TEXTS.menuDelete);
      }
      if (del.length) break;
      await closeMenus();
    }
    if (del.length !== 1) { await closeMenus(); return { ok: false, why: M('w_menu_item', TEXTS.menuDelete[0]) }; }
    del[0].click();
    await sleep(1000);

    const popups = Array.from(document.querySelectorAll('.popup')).filter(isShown);
    const popup = popups.find((p) => {
      // Il titolo ("Delete 38 chats" in inglese) cambia con la lingua: controllo che contenga il numero atteso.
      const title = cleanText((p.querySelector('.popup-title') || {}).textContent);
      return n === 1 || new RegExp('(^|\\D)' + n + '(\\D|$)').test(title);
    });
    if (!popup) return { ok: false, why: M('w_popup_missing') };
    const btns = byLabel(Array.from(popup.querySelectorAll('.popup-button, button')).filter(isShown), TEXTS.popupDeleteButton);
    if (btns.length !== 1) return { ok: false, why: M('w_popup_btn', TEXTS.popupDeleteButton[0]) };
    btns[0].click();

    for (let i = 0; i < 40; i++) { // fino a 8 s
      await sleep(200);
      if (!Array.from(document.querySelectorAll('.popup')).some(isShown) && !selectionBar()) return { ok: true };
    }
    return { ok: false, why: M('w_popup_stuck') };
  }

  // Passo 1: conta (senza toccare niente). Passo 2: conferma nel pannello. Passo 3: cancella a gruppi.
  async function deleteRun() {
    const inArchive = isArchiveOpen();
    const tab = inArchive ? '' : activeTabName();
    const whereKey = inArchive ? 'where_archive' : 'where_main';
    const where = tab ? J(M(whereKey), M('tab_suffix', tab)) : M(whereKey);
    if (selectionBar()) { ui.log(M('selection_mode')); return; }
    let sc = findScroller();
    if (!sc) { ui.log(M('no_list')); return; }

    ui.setStatus(M('del_counting', where));
    const rows = await scanList(sc);
    if (state.stop) { ui.log(M('del_stopped_nothing')); return; }
    const all = Array.from(rows.values());
    const targets = all.filter((v) => v.joined && isWantedTitle(v.title)).length;
    const others = all.length - targets;
    if (targets === 0) { ui.log(M('del_none', where, all.length)); return; }

    const kind = M(SETTINGS.onlyDeletedAccounts ? 'kind_deleted' : 'kind_named');
    const ok = await ui.confirm(M('del_confirm', where, targets, kind, others), M('del_yes', targets));
    if (!ok) { ui.log(M('del_cancelled')); return; }

    let remaining = targets;
    let deleted = 0;
    let consecutive = 0;
    let reason = M('r_done');
    while (remaining > 0) {
      if (state.stop) { reason = M('r_stopped'); break; }
      if (isArchiveOpen() !== inArchive) { reason = M('r_list_changed'); break; }
      sc = findScroller();
      if (!sc) { reason = M('r_lost'); break; }
      const ids = await collectTargets(sc, Math.min(SETTINGS.deleteBatchSize, remaining));
      if (ids.length === 0) break;
      ui.setStatus(M('del_progress', ids.length, deleted, targets));

      let res = await selectRows(sc, ids);
      if (res.ok) res = await deleteSelected(ids.length);
      if (res.ok) { deleted += ids.length; remaining -= ids.length; consecutive = 0; }
      else {
        consecutive++;
        ui.log(M('del_error', res.why));
        await closeMenus();
        // esco io dalla selezione; solo se non ci riesco chiedo di farlo a mano
        if (selectionBar() && !(await cancelSelection())) ui.log(M('del_selection_left'));
        if (consecutive >= SETTINGS.maxConsecutiveErrors || selectionBar()) { reason = M('r_after_error'); break; }
      }
      await sleep(2000);
    }

    await closeMenus();
    ui.log(M('del_summary', reason, deleted, targets));
    sc = findScroller();
    if (sc) {
      const after = await scanList(sc);
      const left = Array.from(after.values()).filter((v) => v.joined && isWantedTitle(v.title)).length;
      ui.log(M('del_final', where, left));
    }
  }

  // ===================================================================
  // Prova: solo lettura
  // ===================================================================
  async function dryRun() {
    const sc = findScroller();
    if (!sc) { ui.log(M('no_list')); return; }
    const inArchive = isArchiveOpen();
    const tab = inArchive ? '' : activeTabName();
    const locKey = inArchive ? 'loc_archive' : 'loc_main';
    const where = tab ? J(M(locKey), M('tab_suffix', tab)) : M(locKey);
    ui.setStatus(M('dry_status', where));
    ui.log(telegramLang.fromPack ? M('tg_lang_pack', telegramLang.code) : M('tg_lang_default'));
    const rows = await scanList(sc);
    const all = Array.from(rows.values());
    const joined = all.filter((v) => v.joined);
    const deletedAcc = joined.filter((v) => isDeletedTitle(v.title)).length;
    const targets = joined.filter((v) => isWantedTitle(v.title)).length;
    const mode = M(SETTINGS.onlyDeletedAccounts ? 'mode_deleted' : 'mode_named');
    ui.log(M('dry_result', where, all.length, joined.length, joined.length - deletedAcc, deletedAcc, mode, targets));
    if (all.length > 0 && joined.length === 0) ui.log(M('dry_nothing', all.length));
    if (!inArchive) ui.log(M('dry_note'));
  }

  // ===================================================================
  // Aggiornamento di lingue e script (pulsante del pannello)
  // ===================================================================
  // Rilegge subito le lingue da GitHub e controlla se c'è una versione nuova dello script. Lo script non si
  // installa da solo: se c'è una versione nuova, dopo la tua conferma apre la pagina di installazione di
  // Tampermonkey (l'indirizzo del file .user.js), dove confermi tu.
  async function updateRun() {
    ui.setStatus(M('upd_start'));
    try {
      await refreshLanguages();
      ui.log(M('upd_langs_ok', available.map(langName).join(', ')));
    } catch (e) {
      ui.log(M('upd_langs_fail'));
    }
    ui.refreshLanguages();

    let remote = null;
    try { remote = await fetchRemoteVersion(); } catch (e) { remote = null; }
    if (!remote) { ui.log(M('upd_script_fail')); return; }
    if (cmpVersions(remote, VERSION) <= 0) { ui.log(M('upd_script_same', VERSION)); return; }
    ui.log(M('upd_script_new', remote, VERSION));
    const ok = await ui.confirm(M('upd_script_confirm', remote), M('upd_script_open'));
    if (!ok) return;
    window.open(SCRIPT_URL, '_blank', 'noopener');
    ui.log(M('upd_script_opened'));
  }

  // ===================================================================
  // Pannello
  // ===================================================================
  const ui = (function buildPanel() {
    const host = document.createElement('div');
    host.id = 'telegram-joined-cleaner';
    host.style.cssText = 'position:fixed;right:16px;bottom:96px;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = [
      '<style>',
      ':host{all:initial}',
      '[hidden]{display:none!important}',
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
      '.fab{width:40px;height:40px;border-radius:50%;border:0;background:#2b7de9;color:#fff;font-size:18px;cursor:pointer;opacity:.85;box-shadow:0 2px 8px rgba(0,0,0,.35)}',
      '.fab:hover{opacity:1}',
      '.panel{width:320px;max-width:calc(100vw - 32px);background:#1f2430;color:#e8ecf3;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.5);padding:10px;font-size:13px}',
      '.head{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
      '.head strong{flex:1;font-size:14px}',
      '.head .ver{opacity:.6;font-size:11px}',
      '.lang{background:#3a4256;color:#e8ecf3;border:0;border-radius:6px;padding:3px 4px;font-size:12px;max-width:120px}',
      '.status{min-height:18px;margin:4px 0 8px;color:#9ec3ff}',
      '.opt{display:flex;align-items:center;gap:6px;margin-bottom:8px;cursor:pointer}',
      '.btns{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
      'button{border:0;border-radius:6px;padding:7px 8px;font-size:13px;cursor:pointer;background:#3a4256;color:#e8ecf3}',
      'button:hover:not(:disabled){background:#4a5470}',
      'button:disabled{opacity:.4;cursor:default}',
      'button.primary{background:#2b7de9}',
      'button.danger{background:#c93a3a}',
      '.confirm{margin-top:8px;padding:8px;border:1px solid #c93a3a;border-radius:6px}',
      '.confirm .txt{margin-bottom:8px;line-height:1.35}',
      '.confirm .btns{margin:0}',
      // Il testo del registro si può selezionare e copiare (Telegram disattiva la selezione sul resto della pagina).
      '.log,.status,.confirm .txt{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}',
      '.log{margin:8px 0 0;max-height:180px;overflow:auto;white-space:pre-wrap;font:11px/1.4 ui-monospace,Consolas,monospace;background:#161a23;border-radius:6px;padding:6px}',
      '.logbar{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}',
      '.copy,.upd,.clear{padding:4px 10px;font-size:12px}',
      '.upd{flex:1 1 100%}',
      '.clear,.copy{flex:1}',
      '.x{padding:2px 8px;background:transparent}',
      // Durante un\'operazione il pannello si riduce a stato + Stop e lascia passare i clic:
      // così non copre le righe della lista (sul telefono la lista occupa tutta la larghezza).
      '.panel.running .dry,.panel.running .arch,.panel.running .del,.panel.running .opt,.panel.running .log,.panel.running .lang,.panel.running .logbar{display:none}',
      '.panel.running .btns{grid-template-columns:1fr}',
      '.stop{pointer-events:auto}',
      '</style>',
      '<button class="fab" title="Telegram Joined Cleaner">🧹</button>',
      '<div class="panel" hidden>',
      '  <div class="head"><strong>Joined Cleaner</strong><span class="ver">v' + VERSION + '</span>',
      '    <select class="lang" data-i18n-title="lang_label"></select>',
      '    <button class="x" data-i18n-title="close">×</button></div>',
      '  <div class="status"></div>',
      '  <label class="opt"><input type="checkbox" class="inc"><span data-i18n="opt_only_deleted"></span></label>',
      '  <div class="btns">',
      '    <button class="dry" data-i18n="btn_dry"></button>',
      '    <button class="arch primary" data-i18n="btn_archive"></button>',
      '    <button class="del" data-i18n="btn_delete"></button>',
      '    <button class="stop" data-i18n="btn_stop" disabled></button>',
      '  </div>',
      '  <div class="confirm" hidden><div class="txt"></div><div class="btns"><button class="yes danger"></button><button class="no" data-i18n="btn_cancel"></button></div></div>',
      '  <pre class="log"></pre>',
      '  <div class="logbar"><button class="upd" data-i18n="btn_update"></button><button class="clear" data-i18n="btn_clear"></button><button class="copy" data-i18n="btn_copy"></button></div>',
      '</div>',
    ].join('');

    const $ = (s) => root.querySelector(s);
    const fab = $('.fab'), panel = $('.panel'), statusEl = $('.status'), logEl = $('.log');
    const bDry = $('.dry'), bArch = $('.arch'), bDel = $('.del'), bStop = $('.stop'), bCopy = $('.copy'), bUpd = $('.upd'), bClear = $('.clear');
    const inc = $('.inc'), confirmBox = $('.confirm'), confirmTxt = $('.confirm .txt'), bYes = $('.yes'), bNo = $('.no');
    const langSel = $('.lang');
    const entries = []; // righe del registro: {time, msg}; msg è un messaggio da tradurre al momento di mostrarlo
    let statusMsg = M('ready');
    let copyTimer = null;

    const logText = () => entries.map((e) => e.time + ' ' + render(e.msg)).join('\n');
    const showLog = () => { logEl.textContent = logText(); logEl.scrollTop = logEl.scrollHeight; };
    const showStatus = () => { statusEl.textContent = render(statusMsg); };

    const setRunningUi = (on) => {
      panel.classList.toggle('running', on);
      host.style.pointerEvents = on ? 'none' : '';
      // Il registro nascosto perde la posizione di scorrimento: quando torna visibile mostro le righe più recenti.
      if (!on) logEl.scrollTop = logEl.scrollHeight;
    };

    // Le lingue nel menu a tendina: nomi come testo (mai come HTML).
    const fillLanguages = () => {
      while (langSel.firstChild) langSel.removeChild(langSel.firstChild);
      for (const code of available) {
        const o = document.createElement('option');
        o.value = code;
        o.textContent = langName(code);
        langSel.appendChild(o);
      }
      langSel.value = lang;
    };

    // Riscrive nella lingua scelta i testi fissi, lo stato e tutto il registro.
    const applyLang = () => {
      root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = tr(el.getAttribute('data-i18n')); });
      root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = tr(el.getAttribute('data-i18n-title')); });
      fillLanguages();
      showStatus();
      showLog();
    };

    const copyLog = async () => {
      const text = logText();
      if (!text) return;
      let ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; }
      } catch (e) { /* provo il metodo di riserva */ }
      if (!ok) {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
          root.appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          ta.remove();
        } catch (e) { ok = false; }
      }
      if (!ok) { api.log(M('copy_failed')); return; }
      bCopy.textContent = tr('btn_copied');
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { bCopy.textContent = tr('btn_copy'); copyTimer = null; }, 1800);
    };

    const api = {
      log(msg) {
        entries.push({ time: new Date().toTimeString().slice(0, 8), msg });
        if (entries.length > 80) entries.shift();
        showLog();
        console.log('[Joined Cleaner] ' + render(msg));
      },
      setStatus(msg) { statusMsg = msg; showStatus(); },
      setBusy(busy) {
        bDry.disabled = bArch.disabled = bDel.disabled = bUpd.disabled = busy;
        bStop.disabled = !busy;
        if (busy) { panel.hidden = false; fab.hidden = true; } else { statusMsg = M('ready'); showStatus(); }
        setRunningUi(busy);
      },
      confirm(msg, yesMsg) {
        return new Promise((resolve) => {
          confirmTxt.textContent = render(msg);
          bYes.textContent = render(yesMsg);
          confirmBox.hidden = false;
          setRunningUi(false); // per la conferma serve il pannello intero e cliccabile
          const done = (v) => { confirmBox.hidden = true; bYes.onclick = bNo.onclick = null; setRunningUi(state.running); resolve(v); };
          bYes.onclick = () => done(true);
          bNo.onclick = () => done(false);
        });
      },
      // Cambia lingua: carica il file se serve; se non ci riesce resta con quella attuale.
      async setLang(code) {
        if (available.indexOf(code) < 0) return false;
        const p = await loadPack(code);
        if (!p) { api.log(M('lang_load_failed', code)); langSel.value = lang; return false; }
        lang = code;
        storeSet(LANG_KEY, code);
        applyLang();
        return true;
      },
      // Dopo che l'elenco delle lingue è stato letto o aggiornato.
      refreshLanguages() { applyLang(); },
      bind(handlers) {
        bDry.onclick = handlers.dry;
        bArch.onclick = handlers.archive;
        bDel.onclick = handlers.remove;
        bUpd.onclick = handlers.update;
        bStop.onclick = () => { state.stop = true; statusMsg = M('stop_requested'); showStatus(); if (bNo.onclick) bNo.onclick(); };
      },
    };

    fab.onclick = () => { panel.hidden = false; fab.hidden = true; };
    $('.x').onclick = () => { panel.hidden = true; fab.hidden = false; };
    inc.onchange = () => { SETTINGS.onlyDeletedAccounts = inc.checked; };
    langSel.onchange = () => { api.setLang(langSel.value); };
    bCopy.onclick = copyLog;
    bClear.onclick = () => { entries.length = 0; showLog(); };

    applyLang();
    document.body.appendChild(host);
    return api;
  })();

  // All'avvio: leggo l'elenco delle lingue dalla cartella languages/ del repository e scelgo quella giusta
  // (quella salvata dall'utente, altrimenti quella del browser, altrimenti l'inglese). Senza rete resta tutto com'è.
  async function initLanguages() {
    try {
      const codes = await loadAvailable();
      if (codes) setAvailable(codes);
      const target = storedLang && available.indexOf(storedLang) >= 0 ? storedLang : pickByBrowser(available);
      if (target !== 'en') {
        const p = await loadPack(target, true);
        if (p) lang = target;
      } else {
        lang = 'en';
      }
    } catch (e) { /* resto con la lingua attuale */ }
    ui.refreshLanguages();
  }

  debugApi.base = EN;
  debugApi.setLang = ui.setLang;
  debugApi.getLang = () => lang;
  debugApi.getAvailable = () => available.slice();
  debugApi.ready = initLanguages();
  debugApi.refreshTexts = refreshTexts;
  debugApi.getTexts = () => TEXTS;
  debugApi.getTelegramLang = () => telegramLang;
  debugApi.textsReady = refreshTexts().catch(() => { /* resto con i testi inglesi */ });

  async function runTask(fn) {
    if (state.running) { ui.log(M('busy')); return; }
    state.running = true;
    state.stop = false;
    ui.setBusy(true);
    try { await refreshTexts(); await fn(); }
    catch (e) { ui.log(M('unexpected', e.message)); console.error(e); }
    finally { state.running = false; ui.setBusy(false); }
  }

  ui.bind({
    dry: () => runTask(dryRun),
    archive: () => runTask(archiveRun),
    remove: () => runTask(deleteRun),
    update: () => runTask(updateRun),
  });
})();
