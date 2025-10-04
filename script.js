/* script.js - versión corregida y consolidada para Chatbot Casa Colima
   Reemplaza completamente tu script.js con esto.
*/

/* ---------- Config / Keywords ---------- */
const KEYWORDS = {
  ramaA: ['hijo','hija','hermano','hermana','amigo','amiga','pareja','esposo','esposa','familiar','conocido','ayuda para alguien','apoyo para alguien'],
  ramaB: ['quiero dejar','recaí','recaída','recaídas','necesito ayuda','no puedo controlar','consumo','cristal','droga','alcohol','marihuana','cocaína','adicción','dependiente','problema mío','estoy mal'],
  ramaC: ['terapia','terapias','terapia individual','terapia grupal','consulta','psiquiatra','psiquiatría','tratamiento','tratamiento ambulatorio','tratamiento residencial','programa','recaídas','antidoping'],
  ramaD: ['contacto','teléfono','tel','celular','número','dirección','ubicación','horario','correo','mail','cita','contacto rápido']
};

const AVATAR_FILES = {
  idle: 'assets/avatar.png',
  thinking: 'assets/avatar-thinking.png',
  happyBulb: 'assets/avatar-happy-bulb.png'
};

/* ---------- DOM refs ---------- */
const msgs = document.getElementById('msgs');
const input = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const suggestBtn = document.getElementById('suggestBtn');
const suggestPanel = document.getElementById('suggestPanel');
const suggestChips = document.getElementById('suggestChips');
const avatarImg = document.getElementById('avatarImg');
const quickReplies = document.getElementById('quickReplies');

/* ---------- State ---------- */
const state = {
  subject: 'self',
  consumes: null,
  substances: [],
  frequency: null,
  emotional: null,
  diagnosis: null
};

/* ---------- Helpers UI ---------- */
function scrollBottom(){ if(msgs) msgs.scrollTop = msgs.scrollHeight; }
function clearMessages(){ if(msgs) msgs.innerHTML = ''; }
function appendBot(html, opts = {}){
  if(!msgs) return;
  const bubble = document.createElement('div');
  bubble.className = 'bubble bot';
  bubble.innerHTML = html;
  if (opts.reaction) {
    const r = document.createElement('span');
    r.className='reaction-pop';
    r.textContent = opts.reaction;
    bubble.appendChild(r);
  }
  msgs.appendChild(bubble);
  scrollBottom();
}
function appendUser(text){
  if(!msgs) return;
  const bubble = document.createElement('div');
  bubble.className = 'bubble user';
  bubble.textContent = text;
  msgs.appendChild(bubble);
  scrollBottom();
}

/* ---------- Avatar & typing ---------- */
let _avatarRestoreTimer = null;
function reactWithImage(filePath, duration = 900){
  if(!avatarImg) return Promise.resolve();
  const orig = avatarImg.getAttribute('src') || avatarImg.src || AVATAR_FILES.idle;
  try { avatarImg.style.opacity = '0.14'; } catch(e){}
  if(_avatarRestoreTimer) { clearTimeout(_avatarRestoreTimer); _avatarRestoreTimer = null; }
  return new Promise(resolve=>{
    setTimeout(()=>{
      try {
        avatarImg.src = filePath;
        avatarImg.classList.remove('avatar-react-pop');
        void avatarImg.offsetWidth;
        avatarImg.classList.add('avatar-react-pop');
        avatarImg.style.opacity = '1';
      } catch(e){}
    }, 120);
    _avatarRestoreTimer = setTimeout(()=>{
      try { if(orig) avatarImg.setAttribute('src', orig); avatarImg.classList.remove('avatar-react-pop'); } catch(e){}
      _avatarRestoreTimer = null;
      resolve();
    }, Math.max(700, duration));
  });
}

function createThinkingElement(){
  const wrap = document.createElement('div');
  wrap.className = 'bot-row';
  const thinking = document.createElement('div');
  thinking.className = 'thinking-bubble';
  const dots = document.createElement('span');
  dots.className = 'dots';
  dots.innerHTML = '<span></span><span></span><span></span>';
  thinking.appendChild(dots);
  wrap.appendChild(thinking);
  return wrap;
}

let _typingTimer = null;
function showTyping(ms = 800){
  return new Promise(resolve=>{
    if(!msgs) { resolve(); return; }
    const existing = msgs.querySelector('.bot-row');
    if(existing) existing.remove();
    const typingEl = createThinkingElement();
    msgs.appendChild(typingEl);
    msgs.scrollTop = msgs.scrollHeight;
    if(typeof reactWithImage === 'function' && AVATAR_FILES && AVATAR_FILES.thinking){
      try { reactWithImage(AVATAR_FILES.thinking, ms); } catch(e) {}
    }
    clearTimeout(_typingTimer);
    _typingTimer = setTimeout(()=>{ typingEl.remove(); resolve(); }, ms);
  });
}

/* ---------- Suggestions ---------- */
const DEFAULT_KEYWORDS = ['tratamiento','terapia','recaídas','consumo de sustancias','contacto'];
function renderSuggestionChips(){
  if(!suggestChips) return;
  const keywordList = [].concat(...Object.values(KEYWORDS));
  const candidates = Array.from(new Set(DEFAULT_KEYWORDS.concat(keywordList).map(k => k.toString())));
  const toShow = candidates.slice(0, 12);
  suggestChips.innerHTML = '';
  toShow.forEach(k=>{
    const chip = document.createElement('button');
    chip.className = 'suggest-chip';
    chip.textContent = k;
    chip.addEventListener('click', ()=>{ appendUser(k); showTyping(700).then(()=> handleKeyword(k)); });
    suggestChips.appendChild(chip);
  });
}

/* ---------- Quick replies ---------- */
function showQuickReplies(buttons = []){
  if(!quickReplies) return;
  quickReplies.innerHTML = '';
  if(!buttons || !buttons.length){ quickReplies.setAttribute('aria-hidden','true'); return; }
  quickReplies.setAttribute('aria-hidden','false');
  buttons.forEach(b=>{
    const btn = document.createElement('button');
    btn.className = 'qr-btn ' + (b.className || '');
    btn.textContent = b.text;
    btn.addEventListener('click', ()=>{ b.onClick && b.onClick(); });
    quickReplies.appendChild(btn);
  });
}

/* ---------- Keyword detection ---------- */
function findKeywordCategory(text){
  if(!text) return null;
  const t = text.toLowerCase();
  for(const [cat, arr] of Object.entries(KEYWORDS)){
    for(const kw of arr){
      if(t.includes(kw.toLowerCase())) return cat;
    }
  }
  return null;
}

/* ---------- Main conversation flow ---------- */
async function startConversation(){
  clearMessages();
  state.subject = 'self'; state.consumes = null; state.substances = []; state.frequency = null; state.emotional = null; state.diagnosis = null;
  appendBot('<strong>Hola — ¿en qué te puedo ayudar hoy?</strong>');
  await delay(600);
  askQuestionConsume();
}
function delay(ms){ return new Promise(res => setTimeout(res, ms)); }

/* Q1 consume */
function askQuestionConsume(){
  showTyping(800).then(()=>{
    appendBot('¿Consumes alcohol u otras sustancias actualmente?');
    showQuickReplies([
      { text: 'Sí', className: 'positive', onClick: ()=> answerConsume(true) },
      { text: 'No', className: 'negative', onClick: ()=> answerConsume(false) }
    ]);
  });
}
function answerConsume(val){ state.consumes = val; appendUser(val ? 'Sí':'No'); showQuickReplies([]); }

/* ---------- Keyword response ---------- */
function handleKeyword(keyword){
  const cat = findKeywordCategory(keyword) || 'ramaC';
  showTyping(900).then(()=> reactWithImage(AVATAR_FILES.happyBulb,900).then(()=>{
    if(cat === 'ramaA') appendBot('Buscas ayuda para otra persona. ¿Quieres orientación o información sobre tratamientos?');
    else if(cat === 'ramaB') appendBot('Gracias por compartir. Podemos explorar opciones de apoyo y tratamiento.');
    else if(cat === 'ramaC') appendBot('Ofrecemos terapia individual, grupal y consultas psiquiátricas.');
    else appendBot('Te puedo dar teléfono, WhatsApp o un formulario para más información.');
    showQuickReplies([
      { text: '📅 Agendar', className: 'positive', onClick: ()=> ctaAction('agendar') },
      { text: '💬 WhatsApp', className: '', onClick: ()=> ctaAction('whatsapp') },
      { text: '📞 Llamar', className: 'negative', onClick: ()=> ctaAction('llamar') }
    ]);
  }));
}

/* CTA actions */
function ctaAction(action){
  showQuickReplies([]);
  if(action==='agendar') { appendBot('Te llevamos a la página de agendamiento'); window.open('https://tu-sitio-agenda.example.com','_blank'); }
  else if(action==='llamar') { appendBot('Número: +52 55 1234 5678'); window.location.href='tel:+525512345678'; }
  else if(action==='whatsapp'){ appendBot('Conectando a WhatsApp...'); window.open('https://wa.me/52XXXXXXXXXXX','_blank'); }
}

/* Send / Reset handlers */
if(sendBtn){
  sendBtn.addEventListener('click', ()=>{
    const val = (input && input.value)? input.value.trim():'';
    if(!val) return;
    appendUser(val);
    if(input) input.value='';
    const cat = findKeywordCategory(val);
    if(cat) showTyping(900).then(()=> handleKeyword(val));
    else showTyping(900).then(()=> appendBot('Gracias. Puedes seleccionar una opción o escribir una palabra clave.'));
  });
}
if(resetBtn) resetBtn.addEventListener('click', ()=> startConversation());
if(input) input.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); sendBtn && sendBtn.click(); }});

/* Init */
document.addEventListener('DOMContentLoaded', ()=>{
  renderSuggestionChips();
  startConversation();
  if(suggestBtn && suggestPanel){
    suggestBtn.addEventListener('click', ()=>{
      const shown = suggestPanel.classList.contains('show');
      if(shown){ suggestPanel.classList.remove('show'); suggestBtn.setAttribute('aria-pressed','false'); }
      else { renderSuggestionChips(); suggestPanel.classList.add('show'); suggestBtn.setAttribute('aria-pressed','true'); }
    });
    suggestPanel.classList.remove('show');
    suggestBtn && suggestBtn.setAttribute('aria-pressed','false');
  }
});
