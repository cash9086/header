/* ============================================================================
   THE CAPE — INCHIOSTRO DENTRO LA SCRITTA  ·  cape-title-ink.js

   La scritta nera dell'header di "The Cape Studio" diventa una finestra:
   dentro le lettere galleggia inchiostro bianco vivo — una lava lamp con la
   fisica del fluido gia' usata nell'header e nella sezione ink-bleed.
   Fuori dalle lettere non si vede niente. L'inchiostro sente il puntatore
   ovunque sia nella pagina e ci va incontro, come limatura su una calamita.

   Va in fondo al footer della pagina, come il resto:
     <script defer src="https://cdn.jsdelivr.net/gh/UTENTE/REPO@VERSIONE/cape-title-ink.js"></script>

   COME E' FATTO (le tre righe che contano)
   - Il titolo nero NON si tocca: resta dov'e', com'e'.
   - Sopra ci va un palco isolato col fondo nero, grande quanto la scritta.
     Dentro: una COPIA della scritta in bianco, e sopra il canvas del fluido
     in multiply. Bianco x bianco = inchiostro; tutto il resto resta nero.
     Poi un filtro SVG legge quel grigio e lo trasforma in TRASPARENZA: nero
     = niente, bianco = inchiostro pieno. Risultato: l'inchiostro si vede
     SOLO dentro i glifi, con i bordi antialiasati veri del font. Nessuna
     maschera disegnata a mano, nessun font da ricostruire: la lettera che
     fa da stampo e' la lettera vera.
     (Perche' il filtro e non un mix-blend-mode:screen sul palco: l'header
     sta dentro .c-sticky, che isola il gruppo. Li' dentro, dietro alla
     scritta, per larghi tratti non c'e' niente — e uno screen su un fondo
     trasparente non annulla il nero, lo stampa. Il filtro no: lavora
     sull'alfa, quindi non gli serve niente dietro.)
   - Il fluido e' lo stesso solutore del divider: advezione, forze, vorticita',
     divergenza, pressione, gradiente. Piu' un passaggio nuovo, MAGNET, che e'
     l'attrazione verso il mouse.

   Serve WebGL2 con i buffer float e mix-blend-mode. Se manca qualcosa non
   succede niente: la scritta resta nera, esattamente com'e' adesso.

   LE MANOPOLE SONO TUTTE NEL BLOCCO "IMPOSTAZIONI" QUI SOTTO.
   A pagina aperta si possono provare dal vivo dalla console:
       capeTitleInk.set({ MAG_PULL:0.24, BLOB_SIZE:10, CYCLE:0.6 })
       capeTitleInk.burst()      capeTitleInk.pause()      capeTitleInk.resume()
============================================================================ */

(function(){
'use strict';

if(window.__capetitleink) return;
window.__capetitleink = 1;

/* ========================== IMPOSTAZIONI ================================== */

/* --- dove ---------------------------------------------------------------- */
var SEL       = 'h1.filled-heading';  /* la scritta da riempire                */
var PAD       = 0.16;   /* quanto sfora il box del fluido oltre la scritta, in
                           altezze-scritta. Serve perche' l'inchiostro non
                           sbatta contro il muro proprio sul bordo dei glifi;
                           di piu' non serve, e' area che nessuno vede.        */

/* --- l'inchiostro: quanto ce n'e' ---------------------------------------
   Sono le DUE manopole che contano. FEED versa, DYE_DISS asciuga: il loro
   rapporto decide quanta lettera resta piena. Piu' FEED (o meno DYE_DISS) =
   lettere quasi tutte bianche; meno FEED = qualche goccia che nuota.        */
var BLOBS     = 26;     /* quante sorgenti di cera vagano nel box             */
var FEED      = 2.40;   /* colorante versato al secondo da ogni sorgente      */
var DYE_DISS  = 0.30;   /* quanto asciuga l'inchiostro                        */
var BLOB_SIZE = 10;     /* GRANDEZZA della goccia, in % dell'altezza scritta.
                           Va letta insieme a BLOBS: tante gocce piccole e
                           separate sono una lava lamp, poche grosse che si
                           toccano sono una macchia sola che respira.         */
var ROAM      = 1.70;   /* quanto ogni sorgente sconfina nella corsia della
                           vicina. 1 = resta nella sua e oscilla sul posto —
                           ed e' li' che la scritta sembra ferma anche quando
                           non lo e'. Sopra 1 le gocce si incrociano, si
                           passano davanti e si fondono, che e' il movimento
                           che si vede davvero.                               */
var INK_K     = 2.60;   /* densita': stessa del divider. Alzalo e il velo
                           sottile conta come inchiostro pieno.               */
var INK_DEPTH = 0.22;   /* quanto il centro denso e' piu' bianco del bordo:
                           0 = macchia piatta, 0.3 = si vede lo spessore      */
var TENSION   = 3.20;   /* TENSIONE SUPERFICIALE. Senza, l'inchiostro si scioglie:
                           l'advezione bilineare sfuma le gocce a ogni passo e
                           dopo un minuto la scritta e' quasi vuota. Questo le
                           ricompatta di continuo — il denso si fa piu' denso,
                           il velo sparisce. E' la manopola che fa restare
                           GOCCE invece di diventare foschia. 0 = spenta.
                           Sale insieme al movimento, e non e' una scelta di
                           gusto: piu' l'inchiostro corre, piu' l'advezione lo
                           sfuma a ogni passo, quindi piu' forte deve essere
                           quello che lo ricompatta. Alzare il moto senza
                           alzare questa da' nebbia, non gocce.               */

/* --- l'inchiostro: come si muove ---------------------------------------- */
var GRAVITY   = 0.038;  /* quanto cola. E' qui che si vede il non newtoniano:
                           il denso scende, il velo resta sospeso.            */
var LIFT      = 0.072;  /* la spinta in su delle sorgenti, in accelerazione: e'
                           la piastra calda della lampada. Non e' piu' costante
                           — vedi CYCLE — quindi va letta come il PICCO della
                           spinta, non come la media: in media vale circa 0.42
                           di questo numero, cioe' poco piu' di GRAVITY.      */
var CYCLE     = 0.42;   /* IL GIRO DELLA CERA, in radianti al secondo (0.42 =
                           un ciclo ogni ~15s, e ogni sorgente ha il suo passo
                           fra 11s e 21s). E' la manopola che fa la lava lamp:
                           la piastra non scalda tutte le gocce insieme, quindi
                           mentre una sale la vicina sta gia' scendendo. Con la
                           spinta costante invece salgono tutte, si appoggiano
                           in alto e li' restano: fluido, ma non una lampada.  */
var AMBIENT   = 0.0200; /* le correnti lente (rumore curl): sono queste che
                           fanno galleggiare invece di cadere e basta         */
var CURL      = 0.20;   /* vorticita': quanto si arriccia sui bordi           */
var VEL_DISS  = 0.88;   /* attrito del campo di moto. Abbassarlo non aggiunge
                           moto, gli allunga la vita: la spinta di dieci
                           secondi fa si' che si veda ancora adesso.          */
var DRIFT     = 0.30;   /* quanto in fretta vagano le sorgenti                */
var WANDER    = 2.00;   /* quanto l'inchiostro si fa trascinare dalla sorgente
                           che lo versa (attrito, al secondo): e' la scia.
                           Scende mentre DRIFT sale: la sorgente corre il
                           doppio, se si facesse trascinare uguale l'inchiostro
                           verrebbe stirato invece che portato.               */

/* --- la calamita: l'attrazione verso il mouse ---------------------------
   Il puntatore non deve mai "attaccare" l'inchiostro addosso: e' massa, ci
   mette un attimo ad arrivare. Per questo la calamita ha la sua inerzia
   (MAG_EASE) e tira con una VELOCITA', non sposta a una posizione.          */
var MAG       = true;   /* false = solo lava lamp, niente mouse               */
var MAG_PULL  = 0.100;  /* QUANTO TIRA. E' la velocita' con cui l'inchiostro
                           scivola verso il puntatore, in larghezze del box al
                           secondo: 0.02 e' un'inclinazione appena percepibile,
                           0.15 e' un risucchio. E' la manopola principale.    */
var MAG_SWIRL = 0.160;  /* quanto gira ATTORNO al puntatore invece di finirci
                           dentro. Senza, l'inchiostro collassa in un punto e
                           li' si ferma; con, ci orbita. Tenerlo sotto PULL.   */
var MAG_STIR  = 0.35;   /* l'increspatura del fluido attorno al puntatore, in
                           accelerazione. Non attrae (non puo': vedi PULLD),
                           ma fa muovere la superficie mentre l'ink arriva.    */
var MAG_R     = 40;     /* raggio del campo, in % della larghezza del box.
                           Oltre il raggio il mouse non lo sente piu'. Largo
                           perche' il puntatore deve farsi sentire su mezza
                           riga, non solo sulla lettera che ha sotto.         */
var MAG_FLAT  = 0.26;   /* quanto la calamita tira anche IN VERTICALE.
                           1 = campo rotondo; 0 = tira solo di lato.
                           Va tenuto basso e non e' un dettaglio: l'inchiostro
                           vive in una striscia alta due dita, sopra e sotto
                           le lettere non c'e' niente da vedere. Con il campo
                           rotondo, il puntatore che passa sotto al titolo si
                           portava giu' l'inchiostro e la scritta si svuotava.
                           Schiacciato, il puntatore in basso a sinistra
                           raduna l'inchiostro a sinistra — che e' quello che
                           uno si aspetta guardando. Scende mentre MAG_PULL
                           sale: il tiro e' due volte e mezzo quello di prima,
                           e a parita' di schiacciamento la componente in giu'
                           sarebbe cresciuta con lui.                         */
var MAG_CORE  = 22;     /* IL NUCLEO, in % della larghezza del box. Fuori la
                           calamita tira dentro, dentro spinge fuori, e a META'
                           di questo raggio si azzera: e' li' che l'inchiostro
                           si dispone. Quindi questa manopola e' la GRANDEZZA
                           della massa che segue il puntatore — larga circa
                           meta' nucleo. A 0 la calamita torna a essere un buco
                           nero che si mangia l'inchiostro invece di radunarlo:
                           vedi il commento lungo su PULLD.                   */
var MAG_HOME  = 0.22;   /* DOVE VA L'INCHIOSTRO. Le sorgenti stesse vanno
                           incontro al puntatore: tutta la fila si contrae di
                           questa frazione verso di lui (0 = lo ignora, 0.5 =
                           l'inchiostro vive in meta' riga, centrata sul mouse).
                           Oltre 0.3 le lettere agli estremi restano vuote.
                           E' QUESTA la manopola che fa seguire il mouse, non
                           MAG_PULL. Spostare il colorante gia' versato e' un
                           gather, e un gather sotto sforzo o si mangia
                           l'inchiostro o lo fabbrica: sopra un certo tiro non
                           esiste un valore giusto. Spostare le SORGENTI invece
                           non ha patologie — l'inchiostro nasce dove sta il
                           puntatore, la quantita' in giro resta quella decisa
                           da FEED e DYE_DISS, e il richiamo si puo' alzare
                           quanto si vuole. MAG_PULL resta, ma per quello che sa
                           fare bene: inclinare le gocce gia' in acqua.        */
var MAG_SAT   = 12;      /* LO STIPAMENTO, in multipli di "inchiostro pieno".
                           Dove il colorante e' gia' a questa concentrazione la
                           calamita smette di tirarne dentro dell'altro, e
                           quello che continua ad arrivare si dispone INTORNO.
                           Senza, la pozza sotto il puntatore si stringe finche'
                           e' piu' sottile di un texel e sparisce: la calamita
                           radunava l'inchiostro e se lo mangiava nello stesso
                           gesto. E' quello che tiene alla pozza un'area invece
                           che una densita'.                                  */
var MAG_EASE  = 6.5;    /* inerzia della calamita (al secondo): basso = pigra.
                           La calamita resta una massa, ma con un ritardo di
                           un sesto di secondo invece di un quarto: sotto quel
                           valore l'inchiostro sembra rispondere a dove il
                           mouse ERA, che e' esattamente la sensazione di uno
                           che non ti segue.                                  */
var MAG_BIAS  = 0.60;   /* quanto l'increspatura segue l'inchiostro invece del
                           vuoto: 1 = solo dove c'e' colorante, 0 = ovunque   */

/* --- la scia del puntatore ----------------------------------------------
   La calamita dice DOVE va l'inchiostro, ma non fa niente mentre il mouse si
   muove: sposta il colorante verso un punto e basta, quindi un gesto veloce
   e un gesto lento finiscono uguali. Questo invece e' il dito nell'acqua —
   il puntatore trascina il FLUIDO con la propria velocita', e la risposta
   arriva sul frame, non dopo. E' la meta' della sensazione di "mi segue":
   l'altra meta' e' MAG_PULL, che e' dove finisce.                          */
var MAG_DRAG  = 1.20;   /* quanto il puntatore trascina il fluido: e' un
                           attrito al secondo, come WANDER. 0 = spento.       */
var MAG_DRAG_R = 24;    /* raggio della scia, in % dell'altezza del box       */
var MAG_DRAG_V = 1.40;  /* oltre questa velocita' del puntatore (larghezze del
                           box al secondo) la scia non cresce piu'. Serve: una
                           sciabolata da un bordo all'altro senza tetto sparava
                           l'inchiostro contro il muro e svuotava le lettere.  */

/* --- il terreno ---------------------------------------------------------- */
var MIN_W     = 992;    /* sotto questa larghezza: niente. La scritta resta nera */
var SIM       = 88;     /* risoluzione del campo di moto (lato corto)          */
var DYE       = 288;    /* risoluzione del colorante (lato corto)              */
var ITER      = 18;     /* giri di pressione                                   */
var FADE_MS   = 900;    /* la comparsa: non deve mai apparire di colpo         */
var PRIME     = 40;     /* passi di fisica prima di mostrare: al primo frame le
                           gocce sono gia' formate, non sono palline           */
var BOOST     = 3.0;    /* per i primi BOOST_S secondi la fisica va a questa
                           velocita': le gocce sbocciano dentro le lettere
                           mentre il livello compare, invece di far aspettare
                           mezzo minuto che la lampada si riempia. Spalmato sui
                           frame, cosi' al caricamento non si pianta niente.   */
var BOOST_S   = 2.6;
/* ========================================================================== */


/* ----- capacita' della macchina, non gusti ------------------------------- */
var d = document;
function mq(q){ try{ return matchMedia(q).matches; }catch(e){ return false; } }
if(mq('(prefers-reduced-motion: reduce)')) return;
if(!mq('(hover: hover)')) return;
if(innerWidth < MIN_W) return;
try{ if(!CSS.supports('mix-blend-mode','multiply')) return; }catch(e){ return; }


/* ==========================================================================
   1 · IL PALCO
   Fondo nero + isolamento: dentro si moltiplica la lettera per l'inchiostro,
   poi il filtro converte quel grigio in trasparenza. Dove non c'e' inchiostro
   il palco e' nero, quindi alfa zero, quindi non c'e': il video sotto non lo
   tocca nessuno.
   ========================================================================== */
var CSS_TXT = ''
 + '.capeink-stage{position:absolute;z-index:100;pointer-events:none;overflow:hidden;'
 +   'background:#000;isolation:isolate;filter:url(#capeink-lum);'
 +   'opacity:0;transition:opacity ' + FADE_MS + 'ms cubic-bezier(.16,1,.3,1)}'
 + '.capeink-stage.is-in{opacity:1}'
 + '.capeink-txt{position:absolute;margin:0!important;padding:0!important;'
 +   'z-index:auto!important;pointer-events:none;user-select:none;'
 +   'color:#fff!important;-webkit-text-fill-color:#fff!important;'
 +   '-webkit-text-stroke:0!important;text-shadow:none!important;'
 +   'background:none!important;-webkit-background-clip:border-box!important;'
 +   'background-clip:border-box!important;mix-blend-mode:normal!important;'
 +   'filter:none!important;opacity:1!important;transform:none!important;'
 +   'transition:none!important;animation:none!important;visibility:visible!important;'
 +   'clip-path:none!important;-webkit-clip-path:none!important}'
 + '.capeink-fluid{position:absolute;inset:0;display:block;width:100%;height:100%;mix-blend-mode:multiply}';

var st = d.createElement('style');
st.setAttribute('data-capeink','');
st.appendChild(d.createTextNode(CSS_TXT));
d.head.appendChild(st);

/* Il filtro: luminanza -> alfa. Il canale rosso di quello che il palco ha
   composto diventa la trasparenza, il colore diventa bianco pieno. E' tutta
   qui la maschera. sRGB esplicito, se no il filtro lavora in lineare e i
   mezzi toni del bordo delle lettere si schiariscono. */
var NS = 'http://www.w3.org/2000/svg';
var svg = d.createElementNS(NS, 'svg');
svg.setAttribute('width','0'); svg.setAttribute('height','0');
svg.setAttribute('aria-hidden','true');
svg.setAttribute('style','position:absolute;width:0;height:0;overflow:hidden;pointer-events:none');
var flt = d.createElementNS(NS, 'filter');
flt.setAttribute('id','capeink-lum');
flt.setAttribute('x','0'); flt.setAttribute('y','0');
flt.setAttribute('width','100%'); flt.setAttribute('height','100%');
flt.setAttribute('color-interpolation-filters','sRGB');
var cm = d.createElementNS(NS, 'feColorMatrix');
cm.setAttribute('type','matrix');
cm.setAttribute('values','0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0');
flt.appendChild(cm);
svg.appendChild(flt);


/* ==========================================================================
   2 · IL FLUIDO
   Copiato dal solutore del divider ink-bleed, senza cambiarne il cuore.
   Il pezzo che conta e' in FORCES:
       cc    = c/uRef
       heavy = cc*(0.16 + 0.84*cc*cc)
       vel.y -= uGravity*heavy*dt
   il peso non e' proporzionale alla quantita', ci va quasi col cubo: il denso
   cola, il velo resta sospeso. E' la ragione per cui questo inchiostro fa
   blob e non sfumature — cioe' e' la ragione per cui sembra una lava lamp.

   Le velocita' sono in "frazioni di larghezza al secondo" moltiplicate per la
   larghezza della griglia: cosi' x e y si muovono uguale sullo schermo anche
   se il box e' lungo e basso come una riga di testo.
   ========================================================================== */
var VERT = 'precision highp float;\n' +
  'in vec2 aPosition; out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;\n' +
  'uniform vec2 uTexel;\n' +
  'void main(){ vUv = aPosition*0.5+0.5;\n' +
  '  vL = vUv-vec2(uTexel.x,0.); vR = vUv+vec2(uTexel.x,0.);\n' +
  '  vT = vUv+vec2(0.,uTexel.y); vB = vUv-vec2(0.,uTexel.y);\n' +
  '  gl_Position = vec4(aPosition,0.,1.); }';

var HEAD = 'precision highp float; precision highp sampler2D;\n' +
  'in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;\n' +
  'out vec4 fragColor;\n';

var ADVECT = HEAD + 'uniform sampler2D uVelocity, uSource;\n' +
  'uniform vec2 uTexel, uSourceTexel; uniform float uDt, uDissipation;\n' +
  'void main(){ vec2 coord = vUv - uDt*texture(uVelocity,vUv).xy*uTexel;\n' +
  '  fragColor = texture(uSource,coord)/(1.+uDissipation*uDt); }';

var FORCES = HEAD + 'uniform sampler2D uVelocity, uDye;\n' +
  'uniform float uDt, uGravity, uAmbient, uTime, uAspect, uRef;\n' +
  'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }\n' +
  'float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);\n' +
  '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),\n' +
  '             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }\n' +
  'float psi(vec2 p,float t){ return vnoise(p*3.+vec2(0.,t*0.13)) + 0.5*vnoise(p*7.-vec2(t*0.09,0.)); }\n' +
  'vec2 curlNoise(vec2 p,float t){ const float e=0.012;\n' +
  '  return vec2(psi(p+vec2(0.,e),t)-psi(p-vec2(0.,e),t),\n' +
  '              psi(p-vec2(e,0.),t)-psi(p+vec2(e,0.),t))/(2.*e); }\n' +
  'void main(){ vec2 vel = texture(uVelocity,vUv).xy;\n' +
  '  float c = texture(uDye,vUv).x;\n' +
  '  float cc = clamp(c/uRef, 0., 1.);\n' +
  '  float heavy = cc * (0.16 + 0.84*cc*cc);\n' +
  '  vel.y -= uGravity*heavy*uDt;\n' +
  '  vel += curlNoise(vUv*vec2(uAspect,1.),uTime)*uAmbient*uDt;\n' +
  '  fragColor = vec4(vel,0.,1.); }';

/* LA CALAMITA. Il punto e' preso in "frazioni di larghezza" cosi' il campo e'
   un cerchio vero anche su un box lungo e basso. dir tira dentro, tang gira
   attorno: senza tang l'inchiostro collassa in un punto e resta li' fermo,
   che e' la differenza fra una calamita e un buco nero.

   Qui il nucleo di PULLD NON va messo. Sul colorante il richiamo rovesciato e'
   un raggio di equilibrio; su un fluido incomprimibile e' una sorgente, e la
   proiezione di pressione la trasforma in un soffio che spazza via l'inchiostro
   da mezza riga. Questo passaggio resta quello che e' sempre stato: agitazione. */
var MAGNET = HEAD + 'uniform sampler2D uVelocity, uDye;\n' +
  'uniform vec2 uPoint; uniform float uAspect, uDt, uPull, uSwirl, uRadius, uRef, uBias, uFlat;\n' +
  'void main(){ vec2 vel = texture(uVelocity,vUv).xy;\n' +
  '  vec2 p = vec2(vUv.x - uPoint.x, (vUv.y - uPoint.y)/max(uAspect,1e-3));\n' +
  '  p.y *= uFlat;\n' +
  '  float d2 = dot(p,p);\n' +
  '  float f = exp(-d2/uRadius);\n' +
  '  if(f < 0.002){ fragColor = vec4(vel,0.,1.); return; }\n' +
  '  float cc = clamp(texture(uDye,vUv).x/uRef, 0., 1.);\n' +
  '  vec2 dir = -p*inversesqrt(d2 + 1e-6);\n' +
  '  vec2 tang = vec2(-dir.y, dir.x);\n' +
  '  vec2 acc = (dir*uPull + tang*uSwirl) * f * mix(1.0, cc, uBias);\n' +
  '  fragColor = vec4(vel + acc*uDt, 0., 1.); }';

/* LA CALAMITA, parte due: la deriva del COLORANTE.
   Il richiamo sul campo di moto (sopra) da' solo agitazione, e non e' un
   difetto: in un fluido incomprimibile una corrente che converge in un punto
   non esiste, la proiezione di pressione la cancella — vorrebbe dire ammassare
   materia dove non ci sta. L'attrazione vera quindi va messa dove ha senso
   fisico: sul colorante, che e' un tracciante trascinato da una forza esterna.
   Limatura di ferro dentro l'olio: si muove la limatura, non l'olio.

   Qui c'erano DUE cose rotte, ed e' per questo che MAG_PULL era fermo a 0.075:
   alzarlo non radunava l'inchiostro sotto il puntatore, lo faceva sparire.

   1. IL NUCLEO (uCore). Un richiamo che punta al centro fino al centro comprime
      il colorante sotto la dimensione di un texel: cioe' se lo cancella. E non
      basta spegnerlo vicino al centro — finche' resta anche solo un filo di
      richiamo il punto d'arrivo e' sempre il centro, ci si arriva soltanto piu'
      piano. Deve ROVESCIARSI: fuori dal nucleo tira dentro, dentro spinge
      fuori, e a meta' nucleo si azzera. Quello e' un raggio di equilibrio
      stabile, e l'inchiostro ci si dispone attorno — una massa larga quanto il
      nucleo, che gira col puntatore invece di sparirci dentro. E' la differenza
      fra una calamita e un buco nero.

   2. LA MASSA. Questo passaggio e' un gather, e un gather non conserva niente:
      dove le traiettorie convergono, piu' pixel pescano dallo stesso punto e il
      colorante si DUPLICA. Col solo nucleo il problema si ribalta e basta —
      invece di mangiarsi l'inchiostro la calamita lo fabbrica, e in un minuto
      le lettere sono bianche piene. La correzione e' il fattore (1 - div): il
      determinante jacobiano della mappa all'indietro, cioe' di quanto quel
      pezzetto di piano si stringe mentre lo si sposta. Preso numericamente
      dallo stesso campo, quattro valutazioni in croce. Con quello davanti,
      spostare l'inchiostro e' SPOSTARLO: la calamita si puo' alzare quanto
      serve, e quello che si raduna sotto il puntatore e' inchiostro che e'
      arrivato da qualche altra parte della riga — che e' esattamente cio' che
      si vuole vedere. */
var PULLD = HEAD + 'uniform sampler2D uDye; uniform vec2 uPoint, uTexel;\n' +
  'uniform float uAspect, uDt, uPull, uSwirl, uRadius, uFlat, uCore, uSat;\n' +
  /* Lo spostamento che la calamita impone al colorante, in UV. uSat entra come
     fattore COSTANTE, preso una volta sola nel pixel centrale e passato qui:
     dentro la funzione dipenderebbe dal colorante, e la divergenza qui sotto
     ne raccoglierebbe il gradiente diviso per un texel — numeri enormi, che
     azzerano il colorante sul bordo di ogni goccia. */
  'vec2 fld(vec2 uv, float sat){\n' +
  '  vec2 p = vec2(uv.x - uPoint.x, (uv.y - uPoint.y)/max(uAspect,1e-3));\n' +
  '  p.y *= uFlat;\n' +
  '  float d2 = dot(p,p);\n' +
  '  float f = exp(-d2/uRadius);\n' +
  '  vec2 dir = -p*inversesqrt(d2 + 1e-6);\n' +
  '  vec2 tang = vec2(-dir.y, dir.x);\n' +
  '  float ring = 2.*smoothstep(0., uCore, sqrt(d2)) - 1.;\n' +
  '  vec2 v = (dir*uPull*ring*sat + tang*uSwirl)*f;\n' +
  '  v.y *= uFlat;\n' +
  '  return vec2(v.x, v.y*uAspect)*uDt; }\n' +
  'void main(){ vec2 p = vec2(vUv.x - uPoint.x, (vUv.y - uPoint.y)/max(uAspect,1e-3));\n' +
  '  p.y *= uFlat;\n' +
  '  if(exp(-dot(p,p)/uRadius) < 0.002){ fragColor = texture(uDye, vUv); return; }\n' +
  '  float sat = 1. - clamp(texture(uDye,vUv).x/uSat, 0., 1.);\n' +
  '  vec2 duv = fld(vUv, sat);\n' +
  '  vec2 ex = vec2(uTexel.x, 0.), ey = vec2(0., uTexel.y);\n' +
  '  float dv = (fld(vUv+ex,sat).x - fld(vUv-ex,sat).x)/(2.*uTexel.x)\n' +
  '           + (fld(vUv+ey,sat).y - fld(vUv-ey,sat).y)/(2.*uTexel.y);\n' +
  /* la divergenza di un campo radiale va come 1/d: sul puntatore esatto e'
     infinita, e senza tetto il fattore diventa negativo e cancella. */
  '  fragColor = texture(uDye, vUv - duv) * clamp(1. - dv, 0.5, 1.6); }';

var CURLP = HEAD + 'uniform sampler2D uVelocity;\n' +
  'void main(){ fragColor = vec4(0.5*(texture(uVelocity,vR).y-texture(uVelocity,vL).y\n' +
  '  -texture(uVelocity,vT).x+texture(uVelocity,vB).x),0.,0.,1.); }';

var VORT = HEAD + 'uniform sampler2D uVelocity, uCurl; uniform float uCurlAmount, uMaxDv, uDt;\n' +
  'void main(){ float L=texture(uCurl,vL).x, R=texture(uCurl,vR).x;\n' +
  '  float T=texture(uCurl,vT).x, B=texture(uCurl,vB).x, C=texture(uCurl,vUv).x;\n' +
  '  vec2 f = 0.5*vec2(abs(T)-abs(B), abs(R)-abs(L));\n' +
  '  f /= length(f)+1e-4; f *= uCurlAmount*C; f.y *= -1.;\n' +
  '  vec2 dv = f*uDt; float m = length(dv);\n' +
  '  if (m > uMaxDv) dv *= uMaxDv/m;\n' +
  '  fragColor = vec4(clamp(texture(uVelocity,vUv).xy+dv,-1200.,1200.),0.,1.); }';

/* I bordi rimandano indietro: e' questo che tiene l'inchiostro dentro il box
   invece di lasciarlo colare fuori dalla riga di testo. */
var DIV = HEAD + 'uniform sampler2D uVelocity;\n' +
  'void main(){ float L=texture(uVelocity,vL).x, R=texture(uVelocity,vR).x;\n' +
  '  float T=texture(uVelocity,vT).y, B=texture(uVelocity,vB).y;\n' +
  '  vec2 C=texture(uVelocity,vUv).xy;\n' +
  '  if(vL.x<0.) L=-C.x;  if(vR.x>1.) R=-C.x;\n' +
  '  if(vT.y>1.) T=-C.y;  if(vB.y<0.) B=-C.y;\n' +
  '  fragColor = vec4(0.5*(R-L+T-B),0.,0.,1.); }';

var PRESS = HEAD + 'uniform sampler2D uPressure, uDivergence;\n' +
  'void main(){ fragColor = vec4((texture(uPressure,vL).x+texture(uPressure,vR).x\n' +
  '  +texture(uPressure,vB).x+texture(uPressure,vT).x-texture(uDivergence,vUv).x)*0.25,0.,0.,1.); }';

var GRAD = HEAD + 'uniform sampler2D uPressure, uVelocity;\n' +
  'void main(){ fragColor = vec4(texture(uVelocity,vUv).xy\n' +
  '  - vec2(texture(uPressure,vR).x-texture(uPressure,vL).x,\n' +
  '         texture(uPressure,vT).x-texture(uPressure,vB).x),0.,1.); }';

var SPLAT = HEAD + 'uniform sampler2D uTarget; uniform float uAspect, uRadius;\n' +
  'uniform vec3 uColor; uniform vec2 uPoint;\n' +
  'void main(){ vec2 p = vUv-uPoint; p.x *= uAspect;\n' +
  '  fragColor = vec4(texture(uTarget,vUv).xyz + exp(-dot(p,p)/uRadius)*uColor, 1.); }';

/* Lo stesso splat, ma per TUTTE le sorgenti insieme. Ogni splat tocca l'intera
   texture del colorante — che e' larga quanto la riga di testo — quindi una
   goccia in piu' e' una passata a piena risoluzione in piu' a ogni passo di
   fisica: e' di gran lunga la cosa piu' cara che fa questo file. Sommando le
   gaussiane qui dentro il costo smette di dipendere da quante gocce ci sono, e
   BLOBS torna a essere una scelta di disegno invece che di budget. */
var MAXSRC = 32;
var MSPLAT = HEAD + 'uniform sampler2D uTarget; uniform float uAspect, uRadius;\n' +
  'uniform int uCount; uniform vec2 uPts[' + MAXSRC + ']; uniform vec3 uAdd[' + MAXSRC + '];\n' +
  'void main(){ vec3 sum = vec3(0.);\n' +
  '  for(int i = 0; i < uCount; i++){ vec2 p = vUv - uPts[i]; p.x *= uAspect;\n' +
  '    sum += exp(-dot(p,p)/uRadius)*uAdd[i]; }\n' +
  '  fragColor = vec4(texture(uTarget,vUv).xyz + sum, 1.); }';

var CLEAR = HEAD + 'uniform sampler2D uTexture; uniform float uValue;\n' +
  'void main(){ fragColor = uValue*texture(uTexture,vUv); }';

/* LA TENSIONE SUPERFICIALE. Non rimappa il colorante: lo MOLTIPLICA per un
   guadagno. Sotto la soglia il guadagno e' minore di uno e il velo si ritira;
   sopra e' appena maggiore e la spalla si ingrossa; al centro della goccia
   vale esattamente uno e non tocca niente. (Rimappando invece si tagliava
   anche il vertice: le gocce restavano ferme a mezza densita' e la scritta
   si svuotava lo stesso.) Non e' un effetto grafico, e' quello che tiene in
   vita la lampada: senza, la diffusione numerica dell'advezione impasta tutto
   e in un minuto le lettere sono vuote. */
var TENS = HEAD + 'uniform sampler2D uDye; uniform float uHalf, uAmt, uDt;\n' +
  'void main(){ vec4 v = texture(uDye,vUv);\n' +
  '  float t = clamp(v.x/uHalf, 0., 1.);\n' +
  '  float s = t*t*(3.-2.*t);\n' +
  '  float g = s/max(t, 1e-3);\n' +
  '  v.x *= mix(1.0, g, clamp(uAmt*uDt, 0., 1.));\n' +
  '  fragColor = v; }';

/* IL QUADRO. Esce OPACO in scala di grigi — non trasparente: e' la maschera
   che deve moltiplicare la lettera bianca sotto di se'. Stessa soglia del
   divider: macchie con un bordo, non una nebbia. uDepth da' lo spessore, cioe'
   il centro denso piu' bianco del bordo. */
var SHOW = HEAD + 'uniform sampler2D uDye; uniform float uInkK, uGlobal, uDepth;\n' +
  'void main(){ float c = texture(uDye, vUv).x;\n' +
  '  float body = 1. - exp(-uInkK*c);\n' +
  '  float a = smoothstep(0.40, 0.56, body);\n' +
  '  a *= (1.0 - uDepth) + uDepth*smoothstep(0.48, 0.95, body);\n' +
  '  fragColor = vec4(vec3(a*uGlobal), 1.); }';


function compile(gl, type, src){
  var sh = gl.createShader(type);
  gl.shaderSource(sh, '#version 300 es\n' + src);
  gl.compileShader(sh);
  if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
    console.warn('[capeink]', gl.getShaderInfoLog(sh)); return null;
  }
  return sh;
}
function Program(gl, frag){
  var v = compile(gl, gl.VERTEX_SHADER, VERT), f = compile(gl, gl.FRAGMENT_SHADER, frag);
  if(!v || !f) return null;
  var p = gl.createProgram();
  gl.attachShader(p, v); gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, 'aPosition');
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)){
    console.warn('[capeink]', gl.getProgramInfoLog(p)); return null;
  }
  var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), i;
  for(i = 0; i < n; i++){
    var nm = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
    u[nm] = gl.getUniformLocation(p, nm);
  }
  return { p:p, u:u, use:function(){ gl.useProgram(p); return u; } };
}

function Fluid(canvas){
  var gl = null;
  try{
    gl = canvas.getContext('webgl2', { alpha:true, premultipliedAlpha:true,
      depth:false, stencil:false, antialias:false, powerPreference:'high-performance' });
  }catch(e){}
  if(!gl) return { ok:false };
  if(!gl.getExtension('EXT_color_buffer_float') &&
     !gl.getExtension('EXT_color_buffer_half_float')) return { ok:false };

  var T = gl.HALF_FLOAT;
  function renderable(ifmt, fmt){
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, 4, 4, 0, fmt, T, null);
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    var good = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(f); gl.deleteTexture(t);
    return good;
  }
  function pickF(ifmt, fmt){
    if(renderable(ifmt, fmt)) return { i:ifmt, f:fmt };
    if(ifmt === gl.R16F)  return pickF(gl.RG16F, gl.RG);
    if(ifmt === gl.RG16F) return pickF(gl.RGBA16F, gl.RGBA);
    return null;
  }
  var fRGBA = pickF(gl.RGBA16F, gl.RGBA), fRG = pickF(gl.RG16F, gl.RG), fR = pickF(gl.R16F, gl.RED);
  if(!fRGBA || !fRG || !fR) return { ok:false };

  var pr = {
    advect:Program(gl,ADVECT), forces:Program(gl,FORCES), magnet:Program(gl,MAGNET),
    pull:Program(gl,PULLD),
    curl:Program(gl,CURLP), vort:Program(gl,VORT), div:Program(gl,DIV),
    press:Program(gl,PRESS), grad:Program(gl,GRAD), splat:Program(gl,SPLAT),
    clear:Program(gl,CLEAR), tens:Program(gl,TENS), show:Program(gl,SHOW),
    msplat:Program(gl,MSPLAT)
  };
  for(var k in pr) if(!pr[k]) return { ok:false };

  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  var vel, dye, pres, dvg, crl, aspect = 1, gridW = 1, aw = 0, ah = 0;

  function fbo(w, h, F, filter){
    var t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, F.i, w, h, 0, F.f, T, null);
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t:t, f:f, w:w, h:h, tx:1/w, ty:1/h,
             bind:function(u){ gl.activeTexture(gl.TEXTURE0+u); gl.bindTexture(gl.TEXTURE_2D, t); return u; } };
  }
  function dbl(w, h, F, filter){
    var a = fbo(w,h,F,filter), b = fbo(w,h,F,filter);
    return { w:w, h:h, tx:1/w, ty:1/h,
             get read(){ return a; }, get write(){ return b; },
             swap:function(){ var t = a; a = b; b = t; } };
  }
  function blit(target){
    gl.bindVertexArray(vao);
    if(target){ gl.viewport(0,0,target.w,target.h); gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); }
    else { gl.viewport(0,0,canvas.width,canvas.height); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /* clientWidth/clientHeight e non getBoundingClientRect: la sezione header
     viene scalata e sfocata dallo scroll, e il rect segue la transform. Qui
     serve la misura di layout, quella che la transform non tocca. */
  function resize(){
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.max(1, canvas.clientWidth), ch = Math.max(1, canvas.clientHeight);
    if(cw*ch*dpr*dpr > 3.0e6) dpr = Math.max(1, Math.sqrt(3.0e6/(cw*ch)));
    var w = Math.max(1, Math.round(cw*dpr)), h = Math.max(1, Math.round(ch*dpr));
    if(canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
    aspect = Math.min(12, cw/Math.max(1, ch));
    if(aw === w && ah === h && vel) return false;
    aw = w; ah = h;
    var sw = Math.round(SIM*Math.max(aspect,1)), sh = SIM;
    var dw = Math.round(DYE*Math.max(aspect,1)), dh = DYE;
    gridW = sw;
    vel  = dbl(sw,sh,fRG,gl.LINEAR);
    dye  = dbl(dw,dh,fRGBA,gl.LINEAR);
    pres = dbl(sw,sh,fR,gl.NEAREST);
    dvg  = fbo(sw,sh,fR,gl.NEAREST);
    crl  = fbo(sw,sh,fR,gl.NEAREST);
    return true;
  }
  resize();

  var time = 0;

  /* dx, dy in frazioni di larghezza al secondo. radius = (frazione di
     ALTEZZA)^2, com'e' nel divider: si ragiona a occhio sull'altezza. */
  function splat(x, y, dx, dy, amount, radius){
    var S = gridW, u;
    u = pr.splat.use();
    gl.uniform1i(u.uTarget, vel.read.bind(0)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform2f(u.uPoint,x,y); gl.uniform3f(u.uColor,dx*S,dy*S,0); gl.uniform1f(u.uRadius,radius);
    blit(vel.write); vel.swap();
    u = pr.splat.use();
    gl.uniform1i(u.uTarget, dye.read.bind(0)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform2f(u.uPoint,x,y); gl.uniform3f(u.uColor, amount, 0, 0);
    gl.uniform1f(u.uRadius,radius);
    blit(dye.write); dye.swap();
  }

  /* Come splat, ma solo sul campo di moto: la scia del puntatore non versa
     inchiostro, lo sposta. Passare di qui invece che da splat con amount 0
     risparmia un blit a piena risoluzione del colorante per frame, che e' il
     passaggio piu' caro che c'e' — e sarebbe stato una copia e basta. */
  function push(x, y, dx, dy, radius){
    var S = gridW, u = pr.splat.use();
    gl.uniform1i(u.uTarget, vel.read.bind(0)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform2f(u.uPoint,x,y); gl.uniform3f(u.uColor,dx*S,dy*S,0);
    gl.uniform1f(u.uRadius,radius);
    blit(vel.write); vel.swap();
  }

  /* n sorgenti in due blit invece di 2n. pts = [x,y,...] in UV; vxy = [vx,vy,...]
     in larghezze del box al secondo; amount = colorante per sorgente. */
  var mAdd = new Float32Array(MAXSRC*3);
  function splats(n, pts, vxy, amount, radius){
    if(n < 1) return;
    if(n > MAXSRC) n = MAXSRC;
    var S = gridW, i, u;
    for(i = 0; i < n; i++){
      mAdd[i*3] = vxy[i*2]*S; mAdd[i*3+1] = vxy[i*2+1]*S; mAdd[i*3+2] = 0;
    }
    u = pr.msplat.use();
    gl.uniform1i(u.uTarget, vel.read.bind(0)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uRadius, radius); gl.uniform1i(u.uCount, n);
    gl.uniform2fv(u.uPts, pts); gl.uniform3fv(u.uAdd, mAdd);
    blit(vel.write); vel.swap();

    for(i = 0; i < n; i++){ mAdd[i*3] = amount; mAdd[i*3+1] = 0; mAdd[i*3+2] = 0; }
    u = pr.msplat.use();
    gl.uniform1i(u.uTarget, dye.read.bind(0)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uRadius, radius); gl.uniform1i(u.uCount, n);
    gl.uniform2fv(u.uPts, pts); gl.uniform3fv(u.uAdd, mAdd);
    blit(dye.write); dye.swap();
  }

  function attract(dt, x, y, pull, swirl, radius){
    var u = pr.pull.use();
    gl.uniform2f(u.uTexel, dye.tx, dye.ty);
    gl.uniform1i(u.uDye, dye.read.bind(0));
    gl.uniform2f(u.uPoint, x, y); gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uPull, pull);
    gl.uniform1f(u.uSwirl, swirl); gl.uniform1f(u.uRadius, radius);
    gl.uniform1f(u.uFlat, MAG_FLAT); gl.uniform1f(u.uCore, MAG_CORE/100);
    /* la soglia di stipamento, in "inchiostro pieno": e' la concentrazione a
       cui il quadro non sa piu' distinguere, oltre la quale accumulare non si
       vede e serve solo a schiacciare. */
    gl.uniform1f(u.uSat, MAG_SAT*(-Math.log(0.05)/P.inkK));
    blit(dye.write); dye.swap();
  }

  function magnet(dt, x, y, pull, swirl, radius, bias){
    var u = pr.magnet.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uDye, dye.read.bind(1));
    gl.uniform2f(u.uPoint, x, y); gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uPull, pull*gridW);
    gl.uniform1f(u.uSwirl, swirl*gridW); gl.uniform1f(u.uRadius, radius);
    gl.uniform1f(u.uRef, 3.0); gl.uniform1f(u.uBias, bias);
    gl.uniform1f(u.uFlat, MAG_FLAT);
    blit(vel.write); vel.swap();
  }

  function step(dt){
    var S = gridW, u, i;
    gl.disable(gl.BLEND);
    u = pr.advect.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty); gl.uniform2f(u.uSourceTexel, vel.tx, vel.ty);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uSource, vel.read.bind(0));
    gl.uniform1f(u.uDt,dt); gl.uniform1f(u.uDissipation, P.velDiss);
    blit(vel.write); vel.swap();

    u = pr.forces.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uDye, dye.read.bind(1));
    gl.uniform1f(u.uDt,dt); gl.uniform1f(u.uGravity, P.gravity*S);
    gl.uniform1f(u.uAmbient, P.ambient*S);
    gl.uniform1f(u.uRef, 3.0); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uAspect, aspect);
    blit(vel.write); vel.swap();

    u = pr.curl.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty); gl.uniform1i(u.uVelocity, vel.read.bind(0));
    blit(crl);
    u = pr.vort.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uCurl, crl.bind(1));
    gl.uniform1f(u.uCurlAmount, P.curl); gl.uniform1f(u.uMaxDv, 0.25*S); gl.uniform1f(u.uDt,dt);
    blit(vel.write); vel.swap();

    u = pr.div.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty); gl.uniform1i(u.uVelocity, vel.read.bind(0));
    blit(dvg);
    u = pr.clear.use();
    gl.uniform1i(u.uTexture, pres.read.bind(0)); gl.uniform1f(u.uValue, 0.8);
    blit(pres.write); pres.swap();
    u = pr.press.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty); gl.uniform1i(u.uDivergence, dvg.bind(0));
    for(i = 0; i < ITER; i++){ gl.uniform1i(u.uPressure, pres.read.bind(1)); blit(pres.write); pres.swap(); }
    u = pr.grad.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty);
    gl.uniform1i(u.uPressure, pres.read.bind(0)); gl.uniform1i(u.uVelocity, vel.read.bind(1));
    blit(vel.write); vel.swap();

    u = pr.advect.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty); gl.uniform2f(u.uSourceTexel, dye.tx, dye.ty);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uSource, dye.read.bind(1));
    gl.uniform1f(u.uDt,dt); gl.uniform1f(u.uDissipation, P.dyeDiss);
    blit(dye.write); dye.swap();

    if(P.tension > 0){
      u = pr.tens.use();
      gl.uniform2f(u.uTexel, dye.tx, dye.ty);
      gl.uniform1i(u.uDye, dye.read.bind(0));
      /* Il punto di mezzo della S non e' scelto a occhio: e' ESATTAMENTE la
         concentrazione a cui il quadro decide che li' c'e' inchiostro. Sopra
         quella soglia il colorante viene spinto su, sotto viene spinto giu':
         percio' la tensione non cambia mai il disegno, lo incide e basta. */
      gl.uniform1f(u.uHalf, 2.0*(-Math.log(1.0 - 0.48)/P.inkK));
      gl.uniform1f(u.uAmt, P.tension); gl.uniform1f(u.uDt, dt);
      blit(dye.write); dye.swap();
    }
    time += dt;
  }

  function render(global){
    gl.disable(gl.BLEND);
    var u = pr.show.use();
    gl.uniform2f(u.uTexel, dye.tx, dye.ty);
    gl.uniform1i(u.uDye, dye.read.bind(0));
    gl.uniform1f(u.uInkK, P.inkK);
    gl.uniform1f(u.uDepth, P.depth);
    gl.uniform1f(u.uGlobal, global);
    blit(null);
  }

  var P = { gravity:GRAVITY, curl:CURL, dyeDiss:DYE_DISS, velDiss:VEL_DISS,
            ambient:AMBIENT, inkK:INK_K, depth:INK_DEPTH, tension:TENSION };

  return { ok:true, P:P, splat:splat, splats:splats, push:push, magnet:magnet, attract:attract, step:step, render:render,
           resize:resize, aspect:function(){ return aspect; } };
}


/* ==========================================================================
   3 · IL MONTAGGIO
   Il palco va DENTRO il contenitore della scritta, non sul body: cosi' eredita
   la dissolvenza dell'header quando scrolli, e la copia della scritta continua
   a essere raggiunta dalle stesse regole CSS dell'originale (maiuscolo,
   crenatura, tutto) — la lettera e' identica perche' e' la stessa lettera.
   ========================================================================== */
var head = null, host = null, stage = null, txt = null, cv = null, F = null;
var padNow = 0, shown = false, lastTf = '', lastOr = '';

/* USCITA IN SCROLL. Scorrendo, la scritta se ne va addosso a chi guarda: e' una
   transform, e il palco non la sente. Non e' un caso — il palco e' piazzato in
   coordinate di LAYOUT (offsetLeft/offsetTop) proprio perche' il rect seguirebbe
   la transform e mentirebbe sulla misura. Quindi la transform gli va ricopiata
   sopra a mano.

   L'origine va spostata di PAD: il palco e' la scritta piu' un margine per lato,
   quindi lo stesso punto fisico sta PAD piu' in la' nel suo sistema. Senza
   questo la scritta cresce da un perno e l'inchiostro da un altro, e a meta'
   animazione i due si staccano.

   Basta la transform della SCRITTA, non serve risalire la catena: il palco vive
   dentro head.offsetParent, e una transform crea un blocco contenitore — quindi
   qualunque transform piu' in alto e' gia' quella di un antenato del palco, che
   se la porta dietro da sola. */
function follow(){
  if(!head || !stage) return;
  var cs = getComputedStyle(head);
  var tf = cs.transform === 'none' ? '' : cs.transform;
  if(tf !== lastTf){ stage.style.transform = tf; lastTf = tf; }
  var or = cs.transformOrigin;
  if(or !== lastOr){
    var q = or.split(' ');
    stage.style.transformOrigin =
      ((parseFloat(q[0]) || 0) + padNow) + 'px ' + ((parseFloat(q[1]) || 0) + padNow) + 'px';
    lastOr = or;
  }
  /* e la sua opacita': una scritta che sfuma via lasciando l'inchiostro
     appeso a mezz'aria e' peggio che non seguirla affatto. Solo a comparsa
     finita, se no si litiga con la dissolvenza d'ingresso. */
  if(shown) stage.style.opacity = cs.opacity;
}

function measure(){
  if(!head || !stage) return null;
  /* offsetLeft/Top/Width/Height: misure di layout, immuni alle transform che
     lo scroll mette sull'header. getBoundingClientRect qui mentirebbe. */
  var x = head.offsetLeft, y = head.offsetTop;
  var w = head.offsetWidth, h = head.offsetHeight;
  if(w < 8 || h < 8) return null;
  return { x:x, y:y, w:w, h:h };
}

function layout(){
  var b = measure();
  if(!b) return false;
  /* Il palco e' grande quanto la scritta piu' il margine, non quanto l'header:
     il filtro costa per pixel, e sopra una sezione a tutto schermo sarebbe
     nove volte l'area che serve davvero. */
  var pad = Math.round(PAD * b.h);
  padNow = pad;
  lastOr = '';                       /* l'origine va ricalcolata sul nuovo pad */
  stage.style.left   = (b.x - pad) + 'px';
  stage.style.top    = (b.y - pad) + 'px';
  stage.style.width  = (b.w + pad*2) + 'px';
  stage.style.height = (b.h + pad*2) + 'px';
  txt.style.left   = pad + 'px';
  txt.style.top    = pad + 'px';
  txt.style.width  = b.w + 'px';
  txt.style.height = b.h + 'px';
  return true;
}

function build(){
  head = d.querySelector(SEL);
  if(!head) return false;
  host = head.offsetParent;
  if(!host || host === d.body || host === d.documentElement){
    host = head.parentNode;
    if(!host || host.nodeType !== 1) return false;
    if(getComputedStyle(host).position === 'static') host.style.position = 'relative';
  }

  stage = d.createElement('div');
  stage.className = 'capeink-stage';
  stage.setAttribute('aria-hidden','true');

  /* la copia: stesse classi = stesso font, stesso corpo, stesso maiuscolo.
     Via gli id e tutto cio' che potrebbe farla ripescare da altri script. */
  txt = head.cloneNode(true);
  txt.removeAttribute('id');
  txt.setAttribute('aria-hidden','true');
  txt.setAttribute('data-capeink','clone');
  var kids = txt.querySelectorAll('[id]'), i;
  for(i = 0; i < kids.length; i++) kids[i].removeAttribute('id');
  txt.className = (head.className ? head.className + ' ' : '') + 'capeink-txt';

  cv = d.createElement('canvas');
  cv.className = 'capeink-fluid';
  cv.setAttribute('aria-hidden','true');

  stage.appendChild(txt);
  stage.appendChild(cv);
  host.appendChild(stage);
  d.body.appendChild(svg);

  if(!layout()){ stage.remove(); svg.remove(); return false; }

  F = Fluid(cv);
  if(!F.ok){ stage.remove(); svg.remove(); F = null; return false; }
  return true;
}


/* ==========================================================================
   4 · LA LAMPADA
   Le sorgenti non stanno ferme: vagano su percorsi lenti e incommensurabili
   fra loro, cosi' il disegno non si ripete mai. Ognuna versa un filo di
   colorante, una spinta in su (la piastra calda) e la propria velocita' (la
   scia). La gravita' non newtoniana fa il resto: il denso torna giu', il velo
   resta appeso. Quello e' il giro della cera.
   ========================================================================== */
var GOLD = 1.6180339887;

/* Ogni sorgente ha la SUA fascia di larghezza e ci vaga dentro. Lasciate
   libere si ammucchiavano tutte al centro e mezza scritta restava vuota: qui
   invece l'inchiostro c'e' da "THE" fino a "STUDIO", e le fasce si sovrappongono
   quel tanto che basta perche' non si veda la griglia.
   In verticale il raggio e' stretto apposta: le maiuscole occupano la fascia
   centrale del box, sopra e sotto l'inchiostro ci sarebbe ma non si vedrebbe. */
function srcAt(i, t, n){
  var a = i*GOLD, sp = 0.62 + 0.44*((i*7 % 5)/4), w = t*DRIFT;
  var band = 1/Math.max(1, n);
  var home = band*(i + 0.5);
  /* La corsa verticale e' diversa per ogni sorgente, e fatta di DUE onde con
     periodi incommensurabili invece di una. Con una sola, e uguale per tutte,
     le gocce oscillano in coro: si legge il metronomo sotto, e appena lo si
     legge non e' piu' cera che gira, e' un'animazione. */
  var ya = 0.155 + 0.115*((i*3 % 4)/3);
  return {
    x: home + band*ROAM*Math.sin(w*1.35*sp + a*2.1)*Math.cos(w*0.48 + a),
    y: 0.5 + ya*(0.72*Math.sin(w*1.02*sp + a*3.7) + 0.38*Math.sin(w*0.61/sp + a*1.3))
  };
}

var Eng = (function(){
  var raf = 0, last = 0, acc = 0, clock = 0;
  var primed = false, running = false, seen = true, live = true;
  var prev = [], rect = null, rectAt = 0;
  var mx = 0.5, my = 0.5, tx = 0.5, ty = 0.5, mSeen = false;

  /* BLOB_SIZE e' in % dell'altezza della SCRITTA, perche' e' cosi' che si
     ragiona guardandola. Il fluido pero' misura in frazioni dell'altezza del
     BOX, che e' la scritta piu' il margine: la conversione la fa qui, una
     volta, cosi' cambiare PAD non cambia la grandezza delle gocce. */
  var BLOB_R = 0, DRAG_R = 0;
  function tune(){
    var k = (BLOB_SIZE/100)/(1 + 2*PAD);
    BLOB_R = k*k;
    /* MAG_DRAG_R e' gia' in altezze del BOX: il puntatore non sa niente dei
       glifi, quindi non passa dalla conversione di BLOB_SIZE. */
    var g = MAG_DRAG_R/100;
    DRAG_R = g*g;
  }
  tune();

  function onMove(e){
    if(!cv) return;
    var now = performance.now();
    if(!rect || now - rectAt > 250){ rect = cv.getBoundingClientRect(); rectAt = now; }
    if(rect.width < 2 || rect.height < 2) return;
    tx = (e.clientX - rect.left)/rect.width;
    ty = 1 - (e.clientY - rect.top)/rect.height;
    if(!mSeen){ mx = tx; my = ty; mSeen = true; }
  }

  /* Le sorgenti versano. amount e' per secondo: cosi' se il frame salta non
     cambia quanto inchiostro c'e' in giro. */
  /* Le sorgenti si STRINGONO attorno al puntatore: tutta la fila si contrae
     verso di lui di MAG_HOME, come una fisarmonica. Non e' un richiamo con un
     raggio — con un raggio le sorgenti lontane non lo sentono affatto e meta'
     riga continua a versare inchiostro dov'era, che e' esattamente il motivo
     per cui "segue poco". Una contrazione invece le muove tutte, insieme, e
     nell'ordine in cui erano: non si ammucchiano in un punto, si addensano da
     quella parte. Dove il puntatore non c'e', l'inchiostro smette di nascere e
     si asciuga da solo in un paio di secondi (DYE_DISS).
     In verticale la contrazione e' molto piu' blanda (MAG_FLAT): le lettere
     sono una striscia, e radunare l'inchiostro all'altezza del puntatore
     vorrebbe dire svuotarle appena il mouse passa sopra o sotto la riga. */
  function homeward(s){
    if(!MAG || !mSeen || MAG_HOME <= 0) return;
    var k = 1 - Math.min(MAG_HOME, 0.9);
    s.x = mx + (s.x - mx)*k;
    s.y = my + (s.y - my)*(1 - Math.min(MAG_HOME*MAG_FLAT, 0.9));
  }

  var fPts = new Float32Array(MAXSRC*2), fVel = new Float32Array(MAXSRC*2);
  function feed(dt){
    var i, s, p, vx, vy, heat, sp, n = 0, asp = F.aspect();
    var lim = Math.min(BLOBS, MAXSRC);
    for(i = 0; i < lim; i++){
      s = srcAt(i, clock, lim);
      homeward(s);
      p = prev[i];
      if(!p){ prev[i] = { x:s.x, y:s.y }; continue; }
      vx = (s.x - p.x)/dt;
      vy = (s.y - p.y)/dt/Math.max(asp, 1e-3);
      p.x = s.x; p.y = s.y;
      /* Con la deriva verso il puntatore la sorgente puo' fare uno scatto —
         un mouse che attraversa la riga la trascina con se'. Senza tetto quello
         scatto diventa uno splat di velocita' che sbatte l'inchiostro contro il
         muro: qui la scia resta una scia. */
      sp = Math.sqrt(vx*vx + vy*vy);
      if(sp > 0.60){ vx *= 0.60/sp; vy *= 0.60/sp; }
      /* Tutto quello che la sorgente versa e' AL SECONDO, velocita' compresa:
         va moltiplicato per dt. Uno splat di velocita' e' un impulso, e un
         impulso ripetuto sessanta volte al secondo non e' una spinta gentile,
         e' un getto — l'inchiostro finiva schiacciato contro il bordo invece
         di galleggiare. Cosi' invece LIFT e' un'accelerazione e WANDER e' un
         attrito: quanto la cera si fa trascinare da chi la versa.
         E LIFT non e' costante. In una lampada vera la piastra scalda la cera
         che le sta sopra, quella sale, in cima si raffredda e ricade mentre
         un'altra parte: e' un ciclo, ed e' sfasato da goccia a goccia. Qui
         ogni sorgente ha il suo, con un passo diverso (CYCLE), cosi' in ogni
         istante qualcuna sale e qualcuna scende. heat va da -0.38 a +1.22 —
         va sottozero, perche' senza la fase in cui la cera RICADE non c'e'
         nessun giro: c'e' solo roba che galleggia in alto. La media resta
         0.42, ed e' su quella che LIFT si bilancia con GRAVITY. */
      heat = 0.42 + 0.80*Math.sin(clock*CYCLE*(0.70 + 0.60*((i*11 % 7)/6)) + i*GOLD*6.2832);
      fPts[n*2] = s.x;                 fPts[n*2+1] = s.y;
      fVel[n*2] = vx*WANDER*dt;        fVel[n*2+1] = (vy*WANDER + LIFT*heat)*dt;
      n++;
    }
    F.splats(n, fPts, fVel, FEED*dt, BLOB_R);
  }

  function physics(dt){
    feed(dt);
    if(MAG && mSeen){
      mx += (tx - mx)*Math.min(1, dt*MAG_EASE);
      my += (ty - my)*Math.min(1, dt*MAG_EASE);
      var r = Math.pow(MAG_R/100, 2);
      F.magnet(dt, mx, my, MAG_STIR, MAG_STIR*(MAG_SWIRL/Math.max(MAG_PULL,1e-4)), r, MAG_BIAS);
      F.attract(dt, mx, my, MAG_PULL, MAG_SWIRL, r);
      drag(dt);
      pmx = mx; pmy = my; pSeen = true;
    }
    F.step(dt);
    clock += dt;
  }

  /* LA SCIA. Si prende la velocita' della calamita, non quella del puntatore:
     e' gia' passata da MAG_EASE, quindi e' la stessa mano ma senza gli scatti
     di un evento che arriva quando gli pare. Come per le sorgenti, quello che
     si aggiunge e' un attrito x dt e non un impulso: un impulso ripetuto a
     ogni frame sarebbe un getto, e il getto non lo fa nessuna mano.
     Le due componenti sono in larghezze del box al secondo — la y va divisa
     per l'aspect perche' arriva in altezze — cosi' un gesto in diagonale
     trascina uguale sullo schermo e non di sbieco. */
  var pmx = 0, pmy = 0, pSeen = false;
  function drag(dt){
    if(MAG_DRAG <= 0 || !pSeen) return;
    var asp = Math.max(F.aspect(), 1e-3);
    var vx = (mx - pmx)/dt, vy = (my - pmy)/dt/asp;
    var sp = Math.sqrt(vx*vx + vy*vy);
    if(sp < 1e-4) return;
    if(sp > MAG_DRAG_V){ var q = MAG_DRAG_V/sp; vx *= q; vy *= q; }
    F.push(mx, my, vx*MAG_DRAG*dt, vy*MAG_DRAG*dt, DRAG_R);
  }

  /* Il resize ricrea le texture del fluido: il colorante di prima non c'e'
     piu'. Senza questo, tirando l'angolo della finestra le lettere restavano
     vuote finche' la lampada non si riempiva da capo. */
  function reseed(){ primed = false; clock = 0; prime(); }

  function prime(){
    if(primed) return;
    primed = true;
    var i;
    /* qualche goccia gia' sparsa, poi la fisica gira a vuoto: al primo frame
       visibile le macchie sono gia' macchie, non palline appena versate. */
    for(i = 0; i < BLOBS; i++){
      var s = srcAt(i, 0, BLOBS);
      F.splat(s.x, s.y, 0, 0, FEED*0.8, BLOB_R);
    }
    for(i = 0; i < PRIME; i++) physics(1/60);
  }

  function frame(now){
    raf = 0;
    if(!last) last = now;
    var raw = (now - last)/1000; last = now;

    var rate = clock < BOOST_S ? BOOST : 1;
    acc += raw*rate; if(acc > 8/60) acc = 4/60;
    var steps = 0, cap = rate > 1 ? 5 : 3;
    while(acc >= 1/60 && steps < cap){ physics(1/60); acc -= 1/60; steps++; }
    F.render(1);
    follow();

    if(running) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  var fadeT = 0;
  function start(){
    if(running || !F) return;
    prime();
    running = true;
    stage.classList.add('is-in');
    clearTimeout(fadeT);
    fadeT = setTimeout(function(){ shown = true; }, FADE_MS);
    if(!raf){ last = 0; raf = requestAnimationFrame(frame); }
  }
  function stop(){
    running = false;
    if(raf){ cancelAnimationFrame(raf); raf = 0; }
    last = 0; acc = 0;
    clearTimeout(fadeT);
    shown = false;
    /* via l'opacita' scritta a mano, se no vince sulla classe e il palco non
       sparisce piu' quando l'header esce dallo schermo. */
    stage.style.opacity = '';
    stage.classList.remove('is-in');
  }
  function vis(v){ seen = v; if(v && live) start(); else stop(); }
  function awake(a){ live = a; if(a && seen) start(); else stop(); }

  return { start:start, stop:stop, vis:vis, awake:awake, tune:tune, reseed:reseed,
           move:onMove, at:function(){ return { x:mx, y:my }; },
           burst:function(){
             if(!F) return;
             var i, s;
             for(i = 0; i < BLOBS*2; i++){
               s = srcAt(i % BLOBS, clock + i*4.1, BLOBS);
               F.splat(s.x, s.y, 0, 0.010, FEED*3, BLOB_R);
             }
           } };
})();


/* ==========================================================================
   5 · ACCENSIONE
   Si aspettano i font: se il canvas partisse prima, la copia della scritta
   sarebbe misurata col fallback e le lettere non combacerebbero.
   Si guarda anche se l'header e' ancora sullo schermo: scrollato via, la
   fisica si ferma. Non serve far girare un fluido dietro a una pagina che
   nessuno sta guardando.
   ========================================================================== */
var ro = null, io = null, rt = 0;

function relayout(){
  if(!F) return;
  if(!layout()) return;
  if(F.resize()) Eng.reseed();
}

function watch(){
  try{
    ro = new ResizeObserver(function(){
      clearTimeout(rt);
      rt = setTimeout(relayout, 120);
    });
    ro.observe(host);
    ro.observe(head);
  }catch(e){
    addEventListener('resize', function(){
      clearTimeout(rt); rt = setTimeout(relayout, 160);
    }, { passive:true });
  }

  try{
    io = new IntersectionObserver(function(en){
      Eng.vis(!!(en[0] && en[0].isIntersecting));
    }, { rootMargin:'10% 0px' });
    io.observe(head);
  }catch(e){ Eng.vis(true); }

  d.addEventListener('visibilitychange', function(){ Eng.awake(!d.hidden); });
  addEventListener('pointermove', Eng.move, { passive:true });
}

function init(){
  if(!build()) return;
  watch();
  Eng.start();

  /* La console: le manopole si provano dal vivo, senza ripubblicare. */
  window.capeTitleInk = {
    set:function(o){
      var m = { GRAVITY:'gravity', CURL:'curl', DYE_DISS:'dyeDiss', VEL_DISS:'velDiss',
                AMBIENT:'ambient', INK_K:'inkK', INK_DEPTH:'depth', TENSION:'tension' }, k;
      for(k in o){
        if(!Object.prototype.hasOwnProperty.call(o, k)) continue;
        if(m[k] && F) F.P[m[k]] = o[k];
        else if(k === 'FEED')      FEED = o[k];
        else if(k === 'LIFT')      LIFT = o[k];
        else if(k === 'CYCLE')     CYCLE = o[k];
        else if(k === 'DRIFT')     DRIFT = o[k];
        else if(k === 'WANDER')    WANDER = o[k];
        else if(k === 'ROAM')      ROAM = o[k];
        else if(k === 'BLOBS')     BLOBS = Math.max(1, Math.min(MAXSRC, o[k]|0));
        else if(k === 'BLOB_SIZE'){ BLOB_SIZE = o[k]; Eng.tune(); }
        else if(k === 'PAD'){ PAD = o[k]; Eng.tune(); relayout(); }
        else if(k === 'MAG')       MAG = o[k];
        else if(k === 'MAG_PULL')  MAG_PULL = o[k];
        else if(k === 'MAG_SWIRL') MAG_SWIRL = o[k];
        else if(k === 'MAG_STIR')  MAG_STIR = o[k];
        else if(k === 'MAG_R')     MAG_R = o[k];
        else if(k === 'MAG_FLAT')  MAG_FLAT = o[k];
        else if(k === 'MAG_CORE')  MAG_CORE = o[k];
        else if(k === 'MAG_SAT')   MAG_SAT = o[k];
        else if(k === 'MAG_HOME')  MAG_HOME = o[k];
        else if(k === 'MAG_EASE')  MAG_EASE = o[k];
        else if(k === 'MAG_BIAS')  MAG_BIAS = o[k];
        else if(k === 'MAG_DRAG')  MAG_DRAG = o[k];
        else if(k === 'MAG_DRAG_V') MAG_DRAG_V = o[k];
        else if(k === 'MAG_DRAG_R'){ MAG_DRAG_R = o[k]; Eng.tune(); }
      }
      return window.capeTitleInk.read();
    },
    read:function(){
      return { FEED:FEED, LIFT:LIFT, CYCLE:CYCLE, WANDER:WANDER, DRIFT:DRIFT, ROAM:ROAM,
               BLOBS:BLOBS, BLOB_SIZE:BLOB_SIZE,
               DYE_DISS:F && F.P.dyeDiss, VEL_DISS:F && F.P.velDiss,
               GRAVITY:F && F.P.gravity, AMBIENT:F && F.P.ambient, CURL:F && F.P.curl,
               INK_K:F && F.P.inkK, INK_DEPTH:F && F.P.depth, TENSION:F && F.P.tension,
               MAG:MAG, MAG_PULL:MAG_PULL, MAG_SWIRL:MAG_SWIRL, MAG_STIR:MAG_STIR, MAG_R:MAG_R, MAG_FLAT:MAG_FLAT, MAG_CORE:MAG_CORE, MAG_SAT:MAG_SAT, MAG_HOME:MAG_HOME,
               MAG_EASE:MAG_EASE, MAG_BIAS:MAG_BIAS,
               MAG_DRAG:MAG_DRAG, MAG_DRAG_R:MAG_DRAG_R, MAG_DRAG_V:MAG_DRAG_V };
    },
    burst:Eng.burst,
    pause:function(){ Eng.awake(false); },
    resume:function(){ Eng.awake(true); },
    relayout:relayout
  };
}

function boot(){
  var go = function(){ setTimeout(init, 0); };
  if(d.fonts && d.fonts.ready) d.fonts.ready.then(go).catch(go);
  else go();
}

if(d.readyState === 'complete') boot();
else addEventListener('load', boot, { once:true });

})();
