/* script.js - Chatbot Casa Colima (typing simulation mejorada)
   - showTyping(ms): muestra los 3 puntitos y sincroniza avatar-thinking
   - mantiene multi-select y flujo previo
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
  subject: 'self',   // 'self' or object { type:'familiar', relation:'hermano' } etc
  consumes: null,    // true/false
  substances: [],    // array of strings
  frequency: null,   // 'recreativo'|'frecuente'|'dependencia'|'adicto'
  emotional: null    // true/false
};

/* ---------- UI helpers ---------- */
function scrollBottom(){ if(msgs) msgs.scrollTop = msgs.scrollHeight; }
function clearMessages(){ if(msgs) msgs.innerHTML = ''; }
function appendBot(html, opts = {}) {
  if(!msgs) return;
  const bubble = document.createElement('div');
  bubble.className = 'bubble bot';
  bubble.innerHTML = html;
  if (opts.reaction) { const r = document.createElement('span'); r.className='reaction-pop'; r.textContent = opts.reaction; bubble.appendChild(r); }
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

/* thinking bubble DOM (shows the three dots) */
function createThinkingElement() {
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

/* ---------- Avatar reaction (crossfade + pop) ---------- */
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
function withThinkingImage(ms = 900) { return reactWithImage(AVATAR_FILES.thinking, ms); }

/* ---------- Typing simulation helper (sync with avatar thinking) ---------- */
/**
 * showTyping(ms)
 * - displays the three-dot typing bubble for ms milliseconds
 * - simultaneously triggers withThinkingImage(ms) so avatar switches to thinking
 * - returns a Promise which resolves after ms
 */
function showTyping(ms = 800) {
  return new Promise(resolve => {
    // create and append typing element
    const typingEl = createThinkingElement();
    msgs.appendChild(typingEl);
    scrollBottom();

    // start avatar thinking in parallel (if asset exists it will change)
    const avatarPromise = withThinkingImage(ms);

    // remove typing bubble after ms, but wait a tiny bit to ensure smoothness
    setTimeout(()=> {
      typingEl.remove();
      // resolve after avatarPromise finishes or after ms (whichever later)
      avatarPromise.finally(() => resolve());
    }, ms);
  });
}

/* ---------- Suggestions chips (existing) ---------- */
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
      // show typing then handle
      showTyping(900).then(()=> handleKeyword(k));
    });
    suggestChips.appendChild(chip);
  });
}
if(suggestBtn){
  suggestBtn.addEventListener('click', ()=> {
    const shown = suggestPanel.classList.contains('show');
    if(shown){ suggestPanel.classList.remove('show'); suggestBtn.setAttribute('aria-pressed','false'); }
    else { suggestPanel.classList.add('show'); suggestBtn.setAttribute('aria-pressed','true'); renderSuggestionChips(); }
  });
}

/* ---------- Quick replies helpers ---------- */
function showQuickReplies(buttons = []) {
  if(!quickReplies) return;
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

/* ---------- Multi-select UI for substances ---------- */
function showMultiSelect(options = [], onDone) {
  if(!quickReplies) return;
  quickReplies.innerHTML = '';
  quickReplies.setAttribute('aria-hidden','false');
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.gap = '8px';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'qr-btn small';
    btn.textContent = opt;
    btn.dataset.value = opt;
    btn.addEventListener('click', ()=> {
      btn.classList.toggle('selected');
    });
    container.appendChild(btn);
  });
  const actions = document.createElement('div');
  actions.style.marginTop = '8px';
  const cont = document.createElement('button');
  cont.className = 'qr-btn positive';
  cont.textContent = 'Continuar';
  cont.addEventListener('click', ()=> {
    const selected = Array.from(container.querySelectorAll('.qr-btn.selected')).map(n => n.dataset.value);
    onDone(selected);
  });
  const back = document.createElement('button');
  back.className = 'qr-btn negative';
  back.textContent = 'Volver';
  back.addEventListener('click', ()=> {
    quickReplies.innerHTML = '';
    quickReplies.setAttribute('aria-hidden','true');
    askQuestionConsume(); // go back to previous
  });
  actions.appendChild(cont);
  actions.appendChild(back);
  quickReplies.appendChild(container);
  quickReplies.appendChild(actions);
}

/* ---------- Keyword detection helper ---------- */
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

/* ---------- Flow: questionnaire (async/await) ---------- */

/* Start */
async function startConversation(){
  clearMessages();
  // reset state
  state.subject = 'self';
  state.consumes = null;
  state.substances = [];
  state.frequency = null;
  state.emotional = null;
  appendBot('<strong>Hola — ¿en qué te puedo ayudar hoy?</strong>');
  await delay(600);
  await askQuestionConsume();
}

/* small utility delay */
function delay(ms){ return new Promise(res => setTimeout(res, ms)); }

/* Q1: consumes? */
async function askQuestionConsume(){
  await showTyping(800);
  appendBot('Para orientarte mejor: ¿Consumes alcohol u otras sustancias actualmente?');
  showQuickReplies([
    { text: 'Sí', className: 'positive', onClick: ()=> answerConsume(true) },
    { text: 'No', className: 'negative', onClick: ()=> answerConsume(false) }
  ]);
}

function answerConsume(value){
  state.consumes = value;
  showQuickReplies([]);
  appendUser(value ? 'Sí' : 'No');
  if(value){
    // ask substances (multi-select)
    setTimeout(()=> askSubstancesSelf(), 300);
  } else {
    // ask who is it for
    setTimeout(()=> askWhoIsIt(), 300);
  }
}

/* Q1a: substances multi-select for self */
async function askSubstancesSelf(){
  await showTyping(700);
  appendBot('Indica cuál(es) sustancia(s) consumes (puedes seleccionar una o varias):');
  const options = ['alcohol','marihuana','cocaína','piedra/crack','cristal','ácidos','benzodiacepinas','otras'];
  showMultiSelect(options, (selected) => {
    if(!selected || !selected.length){
      appendBot('Puedes elegir al menos una opción o escribir la sustancia si no aparece.');
      return;
    }
    state.substances = selected;
    appendUser(selected.join(', '));
    setTimeout(()=> askFrequencySelf(), 300);
  });
}

/* Frequency question for self */
async function askFrequencySelf(){
  await showTyping(650);
  appendBot('¿Cómo describirías tu patrón de consumo? Elige la que mejor aplique:');
  showQuickReplies([
    { text: 'Recreativo (ocasional)', className: '', onClick: ()=> answerFrequency('recreativo') },
    { text: 'Consumo frecuente / diario', className: '', onClick: ()=> answerFrequency('frecuente') },
    { text: 'Posible dependencia', className: '', onClick: ()=> answerFrequency('dependencia') },
    { text: 'Creo que ya soy adicto', className: '', onClick: ()=> answerFrequency('adicto') }
  ]);
}
function answerFrequency(val){
  state.frequency = val;
  showQuickReplies([]);
  appendUser(_labelForFrequency(val));
  setTimeout(()=> askQuestionEmotional(), 300);
}

/* Q: who is it for when user said No (third-party flow) */
async function askWhoIsIt(){
  await showTyping(600);
  appendBot('¿Es para un familiar, un amigo o un conocido?');
  showQuickReplies([
    { text: 'Familiar', className: '', onClick: ()=> answerWho('familiar') },
    { text: 'Amigo', className: '', onClick: ()=> answerWho('amigo') },
    { text: 'Conocido', className: '', onClick: ()=> answerWho('conocido') }
  ]);
}
function answerWho(kind){
  state.subject = { type: kind };
  showQuickReplies([]);
  appendUser(kind);
  setTimeout(()=> askSubstancesThirdParty(kind), 300);
}

/* Multi-select for third party */
async function askSubstancesThirdParty(kind){
  await showTyping(700);
  appendBot(`¿Qué sustancias consume la persona (${kind})? Selecciona una o varias:`);
  const options = ['alcohol','marihuana','cocaína','piedra/crack','cristal','ácidos','benzodiacepinas','otras'];
  showMultiSelect(options, (selected) => {
    if(!selected || !selected.length){
      appendBot('Si no estás seguro, elige "otras" o escribe la sustancia en el mensaje.');
      return;
    }
    state.substances = selected;
    appendUser(selected.join(', '));
    setTimeout(()=> askFrequencyThirdParty(), 300);
  });
}

async function askFrequencyThirdParty(){
  await showTyping(600);
  appendBot('¿Cómo describirías el patrón de consumo de esa persona?');
  showQuickReplies([
    { text: 'Recreativo (ocasional)', className: '', onClick: ()=> answerFrequencyThird('recreativo') },
    { text: 'Consumo frecuente / diario', className: '', onClick: ()=> answerFrequencyThird('frecuente') },
    { text: 'Posible dependencia', className: '', onClick: ()=> answerFrequencyThird('dependencia') },
    { text: 'Creo que ya es adicto', className: '', onClick: ()=> answerFrequencyThird('adicto') }
  ]);
}
function answerFrequencyThird(val){
  state.frequency = val;
  showQuickReplies([]);
  appendUser(_labelForFrequency(val));
  setTimeout(()=> askQuestionEmotional(), 300);
}

/* Question about emotional symptoms (for self or third-party) */
async function askQuestionEmotional(){
  await showTyping(700);
  appendBot('¿Has notado signos de ansiedad, depresión u otros problemas emocionales que te preocupen? (si es para otra persona, responde según lo que observas)');
  showQuickReplies([
    { text: 'Sí', className: 'positive', onClick: ()=> answerEmotional(true) },
    { text: 'No', className: 'negative', onClick: ()=> answerEmotional(false) }
  ]);
}
function answerEmotional(val){
  state.emotional = val;
  showQuickReplies([]);
  appendUser(val ? 'Sí' : 'No');
  setTimeout(()=> postQuestionFlow(), 350);
}

/* After questionnaire: tailored reply + CTA */
async function postQuestionFlow(){
  await showTyping(900);
  let whoText = (state.subject === 'self') ? 'tú' : `la persona (${state.subject.type})`;
  let substancesText = state.substances && state.substances.length ? state.substances.join(', ') : 'sustancias no especificadas';
  let freqLabel = state.frequency ? _labelForFrequency(state.frequency) : 'patrón no especificado';
  let emotionalText = state.emotional ? 'síntomas emocionales presentes' : 'sin síntomas emocionales reportados';

  appendBot(
    `Gracias por la información. Según lo que compartiste sobre ${whoText}: consumo de <strong>${substancesText}</strong>, patrón: <strong>${freqLabel}</strong>, y ${emotionalText}. ` +
    `Con base en esto, lo más recomendable es una valoración profesional para determinar el mejor plan (psicoterapia, programa ambulatorio o valoración psiquiátrica). ¿Cómo prefieres proceder?`
  );

  showQuickReplies([
    { text: '📅 Agendar consulta', className: 'positive', onClick: ()=> ctaAction('agendar') },
    { text: '📞 Llamar ahora', className: 'negative', onClick: ()=> ctaAction('llamar') },
    { text: '📝 Llenar formulario', className: '', onClick: ()=> ctaAction('formulario') },
    { text: '💬 WhatsApp', className: '', onClick: ()=> ctaAction('whatsapp') }
  ]);
}

/* CTA actions */
function ctaAction(action){
  showQuickReplies([]);
  if(action === 'agendar'){
    appendBot('Perfecto. Te llevo a la página de agendamiento.');
    window.open('https://tu-sitio-agenda.example.com', '_blank');
  } else if(action === 'llamar'){
    appendBot('Te dejamos el número: +52 55 1234 5678');
    window.location.href = 'tel:+525512345678';
  } else if(action === 'formulario'){
    appendBot('Abriendo formulario...');
    window.open('https://tu-formulario.example.com', '_blank');
  } else if(action === 'whatsapp'){
    appendBot('Conectándote con WhatsApp...');
    window.open('https://wa.me/52XXXXXXXXXXX', '_blank');
  }
}

/* Keyword fallback handling (uses typing too) */
function handleKeyword(keyword){
  const cat = findKeywordCategory(keyword) || 'ramaC';
  // show typing and then react + respond
  showTyping(900).then(()=> {
    reactWithImage(AVATAR_FILES.happyBulb, 900).then(()=> {
      if(cat === 'ramaA'){
        appendBot('Entiendo que buscas ayuda para otra persona. ¿Quieres orientación para hablar con esa persona o información sobre tratamientos?');
      } else if(cat === 'ramaB'){
        appendBot('Gracias por compartir. Podemos explorar opciones de apoyo y tratamiento. ¿Deseas que te conecte con un especialista?');
      } else if(cat === 'ramaC'){
        appendBot('Ofrecemos terapia individual, grupal y consultas psiquiátricas. ¿Quieres que te ayude a agendar una consulta?');
      } else {
        appendBot('Te puedo facilitar teléfono, WhatsApp o un formulario para que nos cuentes más. ¿Qué prefieres?');
      }
      showQuickReplies([
        { text: '📅 Agendar', className: 'positive', onClick: ()=> ctaAction('agendar') },
        { text: '💬 WhatsApp', className: '', onClick: ()=> ctaAction('whatsapp') },
        { text: '📞 Llamar', className: 'negative', onClick: ()=> ctaAction('llamar') }
      ]);
    });
  });
}

/* Send / Reset handlers */
if(sendBtn){
  sendBtn.addEventListener('click', ()=> {
    const val = input.value.trim();
    if(!val) return;
    appendUser(val);
    input.value = '';
    const matchedCat = findKeywordCategory(val);
    if(matchedCat){
      showTyping(900).then(()=> handleKeyword(val));
    } else {
      showTyping(900).then(()=> appendBot('Gracias. Si quieres, puedes seleccionar una opción o escribir una palabra clave (por ejemplo: tratamiento, terapia, contacto).'));
    }
  });
}

if(resetBtn){
  resetBtn.addEventListener('click', ()=> {
    startConversation();
  });
}

input.addEventListener('keydown', (e)=> { if(e.key === 'Enter'){ e.preventDefault(); sendBtn.click(); }});

/* Utilities */
function _labelForFrequency(key){
  switch(key){
    case 'recreativo': return 'Recreativo (ocasional)';
    case 'frecuente': return 'Consumo frecuente / diario';
    case 'dependencia': return 'Posible dependencia';
    case 'adicto': return 'Creo que ya es adicto';
    default: return key;
  }
}

/* Init */
function init(){
  if(avatarImg){
    avatarImg.addEventListener('load', ()=> console.log('[avatar] loaded', avatarImg.currentSrc));
    avatarImg.addEventListener('error', ()=> console.warn('[avatar] failed to load', avatarImg.src));
  }
  startConversation();
}

document.addEventListener('DOMContentLoaded', () => {
  // arranca la conversación como siempre
  startConversation();

  // RENDERIZA LOS CHIPS pero NO los muestra hasta que el usuario haga click en "Sugerencias".
  // (esto mejora rendimiento y evita que el panel aparezca por defecto)
  try {
    if (typeof renderSuggestionChips === 'function') {
      renderSuggestionChips(); // prepara los chips en memoria/DOM pero panel sigue oculto
    }
    // asegurarnos de que no se muestre el panel al inicio
    if (suggestPanel) {
      suggestPanel.classList.remove('show');
      suggestBtn && suggestBtn.setAttribute('aria-pressed', 'false');
    }
  } catch (e) {
    console.warn('No fue posible inicializar sugerencias sin mostrarlas:', e);
  }
});

/* Sugerencias: toggle al hacer click (chips se renderizan pero panel oculto hasta click) */
function renderSuggestionChips(){
  if(!suggestChips) return;
  suggestChips.innerHTML = '';
  const DEFAULT_KEYWORDS = ['tratamiento','terapia','recaídas','consumo de sustancias','contacto'];
  DEFAULT_KEYWORDS.forEach(k => {
    const chip = document.createElement('button');
    chip.className = 'suggest-chip';
    chip.textContent = k;
    chip.addEventListener('click', ()=> {
      appendUser(k);
      showTyping(700).then(()=> handleKeyword(k));
    });
    suggestChips.appendChild(chip);
  });
}

// Event listener para el botón Sugerencias: abre/cierra el panel (no muestre por defecto)
if(suggestBtn && suggestPanel){
  suggestBtn.addEventListener('click', ()=> {
    const isShown = suggestPanel.classList.contains('show');
    if(isShown){
      suggestPanel.classList.remove('show');
      suggestBtn.setAttribute('aria-pressed','false');
    } else {
      // renderizamos chips justo antes de mostrar para asegurar que estén actualizados
      renderSuggestionChips();
      suggestPanel.classList.add('show');
      suggestBtn.setAttribute('aria-pressed','true');
    }
  });
}


