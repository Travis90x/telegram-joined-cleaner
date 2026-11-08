// ==UserScript==
// @name         Telegram Joined Cleaner
// @namespace    https://github.com/Travis90x/telegram-joined-cleaner
// @version      0.1.0
// @description  Su Telegram Web K archivia (e, con conferma, cancella dall'archivio) le chat che contengono solo l'avviso "... joined Telegram".
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

  const VERSION = '0.1.0';

  // ===================================================================
  // Testi riconosciuti
  // Telegram Web K li mostra nella lingua scelta dall'utente. L'unica
  // lingua VERIFICATA è l'inglese. Per un'altra lingua bisogna aggiungere
  // qui le stringhe esatte, dopo averle lette davvero dall'interfaccia.
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
    includeDeletedAccounts: false, // aggiornato dalla casella nel pannello
    archiveLimitPerRun: 80, // dopo ~100 archiviazioni di fila Telegram rallenta
    deleteBatchSize: 40, // provato con 38
    maxConsecutiveErrors: 3,
  };

  const state = { running: false, stop: false };

  // Esposto solo per i collaudi (la console permette di cambiare i limiti a mano).
  window.__telegramJoinedCleaner = { version: VERSION, settings: SETTINGS };

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
  const isWantedTitle = (t) => SETTINGS.includeDeletedAccounts || t !== TEXTS.deletedAccount;
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
    if (!items) return { ok: false, id, why: 'riga non in vista' };
    const arch = byLabel(items, TEXTS.menuArchive);
    const unarch = byLabel(items, TEXTS.menuUnarchive);
    if (!arch.length && unarch.length) { await closeMenus(); return { skip: true, id }; }
    if (arch.length !== 1) { await closeMenus(); return { ok: false, id, why: 'voce "' + TEXTS.menuArchive + '" non trovata o non univoca' }; }
    arch[0].click();
    await sleep(1800);
    const still = sc.querySelector(rowSelector(id));
    if (!still) return { ok: true, id }; // nella scheda "All" la riga sparisce
    // nella scheda "Contacts" la riga resta: controllo che il menu ora offra "Unarchive"
    const items2 = await openMenuOn(still, [TEXTS.menuArchive, TEXTS.menuUnarchive]);
    const done = !!items2 && byLabel(items2, TEXTS.menuUnarchive).length === 1 && byLabel(items2, TEXTS.menuArchive).length === 0;
    await closeMenus();
    return done ? { ok: true, id } : { ok: false, id, why: 'stato non cambiato dopo il clic' };
  }

  async function archiveRun() {
    if (isArchiveOpen()) { ui.log('Sei nell\'archivio: torna alla lista principale per archiviare.'); return; }
    if (selectionBar()) { ui.log('Telegram è in modalità selezione: esci dalla selezione e riprova.'); return; }
    if (!findScroller()) { ui.log('Non trovo la lista chat (o ce n\'è più di una in vista). Nessuna azione.'); return; }

    const S = { archived: 0, skipped: 0, failed: 0, consecutive: 0 };
    const doneIds = new Set(); // archiviate o già archiviate: non si ripassano
    let reason = 'completato';
    ui.setStatus('Archiviazione in corso…');

    passes:
    for (let pass = 1; pass <= 3; pass++) {
      if (state.stop) { reason = 'fermato dall\'utente'; break; }
      let sc = findScroller();
      if (!sc) { reason = 'lista persa'; break; }
      jump(sc, 0);
      await sleep(900);
      const failedThisPass = new Set();
      let progress = 0;
      let lastHeight = 0;
      let stableEnd = 0;

      for (let guard = 0; guard < 6000; guard++) {
        if (state.stop) { reason = 'fermato dall\'utente'; break passes; }
        sc = findScroller();
        if (!sc) { reason = 'lista persa'; break passes; }

        let row = null;
        for (const a of rowsIn(sc)) {
          const id = rowId(a);
          if (doneIds.has(id) || failedThisPass.has(id)) continue;
          if (isTargetRow(a)) { row = a; break; }
        }

        if (row) {
          if (S.archived >= SETTINGS.archiveLimitPerRun) { reason = 'limite di ' + SETTINGS.archiveLimitPerRun + ' per giro raggiunto'; break passes; }
          const id = rowId(row);
          const res = await archiveRow(sc, row);
          if (res.skip) { S.skipped++; doneIds.add(id); }
          else if (res.ok) { S.archived++; progress++; S.consecutive = 0; doneIds.add(id); }
          else {
            S.failed++; S.consecutive++; failedThisPass.add(id);
            ui.log('Errore su una chat: ' + res.why);
            if (S.consecutive >= SETTINGS.maxConsecutiveErrors) { reason = 'fermato: ' + S.consecutive + ' errori di fila'; break passes; }
          }
          ui.setStatus('Archiviate ' + S.archived + ' (già archiviate ' + S.skipped + ', errori ' + S.failed + ')…');
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
    ui.log('Archiviazione: ' + reason + '. Archiviate ' + S.archived + ', già archiviate ' + S.skipped + ', errori ' + S.failed + '.');
    if (reason.indexOf('limite') === 0) ui.log('Aspetta qualche minuto e premi di nuovo "Archivia" per continuare.');
  }

  // ===================================================================
  // Cancellazione dall'archivio (definitiva, solo dopo conferma nel pannello)
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
    if (!first) return { ok: false, why: 'prima chat non trovata' };
    const items = await openMenuOn(first, [TEXTS.menuSelect]);
    const sel = items ? byLabel(items, TEXTS.menuSelect) : [];
    if (sel.length !== 1) { await closeMenus(); return { ok: false, why: 'voce "' + TEXTS.menuSelect + '" non trovata' }; }
    sel[0].click();
    await sleep(900);
    if (selectionCount() < 1) return { ok: false, why: 'modalità selezione non attivata' };

    for (let round = 0; round < 3; round++) {
      if (state.stop) return { ok: false, why: 'fermato dall\'utente' };
      const have = await readSelectedIds(sc);
      const missing = ids.filter((id) => !have.has(id));
      if (missing.length === 0) break;
      for (const id of missing) {
        const row = await bringIntoView(sc, id);
        if (!row) continue;
        if (!(await pressRow(row))) return { ok: false, why: 'una chat è coperta da un altro elemento: allarga la finestra' };
      }
    }

    const final = await readSelectedIds(sc);
    const extra = Array.from(final).filter((id) => !want.has(id));
    const missing = ids.filter((id) => !final.has(id));
    if (extra.length) return { ok: false, why: extra.length + ' chat selezionate non previste' };
    if (missing.length) return { ok: false, why: missing.length + ' chat non selezionate' };
    if (selectionCount() !== ids.length) return { ok: false, why: 'la barra indica ' + selectionCount() + ' selezionate invece di ' + ids.length };
    return { ok: true };
  }

  // Dalla barra di selezione: tre puntini > Delete > conferma nella finestra di Telegram.
  async function deleteSelected(n) {
    const bar = selectionBar();
    if (!bar) return { ok: false, why: 'barra di selezione non visibile' };
    if (selectionCount() !== n) return { ok: false, why: 'selezione diversa da ' + n };
    const more = Array.from(bar.querySelectorAll('.btn-menu-toggle')).filter(isShown)[0];
    if (!more) return { ok: false, why: 'pulsante dei tre puntini non trovato' };
    await closeMenus();
    more.click();
    await sleep(800);
    const del = byLabel(menuItems(activeMenus()), TEXTS.menuDelete);
    if (del.length !== 1) { await closeMenus(); return { ok: false, why: 'voce "' + TEXTS.menuDelete + '" non univoca' }; }
    del[0].click();
    await sleep(1000);

    const popups = Array.from(document.querySelectorAll('.popup')).filter(isShown);
    const popup = popups.find((p) => {
      const t = asciiOnly((p.querySelector('.popup-title') || {}).textContent);
      return n === 1 ? TEXTS.deletePopupTitleSingle.test(t) : t === TEXTS.deletePopupTitle(n);
    });
    if (!popup) return { ok: false, why: 'finestra di conferma di Telegram non trovata o con un numero diverso' };
    const btns = Array.from(popup.querySelectorAll('.popup-button, button')).filter(isShown).filter((b) => asciiOnly(b.textContent) === TEXTS.popupDeleteButton);
    if (btns.length !== 1) return { ok: false, why: 'pulsante "' + TEXTS.popupDeleteButton + '" non univoco' };
    btns[0].click();

    for (let i = 0; i < 40; i++) { // fino a 8 s
      await sleep(200);
      if (!Array.from(document.querySelectorAll('.popup')).some(isShown) && !selectionBar()) return { ok: true };
    }
    return { ok: false, why: 'dopo la conferma la finestra o la selezione sono rimaste aperte' };
  }

  // Passo 1: conta (senza toccare niente). Passo 2: conferma nel pannello. Passo 3: cancella a gruppi.
  async function deleteRun() {
    if (!isArchiveOpen()) { ui.log('Apri prima l\'archivio (menu ☰ > "' + TEXTS.archivedChats + '"): la cancellazione si fa solo da lì.'); return; }
    if (selectionBar()) { ui.log('Telegram è in modalità selezione: esci dalla selezione e riprova.'); return; }
    let sc = findScroller();
    if (!sc) { ui.log('Non trovo la lista dell\'archivio (o ce n\'è più di una in vista). Nessuna azione.'); return; }

    ui.setStatus('Conto le chat nell\'archivio…');
    const rows = await scanList(sc);
    if (state.stop) { ui.log('Fermato dall\'utente. Non è stato cancellato niente.'); return; }
    const all = Array.from(rows.values());
    const targets = all.filter((v) => v.joined && isWantedTitle(v.title)).length;
    const others = all.length - targets;
    if (targets === 0) { ui.log('Nell\'archivio non ci sono chat da cancellare (' + all.length + ' chat viste).'); return; }

    const ok = await ui.confirm(
      'Nell\'archivio ci sono ' + targets + ' chat con solo l\'avviso "joined". Le altre ' + others + ' chat non verranno toccate. La cancellazione è DEFINITIVA.',
      'Sì, cancella ' + targets
    );
    if (!ok) { ui.log('Cancellazione annullata. Non è stato cancellato niente.'); return; }

    let remaining = targets;
    let deleted = 0;
    let consecutive = 0;
    let reason = 'completato';
    while (remaining > 0) {
      if (state.stop) { reason = 'fermato dall\'utente'; break; }
      if (!isArchiveOpen()) { reason = 'l\'archivio non è più aperto'; break; }
      sc = findScroller();
      if (!sc) { reason = 'lista persa'; break; }
      const ids = await collectTargets(sc, Math.min(SETTINGS.deleteBatchSize, remaining));
      if (ids.length === 0) break;
      ui.setStatus('Cancello ' + ids.length + ' chat… (fatte ' + deleted + ' su ' + targets + ')');

      let res = await selectRows(sc, ids);
      if (res.ok) res = await deleteSelected(ids.length);
      if (res.ok) { deleted += ids.length; remaining -= ids.length; consecutive = 0; }
      else {
        consecutive++;
        ui.log('Errore: ' + res.why + '.');
        if (selectionBar()) ui.log('La selezione è rimasta attiva: esci con la X in alto a sinistra prima di riprovare.');
        if (consecutive >= SETTINGS.maxConsecutiveErrors || selectionBar()) { reason = 'fermato dopo un errore'; break; }
      }
      await sleep(2000);
    }

    await closeMenus();
    ui.log('Cancellazione: ' + reason + '. Cancellate ' + deleted + ' su ' + targets + '.');
    sc = findScroller();
    if (sc) {
      const after = await scanList(sc);
      const left = Array.from(after.values()).filter((v) => v.joined && isWantedTitle(v.title)).length;
      ui.log('Controllo finale: nell\'archivio restano ' + left + ' chat "solo joined".');
    }
  }

  // ===================================================================
  // Prova: solo lettura
  // ===================================================================
  async function dryRun() {
    const sc = findScroller();
    if (!sc) { ui.log('Non trovo la lista chat (o ce n\'è più di una in vista). Nessuna azione.'); return; }
    const where = isArchiveOpen() ? 'archivio' : 'lista principale';
    ui.setStatus('Prova in corso (' + where + ')…');
    const rows = await scanList(sc);
    const all = Array.from(rows.values());
    const joined = all.filter((v) => v.joined);
    const deletedAcc = joined.filter((v) => v.title === TEXTS.deletedAccount).length;
    const targets = joined.filter((v) => isWantedTitle(v.title)).length;
    ui.log('Prova (' + where + '): ' + all.length + ' chat viste, ' + joined.length + ' con solo "joined" (di cui ' + deletedAcc + ' "' + TEXTS.deletedAccount + '"). Verrebbero toccate: ' + targets + '. Non è stato modificato niente.');
    if (all.length > 0 && joined.length === 0) ui.log('Nessuna chat riconosciuta: se Telegram non è in inglese i testi non coincidono (vedi README).');
    if (!isArchiveOpen()) ui.log('Nota: nella scheda "Contacts" le chat già archiviate restano in lista e vengono contate.');
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
      '</style>',
      '<button class="fab" title="Telegram Joined Cleaner">🧹</button>',
      '<div class="panel" hidden>',
      '  <div class="head"><strong>Joined Cleaner</strong><span class="ver">v' + VERSION + '</span><button class="x" title="Chiudi">×</button></div>',
      '  <div class="status">Pronto.</div>',
      '  <label class="opt"><input type="checkbox" class="inc"> Includi "' + TEXTS.deletedAccount + '"</label>',
      '  <div class="btns">',
      '    <button class="dry">Prova</button>',
      '    <button class="arch primary">Archivia</button>',
      '    <button class="del">Cancella archiviate…</button>',
      '    <button class="stop" disabled>Stop</button>',
      '  </div>',
      '  <div class="confirm" hidden><div class="txt"></div><div class="btns"><button class="yes danger"></button><button class="no">Annulla</button></div></div>',
      '  <pre class="log"></pre>',
      '</div>',
    ].join('');

    const $ = (s) => root.querySelector(s);
    const fab = $('.fab'), panel = $('.panel'), statusEl = $('.status'), logEl = $('.log');
    const bDry = $('.dry'), bArch = $('.arch'), bDel = $('.del'), bStop = $('.stop');
    const inc = $('.inc'), confirmBox = $('.confirm'), confirmTxt = $('.confirm .txt'), bYes = $('.yes'), bNo = $('.no');
    const lines = [];

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
      setBusy(busy) { bDry.disabled = bArch.disabled = bDel.disabled = busy; bStop.disabled = !busy; if (!busy) statusEl.textContent = 'Pronto.'; },
      confirm(text, yesLabel) {
        return new Promise((resolve) => {
          confirmTxt.textContent = text;
          bYes.textContent = yesLabel;
          confirmBox.hidden = false;
          const done = (v) => { confirmBox.hidden = true; bYes.onclick = bNo.onclick = null; resolve(v); };
          bYes.onclick = () => done(true);
          bNo.onclick = () => done(false);
        });
      },
      bind(handlers) {
        bDry.onclick = handlers.dry;
        bArch.onclick = handlers.archive;
        bDel.onclick = handlers.remove;
        bStop.onclick = () => { state.stop = true; statusEl.textContent = 'Stop richiesto…'; if (bNo.onclick) bNo.onclick(); };
      },
    };

    fab.onclick = () => { panel.hidden = false; fab.hidden = true; };
    $('.x').onclick = () => { panel.hidden = true; fab.hidden = false; };
    inc.onchange = () => { SETTINGS.includeDeletedAccounts = inc.checked; };

    document.body.appendChild(host);
    return api;
  })();

  async function runTask(fn) {
    if (state.running) { ui.log('Un\'operazione è già in corso.'); return; }
    state.running = true;
    state.stop = false;
    ui.setBusy(true);
    try { await fn(); }
    catch (e) { ui.log('Errore imprevisto: ' + e.message); console.error(e); }
    finally { state.running = false; ui.setBusy(false); }
  }

  ui.bind({
    dry: () => runTask(dryRun),
    archive: () => runTask(archiveRun),
    remove: () => runTask(deleteRun),
  });
})();
