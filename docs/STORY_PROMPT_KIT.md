# PokeRPG — Kit di prompt per le storie
*Versione 0.5 · 2026-09-29 · Responsabile: PM · Stato: bozza in attesa di approvazione del PO*

Come scrivere una storia per PokeRPG con **il tuo Claude Code**. La Parte A è per te, l'autore. La Parte B è il regolamento che il tuo Claude Code segue. Il contratto è lo Story Schema; questo kit spiega solo come usarlo bene.

---

# Parte A — Per l'autore

## A1. Cosa ti serve
- **Claude Code**, più **Node.js** e **git** sul tuo computer.
- Un clone del repo pubblico `Ciprognola/PokeRPG`, con `npm install` eseguito una volta. La sezione "Scrivere una storia" del README riporta i passaggi esatti.
- **Un pacchetto personaggio per ogni PNG** (personaggio non giocante), creato con la Guida agli sprite ed esportato dallo Slicer (Asset Spec §4). Per un primo test puoi riusare i personaggi dello Story Template in `templates/story_template/characters/`.
- Non ti serve un personaggio giocante: chi gioca porta sempre il proprio.

## A2. Pianifica la storia (5 minuti)
Compila questo schema. Lo incollerai in Claude Code.

```
Titolo:
Lingua: (it, en, …)
Nome dell'autore:
Idea in una riga:
Tono: (accogliente, giallo, comico, …)
Luoghi: (scegli dalla libreria; Claude Code te li elenca)
PNG: nome · carattere · cartella del pacchetto personaggio (indica quale
     pacchetto è di chi: Claude Code non vede gli sprite)
Missioni, in ordine, ognuna con i suoi compiti:
  Missione 1: <titolo>
    - <compito: parla con / vai a / guarda una scena>
    - …
Finale: (cosa succede dopo l'ultimo compito)
```

**Tieni piccola la prima storia:** 1–2 missioni, 3–6 compiti, 1–3 PNG e 1–2 luoghi. Far crescere una storia che funziona è più veloce che sistemarne una grande e rotta.

## A3. Prompt iniziale
Apri Claude Code nella cartella del repo e incolla:

```
Stai scrivendo un pacchetto storia per PokeRPG. Prima leggi
docs/STORY_PROMPT_KIT.md, Parte B, e seguila alla lettera. Poi costruisci
questa storia:

<incolla qui il tuo piano A2>

I pacchetti personaggio dei miei PNG sono in: <percorso della cartella>
Mostrami lo schema della storia (luoghi, PNG, missioni e compiti) prima di
scrivere qualsiasi JSON. Dopo la mia approvazione costruisci il pacchetto,
esegui story:check finché non riporta 0 errori e dimmi quali avvisi restano.
```

## A4. Prima di condividere
- [ ] `story:check` riporta **0 errori** e hai letto ogni avviso.
- [ ] Hai ripercorso lo schema a mente: ogni compito dice chiaramente dove andare o con chi parlare.
- [ ] Nessuna battuta nomina o descrive l'eroe, a parte `{player.name}`, e nessuna gli attribuisce un genere (B3).
- [ ] `version` è aumentata di 1 se è l'aggiornamento di una storia già condivisa.
- [ ] Condividi `story_<id>.zip`, non file sparsi.

## A5. Cosa le storie non possono fare al lancio
Oggetti, inventario, scelte o bivi · lotte o creature · nuove mappe, musiche o suoni (solo libreria) · codice di qualsiasi tipo · definire l'eroe. Sono regole, non bug. Chiedi nuove funzioni sul repo invece di aggirarle.

---

# Parte B — Regole per il Claude Code dell'autore

## B1. Da leggere prima
1. `docs/STORY_SCHEMA.md`: il contratto. Ogni campo e comando che usi deve esserci.
2. `docs/GDD.md` §1 e §4–§8: come il gioco esegue quello che scrivi.
3. `docs/ASSET_SPEC.md` §8.1: il formato dei dati dei luoghi della libreria.
4. `templates/story_template/`: un esempio funzionante di ogni campo e comando.

## B2. Procedura
1. **Trova la libreria.** I file dei luoghi (`loc_*.json`) sono in `assets/locations/`; gli id validi di `track` e `sfx` sono in `assets/registry/audio.json`. Per ogni luogo richiesto dall'autore leggi `size`, `collision`, `spawns`, `exits`, `areas` e `music`. Usa solo luoghi che esistono.
2. **Proponi lo schema** (luoghi, collegamenti uscita → punto di comparsa, PNG, missioni e compiti in ordine, scene) e aspetta l'approvazione dell'autore.
3. **Costruisci il pacchetto.** Crea `story_<id>/` dove indica la sezione "Scrivere una storia" del README. Scrivi `story.json` da zero, usando lo Story Template solo come riferimento; non tenere mai contenuti del template che la storia non usa. `id` e `name` dei PNG appartengono alla storia e non devono coincidere con il nome del pacchetto. Copia il pacchetto personaggio di ogni PNG, senza modifiche, in `characters/`. Imposta `language` sulla lingua della storia (`it` per l'italiano).
4. **Controlla il pacchetto.** Esegui `npm run story:check -- <cartella della storia>` (vedi `--help`). Correggi ogni errore e ripeti finché non riporta **0 errori**. Poi correggi ogni avviso, o spiega all'autore perché va bene così.
5. **Impacchetta.** Esegui `npm run story:pack -- <cartella della storia>`. Scrive `story_<id>.zip` (Story Schema §1) e lo controlla. Non creare lo zip a mano.
6. **Resoconto:** il percorso del file, i conteggi (missioni, compiti, PNG, scene), gli avvisi rimasti e tutto ciò che hai semplificato.

## B3. Regole ferree
- **Solo lo schema.** Non inventare campi, comandi, tipi di compito, segnaposto o forme di condizione. Se la storia ha bisogno di qualcosa che lo schema non prevede, dillo all'autore e proponi la soluzione più vicina che lo schema consente.
- **Solo la libreria.** Ogni `asset`, punto di comparsa, uscita, area, `track` e `sfx` deve esistere nella libreria (B2 punto 1). Non creare né modificare luoghi, musiche o suoni.
- **L'eroe appartiene a chi gioca.** Non dare mai al personaggio giocante un nome, un genere, un aspetto, un'età o un passato. Per indicarlo usa solo `{player.name}` o il "tu". Le battute di `player` devono andare bene per qualsiasi personaggio.
- **Italiano neutro.** In italiano aggettivi e participi rivelano il genere ("sei stanco/stanca", "sei arrivato/arrivata"). Nelle battute rivolte al personaggio giocante, o che parlano di lui o lei, riformula in modo neutro: "Hai fatto un ottimo lavoro" invece di "Sei stato bravo", "Che piacere vederti" invece di "Benvenuto". Vale anche per le battute di `player`.
- **Caselle.** Metti le posizioni dei PNG, i punti di comparsa e gli obiettivi di `reach` su caselle percorribili (`.`) dentro la mappa. Un percorso `move` di una scena parte dalla casella attuale dell'attore (Story Schema §7.1), e ogni punto è in linea retta (stessa x o stessa y) rispetto al precedente, attraversando solo caselle percorribili. Controlla queste caselle a mano rispetto a `collision`: il validatore non può farlo (Story Schema §11).
- **Limiti di testo.** Una battuta ha al massimo 120 caratteri (`{player.name}` conta 12, una lettera accentata conta 1) e un obiettivo al massimo 60. Dividi i discorsi lunghi in più battute invece di tagliarne il senso.
- **Logica.**
  - Dichiara ogni flag in `flags`.
  - L'ultimo dialogo di ogni PNG non ha `when`.
  - Ogni uscita che serve alla storia è collegata, e ogni luogo è raggiungibile da `start`.
  - Ogni PNG richiesto da un compito `talk` è posizionato e visibile mentre quel compito è attivo.
- **Non toccare** `docs/`, `src/`, `templates/`, la libreria o qualsiasi file fuori dalla cartella della storia.

## B4. Qualità della scrittura
- **Gli obiettivi dicono dove e chi:** "Trova Rosa al forno", non "Continua".
- **Un'idea per battuta.** Una battuta si legge in 1–3 frasi brevi. Il gioco la divide da solo in pagine da 2 righe e aggiunge il nome di chi parla: non scriverlo nel testo.
- **Ogni PNG ha un dialogo predefinito** valido per tutta la storia, più varianti per i momenti chiave (usa i flag).
- **Scene brevi:** meno di ~15 comandi. Metti una dissolvenza in uscita e una in entrata attorno a un `warp`.
- **Chiudi dopo l'ultimo compito** con una breve scena finale: l'`onComplete.scene` dell'ultimo compito (Story Schema §6.1).
- **Conosci le regole di esecuzione** in Story Schema §6.1 e §7.1 (quando si completa `reach`, cosa vedono le condizioni durante `onComplete`, il comportamento dei PNG nelle scene, lo schermo nero all'inizio della storia).

## B5. Correggere gli errori comuni
| Il messaggio parla di | Soluzione tipica |
|---|---|
| luogo / punto di comparsa / uscita / area sconosciuti | Rileggi il `loc_*.json` e usa il nome esatto |
| casella bloccata o fuori dalla mappa | Spostala su una casella `.` dentro `size` |
| percorso non rettilineo | Aggiungi un punto d'angolo tra le due caselle |
| battuta oltre 120 / obiettivo oltre 60 | Dividi la battuta / accorcia l'obiettivo |
| ultimo dialogo con `when` | Aggiungi in fondo un dialogo predefinito senza condizione |
| flag non dichiarato | Aggiungilo a `flags` |
| errori del personaggio | Esporta di nuovo quel PNG con lo Slicer; non modificare il foglio a mano |

---

## Registro delle decisioni
| Data | Decisione |
|---|---|
| 2026-09-28 | v0.1: il kit si rivolge al Claude Code dell'autore (Brief v0.8). Parte A per gli autori, Parte B con le regole per Claude Code |
| 2026-09-28 | v0.2: correzioni dallo spike M2 sulle storie: missioni con compiti in A2, percorsi di libreria e template, abbinamento dei PNG da parte dell'autore, `story.json` scritto da zero, `story:pack`, regole di esecuzione |
| 2026-09-29 | v0.3: B3 "Caselle" cita Story Schema §11 per ciò che il validatore non controlla e §7.1 per la casella di partenza di `move` |
| 2026-09-29 | v0.4: kit in italiano (Brief §2); regola dell'italiano neutro rispetto al genere (B3); le lettere accentate contano 1 carattere; `language` impostato in B2 |
| 2026-09-29 | v0.5: B4 spiega le pagine da 2 righe e il nome di chi parla aggiunto dal gioco (UI Spec v0.1) |
