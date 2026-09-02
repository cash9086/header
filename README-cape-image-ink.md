# The Cape — l'inchiostro che inverte, dentro le immagini

Sulle immagini della pagina **The Cape Studio** il cursore diventa un pennello e
sotto la punta resta dell'inchiostro. L'inchiostro non ha un colore suo: e'
l'immagine stessa rovesciata. Vive solo dentro il rettangolo dell'immagine — sui
bordi il fluido rimbalza, fuori non esce niente.

Un file solo, nessuna dipendenza, **niente da creare nel Designer**: le immagini
non si toccano e il cursore che c'e' gia' non si tocca.

| File | Cosa e' | Peso |
|---|---|---|
| `cape-image-ink.js` | tutto: stile, fluido, composizione, cursore | ~50 KB |

---

## La fisica

E' quella della repo `header`: lo stesso solutore del pennello di
`cape-header.js` — advezione, forze, vorticita', divergenza, venti giri di
pressione, gradiente — con le stesse manopole (`BRUSH_SIZE`, `BRUSH_AMT`,
`BRUSH_PULL`, `BRUSH_DRY`, `BRUSH_GRAVITY`). Di quel vecchio effetto e' rimasta
solo quella: il resto e' nuovo.

Il pezzo che conta e' in `FORCES`:

```
cc    = c/uRef
heavy = cc*(0.16 + 0.84*cc*cc)
vel.y -= uGravity*heavy*dt
```

il peso non e' proporzionale alla quantita', ci va quasi col cubo: **il denso
cola, il velo resta sospeso.** E' la ragione per cui questo inchiostro fa macchie
e non sfumature.

---

## L'inversione — la domanda vera

Un negativo puro (`invert(1)`, cioe' `1-c` per canale) ribalta anche la **tinta**:
un tramonto caldo diventa blu acido. E' l'effetto che si vede ovunque, ed e' il
motivo per cui sembra un filtro e non una scelta.

Ho messo a confronto in un browser vero, sulle due immagini della pagina — la
foto in bianco e nero controluce e quella a colori al tramonto — cinque famiglie
di inversione: negativo puro, solarizzazione (Sabattier, la piega a meta' scala
della camera oscura), `difference` ancorato alla crema del sito, `exclusion`, e
l'inversione di sola luminanza.

Sul bianco e nero funzionano quasi tutte. Sul colore no: la solarizzazione va nel
verde-magenta, l'`exclusion` slava tutto in un grigio piatto, il negativo puro fa
il blu acido.

**Vince l'inversione di sola luminanza**, ed e' una riga:

```
invert(1) hue-rotate(180deg) saturate(.92) contrast(1.04)
```

- `invert(1)` ribalta il canale: il chiaro diventa scuro.
- `hue-rotate(180deg)` **riporta la tinta da dove veniva.** Restano invertite
  solo la luce e l'ombra. E' tutto qui.
- `saturate(.92)` un filo di colore in meno: il negativo di una foto satura
  sempre un po' troppo, e la sobrieta' e' la differenza fra "virato" e
  "psichedelico".
- `contrast(1.04)` riprende lo stacco che l'inversione appiattisce.

Risultato: il sole diventa scuro, le ombre si accendono, **ma il caldo resta
caldo** — la stampa sembra virata al bronzo, non fotocopiata. Sulla foto in
bianco e nero e' un negativo pulito e corretto in gamma. E' il tono invertito
della camera oscura, non l'inversione del menu contestuale.

Altre due gia' pronte, da provare al volo dalla console:

```js
capeImageInk.set({ GRADE: 'invert(1) hue-rotate(180deg) saturate(0)' })    // argento
capeImageInk.set({ GRADE: 'invert(1) hue-rotate(180deg) sepia(.22)' })     // virata seppia
```

### Due dettagli che si vedono solo da vicino

- **Il bordo bagnato** (`RIM`). L'inchiostro vero, asciugando, si raduna sul
  perimetro della macchia — e' il coffee-ring, il bordo piu' carico del centro.
  Senza, la macchia sembra un'ombra sfocata; con, sembra bagnata.
- **Il velo caldo** (`VEIL_A`, 5%). Steso solo dentro l'inchiostro: toglie il
  grigio-fango che l'inversione lascia nei mezzi toni e lega la macchia alla
  palette della pagina. Sopra 0.1 si vede il colore e ridiventa un filtro.

---

## Come e' composto

- L'immagine **non si tocca**: resta dov'e', com'e'.
- Sopra ci va un canvas 2D grande esattamente quanto l'immagine.
- Una **copia gia' invertita** viene disegnata **una volta sola** in una cache
  fuori schermo — il filtro non cambia mai, rifarlo a ogni frame sarebbe l'unica
  cosa cara di tutto l'effetto. Ogni frame si copia la cache e la si ritaglia con
  `destination-in` usando la maschera del fluido. Due blit, nient'altro.
- **Niente lettura di pixel**: nessun `getImageData`, nessuna texture WebGL
  costruita dall'immagine. Quindi nessun problema di CORS con il CDN di Webflow,
  e funziona uguale su `<img>` e su `background-image` — compreso lo stage delle
  opere, che cambia quadro da solo (quando cambia, la copia si ricuoce).
- Il canvas si infila **sotto** le didascalie posizionate: si dipinge sotto al
  testo, non addosso.

---

## Il cursore

Sull'immagine il cursore e' **una cosa sola: la parola `VIEW`**. Il cursore che
c'e' gia' in pagina — onda, anello, sua scritta — si spegne per intero finche'
sei sull'immagine, e torna da solo quando esci.

C'era anche un simbolo di pennello e l'ho tolto. Fra l'anello grande, il simbolo
e la scritta erano **tre segni diversi tutti nello stesso punto**, e tre segni
insieme non si leggono. Che stai dipingendo non serve dirlo: lo dice
l'inchiostro, che e' molto piu' grande e molto piu' chiaro di un simbolino da
26px. Chi lo rivuole, la meccanica e' ancora tutta li': `capeImageInk.set({ NIB: true })`.

La parola resta per tutto il tempo — e' l'invito a cliccare, e un invito che
compare solo quando ti fermi non lo vede nessuno — ma insegue il puntatore con
un filo di ritardo (`LABEL_LAG`), e non si stacca mai piu' di `LABEL_CAP` pixel
nemmeno su una sciabolata.

Le manopole della scritta: `LABEL_SZ` il corpo, `LABEL_TR` il tracking, `LABEL_DY`
quanto sta sotto al puntatore, `LABEL_MIN` la sua opacita' mentre la mano corre
(a 0 torna a comparire solo a mano ferma). Se su una certa immagine non la vuoi,
`data-cursor=""`.

### Il passaggio fra i due

Il logo che sparisce e la parola che appare non sono due dissolvenze: sono un
cambio di turno. Il logo esce (180ms, ease-in) e la parola **sale da sotto dentro
una finestra che la ritaglia**, mentre il tracking si stringe — arriva larga e si
raccoglie. E' la stessa lingua delle righe di testo che gia' salgono nella
sezione delle opere, non un movimento inventato per l'occasione.

In uscita la parola **prosegue verso l'alto** invece di tornare giu': non e'
l'animazione al contrario, e' la stessa che continua. Nel frattempo il logo
rientra, cosi' non ci sono mai due cose insieme sullo schermo.

`LAB_IN` la salita (460ms), `LAB_OUT` l'uscita (260ms), `LAB_DELAY` quanto
aspetta prima di partire (90ms — sotto i 60 si accavalla col logo che esce),
`LABEL_TR_IN` quanto tracking in piu' ha in partenza.

### Perche' il cursore della pagina si spegne intero

Prima ne spegnevo i tre pezzi uno per uno — l'onda, l'anello, la sua scritta.
Basta pero' che quel codice cambi un nome di classe e uno dei tre resta acceso
addosso al nostro. Spegnere il contenitore `#capecur` non ha quel problema:
qualunque cosa ci sia dentro, e' spenta.

Il suo codice **non si tocca lo stesso**: continua a girare e a scrivere le sue
opacita' inline, semplicemente non si vede. Se un domani togli questo file,
torna tutto com'era senza rimettere mano a niente.

**Il blocco `#capecur` gia' in pagina non va toccato.** Viene messo a riposo da
una regola CSS con `!important`, che batte le opacita' inline che quel codice
scrive a ogni frame. Se un domani togli questo file, il cursore torna com'era da
solo.

---

## Come si include

Il repo `the-cape` e' **privato** e jsDelivr non serve repo privati: il file va
messo in **`cash9086/header`**, che e' gia' pubblico e serve gli altri due.

1. Copia `cape-image-ink.js` in `cash9086/header` (GitHub → *Add file* →
   *Upload files*, oppure *Create new file* e incolla). Commit su `main`.
2. Copia lo SHA del commit dalla pagina dei commit.
3. **Pages → The Cape Studio → Settings → Custom code → Before `</body>` tag**,
   come ultima riga:

```html
<script defer src="https://cdn.jsdelivr.net/gh/cash9086/header@SHA/cape-image-ink.js"></script>
```

Il CSS se lo scrive da solo: non c'e' niente da mettere nell'`<head>`. Non c'e'
nessun ordine da rispettare rispetto agli altri script della pagina.

`SHA` sono i quaranta caratteri del commit: e' immutabile, quindi la cache di
jsDelivr non e' mai un problema e non c'e' niente da svuotare. In sviluppo si
puo' puntare a `@main` e svuotare a mano aprendo una volta
`https://purge.jsdelivr.net/gh/cash9086/header@main/cape-image-ink.js` — comodo
mentre si prova, da non lasciare in produzione.

### Su quali immagini agisce

Su quelle a cui dai la classe **`ink-invert`** nel Designer. Gliela dai e ce
l'hanno, gliela togli e non ce l'hanno piu': non c'e' nient'altro da toccare, da
nessuna parte. Funziona sia sull'`<img>` sia su un contenitore (lo stage delle
opere e' un div). Se preferisci un attributo, `data-ink-invert` fa lo stesso.

E' apposta **separata da `cape-view`**, che governa un'altra cosa — l'anello con
la scritta del cursore che c'e' gia'. Le due si combinano da sole:

| Classi sull'elemento | Cosa succede |
|---|---|
| `ink-invert` + `cape-view` | pennello e inchiostro — le tre immagini di adesso |
| solo `ink-invert` | pennello e inchiostro anche dove l'anello non c'era |
| solo `cape-view` | l'anello con VIEW come sempre, nessun inchiostro |
| nessuna delle due | niente, come oggi |

**Da fare la prima volta.** Prima l'effetto stava su `cape-view`, quindi su tre
elementi. Ora nessuno ce l'ha finche' non gli aggiungi `ink-invert`. I tre sono:

- l'immagine *Longsleeve Essential off white* — `Image 14 · cape-view · copy`
- l'immagine *Longsleeve Essential black* — `Image 14 · cape-view`
- lo stage delle opere — `.studio-stage · cape-view`

Selezioni l'elemento e nel pannello Style aggiungi `ink-invert` in coda alle
classi che ha gia'. Non serve darle nessuna proprieta': resta vuota, e' solo
un'etichetta.

**Una nota sulla scritta.** Il cursore mostra `VIEW` per tutto il tempo che sta
sull'immagine. Su una che prende l'inchiostro ma **non si apre**, mettile
`data-cursor=""` (Element settings → Custom attributes, valore vuoto) e la
scritta non compare: resta solo il pennello. Con un valore diverso —
`data-cursor="Zoom"` — scrive quello.

> Attenzione che oggi nessuna delle tre immagini e' dentro un Link: `VIEW`
> promette un clic che non succede. O le avvolgi in un Link Block, o su quelle
> che restano ferme metti `data-cursor=""`.

---

## Dove si mette mano

Tutte le manopole stanno nel blocco `IMPOSTAZIONI` in cima al file. Le quattro
che si toccano davvero:

| Manopola | Cos'e' | Ora |
|---|---|---|
| `SEL` | chi prende l'inchiostro | `.ink-invert, [data-ink-invert]` |
| `LABEL_MIN` | opacita' della scritta a mano in movimento | `1` |
| `NIB` | rimette il simbolo del pennello sotto la scritta | `false` |
| `BUSY_MAX` | per quanti ms al massimo l'inchiostro si ritira quando lo slider cambia quadro | `900` |
| `GRADE` | l'inversione, in una riga | `invert(1) hue-rotate(180deg) saturate(.92) contrast(1.04)` |
| `BRUSH_SIZE` | grandezza della punta, in % dell'altezza dell'immagine | `1.7` |
| `BRUSH_DRY` | quanto asciuga in fretta: piu' alto = il tratto svanisce prima | `1.45` |
| `VEIL_A` | il velo caldo dentro l'inchiostro. 0 = spento | `0.05` |

Si provano dal vivo dalla console, senza ripubblicare:

```js
capeImageInk.set({ BRUSH_SIZE: 2.4, BRUSH_DRY: 1.1 })   // cambia e guarda
capeImageInk.read()                                     // com'e' adesso
capeImageInk.targets()                                  // quali immagini ha preso
capeImageInk.rescan()                                   // hai appena dato la classe a una foto
capeImageInk.refresh()                                  // ricuoci le copie invertite
capeImageInk.pause()  /  .resume()
```

`capeImageInk.read().luminanceOnly` dice se il browser sta facendo la vera
inversione di luminanza (`true`) o il ripiego.

---

## Quando non parte

Sotto **992px**, su schermi senza mouse, con `prefers-reduced-motion` o senza
WebGL2 con i buffer float non parte niente: le immagini restano esattamente come
sono adesso e il cursore resta quello di prima.

Su Safari piu' vecchi di 17.4 manca `ctx.filter` e non c'e' modo di cuocere la
copia virata: li' l'inchiostro passa in `mix-blend-mode: difference` e si vede il
negativo classico. Si perde la sola-luminanza, ma nessuno resta a bocca asciutta.

Fuori dallo schermo, a scheda in background e mentre lo stage cambia opera la
fisica si ferma e l'inchiostro si ritira: un'immagine sta nella lista solo
finche' ha inchiostro addosso, poi la GPU torna a dormire.

### Quando lo slider cambia quadro

L'inchiostro si ritira mentre l'immagine **scorre**, se no resterebbe attaccato
a un quadro che sta uscendo di scena. Il punto delicato e' per quanto: la classe
`is-busy` dello slider non dura quanto il movimento: la mettono all'inizio e la
tolgono quando finisce tutta la coreografia, testi compresi — circa **1,8
secondi**, mentre l'immagine si muove solo per i primi **0,9**. Seguendo `is-busy`
alla lettera l'inchiostro restava spento per quasi un secondo in cui non si
muoveva piu' niente, e passando sopra sembrava rotto.

`BUSY_MAX` mette il tetto: si sospende al massimo 900ms, quanto dura davvero il
movimento. Misurato prima e dopo, in browser: da **2,0s** a **1,2s** di attesa,
e i 900ms che restano sono esattamente quelli in cui l'immagine scorre.

Insieme a quello, due dettagli che facevano la loro parte:

- la copia invertita **non si spegne piu'** mentre se ne cuoce una nuova. Prima
  il cambio di quadro azzerava `ready`, e per qualche frame non si dipingeva
  niente. Meglio l'inchiostro del quadro precedente per un frame che un buco.
- l'osservatore che accorge del cambio aveva un debounce semplice, e lo slider
  scrive una `style` a ogni frame: il timer non scadeva **mai** finche'
  l'animazione andava. Ora c'e' un tetto d'attesa, quindi il quadro nuovo si
  vede mentre succede.
