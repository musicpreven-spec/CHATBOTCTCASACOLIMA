/* script.js - manejo de chat + keywords + avatar thinking/happy-bulb swaps */

/* --- Config --- */
const KEYWORDS = {
  ramaA: ['hijo','hija','hermano','hermana','amigo','amiga','pareja','esposo','esposa','familiar','conocido','ayuda para alguien','apoyo para alguien'],
  ramaB: ['quiero dejar','recaí','recaída','recaídas','necesito ayuda','no puedo controlar','consumo','cristal','droga','alcohol','marihuana','cocaína','adicción','dependiente','problema mío','estoy mal'],
  ramaC: ['terapia','terapias','terapia individual','terapia grupal','consulta','psiquiatra','psiquiatría','tratamiento','tratamiento ambulatorio','tratamiento residencial','programa','recaídas','antidoping'],
  ramaD: ['contacto','teléfono','tel','celular','número','dirección','ubicación','horario','correo','mail','cita','contacto rápido']
};

/* DOM refs */
const msgs = document.getElementById('msgs');
const input = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const suggestBtn = document.getElementById('suggestBtn');
const suggestPanel = document.getElementById('suggestPanel');
const suggestChips = document.getElementById('suggestChips');
const avatarImg = document.getElementById('avatarImg');

/* Avatar files (nombres exactos en assets/) */
const AVATAR_FILES = {
  idle: 'assets/avatar.png',
  thinking: 'assets/avatar-thinking.png',
  happyBulb: 'assets/avatar-happy-bulb.png'
};

/* ---------- Utils UI ---------- */
function scrollBottom(){ msgs.scrollTop = msgs.scrollHeight; }
function clearMessages(){ msgs.innerHTML = ''; }
function appendBot(html, opts = {}) {
  const bubble = document.createElement('div');
  bubble.className = 'bubble bot';
  bubble.innerHTML = html;
  if(opts.reaction){ const r = document.createElement('span'); r.className='reaction-pop'; r.textContent = opts.reaction; bubble.appendChild(r); }
  msgs.appendChild(bubble);
  scrollBottom();
}
function appendUser(text){
  const b = document.createElement('div'); b.className = 'bubble user'; b.textContent = text; msgs.appendChild(b); scrollBottom();
}
function showThinkingBubble(){
  const wrap = document.createElement('div');
  wrap.className = 'bot-row';
  const thinking = document.createElement('div'); thinking.className = 'thinking-bubble';
  const dots = document.createElement('span'); dots.className = 'dots'; dots.innerHTML = '<span></span><span></span><span></span>';
  thinking.appendChild(dots); wrap.appendChild(thinking); msgs.appendChild(wrap); scrollBottom();
  return wrap;
}

/* ---------- Avatar reaction helpers ---------- */
let _avatarRestoreTimer = null;
function setAvatarSrc(src) {
  if(!avatarImg) return;
  avatarImg.src = src;
}
function reactWithImage(filePath, duration = 900) {
  if(!avatarImg) return Promise.resolve();
  const origSrc = avatarImg.getAttribute('src') || avatarImg.src;
  // crossfade
  avatarImg.style.opacity = '0.14';
  if(_avatarRestoreTimer) { clearTimeout(_avatarRestoreTimer); _avatarRestoreTimer = null; }
  return new Promise(resolve => {
    setTimeout(()=> {
      avatarImg.src = filePath;
      avatarImg.classList.remove('avatar-react-pop');
      void avatarImg.offsetWidth;
      avatarImg.classList.add('avatar-react-pop');
      avatarImg.style.opacity = '1';
    }, 140);
    _avatarRestoreTimer = setTimeout(()=> {
      // restore
      avatarImg.setAttribute('src', origSrc);
      avatarImg.classList.remove('avatar-react-pop');
      _avatarRestoreTimer = null;
      resolve();
    }, Math.max(700, duration));
  });
}

/* Helper that shows thinking image for ms or while promise runs */
function withThinkingImage(workerOrMs = 900) {
  const thinkingFile = AVATAR_FILES.thinking;
  if(typeof workerOrMs === 'number') {
    return reactWithImage(thinkingFile, workerOrMs);
  } else if(typeof workerOrMs === 'function') {
    // assume returns promise
    const res = workerOrMs();
    if(res && typeof res.then === 'function') {
      // show thinking while promise pending
      reactWithImage(thinkingFile, 2000);
      return res;
    } else {
      return reactWithImage(thinkingFile, 900);
    }
  } else {
    return reactWithImage(thinkingFile, 900);
  }
}

/* ---------- Suggestions chips ---------- */
const DEFAULT_KEYWORDS = ['tratamiento','terapia','recaídas','consumo de sustancias','contacto'];
function renderSuggestionChips(){
  if(!suggestChips) return;
  suggestChips.innerHTML = '';
  DEFAULT_KEYWORDS.forEach(k => {
    const chip = document.createElement('button');
    chip.className = 'suggest-chip';
    chip.textContent = k;
    chip.addEventListener('click', ()=>{
      appendUser(k);
      // show thinking, then handle
      withThinkingImage(1000).then(()=> handleKeyword(k));
    });
    suggestChips.appendChild(chip);
  });
}

/* suggestions toggle */
if(suggestBtn){
  suggestBtn.addEventListener('click', ()=> {
    const shown = suggestPanel.classList.contains('show');
    if(shown){ suggestPanel.classList.remove('show'); suggestBtn.setAttribute('aria-pressed','false'); }
    else { suggestPanel.classList.add('show'); suggestBtn.setAttribute('aria-pressed','true'); renderSuggestionChips(); }
  });
}

/* ---------- Keyword detection ---------- */
function findKeywordCategory(text) {
  if(!text) return null;
  const t = text.toLowerCase();
  // check each category; return first match and its category name
  for(const [cat, arr] of Object.entries(KEYWORDS)) {
    for(const kw of arr) {
      if(t.includes(kw.toLowerCase())) return cat;
    }
  }
  return null;
}

/* ---------- Flow handlers ---------- */
function handleKeyword(keyword){
  // Determine category
  const cat = findKeywordCategory(keyword) || 'ramaC';
  // Show happy-bulb reaction and then answer
  reactWithImage(AVATAR_FILES.happyBulb, 900).then(()=>{
    // respond according to category
    if(cat === 'ramaA') {
      appendBot('Gracias por contarme. Entiendo tu preocupación. ¿Deseas orientación para cómo hablar con esa persona o prefieres información sobre tratamientos?', { reaction:'💙' });
      // here you could add quick reply buttons etc.
    } else if(cat === 'ramaB') {
      appendBot('Gracias por tu confianza. Puedo orientarte sobre opciones de apoyo: terapia individual, programas ambulatorios o tratamiento residencial. ¿Cuál te interesa?', { reaction:'🤝' });
    } else if(cat === 'ramaC') {
      appendBot('Tenemos terapias individuales y grupales, consultas psiquiátricas y programas especializados. ¿Quieres que te ayude a agendar una consulta?', { reaction:'🔎' });
    } else { // ramaD or fallback
      appendBot('Puedes comunicarte por teléfono, WhatsApp o llenar un formulario. ¿Qué prefieres?', { reaction:'📞' });
    }
  });
}

/* ---------- Send / Reset ---------- */
if(sendBtn){
  sendBtn.addEventListener('click', ()=> {
    const val = input.value.trim();
    if(!val) return;
    appendUser(val);
    input.value = '';
    const matchedCat = findKeywordCategory(val);
    if(matchedCat){
      // show thinking while processing and then handle
      withThinkingImage(1000).then(()=> handleKeyword(val));
    } else {
      // general reply path: thinking then generic ask
      withThinkingImage(900).then(()=> appendBot('Entiendo. ¿Quieres que busque por palabras clave o que te conecte con un especialista?'));
    }
  });
}

if(resetBtn){
  resetBtn.addEventListener('click', ()=> startConversation());
}

input.addEventListener('keydown', (e)=> { if(e.key === 'Enter'){ e.preventDefault(); sendBtn.click(); }});

/* ---------- Start conversation ---------- */
function startConversation(){
  clearMessages();
  appendBot('<strong>Hola — ¿en qué te puedo ayudar hoy?</strong>');
  if(suggestPanel) { suggestPanel.classList.remove('show'); suggestBtn.setAttribute('aria-pressed','false'); }
  renderSuggestionChips();
}

/* ---------- Avatar logs ---------- */
if(avatarImg){
  avatarImg.addEventListener('load', ()=> console.log('[avatar] loaded', avatarImg.currentSrc));
  avatarImg.addEventListener('error', ()=> console.warn('[avatar] failed to load', avatarImg.src));
}

/* init */
document.addEventListener('DOMContentLoaded', ()=> {
  startConversation();
});
