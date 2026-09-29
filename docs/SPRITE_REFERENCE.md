# PokeRPG — Guida agli sprite
*Versione 0.3 · 2026-09-29 · Responsabile: PM · Stato: bozza per lo spike M2 · Pubblica*

Come creare con un'IA per immagini il tuo personaggio che cammina e portarlo in PokeRPG.
Non devi azzeccare dimensioni esatte in pixel: lo **Slicer** (https://ciprognola.github.io/PokeRPG/slicer/) ritaglia, ridimensiona, allinea e controlla tutto. Il tuo compito è dare istruzioni chiare all'IA e scegliere i risultati migliori.
Le regole tecniche dietro questa guida sono nell'Asset Spec.

**I prompt restano in inglese.** Le IA per immagini seguono l'inglese in modo più affidabile, quindi i modelli di prompt qui sotto sono in inglese. Sostituisci solo la parte tra `{ }`, descrivendo il personaggio in inglese.

---

## 1. Cosa stai creando
- **24 fotogrammi:** il tuo personaggio che cammina in 4 direzioni, 6 fotogrammi ciascuna.
- **Ordine delle righe:** 1 verso chi guarda · 2 cammina a sinistra · 3 cammina a destra · 4 si allontana.
- **Ordine dei fotogrammi in ogni riga:** contatto · abbassamento · passaggio · contatto · abbassamento · passaggio. È un unico ciclo di camminata: un passo con un piede, poi con l'altro.
- **Visuale:** classico RPG dall'alto, con la telecamera leggermente sopra il personaggio. La luce viene dall'alto a sinistra.

*Visuale e illuminazione sono provvisorie finché lo stile artistico ufficiale non è fissato.*

## 2. Regole che l'IA deve seguire
| Sì | No |
|---|---|
| Corpo intero in ogni fotogramma, dalla testa ai piedi | Piedi o testa tagliati |
| Stesso personaggio, vestiti e dimensioni in ogni fotogramma | Vestiti, colori o proporzioni che cambiano tra un fotogramma e l'altro |
| Sfondo **magenta pieno e uniforme `#FF00FF`** | Sfumature, pavimenti, scenari o texture sullo sfondo |
| Bordi morbidi dipinti vanno bene | Ombre a terra (le disegna il gioco) |
| Viso neutro | Espressioni (stanno nei ritratti dei dialoghi) |
| Niente magenta né rosa acceso sul personaggio | Testo, numeri, griglie, etichette, filigrane |

**Perché il magenta?** Lo Slicer rimuove lo sfondo in base al suo colore. Tutto ciò che nel personaggio è vicino al magenta viene rimosso insieme allo sfondo.

---

## 3. Passo 1 — Disegna il tuo personaggio
Crea prima un'immagine chiara del personaggio. Tutto quello che viene dopo la copia.

**Modello di prompt**
> Full-body character design of {your character: age, build, hair, clothes, colours}, standing still, facing the viewer, neutral expression, arms relaxed. Hand-painted 2D game art, soft painterly brushwork, seen from slightly above like a top-down RPG, light from the top-left. Solid flat magenta background (#FF00FF). No shadow on the ground, no text.

Generane alcune, tieni quella che ti piace di più e salvala. È la tua **immagine concept**.

## 4. Passo 2 — Crea il foglio della camminata (consigliato: un'unica immagine)
L'IA disegna tutti i 24 fotogrammi in un'unica immagine: è il modo che mantiene il personaggio più coerente.

1. **Scarica i modelli di posa** dalla schermata iniziale dello Slicer. Mostrano un manichino grigio in tutte le 24 pose, nell'ordine giusto.
2. **Proporzioni:** 4:3, alla risoluzione più alta disponibile.
3. **Riferimenti:** usa il **modello di posa a griglia** come riferimento di composizione/struttura, e la tua **immagine concept** come riferimento di stile o d'immagine.
4. Prompt:

> Sprite sheet of the character from the reference image, arranged as an evenly spaced grid of 4 rows and 6 columns, one full-body figure per cell. Row 1 walking toward the viewer, row 2 walking left, row 3 walking right, row 4 walking away. Each row is one walk cycle: contact, down, passing, contact, down, passing. Same character, same outfit, same size and proportions in every cell, feet at the same height across each row. Hand-painted 2D game art, top-down RPG view, light from the top-left. Solid flat magenta background (#FF00FF). No ground, no shadows, no grid lines, no text, no numbers.

5. Generane diversi e tieni il migliore. Miglioralo creando variazioni di un buon risultato invece di scrivere prompt nuovi.

## 5. Alternativa — fotogramma per fotogramma
Usala se il foglio in un'unica immagine continua a cambiare il personaggio tra un fotogramma e l'altro.
1. Per ognuno dei 24 fotogrammi usa come riferimento di composizione il **modello di posa singola** corrispondente (`walk_down_00.png` … `walk_up_05.png`), e l'immagine concept come riferimento.
2. Prompt:

> The character from the reference image in exactly this pose, full body. Hand-painted 2D game art, top-down RPG view, light from the top-left. Solid flat magenta background (#FF00FF). No shadow, no text.

3. Salva ogni risultato con il nome del file del modello. Lo Slicer ordina i fotogrammi in base a quel nome.

Richiede più tempo, ma ogni fotogramma è più facile da controllare.

---

## 6. Controlla prima di ritagliare
- [ ] 24 figure, nell'ordine giusto di righe e colonne
- [ ] Lo stesso personaggio in ogni fotogramma (vestiti, colori, capelli, proporzioni)
- [ ] Teste e piedi interamente visibili, e niente che tocchi il bordo dell'immagine
- [ ] Uno sfondo magenta pulito e uniforme, senza ombre
- [ ] Niente magenta o rosa sul personaggio
- [ ] La riga di spalle conserva i dettagli posteriori (code di cavallo, elastici, zaini, code). Spesso le IA li perdono

## 7. Ritaglia
1. Apri lo Slicer. Funziona su telefono e computer, anche offline una volta installato.
2. Aggiungi il foglio (o i 24 fotogrammi), dai un nome al personaggio e imposta il livello **body**.
3. Tocca **Elabora**, poi guarda l'anteprima della camminata in tutte e 4 le direzioni.
4. Risolvi le segnalazioni. Gli **errori** bloccano l'esportazione; gli **avvisi** sono consigli. Tocca una segnalazione per andare al suo fotogramma, e sposta di poco un fotogramma se è fuori posto.
5. Tocca **Esporta**. Ottieni `chr_<nome>.zip`, pronto da importare nel gioco.

Un personaggio completamente vestito va bene come unico livello **body**.

---

## 8. Livelli extra (sperimentale)
I livelli separati (vestiti, capelli, cappello…) ti permettono di cambiare abiti in seguito. Per le IA è difficile, e lo stiamo testando nello spike M2.
1. Ritaglia prima il personaggio.
2. Dai all'IA il foglio body esportato come riferimento di composizione, e chiedi **solo** il nuovo elemento, nella stessa griglia, su magenta, senza disegnare nient'altro.
3. Nello Slicer scegli **Controlla fogli esistenti**, carica il personaggio, aggiungi il nuovo livello con il tipo giusto, poi controlla e sistema.

Se l'IA continua a disegnare il personaggio intero, per ora torna a un unico livello body già vestito.

## 9. Consigli per Adobe Firefly
- Usa il modello di immagini Firefly più recente e imposta le proporzioni 4:3 prima di iterare.
- **Riferimento di composizione = modello di posa.** Parti con il cursore dell'intensità tra metà e alto. Se le pose si discostano, alzalo. Se il personaggio inizia a somigliare al manichino grigio, abbassalo.
- **Riferimento di stile = la tua immagine concept.** Trasmette tavolozza e pennellate, ma non garantisce lo stesso viso o gli stessi vestiti.
- Se il personaggio continua a cambiare, prova uno dei modelli partner di Firefly Boards che accettano un'immagine caricata come riferimento, e dagli la tua immagine concept.
- Firefly tende ad aggiungere ombre a terra, quindi tieni "no shadow" in ogni prompt.

## 10. Risoluzione dei problemi
| Problema | Prova |
|---|---|
| Il personaggio cambia tra i fotogrammi | Usa il metodo fotogramma per fotogramma (§5) o un modello con immagine di riferimento (§9) |
| Le righe sono nell'ordine sbagliato | Rigenera. Lo Slicer non può riordinare un'unica immagine a griglia |
| Le gambe non sembrano camminare | Alza l'intensità del riferimento di composizione |
| Lo Slicer rimuove parti del personaggio | Qualcosa è troppo vicino al magenta: cambiane il colore nel prompt |
| Molte segnalazioni su "riga più bassa" o "altezza" | Di solito si risolvono spostando di poco i fotogrammi. Se ogni fotogramma è fuori, i piedi sono tagliati o nascosti |
| Un alone rosa attorno al personaggio | Rigenera con "flat magenta, no gradient". I bordi morbidi vanno bene; gli aloni colorati no |

## 11. Registro delle decisioni
| Data | Decisione |
|---|---|
| 2026-09-28 | v0.1 per lo spike M2: colore chiave magenta, foglio in un'unica immagine con i modelli di posa come metodo principale, fotogramma per fotogramma come alternativa, livelli sperimentali, consigli per Firefly |
| 2026-09-28 | v0.2: aggiunto il controllo della vista di spalle dopo che il primo personaggio M2 ha perso la coda di cavallo nella riga di spalle |
| 2026-09-29 | v0.3: guida in italiano (Brief §2); i prompt per le IA restano in inglese; nomi dei pulsanti dello Slicer in italiano (Elabora, Esporta, Controlla fogli esistenti) |
