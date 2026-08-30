# The Cape — Header "Inchiostro"

Bottone + menu a tutto schermo per la pagina **The Cape Studio**.
Due file, nessuna dipendenza, niente da creare nel Designer.

Un bottone in basso al centro, con dentro solo la parola: scendendo sparisce
sotto il bordo, risalendo torna. Due colori soli — o carta con la scritta in
inchiostro, o inchiostro con la scritta in carta: il JS guarda quanto e'
chiaro cio' che gli passa sopra e sceglie quale delle due. A menu aperto il
bottone se ne va e al suo posto compare una X in alto a destra: non ci sono
mai due comandi insieme.

Tutto il testo e' Jost 200 — voci, sottovoci e bottone.

Al click un pennello dipinge lo schermo in diagonale, da in alto a sinistra a
in basso a destra, con la fisica dell'`ink-bleed`. In uscita fa la stessa
identica cosa nella stessa direzione: non torna indietro, ricomincia da in
alto a sinistra e finisce in basso a destra.

Il menu e' alto esattamente uno schermo e non scorre: due colonne da meta'
esatta, a sinistra l'immagine che copre tutta la sua meta', a destra le voci.
Passando su una voce l'immagine cambia.

| File | Cosa e' | Peso |
|---|---|---|
| `cape-header.css` | tutto lo stile: bottone, menu, ripiego senza WebGL | ~7 KB |
| `cape-header.js` | markup, coreografia e i due fluidi | ~52 KB |

---

## Come si include

**Nell'`<head>`** — Pages → The Cape Studio → Settings → Custom code →
*Inside `<head>` tag*, in fondo a quello che c'e' gia':

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/cash9086/header@VERSIONE/cape-header.css">
```

**In fondo al footer** — Settings → Custom code → *Before `</body>` tag*,
come ultima riga, dopo Lenis:

```html
<script defer src="https://cdn.jsdelivr.net/gh/cash9086/header@VERSIONE/cape-header.js"></script>
```

`defer` garantisce che parta dopo tutti gli script inline del footer, quindi
dopo che Lenis ha messo `window.lenis` — che serve per fermare lo scroll a
menu aperto.

### Versione pigra: una riga sola

Se non vuoi toccare l'`<head>`, basta lo `<script>`: il JS si carica il CSS
da solo dalla stessa cartella e aspetta che sia arrivato prima di costruire
la barra, cosi' non si vede mai roba non stilata. Costa un viaggio di rete in
piu' — la versione a due tag resta migliore.

Se il CSS lo hai gia' incluso in altro modo, spegni il caricamento automatico
con `data-css="off"` sul tag `<script>`.

---

## Versioni

`VERSIONE` nei due URL e' una di queste due cose:

- **lo SHA di un commit** — `@d490afb...`, quaranta caratteri, copiabile dalla
  pagina dei commit. E' immutabile: quel contenuto non cambiera' mai, quindi
  la cache di jsDelivr non e' mai un problema e non c'e' niente da svuotare.
  E' la forma che usiamo adesso.
- **un tag** — `@v1.0.0`, piu' leggibile, stessa identica garanzia. Il push
  dei tag da questa sessione non passa, quindi il tag va creato a mano:
  Releases → Draft a new release → Choose a tag → scrivi `v1.0.0` → Create new
  tag → Publish release. Fatto quello, l'URL con `@v1.0.0` funziona subito.

Per pubblicare una modifica: commit su `main`, poi cambi `VERSIONE` nelle due
righe con il nuovo SHA (o fai un tag nuovo).

Mentre si lavora si puo' puntare al branch (`@main`) e svuotare la cache a
mano aprendo una volta
`https://purge.jsdelivr.net/gh/cash9086/header@main/cape-header.js`.
Comodo in sviluppo, da non lasciare in produzione: senza purge una modifica
puo' metterci ore ad arrivare.

Il repo deve restare **pubblico**: jsDelivr non serve repo privati.

## Dove si mette mano

Tutte le manopole stanno nel blocco `IMPOSTAZIONI` in cima a
`cape-header.js`: testi, voci del menu, link, tempi, parametri
dell'inchiostro e della pennellata. Sotto quel blocco c'e' solo meccanica.

I link delle voci (`#works`, `#editions`, ...) sono **segnaposto**: vanno
puntati agli id veri delle sezioni, o agli indirizzi delle pagine. Un'ancora
che non esiste non rompe niente — il menu si chiude e basta.

Le immagini stanno nell'array `INDEX`, una per voce, piu' `LOGO` per quella a
riposo. Una voce senza immagine tiene il logo. Sono precaricate: cambiare
voce e' solo un'opacita' che si scambia.

Le due grandezze dell'inchiostro sono in **percentuale dell'altezza dello
schermo**, cosi' si ragiona a occhio:

| Manopola | Cos'e' | Ora |
|---|---|---|
| `BRUSH_SIZE` | l'inchiostro che segue il cursore | `1.87` |
| `FLOOD_DAB_SZ` | la setola delle pennellate di entrata e uscita | `17.3` |

Per togliere il 20% si moltiplica per 0.8, per aggiungerlo per 1.2. Nient'altro
da toccare: il passo del tratto si adegua da solo. (Il fluido internamente vuole
il raggio al quadrato, ma la conversione la fa il codice.)

Da fuori si puo' chiamare `capeHeader.open()`, `.close()` e `.toggle()`.
