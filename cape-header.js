/* ============================================================================
   THE CAPE — HEADER "INCHIOSTRO"  ·  cape-header.js
   Barra + menu a tutto schermo. Si costruisce da solo: non serve toccare
   nulla nel Designer, nessun elemento da creare, nessuna classe da aggiungere.

   Va in fondo al footer della pagina, DOPO Lenis:
     <script defer src="https://cdn.jsdelivr.net/gh/cash9086/header@VERSIONE/cape-header.js"></script>

   Il CSS se lo carica da solo dalla stessa cartella. Se lo hai gia' messo tu
   nell'<head> (meglio: un viaggio in meno), il file se ne accorge e non lo
   ricarica; per essere espliciti puoi aggiungere data-css="off" al tag.

   COSA FA
   - Un bottone in basso al centro, con dentro solo la parola. Scendendo
     scende sotto il bordo e sparisce, risalendo torna su. Sfondo scuro
     trasparente che cambia opacita' e tono in base a cosa gli passa sopra
     (chiaro -> piu' denso, scuro -> quasi assente).
   - Al click l'inchiostro entra dai due lati con la fisica del divider
     ink-bleed: fluido vero, blob, non newtoniano. I due fronti si toccano al
     centro, sulla cucitura scatta una luce, e da li' il menu si compone.
   - Il menu e' due colonne: a sinistra l'immagine, a destra le voci. Passando
     su una voce l'immagine cambia; via dall'elenco torna il logo.
   - Il mouse lascia una pennellata che INVERTE i colori sotto di se'
     (mix-blend-mode: difference, come il cursore-logo del sito).
   - Niente WebGL2 / mobile / prefers-reduced-motion: stessa coreografia,
     fatta in CSS. Nessuna schermata rotta, mai.

   LE MANOPOLE SONO TUTTE NEL BLOCCO "IMPOSTAZIONI" QUI SOTTO.
============================================================================ */

(function(){
'use strict';

/* Se il file finisse incluso due volte (capita: head e footer, o due pagine
   dello stesso template), la seconda copia si ferma qui. */
if(window.__capehdr) return;
window.__capehdr = 1;

/* Dove sta questo file. Va letto SUBITO: document.currentScript vale solo
   durante l'esecuzione dello script, non dopo. Serve per trovare il CSS
   nella stessa cartella, qualunque sia il CDN o la versione. */
var SELF = document.currentScript || null;

/* ========================== IMPOSTAZIONI ==================================
   Tutto quello che si cambia, si cambia qui. Sotto questo blocco c'e' solo
   meccanica: non serve aprirla per curare i testi, i link o i tempi.        */

/* --- il bottone ----------------------------------------------------------- */
var OPEN_TXT  = 'MENU';    /* cosa c'e' scritto nel bottone in basso          */
var CLOSE_LBL = 'Chiudi il menu';  /* etichetta della X, per chi non vede      */

/* --- l'immagine a riposo -------------------------------------------------
   Quella che si vede a sinistra quando non stai sopra a nessuna voce.      */
var LOGO = 'https://s3.amazonaws.com/webflow-prod-assets/696e3bc5b446ecf721fa3bde/6a8acf62cafcedc39ab73cc4_WhatsApp%20Image%202026-08-23%20at%2012.45.31.jpeg';

/* --- le voci -------------------------------------------------------------
   name  il titolo grande
   desc  la sottovoce. E' informazione, non decorazione: dice cos'e' quella
         voce. Se non hai niente da dire, lasciala vuota ('').
   href  ATTENZIONE: sono SEGNAPOSTO. Mettici gli id veri delle sezioni di
         questa pagina (#works, #editions...) o gli indirizzi delle pagine
         quando le avrai. Un'ancora che non esiste non rompe niente: il menu
         si chiude e basta.
   img   l'immagine che compare a sinistra quando ci passi sopra. Se la
         lasci vuota resta il logo.                                         */
var INDEX = [
  { name:'WORKS',       desc:'ORIGINALS ON CANVAS', href:'#works',
    img:'https://cdn.prod.website-files.com/696e3bc5b446ecf721fa3bde/6a91a174e835a7629e93a0ec_watermark-removed-Gemini_Generated_Image_2fk2fv2fk2fv2fk2.jpg' },
  { name:'EDITIONS',    desc:'LIMITED PRINTS',      href:'#editions',
    img:'https://cdn.prod.website-files.com/696e3bc5b446ecf721fa3bde/6a909a5a7fa5b28295d6a1a9_WhatsApp%20Image%202026-08-27%20at%2013.39.23%20(1).png' },
  { name:'THE STUDIO',  desc:'PROCESS',             href:'#studio',
    img:'https://cdn.prod.website-files.com/696e3bc5b446ecf721fa3bde/6a91a227ba3b60021d7608f9_watermark-removed-Gemini_Generated_Image_jm5yh7jm5yh7jm5y.jpg' },
  { name:'EXHIBITIONS', desc:'PAST & UPCOMING',     href:'#exhibitions', img:'' },
  { name:'CONTACT',     desc:'ENQUIRIES',           href:'#contact',     img:'' }
];

/* --- come si muove -------------------------------------------------------- */
var FLOOD_MS   = 1400;    /* il pennello che dipinge lo schermo (ms)        */
var RETREAT_MS = 1150;    /* il pennello che lo ripulisce (ms)              */
var RISE_MS    = 620;     /* l'entrata di ogni voce (ms)                     */
var STAGGER    = 70;      /* ritardo tra una voce e l'altra (ms)             */
var SEAM_AT    = 0.86;    /* a che punto della pennellata entra il contenuto */

/* --- il bottone che va e viene -------------------------------------------- */
var HIDE_ON_DOWN = true;  /* scende scrollando in giu', risale scrollando in su */
var TOP_ZONE     = 48;    /* entro questi px dalla cima e' sempre visibile   */
var SCROLL_EPS   = 5;     /* px di scroll ignorati (evita il tremolio)       */

/* --- l'inchiostro: il pennello che dipinge lo schermo --------------------
   Un fronte a 45 gradi che va da in alto a sinistra a in basso a destra, con
   sopra delle pennellate vere che gli corrono davanti. L'uscita fa la stessa
   identica cosa nella stessa direzione: non torna indietro, ricomincia da in
   alto a sinistra e finisce in basso a destra.                             */
/* --- l'inchiostro che entra dai lati (stesso solutore di ink-bleed) ------- */
var FLOOD_AMT   = 3.60;   /* quanto colorante versano i due fronti            */
var FLOOD_PUSH  = 0.018;  /* quanto forte spingono verso il centro. Alzalo e le
                             dita di inchiostro scappano avanti al fronte.     */
var FLOOD_DISS  = 2.00;   /* quanto svanisce l'inchiostro che corre troppo avanti:
                             e' questo che tiene le dita attaccate al fronte.  */
var FLOOD_THICK = 0.052;  /* spessore della banda che corre davanti al fronte  */
var FLOOD_ADV   = 1.06;   /* quanto corre il fronte: >1 per chiudere gli angoli */
var FLOOD_DABS  = 5;      /* quante impronte al massimo per frame lungo il tratto
                             percorso dalla mano. 0 = fronte liscio, senza pennello */
var FLOOD_DAB_R = 0.014;  /* quanto e' larga la setola                         */
var FLOOD_DAB_A = 0.30;   /* quanto colorante lascia ogni impronta            */
var FLOOD_SWEEP = 2.60;   /* passate al secondo: la mano va avanti e indietro
                             lungo il fronte, come chi pittura un muro         */
var FLOOD_DAB_V = 0.055;  /* quanta velocita' la mano passa al fluido: e' questo
                             che smaccia l'inchiostro nel verso della passata  */

/* --- il pennello che inverte i colori ------------------------------------ */
var BRUSH        = true;  /* false = niente pennellata                        */
var BRUSH_ALWAYS = false; /* true = attivo anche a menu chiuso, su tutta la pagina */
var BRUSH_R      = 0.0042;/* raggio dello splat. E' exp(-d^2/r), quindi il raggio
                             vero e' ~sqrt(r): 0.0042 ~ 6% dell'altezza.      */
var BRUSH_AMT    = 0.36;  /* colorante per splat: piu' alto = pennellata piu' larga */
var BRUSH_STEP   = 0.011; /* passo lungo il tratto: piu' basso = tratto piu' continuo */
var BRUSH_PULL   = 0.26;  /* quanta velocita' della mano passa al fluido. Piu' e'
                             alto piu' l'inchiostro scappa avanti alla mano;
                             abbassalo per tenerlo incollato al puntatore.     */
var BRUSH_DRY    = 1.50;  /* dissipazione del colorante: piu' alto = asciuga prima */
var BRUSH_GRAVITY= 0.34;  /* quanto cola. E' qui che si vede il non newtoniano:
                             il denso scende, il velo resta sospeso.          */
var BRUSH_TINT   = [1.0,0.985,0.96]; /* su carta bianca l'inversione da' nero-inchiostro */
var WEBGL_MIN_W  = 992;   /* sotto questa larghezza: coreografia in CSS       */
/* ========================================================================== */


/* ----- il terreno: capacita’ della macchina, non gusti ------------------- */
var mq = function(q){ try{ return window.matchMedia(q).matches; }catch(e){ return false; } };
var REDUCED = mq('(prefers-reduced-motion: reduce)');
var HOVERS  = mq('(hover: hover)');
var d = document;

function el(tag, cls, txt){
  var n = d.createElement(tag);
  if(cls) n.className = cls;
  if(txt != null) n.textContent = txt;
  return n;
}

/* ============================== IL BOTTONE ================================
   In basso al centro. Dentro c'e' solo la parola.                        */
var btn = el('button','capehdr-btn');
btn.type = 'button';
btn.setAttribute('aria-expanded','false');
btn.setAttribute('aria-controls','capehdr-panel');
btn.appendChild(el('span','capehdr-btn__label', OPEN_TXT));

/* Per chiudere: una X in alto a destra. Compare a menu aperto, e in quel
   momento il bottone in basso se ne va — mai due comandi insieme. */
var xBtn = el('button','capehdr-x');
xBtn.type = 'button';
xBtn.setAttribute('aria-label', CLOSE_LBL);
xBtn.appendChild(el('i')); xBtn.appendChild(el('i'));

/* ============================== IL PANNELLO ===============================
   Due colonne e basta: l'immagine e le voci.                             */
var panel = el('div','capehdr-panel');
panel.id = 'capehdr-panel';
panel.setAttribute('role','dialog');
panel.setAttribute('aria-modal','true');
panel.setAttribute('aria-label','Menu');
panel.tabIndex = -1;

var grid = el('div','capehdr-grid');

/* --- sinistra: l'immagine. Tutte impilate e precaricate: cambiare voce e'
       solo un'opacita' che si scambia, mai un caricamento a vista.       */
var visual = el('div','capehdr-visual');
visual.setAttribute('aria-hidden','true');
var shots = [], logoShot = null;
function shot(src){
  var im = new Image();
  im.decoding = 'async'; im.loading = 'eager'; im.alt = '';
  /* Se un URL e' sbagliato non deve restare l'icona di immagine rotta in
     mezzo al menu: quell'immagine sparisce e la voce si tiene il logo. */
  im.onerror = function(){
    im._dead = true;
    im.style.display = 'none';
    if(im.classList.contains('is-on')) showShot(logoShot && !logoShot._dead ? logoShot : null);
  };
  im.src = src;
  visual.appendChild(im);
  return im;
}
if(LOGO) logoShot = shot(LOGO);

/* --- destra: le voci --------------------------------------------------- */
var list = el('ul','capehdr-list');
var linkEls = [];
INDEX.forEach(function(it){
  var li = el('li','capehdr-item');
  var a  = el('a','capehdr-link');
  a.href = it.href;
  var nm = el('span','capehdr-name', it.name);
  var ds = el('span','capehdr-desc', it.desc || '');
  a.appendChild(nm); a.appendChild(ds);
  li.appendChild(a); list.appendChild(li);

  var im = it.img ? shot(it.img) : null;
  shots.push(im);
  if(im || logoShot){
    a.addEventListener('mouseenter', function(){ showShot(pick(im)); });
    a.addEventListener('focus',      function(){ showShot(pick(im)); });
  }
  linkEls.push({ a:a, name:nm, desc:ds, img:im });
});
list.addEventListener('mouseleave', function(){ showShot(pick(null)); });

function pick(im){                     /* la voce senza immagine (o rotta) tiene il logo */
  if(im && !im._dead) return im;
  return (logoShot && !logoShot._dead) ? logoShot : null;
}
function showShot(im){
  if(logoShot) logoShot.classList.toggle('is-on', im === logoShot);
  for(var k = 0; k < shots.length; k++)
    if(shots[k]) shots[k].classList.toggle('is-on', shots[k] === im);
}

grid.appendChild(visual); grid.appendChild(list);
panel.appendChild(grid);

/* ======================== I DUE STRATI DI INCHIOSTRO ====================== */
var veil  = d.createElement('canvas'); veil.className  = 'capehdr-veil';  veil.setAttribute('aria-hidden','true');
var brush = d.createElement('canvas'); brush.className = 'capehdr-brush'; brush.setAttribute('aria-hidden','true');
var fold  = el('div','capehdr-fold'); fold.setAttribute('aria-hidden','true');
fold.appendChild(el('i')); fold.appendChild(el('i'));
var seam  = el('div','capehdr-seam'); seam.setAttribute('aria-hidden','true');

/* Figli DIRETTI del body: e' l'unico modo perche' mix-blend-mode:difference
   veda tutta la pagina sotto di se' (un contenitore con z-index farebbe da
   scatola chiusa e il pennello invertirebbe solo se stesso). */
function mount(){
  d.body.appendChild(veil);
  d.body.appendChild(fold);
  d.body.appendChild(panel);
  d.body.appendChild(seam);
  d.body.appendChild(btn);
  d.body.appendChild(xBtn);
  d.body.appendChild(brush);
  showShot(pick(null));
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){ btn.classList.add('is-in'); shown = true; });
  });
}

/* ==========================================================================
   1 · IL BOTTONE CHE VA E VIENE
   Scendi -> scende sotto il bordo e sparisce. Risali -> risale e torna.
   In cima alla pagina c'e' sempre. A menu aperto resta dov'e': e' anche il
   bottone per chiudere.
   ========================================================================== */
var shown = false, lastY = 0, ticking = false, open = false;

function show(){ if(!shown){ shown = true;  btn.classList.add('is-in'); } }
function hide(){ if(shown){  shown = false; btn.classList.remove('is-in'); } }

function onScroll(){
  if(ticking) return;
  ticking = true;
  requestAnimationFrame(function(){
    ticking = false;
    var y = window.pageYOffset || d.documentElement.scrollTop || 0;
    if(!open){
      var dy = y - lastY;
      if(y <= TOP_ZONE)            show();
      else if(!HIDE_ON_DOWN)       show();
      else if(dy >  SCROLL_EPS)    hide();
      else if(dy < -SCROLL_EPS)    show();
    }
    lastY = y;
  });
}

/* ==========================================================================
   3 · LE FINESTRE: il testo scorre dietro il proprio bordo
   Stessa meccanica della "tendina" gia’ in uso sulle sezioni orizzontali:
   un involucro fa da finestra, il figlio trasla. Il ritaglio esiste solo
   mentre l’elemento si muove, poi sparisce: a riposo niente clip, cosi’ le
   pance delle lettere e l’anello di focus restano interi.
   ========================================================================== */
function wrap(node){
  if(node._chSlide) return node._chSlide;
  var s = el('span','capehdr-slide');
  while(node.firstChild) s.appendChild(node.firstChild);
  node.appendChild(s);
  node._chSlide = s;
  return s;
}

function enter(node, tx, ty, delay){
  var s = wrap(node);
  if(REDUCED){ s.style.transform = 'none'; s.style.opacity = '1'; node.style.overflow = ''; return; }
  node.style.overflow = 'hidden';
  var a = s.animate(
    [{ transform:'translate3d('+tx+','+ty+',0)', opacity:0 },
     { transform:'translate3d(0,0,0)',           opacity:1 }],
    { duration:RISE_MS, delay:delay, easing:'cubic-bezier(.16,1,.3,1)', fill:'both' });
  a.onfinish = function(){
    s.style.transform = 'none'; s.style.opacity = '1';
    node.style.overflow = '';            /* via il ritaglio: focus e pance delle lettere salve */
    try{ a.cancel(); }catch(e){}
  };
}

function leave(node, tx, ty, delay){
  var s = node._chSlide; if(!s) return;
  node.style.overflow = 'hidden';
  if(REDUCED){ s.style.opacity = '0'; return; }
  s.animate(
    [{ transform:'translate3d(0,0,0)', opacity:1 },
     { transform:'translate3d('+tx+','+ty+',0)', opacity:0 }],
    { duration:240, delay:delay, easing:'cubic-bezier(.76,0,.24,1)', fill:'both' });
}

/* ==========================================================================
   4 · IL FLUIDO
   E' lo stesso solutore della sezione ink-bleed di questa pagina: advezione,
   forze, vorticita', divergenza, 20 giri di pressione, gradiente. Non e' una
   scia disegnata: e' inchiostro vero che si muove.

   Il pezzo che conta e' in FORCES:
       cc    = c/uRef
       heavy = cc*(0.16 + 0.84*cc*cc)
       vel.y -= uGravity*heavy*dt
   il peso non e' proporzionale alla quantita', ci va quasi col cubo. Il denso
   cola, il velo resta sospeso: e' il comportamento non newtoniano, ed e' la
   ragione per cui questo inchiostro fa blob e non sfumature.

   E in DISPLAY:  body = 1 - exp(-K*c);  a = smoothstep(.40,.68, body)
   la soglia taglia il colorante in macchie con un bordo, non in una nebbia.

   Serve WebGL2 con i buffer float. Se non c'e': niente fluido, il menu resta
   intero e si apre in CSS. Come fa gia' il divider.
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

var RND = 'float h11(float p){ return fract(sin(p*127.1)*43758.5453123); }\n' +
  'float n11(float x){ float i=floor(x), f=fract(x); f=f*f*(3.-2.*f);\n' +
  '  return mix(h11(i), h11(i+1.), f); }\n';

var ADVECT = HEAD + 'uniform sampler2D uVelocity, uSource;\n' +
  'uniform vec2 uTexel, uSourceTexel; uniform float uDt, uDissipation;\n' +
  'void main(){ vec2 coord = vUv - uDt*texture(uVelocity,vUv).xy*uTexel;\n' +
  '  fragColor = texture(uSource,coord)/(1.+uDissipation*uDt); }';

var FORCES = HEAD + 'uniform sampler2D uVelocity, uDye;\n' +
  'uniform float uDt, uGravity, uAmbient, uTime, uAspect, uDragX, uRef;\n' +
  'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }\n' +
  'float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);\n' +
  '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),\n' +
  '             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }\n' +
  'float psi(vec2 p,float t){ return vnoise(p*3.+vec2(0.,t*0.13)) + 0.5*vnoise(p*7.-vec2(t*0.09,0.)); }\n' +
  'vec2 curlNoise(vec2 p,float t){ const float e=0.012;\n' +
  '  return vec2(psi(p+vec2(0.,e),t)-psi(p-vec2(0.,e),t),\n' +
  '              psi(p-vec2(e,0.),t)-psi(p+vec2(e,0.),t))/(2.*e); }\n' +
  'void main(){ vec2 vel = texture(uVelocity,vUv).xy;\n' +
  '  float c = texture(uDye,vUv).x + texture(uDye,vUv).y;\n' +
  '  float cc = clamp(c/uRef, 0., 1.);\n' +
  '  float heavy = cc * (0.16 + 0.84*cc*cc);\n' +          /* il termine non newtoniano */
  '  vel.y -= uGravity*heavy*uDt;\n' +
  '  vel += curlNoise(vUv*vec2(uAspect,1.),uTime)*uAmbient*uDt;\n' +
  '  vel.x -= vel.x * min(1., uDragX*uDt);\n' +
  '  fragColor = vec4(vel,0.,1.); }';

var CURL = HEAD + 'uniform sampler2D uVelocity;\n' +
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

/* I due fronti dell'apertura. E' il FEED del divider girato di 90 gradi e
   specchiato: una riserva piena dietro il labbro e una banda di corsa davanti,
   con il labbro sporcato dallo stesso rumore a tre ottave. */
var EDGE = HEAD + RND + 'uniform sampler2D uTarget; uniform vec3 uValue;\n' +
  'uniform float uP, uTime, uThick, uMode, uPush, uAdv;\n' +
  'void main(){\n' +
  /* t: 0 in alto a sinistra, 1 in basso a destra. s: lungo il fronte. */
  '  float t = (vUv.x + (1.0 - vUv.y)) * 0.5;\n' +
  '  float sx = (vUv.x + vUv.y) * 1.6;\n' +
  '  float n = 0.55*n11(sx*3.1 + uTime*0.07) + 0.30*n11(sx*7.0 - uTime*0.05) + 0.15*n11(sx*13.0);\n' +
  '  float lip = uP*uAdv + (n - 0.5)*uThick*2.0;\n' +
  '  float dd = (t - lip)/uThick;\n' +
  '  float run = exp(-dd*dd);\n' +
  '  vec3 prev = texture(uTarget, vUv).xyz;\n' +
  '  if(uMode < 0.5) fragColor = vec4(prev + uValue*run*1.6, 1.);\n' +
  /* la spinta e' lungo la diagonale: +x, -y */
  '  else fragColor = vec4(prev.x + run*uPush*0.7071, prev.y - run*uPush*0.7071, 0., 1.);\n' +
  '}';

/* Il velo: carta. Le pennellate corrono avanti, il fronte pieno le rincorre
   e chiude. Il fronte garantisce la copertura, il pennello la forma.
   uErase = 1: stessa diagonale, stessa direzione, ma la carta se ne va invece
   di arrivare. Non e' l'animazione al contrario: e' la stessa animazione. */
var PAPER = HEAD + RND + 'uniform sampler2D uDye; uniform vec3 uCol;\n' +
  'uniform float uInkK, uP, uTime, uAdv, uRes, uErase;\n' +
  'void main(){ float c = texture(uDye, vUv).x;\n' +
  '  float body = 1. - exp(-uInkK*c);\n' +
  '  float blob = smoothstep(0.45, 0.58, body);\n' +
  '  float t  = (vUv.x + (1.0 - vUv.y)) * 0.5;\n' +
  '  float sx = (vUv.x + vUv.y) * 1.6;\n' +
  '  float amp = 0.06*sin(3.14159265*clamp(uP,0.,1.));\n' +
  '  float w = (0.55*n11(sx*3.1 + uTime*0.07) + 0.30*n11(sx*7.0 - uTime*0.05)\n' +
  '           + 0.15*n11(sx*13.0) - 0.5) * amp * 2.0;\n' +
  '  float e  = uP*uAdv + w;\n' +
  '  float fe = 0.004 + amp*0.10;\n' +
  '  float a;\n' +
  '  if(uErase < 0.5){\n' +
  '    a = clamp(max(blob, smoothstep(e, e - fe, t)), 0., 1.);\n' +
  '  } else {\n' +
  '    float front = smoothstep(e, e + fe, t);\n' +
  '    float band  = exp(-pow((t - e)/max(fe*4.0, 1e-4), 2.0));\n' +
  '    a = clamp(front + (blob - 0.45)*0.9*band, 0., 1.);\n' +
  '  }\n' +
  '  vec3 col = mix(uCol, uCol*0.992, 1.-vUv.y);\n' +
  '  col += (fract(sin(dot(vUv*uRes + fract(uTime),vec2(12.9898,78.233)))*43758.5453)-0.5)*0.011;\n' +
  '  fragColor = vec4(col*a, a); }';

/* Il pennello: bianco premoltiplicato. Il canvas e' in difference, quindi
   dove c'e' inchiostro la pagina si vede al negativo. Stessa soglia del
   divider: macchie con un bordo, non un alone. */
var NEG = HEAD + 'uniform sampler2D uDye; uniform vec3 uTint; uniform float uInkK, uGlobal;\n' +
  'void main(){ float c = texture(uDye, vUv).y;\n' +
  '  float body = 1. - exp(-uInkK*c);\n' +
  '  float a = smoothstep(0.40, 0.56, body) * uGlobal;\n' +
  '  fragColor = vec4(uTint*a, a); }';

function compile(gl, type, src){
  var sh = gl.createShader(type);
  gl.shaderSource(sh, '#version 300 es\n' + src);
  gl.compileShader(sh);
  if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
    console.warn('[capehdr]', gl.getShaderInfoLog(sh)); return null;
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
    console.warn('[capehdr]', gl.getProgramInfoLog(p)); return null;
  }
  var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), i;
  for(i = 0; i < n; i++){
    var nm = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
    u[nm] = gl.getUniformLocation(p, nm);
  }
  return { p:p, u:u, use:function(){ gl.useProgram(p); return u; } };
}

/* ==========================================================================
   5 · UN SOLUTORE, DUE ISTANZE
   Il velo e il pennello sono la stessa cosa con parametri diversi. Vivono su
   due canvas perche' devono comporsi in modo diverso: il velo dipinge carta
   (normale), il pennello inverte (difference) e per invertire deve stare
   sopra al testo, e figlio diretto del body.
   ========================================================================== */
function Fluid(canvas, displayFrag, cfg){
  var gl = null, ok = false;
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
  function pick(ifmt, fmt){
    if(renderable(ifmt, fmt)) return { i:ifmt, f:fmt };
    if(ifmt === gl.R16F)  return pick(gl.RG16F, gl.RG);
    if(ifmt === gl.RG16F) return pick(gl.RGBA16F, gl.RGBA);
    return null;
  }
  var fRGBA = pick(gl.RGBA16F, gl.RGBA), fRG = pick(gl.RG16F, gl.RG), fR = pick(gl.R16F, gl.RED);
  if(!fRGBA || !fRG || !fR) return { ok:false };

  var pr = {
    advect:Program(gl,ADVECT), forces:Program(gl,FORCES), curl:Program(gl,CURL),
    vort:Program(gl,VORT), div:Program(gl,DIV), press:Program(gl,PRESS),
    grad:Program(gl,GRAD), splat:Program(gl,SPLAT), clear:Program(gl,CLEAR),
    edge:Program(gl,EDGE), show:Program(gl,displayFrag)
  };
  for(var k in pr) if(!pr[k]) return { ok:false };

  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  var SIM = cfg.sim || 96, DYE = cfg.dye || 256, ITER = 20;
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
  function resize(){
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var box = canvas.getBoundingClientRect();
    var cw = Math.max(1, Math.round(box.width)  || d.documentElement.clientWidth);
    var ch = Math.max(1, Math.round(box.height) || d.documentElement.clientHeight);
    if(cw*ch*dpr*dpr > 3.5e6) dpr = Math.max(1, Math.sqrt(3.5e6/(cw*ch)));
    var w = Math.max(1, Math.round(cw*dpr)), h = Math.max(1, Math.round(ch*dpr));
    if(canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
    aspect = cw/Math.max(1, ch);
    if(aw === w && ah === h && vel) return;
    aw = w; ah = h;
    var sw = Math.round(SIM*Math.max(aspect,1)), sh = SIM;
    var dw = Math.round(DYE*Math.max(aspect,1)), dh = DYE;
    gridW = sw;
    vel  = dbl(sw,sh,fRG,gl.LINEAR);
    dye  = dbl(dw,dh,fRGBA,gl.LINEAR);
    pres = dbl(sw,sh,fR,gl.NEAREST);
    dvg  = fbo(sw,sh,fR,gl.NEAREST);
    crl  = fbo(sw,sh,fR,gl.NEAREST);
  }
  resize();

  var time = 0;
  var P = { gravity:cfg.gravity, curl:cfg.curl, dyeDiss:cfg.dyeDiss,
            velDiss:cfg.velDiss, ambient:cfg.ambient, dragX:cfg.dragX, ref:cfg.ref };

  function splat(x, y, dx, dy, amount, radius, chan){
    var S = gridW, u;
    u = pr.splat.use();
    gl.uniform1i(u.uTarget, vel.read.bind(0)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform2f(u.uPoint,x,y); gl.uniform3f(u.uColor,dx*S,dy*S,0); gl.uniform1f(u.uRadius,radius);
    blit(vel.write); vel.swap();
    u = pr.splat.use();
    gl.uniform1i(u.uTarget, dye.read.bind(0)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform2f(u.uPoint,x,y);
    gl.uniform3f(u.uColor, chan === 1 ? 0 : amount, chan === 1 ? amount : 0, 0);
    gl.uniform1f(u.uRadius,radius);
    blit(dye.write); dye.swap();
  }

  function edge(dt, p, amount, push, thick, adv){
    var u = pr.edge.use();
    gl.uniform1i(u.uTarget, vel.read.bind(0));
    gl.uniform1f(u.uP,p); gl.uniform1f(u.uTime,time); gl.uniform1f(u.uThick,thick);
    gl.uniform1f(u.uAdv,adv); gl.uniform1f(u.uMode,1); gl.uniform1f(u.uPush,push*gridW*dt);
    gl.uniform3f(u.uValue,0,0,0);
    blit(vel.write); vel.swap();
    u = pr.edge.use();
    gl.uniform1i(u.uTarget, dye.read.bind(0));
    gl.uniform1f(u.uP,p); gl.uniform1f(u.uTime,time); gl.uniform1f(u.uThick,thick);
    gl.uniform1f(u.uAdv,adv); gl.uniform1f(u.uMode,0); gl.uniform1f(u.uPush,0);
    gl.uniform3f(u.uValue, amount*dt, 0, 0);
    blit(dye.write); dye.swap();
  }

  function step(dt){
    var S = gridW, u, i;
    gl.disable(gl.BLEND);
    u = pr.advect.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty); gl.uniform2f(u.uSourceTexel, vel.tx, vel.ty);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uSource, vel.read.bind(0));
    gl.uniform1f(u.uDt,dt); gl.uniform1f(u.uDissipation,P.velDiss);
    blit(vel.write); vel.swap();

    u = pr.forces.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uDye, dye.read.bind(1));
    gl.uniform1f(u.uDt,dt); gl.uniform1f(u.uGravity,P.gravity*S);
    gl.uniform1f(u.uAmbient,P.ambient*S); gl.uniform1f(u.uDragX,P.dragX);
    gl.uniform1f(u.uRef,P.ref); gl.uniform1f(u.uTime,time); gl.uniform1f(u.uAspect,aspect);
    blit(vel.write); vel.swap();

    u = pr.curl.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty); gl.uniform1i(u.uVelocity, vel.read.bind(0));
    blit(crl);
    u = pr.vort.use();
    gl.uniform2f(u.uTexel, vel.tx, vel.ty);
    gl.uniform1i(u.uVelocity, vel.read.bind(0)); gl.uniform1i(u.uCurl, crl.bind(1));
    gl.uniform1f(u.uCurlAmount,P.curl); gl.uniform1f(u.uMaxDv,0.25*S); gl.uniform1f(u.uDt,dt);
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
    gl.uniform1f(u.uDt,dt); gl.uniform1f(u.uDissipation,P.dyeDiss);
    blit(dye.write); dye.swap();
    time += dt;
  }

  function wipe(){
    var u = pr.clear.use();
    gl.uniform1i(u.uTexture, dye.read.bind(0)); gl.uniform1f(u.uValue, 0);
    blit(dye.write); dye.swap();
    u = pr.clear.use();
    gl.uniform1i(u.uTexture, vel.read.bind(0)); gl.uniform1f(u.uValue, 0);
    blit(vel.write); vel.swap();
  }

  function render(fill){
    gl.disable(gl.BLEND);
    var u = pr.show.use();
    gl.uniform2f(u.uTexel, dye.tx, dye.ty);
    gl.uniform1i(u.uDye, dye.read.bind(0));
    gl.uniform1f(u.uInkK, cfg.inkK);
    gl.uniform1f(u.uTime, time);
    if(fill) fill(u, gl);
    blit(null);
  }

  return { ok:true, P:P, splat:splat, edge:edge, step:step, render:render,
           wipe:wipe, resize:resize, aspect:function(){ return aspect; } };
}

/* ==========================================================================
   6 · LE DUE ISTANZE
   ========================================================================== */
var Ink = (function(){
  var veilF = null, brushF = null, made = false;

  function build(){
    if(made) return;
    made = true;
    veilF = Fluid(veil, PAPER, { sim:96, dye:448, inkK:2.60, ref:3.0,
      gravity:0.10, curl:0.10, dyeDiss:FLOOD_DISS, velDiss:2.60, ambient:0.004, dragX:2.6 });
    if(!veilF.ok) veilF = null;
    if(BRUSH){
      brushF = Fluid(brush, NEG, { sim:96, dye:384, inkK:2.60, ref:3.0,
        gravity:BRUSH_GRAVITY, curl:0.09, dyeDiss:BRUSH_DRY, velDiss:2.60,
        ambient:0.003, dragX:2.0 });
      if(!brushF.ok) brushF = null;
    }
  }
  return {
    build:build,
    veil: function(){ return veilF; },
    brush:function(){ return brushF; }
  };
})();
/* ==========================================================================
   7 · LA COREOGRAFIA
   L’inchiostro entra dai due lati · si toccano al centro · sulla cucitura
   scatta una luce · da li’ il menu si compone: i nomi da sinistra, le
   didascalie da destra, le colonne salgono da sotto.
   ========================================================================== */
function nowMs(){ return (window.performance && performance.now) ? performance.now() : Date.now(); }

var easeIO = function(t){ return t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t + 2, 4)/2; };

function tween(ms, ease, step, done){
  var t0 = nowMs(), id = 0;
  (function frame(){
    var t = Math.min(1, (nowMs() - t0)/ms);
    step(ease(t));
    if(t < 1) id = requestAnimationFrame(frame); else if(done) done();
  })();
  return function(){ if(id) cancelAnimationFrame(id); };
}

var canGL  = !REDUCED && window.innerWidth >= WEBGL_MIN_W;
var glOn   = false;                       /* deciso al primo click, non prima */
var timers = [], busy = false;

function at(ms, fn){ timers.push(setTimeout(fn, ms)); }
function clearTimers(){ timers.forEach(clearTimeout); timers = []; }

/* --------------------------------------------------------------------------
   Il motore: un solo rAF per tutti e due i fluidi, a passo fisso di 1/60 con
   accumulatore — se il frame salta, la fisica non cambia comportamento.
   -------------------------------------------------------------------------- */
var Eng = (function(){
  var raf = 0, last = 0, acc = 0;
  var p = 0, t0 = 0, dur = 1, moving = false, arrive = null, erase = 0;
  var want = 0, have = 0;                              /* opacita’ del pennello */
  var pt = { x:0.5, y:0.5, lx:0.5, ly:0.5, seen:false, had:false };
  var veilLive = false;

  /* Il punto va normalizzato sul rettangolo del canvas, non sulla finestra:
     sono due cose diverse ogni volta che c'e' una scrollbar. */
  function onMove(e){
    var r = brush.getBoundingClientRect();
    if(r.width < 2 || r.height < 2) return;
    pt.x = (e.clientX - r.left)/r.width;
    pt.y = 1 - (e.clientY - r.top)/r.height;
    pt.seen = true;
  }

  /* la mano dipinge: splat interpolati lungo il tratto percorso, come il
     brush() del divider. La velocita’ della mano entra nel campo di moto. */
  function paint(dt){
    var F = Ink.brush();
    if(!F || !pt.seen || want < 0.5) return;
    if(!pt.had){ pt.lx = pt.x; pt.ly = pt.y; pt.had = true; return; }
    var dx = pt.x - pt.lx, dy = pt.y - pt.ly, asp = F.aspect();
    var dist = Math.sqrt(dx*dx*asp*asp + dy*dy);
    if(dist < 0.0004) return;
    var n = Math.min(16, Math.max(1, Math.round(dist/BRUSH_STEP)));
    var h = Math.max(dt, 1/240);
    var sp = dist/h, cap = sp > 4.0 ? 4.0/sp : 1;
    var vx = (dx/h)*cap*BRUSH_PULL, vy = (dy/h)*cap*BRUSH_PULL/Math.max(asp, 1e-3);
    for(var k = 1; k <= n; k++){
      var t = k/n;
      F.splat(pt.lx + dx*t, pt.ly + dy*t, vx, vy, BRUSH_AMT, BRUSH_R, 1);
    }
    pt.lx = pt.x; pt.ly = pt.y;
  }

  function frame(now){
    raf = 0;
    if(!last) last = now;
    var raw = (now - last)/1000; last = now;
    var dtUi = Math.max(1/240, Math.min(raw, 1/10));

    if(moving){
      var t = Math.min(1, (now - t0)/dur);
      p = easeIO(t);
      if(t >= 1){ moving = false; p = 1; if(arrive){ var f = arrive; arrive = null; f(); } }
    }
    have += (want - have)*Math.min(1, dtUi*6);

    var V = Ink.veil(), B = Ink.brush();
    var feeding = moving || (p > 0.0005 && p < 0.9995);
    if(feeding) veilLive = true;

    paint(dtUi);

    acc += raw; if(acc > 4/60) acc = 2/60;
    var steps = 0;
    while(acc >= 1/60 && steps < 3){
      if(V && veilLive){
        if(feeding){
          V.edge(1/60, p, FLOOD_AMT, FLOOD_PUSH, FLOOD_THICK, FLOOD_ADV);
          dabs(V, p, 1/60);
        }
        V.step(1/60);
      }
      if(B && have > 0.004) B.step(1/60);
      acc -= 1/60; steps++;
    }

    if(V && veilLive) V.render(function(u, gl){
      gl.uniform3f(u.uCol, 0.984, 0.980, 0.968);        /* #FBFAF7 — carta */
      gl.uniform1f(u.uP, p);
      gl.uniform1f(u.uAdv, FLOOD_ADV);
      gl.uniform1f(u.uRes, veil.width);
      gl.uniform1f(u.uErase, erase);
    });
    if(B && have > 0.004) B.render(function(u, gl){
      gl.uniform3f(u.uTint, BRUSH_TINT[0], BRUSH_TINT[1], BRUSH_TINT[2]);
      gl.uniform1f(u.uGlobal, have);
    });

    if(!feeding && veilLive && !moving){                /* arrivato: la fisica si ferma */
      veilLive = false;
      if(erase && V){ V.wipe(); veil.style.display = 'none'; }
    }
    if(B && have <= 0.004 && want === 0){ brush.style.display = 'none'; pt.had = false; }

    if(moving || veilLive || have > 0.004) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  function kick(){ if(!raf){ last = 0; raf = requestAnimationFrame(frame); } }

  /* Le pennellate che corrono lungo il fronte: e' questo che fa sembrare una
     mano che dipinge invece di una tenda che si chiude. Il punto si pesca
     sulla retta a 45 gradi che in questo istante e' il fronte. */
  var hand = 0, handDir = 1, prevDab = null, handSp = 1;
  function dabs(F, prog, dt){
    if(FLOOD_DABS <= 0) return;
    var L = prog*FLOOD_ADV;
    /* il fronte a 45 gradi, in questo istante, va da (lo, ...) a (hi, ...) */
    var lo = Math.max(0, 2*L - 1), hi = Math.min(1, 2*L);
    if(hi - lo < 1e-4){ prevDab = null; return; }

    /* La mano corre avanti e indietro lungo il fronte invece di picchiettare
       a caso: e' la differenza fra una pennellata e del rumore. */
    hand += handDir * FLOOD_SWEEP * handSp * dt;
    /* a ogni inversione la mano cambia un po' passo: due passate non escono
       mai identiche, e il fronte non fa il gradino sempre nello stesso punto */
    if(hand >= 1){ hand = 1; handDir = -1; handSp = 0.78 + Math.random()*0.5; }
    else if(hand <= 0){ hand = 0; handDir = 1; handSp = 0.78 + Math.random()*0.5; }

    var x = lo + hand*(hi - lo);
    var y = x - 2*L + 1;
    if(y < -0.08 || y > 1.08){ prevDab = null; return; }

    /* Due velocita' sommate: la passata lungo il fronte (0.707, 0.707) e
       l'avanzamento sulla diagonale (0.707, -0.707). E' la seconda che fa
       avanzare l'inchiostro, la prima che lo smaccia di traverso. */
    var vx = handDir*0.7071*FLOOD_DAB_V + 0.7071*FLOOD_PUSH;
    var vy = handDir*0.7071*FLOOD_DAB_V - 0.7071*FLOOD_PUSH;

    /* impronte interpolate fra dove era la mano e dove e' adesso: il tratto
       resta continuo anche se il frame e' saltato */
    var px = prevDab ? prevDab[0] : x, py = prevDab ? prevDab[1] : y;
    var dx = x - px, dy = y - py;
    var n = Math.max(1, Math.min(FLOOD_DABS, Math.round(Math.sqrt(dx*dx + dy*dy)/0.012)));
    for(var k = 1; k <= n; k++){
      var u = k/n;
      /* setola disuguale: ogni impronta ha il suo carico e la sua larghezza */
      F.splat(px + dx*u, py + dy*u, vx, vy,
              FLOOD_DAB_A*(0.72 + Math.random()*0.56),
              FLOOD_DAB_R*(0.80 + Math.random()*0.45), 0);
    }
    prevDab = [x, y];
  }

  return {
    /* Una corsa sola, sempre 0 -> 1. In uscita cambia solo cosa vuol dire
       "arrivato": la carta se ne va invece di arrivare, nella stessa
       direzione e con la stessa fisica. */
    play: function(isErase, ms, done){
      erase = isErase ? 1 : 0;
      p = 0; dur = Math.max(1, ms); t0 = nowMs();
      moving = true; arrive = done || null; veilLive = true;
      hand = 0; handDir = 1; handSp = 1; prevDab = null;  /* la mano riparte da capo */
      veil.style.display = 'block';
      kick();
    },
    brushOn: function(){
      if(!Ink.brush()) return;
      want = 1; brush.style.display = 'block';
      window.addEventListener('mousemove', onMove, {passive:true});
      kick();
    },
    brushOff: function(){
      want = 0;
      window.removeEventListener('mousemove', onMove);
      kick();
    },
    resize: function(){
      var V = Ink.veil(), B = Ink.brush();
      if(V) V.resize();
      if(B) B.resize();
    }
  };
})();

function seamFlash(){
  if(REDUCED) return;
  seam.animate(
    [{ opacity:0, transform:'scaleY(.12)' },
     { opacity:1, transform:'scaleY(1)', offset:0.36 },
     { opacity:0, transform:'scaleY(1)' }],
    { duration:540, easing:'cubic-bezier(.16,1,.3,1)' });
}

/* Le due colonne nascono dalla cucitura e si aprono verso fuori:
   l'immagine si scopre dal suo bordo destro andando a sinistra, le voci
   entrano da sinistra dietro il proprio bordo. Stessa direzione
   dell'inchiostro che le ha appena portate li'. */
function armIn(){
  for(var i = 0; i < linkEls.length; i++){
    arm(linkEls[i].name, '-112%', '0');
    arm(linkEls[i].desc, '-112%', '0');
  }
  visual.style.clipPath = 'inset(0 0 0 100%)';
  visual.style.webkitClipPath = 'inset(0 0 0 100%)';
}
function arm(node, tx, ty){
  var sl = wrap(node);
  node.style.overflow = 'hidden';
  sl.style.transform = 'translate3d('+tx+','+ty+',0)';
  sl.style.opacity = '0';
}

function revealIn(){
  if(REDUCED){
    visual.style.clipPath = ''; visual.style.webkitClipPath = '';
  }else{
    var a = visual.animate(
      [{ clipPath:'inset(0 0 0 100%)', webkitClipPath:'inset(0 0 0 100%)' },
       { clipPath:'inset(0 0 0 0%)',   webkitClipPath:'inset(0 0 0 0%)' }],
      { duration:820, easing:'cubic-bezier(.16,1,.3,1)', fill:'both' });
    a.onfinish = function(){
      visual.style.clipPath = ''; visual.style.webkitClipPath = '';
      try{ a.cancel(); }catch(e){}
    };
  }
  for(var i = 0; i < linkEls.length; i++){
    enter(linkEls[i].name, '-112%', '0', 120 + i*STAGGER);
    enter(linkEls[i].desc, '-112%', '0', 120 + i*STAGGER + 80);
  }
}

function revealOut(){
  var i, n = linkEls.length;
  for(i = 0; i < n; i++){
    leave(linkEls[n-1-i].name, '-70%', '0', i*26);
    leave(linkEls[n-1-i].desc, '-70%', '0', i*26);
  }
  if(!REDUCED) visual.animate([{opacity:1},{opacity:0}],
    { duration:260, easing:'cubic-bezier(.76,0,.24,1)', fill:'both' });
}

/* ------------------------------------------------------------------ APRI -- */
function openMenu(){
  if(open || busy) return;
  open = true; busy = true;
  clearTimers();

  panel.classList.add('is-on');
  btn.classList.remove('is-in');           /* il bottone se ne va: chiude la X */
  visual.style.opacity = '';               /* la chiusura la sbiadisce: qui torna intera */
  visual.getAnimations().forEach(function(a){ try{ a.cancel(); }catch(e){} });
  showShot(pick(null));                    /* si riapre sempre sul logo */
  armIn();                                  /* prima si arma, poi si compone */
  btn.classList.add('is-open');
  btn.setAttribute('aria-expanded','true');
  lock(true);

  var flood = REDUCED ? 1 : FLOOD_MS;

  if(canGL && !glOn){ Ink.build(); glOn = !!Ink.veil(); }
  if(glOn){
    Eng.play(false, flood);
  }else{
    fold.style.display = 'block';
    fold.style.setProperty('--ch-fold', flood + 'ms');
    void fold.offsetWidth;                            /* forza il primo stato */
    fold.classList.add('is-on');
  }

  at(flood*SEAM_AT,      seamFlash);
  at(flood*SEAM_AT + 30, function(){
    revealIn(); busy = false; focusFirst();
    xBtn.classList.add('is-on');
    requestAnimationFrame(function(){ xBtn.classList.add('is-in'); });
  });
  if(BRUSH && HOVERS && glOn) at(flood*SEAM_AT + 140, function(){ Eng.brushOn(); });
}

/* ----------------------------------------------------------------- CHIUDI -- */
function closeMenu(){
  if(!open || busy) return;
  open = false; busy = true;
  clearTimers();

  btn.setAttribute('aria-expanded','false');
  xBtn.classList.remove('is-in');
  at(500, function(){ xBtn.classList.remove('is-on'); });
  if(!BRUSH_ALWAYS) Eng.brushOff();
  revealOut();

  var back = REDUCED ? 1 : RETREAT_MS;

  at(180, function(){
    if(glOn) Eng.play(true, back);
    else{
      fold.style.setProperty('--ch-fold', '0ms');
      fold.classList.remove('is-on');          /* rimettilo all'inizio, di scatto */
      void fold.offsetWidth;
      fold.style.setProperty('--ch-fold', back + 'ms');
      fold.classList.add('is-on');             /* e ripercorri la stessa diagonale */
      at(back + 30, function(){
        fold.style.display = 'none';
        fold.style.setProperty('--ch-fold', '0ms');
        fold.classList.remove('is-on');
      });
    }
  });

  at(180 + back + 60, function(){
    panel.classList.remove('is-on');
    btn.classList.remove('is-open');
    lock(false);                           /* senza questa la pagina resta ferma */
    shown = true; btn.classList.add('is-in');   /* e il bottone torna al suo posto */
    busy = false;
    try{ btn.focus({preventScroll:true}); }catch(e){ btn.focus(); }
  });
}

function toggle(){ open ? closeMenu() : openMenu(); }

/* ==========================================================================
   8 · LO SCROLL BLOCCATO E LA TASTIERA
   Niente overflow:hidden sul body: questa pagina ci costruisce sopra
   (overflow-x:clip, overflow-y:visible !important) e si romperebbe.
   Si ferma Lenis e si intercettano rotella e dita. Zero salti di layout.
   ========================================================================== */
function inPanel(t){ return !!(t && t.closest && t.closest('.capehdr-panel')); }
function eat(e){ if(!inPanel(e.target)) e.preventDefault(); }
var KEYS = { 32:1, 33:1, 34:1, 35:1, 36:1, 38:1, 40:1 };
function eatKeys(e){
  if(e.keyCode === 27){ closeMenu(); return; }
  if(KEYS[e.keyCode] && !inPanel(e.target)) e.preventDefault();
}

function lock(state){
  if(state){
    if(window.lenis && window.lenis.stop) try{ window.lenis.stop(); }catch(e){}
    window.addEventListener('wheel', eat, {passive:false});
    window.addEventListener('touchmove', eat, {passive:false});
    window.addEventListener('keydown', eatKeys, false);
  }else{
    if(window.lenis && window.lenis.start) try{ window.lenis.start(); }catch(e){}
    window.removeEventListener('wheel', eat, {passive:false});
    window.removeEventListener('touchmove', eat, {passive:false});
    window.removeEventListener('keydown', eatKeys, false);
  }
}

function focusables(){
  return Array.prototype.slice.call(
    panel.querySelectorAll('a[href],button:not([disabled])')).filter(function(n){
      return n.offsetParent !== null;
    });
}
/* Si porta il fuoco sul pannello, non sulla prima voce: cliccando col mouse
   un anello di focus attorno a una riga sembra un errore di disegno. Da li'
   il Tab entra comunque nell'elenco, nell'ordine giusto. */
function focusFirst(){
  try{ panel.focus({preventScroll:true}); }catch(e){ panel.focus(); }
}
d.addEventListener('keydown', function(e){
  if(!open || e.key !== 'Tab') return;
  var f = focusables(); if(!f.length) return;
  f = f.concat([xBtn]);
  var first = f[0], last = f[f.length - 1];
  if(e.shiftKey && d.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && d.activeElement === last){ e.preventDefault(); first.focus(); }
});

/* ==========================================================================
   9 · ACCENSIONE
   ========================================================================== */
/* Un link che punta a una sezione di QUESTA pagina non deve ricaricare niente:
   si chiude il menu e ci si va, con Lenis se c'e'. Se l'ancora non esiste
   ancora (i segnaposto in cima), il menu si chiude e basta: nessun salto,
   nessuna schermata rotta. */
function anchors(){
  panel.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href]');
    if(!a) return;
    var href = a.getAttribute('href') || '';
    if(href.charAt(0) !== '#') return;                /* link vero: lascialo andare */
    e.preventDefault();
    var target = href.length > 1 ? d.getElementById(href.slice(1)) : null;
    closeMenu();
    if(!target) return;
    setTimeout(function(){
      if(window.lenis && window.lenis.scrollTo) window.lenis.scrollTo(target, { offset:0 });
      else target.scrollIntoView({ behavior:'smooth', block:'start' });
    }, RETREAT_MS + 280);
  });
}

function init(){
  mount();
  anchors();
  btn.addEventListener('click', function(e){ e.preventDefault(); toggle(); });
  xBtn.addEventListener('click', function(e){ e.preventDefault(); closeMenu(); });

  lastY = window.pageYOffset || 0;
  window.addEventListener('scroll', onScroll, {passive:true});
  var rt;
  window.addEventListener('resize', function(){
    clearTimeout(rt);
    rt = setTimeout(function(){
      canGL = !REDUCED && window.innerWidth >= WEBGL_MIN_W;
      Eng.resize();
    }, 180);
  }, {passive:true});

  d.addEventListener('visibilitychange', function(){
    if(d.hidden) Eng.brushOff();
    else if(open && BRUSH && HOVERS && glOn) Eng.brushOn();
  });

  if(BRUSH_ALWAYS && BRUSH && HOVERS && canGL){ Ink.build(); glOn = !!Ink.veil(); Eng.brushOn(); }

  window.capeHeader = { open:openMenu, close:closeMenu, toggle:toggle };
}

/* ==========================================================================
   10 · IL CSS
   Se non l'hai gia' messo tu nell'<head>, se lo carica da solo dalla stessa
   cartella di questo file e aspetta che sia arrivato prima di costruire la
   barra: cosi' non c'e' mai un lampo di roba non stilata. Se il CSS non
   risponde entro 2.5s si va avanti lo stesso — meglio una barra brutta che
   nessuna barra.
   ========================================================================== */
function withCss(next){
  if(!SELF || !SELF.src) return next();                  /* CSS gia' incollato a mano */
  if(SELF.getAttribute('data-css') === 'off') return next();

  var href = SELF.src.replace(/[^/]*$/, 'cape-header.css');
  var links = d.querySelectorAll('link[rel="stylesheet"]'), i;
  for(i = 0; i < links.length; i++)
    if(/cape-header\.css/.test(links[i].href)) return next();

  var l = d.createElement('link'), done = false;
  function go(){ if(!done){ done = true; next(); } }
  l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-capehdr', '');
  l.onload = go; l.onerror = go;
  setTimeout(go, 2500);
  d.head.appendChild(l);
}

function boot(){ withCss(init); }

if(d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
else boot();

})();
