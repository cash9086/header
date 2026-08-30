# The Cape — inchiostro dentro la scritta

La scritta nera dell'header di **The Cape Studio** diventa una finestra: dentro
le lettere galleggia inchiostro bianco vivo, con la stessa fisica del fluido
gia' usata nell'header e nella sezione `ink-bleed`. Fuori dalle lettere non si
vede niente. L'inchiostro sente il puntatore ovunque sia nella pagina e ci va
incontro.

Un file solo, nessuna dipendenza, niente da creare nel Designer: il titolo
esistente non si tocca.

| File | Cosa e' | Peso |
|---|---|---|
| `cape-title-ink.js` | tutto: stile, maschera, fluido | ~64 KB |

---

## Come si include

**In fondo al footer** — Pages → The Cape Studio → Settings → Custom code →
*Before `</body>` tag*, come ultima riga:

```html
<script defer src="https://cdn.jsdelivr.net/gh/cash9086/header@VERSIONE/cape-title-ink.js"></script>
```

`VERSIONE` e' lo SHA di un commit — quaranta caratteri, copiabile dalla pagina
dei commit — oppure un tag. Stessa regola di `cape-header.js`: lo SHA e'
immutabile, quindi la cache di jsDelivr non e' mai un problema e non c'e'
niente da svuotare.

Il CSS se lo scrive da solo: non c'e' niente da mettere nell'`<head>`, e non
c'e' nessun ordine da rispettare rispetto a `cape-header.js` — i due non si
toccano (uno lavora sul menu, l'altro dentro il titolo dell'hero).

---

## Come funziona, in quattro righe

- Il titolo nero **non si tocca**: resta dov'e', com'e'.
- Sopra ci va un palco isolato col fondo nero, grande quanto la scritta. Dentro:
  una **copia** della scritta in bianco, e sopra il canvas del fluido in
  `multiply`. Bianco per bianco = inchiostro, tutto il resto resta nero. Poi un
  filtro SVG legge quel grigio e lo trasforma in **trasparenza**. Risultato:
  l'inchiostro si vede solo dentro i glifi, con i bordi antialiasati veri del
  font — perche' la lettera che fa da stampo e' la lettera vera, non un disegno.
- Il fluido e' lo stesso solutore del divider `ink-bleed`: advezione, forze,
  vorticita', divergenza, venti giri di pressione, gradiente.
- Il palco ricopia la **transform** della scritta a ogni frame: scorrendo, il
  titolo esce venendo addosso a chi guarda, e l'inchiostro esce con lui. (Il
  palco e' piazzato in coordinate di layout apposta, percio' la transform non
  lo raggiungerebbe da sola: va ricopiata, con l'origine spostata di `PAD`.)

Serve WebGL2 con i buffer float. Sotto i 992px, su `prefers-reduced-motion`, su
schermi senza mouse o senza WebGL non parte proprio: la scritta resta nera,
esattamente com'e' adesso. Quando l'header esce dallo schermo o la scheda va in
background la fisica si ferma.

---

## Le cose che rendono l'effetto possibile

Vale la pena saperle, perche' senza non funziona e non e' ovvio dal codice.

**1. La tensione superficiale (`TENSION`).** L'advezione bilineare sfuma il
colorante a ogni passo: senza un termine che lo ricompatti, dopo un minuto le
lettere sono vuote. `TENSION` moltiplica il colorante per un guadagno: sotto la
soglia del quadro il velo si ritira, sopra la spalla si ingrossa, al centro
della goccia non tocca niente. E' la manopola che fa restare **gocce** invece di
diventare foschia. Va letta insieme al movimento: piu' l'inchiostro corre, piu'
l'advezione lo sfuma, quindi piu' forte deve essere quello che lo ricompatta.

**2. La piastra e' un ciclo, non una spinta (`CYCLE`).** In una lampada vera la
cera scalda, sale, in cima si raffredda e ricade — ed e' sfasata da goccia a
goccia. Con una spinta costante salgono tutte insieme, si appoggiano in alto e
li' restano: fluido, ma non una lampada. Ogni sorgente ha il suo giro, con un
passo diverso, e la spinta va **sottozero** in mezzo ciclo: senza la fase in cui
la cera ricade non c'e' nessun giro, c'e' solo roba che galleggia.

**3. Il mouse si segue muovendo le SORGENTI, non il colorante (`MAG_HOME`).**
Questa e' la scoperta che ha cambiato il file. Il richiamo sul colorante e' un
*gather*, e un gather sotto sforzo e' patologico in tutti e due i versi: senza
correzioni schiaccia l'inchiostro sotto la dimensione di un texel e **se lo
mangia** (per questo `MAG_PULL` era rimasto a 0.075 — alzarlo svuotava le
lettere invece di riempirle); con la sola correzione del nucleo si ribalta e lo
**fabbrica**, e in un minuto le lettere sono bianche piene. Spostare invece le
sorgenti non ha patologie: l'inchiostro *nasce* dove sta il puntatore, e quanto
ce n'e' in giro resta deciso da `FEED` e `DYE_DISS`. `MAG_HOME` contrae tutta la
fila di sorgenti verso il mouse — tutte, non solo le vicine, perche' con un
raggio meta' riga continua a versare dov'era ed e' esattamente quello che si
legge come "segue poco".

**4. `MAG_PULL` resta, ma per quello che sa fare.** Inclinare le gocce gia' in
acqua, piano. Perche' anche piano sia sano ci sono volute due correzioni, che
sono nel commento lungo su `PULLD`: il **nucleo** (`MAG_CORE`), che fuori tira
dentro e dentro spinge fuori, cosi' esiste un raggio di equilibrio invece di un
punto di collasso; e il fattore **(1 - div)**, il jacobiano della mappa
all'indietro, che rende lo spostamento uno spostamento invece di una
moltiplicazione.

**5. La scia (`MAG_DRAG`).** La calamita dice dove va l'inchiostro ma non fa
niente *mentre* il mouse si muove, quindi un gesto veloce e uno lento
finiscono uguali. La scia e' il dito nell'acqua: il puntatore trascina il fluido
con la propria velocita' e la risposta arriva sul frame.

E il campo e' schiacciato sull'orizzontale (`MAG_FLAT`): l'inchiostro vive in una
striscia alta due dita, e col campo rotondo il puntatore che passava sotto al
titolo si portava giu' l'inchiostro e la scritta si svuotava.

---

## Dove si mette mano

Tutte le manopole stanno nel blocco `IMPOSTAZIONI` in cima al file. Quelle che
si toccano davvero:

| Manopola | Cos'e' | Ora |
|---|---|---|
| `BLOB_SIZE` / `BLOBS` | grandezza della goccia (% dell'altezza scritta) e quante ne girano | `10` / `26` |
| `FEED` / `DYE_DISS` | quanto inchiostro vive nelle lettere: il loro rapporto | `2.40` / `0.30` |
| `MAG_HOME` | **quanto segue il mouse.** Contrazione delle sorgenti verso il puntatore | `0.22` |
| `CYCLE` | il giro della cera, in rad/s (0.42 = un ciclo ogni ~15s) | `0.42` |
| `TENSION` | quanto le gocce restano gocce invece di diventare foschia | `3.20` |
| `MAG_DRAG` | la scia: quanto il puntatore trascina il fluido muovendosi | `1.20` |
| `MAG_PULL` | l'inclinazione delle gocce gia' in acqua verso il puntatore | `0.100` |

Con i valori attuali l'inchiostro copre circa il **23%** del riquadro del titolo,
misurato su una riga larga otto volte la sua altezza, e resta li' mentre la
lampada gira (fra il 20% e il 30% a seconda della fase del ciclo). Alzare `FEED`
o abbassare `DYE_DISS` riempie, il contrario svuota.

`MAG_HOME` oltre `0.3` lascia vuote le lettere agli estremi della riga: le
sorgenti si stringono troppo attorno al mouse e dove non ci sono l'inchiostro si
asciuga in un paio di secondi. `0.22` e' il punto in cui la riga resta piena e la
direzione si legge lo stesso.

Si provano dal vivo dalla console, senza ripubblicare:

```js
capeTitleInk.set({ MAG_HOME: 0.35, BLOB_SIZE: 8 }) // cambia e guarda
capeTitleInk.read()                                // com'e' adesso
capeTitleInk.burst()                               // una versata in piu'
capeTitleInk.pause()  /  .resume()                 // spegni / riaccendi
```

Se il titolo cambia classe nel Designer, l'unica riga da aggiornare e' `SEL`
(ora `h1.filled-heading`).
