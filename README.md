🇮🇹 [Leggi il README in italiano](README_ITA.md)

# Telegram Joined Cleaner

A [Tampermonkey](https://www.tampermonkey.net/) userscript that cleans up the chat list of **Telegram Web K** (`https://web.telegram.org/k/`): it removes the chats Telegram creates when a contact joins Telegram, i.e. the ones that only contain the "*name* joined Telegram" notice.

- **Archives** those chats (reversible).
- **Deletes** the same chats (straight from the main list or from the archive), only when you ask and after a confirmation in the panel (permanent).
- Panel in **Italian or English**, your choice.
- It only runs in your browser, sends nothing to any server and does not use Telegram's internal APIs: it repeats the gestures you would do by hand (context menu, Archive, Select, Delete).

> **Status: version 0.3.0, under testing.** The logic has been tested on a mock page that imitates Telegram Web K, and the **Dry run** (read-only) on the real Telegram; **Archive** and **Delete…** on the real Telegram are still to be completed (see "What is verified").

## Installation

1. Install Tampermonkey (Chrome, Edge, Firefox).
2. On Chrome 138 or newer: on the Tampermonkey extension details page turn on **Allow User Scripts** (or Developer mode). Not needed on Firefox.
3. Open [`telegram-joined-cleaner.user.js`](telegram-joined-cleaner.user.js) in "Raw" view (or the address `https://raw.githubusercontent.com/Travis90x/telegram-joined-cleaner/main/telegram-joined-cleaner.user.js`) and confirm the installation in Tampermonkey. If the script is already installed, Tampermonkey offers the update.
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

The drop-down at the top of the panel chooses the **language of the panel and of the messages** (Italiano or English). The choice is remembered by the browser; if you have not chosen anything, the browser language is used (Italian if the browser is Italian, English otherwise). It only changes the script's own texts: Telegram's language is a separate matter (see "Known limitations").

While an operation is running the panel shrinks to a status line and Stop and lets clicks through, so it does not cover the list (useful on a phone, where the list takes the full width).

## How it recognizes an "empty" chat

A chat is touched only if **all** of these are true:

- it is a chat with a user (positive numeric id, not a group or a channel);
- the title is not empty;
- the preview of the last message is exactly `<title> joined Telegram`.

The check looks **only at the preview of the last message**: chats are not opened one by one. It relies on an assumption (not verified) that a chat created by a join has no earlier messages.

## Safety

- Archiving is reversible; deleting is not. Deletion starts only after you press the confirmation button in the panel, and Telegram still shows its own "Delete N chats" dialog: the script confirms it only if the number matches the selected chats.
- Before deleting it checks that **exactly** the planned chats are selected, and no others. Otherwise it stops.
- Chats that are not "joined-only" are never touched, neither in the main list nor in the archive.
- The pace is cautious (about 1-2 seconds per chat), it stops after 3 errors in a row and archives at most 80 chats per run: after about 100 archivings in a row Telegram sometimes stops applying them without giving any error. If the limit message appears, wait a few minutes and run again.
- It does not simulate the Esc key (on Telegram Web K it opens the global search) and never hides confirmation dialogs.

## Known limitations

- **Telegram must be in English.** The "joined Telegram" notice and Telegram's menu entries (Archive, Select, Delete...) are compared with the English text; the language of the script's panel is unrelated. With Telegram in another language the script finds nothing and says so. To add a language, edit the `TEXTS` object at the top of the file with the exact strings read from the interface (Settings > Language).
- **It depends on Telegram Web K's internal names** (`.chatlist-parts`, `.btn-menu-item`, `.popup`...): a Telegram update can break it.
- Telegram Web **K** only, not Web A (`/a/`).
- In the "Contacts" tab already archived chats stay in the list: **Dry run** still counts them, **Archive** skips them.
- Telegram always creates the chat when a contact joins: the script cleans them up, it does not prevent them from coming back.

## What is verified

| What | Result |
| --- | --- |
| Syntax (`node --check`) | ok |
| Logic on a mock page (invented chats, headless Chrome): dry run, archiving, group/different preview left alone, only "Deleted Account", selective deletion with confirmation from archive and from main list, cancel, Stop, compact panel while running, per-run limit, stop after 3 errors, refusal with the archive open | 5 times out of 5 for each of the 11 scenarios; in a narrow window (420 px, like a phone) 3 times out of 3 for 2 scenarios |
| Panel language selection (Italian/English): panel texts, messages, deletion confirmation, remembered choice, browser language as default | 5 times out of 5 for 4 scenarios, on the mock page |
| Archiving on the real Telegram Web K (with equivalent code run from the console) | 100 of 100 and 38 of 38 |
| Userscript installed on an Android phone: the panel appears and **Dry run** counts the chats (version 0.1.0) | 1 time (read-only) |
| **Archive** and **Delete…** from the installed userscript, on the real Telegram | **not verified yet** |
| Deletion from the archive on the real Telegram | tried with equivalent code (14 and 38 chats), with 3 of 14 chats not verified individually |
| Deletion straight from the main list on the real Telegram | **not verified** (the menu and the confirmation dialog may use different texts than in the archive) |
| Telegram in Italian or other languages, Firefox | **not verified** |

## Development

A single file, no dependencies, no build. Function and constant names in English, comments in Italian; user-facing messages are in both Italian and English (see `I18N` at the top of the file).

## License

[MIT](LICENSE)
