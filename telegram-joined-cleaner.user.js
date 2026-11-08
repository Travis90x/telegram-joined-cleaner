// ==UserScript==
// @name         Telegram Joined Cleaner
// @namespace    https://github.com/Travis90x/telegram-joined-cleaner
// @version      0.3.1
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

  const VERSION = '0.3.1';

  // ===================================================================
  // Testi di Telegram che lo script riconosce
  // Telegram Web K li mostra nella lingua scelta dall'utente. L'unica
  // lingua VERIFICATA è l'inglese. Per un'altra lingua bisogna aggiungere
  // qui le stringhe esatte, dopo averle lette davvero dall'interfaccia.
  // (Non c'entra con la lingua del pannello dello script: vedi I18N.)
  // ===================================================================
  const TEXTS = {
    joinedSuffixes: [' joined Telegram'], // anteprima = titolo + suffisso
    deletedAccount: 'Deleted Account',
    archivedChats: 'Archived Chats',
    menuArchive: 'Archive',
    menuUnarchive: 'Unarchive',
    menuSelect: 'Select',
    menuDelete: 'Delete',
    selectedBar: /^(\d+) chats? selected$/,
    deletePopupTitle: (n) => 'Delete ' + n + ' chats',
    deletePopupTitleSingle: /^Delete\b/i,
    popupDeleteButton: 'Delete',
  };

  const SETTINGS = {
    onlyDeletedAccounts: false, // casella nel pannello: false = solo chat con nome, true = solo "Deleted Account"
    archiveLimitPerRun: 80, // dopo ~100 archiviazioni di fila Telegram rallenta
    deleteBatchSize: 40, // provato con 38
    maxConsecutiveErrors: 3,
  };

  const state = { running: false, stop: false };

  // Esposto solo per i collaudi (la console permette di cambiare i limiti a mano).
  window.__telegramJoinedCleaner = { version: VERSION, settings: SETTINGS };

  // ===================================================================
  // Lingua del pannello e dei messaggi dello script: italiano o inglese.
  // La scelta si fa dal menu a tendina del pannello e viene ricordata.
  // ===================================================================
  const I18N = {
    it: {
      close: 'Chiudi',
      lang_label: 'Lingua',
      ready: 'Pronto.',
      opt_only_deleted: 'Solo "Deleted Account" (solo account cancellati)',
      btn_dry: 'Prova',
      btn_archive: 'Archivia',
      btn_delete: 'Cancella…',
      btn_stop: 'Stop',
      btn_cancel: 'Annulla',
      stop_requested: 'Stop richiesto…',
      busy: 'Un\'operazione è già in corso.',
      unexpected: 'Errore imprevisto: {0}',
      no_list: 'Non trovo la lista chat (o ce n\'è più di una in vista). Nessuna azione.',
      selection_mode: 'Telegram è in modalità selezione: esci dalla selezione e riprova.',
      in_archive: 'Sei nell\'archivio: torna alla lista principale per archiviare.',
      loc_main: 'lista principale',
      loc_archive: 'archivio',
      where_main: 'nella lista principale',
      where_archive: 'nell\'archivio',
      archiving: 'Archiviazione in corso…',
      archive_progress: 'Archiviate {0} (già archiviate {1}, errori {2})…',
      archive_summary: 'Archiviazione: {0}. Archiviate {1}, già archiviate {2}, errori {3}.',
      limit_hint: 'Aspetta qualche minuto e premi di nuovo "{0}" per continuare.',
      error_chat: 'Errore su una chat: {0}',
      r_done: 'completato',
      r_stopped: 'fermato dall\'utente',
      r_lost: 'lista persa',
      r_limit: 'limite di {0} per giro raggiunto',
      r_errors: 'fermato: {0} errori di fila',
      r_list_changed: 'la lista aperta è cambiata',
      r_after_error: 'fermato dopo un errore',
      w_row_not_in_view: 'riga non in vista',
      w_menu_item: 'voce "{0}" non trovata o non univoca',
      w_state_unchanged: 'stato non cambiato dopo il clic',
      w_first_not_found: 'prima chat non trovata',
      w_selection_off: 'modalità selezione non attivata',
      w_covered: 'una chat è coperta da un altro elemento: allarga la finestra',
      w_unexpected_selected: '{0} chat selezionate non previste',
      w_not_selected: '{0} chat non selezionate',
      w_bar_mismatch: 'la barra indica {0} selezionate invece di {1}',
      w_bar_missing: 'barra di selezione non visibile',
      w_sel_differs: 'selezione diversa da {0}',
      w_more_missing: 'pulsante dei tre puntini non trovato',
      w_popup_missing: 'finestra di conferma di Telegram non trovata o con un numero diverso',
      w_popup_btn: 'pulsante "{0}" non univoco',
      w_popup_stuck: 'dopo la conferma la finestra o la selezione sono rimaste aperte',
      del_counting: 'Conto le chat {0}…',
      del_stopped_nothing: 'Fermato dall\'utente. Non è stato cancellato niente.',
      del_none: 'Non ci sono chat da cancellare {0} ({1} chat viste).',
      kind_named: 'con solo l\'avviso "joined"',
      kind_deleted: 'di "Deleted Account" con solo l\'avviso "joined"',
      del_confirm: 'Cancellazione DEFINITIVA {0}: {1} chat {2}. Le altre {3} chat non verranno toccate.',
      del_yes: 'Sì, cancella {0}',
      del_cancelled: 'Cancellazione annullata. Non è stato cancellato niente.',
      del_progress: 'Cancello {0} chat… (fatte {1} su {2})',
      del_error: 'Errore: {0}.',
      del_selection_left: 'La selezione è rimasta attiva: esci con la X in alto a sinistra prima di riprovare.',
      del_summary: 'Cancellazione: {0}. Cancellate {1} su {2}.',
      del_final: 'Controllo finale: {0} restano {1} chat "solo joined" del tipo scelto.',
      dry_status: 'Prova in corso ({0})…',
      mode_named: 'solo chat con nome',
      mode_deleted: 'solo "Deleted Account"',
      dry_result: 'Prova ({0}): {1} chat viste, {2} con solo "joined" ({3} con nome, {4} "Deleted Account"). Impostazione attuale: {5}. Verrebbero toccate: {6}. Non è stato modificato niente.',
      dry_nothing: 'Nessuna chat "solo joined" in questa lista ({0} chat viste). Cause possibili: sono già archiviate (nella scheda "All" spariscono: prova la scheda "Contacts" o apri l\'archivio) oppure Telegram non è in inglese (vedi README).',
      tab_suffix: ', scheda «{0}»',
      dry_note: 'Nota: nella scheda "Contacts" le chat già archiviate restano in lista e vengono contate.',
    },
    en: {
      close: 'Close',
      lang_label: 'Language',
      ready: 'Ready.',
      opt_only_deleted: 'Only "Deleted Account" (deleted accounts only)',
      btn_dry: 'Dry run',
      btn_archive: 'Archive',
      btn_delete: 'Delete…',
      btn_stop: 'Stop',
      btn_cancel: 'Cancel',
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
      dry_nothing: 'No "joined-only" chats in this list ({0} chats seen). Possible causes: they are already archived (they disappear from the "All" tab: try the "Contacts" tab or open the archive) or Telegram is not in English (see the README).',
      tab_suffix: ', tab «{0}»',
      dry_note: 'Note: in the "Contacts" tab already archived chats stay in the list and are counted.',
    },
  };
  const LANGS = ['it', 'en'];
  const LANG_KEY = 'telegramJoinedCleaner.lang';
  const detectLang = () => ((navigator.language || 'en').toLowerCase().indexOf('it') === 0 ? 'it' : 'en');
  const loadLang = () => {
    try { const v = localStorage.getItem(LANG_KEY); if (LANGS.indexOf(v) >= 0) return v; } catch (e) { /* senza storage: uso la lingua del browser */ }
    return detectLang();
  };
  const saveLang = (l) => { try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* la scelta vale solo per questa pagina */ } };
  let lang = loadLang();
  const tr = (key, ...args) => {
    const s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    return s.replace(/\{(\d+)\}/g, (m, i) => (args[Number(i)] === undefined ? m : String(args[Number(i)])));
  };

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
  // Le voci di menu iniziano con un carattere-icona non ASCII: lo tolgo prima di confrontare.
  const asciiOnly = (s) => (s || '').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();

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
    const s = rowPreview(a);
    return /^\d+$/.test(rowId(a)) && t.length > 0 && TEXTS.joinedSuffixes.some((suf) => s === t + suf);
  };
  // Con la casella spenta si trattano solo le chat con nome; accesa, solo quelle di account eliminati.
  const isWantedTitle = (t) => (t === TEXTS.deletedAccount) === SETTINGS.onlyDeletedAccounts;
  const isTargetRow = (a) => isJoinedRow(a) && isWantedTitle(rowTitle(a));

  // La lista in vista: deve essercene UNA sola, altrimenti non si procede.
  function findScroller() {
    let c = Array.from(document.querySelectorAll('.scrollable-y')).filter((x) => Array.from(rowsIn(x)).some(isInView));
    if (c.length > 1) c = c.filter((x) => x.classList.contains('chatlist-parts'));
    return c.length === 1 ? c[0] : null;
  }

  function isArchiveOpen() {
    return Array.from(document.querySelectorAll('span, div, h1, h2, h3')).some(
      (el) => el.childElementCount === 0 && !el.closest('.btn-menu') && isShown(el) && asciiOnly(el.textContent) === TEXTS.archivedChats
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
    const m = TEXTS.selectedBar.exec(asciiOnly(b.textContent));
    return m ? Number(m[1]) : 0;
  };

  // ===================================================================
  // Menu
  // ===================================================================
  const contextMenus = () => Array.from(document.querySelectorAll('.btn-menu.contextmenu')).filter((m) => m.classList.contains('active') && isShown(m));
  const activeMenus = () => Array.from(document.querySelectorAll('.btn-menu')).filter((m) => m.classList.contains('active') && isShown(m));
  const menuItems = (menus) => menus.flatMap((m) => Array.from(m.querySelectorAll('.btn-menu-item')).filter(isShown));
  const byLabel = (items, label) => items.filter((i) => asciiOnly(i.textContent) === label);

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
    for (let i = 0; i < 25; i++) {
      await sleep(120);
      const items = menuItems(contextMenus());
      if (items.some((it) => labels.includes(asciiOnly(it.textContent)))) return items;
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
    const items = await openMenuOn(row, [TEXTS.menuArchive, TEXTS.menuUnarchive]);
    if (!items) return { ok: false, id, why: tr('w_row_not_in_view') };
    const arch = byLabel(items, TEXTS.menuArchive);
    const unarch = byLabel(items, TEXTS.menuUnarchive);
    if (!arch.length && unarch.length) { await closeMenus(); return { skip: true, id }; }
    if (arch.length !== 1) { await closeMenus(); return { ok: false, id, why: tr('w_menu_item', TEXTS.menuArchive) }; }
    arch[0].click();
    await sleep(1800);
    const still = sc.querySelector(rowSelector(id));
    if (!still) return { ok: true, id }; // nella scheda "All" la riga sparisce
    // nella scheda "Contacts" la riga resta: controllo che il menu ora offra "Unarchive"
    const items2 = await openMenuOn(still, [TEXTS.menuArchive, TEXTS.menuUnarchive]);
    const done = !!items2 && byLabel(items2, TEXTS.menuUnarchive).length === 1 && byLabel(items2, TEXTS.menuArchive).length === 0;
    await closeMenus();
    return done ? { ok: true, id } : { ok: false, id, why: tr('w_state_unchanged') };
  }

  async function archiveRun() {
    if (isArchiveOpen()) { ui.log(tr('in_archive')); return; }
    if (selectionBar()) { ui.log(tr('selection_mode')); return; }
    if (!findScroller()) { ui.log(tr('no_list')); return; }

    const S = { archived: 0, skipped: 0, failed: 0, consecutive: 0 };
    const doneIds = new Set(); // archiviate o già archiviate: non si ripassano
    let reason = ['r_done']; // chiave del motivo di fine + eventuali parametri
    ui.setStatus(tr('archiving'));

    passes:
    for (let pass = 1; pass <= 3; pass++) {
      if (state.stop) { reason = ['r_stopped']; break; }
      let sc = findScroller();
      if (!sc) { reason = ['r_lost']; break; }
      jump(sc, 0);
      await sleep(900);
      const failedThisPass = new Set();
      let progress = 0;
      let lastHeight = 0;
      let stableEnd = 0;

      for (let guard = 0; guard < 6000; guard++) {
        if (state.stop) { reason = ['r_stopped']; break passes; }
        sc = findScroller();
        if (!sc) { reason = ['r_lost']; break passes; }

        let row = null;
        for (const a of rowsIn(sc)) {
          const id = rowId(a);
          if (doneIds.has(id) || failedThisPass.has(id)) continue;
          if (isTargetRow(a)) { row = a; break; }
        }

        if (row) {
          if (S.archived >= SETTINGS.archiveLimitPerRun) { reason = ['r_limit', SETTINGS.archiveLimitPerRun]; break passes; }
          const id = rowId(row);
          const res = await archiveRow(sc, row);
          if (res.skip) { S.skipped++; doneIds.add(id); }
          else if (res.ok) { S.archived++; progress++; S.consecutive = 0; doneIds.add(id); }
          else {
            S.failed++; S.consecutive++; failedThisPass.add(id);
            ui.log(tr('error_chat', res.why));
            if (S.consecutive >= SETTINGS.maxConsecutiveErrors) { reason = ['r_errors', S.consecutive]; break passes; }
          }
          ui.setStatus(tr('archive_progress', S.archived, S.skipped, S.failed));
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
    ui.log(tr('archive_summary', tr(...reason), S.archived, S.skipped, S.failed));
    if (reason[0] === 'r_limit') ui.log(tr('limit_hint', tr('btn_archive')));
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
    if (!first) return { ok: false, why: tr('w_first_not_found') };
    const items = await openMenuOn(first, [TEXTS.menuSelect]);
    const sel = items ? byLabel(items, TEXTS.menuSelect) : [];
    if (sel.length !== 1) { await closeMenus(); return { ok: false, why: tr('w_menu_item', TEXTS.menuSelect) }; }
    sel[0].click();
    await sleep(900);
    if (selectionCount() < 1) return { ok: false, why: tr('w_selection_off') };

    for (let round = 0; round < 3; round++) {
      if (state.stop) return { ok: false, why: tr('r_stopped') };
      const have = await readSelectedIds(sc);
      const missing = ids.filter((id) => !have.has(id));
      if (missing.length === 0) break;
      for (const id of missing) {
        const row = await bringIntoView(sc, id);
        if (!row) continue;
        if (!(await pressRow(row))) return { ok: false, why: tr('w_covered') };
      }
    }

    const final = await readSelectedIds(sc);
    const extra = Array.from(final).filter((id) => !want.has(id));
    const missing = ids.filter((id) => !final.has(id));
    if (extra.length) return { ok: false, why: tr('w_unexpected_selected', extra.length) };
    if (missing.length) return { ok: false, why: tr('w_not_selected', missing.length) };
    if (selectionCount() !== ids.length) return { ok: false, why: tr('w_bar_mismatch', selectionCount(), ids.length) };
    return { ok: true };
  }

  // Dalla barra di selezione: tre puntini > Delete > conferma nella finestra di Telegram.
  async function deleteSelected(n) {
    const bar = selectionBar();
    if (!bar) return { ok: false, why: tr('w_bar_missing') };
    if (selectionCount() !== n) return { ok: false, why: tr('w_sel_differs', n) };
    const more = Array.from(bar.querySelectorAll('.btn-menu-toggle')).filter(isShown)[0];
    if (!more) return { ok: false, why: tr('w_more_missing') };
    await closeMenus();
    more.click();
    await sleep(800);
    const del = byLabel(menuItems(activeMenus()), TEXTS.menuDelete);
    if (del.length !== 1) { await closeMenus(); return { ok: false, why: tr('w_menu_item', TEXTS.menuDelete) }; }
    del[0].click();
    await sleep(1000);

    const popups = Array.from(document.querySelectorAll('.popup')).filter(isShown);
    const popup = popups.find((p) => {
      const title = asciiOnly((p.querySelector('.popup-title') || {}).textContent);
      return n === 1 ? TEXTS.deletePopupTitleSingle.test(title) : title === TEXTS.deletePopupTitle(n);
    });
    if (!popup) return { ok: false, why: tr('w_popup_missing') };
    const btns = Array.from(popup.querySelectorAll('.popup-button, button')).filter(isShown).filter((b) => asciiOnly(b.textContent) === TEXTS.popupDeleteButton);
    if (btns.length !== 1) return { ok: false, why: tr('w_popup_btn', TEXTS.popupDeleteButton) };
    btns[0].click();

    for (let i = 0; i < 40; i++) { // fino a 8 s
      await sleep(200);
      if (!Array.from(document.querySelectorAll('.popup')).some(isShown) && !selectionBar()) return { ok: true };
    }
    return { ok: false, why: tr('w_popup_stuck') };
  }

  // Passo 1: conta (senza toccare niente). Passo 2: conferma nel pannello. Passo 3: cancella a gruppi.
  async function deleteRun() {
    const inArchive = isArchiveOpen();
    const tab = inArchive ? '' : activeTabName();
    const where = tr(inArchive ? 'where_archive' : 'where_main') + (tab ? tr('tab_suffix', tab) : '');
    if (selectionBar()) { ui.log(tr('selection_mode')); return; }
    let sc = findScroller();
    if (!sc) { ui.log(tr('no_list')); return; }

    ui.setStatus(tr('del_counting', where));
    const rows = await scanList(sc);
    if (state.stop) { ui.log(tr('del_stopped_nothing')); return; }
    const all = Array.from(rows.values());
    const targets = all.filter((v) => v.joined && isWantedTitle(v.title)).length;
    const others = all.length - targets;
    if (targets === 0) { ui.log(tr('del_none', where, all.length)); return; }

    const kind = tr(SETTINGS.onlyDeletedAccounts ? 'kind_deleted' : 'kind_named');
    const ok = await ui.confirm(tr('del_confirm', where, targets, kind, others), tr('del_yes', targets));
    if (!ok) { ui.log(tr('del_cancelled')); return; }

    let remaining = targets;
    let deleted = 0;
    let consecutive = 0;
    let reason = ['r_done'];
    while (remaining > 0) {
      if (state.stop) { reason = ['r_stopped']; break; }
      if (isArchiveOpen() !== inArchive) { reason = ['r_list_changed']; break; }
      sc = findScroller();
      if (!sc) { reason = ['r_lost']; break; }
      const ids = await collectTargets(sc, Math.min(SETTINGS.deleteBatchSize, remaining));
      if (ids.length === 0) break;
      ui.setStatus(tr('del_progress', ids.length, deleted, targets));

      let res = await selectRows(sc, ids);
      if (res.ok) res = await deleteSelected(ids.length);
      if (res.ok) { deleted += ids.length; remaining -= ids.length; consecutive = 0; }
      else {
        consecutive++;
        ui.log(tr('del_error', res.why));
        if (selectionBar()) ui.log(tr('del_selection_left'));
        if (consecutive >= SETTINGS.maxConsecutiveErrors || selectionBar()) { reason = ['r_after_error']; break; }
      }
      await sleep(2000);
    }

    await closeMenus();
    ui.log(tr('del_summary', tr(...reason), deleted, targets));
    sc = findScroller();
    if (sc) {
      const after = await scanList(sc);
      const left = Array.from(after.values()).filter((v) => v.joined && isWantedTitle(v.title)).length;
      ui.log(tr('del_final', where, left));
    }
  }

  // ===================================================================
  // Prova: solo lettura
  // ===================================================================
  async function dryRun() {
    const sc = findScroller();
    if (!sc) { ui.log(tr('no_list')); return; }
    const inArchive = isArchiveOpen();
    const tab = inArchive ? '' : activeTabName();
    const where = tr(inArchive ? 'loc_archive' : 'loc_main') + (tab ? tr('tab_suffix', tab) : '');
    ui.setStatus(tr('dry_status', where));
    const rows = await scanList(sc);
    const all = Array.from(rows.values());
    const joined = all.filter((v) => v.joined);
    const deletedAcc = joined.filter((v) => v.title === TEXTS.deletedAccount).length;
    const targets = joined.filter((v) => isWantedTitle(v.title)).length;
    const mode = tr(SETTINGS.onlyDeletedAccounts ? 'mode_deleted' : 'mode_named');
    ui.log(tr('dry_result', where, all.length, joined.length, joined.length - deletedAcc, deletedAcc, mode, targets));
    if (all.length > 0 && joined.length === 0) ui.log(tr('dry_nothing', all.length));
    if (!inArchive) ui.log(tr('dry_note'));
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
      '.lang{background:#3a4256;color:#e8ecf3;border:0;border-radius:6px;padding:3px 4px;font-size:12px}',
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
      '.log{margin:8px 0 0;max-height:180px;overflow:auto;white-space:pre-wrap;font:11px/1.4 ui-monospace,Consolas,monospace;background:#161a23;border-radius:6px;padding:6px}',
      '.x{padding:2px 8px;background:transparent}',
      // Durante un\'operazione il pannello si riduce a stato + Stop e lascia passare i clic:
      // così non copre le righe della lista (sul telefono la lista occupa tutta la larghezza).
      '.panel.running .dry,.panel.running .arch,.panel.running .del,.panel.running .opt,.panel.running .log,.panel.running .lang{display:none}',
      '.panel.running .btns{grid-template-columns:1fr}',
      '.stop{pointer-events:auto}',
      '</style>',
      '<button class="fab" title="Telegram Joined Cleaner">🧹</button>',
      '<div class="panel" hidden>',
      '  <div class="head"><strong>Joined Cleaner</strong><span class="ver">v' + VERSION + '</span>',
      '    <select class="lang" data-i18n-title="lang_label"><option value="it">Italiano</option><option value="en">English</option></select>',
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
      '</div>',
    ].join('');

    const $ = (s) => root.querySelector(s);
    const fab = $('.fab'), panel = $('.panel'), statusEl = $('.status'), logEl = $('.log');
    const bDry = $('.dry'), bArch = $('.arch'), bDel = $('.del'), bStop = $('.stop');
    const inc = $('.inc'), confirmBox = $('.confirm'), confirmTxt = $('.confirm .txt'), bYes = $('.yes'), bNo = $('.no');
    const langSel = $('.lang');
    const lines = [];
    const setRunningUi = (on) => {
      panel.classList.toggle('running', on);
      host.style.pointerEvents = on ? 'none' : '';
      // Il registro nascosto perde la posizione di scorrimento: quando torna visibile mostro le righe più recenti.
      if (!on) logEl.scrollTop = logEl.scrollHeight;
    };

    // Riscrive i testi fissi del pannello nella lingua scelta (i messaggi già nel registro restano com'erano).
    const applyLang = () => {
      root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = tr(el.getAttribute('data-i18n')); });
      root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = tr(el.getAttribute('data-i18n-title')); });
      langSel.value = lang;
      if (!state.running) statusEl.textContent = tr('ready');
    };

    const api = {
      log(msg) {
        const t = new Date().toTimeString().slice(0, 8);
        lines.push(t + ' ' + msg);
        if (lines.length > 80) lines.shift();
        logEl.textContent = lines.join('\n');
        logEl.scrollTop = logEl.scrollHeight;
        console.log('[Joined Cleaner] ' + msg);
      },
      setStatus(msg) { statusEl.textContent = msg; },
      setBusy(busy) {
        bDry.disabled = bArch.disabled = bDel.disabled = busy;
        bStop.disabled = !busy;
        if (busy) { panel.hidden = false; fab.hidden = true; } else statusEl.textContent = tr('ready');
        setRunningUi(busy);
      },
      confirm(text, yesLabel) {
        return new Promise((resolve) => {
          confirmTxt.textContent = text;
          bYes.textContent = yesLabel;
          confirmBox.hidden = false;
          setRunningUi(false); // per la conferma serve il pannello intero e cliccabile
          const done = (v) => { confirmBox.hidden = true; bYes.onclick = bNo.onclick = null; setRunningUi(state.running); resolve(v); };
          bYes.onclick = () => done(true);
          bNo.onclick = () => done(false);
        });
      },
      setLang(l) {
        if (LANGS.indexOf(l) < 0) return;
        lang = l;
        saveLang(l);
        applyLang();
      },
      bind(handlers) {
        bDry.onclick = handlers.dry;
        bArch.onclick = handlers.archive;
        bDel.onclick = handlers.remove;
        bStop.onclick = () => { state.stop = true; statusEl.textContent = tr('stop_requested'); if (bNo.onclick) bNo.onclick(); };
      },
    };

    fab.onclick = () => { panel.hidden = false; fab.hidden = true; };
    $('.x').onclick = () => { panel.hidden = true; fab.hidden = false; };
    inc.onchange = () => { SETTINGS.onlyDeletedAccounts = inc.checked; };
    langSel.onchange = () => api.setLang(langSel.value);

    applyLang();
    document.body.appendChild(host);
    return api;
  })();

  window.__telegramJoinedCleaner.setLang = ui.setLang;

  async function runTask(fn) {
    if (state.running) { ui.log(tr('busy')); return; }
    state.running = true;
    state.stop = false;
    ui.setBusy(true);
    try { await fn(); }
    catch (e) { ui.log(tr('unexpected', e.message)); console.error(e); }
    finally { state.running = false; ui.setBusy(false); }
  }

  ui.bind({
    dry: () => runTask(dryRun),
    archive: () => runTask(archiveRun),
    remove: () => runTask(deleteRun),
  });
})();
