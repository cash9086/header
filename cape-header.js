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
   - Barra sottile in alto: visibile ferma in cima e quando risali, si ritira
     quando scendi. Sfondo scuro trasparente che cambia opacita' e tono in
     base a cosa le passa sotto (chiaro -> piu' densa, scuro -> quasi assente).
   - Al click su MENU l'inchiostro entra dai due lati con la fisica del
     divider ink-bleed: fluido vero, blob, non newtoniano. I due fronti si
     toccano al centro, sulla cucitura scatta una luce, e da li' il menu si
     compone: i nomi da sinistra, le didascalie da destra.
   - A menu aperto il mouse lascia una pennellata che INVERTE i colori sotto
     di se' (mix-blend-mode: difference, come il cursore-logo del sito).
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

/* --- cosa c'e' scritto ---------------------------------------------------- */
var WORDMARK = 'THE CAPE STUDIO';          /* a sinistra nella barra          */
var OPEN_TXT = 'MENU';                     /* il bottone da chiuso            */
var CLOSE_TXT= 'CLOSE';                    /* il bottone da aperto            */
var HOME_URL = '#';                        /* dove porta il marchio           */

/* Il carrello vive nella barra, accanto a MENU: e' un negozio, si vede.
   BAG_COUNT lo aggiorni da fuori con  capeHeader.bag(n).                    */
var BAG_ON    = true;
var BAG_LABEL = 'BAG';
var BAG_COUNT = 0;
var BAG_HREF  = '#bag';

/* L'indice.
   ATTENZIONE: gli href sono SEGNAPOSTO. Mettici gli id veri delle sezioni di
   questa pagina (#works, #editions...) o gli indirizzi delle pagine quando le
   avrai. Un anchor che non esiste non rompe niente: il menu si chiude e basta.
   La didascalia e' informazione, non decorazione: dice cos'e' quella voce.
   Se non hai niente da dire, lasciala vuota ('').                           */
var INDEX = [
  { name:'WORKS',       desc:'ORIGINALS ON CANVAS', href:'#works'       },
  { name:'EDITIONS',    desc:'LIMITED PRINTS',      href:'#editions'    },
  { name:'THE STUDIO',  desc:'PROCESS',             href:'#studio'      },
  { name:'EXHIBITIONS', desc:'PAST & UPCOMING',     href:'#exhibitions' },
  { name:'CONTACT',     desc:'ENQUIRIES',           href:'#contact'     }
];

/* Colonna di sinistra: come sono fatte le opere. Due righe, non di piu'. */
var NOTE_TITLE = 'THE STUDIO';
var NOTE_TEXT  = 'Oil, charcoal and thinned pigment on canvas. Made and shown in the studio.';

/* Colonna di destra: cosa c'e' adesso. Sono le stesse tre opere del
   carosello: il menu dice la verita' su questa pagina, non un elenco finto. */
var SIDE_TITLE = 'CURRENT';
var SIDE = [
  { name:'Whisper in the Void', meta:'2024', href:'#works' },
  { name:'Trace of a Visage',   meta:'2023', href:'#works' },
  { name:'The Carmine Echo',    meta:'2025', href:'#works' }
];
var CTA      = 'ENQUIRE';       /* i prezzi sono "€ POA": si chiede, non si clicca */
var CTA_HREF = '#contact';

var FOOT_L = '© THE CAPE STUDIO';
var FOOT_R = 'IT / EN';

/* --- come si muove -------------------------------------------------------- */
var FLOOD_MS   = 900;     /* l’inchiostro che entra dai due lati (ms)        */
var RETREAT_MS = 620;     /* l’inchiostro che si ritira (ms)                 */
var RISE_MS    = 620;     /* la salita/entrata di ogni voce (ms)              */
var STAGGER    = 70;      /* ritardo tra una voce e l’altra (ms)             */
var SEAM_AT    = 0.94;    /* a che punto del flood i due fronti si toccano    */

/* --- la barra ------------------------------------------------------------- */
var HIDE_ON_DOWN = true;  /* si ritira scendendo, torna risalendo             */
var TOP_ZONE     = 48;    /* entro questi px dalla cima e’ sempre visibile   */
var SCROLL_EPS   = 5;     /* px di scroll ignorati (evita il tremolio)        */

/* --- la barra che legge lo sfondo ---------------------------------------- */
var TONE_PROBE = true;    /* false = barra sempre uguale                      */
var A_ON_DARK  = 0.26;    /* opacita’ del fondo barra su sfondo scuro        */
var A_ON_LIGHT = 0.60;    /* ...e su sfondo chiaro (piu’ densa = leggibile)  */
var TINT_DARK  = [16,16,19];   /* il nero-blu della notte                     */
var TINT_LIGHT = [27,24,20];   /* su chiaro vira caldo, come l’inchiostro    */
var MEDIA_TONE = 'dark';  /* cosa assumere sotto foto e video senza etichetta.
                             Metti data-nav-tone="light" su una sezione per
                             dirle "qui sotto e’ chiaro".                   */

/* --- l’inchiostro che entra dai lati (stesso solutore di ink-bleed) ------- */
var FLOOD_AMT   = 4.20;   /* quanto colorante versano i due fronti            */
var FLOOD_PUSH  = 0.018;  /* quanto forte spingono verso il centro. Alzalo e le
                             dita di inchiostro scappano avanti al fronte.     */
var FLOOD_DISS  = 1.10;   /* quanto svanisce l’inchiostro che corre troppo avanti:
                             e’ questo che tiene le dita attaccate al fronte.  */
var FLOOD_THICK = 0.052;  /* spessore della banda che corre davanti al fronte */
var FLOOD_ADV   = 0.545;  /* dove arriva ogni fronte a corsa finita (0.5 = meta’) */

/* --- il pennello che inverte i colori ------------------------------------ */
var BRUSH        = true;  /* false = niente pennellata                        */
var BRUSH_ALWAYS = false; /* true = attivo anche a menu chiuso, su tutta la pagina */
var BRUSH_R      = 0.0042;/* raggio dello splat. E’ exp(-d²/r), quindi il raggio vero
                             e’ ~sqrt(r): 0.0042 ≈ 6% dell’altezza. Alzalo poco per volta. */
var BRUSH_AMT    = 0.36;  /* colorante per splat: piu’ alto = pennellata piu’ larga e densa */
var BRUSH_STEP   = 0.011; /* passo lungo il tratto: piu’ basso = tratto piu’ continuo */
var BRUSH_PULL   = 0.40;  /* quanta velocita’ della mano passa al fluido      */
var BRUSH_DRY    = 1.50;  /* dissipazione del colorante: piu’ alto = asciuga prima */
var BRUSH_GRAVITY= 0.34;  /* quanto cola. E’ qui che si vede il non newtoniano:
                             il denso scende, il velo resta sospeso.          */
var BRUSH_TINT   = [1.0,0.985,0.96]; /* su carta bianca l’inversione da’ nero-inchiostro */
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

/* ============================== LA BARRA ================================== */
var bar = el('div','capehdr-bar is-boot');
bar.setAttribute('role','banner');

var mark = el('a','capehdr-bar__mark',WORDMARK);
mark.href = HOME_URL;

var btn = el('button','capehdr-bar__btn');
btn.type = 'button';
btn.setAttribute('aria-expanded','false');
btn.setAttribute('aria-controls','capehdr-panel');
var label = el('span','capehdr-bar__label');
label.appendChild(el('span',null,OPEN_TXT));
var glyph = el('span','capehdr-bar__glyph');
glyph.setAttribute('aria-hidden','true');
glyph.appendChild(el('i')); glyph.appendChild(el('i'));
btn.appendChild(label); btn.appendChild(glyph);

var right = el('div','capehdr-bar__right');
var bag = null;
if(BAG_ON){
  bag = el('a','capehdr-bar__bag');
  bag.href = BAG_HREF;
  bag.appendChild(el('span',null,BAG_LABEL));
  var bagN = el('span','capehdr-bar__count',String(BAG_COUNT));
  bag.appendChild(bagN);
  right.appendChild(bag);
}
right.appendChild(btn);
bar.appendChild(mark); bar.appendChild(right);

/* ============================== IL PANNELLO =============================== */
var panel = el('div','capehdr-panel');
panel.id = 'capehdr-panel';
panel.setAttribute('role','dialog');
panel.setAttribute('aria-modal','true');
panel.setAttribute('aria-label','Menu');
panel.tabIndex = -1;

var grid = el('div','capehdr-grid');

/* colonna sinistra: la nota */
var colL = el('div','capehdr-col');
colL.appendChild(el('div','capehdr-lab',NOTE_TITLE));
colL.appendChild(el('div','capehdr-rule'));
colL.appendChild(el('p','capehdr-note',NOTE_TEXT));

/* centro: l’indice */
var colC = el('div','capehdr-col');
var list = el('ul','capehdr-index');
var linkEls = [];
var hrs = [];
INDEX.forEach(function(it, ix){
  var li = el('li','capehdr-item');
  var hr = el('i','capehdr-hr'); li.appendChild(hr); hrs.push(hr);
  if(ix === INDEX.length - 1){
    var hr2 = el('i','capehdr-hr capehdr-hr--b'); li.appendChild(hr2); hrs.push(hr2);
  }
  var a  = el('a','capehdr-link');
  a.href = it.href;
  var nm = el('span','capehdr-name',it.name);
  var ds = el('span','capehdr-desc',it.desc || '');
  a.appendChild(nm); a.appendChild(ds);
  li.appendChild(a); list.appendChild(li);
  linkEls.push({ a:a, name:nm, desc:ds });
});
colC.appendChild(list);

/* colonna destra: la sala e l’invito */
var colR = el('div','capehdr-col');
colR.appendChild(el('div','capehdr-lab',SIDE_TITLE));
colR.appendChild(el('div','capehdr-rule'));
var sub = el('ul','capehdr-sub');
SIDE.forEach(function(s){
  var li = el('li');
  var a  = el('a'); a.href = s.href;
  a.appendChild(el('span','capehdr-sub__n', s.name));
  if(s.meta) a.appendChild(el('span','capehdr-sub__y', s.meta));
  li.appendChild(a); sub.appendChild(li);
});
colR.appendChild(sub);
var cta = el('a','capehdr-cta',CTA);
cta.href = CTA_HREF;
colR.appendChild(cta);

/* piede */
var foot = el('div','capehdr-foot');
var footHr = el('i','capehdr-hr'); foot.appendChild(footHr); hrs.push(footHr);
foot.appendChild(el('span',null,FOOT_L));
foot.appendChild(el('span',null,FOOT_R));

grid.appendChild(colL); grid.appendChild(colC); grid.appendChild(colR);
grid.appendChild(foot);
panel.appendChild(grid);

/* ======================== I DUE STRATI DI INCHIOSTRO ====================== */
var veil  = d.createElement('canvas'); veil.className  = 'capehdr-veil';  veil.setAttribute('aria-hidden','true');
var brush = d.createElement('canvas'); brush.className = 'capehdr-brush'; brush.setAttribute('aria-hidden','true');
var fold  = el('div','capehdr-fold'); fold.setAttribute('aria-hidden','true');
fold.appendChild(el('i')); fold.appendChild(el('i'));
var seam  = el('div','capehdr-seam'); seam.setAttribute('aria-hidden','true');

/* Figli DIRETTI del body: e’ l’unico modo perche’ mix-blend-mode:difference
   veda tutta la pagina sotto di se’ (un contenitore con z-index farebbe da
   scatola chiusa e il pennello invertirebbe solo se stesso). */
function mount(){
  d.body.appendChild(veil);
  d.body.appendChild(fold);
  d.body.appendChild(panel);
  d.body.appendChild(seam);
  d.body.appendChild(bar);
  d.body.appendChild(brush);
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      bar.classList.remove('is-boot');
      bar.classList.add('is-in');
      shown = true;
    });
  });
}

/* ==========================================================================
   1 · LA BARRA CHE VA E VIENE
   Ferma in cima -> visibile. Scendi -> si ritira. Risali -> torna.
   A menu aperto resta ferma dov’e’: e’ l’ancora di tutta la cosa.
   ========================================================================== */
var shown = false, lastY = 0, ticking = false, open = false;

function show(){ if(!shown){ shown = true;  bar.classList.add('is-in'); } }
function hide(){ if(shown){  shown = false; bar.classList.remove('is-in'); } }

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
    if(TONE_PROBE && !open) probe(y);
  });
}

/* ----- la barra legge cosa le passa sotto ---------------------------------
   Guarda tre punti appena sotto il proprio bordo, risale il DOM fino al primo
   sfondo vero e ne misura la luminosita’. Sotto foto e video non puo’ leggere
   i pixel: usa l’etichetta data-nav-tone della sezione, o MEDIA_TONE.       */
var tone = 0, toneTarget = 0, lastProbe = 0;

function rgbOf(str){
  var m = /rgba?\(([^)]+)\)/.exec(str || '');
  if(!m) return null;
  var p = m[1].split(',').map(parseFloat);
  return { r:p[0], g:p[1], b:p[2], a:(p.length > 3 ? p[3] : 1) };
}

function toneAt(x, y){
  var node = d.elementFromPoint(x, y);
  while(node && node !== d.documentElement){
    if(node.hasAttribute && node.hasAttribute('data-nav-tone'))
      return node.getAttribute('data-nav-tone') === 'light' ? 1 : 0;
    var cs = getComputedStyle(node);
    if(node.tagName === 'VIDEO' || node.tagName === 'IMG' ||
       (cs.backgroundImage && cs.backgroundImage !== 'none'))
      return MEDIA_TONE === 'light' ? 1 : 0;
    var c = rgbOf(cs.backgroundColor);
    if(c && c.a > 0.15){
      var lum = (0.2126*c.r + 0.7152*c.g + 0.0722*c.b) / 255;
      return Math.max(0, Math.min(1, (lum - 0.30) / 0.34));
    }
    node = node.parentElement;
  }
  return 1;                                   /* niente sfondo = carta bianca */
}

function probe(){
  var now = (window.performance && performance.now) ? performance.now() : Date.now();
  if(now - lastProbe < 180) return;
  lastProbe = now;
  var y = bar.getBoundingClientRect().bottom + 8;
  if(y < 0 || y > window.innerHeight) return;
  var w = window.innerWidth;
  toneTarget = (toneAt(w*0.14, y) + toneAt(w*0.5, y) + toneAt(w*0.86, y)) / 3;
}

function paintBar(){
  var a  = A_ON_DARK + (A_ON_LIGHT - A_ON_DARK) * tone;
  var t0 = TINT_DARK, t1 = TINT_LIGHT;
  var r = Math.round(t0[0] + (t1[0]-t0[0])*tone),
      g = Math.round(t0[1] + (t1[1]-t0[1])*tone),
      b = Math.round(t0[2] + (t1[2]-t0[2])*tone);
  var s = bar.style;
  s.setProperty('--ch-bar-bg',  'rgba('+r+','+g+','+b+','+a.toFixed(3)+')');
  s.setProperty('--ch-bar-line','rgba(241,236,226,'+(0.10 + 0.09*tone).toFixed(3)+')');
  s.setProperty('--ch-bar-ink', 'rgba(241,236,226,'+(0.86 + 0.14*tone).toFixed(3)+')');
}

/* ==========================================================================
   2 · IL BOTTONE: MENU -> CLOSE, lettera per lettera
   ========================================================================== */
function swapLabel(text){
  var old = label.firstElementChild;
  var neu = el('span');
  for(var i = 0; i < text.length; i++) neu.appendChild(el('span', null, text[i]));
  neu.style.position = 'absolute'; neu.style.left = '0'; neu.style.top = '0';
  label.appendChild(neu);
  label.style.width = ''; label.style.width = Math.max(old.offsetWidth, neu.offsetWidth) + 'px';

  if(REDUCED){ label.removeChild(old); neu.style.position = 'static'; return; }

  var kids = neu.children, i2;
  for(i2 = 0; i2 < kids.length; i2++){
    kids[i2].animate([{transform:'translateY(105%)'},{transform:'translateY(0)'}],
      { duration:420, delay:i2*22, easing:'cubic-bezier(.16,1,.3,1)', fill:'both' });
  }
  old.animate([{transform:'translateY(0)'},{transform:'translateY(-105%)'}],
    { duration:320, easing:'cubic-bezier(.76,0,.24,1)', fill:'both' })
    .onfinish = function(){
      if(old.parentNode) label.removeChild(old);
      neu.style.position = 'static';
    };
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
  'void main(){ float Y = vUv.y*2.4;\n' +
  '  float nL = 0.55*n11(Y*3.1 + uTime*0.07) + 0.30*n11(Y*7.0 - uTime*0.05) + 0.15*n11(Y*13.0);\n' +
  '  float nR = 0.55*n11(Y*3.1 + 41.0 - uTime*0.06) + 0.30*n11(Y*7.0 + 17.0 + uTime*0.04) + 0.15*n11(Y*13.0 + 5.0);\n' +
  '  float lipL = uP*uAdv + (nL-0.5)*uThick*2.0;\n' +
  '  float lipR = 1.0 - (uP*uAdv + (nR-0.5)*uThick*2.0);\n' +
  '  float dL = (vUv.x - lipL)/uThick, dR = (vUv.x - lipR)/uThick;\n' +
  '  float runL = exp(-dL*dL), runR = exp(-dR*dR);\n' +
  '  float resv = smoothstep(lipL, lipL-0.03, vUv.x) + smoothstep(lipR, lipR+0.03, vUv.x);\n' +
  '  vec3 prev = texture(uTarget,vUv).xyz;\n' +
  '  if(uMode < 0.5) fragColor = vec4(prev + uValue*((runL+runR)*1.35 + resv*0.55), 1.);\n' +
  '  else fragColor = vec4(prev.x + (runL - runR)*uPush, prev.y, 0., 1.); }';

/* Il velo: carta. Le macchie del fluido corrono avanti, il fronte pieno le
   rincorre e chiude. Il fronte garantisce la copertura, il fluido la forma. */
var PAPER = HEAD + RND + 'uniform sampler2D uDye; uniform vec3 uCol;\n' +
  'uniform float uInkK, uP, uTime, uAdv, uRes;\n' +
  'void main(){ float c = texture(uDye, vUv).x;\n' +
  '  float body = 1. - exp(-uInkK*c);\n' +
  '  float blob = smoothstep(0.45, 0.58, body);\n' +
  '  float Y = vUv.y*2.4;\n' +
  '  float amp = 0.055*sin(3.14159265*clamp(uP,0.,1.));\n' +
  '  float wL = (0.6*n11(Y*3.4 + uTime*0.08) + 0.4*n11(Y*11.0) - 0.5)*amp;\n' +
  '  float wR = (0.6*n11(Y*3.4 + 29.0 - uTime*0.07) + 0.4*n11(Y*11.0 + 7.0) - 0.5)*amp;\n' +
  '  float eL = uP*uAdv + wL, eR = 1. - (uP*uAdv + wR);\n' +
  '  float fe = 0.002 + amp*0.05;\n' +
  '  float front = max(smoothstep(eL, eL-fe, vUv.x), smoothstep(eR, eR+fe, vUv.x));\n' +
  '  float a = clamp(max(blob, front), 0., 1.);\n' +
  '  vec3 col = mix(uCol, uCol*0.992, 1.-vUv.y);\n' +
  '  col += (fract(sin(dot(vUv*uRes + fract(uTime),vec2(12.9898,78.233)))*43758.5453)-0.5)*0.010;\n' +
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
    var cw = Math.max(1, window.innerWidth), ch = Math.max(1, window.innerHeight);
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
      gravity:0.30, curl:0.10, dyeDiss:FLOOD_DISS, velDiss:2.60, ambient:0.004, dragX:2.6 });
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
  var p = 0, from = 0, to = 0, t0 = 0, dur = 1, moving = false, arrive = null;
  var want = 0, have = 0;                              /* opacita’ del pennello */
  var pt = { x:0.5, y:0.5, lx:0.5, ly:0.5, seen:false, had:false };
  var veilLive = false;

  function onMove(e){
    pt.x = e.clientX/window.innerWidth;
    pt.y = 1 - e.clientY/window.innerHeight;
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
      p = from + (to - from)*easeIO(t);
      if(t >= 1){ moving = false; p = to; if(arrive){ var f = arrive; arrive = null; f(); } }
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
        if(feeding) V.edge(1/60, p, FLOOD_AMT, FLOOD_PUSH, FLOOD_THICK, FLOOD_ADV);
        V.P.dyeDiss = (to < 0.5 ? 6.0 : FLOOD_DISS);   /* in chiusura l’inchiostro rientra */
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
    });
    if(B && have > 0.004) B.render(function(u, gl){
      gl.uniform3f(u.uTint, BRUSH_TINT[0], BRUSH_TINT[1], BRUSH_TINT[2]);
      gl.uniform1f(u.uGlobal, have);
    });

    if(!feeding && veilLive && !moving){                /* arrivato: la fisica si ferma */
      veilLive = false;
      if(p < 0.0005 && V){ V.wipe(); veil.style.display = 'none'; }
    }
    if(B && have <= 0.004 && want === 0){ brush.style.display = 'none'; pt.had = false; }

    if(moving || veilLive || have > 0.004) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  function kick(){ if(!raf){ last = 0; raf = requestAnimationFrame(frame); } }

  return {
    to: function(target, ms, done){
      from = p; to = target; dur = Math.max(1, ms); t0 = nowMs();
      moving = true; arrive = done || null;
      if(target > 0.5) veil.style.display = 'block';
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

function sideNodes(){
  return [colL.children[0], colL.children[2], colR.children[0]]
    .concat(Array.prototype.slice.call(sub.children))
    .concat([foot.children[1], foot.children[2]]);
}

/* Il pannello e' in pagina da subito (serve il layout), ma il contenuto no:
   va nascosto nell'istante in cui si apre, se no si vede tutto per il tempo
   che l'inchiostro ci mette ad arrivare. Prima si arma, poi si compone. */
var ruleAnims = [];
function armRule(node){
  node.style.transform = 'scaleX(0)';
}
function drawRule(node, delay){
  var a = node.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],
    { duration:700, delay:delay, easing:'cubic-bezier(.16,1,.3,1)', fill:'both' });
  a.onfinish = function(){ node.style.transform = 'none'; try{ a.cancel(); }catch(e){} };
  ruleAnims.push(a);
}

function armIn(){
  var i, side = sideNodes();
  for(i = 0; i < linkEls.length; i++){
    arm(linkEls[i].name, '-112%', '0');
    arm(linkEls[i].desc,  '112%', '0');
  }
  for(i = 0; i < side.length; i++) arm(side[i], '0', '112%');
  ruleAnims.forEach(function(a){ try{ a.cancel(); }catch(e){} });
  ruleAnims = [];
  armRule(colL.children[1]); armRule(colR.children[1]);
  for(i = 0; i < hrs.length; i++) armRule(hrs[i]);
  cta.style.opacity = '0';                 /* il bottone e' un oggetto: non si avvolge */
  cta.style.transform = 'translate3d(0,16px,0)';
}
function arm(node, tx, ty){
  var sl = wrap(node);
  node.style.overflow = 'hidden';
  sl.style.transform = 'translate3d('+tx+','+ty+',0)';
  sl.style.opacity = '0';
}

/* Prima la pagina si riga, poi ci si scrive sopra. */
function revealIn(){
  var i;
  for(i = 0; i < hrs.length; i++) drawRule(hrs[i], i*44);
  drawRule(colL.children[1], 60);
  drawRule(colR.children[1], 150);
  for(i = 0; i < linkEls.length; i++){
    enter(linkEls[i].name, '-112%', '0', 150 + i*STAGGER);
    enter(linkEls[i].desc,  '112%', '0', 150 + i*STAGGER + 90);
  }
  var side = sideNodes();
  for(i = 0; i < side.length; i++) enter(side[i], '0', '112%', 210 + i*58);
  riseEl(cta, 210 + side.length*58);
}

/* il bottone sale intero: qualunque involucro gli cambierebbe la scatola */
function riseEl(node, delay){
  if(REDUCED){ node.style.opacity = '1'; node.style.transform = 'none'; return; }
  var a = node.animate(
    [{ transform:'translate3d(0,16px,0)', opacity:0 },
     { transform:'translate3d(0,0,0)',    opacity:1 }],
    { duration:RISE_MS, delay:delay, easing:'cubic-bezier(.16,1,.3,1)', fill:'both' });
  a.onfinish = function(){ node.style.opacity = '1'; node.style.transform = 'none'; try{ a.cancel(); }catch(e){} };
}

function revealOut(){
  var i, n = linkEls.length;
  for(i = 0; i < n; i++){
    leave(linkEls[n-1-i].name, '-70%', '0', i*26);
    leave(linkEls[n-1-i].desc,  '70%', '0', i*26);
  }
  var side = sideNodes();
  for(i = 0; i < side.length; i++) leave(side[i], '0', '70%', i*20);
  if(!REDUCED) cta.animate([{opacity:1},{opacity:0}],
    { duration:200, easing:'cubic-bezier(.76,0,.24,1)', fill:'both' });
}

/* ------------------------------------------------------------------ APRI -- */
function openMenu(){
  if(open || busy) return;
  open = true; busy = true;
  clearTimers();

  panel.classList.add('is-on');
  armIn();                                  /* prima si arma, poi si compone */
  bar.classList.add('is-open');
  btn.setAttribute('aria-expanded','true');
  swapLabel(CLOSE_TXT);
  lock(true);
  paintOpenBar();

  var flood = REDUCED ? 1 : FLOOD_MS;

  if(canGL && !glOn){ Ink.build(); glOn = !!Ink.veil(); }
  if(glOn){
    Eng.to(1, flood);
  }else{
    fold.style.display = 'block';
    fold.style.setProperty('--ch-fold', flood + 'ms');
    void fold.offsetWidth;                            /* forza il primo stato */
    fold.classList.add('is-on');
  }

  at(flood*SEAM_AT,      seamFlash);
  at(flood*SEAM_AT + 30, function(){ revealIn(); busy = false; focusFirst(); });
  if(BRUSH && HOVERS && glOn) at(flood*SEAM_AT + 140, function(){ Eng.brushOn(); });
}

/* ----------------------------------------------------------------- CHIUDI -- */
function closeMenu(){
  if(!open || busy) return;
  open = false; busy = true;
  clearTimers();

  btn.setAttribute('aria-expanded','false');
  swapLabel(OPEN_TXT);
  if(!BRUSH_ALWAYS) Eng.brushOff();
  revealOut();

  var back = REDUCED ? 1 : RETREAT_MS;

  at(230, function(){
    if(glOn) Eng.to(0, back);
    else{
      fold.style.setProperty('--ch-fold', back + 'ms');
      fold.classList.remove('is-on');
      at(back + 30, function(){ fold.style.display = 'none'; });
    }
  });

  at(230 + back + 60, function(){
    panel.classList.remove('is-on');
    bar.classList.remove('is-open');
    busy = false;
    paintBar();
    try{ btn.focus({preventScroll:true}); }catch(e){ btn.focus(); }
  });
}

function toggle(){ open ? closeMenu() : openMenu(); }

function paintOpenBar(){                 /* su carta bianca si scrive in inchiostro */
  bar.style.setProperty('--ch-bar-ink','rgba(37,42,34,.92)');
}

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
  f = f.concat([btn]);
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

  lastY = window.pageYOffset || 0;
  window.addEventListener('scroll', onScroll, {passive:true});
  if(TONE_PROBE){
    probe(); tone = toneTarget; paintBar();
    (function tick(){
      if(!open){ probe(); var dz = toneTarget - tone; if(Math.abs(dz) > 0.002){ tone += dz*0.10; paintBar(); } }
      setTimeout(function(){ requestAnimationFrame(tick); }, 120);
    })();
  }

  var rt;
  window.addEventListener('resize', function(){
    clearTimeout(rt);
    rt = setTimeout(function(){
      canGL = !REDUCED && window.innerWidth >= WEBGL_MIN_W;
      Eng.resize();
      if(!open) probe();
    }, 180);
  }, {passive:true});

  d.addEventListener('visibilitychange', function(){
    if(d.hidden) Eng.brushOff();
    else if(open && BRUSH && HOVERS && glOn) Eng.brushOn();
  });

  if(BRUSH_ALWAYS && BRUSH && HOVERS && canGL){ Ink.build(); glOn = !!Ink.veil(); Eng.brushOn(); }

  /* Da fuori: capeHeader.bag(3) aggiorna il numero nel carrello. */
  window.capeHeader = {
    open:openMenu, close:closeMenu, toggle:toggle,
    bag:function(n){ if(bag) bag.lastChild.textContent = String(n); }
  };
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
