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
| `cape-title-ink.js` | tutto: stile, maschera, fluido | ~36 KB |

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

## Come funziona, in tre righe

- Il titolo nero **non si tocca**: resta dov'e', com'e'.
- Sopra ci va un palco isolato col fondo nero, grande quanto la scritta. Dentro:
  una **copia** della scritta in bianco, e sopra il canvas del fluido in
  `multiply`. Bianco per bianco = inchiostro, tutto il resto resta nero. Poi un
  filtro SVG legge quel grigio e lo trasforma in **trasparenza**. Risultato:
  l'inchiostro si vede solo dentro i glifi, con i bordi antialiasati veri del
  font — perche' la lettera che fa da stampo e' la lettera vera, non un disegno.
- Il fluido e' lo stesso solutore del divider `ink-bleed`: advezione, forze,
  vorticita', divergenza, venti giri di pressione, gradiente.

Serve WebGL2 con i buffer float. Sotto i 992px, su `prefers-reduced-motion`, su
schermi senza mouse o senza WebGL non parte proprio: la scritta resta nera,
esattamente com'e' adesso. Quando l'header esce dallo schermo o la scheda va in
background la fisica si ferma.

---

## Le due cose che rendono l'effetto possibile

Vale la pena saperle, perche' senza non funziona e non e' ovvio dal codice.

**1. La tensione superficiale (`TENSION`).** L'advezione bilineare sfuma il
colorante a ogni passo: senza un termine che lo ricompatti, dopo un minuto le
lettere sono vuote. `TENSION` moltiplica il colorante per un guadagno: sotto la
soglia del quadro il velo si ritira, sopra la spalla si ingrossa, al centro
della goccia non tocca niente. E' la manopola che fa restare **gocce** invece di
diventare foschia.

**2. La calamita tira il colorante, non il fluido.** In un fluido incomprimibile
una corrente che converge in un punto non esiste: la proiezione di pressione la
cancella, perche' vorrebbe dire ammassare materia dove non ci sta. Il richiamo
sul campo di moto da' quindi solo agitazione (`MAG_STIR`). L'attrazione vera sta
su un passaggio separato che sposta il **colorante**, che e' un tracciante
trascinato da una forza esterna — limatura di ferro dentro l'olio: si muove la
limatura, non l'olio.

E il campo e' schiacciato sull'orizzontale (`MAG_FLAT`): l'inchiostro vive in una
striscia alta due dita, e col campo rotondo il puntatore che passava sotto al
titolo si portava giu' l'inchiostro e la scritta si svuotava.

---

## Dove si mette mano

Tutte le manopole stanno nel blocco `IMPOSTAZIONI` in cima al file. Le tre che
si toccano davvero:

| Manopola | Cos'e' | Ora |
|---|---|---|
| `FEED` / `DYE_DISS` | quanto inchiostro vive nelle lettere: il loro rapporto | `0.80` / `0.38` |
| `BLOB_SIZE` | grandezza della goccia, in % dell'altezza della scritta | `20` |
| `MAG_PULL` | quanto tira la calamita, in larghezze del box al secondo | `0.075` |

Con i valori attuali l'inchiostro copre circa il **38%** dell'area delle lettere
a riposo, e sale verso il 48% dove il puntatore lo raduna. Alzare `FEED` o
abbassare `DYE_DISS` riempie, il contrario svuota.

Si provano dal vivo dalla console, senza ripubblicare:

```js
capeTitleInk.set({ MAG_PULL: 0.12, FEED: 0.6 })   // cambia e guarda
capeTitleInk.read()                                // com'e' adesso
capeTitleInk.burst()                               // una versata in piu'
capeTitleInk.pause()  /  .resume()                 // spegni / riaccendi
```

Se il titolo cambia classe nel Designer, l'unica riga da aggiornare e' `SEL`
(ora `h1.filled-heading`).
