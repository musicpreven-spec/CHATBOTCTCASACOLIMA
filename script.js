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

/* ---------- DOM refs (con defensas) ---------- */
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

/* typing element (single definition) */
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

/* avatar reaction (safe) */
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

/* typing helper */
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
    _typingTimer = setTimeout(()=>{
      typingEl.remove();
      resolve();
    }, ms);
  });
}

/* ---------- Suggestions chips (integrados con KEYWORDS) ---------- */
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
    chip.setAttribute('role','button');
    chip.setAttribute('aria-pressed','false');
    chip.addEventListener('click', ()=>{
      if(suggestPanel) { suggestPanel.classList.remove('show'); suggestBtn && suggestBtn.setAttribute('aria-pressed','false'); }
      appendUser(k);
      if(quickReplies) quickReplies.innerHTML = '';
      showTyping(700).then(()=> handleKeyword(k));
    });
    chip.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chip.click(); }});
    suggestChips.appendChild(chip);
  });
}

/* ---------- Quick replies helpers (accessible) ---------- */
function showQuickReplies(buttons = []){
  if(!quickReplies) return;
  quickReplies.innerHTML = '';
  if(!buttons || !buttons.length){ quickReplies.setAttribute('aria-hidden','true'); return; }
  quickReplies.setAttribute('aria-hidden','false');
  buttons.forEach((b, idx)=>{
    const btn = document.createElement('button');
    btn.className = 'qr-btn ' + (b.className || '');
    btn.textContent = b.text;
    btn.setAttribute('role','button');
    btn.setAttribute('aria-pressed','false');
    btn.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }});
    btn.addEventListener('click', ()=>{
      try {
        const currently = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', (!currently).toString());
      } catch(e){}
      b.onClick && b.onClick();
    });
    quickReplies.appendChild(btn);
  });
}

/* Multi-select UI for substances (accessible) */
function showMultiSelect(options = [], onDone){
  if(!quickReplies) return;
  quickReplies.innerHTML = '';
  quickReplies.setAttribute('aria-hidden','false');
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.gap = '8px';
  options.forEach(opt=>{
    const btn = document.createElement('button');
    btn.className = 'qr-btn small';
    btn.textContent = opt;
    btn.dataset.value = opt;
    btn.setAttribute('role','button');
    btn.setAttribute('aria-pressed','false');
    btn.addEventListener('click', ()=>{
      const selected = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', (!selected).toString());
      btn.classList.toggle('selected');
    });
    btn.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }});
    container.appendChild(btn);
  });
  const actions = document.createElement('div');
  actions.style.marginTop = '8px';
  const cont = document.createElement('button');
  cont.className = 'qr-btn positive';
  cont.textContent = 'Continuar';
  cont.setAttribute('role','button');
  cont.addEventListener('click', ()=> {
    const selected = Array.from(container.querySelectorAll('.qr-btn.selected')).map(n => n.dataset.value);
    onDone(selected);
  });
  const back = document.createElement('button');
  back.className = 'qr-btn negative';
  back.textContent = 'Volver';
  back.setAttribute('role','button');
  back.addEventListener('click', ()=> {
    quickReplies.innerHTML = '';
    quickReplies.setAttribute('aria-hidden','true');
    askQuestionConsume();
  });
  actions.appendChild(cont);
  actions.appendChild(back);
  quickReplies.appendChild(container);
  quickReplies.appendChild(actions);
}

/* ---------- Keyword detection helper ---------- */
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

/* ---------- Flow: questionnaire ---------- */
async function startConversation(){
  clearMessages();
  state.subject = 'self';
  state.consumes = null;
  state.substances = [];
  state.frequency = null;
  state.emotional = null;
  state.diagnosis = null;
  appendBot('<strong>Hola — ¿en qué te puedo ayudar hoy?</strong>');
  await delay(600);
  await askQuestionConsume();
}
function delay(ms){ return new Promise(res => setTimeout(res, ms)); }

/* Q1 */
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
  if(value) setTimeout(()=> askSubstancesSelf(), 300);
  else setTimeout(()=> askWhoIsIt(), 300);
}

/* Substances self */
async function askSubstancesSelf(){
  await showTyping(700);
  appendBot('Indica cuál(es) sustancia(s) consumes (puedes seleccionar una o varias):');
  const options = ['alcohol','marihuana','cocaína','piedra/crack','cristal','ácidos','benzodiacepinas','otras'];
  showMultiSelect(options, (selected) => {
    if(!selected || !selected.length){ appendBot('Puedes elegir al menos una opción o escribir la sustancia si no aparece.'); return; }
    state.substances = selected;
    appendUser(selected.join(', '));
    setTimeout(()=> askFrequencySelf(), 300);
  });
}
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
function answerFrequency(val){ state.frequency = val; showQuickReplies([]); appendUser(_labelForFrequency(val)); setTimeout(()=> askQuestionEmotional(), 300); }

/* third-party flow */
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
async function askSubstancesThirdParty(kind){
  await showTyping(700);
  appendBot(`¿Qué sustancias consume la persona (${kind})? Selecciona una o varias:`);
  const options = ['alcohol','marihuana','cocaína','piedra/crack','cristal','ácidos','benzodiacepinas','otras'];
  showMultiSelect(options, (selected) => {
    if(!selected || !selected.length){ appendBot('Si no estás seguro, elige "otras" o escribe la sustancia en el mensaje.'); return; }
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
function answerFrequencyThird(val){ state.frequency = val; showQuickReplies([]); appendUser(_labelForFrequency(val)); setTimeout(()=> askQuestionEmotional(), 300); }

/* emotional */
async function askQuestionEmotional(){
  await showTyping(700);
  appendBot('¿Has notado signos de ansiedad, depresión u otros problemas emocionales que te preocupen? (si es para otra persona, responde según lo que observas)');
  showQuickReplies([
    { text: 'Sí', className: 'positive', onClick: ()=> answerEmotional(true) },
    { text: 'No', className: 'negative', onClick: ()=> answerEmotional(false) }
  ]);
}
function answerEmotional(val){ state.emotional = val; showQuickReplies([]); appendUser(val ? 'Sí' : 'No'); setTimeout(()=> askDiagnosisQuestion(), 350); }

/* diagnosis - with adjusted wording for third-party */
async function askDiagnosisQuestion(){
  await showTyping(700);
  const who = (state.subject && state.subject !== 'self') ? 'tu conocido, amigo o familia' : 'tú';
  const question = (state.subject && state.subject !== 'self')
    ? '¿Cuentas con algún diagnóstico psiquiátrico o de salud mental de tu conocido, amigo o familia?'
    : '¿Cuentas con algún diagnóstico psiquiátrico o de salud mental?';
  appendBot(question);
  showQuickReplies([
    { text: 'Sí', className: 'positive', onClick: ()=> answerHasDiagnosis(true) },
    { text: 'No', className: 'negative', onClick: ()=> answerHasDiagnosis(false) }
  ]);
}
function answerHasDiagnosis(val){
  showQuickReplies([]); appendUser(val ? 'Sí' : 'No');
  if(val) setTimeout(()=> askWhichDiagnosis(), 300); else setTimeout(()=> askSchedulePsychiatric(), 300);
}
async function askWhichDiagnosis(){
  await showTyping(700);
  appendBot('¿Cuál es tu diagnóstico? Selecciona la opción que corresponda (si no está, elige \"Otros\").');
  const diagnoses = ['TDA','TDAH','TLP (trastorno límite de la personalidad)','TAG (trastorno de ansiedad generalizada)','Depresión mayor','Trastorno bipolar','TEPT (trastorno por estrés postraumático)','TOC (trastorno obsesivo-compulsivo)','Esquizofrenia','Trastornos del espectro autista','Trastornos alimentarios','Trastornos por consumo de sustancias','Trastorno del sueño','Otros'];
  showQuickReplies(diagnoses.map(d => ({ text: d, className: '', onClick: ()=> answerWhichDiagnosis(d) })));
}
function answerWhichDiagnosis(diagnosis){
  if(diagnosis === 'Otros'){
    appendUser('Otros');
    state.diagnosis = 'Otros';
    setTimeout(()=> postQuestionFlow(), 300);
    return;
  }
  state.diagnosis = diagnosis;
  showQuickReplies([]);
  appendUser(diagnosis);
  setTimeout(async ()=>{
    await showTyping(800);
    appendBot(`Gracias por compartir tu diagnóstico: <strong>${diagnosis}</strong>. Esto nos ayuda a recomendar el mejor tipo de valoración y tratamiento.`);
    setTimeout(()=> postQuestionFlow(), 700);
  }, 240);
}
async function askSchedulePsychiatric(){
  await showTyping(700);
  appendBot('¿Gustas agendar una cita para consulta psiquiátrica?');
  showQuickReplies([
    { text: 'Sí', className: 'positive', onClick: ()=> answerSchedulePsychiatric(true) },
    { text: 'No', className: 'negative', onClick: ()=> answerSchedulePsychiatric(false) }
  ]);
}
function answerSchedulePsychiatric(val){
  showQuickReplies([]); appendUser(val ? 'Sí' : 'No');
  if(val){
    setTimeout(()=> showQuickReplies([
      { text: '📅 Agendar consulta', className: 'positive', onClick: ()=> ctaAction('agendar') },
      { text: '📞 Llamar ahora', className: 'negative', onClick: ()=> ctaAction('llamar') },
      { text: '💬 WhatsApp', className: '', onClick: ()=> ctaAction('whatsapp') },
      { text: '📝 Llenar formulario', className: '', onClick: ()=> ctaAction('formulario') }
    ]), 300);
  } else {
    setTimeout(()=> postQuestionFlow(), 300);
  }
}

/* post flow */
async function postQuestionFlow(){
  await showTyping(900);
  let whoText = (state.subject === 'self') ? 'tú' : `la persona (${state.subject.type})`;
  let substancesText = state.substances && state.substances.length ? state.substances.join(', ') : 'sustancias no especificadas';
  let freqLabel = state.frequency ? _labelForFrequency(state.frequency) : 'patrón no especificado';
  let emotionalText = state.emotional ? 'síntomas emocionales presentes' : 'sin síntomas emocionales reportados';
  let diagnosisText = state.diagnosis ? `, diagnóstico: <strong>${state.diagnosis}</strong>` : '';
  appendBot(`Gracias por la información. Según lo que compartiste sobre ${whoText}: consumo de <strong>${substancesText}</strong>, patrón: <strong>${freqLabel}</strong>, y ${emotionalText}${diagnosisText}. Con base en esto, lo más recomendable es una valoración profesional para determinar el mejor plan (psicoterapia, programa ambulatorio o valoración psiquiátrica). ¿Cómo prefieres proceder?`);
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
  if(action === 'agendar'){ appendBot('Perfecto. Te llevo a la página de agendamiento.'); window.open('https://tu-sitio-agenda.example.com','_blank'); }
  else if(action === 'llamar'){ appendBot('Te dejamos el número: +52 55 1234 5678'); window.location.href = 'tel:+525512345678'; }
  else if(action === 'formulario'){ appendBot('Abriendo formulario...'); window.open('https://tu-formulario.example.com','_blank'); }
  else if(action === 'whatsapp'){ appendBot('Conectándote con WhatsApp...'); window.open('https://wa.me/52XXXXXXXXXXX','_blank'); }
}

/* keyword handling */
function handleKeyword(keyword){
  const cat = findKeywordCategory(keyword) || 'ramaC';
  showTyping(900).then(()=> {
    reactWithImage(AVATAR_FILES.happyBulb, 900).then(()=> {
      if(cat === 'ramaA') appendBot('Entiendo que buscas ayuda para otra persona. ¿Quieres orientación para hablar con esa persona o información sobre tratamientos?');
      else if(cat === 'ramaB') appendBot('Gracias por compartir. Podemos explorar opciones de apoyo y tratamiento. ¿Deseas que te conecte con un especialista?');
      else if(cat === 'ramaC') appendBot('Ofrecemos terapia individual, grupal y consultas psiquiátricas. ¿Quieres que te ayude a agendar una consulta?');
      else appendBot('Te puedo facilitar teléfono, WhatsApp o un formulario para que nos cuentes más. ¿Qué prefieres?');
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
    try {
      const val = (input && input.value) ? input.value.trim() : '';
      if(!val) return;
      appendUser(val);
      if(input) input.value = '';
      const matchedCat = findKeywordCategory(val);
      if(matchedCat) showTyping(900).then(()=> handleKeyword(val));
      else showTyping(900).then(()=> appendBot('Gracias. Si quieres, puedes seleccionar una opción o escribir una palabra clave (por ejemplo: tratamiento, terapia, contacto).'));
    } catch(e){ console.error('sendBtn handler error', e); }
  });
}
if(resetBtn) resetBtn.addEventListener('click', ()=> startConversation());
if(input) input.addEventListener('keydown', (e)=> { if(e.key === 'Enter'){ e.preventDefault(); sendBtn && sendBtn.click(); }});

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

/* Init & DOM ready (single listener) */
document.addEventListener('DOMContentLoaded', ()=>{
  try { renderSuggestionChips(); } catch(e){ console.warn('renderSuggestionChips error', e); }
  try { startConversation(); } catch(e){ console.error('startConversation error', e); }
  if(suggestBtn && suggestPanel){
    suggestBtn.addEventListener('click', ()=> {
      try {
        const shown = suggestPanel.classList.contains('show');
        if(shown){ suggestPanel.classList.remove('show'); suggestBtn.setAttribute('aria-pressed','false'); }
        else { renderSuggestionChips(); suggestPanel.classList.add('show'); suggestBtn.setAttribute('aria-pressed','true'); }
      } catch(e) { console.error('suggestBtn click error', e); }
    });
    suggestPanel.classList.remove('show');
    suggestBtn && suggestBtn.setAttribute('aria-pressed','false');
  }
});
