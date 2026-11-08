# Telegram Joined Cleaner

🇬🇧 [English version](README.md)

Userscript per [Tampermonkey](https://www.tampermonkey.net/) che ripulisce la lista chat di **Telegram Web K** (`https://web.telegram.org/k/`) dalle chat create quando un contatto si iscrive a Telegram, cioè quelle che contengono solo l'avviso "*nome* joined Telegram".

- **Archivia** quelle chat (reversibile).
- **Cancella** le stesse chat (direttamente dalla lista principale o dall'archivio), solo se lo chiedi e dopo una conferma nel pannello (definitivo).
- Pannello in **italiano o inglese**, a scelta.
- Funziona solo nel browser, non invia niente a nessun server e non usa le API interne di Telegram: ripete i gesti che faresti a mano (menu contestuale, Archive, Select, Delete).

> **Stato: versione 0.3.0, in collaudo.** La logica è stata provata su una pagina finta che imita Telegram Web K e la **Prova** (sola lettura) su Telegram vero; **Archivia** e **Cancella…** sul Telegram vero vanno ancora completate (vedi "Cosa è verificato").

## Installazione

1. Installa Tampermonkey (Chrome, Edge, Firefox).
2. Su Chrome 138 o più recente: nella pagina dei dettagli dell'estensione Tampermonkey attiva **Allow User Scripts** (o la Modalità sviluppatore). Su Firefox non serve.
3. Apri il file [`telegram-joined-cleaner.user.js`](telegram-joined-cleaner.user.js) in formato "Raw" (oppure l'indirizzo `https://raw.githubusercontent.com/Travis90x/telegram-joined-cleaner/main/telegram-joined-cleaner.user.js`) e conferma l'installazione di Tampermonkey. Se lo script è già installato, Tampermonkey propone l'aggiornamento.
4. Apri `https://web.telegram.org/k/`: in basso a destra compare il pulsante 🧹.

## Uso

Il pannello ha quattro pulsanti:

| Pulsante | Cosa fa |
| --- | --- |
| **Prova** | Solo lettura: scorre la lista aperta e dice quante chat sono "solo joined". Non modifica niente. Da fare sempre per primo. |
| **Archivia** | Archivia le chat "solo joined" della lista principale, una alla volta, verificando ogni azione. |
| **Cancella…** | Cancella direttamente le chat "solo joined" della lista aperta: la lista principale oppure, se l'hai aperto (menu ☰ > *Archived Chats*), l'archivio. Conta le chat, chiede conferma nel pannello e poi le cancella a gruppi. **Definitivo.** |
| **Stop** | Ferma l'operazione in corso. |

La casella **Solo "Deleted Account"** decide quali chat tocca lo script. Spenta (default): solo le chat con un nome. Accesa: solo quelle di account eliminati. Per trattarle tutte, esegui l'operazione due volte, una per tipo.

Il menu a tendina in alto nel pannello sceglie la **lingua del pannello e dei messaggi** (Italiano o English). La scelta viene ricordata dal browser; se non hai scelto niente si usa la lingua del browser (italiano se è italiano, altrimenti inglese). Cambia solo i testi dello script: la lingua di Telegram resta un'altra cosa (vedi "Limiti noti").

Mentre un'operazione è in corso il pannello si riduce a stato e Stop e lascia passare i clic, così non copre la lista (utile sul telefono, dove la lista occupa tutta la larghezza).

## Come riconosce una chat "vuota"

Una chat viene toccata solo se **tutte** queste condizioni sono vere:

- è una chat con un utente (id numerico positivo, non un gruppo o un canale);
- il titolo non è vuoto;
- l'anteprima dell'ultimo messaggio è esattamente `<titolo> joined Telegram`.

Il controllo guarda **solo l'anteprima dell'ultimo messaggio**: le chat non vengono aperte una per una. Si parte dall'ipotesi (non verificata) che una chat creata da un'iscrizione non abbia messaggi precedenti.

## Sicurezza

- Archiviare è reversibile; cancellare no. La cancellazione parte solo dopo che hai premuto il pulsante di conferma nel pannello, e Telegram mostra comunque la sua finestra "Delete N chats": lo script la conferma solo se il numero coincide con le chat selezionate.
- Prima di cancellare controlla che siano selezionate **esattamente** le chat previste, e nessun'altra. Altrimenti si ferma.
- Le chat che non sono "solo joined" non vengono mai toccate, né nella lista principale né nell'archivio.
- Il ritmo è prudente (circa 1-2 secondi per chat), si ferma dopo 3 errori di fila e archivia al massimo 80 chat per giro: dopo circa 100 archiviazioni di fila Telegram a volte smette di applicarle senza dare errori. Se compare il messaggio del limite, aspetta qualche minuto e rilancia.
- Non simula il tasto Esc (su Telegram Web K apre la ricerca globale) e non nasconde mai le finestre di conferma.

## Limiti noti

- **Telegram deve essere in inglese.** L'avviso "joined Telegram" e le voci di menu di Telegram (Archive, Select, Delete...) sono confrontati con il testo inglese; la lingua del pannello dello script non c'entra. Con Telegram in un'altra lingua lo script non trova niente e lo dice. Per aggiungere una lingua bisogna modificare l'oggetto `TEXTS` in cima al file, con le stringhe esatte lette dall'interfaccia (Impostazioni > Language).
- **Dipende dai nomi interni di Telegram Web K** (`.chatlist-parts`, `.btn-menu-item`, `.popup`...): un aggiornamento di Telegram può romperlo.
- Solo Telegram Web **K**, non Web A (`/a/`).
- Nella scheda "Contacts" le chat già archiviate restano in lista: la **Prova** le conta comunque, **Archivia** le salta.
- Telegram crea sempre la chat quando un contatto si iscrive: lo script le ripulisce, non impedisce che ricompaiano.

## Cosa è verificato

| Cosa | Esito |
| --- | --- |
| Sintassi (`node --check`) | ok |
| Logica su pagina finta (chat inventate, headless Chrome): prova, archiviazione, gruppo/anteprima diversa non toccati, solo "Deleted Account", cancellazione selettiva con conferma da archivio e da lista principale, annulla, Stop, pannello compatto durante le operazioni, limite per giro, stop dopo 3 errori, rifiuto con archivio aperto | 5 volte su 5 per ognuno degli 11 scenari; in finestra stretta (420 px, come un telefono) 3 volte su 3 per 2 scenari |
| Scelta della lingua del pannello (italiano/inglese): testi del pannello, messaggi, conferma di cancellazione, scelta ricordata, lingua del browser come default | 5 volte su 5 per 4 scenari, su pagina finta |
| Archiviazione su Telegram Web K vero (con codice equivalente eseguito dalla console) | 100 su 100 e 38 su 38 |
| Userscript installato su un telefono Android: il pannello compare e **Prova** conta le chat (versione 0.1.0) | 1 volta (sola lettura) |
| **Archivia** e **Cancella…** dallo userscript installato, su Telegram vero | **non ancora verificati** |
| Cancellazione dall'archivio su Telegram vero | provata con codice equivalente (14 e 38 chat), con 3 chat su 14 non verificate singolarmente |
| Cancellazione direttamente dalla lista principale su Telegram vero | **non verificata** (il menu e la finestra di conferma potrebbero avere testi diversi dall'archivio) |
| Telegram in italiano o in altre lingue, Firefox | **non verificato** |

## Sviluppo

Il file è uno solo, senza dipendenze né build. Nomi di funzioni e costanti in inglese, commenti e messaggi in italiano (i messaggi sono anche in inglese: vedi `I18N` in cima al file).

## Licenza

[MIT](LICENSE)
