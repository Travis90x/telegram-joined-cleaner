
🇮🇹 [Leggi il README in italiano](README_ITA.md)

# Telegram Joined Cleaner

<img width="360" height="448" alt="Screenshot 2026-11-08 222559" src="https://github.com/user-attachments/assets/ade8c337-33b2-4cd2-98b1-76b871b631c2" />


A [Tampermonkey](https://www.tampermonkey.net/) userscript that cleans up the chat list of **Telegram Web K** (`https://web.telegram.org/k/`): it removes the chats Telegram creates when a contact joins Telegram, i.e. the ones that only contain the "*name* joined Telegram" notice.

- **Archives** those chats (reversible).
- **Deletes** the same chats (straight from the main list or from the archive), only when you ask and after a confirmation in the panel (permanent).
- Works with **any Telegram language**: it reads phrases and menu entries from the language pack that Telegram Web K saves in the browser, with no translations to maintain (see "Telegram's language").
- Panel in **29 languages** (the same ones Telegram Web K offers), your choice. The translations, except Italian and English, were written by Claude and have not been reviewed by native speakers: corrections are welcome. More languages and corrections are added with a single file in the [`languages`](languages) folder (see "Adding a language").
- It only runs in your browser and does not use Telegram's internal APIs: it repeats the gestures you would do by hand (context menu, Archive, Select, Delete). It does not send your data to any server: the only connection is reading the language files from GitHub (see "Privacy").

> **Status: version 0.5.1, under testing.** The logic has been tested on a mock page that imitates Telegram Web K, and the **Dry run** (read-only) on the real Telegram; **Archive** and **Delete…** on the real Telegram are still to be completed (see "What is verified").

<img width="369" height="800" alt="Anteprima" src="https://github.com/user-attachments/assets/52067e26-4d6a-4a06-8fe0-a3ffb0f77e45" />


## Installation

1. Install Tampermonkey (Chrome, Edge, Firefox).
2. On Chrome 138 or newer: on the Tampermonkey extension details page turn on **Allow User Scripts** (or Developer mode). Not needed on Firefox.
3. Install the script in one of these two ways.

**From the link (the simplest).** Open [`telegram-joined-cleaner.user.js`](telegram-joined-cleaner.user.js) in "Raw" view (or the address below) and confirm the installation in Tampermonkey. If the script is already installed, Tampermonkey offers the update.

**With "Install from URL" (useful when the link does not open the installation page, for example on some phone browsers).**
1. Open Tampermonkey and go to **Utilities**.
2. Paste this address in the **Install from URL** field:
   `https://raw.githubusercontent.com/Travis90x/telegram-joined-cleaner/main/telegram-joined-cleaner.user.js`
3. Click **Install** and confirm.

4. Open `https://web.telegram.org/k/`: a 🧹 button appears at the bottom right.

## Usage

The panel has four buttons:

| Button | What it does |
| --- | --- |
| **Dry run** | Read-only: scrolls through the open list and tells you how many chats are "joined-only". It changes nothing. Always do this first. |
| **Archive** | Archives the "joined-only" chats of the main list, one at a time, checking every action. |
| **Delete…** | Deletes the "joined-only" chats straight from the open list: the main list or, if you opened it (menu ☰ > *Archived Chats*), the archive. It counts the chats, asks for confirmation in the panel and then deletes them in groups. **Permanent.** |
| **Stop** | Stops the running operation. |

The **Only "Deleted Account"** checkbox decides which chats the script touches. Off (default): only chats with a name. On: only chats of deleted accounts. To handle both kinds, run the operation twice, once for each.

**Log.** Below the buttons there is the message log: its text can be selected and copied, the **Copy log** button copies the whole log to the clipboard (handy for pasting into a bug report) and the **Clear log** button empties it. If you change language, the messages already in the log are rewritten in the new language too.

**Language.** The drop-down at the top of the panel chooses the **language of the panel and of the messages**. The languages offered are the files in the repository's [`languages`](languages) folder. The choice is remembered by the browser; if you have not chosen anything, the browser language is used (if there is a file for that language, English otherwise; Chinese from Taiwan, Hong Kong and Macao uses Traditional, the rest Simplified; Norwegian `no` and `nn` use Bokmål; Portuguese uses the Brazilian one). It only changes the script's own texts: Telegram's language is a separate matter (see "Known limitations"). The included languages are the 29 of Telegram Web K: Arabic, Belarusian, Catalan, Chinese (Simplified and Traditional), Croatian, Czech, Dutch, English, Finnish, French, German, Hungarian, Indonesian, Italian, Kazakh, Korean, Malay, Norwegian (Bokmål), Persian, Polish, Portuguese (Brazilian), Romanian, Russian, Serbian, Spanish, Turkish, Ukrainian, Uzbek. The translations, except Italian and English, were written by Claude, starting from the terms Telegram uses in that language (*Archive*, *Select*, *Delete*, *Deleted Account*, the "joined Telegram" phrase), and have **not been reviewed by native speakers**: if you notice a mistake or an unnatural phrase, fix the file and open a pull request.

**Updating.** The **Update languages/script** button (below the log) immediately re-reads the list of languages from GitHub and downloads the one in use again, without waiting for the 24-hour cache, and checks whether a newer version of the script exists. If there is one, it asks for confirmation and opens Tampermonkey's install page, where you confirm: the script never installs itself. If Tampermonkey does not offer the installation (it happens on some phone browsers), use **Install from URL** as in the "Installation" section. Also, with every new version of the script the language cache is cleared automatically.

While an operation is running the panel shrinks to a status line and Stop and lets clicks through, so it does not cover the list (useful on a phone, where the list takes the full width).

## Adding a language

To add a translation you only need a file in the [`languages`](languages) folder: the script reads the list of files there and offers the languages it finds in the drop-down, without changing the script.

1. Copy [`languages/en.json`](languages/en.json) and name it with the lowercase language code: `fr.json`, `de.json`, `es.json`, `pt-BR.json`...
2. Translate **only the values** (the text on the right of the colon), not the keys. Leave placeholders like `{0}` and `{1}` unchanged: the script replaces them with numbers and names (you can change their order in the sentence). `_name` is the language name as shown in the drop-down, written in that language (for example `Français`).
3. Strings you do not translate stay in English, so a partial translation is fine.
4. Check the file (needs Node.js): `node tools/check-languages.js`.
5. Open a pull request with the new file (or push, if you have the permissions).

To fix a translation that already exists (including any of the 29 included ones) edit its file directly and open a pull request.

Rules: plain text only (no HTML, it is shown as is), at most 600 characters per string, only keys that exist in `en.json`. Files that break the rules are ignored, wholly or partly, without breaking the script.

The list of languages and the downloaded files are cached in the browser for 24 hours, so a new language may show up with some delay. To see it immediately press **Update languages/script** in the panel (the cache is also cleared with every new version of the script).

These files translate the **script's panel**. Telegram's own texts (the "joined Telegram" notice, the menu entries) do not need translating here: the script reads them from Telegram's language pack (see "Telegram's language").

## How it recognizes an "empty" chat

A chat is touched only if **all** of these are true:

- it is a chat with a user (positive numeric id, not a group or a channel);
- the title is not empty;
- the preview of the last message is exactly the phrase Telegram shows when a contact joins, with the chat title in place of the name: `<title> joined Telegram` in English, `<title> è ora su Telegram` in Italian, and so on in Telegram's language.

The check looks **only at the preview of the last message**: chats are not opened one by one. It relies on an assumption (not verified) that a chat created by a join has no earlier messages.

## Telegram's language

Telegram Web K shows phrases and menu entries in the language chosen in its settings, and saves in the browser the pack with all its phrases in that language (IndexedDB `tweb-common`, store `session`, key `langPack`; it is there even before signing in). The script **reads** it (read-only) and takes the texts it needs: the phrase for a contact joining (`Chat.Service.PeerJoinedTelegram`, with the name at the start, in the middle or at the end depending on the language), *Archive*, *Unarchive*, *Select*, *Delete*, *Archived Chats*, *Deleted Account* and the plural forms of "N chats selected". So it works with any Telegram language, without translating anything by hand.

- The English texts are always kept among the alternatives and act as a fallback.
- The comparison ignores icons and punctuation and works with any alphabet (Latin, Cyrillic, Arabic...).
- The title of the confirmation dialog ("Delete 38 chats" in English) is not compared word by word: it must contain the number of selected chats.
- At every **Dry run** the log says which Telegram language was read, for example `Telegram language: it`. If the pack cannot be read it says `Telegram language not read: using the English texts`.
- If you change Telegram's language while the page is open, the script re-reads the pack at every operation.
- If reading is not possible (a browser without `indexedDB.databases()`, IndexedDB not answering within 3 seconds, changed data structure) the script uses the English texts: with Telegram in English it works as always, with another language it finds nothing and says so.

## Safety

- Archiving is reversible; deleting is not. Deletion starts only after you press the confirmation button in the panel, and Telegram still shows its own "Delete N chats" dialog: the script confirms it only if the number matches the selected chats.
- Before deleting it checks that **exactly** the planned chats are selected, and no others. Otherwise it stops.
- Chats that are not "joined-only" are never touched, neither in the main list nor in the archive.
- The pace is cautious (about 1-2 seconds per chat), it stops after 3 errors in a row and archives at most 80 chats per run: after about 100 archivings in a row Telegram sometimes stops applying them without giving any error. If the limit message appears, wait a few minutes and run again.
- It does not simulate the Esc key (on Telegram Web K it opens the global search) and never hides confirmation dialogs.

## Privacy

The script does not send your data, your chats or your contacts' names to anyone. The only connection it makes is to GitHub, to read the language files: the list of files in `languages` (`api.github.com`) and the file of the chosen language (`raw.githubusercontent.com`). Only when you press **Update languages/script** does it also read the script file (again from `raw.githubusercontent.com`) to compare its version. The requests carry no cookies and not the address of the Telegram page. The files read are checked (text only, known keys only, limited length) and always shown as text, never as HTML. If the network is blocked or GitHub does not answer, the script still works in English (or in the last language left in the cache). For Telegram's language it reads from the browser, read-only, the language pack that Telegram Web K has already saved (IndexedDB `tweb-common`): it does not modify it and does not send it to anyone.

## Known limitations

- **Telegram's language.** Telegram's texts are read from its language pack saved in the browser (see "Telegram's language"). Tested on the real Telegram (read-only): the pack of all 29 languages that Web K offers contains the needed texts, and the real interface in Italian and Simplified Chinese shows exactly those texts (menu, selection bar, three dots, join phrase). **Archive and Delete… with Telegram in a language other than English have not been run yet on the real Telegram.** It depends on how Telegram Web K saves its data: an update on their side may change it, and in that case the script goes back to the English texts.
- **Panel translations not reviewed.** All of them except Italian and English were written by Claude and not checked by native speakers: they may contain mistakes or unnatural phrasing. They do not affect how the script works, which depends on Telegram's texts read from its own language pack.
- **Languages other than English need GitHub at least once.** English is built into the script; the others are downloaded and then kept in the browser cache.
- **It depends on Telegram Web K's internal names** (`.chatlist-parts`, `.btn-menu-item`, `.popup`...): a Telegram update can break it.
- Telegram Web **K** only, not Web A (`/a/`).
- Already archived chats disappear from the list in the "All" tab and in the other folders, so there the **Dry run** may find 0 chats: that is normal. In the "Contacts" tab they stay in the list: **Dry run** still counts them, **Archive** skips them. The **Dry run** says which tab it counted in.
- Telegram always creates the chat when a contact joins: the script cleans them up, it does not prevent them from coming back.

## What is verified

| What | Result |
| --- | --- |
| Syntax (`node --check`) and language files check (`node tools/check-languages.js`) | ok |
| Logic on a mock page (invented chats, headless Chrome): dry run, archiving, group/different preview left alone, only "Deleted Account", selective deletion with confirmation from archive and from main list, cancel, Stop, compact panel, log always on the latest lines, active tab, message with zero chats, per-run limit, stop after 3 errors, refusal with the archive open, panel in English | 5 times out of 5 for each of the 17 scenarios; in a narrow window (420 px, like a phone) 3 times out of 3 for 2 scenarios |
| Languages, on a mock page with a simulated network: list of the files in the folder (invalid names and folders ignored), loading the file, missing strings in English, 24-hour cache (fresh and stale), no network, GitHub rate limit, bad or malicious files (broken JSON, too big, HTML, odd placeholders), browser language (English and Italian), remembered choice, log rewritten in the new language, built-in English equal to `languages/en.json` | 5 times out of 5 for each of the 10 scenarios. Also checked that the tests fail when the defect is put back (file check switched off) |
| Real Telegram with the owner's account (built-in browser, read-only): the language pack of **all 29 languages** offered by Web K was read and checked (keys present, a single placeholder in the join phrase, non-empty and distinct labels, plurals of "N chats selected" for N from 1 to 60); phrases with bidirectional isolation marks (Arabic, Persian) handled. In four languages (Arabic, German, Indonesian, Turkish) "chats selected" is not translated: Telegram shows English and the script recognizes it | 1 time per language |
| Real Telegram in **Italian** and **Simplified Chinese** (real interface, read-only): the "Select", "Archive" and "Delete" entries (menu and three dots) match the pack's texts; the selection bar is recognized with 1-5 chats; chats with the join phrase are recognized (Italian: 44, of which 24 of deleted accounts, no other similar repeated phrase; Chinese: the 8 found in the loaded part of the list) | 1 time per language |
| Real Telegram: the three dots of the selection bar **do not open with `.click()`**, only with the full click (pointer + mouse); the bar's "X" leaves the selection. The script now uses the full click and the "X" (also to leave the selection by itself if a deletion fails) | found on the real one; fix tested on the mock page, with a negative control that fails as seen on the real one |
| Reading Telegram's language pack **for real** (Telegram Web login page, Claude's built-in browser): all the needed strings found in English and in Italian (for Italian, for example, the join phrase `%@ è ora su Telegram`, *Archivia*, *Estrai*, *Seleziona*, *Elimina*, *Account eliminato* and the plurals of "chat selezionate") | 1 time per language, read-only |
| Telegram's language, on a mock page with a simulated IndexedDB: pack in Italian (with the real phrases), in Russian and in Arabic (invented: different alphabets, multi-form plurals, name in the middle of the phrase); Dry run, Archive, Delete… and "Only Deleted Account" with those languages; no pack; wrong pack; IndexedDB not answering (the panel does not hang) | 5 times out of 5 for each of the 6 scenarios. Also checked that the test fails with the ASCII-only comparison of 0.4.1 on Russian and Arabic |
| **Clear log** button (empties the log, **Copy log** copies nothing on an empty log, button text in Italian, English and Spanish) | 5 times out of 5 |
| Panel in Spanish (`languages/es.json`, 71 keys): texts, Dry run, Archive, Delete… and a log rewritten in another language, on a mock page | 5 times out of 5, with an English and an Italian browser (version 0.5.0, before the other languages) |
| Panel in **each of the 29 languages** (`languages/*.json`, 84 keys), on a mock page with a simulated network: the menu lists them all, for each language the buttons, titles and status are the file's, the **Dry run** writes the log in that language with no placeholders left, no text overflows the panel (not even in the confirmation, maximum width 320 px), the names in the menu are those of the files; file check with `node tools/check-languages.js` (29 files, 0 errors) | 5 times out of 5. Also checked that the test fails with a wrong placeholder in a file and with a too-narrow panel. **The quality of the translations (all except Italian and English) has not been checked by native speakers** |
| Panel language chosen from the browser, on a mock page: `zh-TW`, `zh-HK` → Traditional Chinese; `zh-CN`, `zh-SG`, `zh` → Simplified; `no`, `nn`, `nb` → Bokmål; `pt-PT` and `pt-BR` → Brazilian Portuguese; `de-AT` → German, `fr-CA` → French; languages without a file (`ja`) → English; the browser's choice is not saved | 5 times out of 5 for `zh-TW`, `zh-HK`, `no`, `nn`, `zh-Hant`, `pt-PT`; 1 time for the others. Also checked that with the 0.5.0 logic `zh-TW`, `zh-HK`, `no` and `nn` fail |
| **Update languages/script** button, on a mock page with a simulated network: a new language showing up immediately, the language texts downloaded again, a newer version accepted (the install page opens) or declined, script already up to date, no network (the cache stays as it was), invalid version; cache cleared when the script version changes | 5 times out of 5 for each of the 6 scenarios. Also checked that the test fails without the cache clearing, with the same symptom (new language not showing up) |
| **Copy log** button (with and without the clipboard API, with failure) and the style that makes the log selectable even when the page disables selection | 5 times out of 5 for 2 scenarios. Selecting with a finger on a phone is not verified |
| Reading `raw.githubusercontent.com` and `api.github.com` from the Telegram Web page (no CSP or CORS block), in Claude's built-in browser | 1 time, before the `languages` folder was created: answer 200 for `LICENSE` and for the file list |
| Archiving on the real Telegram Web K (with equivalent code run from the console) | 100 of 100 and 38 of 38 |
| Userscript installed on an Android phone: the panel appears and **Dry run** counts the chats, also with the panel in English and with the "Only Deleted Account" checkbox (versions 0.1.0 and 0.3.0) | 2 times, read-only (in the "Contacts" tab: 261 chats seen, 59 "joined-only") |
| Loading languages from the `languages` folder, copy log and rewritten log, from the installed userscript on the real Telegram | **not verified yet** (version 0.4.0) |
| **Archive** and **Delete…** from the installed userscript, on the real Telegram | **not verified yet** |
| Deletion from the archive on the real Telegram | tried with equivalent code (14 and 38 chats), with 3 of 14 chats not verified individually |
| Deletion straight from the main list on the real Telegram | **not verified** (the menu and the confirmation dialog may use different texts than in the archive) |
| Active tab name in the messages, on the real Telegram | **not verified** |
| Telegram in Italian or other languages, Firefox | **not verified** |

## Development

The script is a single file, with no dependencies and no build. Function and constant names in English, comments in Italian; the user-facing messages live in the files of [`languages`](languages) (English is also copied into the script and the two copies must stay equal). [`tools/check-languages.js`](tools/check-languages.js) checks the language files.

## License

[MIT](LICENSE)
