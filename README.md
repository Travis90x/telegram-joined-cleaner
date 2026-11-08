# Telegram Joined Cleaner

Userscript per [Tampermonkey](https://www.tampermonkey.net/) che ripulisce la lista chat di **Telegram Web K** (`https://web.telegram.org/k/`) dalle chat create quando un contatto si iscrive a Telegram, cioè quelle che contengono solo l'avviso "*nome* joined Telegram".

- **Archivia** quelle chat (reversibile).
- **Cancella dall'archivio** le stesse chat, solo se lo chiedi e dopo una conferma nel pannello (definitivo).
- Funziona solo nel browser, non invia niente a nessun server e non usa le API interne di Telegram: ripete i gesti che faresti a mano (menu contestuale, Archive, Select, Delete).

> **Stato: versione 0.1.0, in collaudo.** La logica è stata provata su una pagina finta che imita Telegram Web K; la prova sul Telegram vero va ancora completata (vedi "Cosa è verificato").

## Installazione

1. Installa Tampermonkey (Chrome, Edge, Firefox).
2. Su Chrome 138 o più recente: nella pagina dei dettagli dell'estensione Tampermonkey attiva **Allow User Scripts** (o la Modalità sviluppatore). Su Firefox non serve.
3. Apri il file [`telegram-joined-cleaner.user.js`](telegram-joined-cleaner.user.js) in formato "Raw" e conferma l'installazione di Tampermonkey.
4. Apri `https://web.telegram.org/k/`: in basso a destra compare il pulsante 🧹.

## Uso

Il pannello ha quattro pulsanti:

| Pulsante | Cosa fa |
| --- | --- |
| **Prova** | Solo lettura: scorre la lista aperta e dice quante chat sono "solo joined". Non modifica niente. Da fare sempre per primo. |
| **Archivia** | Archivia le chat "solo joined" della lista principale, una alla volta, verificando ogni azione. |
| **Cancella archiviate…** | Da usare con l'archivio aperto (menu ☰ > *Archived Chats*). Conta le chat da cancellare, chiede conferma nel pannello e poi le cancella a gruppi. |
| **Stop** | Ferma l'operazione in corso. |

La casella **Includi "Deleted Account"** è spenta di default: le chat con account eliminati restano dove sono.

## Come riconosce una chat "vuota"

Una chat viene toccata solo se **tutte** queste condizioni sono vere:

- è una chat con un utente (id numerico positivo, non un gruppo o un canale);
- il titolo non è vuoto;
- l'anteprima dell'ultimo messaggio è esattamente `<titolo> joined Telegram`.

Il controllo guarda **solo l'anteprima dell'ultimo messaggio**: le chat non vengono aperte una per una. Si parte dall'ipotesi (non verificata) che una chat creata da un'iscrizione non abbia messaggi precedenti.

## Sicurezza

- Archiviare è reversibile; cancellare no. La cancellazione parte solo dopo che hai premuto il pulsante di conferma nel pannello, e Telegram mostra comunque la sua finestra "Delete N chats": lo script la conferma solo se il numero coincide con le chat selezionate.
- Prima di cancellare controlla che siano selezionate **esattamente** le chat previste, e nessun'altra. Altrimenti si ferma.
- Nell'archivio le chat che non sono "solo joined" non vengono mai toccate.
- Il ritmo è prudente (circa 1-2 secondi per chat), si ferma dopo 3 errori di fila e archivia al massimo 80 chat per giro: dopo circa 100 archiviazioni di fila Telegram a volte smette di applicarle senza dare errori. Se compare il messaggio del limite, aspetta qualche minuto e rilancia.
- Non simula il tasto Esc (su Telegram Web K apre la ricerca globale) e non nasconde mai le finestre di conferma.

## Limiti noti

- **Solo interfaccia in inglese.** Sia l'avviso "joined Telegram" sia le voci di menu (Archive, Select, Delete...) sono confrontati con il testo inglese. Con un'altra lingua lo script non trova niente e lo dice. Per aggiungere una lingua bisogna modificare l'oggetto `TEXTS` in cima al file, con le stringhe esatte lette dall'interfaccia (Impostazioni > Language).
- **Dipende dai nomi interni di Telegram Web K** (`.chatlist-parts`, `.btn-menu-item`, `.popup`...): un aggiornamento di Telegram può romperlo.
- Solo Telegram Web **K**, non Web A (`/a/`).
- Nella scheda "Contacts" le chat già archiviate restano in lista: la **Prova** le conta comunque, **Archivia** le salta.
- Telegram crea sempre la chat quando un contatto si iscrive: lo script le ripulisce, non impedisce che ricompaiano.

## Cosa è verificato

| Cosa | Esito |
| --- | --- |
| Sintassi (`node --check`) | ok |
| Logica su pagina finta (chat inventate, headless Chrome): prova, archiviazione, gruppo/anteprima diversa non toccati, "Deleted Account" esclusi, cancellazione selettiva con conferma, annulla, Stop, limite per giro, stop dopo 3 errori, rifiuto con archivio chiuso/aperto | 5 volte su 5 per ognuno degli 8 scenari |
| Archiviazione su Telegram Web K vero (con codice equivalente eseguito dalla console) | 100 su 100 e 38 su 38 |
| Come userscript Tampermonkey vero, su Telegram vero | **non ancora verificato** |
| Cancellazione dall'archivio su Telegram vero | provata con codice equivalente (14 e 38 chat), con 3 chat su 14 non verificate singolarmente |
| Italiano o altre lingue, Firefox | **non verificato** |

## Sviluppo

Il file è uno solo, senza dipendenze né build. Nomi di funzioni e costanti in inglese, commenti e messaggi in italiano.

## Licenza

[MIT](LICENSE)
