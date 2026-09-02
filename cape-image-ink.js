/* ============================================================================
   THE CAPE — INCHIOSTRO CHE INVERTE, DENTRO LE IMMAGINI · cape-image-ink.js

   Passando il cursore su un'immagine della pagina il puntatore diventa un
   PENNELLO, e sotto la punta resta dell'inchiostro. L'inchiostro non ha un
   colore suo: e' l'immagine stessa rovesciata. Vive solo dentro il rettangolo
   dell'immagine, che si comporta come una vasca: sui bordi il fluido rimbalza,
   fuori non esce niente.

   LA FISICA E' QUELLA DELLA REPO header — lo stesso solutore del pennello di
   cape-header.js (advezione, forze, vorticita', divergenza, pressione,
   gradiente) con le stesse manopole: BRUSH_SIZE, BRUSH_AMT, BRUSH_PULL,
   BRUSH_DRY, BRUSH_GRAVITY. Del vecchio effetto e' rimasta solo quella.

   L'INVERSIONE — la parte che non e' un invert(1)
   Un negativo puro (1-c per canale) ribalta anche la TINTA: un tramonto caldo
   diventa blu acido. E' la cosa che si vede ovunque ed e' il motivo per cui
   l'effetto sembra un filtro e non una scelta.
   Qui l'inversione e' di SOLA LUMINANZA: si ribalta il canale, poi si riporta
   la tinta al punto di partenza con una rotazione di 180 gradi. Il sole
   diventa scuro, le ombre si accendono, ma il caldo resta caldo — la stampa
   sembra virata al bronzo, non fotocopiata. Su una foto in bianco e nero e'
   un negativo pulito e corretto in gamma. E' il "tono invertito" della camera
   oscura, non l'inversione del menu contestuale.
   Tutto sta in GRADE, una riga sola, leggibile e modificabile.

   COME E' COMPOSTO
   - L'immagine non si tocca: resta dov'e', com'e'.
   - Sopra ci va un canvas 2D grande esattamente quanto l'immagine.
   - Una COPIA gia' invertita dell'immagine viene disegnata UNA volta in una
     cache fuori schermo (il filtro non cambia mai: inutile rifarlo a ogni
     frame). Ogni frame si copia la cache e la si ritaglia con
     destination-in usando la maschera del fluido. Due blit, nient'altro.
   - Niente lettura di pixel: nessun getImageData, nessuna texture WebGL
     costruita dall'immagine. Quindi nessun problema di CORS con il CDN di
     Webflow, e funziona uguale su <img> e su background-image.

   SU QUALI IMMAGINI
   Su quelle a cui dai la classe `ink-invert` nel Designer, e basta. Vedi SEL
   nelle IMPOSTAZIONI: e' l'unica cosa da sapere per accendere e spegnere
   l'effetto su una foto.

   IL CURSORE
   Sull'immagine il cursore diventa UNA COSA SOLA: la parola VIEW. Il cursore
   che c'e' gia' in pagina — onda, anello, sua scritta — si spegne per intero
   finche' sei sull'immagine, e torna da solo quando esci.
   Un simbolo di pennello c'era, e l'ho tolto: fra l'anello grande, il simbolo
   e la scritta erano tre segni nello stesso punto, e tre segni insieme non si
   leggono. Che stai dipingendo non serve dirlo — lo dice l'inchiostro, che e'
   molto piu' grande e piu' chiaro di un simbolino da 26px.
   La parola resta per tutto il tempo (e' l'invito a cliccare, e un invito che
   compare solo quando ti fermi non lo vede nessuno) ma insegue il puntatore un
   filo piu' lenta, cosi' non sembra un'etichetta incollata al mouse.
   Chi la rivuole, la punta e' ancora li': NIB a true.
   Il blocco #capecur gia' in pagina NON va toccato: viene messo a riposo da
   una regola CSS con !important, che batte le opacita' inline che quel codice
   scrive a ogni frame.

   DOVE VA
   Pages -> The Cape Studio -> Settings -> Custom code -> Before </body> tag,
   come ultima riga:
     <script defer src="https://cdn.jsdelivr.net/gh/cash9086/header@SHA/cape-image-ink.js"><\/script>
   (la barra rovesciata li' sopra serve solo qui dentro. Se questo file finisce
   incollato DENTRO un tag script invece che linkato, un tag di chiusura scritto
   per esteso lo chiuderebbe a meta' file: il browser prende il resto per testo
   e non parte niente, con un "Invalid or unexpected token" in console. Scritto
   con la barra, il file si puo' incollare inline senza rompere nulla.)
   Il CSS se lo scrive da solo. Non c'e' ordine da rispettare con gli altri
   script della pagina.

   Sotto MIN_W, senza mouse, con prefers-reduced-motion o senza WebGL2 float
   non parte niente: le immagini restano esattamente come sono adesso.

   Dalla console, a pagina aperta:
       capeImageInk.set({ BRUSH_SIZE: 3.2, GRADE: 'invert(1)' })
       capeImageInk.read()      capeImageInk.targets()
       capeImageInk.pause()     capeImageInk.resume()
============================================================================ */

(function(){
'use strict';

if(window.__capeimageink) return;
window.__capeimageink = 1;

/* ========================== IMPOSTAZIONI ================================== */

/* --- dove ---------------------------------------------------------------- */
/* CHI PRENDE L'INCHIOSTRO. Una classe sola, decisa da te nel Designer: dai
   `ink-invert` a un'immagine e quella ce l'ha, gliela togli e non ce l'ha piu'.
   Niente altro da fare, da nessuna parte.

   Sta apposta SEPARATA da `cape-view`, che governa un'altra cosa — l'anello
   con la scritta del cursore gia' in pagina. Le due si combinano da sole:
     ink-invert + cape-view  -> pennello e inchiostro (le immagini di adesso)
     solo ink-invert         -> pennello e inchiostro anche dove l'anello non c'era
     solo cape-view          -> l'anello con VIEW come sempre, senza inchiostro
   Funziona sia sull'<img> sia su un contenitore (lo stage delle opere e' un div).
   `data-ink-invert` fa lo stesso, per quando e' piu' comodo un attributo. */
var SEL = '.ink-invert, [data-ink-invert]';

/* --- L'INVERSIONE -------------------------------------------------------
   E' UNA RIGA SOLA e vale la pena capirla, perche' e' tutto l'effetto.

     invert(1)            ribalta il canale: il chiaro diventa scuro.
                          Da solo ribalta anche la tinta -> caldo => blu.
     hue-rotate(180deg)   riporta la tinta da dove veniva. Restano invertite
                          solo la luce e l'ombra. E' questo il trucco.
     saturate(.92)        un filo di colore in meno: il negativo di una foto
                          satura sempre un po' troppo, e la sobrieta' e' la
                          differenza fra "virato" e "psichedelico".
     contrast(1.04)       riprende lo stacco che l'inversione appiattisce.

   Alternative gia' pronte, da provare al volo con capeImageInk.set():
     'invert(1)'                                    negativo classico, duro
     'invert(1) hue-rotate(180deg) saturate(0)'     argento: vira tutto al
                                                    grigio, minimale estremo
     'invert(1) hue-rotate(180deg) sepia(.22)'      stampa virata seppia     */
var GRADE = 'invert(1) hue-rotate(180deg) saturate(.92) contrast(1.04)';

/* Un velo caldissimo steso SOLO dentro l'inchiostro: toglie il grigio-fango
   che l'inversione lascia nei mezzi toni e lega la macchia alla palette della
   pagina. Tenerlo bassissimo — sopra 0.1 si vede il colore e diventa un
   filtro. VEIL_A = 0 lo spegne. */
var VEIL     = '#F1ECE2';   /* la crema del sito                              */
var VEIL_A   = 0.05;

/* --- il pennello: stessa fisica del brush di cape-header.js -------------- */
var BRUSH_SIZE   = 1.7;   /* GRANDEZZA della punta, in % dell'ALTEZZA
                             dell'immagine. E' la manopola principale: per
                             togliere il 20% moltiplica per 0.8. Il passo del
                             tratto si adegua da solo.                        */
var BRUSH_AMT    = 0.34;  /* colorante per splat: piu' alto = tratto piu' pieno */
var BRUSH_PULL   = 0.24;  /* quanta velocita' della mano passa al fluido. Alto =
                             l'inchiostro scappa avanti alla mano; basso = resta
                             incollato al puntatore.                          */
var BRUSH_DRY    = 1.45;  /* quanto asciuga: piu' alto = il tratto svanisce prima */
var BRUSH_GRAVITY= 0.30;  /* quanto cola. Qui si vede il non newtoniano: il denso
                             scende, il velo resta sospeso.                   */
var BRUSH_CURL   = 0.09;  /* vorticita': quanto si arriccia sui bordi         */
var BRUSH_AMB    = 0.003; /* correnti lente: impediscono al tratto di stare fermo */
var VEL_DISS     = 2.60;  /* attrito del campo di moto                        */
var INK_K        = 2.60;  /* densita': alzalo e il velo sottile conta come pieno */

/* --- il bordo bagnato ---------------------------------------------------
   L'inchiostro vero, asciugando, si raduna sul perimetro della macchia: e' il
   coffee-ring, il bordo piu' carico del centro. Senza, la macchia sembra
   un'ombra sfocata; con, sembra bagnata. E' il dettaglio che regge da vicino. */
var RIM      = 0.30;   /* quanto e' marcato il bordo. 0 = spento              */
var RIM_W    = 0.16;   /* quanto e' stretto: basso = filo, alto = alone       */

/* --- comparsa e uscita --------------------------------------------------- */
var FADE_IN  = 220;    /* ms: l'inchiostro non deve mai apparire di colpo     */
var FADE_OUT = 620;    /* ms: uscendo si ritira mentre asciuga                */

/* --- il cursore ----------------------------------------------------------
   Sull'immagine il cursore e' UNA COSA SOLA: la parola. Niente anello, niente
   punta, niente onda. Non e' minimalismo per partito preso — l'anello grande
   della pagina, il simbolo del pennello e la scritta erano tre segni diversi
   tutti nello stesso punto, e tre segni insieme non si leggono. Il pennello poi
   non serve dirlo: lo dice l'inchiostro, che e' molto piu' grande e piu' chiaro
   di un simbolino da 26px.
   Il cursore che c'e' gia' in pagina viene spento per intero finche' sei
   sull'immagine, e torna da solo quando esci. */
var CUR      = true;   /* false = lascia il cursore com'e' anche sulle immagini */
var NIB      = false;  /* true = rimette la punta di pennello sotto la scritta */
var NIB_L    = 26;     /* lunghezza della punta a riposo (px)                 */
var NIB_W    = 4.6;    /* larghezza della punta (px)                          */
var NIB_MAX  = 2.05;   /* quanto si allunga al massimo della velocita'        */
var NIB_SPD  = 900;    /* px/s a cui la punta e' allungata al massimo         */
var TRAIL    = 0.20;   /* scia: e' la stessa del cursore gia' in pagina, cosi'
                          i due non si separano mai                           */
/* LA SCRITTA. Sta li' tutto il tempo che il cursore e' sull'immagine: e' un
   invito a cliccare, e un invito che compare solo quando ti fermi non lo vede
   nessuno. Si muove pero' un filo piu' lenta della punta (LABEL_LAG), cosi'
   non sembra incollata al cursore mentre dipingi.
   LABEL_MIN e' quanto si vede MENTRE la mano corre: a 1 non cambia mai, sotto
   1 sfiata un po' in corsa e si riprende quando ti fermi. A 0 torna il
   comportamento di prima, cioe' compare solo a mano ferma. */
var LABEL    = 'View'; /* il testo. data-cursor lo sovrascrive; data-cursor=""
                          (vuoto) toglie la scritta — per le immagini che
                          prendono l'inchiostro ma non si aprono              */
var LABEL_MIN= 1;      /* opacita' della scritta a mano in movimento          */
var LABEL_LAG= 0.45;   /* quanto la scritta insegue la punta: 1 = incollata.
                          Attenzione che e' meno intuitivo di quel che sembra:
                          il ritardo che si vede va come (1-LAG)/LAG per la
                          velocita' della punta, quindi 0.15 non e' "un filo
                          di ritardo", e' mezzo schermo indietro su una passata
                          veloce. 0.45 sono una decina di px a velocita' vera. */
var LABEL_CAP= 26;     /* e comunque non si stacca mai piu' di tanti px: su una
                          sciabolata la scritta deve seguire, non volare via   */
var LABEL_DY = 18;     /* quanto sta sotto al puntatore (px). Sotto e non sopra
                          perche' e' li' che l'occhio non ha l'inchiostro      */
var LABEL_SZ = 11;     /* corpo (px). E' quello del cursore gia' in pagina: la
                          scritta cambia posto, non voce                       */
var LABEL_TR = 0.16;   /* tracking (em). Su un font piccolo tutto maiuscolo e'
                          quello che lo rende leggibile invece che compatto    */

/* IL PASSAGGIO. Il logo che sparisce e la scritta che appare non sono due
   dissolvenze: sono un cambio di turno. Il logo esce, e la parola SALE da sotto
   dentro una finestra che la ritaglia — la stessa lingua delle righe di testo
   che gia' salgono nella sezione delle opere, non un movimento inventato qui.
   Mentre sale il tracking si stringe: la parola arriva larga e si raccoglie.
   E' l'unico pezzo di animazione dell'effetto e dura meno di mezzo secondo.
   In uscita la parola prosegue verso l'ALTO invece di tornare giu': non e'
   l'animazione al contrario, e' la stessa che continua — e nel frattempo il
   logo rientra, cosi' non ci sono mai due cose insieme. */
var LAB_IN   = 460;    /* la salita (ms)                                       */
var LAB_OUT  = 260;    /* l'uscita verso l'alto (ms)                           */
var LAB_DELAY= 90;     /* quanto aspetta prima di salire: il tempo che il logo
                          se ne vada. Sotto i 60 si accavallano.               */
var LABEL_TR_IN = 0.18;/* tracking IN PIU' all'inizio della salita (em): la
                          parola entra larga e si stringe arrivando            */
var REST_MS  = 240;    /* quanto deve stare ferma la mano per dirla "ferma"   */
var REST_SPD = 42;     /* px/s sotto cui la mano e' considerata ferma         */

/* --- il terreno ---------------------------------------------------------- */
var MIN_W    = 992;    /* sotto questa larghezza non parte niente            */
var SIM      = 96;     /* risoluzione del campo di moto (lato corto)         */
var DYE      = 384;    /* risoluzione del colorante (lato corto)             */
var ITER     = 18;     /* giri di pressione                                  */
var MAX_PX   = 2.2e6;  /* tetto ai pixel del canvas: oltre, si abbassa il dpr */
var BUSY_SEL = '.is-busy'; /* mentre l'immagine SCORRE l'inchiostro si ritira,
                              invece di restare appiccicato a un quadro che sta
                              uscendo di scena                                 */
var BUSY_MAX = 900;    /* ...ma per non piu' di tanti ms, ed e' il motivo per cui
                          esiste questa manopola. La classe is-busy dello slider
                          non dura quanto il movimento dell'immagine: la mettono
                          all'inizio e la tolgono quando finisce TUTTA la
                          coreografia, testi compresi — circa 1,8 secondi, mentre
                          l'immagine si muove solo per i primi 0,9. Senza tetto
                          l'inchiostro resta spento per quasi un secondo in cui
                          non c'e' piu' niente che si muove, e passando sopra
                          sembra rotto. 0 = nessun tetto, torna il difetto.     */
/* Dove si infila il canvas nella pila. Due casi diversi e vale la pena dirlo:
   - su un <img> il canvas si inserisce SUBITO DOPO l'immagine e sta a 0, cosi'
     una didascalia posizionata che viene dopo nel DOM gli resta sopra: si
     dipinge sotto al testo, non addosso.
   - dentro un contenitore (lo stage delle opere) il canvas e' l'ultimo figlio
     e deve stare sopra le due pagine, che il loro JS mette a z-index 1 e 2. */
var Z_IMG    = 0;
var Z_BOX    = 4;
/* ========================================================================== */

/* Le grandezze sopra sono percentuali perche' e' cosi' che si ragiona a occhio.
   Il fluido pero' vuole il raggio dentro un exp(-d^2/r), dove r e' il raggio al
   QUADRATO: la conversione la fa il codice, qui, una volta sola. Il passo del
   tratto e' una frazione fissa del raggio — sotto quella soglia un pennello
   piccolo smette di lasciare un tratto e lascia una fila di punti. */
function brushR(){ return Math.pow(BRUSH_SIZE/100, 2); }
function brushStep(){ return (BRUSH_SIZE/100) * 0.18; }

var d = document;
function mq(q){ try{ return matchMedia(q).matches; }catch(e){ return false; } }


/* ==========================================================================
   1 · IL FLUIDO
   Il solutore del pennello di cape-header.js, senza toccarne il cuore.
   Il pezzo che conta e' in FORCES:
       cc    = c/uRef
       heavy = cc*(0.16 + 0.84*cc*cc)
       vel.y -= uGravity*heavy*dt
   il peso non e' proporzionale alla quantita', ci va quasi col cubo: il denso
   cola, il velo resta sospeso. E' la ragione per cui questo inchiostro fa
   macchie e non sfumature.
   Le velocita' sono in "frazioni di larghezza al secondo" moltiplicate per la
   larghezza della griglia: cosi' x e y si muovono uguale sullo schermo anche
   quando l'immagine e' larga e bassa.
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

/* I bordi rimandano indietro: e' QUESTO che tiene l'inchiostro dentro
   l'immagine. Il rettangolo dell'immagine e' la vasca. */
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

var CLEAR = HEAD + 'uniform sampler2D uTexture; uniform float uValue;\n' +
  'void main(){ fragColor = uValue*texture(uTexture,vUv); }';

/* LA MASCHERA. Esce come sola ALFA: il colore non serve, ci pensa la copia
   invertita sotto. Stessa soglia del divider — macchie con un bordo, non una
   nebbia — piu' il bordo bagnato: una gaussiana stretta centrata sulla soglia,
   che alza l'alfa giusto sul perimetro della macchia. E' il coffee-ring. */
var MASK = HEAD + 'uniform sampler2D uDye;\n' +
  'uniform float uInkK, uGlobal, uRim, uRimW;\n' +
  'void main(){ float c = texture(uDye, vUv).x;\n' +
  '  float body = 1. - exp(-uInkK*c);\n' +
  '  float a = smoothstep(0.40, 0.56, body);\n' +
  '  float e = (body - 0.48)/max(uRimW, 1e-3);\n' +
  '  a = clamp(a + uRim*exp(-e*e)*a, 0., 1.);\n' +
  '  a *= uGlobal;\n' +
  '  fragColor = vec4(0., 0., 0., a); }';

function compile(gl, type, src){
  var sh = gl.createShader(type);
  gl.shaderSource(sh, '#version 300 es\n' + src);
  gl.compileShader(sh);
  if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
    console.warn('[capeimageink]', gl.getShaderInfoLog(sh)); return null;
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
    console.warn('[capeimageink]', gl.getProgramInfoLog(p)); return null;
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
    advect:Program(gl,ADVECT), forces:Program(gl,FORCES), curl:Program(gl,CURLP),
    vort:Program(gl,VORT), div:Program(gl,DIV), press:Program(gl,PRESS),
    grad:Program(gl,GRAD), splat:Program(gl,SPLAT), clear:Program(gl,CLEAR),
    mask:Program(gl,MASK)
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

  /* Le misure arrivano da fuori (il box dell'immagine), non da clientWidth:
     il canvas e' fuori dal flusso e non ha una taglia sua. */
  function resize(cw, ch){
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = Math.max(1, cw); ch = Math.max(1, ch);
    if(cw*ch*dpr*dpr > MAX_PX) dpr = Math.max(1, Math.sqrt(MAX_PX/(cw*ch)));
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

  var time = 0;

  /* dx, dy in frazioni di larghezza al secondo. radius = (frazione di
     ALTEZZA)^2: si ragiona a occhio sull'altezza. */
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

  function step(dt){
    var S = gridW, u, i;
    gl.disable(gl.BLEND);
    u = pr.advect.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty); gl.uniform2f(u.uSourceTexel, vel.tx, vel.ty);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uSource, vel.read.bind(0));
    gl.uniform1f(u.uDt,dt); gl.uniform1f(u.uDissipation, VEL_DISS);
    blit(vel.write); vel.swap();

    u = pr.forces.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uDye, dye.read.bind(1));
    gl.uniform1f(u.uDt,dt); gl.uniform1f(u.uGravity, BRUSH_GRAVITY*S);
    gl.uniform1f(u.uAmbient, BRUSH_AMB*S); gl.uniform1f(u.uRef, 3.0);
    gl.uniform1f(u.uTime,time); gl.uniform1f(u.uAspect,aspect);
    blit(vel.write); vel.swap();

    u = pr.curl.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty); gl.uniform1i(u.uVelocity, vel.read.bind(0));
    blit(crl);
    u = pr.vort.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uCurl, crl.bind(1));
    gl.uniform1f(u.uCurlAmount, BRUSH_CURL); gl.uniform1f(u.uMaxDv,0.25*S); gl.uniform1f(u.uDt,dt);
    blit(vel.write); vel.swap();

    u = pr.div.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty); gl.uniform1i(u.uVelocity, vel.read.bind(0));
    blit(dvg);
    u = pr.clear.use();
    gl.uniform1i(u.uTexture, pres.read.bind(0)); gl.uniform1f(u.uValue,0.8);
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
    gl.uniform1f(u.uDt,dt); gl.uniform1f(u.uDissipation, BRUSH_DRY);
    blit(dye.write); dye.swap();
    time += dt;
  }

  function render(global){
    gl.disable(gl.BLEND);
    var u = pr.mask.use();
    gl.uniform2f(u.uTexel, dye.tx, dye.ty);
    gl.uniform1i(u.uDye, dye.read.bind(0));
    gl.uniform1f(u.uInkK, INK_K); gl.uniform1f(u.uGlobal, global);
    gl.uniform1f(u.uRim, RIM); gl.uniform1f(u.uRimW, RIM_W);
    blit(null);
  }

  function wipe(){
    var u = pr.clear.use();
    gl.uniform1i(u.uTexture, dye.read.bind(0)); gl.uniform1f(u.uValue, 0);
    blit(dye.write); dye.swap();
    u = pr.clear.use();
    gl.uniform1i(u.uTexture, vel.read.bind(0)); gl.uniform1f(u.uValue, 0);
    blit(vel.write); vel.swap();
  }

  return { ok:true, splat:splat, step:step, render:render, wipe:wipe,
           resize:resize, aspect:function(){ return aspect; } };
}


/* ==========================================================================
   2 · IL PALCO
   Un canvas 2D grande esattamente quanto l'immagine, sopra l'immagine.
   Dentro, ogni frame: la copia invertita, ritagliata dalla maschera.
   ========================================================================== */

var CSS_TXT =
  '.capeink-cv{position:absolute;pointer-events:none;z-index:2;opacity:0;' +
    'will-change:opacity;transition:opacity 160ms linear}' +
  '.capeink-cv.is-on{opacity:1}' +
  /* La punta del pennello. difference come il cursore gia' in pagina, cosi'
     resta leggibile sia sul chiaro sia sullo scuro. */
  '#capeink-nib{position:fixed;top:0;left:0;width:0;height:0;z-index:2147483646;' +
    'pointer-events:none;mix-blend-mode:difference;opacity:0;will-change:transform}' +
  '#capeink-nib.is-on{opacity:1}' +
  '#capeink-nib>*{position:absolute;top:0;left:0;transform:translate(-50%,-50%)}' +
  '#capeink-nib svg{overflow:visible;display:block}' +
  '#capeink-nib svg path{fill:#fff}' +
  /* la finestra che ritaglia: e' lei a fare la rivelazione, non un'opacita' */
  '#capeink-nib .ni-label{color:#fff;font:600 11px/1 Inter,system-ui,sans-serif;' +
    'text-transform:uppercase;white-space:nowrap;opacity:0;' +
    'display:block;overflow:hidden;transition:opacity 200ms linear}' +
  '#capeink-nib .ni-word{display:block;font-style:normal;line-height:1.3;' +
    'will-change:transform;transform:translateY(110%)}' +
  /* Il cursore gia' in pagina si spegne INTERO finche' sei sull'immagine.
     Prima spegnevo i suoi tre pezzi uno per uno (l'onda, l'anello, la sua
     scritta): basta che quel codice cambi un nome di classe e ne resta uno
     acceso addosso al nostro. Spegnere il contenitore non ha quel problema —
     qualunque cosa ci sia dentro, e' spenta.
     Il suo codice non si tocca: scrive opacita' inline a ogni frame, e una
     regola !important del foglio di stile le batte tutte. */
  'html.capeink-brush #capecur{opacity:0!important}' +
  '#capecur{transition:opacity 180ms cubic-bezier(.4,0,1,1)!important}';

function injectCSS(){
  var st = d.createElement('style');
  st.setAttribute('data-capeink','');
  st.appendChild(d.createTextNode(CSS_TXT));
  d.head.appendChild(st);
}

/* object-fit / background-size, calcolati una volta: dove finisce l'immagine
   dentro il suo box. Senza questo la copia invertita non si sovrappone a quella
   vera e si vede lo scarto sul bordo. */
function fitRect(sw, sh, dw, dh, fit, px, py){
  var s;
  if(fit === 'fill')      return { x:0, y:0, w:dw, h:dh };
  if(fit === 'none')      s = 1;
  else if(fit === 'contain') s = Math.min(dw/sw, dh/sh);
  else if(fit === 'scale-down') s = Math.min(1, Math.min(dw/sw, dh/sh));
  else                    s = Math.max(dw/sw, dh/sh);          /* cover */
  var w = sw*s, h = sh*s;
  return { x:(dw-w)*px, y:(dh-h)*py, w:w, h:h };
}
function pctPair(v){
  var p = String(v || '50% 50%').trim().split(/\s+/);
  function one(s, kw){
    if(s === 'left' || s === 'top') return 0;
    if(s === 'right' || s === 'bottom') return 1;
    if(s === 'center') return 0.5;
    if(/%$/.test(s)) return parseFloat(s)/100;
    return 0.5;                       /* px: raro su queste immagini */
  }
  return [ one(p[0]), one(p.length > 1 ? p[1] : '50%') ];
}
function bgUrl(cs){
  var m = /url\((['"]?)(.*?)\1\)/.exec(cs.backgroundImage || '');
  return m ? m[2] : null;
}

/* Da un elemento qualunque alla sorgente da invertire: o e' un <img>, o e' il
   discendente che porta la background-image (per lo stage delle opere, che
   cambia quadro da solo). */
/* Quale delle immagini annidate e' quella che si VEDE. Non basta l'area: nello
   stage delle opere le due pagine sono sovrapposte e identiche, e quella sopra
   la decide uno z-index che sta sul GENITORE, non sull'immagine. Quindi lo
   z va cercato risalendo, e pesa piu' dell'area. */
function stackZ(n, stop){
  var z = 0, v;
  while(n && n !== stop){
    v = parseFloat(getComputedStyle(n).zIndex);
    if(!isNaN(v)){ z = v; break; }
    n = n.parentElement;
  }
  return z;
}
function findSource(el){
  if(el.tagName === 'IMG') return { el:el, url:el.currentSrc || el.src, bg:false };
  var best = null, bestS = -1, all = el.querySelectorAll('*'), i, n, cs, u, a, sc;
  for(i = 0; i < all.length; i++){
    n = all[i];
    cs = getComputedStyle(n);
    if(cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
    if(n.tagName === 'IMG' && (n.currentSrc || n.src)) u = n.currentSrc || n.src;
    else u = bgUrl(cs);
    if(!u) continue;
    a = n.offsetWidth*n.offsetHeight;
    if(a < 64) continue;
    sc = stackZ(n, el)*1e7 + a;
    if(sc > bestS){
      bestS = sc;
      best = (n.tagName === 'IMG') ? { el:n, url:u, bg:false } : { el:n, url:u, bg:true };
    }
  }
  return best;
}

function Stage(el){
  var isImg = el.tagName === 'IMG';
  var host  = isImg ? (el.parentElement || d.body) : el;
  var t = {
    el:el, host:host, isImg:isImg,
    cv:null, ctx:null, gl:null, F:null,
    cache:null, cctx:null, url:null, ready:false,
    w:0, h:0, dpr:1,
    over:false, want:0, have:0, wet:0, busy0:0,
    px:0.5, py:0.5, lx:0.5, ly:0.5, had:false, seen:false,
    dead:false
  };

  /* host come riferimento: se e' statico non fa da offsetParent e i conti
     saltano. position:relative su un div non sposta niente. */
  if(getComputedStyle(host).position === 'static') host.style.position = 'relative';
  if(!isImg && getComputedStyle(host).overflow === 'visible') host.style.overflow = 'hidden';

  var cv = d.createElement('canvas');
  cv.className = 'capeink-cv';
  cv.setAttribute('aria-hidden','true');
  cv.style.zIndex = String(isImg ? Z_IMG : Z_BOX);
  t.cv = cv;
  t.ctx = cv.getContext('2d');
  if(isImg && el.nextSibling) host.insertBefore(cv, el.nextSibling);
  else host.appendChild(cv);

  /* Il fluido vive su un canvas fuori dal documento: serve solo come maschera. */
  var glcv = d.createElement('canvas');
  t.gl = glcv;
  t.F = Fluid(glcv);
  if(!t.F.ok){ cv.remove(); t.dead = true; return t; }

  t.cache = d.createElement('canvas');
  t.cctx  = t.cache.getContext('2d');

  /* Posizione e taglia: offsetLeft/offsetTop e non getBoundingClientRect —
     sono misure di layout, che le transform dello scroll morbido non toccano. */
  function place(){
    var w, h, x = 0, y = 0;
    if(isImg){
      var n = el;
      while(n && n !== host){ x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      w = el.offsetWidth; h = el.offsetHeight;
    } else {
      w = el.clientWidth; h = el.clientHeight;
    }
    if(w < 8 || h < 8) return false;
    cv.style.left = x + 'px'; cv.style.top = y + 'px';
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.style.borderRadius = getComputedStyle(el).borderRadius;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if(w*h*dpr*dpr > MAX_PX) dpr = Math.max(1, Math.sqrt(MAX_PX/(w*h)));
    var pw = Math.round(w*dpr), ph = Math.round(h*dpr);
    var changed = (t.w !== w || t.h !== h || t.dpr !== dpr);
    t.w = w; t.h = h; t.dpr = dpr;
    if(cv.width !== pw || cv.height !== ph){ cv.width = pw; cv.height = ph; }
    t.F.resize(w, h);
    return changed;
  }

  /* LA COPIA INVERTITA, disegnata una volta sola. Il filtro non cambia mai:
     rifarlo a ogni frame sarebbe l'unica cosa cara di tutto l'effetto. */
  function bake(img, src){
    var pw = Math.max(1, cv.width), ph = Math.max(1, cv.height);
    t.cache.width = pw; t.cache.height = ph;
    var c = t.cctx;
    c.setTransform(1,0,0,1,0,0);
    c.clearRect(0,0,pw,ph);
    var sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
    if(!sw || !sh) return false;
    var fit, pos;
    if(src.bg){
      var cs = getComputedStyle(src.el);
      var bs = (cs.backgroundSize || 'cover').trim();
      fit = bs === 'contain' ? 'contain' : (bs === 'auto' ? 'none' : 'cover');
      pos = pctPair(cs.backgroundPosition);
    } else {
      var is = getComputedStyle(src.el);
      fit = (is.objectFit || 'cover').trim();
      pos = pctPair(is.objectPosition);
    }
    /* Ripiego: senza ctx.filter (Safari vecchi) non c'e' modo di cuocere la
       copia virata. Allora l'inchiostro diventa bianco pieno e il canvas passa
       in difference: si perde la sola-luminanza e resta il negativo classico.
       Meno bello, ma nessuno resta a bocca asciutta. */
    if(!HAS_FILTER){
      cv.style.mixBlendMode = 'difference';
      c.fillStyle = '#fff'; c.fillRect(0,0,pw,ph);
      return true;
    }
    var r = fitRect(sw, sh, pw, ph, fit, pos[0], pos[1]);
    c.filter = GRADE;
    try{ c.drawImage(img, r.x, r.y, r.w, r.h); }catch(e){ c.filter = 'none'; return false; }
    c.filter = 'none';
    /* il velo caldo, dentro il perimetro dell'immagine e basta */
    if(VEIL_A > 0){
      c.globalCompositeOperation = 'source-atop';
      c.globalAlpha = VEIL_A; c.fillStyle = VEIL;
      c.fillRect(0,0,pw,ph);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    return true;
  }

  function load(){
    var src = findSource(el);
    if(!src || !src.url) return;
    t.url = src.url;

    /* Se la sorgente e' gia' un <img> della pagina si usa QUELLO: e' gia'
       scaricato e decodificato, quindi niente seconda richiesta e nessun
       pasticcio con srcset (currentSrc cambia da solo al variare della
       larghezza; l'elemento invece e' sempre quello giusto). */
    if(!src.bg && src.el.tagName === 'IMG'){
      var im = src.el;
      var use = function(){
        if(t.dead) return;
        t.img = im; t.src = src;
        t.ready = bake(im, src);
      };
      if(im.complete && im.naturalWidth) use();
      else im.addEventListener('load', use, { once:true });
      return;
    }

    var img = new Image();
    img.decoding = 'async';
    img.onload = function(){
      if(t.dead || t.url !== src.url) return;
      t.img = img; t.src = src;
      t.ready = bake(img, src);
    };
    img.onerror = function(){ t.ready = false; };
    img.src = src.url;
  }

  /* Il quadro dello stage cambia da solo: se cambia l'url si ricuoce. */
  function refresh(force){
    var src = findSource(el);
    if(!src || !src.url) return;
    if(!force && src.url === t.url && t.ready) return;
    /* NIENTE t.ready = false qui. Il quadro nuovo ci mette un frame o due ad
       arrivare, e spegnendo la copia vecchia in quei frame non si dipinge
       niente: un buco visibile proprio mentre passi sopra. Meglio l'inchiostro
       del quadro precedente per un frame che nessun inchiostro. */
    if(src.url !== t.url){ t.url = src.url; load(); return; }
    if(t.img) t.ready = bake(t.img, t.src || src);
  }
  t.refresh = refresh;
  t.place   = place;

  place();
  load();

  /* --- la mano ----------------------------------------------------------- */
  function norm(e){
    var r = el.getBoundingClientRect();
    if(r.width < 2 || r.height < 2) return false;
    t.px = (e.clientX - r.left)/r.width;
    t.py = 1 - (e.clientY - r.top)/r.height;
    t.seen = true;
    return true;
  }
  el.addEventListener('pointerenter', function(e){
    if(e.pointerType === 'touch') return;
    t.over = true; t.want = 1; t.had = false;
    norm(e);
    Eng.wake(t);
  }, {passive:true});
  el.addEventListener('pointermove', function(e){
    if(e.pointerType === 'touch') return;
    if(!t.over){ t.over = true; t.want = 1; t.had = false; Eng.wake(t); }
    norm(e);
  }, {passive:true});
  el.addEventListener('pointerleave', function(){
    t.over = false; t.want = 0; t.had = false;
  }, {passive:true});

  return t;
}

/* La mano dipinge: splat interpolati lungo il tratto percorso, come il brush
   di cape-header.js. La velocita' della mano entra nel campo di moto — e' per
   quello che l'inchiostro scappa avanti nella direzione della passata. */
function paint(t, dt){
  if(!t.over || !t.seen || t.have < 0.02) return;
  if(!t.had){ t.lx = t.px; t.ly = t.py; t.had = true; return; }
  var dx = t.px - t.lx, dy = t.py - t.ly, asp = t.F.aspect();
  var dist = Math.sqrt(dx*dx*asp*asp + dy*dy);
  if(dist < 0.0004) return;
  var stp = brushStep();
  var n = Math.min(16, Math.max(1, Math.round(dist/stp)));
  var h = Math.max(dt, 1/240);
  var sp = dist/h, cap = sp > 4.0 ? 4.0/sp : 1;
  var vx = (dx/h)*cap*BRUSH_PULL, vy = (dy/h)*cap*BRUSH_PULL/Math.max(asp, 1e-3);
  var r = brushR();
  for(var k = 1; k <= n; k++){
    var u = k/n;
    t.F.splat(t.lx + dx*u, t.ly + dy*u, vx, vy, BRUSH_AMT, r);
  }
  t.lx = t.px; t.ly = t.py;
}

/* Il frame: due blit. La copia invertita, poi il ritaglio con la maschera.
   destination-in guarda solo l'alfa: al canvas del fluido il colore non serve. */
function compose(t){
  var ctx = t.ctx, w = t.cv.width, h = t.cv.height;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0,0,w,h);
  if(!t.ready || t.have < 0.004) return;
  ctx.drawImage(t.cache, 0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(t.gl, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}


/* ==========================================================================
   3 · IL CURSORE
   Sull'immagine e' solo la parola, che insegue il puntatore con un filo di
   ritardo invece di starci incollata. La punta di pennello e' ancora qui sotto,
   spenta da NIB: la meccanica c'e' tutta, basta riaccenderla.
   ========================================================================== */
var Nib = (function(){
  var box = null, svg = null, lab = null, wrd = null, exitT = 0;
  var tx = 0, ty = 0, cx = 0, cy = 0, px = 0, py = 0;
  var rot = 0, str = 1, spd = 0, still = 0, on = false, seen = false, raf = 0, last = 0;
  var lx = 0, ly = 0;                                  /* la scritta, che insegue */

  function build(){
    box = d.createElement('div');
    box.id = 'capeink-nib';
    box.setAttribute('aria-hidden','true');
    box.innerHTML =
      '<svg viewBox="0 0 100 20" preserveAspectRatio="none">' +
      '<path d="M0,10 C26,0.6 74,0.6 100,10 C74,19.4 26,19.4 0,10 Z"></path></svg>' +
      '<span class="ni-label"><i class="ni-word"></i></span>';
    svg = box.querySelector('svg');
    lab = box.querySelector('.ni-label');
    wrd = box.querySelector('.ni-word');
    svg.style.width = NIB_L + 'px';
    svg.style.height = NIB_W + 'px';
    svg.style.display = NIB ? 'block' : 'none';
    lab.style.fontSize = LABEL_SZ + 'px';
    wrd.style.letterSpacing = LABEL_TR + 'em';
    d.body.appendChild(box);
    addEventListener('mousemove', function(e){
      tx = e.clientX; ty = e.clientY;
      if(!seen){ seen = true; cx = tx; cy = ty; px = cx; py = cy; lx = cx; ly = cy; }
    }, {passive:true});
  }

  function frame(now){
    raf = requestAnimationFrame(frame);
    if(!last) last = now;
    /* Il tempo vero, non "un frame = 16.7ms": su uno schermo a 120Hz la
       scritta sarebbe tornata al doppio della velocita', e su una macchina
       lenta non sarebbe tornata quasi mai. */
    var ms = Math.max(1, Math.min(now - last, 100)); last = now;
    var f = ms/16.667;                     /* quanti frame-a-60 sono passati  */
    var e = 1 - Math.pow(1 - TRAIL, f);    /* la stessa scia, a qualunque Hz  */
    cx += (tx-cx)*e; cy += (ty-cy)*e;
    var vx = cx-px, vy = cy-py; px = cx; py = cy;
    var v = Math.sqrt(vx*vx + vy*vy)/(ms/1000);          /* px/s veri         */
    spd += (v-spd)*(1 - Math.pow(0.75, f));
    if(spd > 6){
      var want = Math.atan2(vy, vx)*180/Math.PI;
      var dlt = ((want-rot+540)%360)-180;                /* strada piu' corta */
      rot += dlt*(1 - Math.pow(0.70, f));
    }
    var k = Math.min(1, spd/NIB_SPD);
    var wantStr = 1 + (NIB_MAX-1)*k*k;
    str += (wantStr-str)*(1 - Math.pow(0.78, f));
    still = spd < REST_SPD ? still + ms : 0;
    box.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
    /* volume costante: quando si allunga si assottiglia, come un tratto vero */
    if(NIB) svg.style.transform = 'translate(-50%,-50%) rotate(' + rot.toFixed(2) + 'deg) ' +
                          'scale(' + str.toFixed(3) + ',' + (1/Math.sqrt(str)).toFixed(3) + ')';
    var le = 1 - Math.pow(1 - LABEL_LAG, f);
    lx += (cx-lx)*le; ly += (cy-ly)*le;
    var ox = lx-cx, oy = ly-cy, om = Math.sqrt(ox*ox + oy*oy);
    if(om > LABEL_CAP){ var q = LABEL_CAP/om; ox *= q; oy *= q; lx = cx+ox; ly = cy+oy; }
    lab.style.transform = 'translate(-50%,-50%) translate(' + ox.toFixed(2) + 'px,' +
                          (oy + (NIB ? NIB_W*0.5 + 15 : LABEL_DY)).toFixed(2) + 'px)';
    /* durante l'uscita si tiene accesa: a portarla via e' la finestra che la
       ritaglia, non una dissolvenza. Due movimenti insieme sono uno di troppo. */
    lab.style.opacity = (on || exitT) ? String(still > REST_MS ? 1 : LABEL_MIN) : '0';
  }

  return {
    on: function(el){
      if(!CUR) return;
      if(!box) build();
      var w = el.getAttribute ? el.getAttribute('data-cursor') : null;
      wrd.textContent = (w === null) ? LABEL : w;   /* "" = nessuna scritta */
      on = true; last = 0; lx = cx; ly = cy;
      clearTimeout(exitT); exitT = 0;
      box.classList.add('is-on');
      d.documentElement.classList.add('capeink-brush');   /* il logo esce ora */

      /* la salita: si riparte da sotto SENZA transizione, si forza il reflow,
         poi si accende la transizione. Senza il reflow in mezzo il browser
         accorpa i due valori e non anima niente. */
      var EASE = 'cubic-bezier(.16,1,.3,1)';
      wrd.style.transition = 'none';
      wrd.style.transform = 'translateY(110%)';
      wrd.style.letterSpacing = (LABEL_TR + LABEL_TR_IN).toFixed(3) + 'em';
      void wrd.offsetWidth;
      wrd.style.transition = 'transform ' + LAB_IN + 'ms ' + EASE + ' ' + LAB_DELAY + 'ms,' +
                             'letter-spacing ' + LAB_IN + 'ms ' + EASE + ' ' + LAB_DELAY + 'ms';
      wrd.style.transform = 'translateY(0)';
      wrd.style.letterSpacing = LABEL_TR + 'em';

      if(!raf) raf = requestAnimationFrame(frame);
    },
    restyle: function(){
      if(!box) return;
      svg.style.display = NIB ? 'block' : 'none';
      svg.style.width = NIB_L + 'px'; svg.style.height = NIB_W + 'px';
      lab.style.fontSize = LABEL_SZ + 'px';
      wrd.style.letterSpacing = LABEL_TR + 'em';
    },
    off: function(){
      if(!box) return;
      on = false;
      still = 0;

      /* la parola prosegue verso l'alto: non torna indietro, esce dalla parte
         opposta. Il logo rientra mentre lei se ne va, cosi' non si sovrappongono. */
      wrd.style.transition = 'transform ' + LAB_OUT + 'ms cubic-bezier(.6,0,.9,.2)';
      wrd.style.transform = 'translateY(-110%)';

      clearTimeout(exitT);
      exitT = setTimeout(function(){
        exitT = 0;
        box.classList.remove('is-on');
        d.documentElement.classList.remove('capeink-brush');
        if(raf){ cancelAnimationFrame(raf); raf = 0; }
      }, LAB_OUT + 20);
    }
  };
})();


/* ==========================================================================
   4 · IL MOTORE
   Un solo rAF per tutte le immagini, a passo fisso di 1/60 con accumulatore:
   se il frame salta, la fisica non cambia comportamento. Un'immagine sta nella
   lista solo finche' ha inchiostro addosso; quando ha finito di asciugare esce
   e la GPU torna a dormire.
   ========================================================================== */
var HAS_FILTER = (function(){
  try{
    var c = d.createElement('canvas').getContext('2d');
    if(typeof c.filter !== 'string') return false;
    c.filter = 'invert(1)';
    return c.filter !== 'none';
  }catch(e){ return false; }
})();

var Eng = (function(){
  var raf = 0, last = 0, acc = 0, live = [], paused = false;

  function wake(t){
    if(t.dead) return;
    if(live.indexOf(t) < 0) live.push(t);
    if(!raf){ last = 0; acc = 0; raf = requestAnimationFrame(frame); }
  }

  function retire(t){
    var i = live.indexOf(t);
    if(i >= 0) live.splice(i, 1);
    t.F.wipe();
    t.have = 0; t.had = false; t.seen = false;
    t.cv.classList.remove('is-on');
    var ctx = t.ctx;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0,0,t.cv.width,t.cv.height);
  }

  function frame(now){
    raf = 0;
    if(!last) last = now;
    var raw = (now-last)/1000; last = now;
    var dtUi = Math.max(1/240, Math.min(raw, 1/10));
    var ms = dtUi*1000;

    acc += raw; if(acc > 4/60) acc = 2/60;
    var steps = 0, i, t;

    for(i = 0; i < live.length; i++){
      t = live[i];
      /* mentre l'immagine scorre l'inchiostro si ritira — ma solo per il tempo
         in cui scorre davvero, non per tutta la coreografia (vedi BUSY_MAX). */
      var busy = !!(BUSY_SEL && t.el.closest && t.el.closest(BUSY_SEL));
      if(busy){
        if(!t.busy0) t.busy0 = now;
        if(BUSY_MAX > 0 && now - t.busy0 > BUSY_MAX) busy = false;
      } else t.busy0 = 0;
      var want = (t.over && !busy && !paused) ? 1 : 0;
      var r = (want > t.have ? ms/FADE_IN : ms/FADE_OUT);
      t.have = want > t.have ? Math.min(want, t.have + r) : Math.max(want, t.have - r);
      paint(t, dtUi);
    }

    var acc0 = acc;
    for(i = 0; i < live.length; i++){
      t = live[i];
      acc = acc0; steps = 0;
      while(acc >= 1/60 && steps < 3){ t.F.step(1/60); acc -= 1/60; steps++; }
    }
    acc = acc0; steps = 0;
    while(acc >= 1/60 && steps < 3){ acc -= 1/60; steps++; }

    for(i = live.length - 1; i >= 0; i--){
      t = live[i];
      t.F.render(t.have);
      compose(t);
      if(t.have > 0.004) t.cv.classList.add('is-on');
      /* Asciugato del tutto ma il cursore e' ancora li' (e' il caso dello
         slider che ha appena cambiato quadro): il prossimo tratto deve
         ripartire dal punto in cui sta la mano adesso. Senza questo, la prima
         pennellata ricongiunge il punto vecchio col nuovo e lascia una riga
         dritta attraverso mezza immagine. */
      if(t.over && t.have <= 0.0002) t.had = false;
      if(!t.over && t.have <= 0.0002) retire(t);
    }

    if(live.length) raf = requestAnimationFrame(frame);
  }

  d.addEventListener('visibilitychange', function(){
    if(d.hidden){ while(live.length) retire(live[0]); Nib.off(); }
  });

  return {
    wake: wake,
    drop: function(t){ if(live.indexOf(t) >= 0) retire(t); },
    pause: function(){ paused = true; },
    resume:function(){ paused = false; },
    live:  function(){ return live.length; }
  };
})();


/* ==========================================================================
   5 · ACCENSIONE
   ========================================================================== */
var stages = [];

function attach(el){
  if(el.__capeink) return;
  var t = Stage(el);
  el.__capeink = t;
  if(t.dead) return;
  stages.push(t);

  el.addEventListener('pointerenter', function(e){
    if(e.pointerType !== 'touch') Nib.on(el);
  }, {passive:true});
  el.addEventListener('pointerleave', function(){ Nib.off(); }, {passive:true});

  if(window.ResizeObserver){
    var rt = 0;
    var ro = new ResizeObserver(function(){
      clearTimeout(rt);
      rt = setTimeout(function(){ if(t.place()) t.refresh(true); }, 140);
    });
    ro.observe(el);
    if(el.parentElement) ro.observe(el.parentElement);
  }

  /* Lo stage delle opere cambia quadro da solo: quando cambia la
     background-image la copia invertita va rifatta, se no si dipinge il
     negativo del quadro precedente. */
  if(!t.isImg && window.MutationObserver){
    /* Attenzione al debounce semplice: durante la transizione lo slider scrive
       una style ogni frame, quindi un timer che si azzera a ogni mutazione non
       scade MAI finche' l'animazione va — e il quadro nuovo lo scopriamo solo
       alla fine. Qui c'e' anche un tetto d'attesa: comunque vada si guarda ogni
       BEAT ms, cosi' il cambio si vede mentre succede. */
    var mt = 0, first = 0, BEAT = 220;
    new MutationObserver(function(){
      var n = (window.performance && performance.now) ? performance.now() : Date.now();
      if(!first) first = n;
      if(n - first >= BEAT){ clearTimeout(mt); mt = 0; first = 0; t.refresh(false); return; }
      if(mt) return;
      mt = setTimeout(function(){ mt = 0; first = 0; t.refresh(false); }, BEAT);
    }).observe(el, { subtree:true, attributes:true, attributeFilter:['style','src','class'] });
  }

  /* fuori dallo schermo non si dipinge e non si consuma */
  if(window.IntersectionObserver){
    new IntersectionObserver(function(es){
      for(var i = 0; i < es.length; i++){
        if(!es[i].isIntersecting){ t.over = false; }
      }
    }, { rootMargin:'80px' }).observe(el);
  }
}

function scan(){
  var n = d.querySelectorAll(SEL), i;
  for(i = 0; i < n.length; i++) attach(n[i]);
}

function init(){
  if(!mq('(min-width:' + MIN_W + 'px)')) return;
  if(!mq('(hover: hover)')) return;
  if(mq('(prefers-reduced-motion: reduce)')) return;
  injectCSS();
  scan();
  if(d.fonts && d.fonts.ready) d.fonts.ready.then(function(){
    for(var i = 0; i < stages.length; i++){ if(stages[i].place()) stages[i].refresh(true); }
  });
  addEventListener('load', function(){
    for(var i = 0; i < stages.length; i++){ if(stages[i].place()) stages[i].refresh(true); }
  }, { once:true });

  window.capeImageInk = {
    /* si provano dal vivo, senza ripubblicare */
    set: function(o){
      var K = { GRADE:0, VEIL:0, VEIL_A:0, BRUSH_SIZE:0, BRUSH_AMT:0, BRUSH_PULL:0,
                BRUSH_DRY:0, BRUSH_GRAVITY:0, BRUSH_CURL:0, BRUSH_AMB:0, VEL_DISS:0,
                INK_K:0, RIM:0, RIM_W:0, FADE_IN:0, FADE_OUT:0, NIB_L:0, NIB_W:0,
                NIB_MAX:0, NIB_SPD:0, TRAIL:0, REST_MS:0, REST_SPD:0, LABEL:0,
                LABEL_MIN:0, LABEL_LAG:0, LABEL_CAP:0, LABEL_DY:0, LABEL_SZ:0,
                LABEL_TR:0, NIB:0, Z_IMG:0, Z_BOX:0, SEL:0, BUSY_MAX:0,
                LAB_IN:0, LAB_OUT:0, LAB_DELAY:0, LABEL_TR_IN:0 };
      var bakeAgain = false, k;
      for(k in o){
        if(!(k in K)) continue;
        if(k === 'GRADE'){ GRADE = o[k]; bakeAgain = true; }
        else if(k === 'VEIL'){ VEIL = o[k]; bakeAgain = true; }
        else if(k === 'VEIL_A'){ VEIL_A = o[k]; bakeAgain = true; }
        else if(k === 'BRUSH_SIZE') BRUSH_SIZE = o[k];
        else if(k === 'BRUSH_AMT') BRUSH_AMT = o[k];
        else if(k === 'BRUSH_PULL') BRUSH_PULL = o[k];
        else if(k === 'BRUSH_DRY') BRUSH_DRY = o[k];
        else if(k === 'BRUSH_GRAVITY') BRUSH_GRAVITY = o[k];
        else if(k === 'BRUSH_CURL') BRUSH_CURL = o[k];
        else if(k === 'BRUSH_AMB') BRUSH_AMB = o[k];
        else if(k === 'VEL_DISS') VEL_DISS = o[k];
        else if(k === 'INK_K') INK_K = o[k];
        else if(k === 'RIM') RIM = o[k];
        else if(k === 'RIM_W') RIM_W = o[k];
        else if(k === 'FADE_IN') FADE_IN = o[k];
        else if(k === 'FADE_OUT') FADE_OUT = o[k];
        else if(k === 'NIB_L') NIB_L = o[k];
        else if(k === 'NIB_W') NIB_W = o[k];
        else if(k === 'NIB_MAX') NIB_MAX = o[k];
        else if(k === 'NIB_SPD') NIB_SPD = o[k];
        else if(k === 'TRAIL') TRAIL = o[k];
        else if(k === 'REST_MS') REST_MS = o[k];
        else if(k === 'REST_SPD') REST_SPD = o[k];
        else if(k === 'LABEL') LABEL = o[k];
        else if(k === 'LABEL_MIN') LABEL_MIN = o[k];
        else if(k === 'LABEL_LAG') LABEL_LAG = o[k];
        else if(k === 'LABEL_CAP') LABEL_CAP = o[k];
        else if(k === 'LABEL_DY') LABEL_DY = o[k];
        else if(k === 'BUSY_MAX') BUSY_MAX = o[k];
        else if(k === 'LAB_IN') LAB_IN = o[k];
        else if(k === 'LAB_OUT') LAB_OUT = o[k];
        else if(k === 'LAB_DELAY') LAB_DELAY = o[k];
        else if(k === 'LABEL_TR_IN') LABEL_TR_IN = o[k];
        else if(k === 'LABEL_SZ'){ LABEL_SZ = o[k]; Nib.restyle(); }
        else if(k === 'LABEL_TR'){ LABEL_TR = o[k]; Nib.restyle(); }
        else if(k === 'NIB'){ NIB = !!o[k]; Nib.restyle(); }
        else if(k === 'SEL'){ SEL = o[k]; scan(); }   /* prende le nuove, non tocca le vecchie */
        else if(k === 'Z_IMG'){ Z_IMG = o[k]; for(var q=0;q<stages.length;q++) if(stages[q].isImg) stages[q].cv.style.zIndex = String(Z_IMG); }
        else if(k === 'Z_BOX'){ Z_BOX = o[k]; for(var w=0;w<stages.length;w++) if(!stages[w].isImg) stages[w].cv.style.zIndex = String(Z_BOX); }
      }
      if(bakeAgain) for(var i = 0; i < stages.length; i++) stages[i].refresh(true);
      return window.capeImageInk.read();
    },
    read: function(){
      return { SEL:SEL, GRADE:GRADE, VEIL:VEIL, VEIL_A:VEIL_A, BRUSH_SIZE:BRUSH_SIZE,
               BRUSH_AMT:BRUSH_AMT, BRUSH_PULL:BRUSH_PULL, BRUSH_DRY:BRUSH_DRY,
               BRUSH_GRAVITY:BRUSH_GRAVITY, BRUSH_CURL:BRUSH_CURL, INK_K:INK_K,
               RIM:RIM, RIM_W:RIM_W, FADE_IN:FADE_IN, FADE_OUT:FADE_OUT,
               NIB_L:NIB_L, NIB_W:NIB_W, NIB_MAX:NIB_MAX, LABEL:LABEL,
               LABEL_MIN:LABEL_MIN, LABEL_LAG:LABEL_LAG, LABEL_CAP:LABEL_CAP,
               LABEL_DY:LABEL_DY, LABEL_SZ:LABEL_SZ, LABEL_TR:LABEL_TR, NIB:NIB,
               BUSY_MAX:BUSY_MAX, LAB_IN:LAB_IN, LAB_OUT:LAB_OUT, LAB_DELAY:LAB_DELAY,
               luminanceOnly:HAS_FILTER };
    },
    targets: function(){
      return stages.map(function(t){
        return { el:t.el, size:t.w + 'x' + t.h, source:t.url, ready:t.ready,
                 ink:Math.round(t.have*100)/100, over:t.over };
      });
    },
    rescan:  function(){ scan(); },
    refresh: function(){ for(var i = 0; i < stages.length; i++){ stages[i].place(); stages[i].refresh(true); } },
    pause:   function(){ Eng.pause(); },
    resume:  function(){ Eng.resume(); }
  };
}

if(d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init);
else init();

})();
