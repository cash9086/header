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
       capeTitleInk.set({ MAG_PULL:0.24, FEED:0.5 })
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
var BLOBS     = 10;     /* quante sorgenti di cera vagano nel box             */
var FEED      = 0.80;   /* colorante versato al secondo da ogni sorgente      */
var DYE_DISS  = 0.38;   /* quanto asciuga l'inchiostro                        */
var BLOB_SIZE = 20;     /* GRANDEZZA della goccia, in % dell'altezza scritta   */
var INK_K     = 2.60;   /* densita': stessa del divider. Alzalo e il velo
                           sottile conta come inchiostro pieno.               */
var INK_DEPTH = 0.16;   /* quanto il centro denso e' piu' bianco del bordo:
                           0 = macchia piatta, 0.3 = si vede lo spessore      */
var TENSION   = 1.20;   /* TENSIONE SUPERFICIALE. Senza, l'inchiostro si scioglie:
                           l'advezione bilineare sfuma le gocce a ogni passo e
                           dopo un minuto la scritta e' quasi vuota. Questo le
                           ricompatta di continuo — il denso si fa piu' denso,
                           il velo sparisce. E' la manopola che fa restare
                           GOCCE invece di diventare foschia. 0 = spenta.     */

/* --- l'inchiostro: come si muove ---------------------------------------- */
var GRAVITY   = 0.038;  /* quanto cola. E' qui che si vede il non newtoniano:
                           il denso scende, il velo resta sospeso.            */
var LIFT      = 0.032;  /* la spinta in su delle sorgenti, in accelerazione: e'
                           la piastra calda della lampada. Tienila vicina a
                           GRAVITY e la cera resta sospesa e gira; alzala e
                           sale, abbassala e cola sul fondo.                   */
var AMBIENT   = 0.0090; /* le correnti lente (rumore curl): sono queste che
                           fanno galleggiare invece di cadere e basta         */
var CURL      = 0.13;   /* vorticita': quanto si arriccia sui bordi           */
var VEL_DISS  = 1.05;   /* attrito del campo di moto                          */
var DRIFT     = 0.16;   /* quanto in fretta vagano le sorgenti                */
var WANDER    = 4.00;   /* quanto l'inchiostro si fa trascinare dalla sorgente
                           che lo versa (attrito, al secondo): e' la scia      */

/* --- la calamita: l'attrazione verso il mouse ---------------------------
   Il puntatore non deve mai "attaccare" l'inchiostro addosso: e' massa, ci
   mette un attimo ad arrivare. Per questo la calamita ha la sua inerzia
   (MAG_EASE) e tira con una VELOCITA', non sposta a una posizione.          */
var MAG       = true;   /* false = solo lava lamp, niente mouse               */
var MAG_PULL  = 0.075;  /* QUANTO TIRA. E' la velocita' con cui l'inchiostro
                           scivola verso il puntatore, in larghezze del box al
                           secondo: 0.02 e' un'inclinazione appena percepibile,
                           0.15 e' un risucchio. E' la manopola principale.    */
var MAG_SWIRL = 0.030;  /* quanto gira ATTORNO al puntatore invece di finirci
                           dentro. Senza, l'inchiostro collassa in un punto e
                           li' si ferma; con, ci orbita. Tenerlo sotto PULL.   */
var MAG_STIR  = 0.10;   /* l'increspatura del fluido attorno al puntatore, in
                           accelerazione. Non attrae (non puo': vedi PULLD),
                           ma fa muovere la superficie mentre l'ink arriva.    */
var MAG_R     = 30;     /* raggio del campo, in % della larghezza del box.
                           Oltre il raggio il mouse non lo sente piu'.        */
var MAG_FLAT  = 0.30;   /* quanto la calamita tira anche IN VERTICALE.
                           1 = campo rotondo; 0 = tira solo di lato.
                           Va tenuto basso e non e' un dettaglio: l'inchiostro
                           vive in una striscia alta due dita, sopra e sotto
                           le lettere non c'e' niente da vedere. Con il campo
                           rotondo, il puntatore che passa sotto al titolo si
                           portava giu' l'inchiostro e la scritta si svuotava.
                           Schiacciato, il puntatore in basso a sinistra
                           raduna l'inchiostro a sinistra — che e' quello che
                           uno si aspetta guardando.                          */
var MAG_EASE  = 4.2;    /* inerzia della calamita (al secondo): basso = pigra */
var MAG_BIAS  = 0.72;   /* quanto l'increspatura segue l'inchiostro invece del
                           vuoto: 1 = solo dove c'e' colorante, 0 = ovunque   */

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
   che e' la differenza fra una calamita e un buco nero. */
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
   Limatura di ferro dentro l'olio: si muove la limatura, non l'olio. */
var PULLD = HEAD + 'uniform sampler2D uDye; uniform vec2 uPoint;\n' +
  'uniform float uAspect, uDt, uPull, uSwirl, uRadius, uFlat;\n' +
  'void main(){ vec2 p = vec2(vUv.x - uPoint.x, (vUv.y - uPoint.y)/max(uAspect,1e-3));\n' +
  '  p.y *= uFlat;\n' +
  '  float d2 = dot(p,p);\n' +
  '  float f = exp(-d2/uRadius);\n' +
  '  if(f < 0.002){ fragColor = texture(uDye, vUv); return; }\n' +
  '  vec2 dir = -p*inversesqrt(d2 + 1e-6);\n' +
  '  vec2 tang = vec2(-dir.y, dir.x);\n' +
  '  vec2 v = (dir*uPull + tang*uSwirl)*f;\n' +
  '  v.y *= uFlat;\n' +
  '  vec2 duv = vec2(v.x, v.y*uAspect)*uDt;\n' +
  '  fragColor = texture(uDye, vUv - duv); }';

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
    clear:Program(gl,CLEAR), tens:Program(gl,TENS), show:Program(gl,SHOW)
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

  function attract(dt, x, y, pull, swirl, radius){
    var u = pr.pull.use();
    gl.uniform2f(u.uTexel, dye.tx, dye.ty);
    gl.uniform1i(u.uDye, dye.read.bind(0));
    gl.uniform2f(u.uPoint, x, y); gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uPull, pull);
    gl.uniform1f(u.uSwirl, swirl); gl.uniform1f(u.uRadius, radius);
    gl.uniform1f(u.uFlat, MAG_FLAT);
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

  return { ok:true, P:P, splat:splat, magnet:magnet, attract:attract, step:step, render:render,
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
  return {
    x: home + band*0.85*Math.sin(w*1.35*sp + a*2.1)*Math.cos(w*0.48 + a),
    y: 0.5 + 0.21*Math.sin(w*1.02*sp + a*3.7)
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
  var BLOB_R = 0;
  function tune(){
    var k = (BLOB_SIZE/100)/(1 + 2*PAD);
    BLOB_R = k*k;
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
  function feed(dt){
    var i, s, p, vx, vy, asp = F.aspect();
    for(i = 0; i < BLOBS; i++){
      s = srcAt(i, clock, BLOBS);
      p = prev[i];
      if(!p){ prev[i] = { x:s.x, y:s.y }; continue; }
      vx = (s.x - p.x)/dt;
      vy = (s.y - p.y)/dt/Math.max(asp, 1e-3);
      p.x = s.x; p.y = s.y;
      /* Tutto quello che la sorgente versa e' AL SECONDO, velocita' compresa:
         va moltiplicato per dt. Uno splat di velocita' e' un impulso, e un
         impulso ripetuto sessanta volte al secondo non e' una spinta gentile,
         e' un getto — l'inchiostro finiva schiacciato contro il bordo invece
         di galleggiare. Cosi' invece LIFT e' un'accelerazione e WANDER e' un
         attrito: quanto la cera si fa trascinare da chi la versa. */
      F.splat(s.x, s.y, vx*WANDER*dt, (vy*WANDER + LIFT)*dt, FEED*dt, BLOB_R);
    }
  }

  function physics(dt){
    feed(dt);
    if(MAG && mSeen){
      mx += (tx - mx)*Math.min(1, dt*MAG_EASE);
      my += (ty - my)*Math.min(1, dt*MAG_EASE);
      var r = Math.pow(MAG_R/100, 2);
      F.magnet(dt, mx, my, MAG_STIR, MAG_STIR*(MAG_SWIRL/Math.max(MAG_PULL,1e-4)), r, MAG_BIAS);
      F.attract(dt, mx, my, MAG_PULL, MAG_SWIRL, r);
    }
    F.step(dt);
    clock += dt;
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

    if(running) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  function start(){
    if(running || !F) return;
    prime();
    running = true;
    stage.classList.add('is-in');
    if(!raf){ last = 0; raf = requestAnimationFrame(frame); }
  }
  function stop(){
    running = false;
    if(raf){ cancelAnimationFrame(raf); raf = 0; }
    last = 0; acc = 0;
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
        else if(k === 'DRIFT')     DRIFT = o[k];
        else if(k === 'WANDER')    WANDER = o[k];
        else if(k === 'BLOBS')     BLOBS = o[k];
        else if(k === 'BLOB_SIZE'){ BLOB_SIZE = o[k]; Eng.tune(); }
        else if(k === 'PAD'){ PAD = o[k]; Eng.tune(); relayout(); }
        else if(k === 'MAG')       MAG = o[k];
        else if(k === 'MAG_PULL')  MAG_PULL = o[k];
        else if(k === 'MAG_SWIRL') MAG_SWIRL = o[k];
        else if(k === 'MAG_STIR')  MAG_STIR = o[k];
        else if(k === 'MAG_R')     MAG_R = o[k];
        else if(k === 'MAG_FLAT')  MAG_FLAT = o[k];
        else if(k === 'MAG_EASE')  MAG_EASE = o[k];
        else if(k === 'MAG_BIAS')  MAG_BIAS = o[k];
      }
      return window.capeTitleInk.read();
    },
    read:function(){
      return { FEED:FEED, LIFT:LIFT, WANDER:WANDER, BLOBS:BLOBS, BLOB_SIZE:BLOB_SIZE,
               DYE_DISS:F && F.P.dyeDiss, VEL_DISS:F && F.P.velDiss,
               GRAVITY:F && F.P.gravity, AMBIENT:F && F.P.ambient, CURL:F && F.P.curl,
               INK_K:F && F.P.inkK, INK_DEPTH:F && F.P.depth, TENSION:F && F.P.tension,
               MAG:MAG, MAG_PULL:MAG_PULL, MAG_SWIRL:MAG_SWIRL, MAG_STIR:MAG_STIR, MAG_R:MAG_R, MAG_FLAT:MAG_FLAT,
               MAG_EASE:MAG_EASE, MAG_BIAS:MAG_BIAS };
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
