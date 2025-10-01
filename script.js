/* script.js - Chatbot Casa Colima
   - cuestionario inicial (consume? / problemas emocionales?)
   - keyword detection (ramas)
   - avatar reaction with assets/avatar-thinking.png and avatar-happy-bulb.png
   - typing simulation (thinking bubble) para interacción realista
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
  consumes: null,     // true/false/null
  emotional: null,    // true/false/null (ansiedad/depresion/otros)
  stage: 'start'      // control simple de flujo
};

/* ---------- UI helpers ---------- */
function scrollBottom(){ msgs.scrollTop = msgs.scrollHeight; }
function clearMessages(){ msgs.innerHTML = ''; }
function appendBot(html, opts = {}) {
  const bubble = document.createElement('div');
  bubble.className = 'bubble bot';
  bubble.innerHTML = html;
  if (opts.reaction) { const r = document.createElement('span'); r.className='reaction-pop'; r.textContent = opts.reaction; bubble.appendChild(r); }
  msgs.appendChild(bubble);
  scrollBottom();
}
function appendUser(text){
  const bubble = document.createElement('div');
  bubble.className = 'bubble user';
  bubble.textContent = text;
  msgs.appendChild(bubble);
  scrollBottom();
}
function showThinkingBubble(){
  const wrap = document.createElement('div');
  wrap.className = 'bot-row';
  const thinking = document.createElement('div'); thinking.className = 'thinking-bubble';
  const dots = document.createElement('span'); dots.className = 'dots'; dots.innerHTML = '<span></span><span></span><span></span>';
  thinking.appendChild(dots); wrap.appendChild(thinking); msgs.appendChild(wrap); scrollBottom();
  return wrap;
}

/* ---------- Avatar reaction functions (crossfade & pop) ---------- */
let _avatarRestoreTimer = null;
function reactWithImage(filePath, duration = 900) {
  if(!avatarImg) return Promise.resolve();
  const origSrc = avatarImg.getAttribute('src') || avatarImg.src;
  avatarImg.style.opacity = '0.14';
  if(_avatarRestoreTimer) { clearTimeout(_avatarRestoreTimer); _avatarRestoreTimer = null; }
  return new Promise(resolve => {
    setTimeout(()=> {
      avatarImg.src = filePath;
      avatarImg.classList.remove('avatar-react-pop');
      void avatarImg.offsetWidth;
      avatarImg.classList.add('avatar-react-pop');
      avatarImg.style.opacity = '1';
    }, 120);
    _avatarRestoreTimer = setTimeout(()=> {
      if(origSrc) avatarImg.setAttribute('src', origSrc);
      avatarImg.classList.remove('avatar-react-pop');
      _avatarRestoreTimer = null;
      resolve();
    }, Math.max(700, duration));
  });
}
function withThinkingImage(ms = 900) {
  const thinkingFile = AVATAR_FILES.thinking;
  return reactWithImage(thinkingFile, ms);
}

/* ---------- Suggestions / chips ---------- */
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

/* ---------- Quick replies helpers ---------- */
function showQuickReplies(buttons = []) {
  // buttons: [{text, className, onClick}]
  quickReplies.innerHTML = '';
  if(!buttons || !buttons.length) { quickReplies.setAttribute('aria-hidden','true'); return; }
  quickReplies.setAttribute('aria-hidden','false');
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'qr-btn ' + (b.className || '');
    btn.textContent = b.text;
    btn.addEventListener('click', () => { b.onClick && b.onClick(); });
    quickReplies.appendChild(btn);
  });
}

/* ---------- Keyword detection ---------- */
function findKeywordCategory(text) {
  if(!text) return null;
  const t = text.toLowerCase();
  for(const [cat, arr] of Object.entries(KEYWORDS)) {
    for(const kw of arr) {
      if(t.includes(kw.toLowerCase())) return cat;
    }
  }
  return null;
}

/* ---------- Flow: initial questionnaire ---------- */
function startConversation(){
  clearMessages();
  state.consumes = null;
  state.emotional = null;
  state.stage = 'q1';
  appendBot('<strong>Hola — ¿en qué te puedo ayudar hoy?</strong>');
  // after small delay show first question (simulate typing)
  setTimeout(()=> askQuestionConsume(), 700);
}

function askQuestionConsume(){
  // show typing simulation then question
  const thinking = showThinkingBubble();
  withThinkingImage(700).then(()=> {
    thinking.remove();
    appendBot('Para entender mejor y orientarte: ¿Consumes alcohol u otras sustancias actualmente?');
    // quick replies: Sí / No
    showQuickReplies([
      { text: 'Sí', className: 'positive', onClick: ()=> answerConsume(true) },
      { text: 'No', className: 'negative', onClick: ()=> answerConsume(false) }
    ]);
  });
}

function answerConsume(value){
  state.consumes = value;
  showQuickReplies([]); // hide quick replies
  appendUser(value ? 'Sí' : 'No');
  // next question
  setTimeout(()=> askQuestionEmotional(), 350);
}

function askQuestionEmotional(){
  const thinking = showThinkingBubble();
  withThinkingImage(700).then(()=> {
    thinking.remove();
    // pregunta englobada, tono empático
    appendBot('¿Has notado síntomas de ansiedad, depresión u otros problemas emocionales que te preocupen?');
    showQuickReplies([
      { text: 'Sí', className: 'positive', onClick: ()=> answerEmotional(true) },
      { text: 'No', className: 'negative', onClick: ()=> answerEmotional(false) }
    ]);
  });
}

function answerEmotional(value){
  state.emotional = value;
  showQuickReplies([]);
  appendUser(value ? 'Sí' : 'No');
  // seguir flujo según respuestas
  setTimeout(()=> postQuestionFlow(), 400);
}

/* ---------- After questionnaire: tailored reply + CTA ---------- */
function postQuestionFlow(){
  // small processing feel
  const thinking = showThinkingBubble();
  withThinkingImage(900).then(()=> {
    thinking.remove();
    // Tailored response (serio + cálido)
    if(state.consumes && state.emotional){
      appendBot('Gracias por compartir. Veo que hay consumo y también síntomas emocionales. Es importante abordarlo con apoyo profesional combinado (psicoterapia + evaluación médica). Puedo ayudarte a agendar una consulta o darte opciones de contacto inmediato.');
    } else if(state.consumes && !state.emotional){
      appendBot('Gracias por compartir. Vayamos paso a paso: podemos explorar opciones de tratamiento y apoyo para el consumo. ¿Quieres que te muestre las opciones o prefieres agendar una valoración?');
    } else if(!state.consumes && state.emotional){
      appendBot('Gracias por confiar. Los síntomas emocionales (ansiedad, depresión) suelen mejorar con intervención adecuada: terapia y, si hace falta, evaluación psiquiátrica. ¿Quieres opciones de atención o prefieres agendar una consulta?');
    } else {
      appendBot('Gracias. Puedo ofrecerte información general, recursos y opciones de contacto si lo deseas. ¿Qué prefieres ahora?');
    }

    // Mostrar CTA buttons (Agendar / Llamar / Formulario / WhatsApp)
    showQuickReplies([
      { text: '📅 Agendar consulta', className: 'positive', onClick: ()=> ctaAction('agendar') },
      { text: '📞 Llamar ahora', className: 'negative', onClick: ()=> ctaAction('llamar') },
      { text: '📝 Llenar formulario', className: '', onClick: ()=> ctaAction('formulario') },
      { text: '💬 WhatsApp', className: '', onClick: ()=> ctaAction('whatsapp') }
    ]);
  });
}

/* ---------- CTA actions ---------- */
function ctaAction(action){
  showQuickReplies([]); // hide replies
  if(action === 'agendar'){
    appendBot('Perfecto. Te llevo a la página de agendamiento. Si lo prefieres, puedo dejarte un enlace aquí.');
    // example: open new tab (replace with real URL)
    window.open('https://tu-sitio-agenda.example.com', '_blank');
  } else if(action === 'llamar'){
    appendBot('Te dejamos el número para que llames: +52 55 1234 5678. ¿Quieres que te lo marque ahora?');
    // open tel link
    window.location.href = 'tel:+525512345678';
  } else if(action === 'formulario'){
    appendBot('Te abro el formulario para que nos cuentes más detalles. Gracias por confiar.');
    window.open('https://tu-formulario.example.com', '_blank');
  } else if(action === 'whatsapp'){
    appendBot('Te conecto por WhatsApp. Un momento...');
    window.open('https://wa.me/52XXXXXXXXXXX', '_blank');
  }
}

/* ---------- Keyword handling (fallbacks) ---------- */
function handleKeyword(keyword){
  const cat = findKeywordCategory(keyword) || 'ramaC';
  // show thinking + reaction
  withThinkingImage(900).then(()=> {
    reactWithImage(AVATAR_FILES.happyBulb, 900).then(()=> {
      if(cat === 'ramaA'){
        appendBot('Entiendo que buscas ayuda para otra persona. ¿Quieres orientación para hablar con esa persona o información sobre tratamientos?');
      } else if(cat === 'ramaB'){
        appendBot('Gracias por compartir. Podemos explorar opciones de apoyo y tratamiento. ¿Deseas que te conecte con un especialista?');
      } else if(cat === 'ramaC'){
        appendBot('Ofrecemos terapia individual, grupal y consultas psiquiátricas. ¿Deseas agendar una consulta inicial?');
      } else {
        appendBot('Te puedo facilitar teléfono, WhatsApp o un formulario para que nos cuentes más. ¿Qué prefieres?');
      }
      // show CTA quick replies
      showQuickReplies([
        { text: '📅 Agendar', className: 'positive', onClick: ()=> ctaAction('agendar') },
        { text: '💬 WhatsApp', className: '', onClick: ()=> ctaAction('whatsapp') },
        { text: '📞 Llamar', className: 'negative', onClick: ()=> ctaAction('llamar') }
      ]);
    });
  });
}

/* ---------- Send / Reset handlers ---------- */
if(sendBtn){
  sendBtn.addEventListener('click', ()=> {
    const val = input.value.trim();
    if(!val) return;
    appendUser(val);
    input.value = '';
    // first check if we are in questionnaire stage expecting quick replies - if not, proceed with keyword detection
    const matchedCat = findKeywordCategory(val);
    if(matchedCat){
      withThinkingImage(900).then(()=> handleKeyword(val));
    } else {
      withThinkingImage(900).then(()=> appendBot('Gracias. Si quieres, puedes escribir una palabra clave (por ejemplo: tratamiento, terapia, contacto) o usar Sugerencias.'));
    }
  });
}

if(resetBtn){
  resetBtn.addEventListener('click', ()=> {
    startConversation();
  });
}

input.addEventListener('keydown', (e)=> { if(e.key === 'Enter'){ e.preventDefault(); sendBtn.click(); }});

/* ---------- Init ---------- */
function init(){
  // logs for avatar
  if(avatarImg){
    avatarImg.addEventListener('load', ()=> console.log('[avatar] loaded', avatarImg.currentSrc));
    avatarImg.addEventListener('error', ()=> console.warn('[avatar] failed to load', avatarImg.src));
  }
  startConversation();
}

document.addEventListener('DOMContentLoaded', init);
