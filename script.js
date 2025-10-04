/* script.js - Versión completa y corregida para Chatbot Casa Colima */

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

/* Multi-select for substances */
function showMultiSelect(options = [], onDone){
  if(!quickReplies) return;
  quickReplies.innerHTML = '';
  quickReplies.setAttribute('aria-hidden','false');
  const container = document.createElement('div');
  container.style.display='flex'; container.style.flexWrap='wrap'; container.style.gap='8px';
  options.forEach(opt=>{
    const btn = document.createElement('button');
    btn.className='qr-btn small';
    btn.textContent=opt;
    btn.dataset.value=opt;
    btn.addEventListener('click', ()=>{
      const selected = btn.getAttribute('aria-pressed')==='true';
      btn.setAttribute('aria-pressed',(!selected).toString());
      btn.classList.toggle('selected');
    });
    container.appendChild(btn);
  });
  const actions = document.createElement('div'); actions.style.marginTop='8px';
  const cont = document.createElement('button'); cont.className='qr-btn positive'; cont.textContent='Continuar';
  cont.addEventListener('click', ()=>{
    const selected = Array.from(container.querySelectorAll('.qr-btn.selected')).map(n=>n.dataset.value);
    onDone(selected);
  });
  actions.appendChild(cont);
  quickReplies.appendChild(container); quickReplies.appendChild(actions);
}

/* ---------- Keyword detection ---------- */
function findKeywordCategory(text){
  if(!text) return null;
  const t=text.toLowerCase();
  for(const [cat, arr] of Object.entries(KEYWORDS)){
    for(const kw of arr) if(t.includes(kw.toLowerCase())) return cat;
  }
  return null;
}

/* ---------- Flow de conversación completo ---------- */
async function startConversation(){
  clearMessages();
  Object.assign(state,{subject:'self', consumes:null, substances:[], frequency:null, emotional:null, diagnosis:null});
  appendBot('<strong>Hola — ¿en qué te puedo ayudar hoy?</strong>');
  await delay(600);
  askQuestionConsume();
}
function delay(ms){ return new Promise(res=>setTimeout(res,ms)); }

function askQuestionConsume(){
  showTyping(800).then(()=>{
    appendBot('¿Consumes alcohol u otras sustancias actualmente?');
    showQuickReplies([
      { text: 'Sí', className:'positive', onClick:()=>answerConsume(true) },
      { text: 'No', className:'negative', onClick:()=>answerConsume(false) }
    ]);
  });
}
function answerConsume(val){
  state.consumes=val;
  appendUser(val?'Sí':'No'); showQuickReplies([]);
  if(val) askSubstancesSelf();
  else askWhoIsIt();
}

function askSubstancesSelf(){
  showTyping(700).then(()=>{
    appendBot('Selecciona cuál(es) sustancia(s) consumes (puedes elegir varias):');
    const options=['alcohol','marihuana','cocaína','piedra/crack','cristal','ácidos','benzodiacepinas','otras'];
    showMultiSelect(options,(sel)=>{
      if(!sel.length){ appendBot('Debes seleccionar al menos una opción'); return; }
      state.substances=sel; appendUser(sel.join(', '));
      askFrequencySelf();
    });
  });
}
function askFrequencySelf(){
  showTyping(650).then(()=>{
    appendBot('¿Cómo describirías tu patrón de consumo?');
    showQuickReplies([
      {text:'Recreativo (ocasional)', onClick:()=>answerFrequency('recreativo')},
      {text:'Consumo frecuente / diario', onClick:()=>answerFrequency('frecuente')},
      {text:'Posible dependencia', onClick:()=>answerFrequency('dependencia')},
      {text:'Creo que ya soy adicto', onClick:()=>answerFrequency('adicto')}
    ]);
  });
}
function answerFrequency(val){ state.frequency=val; appendUser(_labelForFrequency(val)); showQuickReplies([]); askQuestionEmotional(); }

function askWhoIsIt(){
  showTyping(600).then(()=>{
    appendBot('¿Es para un familiar, amigo o conocido?');
    showQuickReplies([
      {text:'Familiar', onClick:()=>answerWho('familiar')},
      {text:'Amigo', onClick:()=>answerWho('amigo')},
      {text:'Conocido', onClick:()=>answerWho('conocido')}
    ]);
  });
}
function answerWho(kind){ state.subject={type:kind}; appendUser(kind); showQuickReplies([]); askSubstancesThirdParty(kind); }
function askSubstancesThirdParty(kind){
  showTyping(700).then(()=>{
    appendBot(`¿Qué sustancias consume la persona (${kind})?`);
    const options=['alcohol','marihuana','cocaína','piedra/crack','cristal','ácidos','benzodiacepinas','otras'];
    showMultiSelect(options,(sel)=>{
      state.substances=sel; appendUser(sel.join(', '));
      askFrequencyThirdParty();
    });
  });
}
function askFrequencyThirdParty(){
  showTyping(600).then(()=>{
    appendBot('¿Cómo describirías su patrón de consumo?');
    showQuickReplies([
      {text:'Recreativo (ocasional)', onClick:()=>answerFrequencyThird('recreativo')},
      {text:'Consumo frecuente / diario', onClick:()=>answerFrequencyThird('frecuente')},
      {text:'Posible dependencia', onClick:()=>answerFrequencyThird('dependencia')},
      {text:'Creo que ya es adicto', onClick:()=>answerFrequencyThird('adicto')}
    ]);
  });
}
function answerFrequencyThird(val){ state.frequency=val; appendUser(_labelForFrequency(val)); showQuickReplies([]); askQuestionEmotional(); }

function askQuestionEmotional(){
  showTyping(700).then(()=>{
    appendBot('¿Has notado signos de ansiedad, depresión u otros problemas emocionales?');
    showQuickReplies([
      {text:'Sí', className:'positive', onClick:()=>answerEmotional(true)},
      {text:'No', className:'negative', onClick:()=>answerEmotional(false)}
    ]);
  });
}
function answerEmotional(val){ state.emotional=val; appendUser(val?'Sí':'No'); showQuickReplies([]); askDiagnosisQuestion(); }

function askDiagnosisQuestion(){
  showTyping(700).then(()=>{
    const who=(state.subject!=='self')?'tu conocido, amigo o familia':'tú';
    appendBot(`¿Cuentas con algún diagnóstico psiquiátrico o de salud mental de ${who}?`);
    showQuickReplies([
      {text:'Sí', className:'positive', onClick:()=>answerHasDiagnosis(true)},
      {text:'No', className:'negative', onClick:()=>answerHasDiagnosis(false)}
    ]);
  });
}
function answerHasDiagnosis(val){
  appendUser(val?'Sí':'No'); showQuickReplies([]);
  if(val) askWhichDiagnosis(); else askSchedulePsychiatric();
}
function askWhichDiagnosis(){
  showTyping(700).then(()=>{
    appendBot('Selecciona el diagnóstico:');
    const diagnoses=['TDA','TDAH','TLP','TAG','Depresión mayor','Trastorno bipolar','TEPT','TOC','Esquizofrenia','Otros'];
    showQuickReplies(diagnoses.map(d=>({text:d,onClick:()=>answerWhichDiagnosis(d)})));
  });
}
function answerWhichDiagnosis(d){ state.diagnosis=d; appendUser(d); showQuickReplies([]); postQuestionFlow(); }

function askSchedulePsychiatric(){
  showTyping(700).then(()=>{
    appendBot('¿Gustas agendar una cita para consulta psiquiátrica?');
    showQuickReplies([
      {text:'Sí', className:'positive', onClick:()=>answerSchedulePsychiatric(true)},
      {text:'No', className:'negative', onClick:()=>answerSchedulePsychiatric(false)}
    ]);
  });
}
function answerSchedulePsychiatric(val){
  appendUser(val?'Sí':'No'); showQuickReplies([]);
  if(val) showQuickReplies([
    {text:'📅 Agendar consulta', className:'positive', onClick:()=>ctaAction('agendar')},
    {text:'📞 Llamar ahora', className:'negative', onClick:()=>ctaAction('llamar')},
    {text:'💬 WhatsApp', onClick:()=>ctaAction('whatsapp')}
  ]);
  else postQuestionFlow();
}

/* post-question summary */
function postQuestionFlow(){
  showTyping(900).then(()=>{
    const whoText = state.subject==='self'?'tú':`la persona (${state.subject.type})`;
    const substancesText = state.substances.length?state.substances.join(', '):'sustancias no especificadas';
    const freqLabel = state.frequency?_labelForFrequency(state.frequency):'patrón no especificado';
    const emotionalText = state.emotional?'síntomas emocionales presentes':'sin síntomas emocionales reportados';
    const diagnosisText = state.diagnosis?`, diagnóstico: ${state.diagnosis}`:'';
    appendBot(`Resumen de información:\n- Persona: ${whoText}\n- Sustancias: ${substancesText}\n- Frecuencia: ${freqLabel}\n- Estado emocional: ${emotionalText}${diagnosisText}\n\nPodemos orientarte sobre terapias, tratamientos y apoyo.`);
    showQuickReplies([
      {text:'📅 Agendar cita', className:'positive', onClick:()=>ctaAction('agendar')},
      {text:'📞 Llamar', className:'negative', onClick:()=>ctaAction('llamar')},
      {text:'💬 WhatsApp', onClick:()=>ctaAction('whatsapp')}
    ]);
  });
}

/* ---------- CTA actions ---------- */
function ctaAction(action){
  showQuickReplies([]);
  if(action==='agendar'){ appendBot('Te llevamos a la página de agendamiento'); window.open('https://tu-sitio-agenda.example.com','_blank'); }
  else if(action==='llamar'){ appendBot('Número: +52 55 1234 5678'); window.location.href='tel:+525512345678'; }
  else if(action==='whatsapp'){ appendBot('Conectando a WhatsApp...'); window.open('https://wa.me/52XXXXXXXXXXX','_blank'); }
}

/* ---------- Utility ---------- */
function _labelForFrequency(freq){
  if(freq==='recreativo') return 'Recreativo (ocasional)';
  if(freq==='frecuente') return 'Consumo frecuente / diario';
  if(freq==='dependencia') return 'Posible dependencia';
  if(freq==='adicto') return 'Creo que ya soy adicto';
  return freq;
}

/* ---------- Send / Reset handlers ---------- */
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

/* ---------- Suggestions ---------- */
const DEFAULT_KEYWORDS=['tratamiento','terapia','recaídas','consumo de sustancias','contacto'];
function renderSuggestionChips(){
  if(!suggestChips) return;
  const keywordList=[].concat(...Object.values(KEYWORDS));
  const candidates=Array.from(new Set(DEFAULT_KEYWORDS.concat(keywordList).map(k=>k.toString())));
  const toShow=candidates.slice(0,12);
  suggestChips.innerHTML='';
  toShow.forEach(k=>{
    const chip=document.createElement('button');
    chip.className='suggest-chip';
    chip.textContent=k;
    chip.addEventListener('click', ()=>{ appendUser(k); showTyping(700).then(()=> handleKeyword(k)); });
    suggestChips.appendChild(chip);
  });
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  renderSuggestionChips();
  startConversation();
  if(suggestBtn && suggestPanel){
    suggestBtn.addEventListener('click', ()=>{
      const shown=suggestPanel.classList.contains('show');
      if(shown){ suggestPanel.classList.remove('show'); suggestBtn.setAttribute('aria-pressed','false'); }
      else { renderSuggestionChips(); suggestPanel.classList.add('show'); suggestBtn.setAttribute('aria-pressed','true'); }
    });
    suggestPanel.classList.remove('show');
    suggestBtn && suggestBtn.setAttribute('aria-pressed','false');
  }
});
