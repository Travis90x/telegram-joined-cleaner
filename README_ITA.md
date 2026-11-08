# Telegram Joined Cleaner

🇬🇧 [English version](README.md)

Userscript per [Tampermonkey](https://www.tampermonkey.net/) che ripulisce la lista chat di **Telegram Web K** (`https://web.telegram.org/k/`) dalle chat create quando un contatto si iscrive a Telegram, cioè quelle che contengono solo l'avviso "*nome* joined Telegram".

- **Archivia** quelle chat (reversibile).
- **Cancella** le stesse chat (direttamente dalla lista principale o dall'archivio), solo se lo chiedi e dopo una conferma nel pannello (definitivo).
- Pannello in **italiano, inglese o spagnolo**, a scelta. Altre lingue si aggiungono con un solo file nella cartella [`languages`](languages) (vedi "Aggiungere una lingua").
- Funziona solo nel browser e non usa le API interne di Telegram: ripete i gesti che faresti a mano (menu contestuale, Archive, Select, Delete). Non invia i tuoi dati a nessun server: l'unica connessione è la lettura dei file di lingua da GitHub (vedi "Privacy").

> **Stato: versione 0.4.1, in collaudo.** La logica è stata provata su una pagina finta che imita Telegram Web K e la **Prova** (sola lettura) su Telegram vero; **Archivia** e **Cancella…** sul Telegram vero vanno ancora completate (vedi "Cosa è verificato").

## Installazione

1. Installa Tampermonkey (Chrome, Edge, Firefox).
2. Su Chrome 138 o più recente: nella pagina dei dettagli dell'estensione Tampermonkey attiva **Allow User Scripts** (o la Modalità sviluppatore). Su Firefox non serve.
3. Installa lo script in uno di questi due modi.

**Dal link (il più semplice).** Apri il file [`telegram-joined-cleaner.user.js`](telegram-joined-cleaner.user.js) in formato "Raw" (oppure l'indirizzo qui sotto) e conferma l'installazione di Tampermonkey. Se lo script è già installato, Tampermonkey propone l'aggiornamento.

**Con "Install from URL" (utile se il link non apre la pagina di installazione, per esempio su alcuni browser del telefono).**
1. Apri Tampermonkey e vai su **Utility** (Utilità, in inglese *Utilities*).
2. Incolla questo indirizzo nel campo **Install from URL**:
   `https://raw.githubusercontent.com/Travis90x/telegram-joined-cleaner/main/telegram-joined-cleaner.user.js`
3. Clicca **Install** e conferma.

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

**Registro.** Sotto i pulsanti c'è il registro dei messaggi: il testo si può selezionare e copiare, e il pulsante **Copia log** copia tutto il registro negli appunti (comodo per incollarlo in una segnalazione). Se cambi lingua, anche i messaggi già scritti nel registro si riscrivono nella lingua nuova.

**Lingua.** Il menu a tendina in alto nel pannello sceglie la **lingua del pannello e dei messaggi**. Le lingue proposte sono quelle dei file presenti nella cartella [`languages`](languages) del repository. La scelta viene ricordata dal browser; se non hai scelto niente si usa la lingua del browser (se c'è un file per quella lingua, altrimenti inglese). Cambia solo i testi dello script: la lingua di Telegram è un'altra cosa (vedi "Limiti noti"). Le lingue incluse sono italiano, inglese e spagnolo; la traduzione spagnola è stata scritta da Claude e non è stata rivista da un madrelingua: le correzioni sono benvenute con una pull request.

**Aggiornamento.** Il pulsante **Aggiorna lingue/script** (sotto il registro) rilegge subito da GitHub l'elenco delle lingue e riscarica quella in uso, senza aspettare le 24 ore della cache, e controlla se esiste una versione nuova dello script. Se c'è, ti chiede conferma e apre la pagina di installazione di Tampermonkey, dove confermi tu: lo script non si installa mai da solo. Se Tampermonkey non propone l'installazione (succede su alcuni browser del telefono), usa **Install from URL** come nella sezione "Installazione". Inoltre, a ogni nuova versione dello script la cache delle lingue si svuota da sola.

Mentre un'operazione è in corso il pannello si riduce a stato e Stop e lascia passare i clic, così non copre la lista (utile sul telefono, dove la lista occupa tutta la larghezza).

## Aggiungere una lingua

Per aggiungere una traduzione basta un file nella cartella [`languages`](languages): lo script legge l'elenco dei file presenti e propone nel menu le lingue trovate, senza modificare lo script.

1. Copia [`languages/en.json`](languages/en.json) e chiamalo con il codice della lingua, in minuscolo: `fr.json`, `de.json`, `es.json`, `pt-BR.json`...
2. Traduci **solo i valori** (il testo a destra dei due punti), non le chiavi. Lascia invariati i segnaposto come `{0}` e `{1}`: vengono sostituiti dallo script con numeri e nomi (puoi cambiarne l'ordine nella frase). `_name` è il nome della lingua come compare nel menu, scritto nella lingua stessa (per esempio `Français`).
3. Le stringhe che non traduci restano in inglese, quindi puoi anche tradurre solo una parte.
4. Controlla il file (serve Node.js): `node tools/check-languages.js`.
5. Apri una pull request con il nuovo file (oppure fai push, se hai i permessi).

Regole: solo testo semplice (niente HTML, viene mostrato com'è), massimo 600 caratteri per stringa, solo le chiavi presenti in `en.json`. I file che non rispettano le regole vengono ignorati in tutto o in parte, senza rompere lo script.

L'elenco delle lingue e i file scaricati restano in cache nel browser per 24 ore, quindi una lingua nuova può comparire con un po' di ritardo. Per vederla subito premi **Aggiorna lingue/script** nel pannello (la cache si svuota anche a ogni nuova versione dello script).

Attenzione: questi file traducono il **pannello dello script**, non i testi di Telegram. Con Telegram in un'altra lingua l'avviso "joined Telegram" e le voci di menu cambiano e lo script non le riconosce (vedi "Limiti noti").

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

## Privacy

Lo script non invia a nessuno i tuoi dati, le tue chat o i nomi dei tuoi contatti. L'unica connessione che fa è verso GitHub, per leggere i file di lingua: l'elenco dei file di `languages` (`api.github.com`) e il file della lingua scelta (`raw.githubusercontent.com`). Solo quando premi **Aggiorna lingue/script** legge anche il file dello script (sempre da `raw.githubusercontent.com`) per confrontarne la versione. Le richieste non contengono cookie né l'indirizzo della pagina di Telegram. I file letti vengono controllati (solo testo, solo chiavi note, lunghezza limitata) e mostrati sempre come testo, mai come HTML. Se la rete è bloccata o GitHub non risponde, lo script funziona lo stesso in inglese (o nell'ultima lingua rimasta in cache).

## Limiti noti

- **Telegram deve essere in inglese.** L'avviso "joined Telegram" e le voci di menu di Telegram (Archive, Select, Delete...) sono confrontati con il testo inglese; la lingua del pannello dello script non c'entra. Con Telegram in un'altra lingua lo script non trova niente e lo dice. Per aggiungere una lingua di Telegram bisogna modificare l'oggetto `TEXTS` in cima al file, con le stringhe esatte lette dall'interfaccia (Impostazioni > Language).
- **Le lingue diverse dall'inglese richiedono GitHub almeno una volta.** L'inglese è incorporato nello script; le altre si scaricano e poi restano in cache nel browser.
- **Dipende dai nomi interni di Telegram Web K** (`.chatlist-parts`, `.btn-menu-item`, `.popup`...): un aggiornamento di Telegram può romperlo.
- Solo Telegram Web **K**, non Web A (`/a/`).
- Le chat già archiviate spariscono dalla lista nella scheda "All" e nelle altre cartelle, quindi lì la **Prova** può trovare 0 chat: è normale. Nella scheda "Contacts" invece restano in lista: la **Prova** le conta comunque, **Archivia** le salta. La **Prova** scrive in quale scheda ha contato.
- Telegram crea sempre la chat quando un contatto si iscrive: lo script le ripulisce, non impedisce che ricompaiano.

## Cosa è verificato

| Cosa | Esito |
| --- | --- |
| Sintassi (`node --check`) e controllo dei file di lingua (`node tools/check-languages.js`) | ok |
| Logica su pagina finta (chat inventate, headless Chrome): prova, archiviazione, gruppo/anteprima diversa non toccati, solo "Deleted Account", cancellazione selettiva con conferma da archivio e da lista principale, annulla, Stop, pannello compatto, registro sempre sulle righe recenti, scheda attiva, messaggio con zero chat, limite per giro, stop dopo 3 errori, rifiuto con archivio aperto, pannello in inglese | 5 volte su 5 per ognuno dei 15 scenari; in finestra stretta (420 px, come un telefono) 3 volte su 3 per 2 scenari |
| Lingue, su pagina finta con rete simulata: elenco dei file della cartella (nomi non validi e cartelle ignorati), caricamento del file, stringhe mancanti in inglese, copia in cache di 24 ore (fresca e scaduta), senza rete, limite di GitHub, file sbagliati o malevoli (JSON rotto, troppo grande, HTML, segnaposto strani), lingua del browser (inglese e italiano), scelta ricordata, registro riscritto nella lingua nuova, inglese incorporato uguale a `languages/en.json` | 5 volte su 5 per ognuno dei 10 scenari. Provato anche che i test falliscono quando il difetto viene rimesso (controllo dei file spento) |
| Pannello in spagnolo (`languages/es.json`, 71 chiavi): testi, Prova, Archivia, Cancella… e registro riscritto in un'altra lingua, su pagina finta | 5 volte su 5, con browser in inglese e in italiano. La qualità della traduzione non è verificata da un madrelingua |
| Pulsante **Aggiorna lingue/script**, su pagina finta con rete simulata: lingua nuova che compare subito, testi della lingua riscaricati, versione nuova accettata (si apre la pagina di installazione) o rifiutata, script già aggiornato, rete assente (la cache resta com'è), versione non valida; cache svuotata quando cambia la versione dello script | 5 volte su 5 per ognuno dei 6 scenari. Provato anche che il test fallisce senza lo svuotamento della cache, con lo stesso sintomo (lingua nuova che non compare) |
| Pulsante **Copia log** (con e senza l'API degli appunti, con errore) e stile che rende il registro selezionabile anche se la pagina disattiva la selezione | 5 volte su 5 per 2 scenari. La selezione con il dito sul telefono non è verificata |
| Lettura di `raw.githubusercontent.com` e `api.github.com` dalla pagina di Telegram Web (nessun blocco di CSP o CORS), nel browser integrato di Claude | 1 volta, prima di creare la cartella `languages`: risposta 200 per `LICENSE` e per l'elenco dei file |
| Archiviazione su Telegram Web K vero (con codice equivalente eseguito dalla console) | 100 su 100 e 38 su 38 |
| Userscript installato su un telefono Android: il pannello compare e **Prova** conta le chat, anche con il pannello in inglese e con la casella "Solo Deleted Account" (versioni 0.1.0 e 0.3.0) | 2 volte, sola lettura (nella scheda "Contacts": 261 chat viste, 59 "solo joined") |
| Caricamento delle lingue dalla cartella `languages`, copia log e registro riscritto, sullo userscript installato su Telegram vero | **non ancora verificati** (versione 0.4.0) |
| **Archivia** e **Cancella…** dallo userscript installato, su Telegram vero | **non ancora verificati** |
| Cancellazione dall'archivio su Telegram vero | provata con codice equivalente (14 e 38 chat), con 3 chat su 14 non verificate singolarmente |
| Cancellazione direttamente dalla lista principale su Telegram vero | **non verificata** (il menu e la finestra di conferma potrebbero avere testi diversi dall'archivio) |
| Nome della scheda attiva nei messaggi, su Telegram vero | **non verificato** |
| Telegram in italiano o in altre lingue, Firefox | **non verificato** |

## Sviluppo

Lo script è un solo file, senza dipendenze né build. Nomi di funzioni e costanti in inglese, commenti in italiano; i messaggi per l'utente stanno nei file di [`languages`](languages) (l'inglese è copiato anche nello script e le due copie devono restare uguali). [`tools/check-languages.js`](tools/check-languages.js) controlla i file di lingua.

## Licenza

[MIT](LICENSE)
