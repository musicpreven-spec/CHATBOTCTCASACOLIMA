/* script.js - frontend only: preloads optional variants, controls avatar animations and chat UI */

/* Avatar variant filenames we will try to detect (optional) */
const AVATAR_VARIANTS = {
  idle: 'assets/avatar.png',
  highres: 'assets/avatar@2x.png',      // optional (2x)
  smile: 'assets/avatar_smile.png',     // optional
  wink:  'assets/avatar_wink.png',      // optional
  nod:   'assets/avatar_nod.png'        // optional
};

const msgs = document.getElementById('msgs');
const input = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const avatarImg = document.getElementById('avatarImg');
const avatarWrap = document.getElementById('avatarWrap');
const eyelid = document.getElementById('eyelid');
const mouth = document.getElementById('mouth');

function scrollBottom(){ msgs.scrollTop = msgs.scrollHeight; }
function appendBot(html, opts = {}) {
  const bubble = document.createElement('div');
  bubble.className = 'bubble bot';
  bubble.innerHTML = html;
  if (opts.reaction) { const r = document.createElement('span'); r.className='reaction-pop'; r.textContent = opts.reaction; bubble.appendChild(r); }
  msgs.appendChild(bubble); scrollBottom();
}
function appendUser(text) {
  const bubble = document.createElement('div');
  bubble.className = 'bubble user';
  bubble.textContent = text;
  msgs.appendChild(bubble); scrollBottom();
}
function showThinking(){
  const wrap = document.createElement('div');
  wrap.className = 'bot-row';
  const thinking = document.createElement('div'); thinking.className = 'thinking-bubble';
  const dots = document.createElement('span'); dots.className='dots';
  dots.innerHTML = '<span></span><span></span><span></span>';
  thinking.appendChild(dots); wrap.appendChild(thinking); msgs.appendChild(wrap); scrollBottom();
  return wrap;
}

/* Preload optional avatars if present */
function preloadIfExists(src){
  return new Promise(resolve => {
    if(!src) return resolve(false);
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/* Manage avatar expressions: if variant exists, swap, otherwise use CSS effects */
const available = {}; // which variants exist
async function detectAvatars(){
  const keys = Object.keys(AVATAR_VARIANTS);
  for(const k of keys){
    const ok = await preloadIfExists(AVATAR_VARIANTS[k]);
    available[k] = ok;
    console.log('[avatar] variant', k, '->', ok ? 'OK' : 'missing');
  }
  // if highres exists, set srcset already handled by <img srcset> in HTML (browser picks it)
}

/* Blink implementation (works even without blink image) */
let blinkInterval = null;
function startAutoBlink(){
  stopAutoBlink();
  blinkInterval = setInterval(()=> doBlink(), 5000 + Math.random()*5000);
}
function stopAutoBlink(){ if(blinkInterval) clearInterval(blinkInterval); blinkInterval = null; }
function doBlink(duration = 120){
  // animate eyelid height to simulate blink
  eyelid.style.height = '96px';
  setTimeout(()=> eyelid.style.height = '0', duration);
}

/* set expression: name = 'smile'|'wink'|'nod'|'idle' */
let exprTimer = null;
function setExpression(name = 'idle', opts = {}){
  opts = Object.assign({ effect: 'none', duration: 900 }, opts);
  if(exprTimer) { clearTimeout(exprTimer); exprTimer = null; }
  // if we have an image variant, swap src and show briefly
  if(available[name]){
    avatarImg.style.opacity = '0.12';
    setTimeout(()=> {
      avatarImg.src = AVATAR_VARIANTS[name];
      avatarImg.style.opacity = '1';
    }, 140);
    // if want a temporary effect, revert to idle
    if(name !== 'idle'){
      exprTimer = setTimeout(()=> {
        if(available.idle) avatarImg.src = AVATAR_VARIANTS.idle;
      }, Math.max(700, opts.duration));
    }
  } else {
    // no image variant: use CSS effects: glow + scale + mouth opacity
    avatarWrap.classList.add('active');
    if(name === 'smile'){
      mouth.style.opacity = '1';
      mouth.style.transform = 'translateY(0) scale(1)';
      avatarImg.style.transform = 'scale(1.03) translateY(-4px)';
      setTimeout(()=> {
        mouth.style.opacity = '0';
        avatarImg.style.transform = '';
      }, opts.duration);
    } else if(name === 'wink'){
      // quick small tilt + blink
      avatarImg.style.transform = 'rotate(-6deg) translateY(-2px)';
      doBlink(80);
      setTimeout(()=> avatarImg.style.transform = '', 520);
    } else if(name === 'nod'){
      avatarImg.style.transform = 'translateY(4px)';
      setTimeout(()=> avatarImg.style.transform = '', 420);
    } else {
      // idle: nothing
      mouth.style.opacity = '0';
    }
  }
}

/* basic demo chat flow */
function botReplySimulated(text, opts = {}){
  setExpression('smile', { duration: 900 });
  const thinking = showThinking();
  const delay = 800 + Math.min(1400, text.length * 8);
  setTimeout(()=> {
    thinking.remove();
    appendBot(text, opts);
    setExpression('idle');
  }, delay);
}

/* startup: wire events and start */
async function start(){
  await detectAvatars();

  // if avatar image not present, fallback handled by <img onerror> in earlier code path
  // start idle bob animation
  avatarWrap.classList.add('idle');
  startAutoBlink();

  // initial greeting
  appendBot('<strong>Hola — soy el especialista de Casa Colima.</strong><br>¿En qué te puedo ayudar hoy?');
  const wrapper = document.createElement('div'); wrapper.style.marginTop='8px';
  const chips = document.createElement('div'); chips.className='quick-options';
  ['Problemas de adicción','Buscar apoyo','Contacto','Recursos inmediatos'].forEach(opt => {
    const b = document.createElement('button'); b.className='chip'; b.textContent = opt;
    b.onclick = ()=> {
      appendUser(opt);
      setExpression('nod', { duration: 700 });
      setTimeout(()=> botReplySimulated('Gracias. Un momento mientras te doy más información...'), 550);
    };
    chips.appendChild(b);
  });
  wrapper.appendChild(chips); msgs.appendChild(wrapper); scrollBottom();

  // events
  sendBtn.addEventListener('click', ()=> {
    const val = input.value.trim(); if(!val) return;
    appendUser(val); input.value='';
    setExpression('wink', { duration: 700 });
    const thinking = showThinking();
    setTimeout(()=> {
      thinking.remove();
      if(/adicci|droga|cristal|alcohol|heroína|cocaína/i.test(val)){
        appendBot('Gracias por compartir. ¿Hay riesgo físico inmediato? (si/no)', { reaction:'⚠️' });
        setExpression('smile', { duration: 900 });
      } else if (/gracias|ok|vale|perfecto/i.test(val)){
        appendBot('Me alegra ser de ayuda. ¿Deseas que reserve una sesión o te envío recursos?', { reaction:'😊' });
        setExpression('smile', { duration: 900 });
      } else {
        appendBot('Entiendo. ¿Deseas que te ofrezca recursos, un contacto o agende una llamada?');
        setExpression('idle');
      }
    }, 700 + Math.random()*600);
  });

  input.addEventListener('keydown', (e)=> { if(e.key === 'Enter'){ e.preventDefault(); sendBtn.click(); }});
}

/* ensure avatar image errors are visible in console */
document.addEventListener('DOMContentLoaded', ()=> {
  avatarImg.addEventListener('load', ()=> console.log('[avatar] loaded', avatarImg.src));
  avatarImg.addEventListener('error', ()=> {
    console.warn('[avatar] failed to load', avatarImg.src);
    // keep placeholder (img will show alt or previous)
  });
  start();
});
