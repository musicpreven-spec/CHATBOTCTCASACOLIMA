/* script.js - Versión con: "tratamiento"/"terapia" hotwords, antidoping, y botón Regresar
   Reemplaza completamente tu script.js con este archivo.
*/

/* ---------- Config / Keywords ---------- */
const KEYWORDS = {
  ramaA: ['hijo','hija','hermano','hermana','amigo','amiga','pareja','esposo','esposa','familiar','conocido','ayuda para alguien','apoyo para alguien'],
  ramaB: ['quiero dejar','recaí','recaída','recaídas','necesito ayuda','no puedo controlar','consumo','cristal','droga','alcohol','marihuana','cocaína','adicción','dependiente','problema mío','estoy mal'],
  ramaC: ['terapia','terapias','terapia individual','terapia grupal','consulta','psiquiatra','psiquiatría','tratamiento','tratamiento ambulatorio','tratamiento residencial','programa','recaídas','antidoping','programa sofía','programa sofia','sofia'],
  ramaD: ['contacto','teléfono','tel','celular','número','dirección','ubicación','horario','correo','mail','cita','contacto rápido','whatsapp']
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

/* ---------- Treatments list (Casa Colima) ---------- */
const TREATMENTS = [
  'Tratamiento Ambulatorio',
  'Tratamiento "Medio Camino"',
  'Programa Sofía',
  'Tratamiento Ambulatorio-Ejecutivo',
  'Programa de Recaídas',
  'Tratamiento Residencial'
];

/* ---------- State ---------- */
const state = {
  subject: 'self',
  consumes: null,
  substances: [],
  frequency: null,
  emotional: null,
  diagnosis: null,
  pastTreatments: null,
  treatmentPreference: null,
  barriers: null,
  urgent: false,

  // treatments & contact
  selectedTreatments: [],
  contactMethod: null,   // 'telefono' | 'whatsapp' | 'correo'
  contact: { name: null, phone: null, email: null },
  pending: null,          // 'collect_contact' | 'socio' | null

  // socioeconomico
  surveyIndex: 0,
  surveyResponses: [],
  calculatedDiscount: null,

  // snapshots for "Regresar"
  snapshots: []
};

/* ---------- Helpers UI ---------- */
function scrollBottom(){ if(msgs) msgs.scrollTop = msgs.scrollHeight; }
function clearMessages(){ if(msgs) msgs.innerHTML = ''; }

function appendBot(html, opts = {}) {
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

/* ---------- Snapshot (para Regresar) ---------- */
function pushSnapshot(){
  try {
    state.snapshots.push({
      msgs: msgs ? msgs.innerHTML : '',
      quick: quickReplies ? quickReplies.innerHTML : '',
      placeholder: input ? input.placeholder : ''
    });
    // limit snapshot stack size to avoid memoria infinita
    if(state.snapshots.length > 20) state.snapshots.shift();
  } catch(e){}
}
function canGoBack(){ return state.snapshots && state.snapshots.length > 0; }
function goBack(){
  if(!canGoBack()) return;
  // pop the last snapshot (current view) and then restore previous if exists
  // We want to restore the snapshot before the current one, so pop current and then pop previous
  state.snapshots.pop(); // remove current
  const prev = state.snapshots.pop(); // get previous
  if(!prev) return;
  msgs.innerHTML = prev.msgs;
  quickReplies.innerHTML = prev.quick;
  if(input) input.placeholder = prev.placeholder || 'Escribe un mensaje...';
  // after restoring, push it back as current so user can still go forward/back again
  state.snapshots.push(prev);
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

/* ---------- Quick replies (ahora añade Regresar si procede) ---------- */
function showQuickReplies(buttons = []){
  if(!quickReplies) return;
  quickReplies.innerHTML = '';
  if(!buttons || !buttons.length){
    quickReplies.setAttribute('aria-hidden','true');
    // pero si hay snapshot para regresar, mostrar solo Regresar
    if(canGoBack()){
      quickReplies.setAttribute('aria-hidden','false');
      const backBtn = document.createElement('button');
      backBtn.className = 'qr-btn negative small';
      backBtn.textContent = '⟵ Regresar';
      backBtn.addEventListener('click', ()=> goBack());
      quickReplies.appendChild(backBtn);
    }
    return;
  }
  quickReplies.setAttribute('aria-hidden','false');
  buttons.forEach(b=>{
    const btn = document.createElement('button');
    btn.className = 'qr-btn ' + (b.className || '');
    btn.textContent = b.text;
    btn.addEventListener('click', ()=>{ b.onClick && b.onClick(); });
    quickReplies.appendChild(btn);
  });
  // añadir automáticamente botón "Regresar" si hay snapshot previa
  if(canGoBack()){
    const backBtn = document.createElement('button');
    backBtn.className = 'qr-btn negative small';
    backBtn.textContent = '⟵ Regresar';
    backBtn.addEventListener('click', ()=> goBack());
    quickReplies.appendChild(backBtn);
  }
}

/* Multi-select generic */
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
    btn.setAttribute('aria-pressed','false');
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
  quickReplies.appendChild(container);
  quickReplies.appendChild(actions);
  // añadir Regresar si procede
  if(canGoBack()){
    const backBtn = document.createElement('button');
    backBtn.className = 'qr-btn negative small';
    backBtn.textContent = '⟵ Regresar';
    backBtn.addEventListener('click', ()=> goBack());
    quickReplies.appendChild(backBtn);
  }
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

/* ---------- Special keyword handlers: tratamiento / terapia / antidoping ---------- */
function handleSpecialKeywords(text){
  const t = text.toLowerCase();
  if(t.includes('tratamiento') || t.includes('tratamientos')){
    // mostrar todos los tratamientos
    pushSnapshot();
    showTyping(600).then(()=>{
      appendBot('Aquí están todos los tratamientos que ofrece Casa Colima:');
      appendBot(TREATMENTS.map(t=>`- ${t}`).join('\n'));
      // ofrecer selección multi
      showMultiSelect(TREATMENTS, sel=>{
        if(!sel.length){ appendBot('Debes seleccionar al menos un tratamiento.'); return; }
        state.selectedTreatments = sel;
        appendUser(sel.join(', '));
        askContactAfterTreatmentSelection();
      });
    });
    return true;
  }
  if(t.includes('terapia') || t.includes('terapias')){
    // mostrar opciones de terapia específicas
    pushSnapshot();
    showTyping(600).then(()=>{
      appendBot('Ofrecemos las siguientes opciones de terapia:');
      showQuickReplies([
        { text:'Terapia psicológica Individual/Personal', onClick:()=>{ appendUser('Terapia psicológica Individual/Personal'); handleTherapyIndividual(); } },
        { text:'Terapia Grupal', onClick:()=>{ appendUser('Terapia Grupal'); handleTherapyGroup(); } },
        { text:'Consejería en Adicciones', onClick:()=>{ appendUser('Consejería en Adicciones'); handleCounseling(); } }
      ]);
    });
    return true;
  }
  if(t.includes('antidoping')){
    pushSnapshot();
    showTyping(600).then(()=>{
      appendBot('Antidoping: es una prueba para detectar el uso de sustancias en orina/sangre (según el tipo). Se utiliza para monitoreo y diagnóstico médico. ¿Deseas agendar una cita para realizar un antidoping?');
      showQuickReplies([
        { text:'Sí, agendar', className:'positive', onClick:()=>{ appendUser('Sí, agendar'); startContactCollection('correo'); } }, // pedimos contacto para agendar
        { text:'No, gracias', className:'negative', onClick:()=>{ appendUser('No, gracias'); appendBot('Entendido. Si cambias de opinión, aquí estamos.'); } }
      ]);
    });
    return true;
  }
  return false;
}

/* ---------- Handlers para Terapias ---------- */
function handleTherapyIndividual(){
  pushSnapshot();
  showTyping(400).then(()=>{
    appendBot('La terapia individual puede ser presencial o virtual. ¿Cuál prefieres?');
    showQuickReplies([
      { text:'Presencial', onClick:()=>{ appendUser('Presencial'); askContactForTherapy('Presencial'); } },
      { text:'Virtual', onClick:()=>{ appendUser('Virtual'); askContactForTherapy('Virtual'); } },
    ]);
  });
}
function askContactForTherapy(modality){
  // recolectar contacto para agendar
  state.selectedTreatments = state.selectedTreatments || [];
  if(!state.selectedTreatments.includes('Terapia psicológica Individual/Personal')) state.selectedTreatments.push('Terapia psicológica Individual/Personal');
  appendBot(`Perfecto, agendaremos la terapia ${modality}. Por favor dinos tu NOMBRE completo para registrar la solicitud:`);
  state.pending = 'collect_contact';
  // store modality in contact for context
  state.contact.modality = modality;
}
function handleTherapyGroup(){
  pushSnapshot();
  showTyping(400).then(()=>{
    appendBot('Tenemos una sesión grupal de prueba completamente GRATIS. ¿Deseas reservar un lugar para la sesión de prueba?');
    showQuickReplies([
      { text:'Sí, reservar', className:'positive', onClick:()=>{ appendUser('Sí, reservar'); state.selectedTreatments = state.selectedTreatments || []; if(!state.selectedTreatments.includes('Terapia Grupal')) state.selectedTreatments.push('Terapia Grupal'); state.pending='collect_contact'; appendBot('Perfecto. Por favor indícanos tu NOMBRE completo:'); } },
      { text:'Quiero más info', onClick:()=>{ appendUser('Quiero más info'); appendBot('La sesión grupal es guiada por un terapeuta, duración aproximada 90 min. Ideal para compartir experiencias y herramientas.'); } }
    ]);
  });
}
function handleCounseling(){
  pushSnapshot();
  showTyping(400).then(()=>{
    appendBot('La Consejería en Adicciones consiste en sesiones breves de orientación y apoyo. Para darte seguimiento, por favor indícanos tu NOMBRE y teléfono para que te contactemos a la brevedad.');
    state.selectedTreatments = state.selectedTreatments || [];
    if(!state.selectedTreatments.includes('Consejería en Adicciones')) state.selectedTreatments.push('Consejería en Adicciones');
    state.pending='collect_contact';
  });
}

/* ---------- Flow de conversación completo (mantenido) ---------- */
async function startConversation(){
  clearMessages();
  Object.assign(state,{
    subject:'self', consumes:null, substances:[], frequency:null, emotional:null,
    diagnosis:null, pastTreatments:null, treatmentPreference:null, barriers:null, urgent:false,
    selectedTreatments:[], contactMethod:null, contact:{name:null,phone:null,email:null}, pending:null,
    surveyIndex:0, surveyResponses:[], calculatedDiscount:null, snapshots:[]
  });
  appendBot('<strong>Hola — ¿en qué te puedo ayudar hoy?</strong>');
  await delay(600);
  askQuestionConsume();
}
function delay(ms){ return new Promise(res=>setTimeout(res,ms)); }

function askQuestionConsume(){
  pushSnapshot();
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
  pushSnapshot();
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
  pushSnapshot();
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
  pushSnapshot();
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
  pushSnapshot();
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
  pushSnapshot();
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
  pushSnapshot();
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
  pushSnapshot();
  showTyping(700).then(()=>{
    const who=(state.subject!=='self')?'la persona (conocido, amigo o familia)':'tú';
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
  pushSnapshot();
  showTyping(700).then(()=>{
    appendBot('Selecciona el diagnóstico:');
    const diagnoses=['TDA','TDAH','TLP','TAG','Depresión mayor','Trastorno bipolar','TEPT','TOC','Esquizofrenia','Otros'];
    showQuickReplies(diagnoses.map(d=>({text:d,onClick:()=>answerWhichDiagnosis(d)})));
  });
}
function answerWhichDiagnosis(d){ state.diagnosis=d; appendUser(d); showQuickReplies([]); postQuestionFlow(); }

function askSchedulePsychiatric(){
  pushSnapshot();
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

/* ---------- POST-QUESTION FLOW: detecta patrón que exige residencial ---------- */
function postQuestionFlow(){
  pushSnapshot();
  showTyping(900).then(()=>{
    const whoText = (state.subject==='self')?'tú':`la persona (${state.subject.type})`;
    const substancesText = state.substances.length?state.substances.join(', '):'sustancias no especificadas';
    const freqLabel = state.frequency?_labelForFrequency(state.frequency):'patrón no especificado';
    const emotionalText = state.emotional?'síntomas emocionales presentes':'sin síntomas emocionales reportados';
    const diagnosisText = state.diagnosis?`, diagnóstico: ${state.diagnosis}`:'';
    appendBot(`Resumen de información:\n- Persona: ${whoText}\n- Sustancias: ${substancesText}\n- Frecuencia: ${freqLabel}\n- Estado emocional: ${emotionalText}${diagnosisText}\n\nPodemos orientarte sobre terapias, tratamientos y apoyo.`);
    // --- Si el patrón es 'frecuente' o 'adicto' sugerimos residencial directamente ---
    if(state.frequency === 'frecuente' || state.frequency === 'adicto'){
      suggestResidentialDueToPattern();
    } else {
      showQuickReplies([
        {text:'📅 Agendar cita', className:'positive', onClick:()=>ctaAction('agendar')},
        {text:'📞 Llamar', className:'negative', onClick:()=>ctaAction('llamar')},
        {text:'💬 WhatsApp', onClick:()=>ctaAction('whatsapp')},
        {text:'Elegir tratamiento', onClick:()=>askTreatmentsAfterSummary()}
      ]);
    }
  });
}

/* ---------- RESIDENCIAL / DESCUENTO FAMILIAR ---------- */
function suggestResidentialDueToPattern(){
  pushSnapshot();
  showTyping(700).then(()=>{
    appendBot('Por el patrón de consumo que mencionaste, recomendamos <strong>Tratamiento Residencial</strong>, que incluye contención y desintoxicación supervisada. ¿Deseas que te proporcione más información o aplicar para este tratamiento?');
    showQuickReplies([
      {text:'Sí, deseo Residencial', className:'positive', onClick:()=>{ appendUser('Sí, deseo Residencial'); state.selectedTreatments = ['Tratamiento Residencial']; offerFamilyDiscountPrompt(); }},
      {text:'Más información', onClick:()=>{ appendUser('Más información'); ctaAction('info_residencial'); }},
      {text:'No, prefiero otra opción', onClick:()=>{ appendUser('No, prefiero otra opción'); askTreatmentsAfterSummary(); }}
    ]);
  });
}

function offerFamilyDiscountPrompt(){
  pushSnapshot();
  showTyping(500).then(()=>{
    appendBot('¿Te interesa aplicar para un descuento familiar que puede reducir el costo del tratamiento?');
    showQuickReplies([
      {text:'Sí, deseo descuento', className:'positive', onClick:()=>{ appendUser('Sí, deseo descuento'); askApplyFamilyDiscount(true); }},
      {text:'No, gracias', className:'negative', onClick:()=>{ appendUser('No, gracias'); askContactAfterTreatmentSelection(); }}
    ]);
  });
}

function askApplyFamilyDiscount(wants){
  if(wants){
    startSocioEconomicSurvey();
  } else {
    askContactAfterTreatmentSelection();
  }
}

/* ---------- SOCIOECONÓMICO (sencillo, formal, discreto) ---------- */
const SURVEY_QUESTIONS = [
  { key:'hogar', q: 'Para entender mejor tu situación: ¿cuántas personas viven en tu hogar (incluyéndote)?', type:'choices',
    choices: ['1','2','3-4','5 o más'] },
  { key:'ingreso', q: 'De manera aproximada, ¿cómo describirías los ingresos totales mensuales del hogar?', type:'choices',
    choices: ['Menos de 6,000','6,000 - 12,000','12,001 - 25,000','Más de 25,000'] },
  { key:'empleo', q: '¿Cuál es tu situación laboral principal?', type:'choices',
    choices: ['Sin empleo','Empleo informal / trabajos eventuales','Empleo formal tiempo parcial','Empleo formal tiempo completo'] },
  { key:'gastos_medicos', q: '¿Tienes gastos médicos regulares (tratamientos, medicamentos) que afectan el presupuesto familiar?', type:'choices',
    choices: ['Sí, significativos','Algunos gastos','Pocos o ninguno','No'] },
  { key:'vivienda', q: '¿Cómo describirías la situación de vivienda?', type:'choices',
    choices: ['Alquilada con dificultad para pagar','Alquilada sin dificultades','Vivienda propia con hipoteca/crédito','Vivienda propia sin carga financiera'] },
  { key:'apoyos', q: '¿Recibes algún apoyo o beneficio social (programas, ayudas, pensiones)?', type:'choices',
    choices: ['Sí, apoyo regular','Apoyo ocasional','No recibimos apoyos','No deseo responder'] },
  { key:'responsabilidades', q: '¿Tienes dependientes económicos (niños, adultos mayores) a tu cargo?', type:'choices',
    choices: ['Sí, varios','Sí, uno','No'] }
];

function startSocioEconomicSurvey(){
  pushSnapshot();
  state.surveyIndex = 0;
  state.surveyResponses = [];
  state.pending = 'socio';
  showTyping(400).then(()=>{
    appendBot('Vamos a realizar unas preguntas breves, confidenciales y formales para evaluar si aplicas al descuento. Si prefieres no responder alguna, selecciona "Prefiero no decir". ¿Deseas continuar?');
    showQuickReplies([
      {text:'Continuar', className:'positive', onClick:()=>{ appendUser('Continuar'); askNextSurveyQuestion(); }},
      {text:'Prefiero no decir', className:'negative', onClick:()=>{ appendUser('Prefiero no decir'); state.pending=null; askContactAfterTreatmentSelection(); }}
    ]);
  });
}

function askNextSurveyQuestion(){
  const i = state.surveyIndex;
  if(i >= SURVEY_QUESTIONS.length){
    finalizeSocioEconomicSurvey();
    return;
  }
  pushSnapshot();
  const item = SURVEY_QUESTIONS[i];
  showTyping(500).then(()=>{
    appendBot(item.q);
    const opts = item.choices.map(ch => ({ text: ch, onClick: ()=>{ processSurveyAnswer(ch); } }));
    opts.push({ text: 'Prefiero no decir', onClick: ()=>{ processSurveyAnswer('Prefiero no decir'); }});
    showQuickReplies(opts);
  });
}

function processSurveyAnswer(answer){
  state.surveyResponses.push(answer);
  appendUser(answer);
  state.surveyIndex += 1;
  if(state.surveyIndex < SURVEY_QUESTIONS.length) askNextSurveyQuestion();
  else finalizeSocioEconomicSurvey();
}

function finalizeSocioEconomicSurvey(){
  state.pending = null;
  const score = calculateSocioScore(state.surveyResponses);
  const discount = mapScoreToDiscount(score);
  state.calculatedDiscount = discount;
  pushSnapshot();
  showTyping(900).then(()=>{
    appendBot(`Gracias por tu confianza. De acuerdo con la información proporcionada, podrías ser acreedor a un descuento del ${discount}% para el Tratamiento Residencial. Uno de nuestros especialistas revisará tu caso con discreción y se comunicará contigo.`);
    askContactAfterTreatmentSelection();
  });
}

function calculateSocioScore(responses){
  let s = 0;
  const a0 = responses[0] || '';
  if(a0 === '1') s += 1; else if(a0 === '2') s += 2; else if(a0 === '3-4') s += 4; else if(a0 === '5 o más') s += 6;
  const a1 = responses[1] || '';
  if(a1 === 'Menos de 6,000') s += 6; else if(a1 === '6,000 - 12,000') s += 4; else if(a1 === '12,001 - 25,000') s += 2; else if(a1 === 'Más de 25,000') s += 0;
  const a2 = responses[2] || '';
  if(a2 === 'Sin empleo') s += 6; else if(a2 === 'Empleo informal / trabajos eventuales') s += 4; else if(a2 === 'Empleo formal tiempo parcial') s += 2; else if(a2 === 'Empleo formal tiempo completo') s += 0;
  const a3 = responses[3] || '';
  if(a3 === 'Sí, significativos') s += 6; else if(a3 === 'Algunos gastos') s += 4; else if(a3 === 'Pocos o ninguno') s += 1; else if(a3 === 'No') s += 0;
  const a4 = responses[4] || '';
  if(a4 === 'Alquilada con dificultad para pagar') s += 6; else if(a4 === 'Alquilada sin dificultades') s += 3; else if(a4 === 'Vivienda propia con hipoteca/crédito') s += 2; else if(a4 === 'Vivienda propia sin carga financiera') s += 0;
  const a5 = responses[5] || '';
  if(a5 === 'Sí, apoyo regular') s += 0; else if(a5 === 'Apoyo ocasional') s += 2; else if(a5 === 'No recibimos apoyos') s += 4; else if(a5 === 'No deseo responder') s += 2;
  const a6 = responses[6] || '';
  if(a6 === 'Sí, varios') s += 6; else if(a6 === 'Sí, uno') s += 3; else if(a6 === 'No') s += 0;
  return s;
}
function mapScoreToDiscount(score){
  if(score <= 3) return 10;
  if(score <= 8) return 20;
  if(score <= 13) return 30;
  if(score <= 18) return 40;
  if(score <= 23) return 50;
  if(score <= 28) return 60;
  return 70;
}

/* ---------- Selección de tratamientos y recolección de contacto ---------- */
function askTreatmentsAfterSummary(){
  pushSnapshot();
  showTyping(700).then(()=>{
    appendBot('Elige uno o varios tratamientos de interés:');
    showMultiSelect(TREATMENTS, (sel)=>{
      if(!sel.length){ appendBot('Debes seleccionar al menos un tratamiento.'); return; }
      state.selectedTreatments = sel;
      appendUser(sel.join(', '));
      showTyping(600).then(()=>{
        appendBot(`Gracias. Para brindarte un servicio personalizado (consulta gratis y sin costo), necesitamos tus datos y tu método de contacto preferido. ¿Cómo prefieres que te contactemos?`);
        showQuickReplies([
          {text:'📞 Teléfono', onClick:()=>{ appendUser('Teléfono'); startContactCollection('telefono'); }},
          {text:'💬 WhatsApp', onClick:()=>{ appendUser('WhatsApp'); startContactCollection('whatsapp'); }},
          {text:'✉️ Correo electrónico', onClick:()=>{ appendUser('Correo'); startContactCollection('correo'); }}
        ]);
      });
    });
  });
}

function askContactAfterTreatmentSelection(){
  pushSnapshot();
  showTyping(500).then(()=>{
    appendBot('Para continuar, por favor indícanos tu método de contacto preferido:');
    showQuickReplies([
      {text:'📞 Teléfono', onClick:()=>{ appendUser('Teléfono'); startContactCollection('telefono'); }},
      {text:'💬 WhatsApp', onClick:()=>{ appendUser('WhatsApp'); startContactCollection('whatsapp'); }},
      {text:'✉️ Correo electrónico', onClick:()=>{ appendUser('Correo'); startContactCollection('correo'); }}
    ]);
  });
}

function startContactCollection(method){
  state.contactMethod = method;
  state.pending = 'collect_contact';
  state.contact = { name:null, phone:null, email:null };
  const methodText = method==='telefono'?'teléfono':(method==='whatsapp'?'WhatsApp':'correo electrónico');
  appendBot(`Perfecto. Vamos a registrar tus datos para que el equipo se comunique por ${methodText}. La consulta es gratis y no tiene costo. Por favor escribe tu NOMBRE completo:`);
  if(input) input.focus();
}

/* Procesar contacto paso a paso desde el campo de texto (sendBtn handler lo usa) */
function processContactInput(text){
  if(!state.pending) return false;
  if(state.pending === 'collect_contact'){
    if(!state.contact.name){
      state.contact.name = text;
      appendUser(text);
      appendBot('Gracias. Ahora escribe tu NÚMERO de teléfono (incluye lada si aplica):');
      return true;
    }
    if(!state.contact.phone){
      state.contact.phone = text;
      appendUser(text);
      appendBot('Perfecto. Finalmente escríbenos tu CORREO electrónico:');
      return true;
    }
    if(!state.contact.email){
      state.contact.email = text;
      appendUser(text);
      state.pending = null;
      const discountText = state.calculatedDiscount ? ` Se aplicará un descuento del ${state.calculatedDiscount}% según el estudio socioeconómico.` : '';
      showTyping(700).then(()=>{
        appendBot(`Gracias ${state.contact.name}. Hemos registrado:\n- Tratamiento(s): ${state.selectedTreatments.join(', ')}\n- Método de contacto preferido: ${state.contactMethod}\n- Teléfono: ${state.contact.phone}\n- Correo: ${state.contact.email}\n\nLa consulta es GRATIS y uno de nuestros especialistas te contactará a la brevedad para darte atención personalizada.${discountText}`);
        showQuickReplies([
          {text:'📞 Llamar ahora', className:'negative', onClick:()=>ctaAction('llamar')},
          {text:'💬 Abrir WhatsApp', onClick:()=>ctaAction('whatsapp')},
          {text:'📅 Agendar cita', className:'positive', onClick:()=>ctaAction('agendar')}
        ]);
      });
      return true;
    }
  }
  if(state.pending === 'socio'){
    if(text.toLowerCase().includes('prefiero')){
      appendUser(text);
      state.pending = null;
      appendBot('Entendido. No hay problema. Si deseas, podemos continuar con la recolección de contacto.');
      askContactAfterTreatmentSelection();
      return true;
    }
    appendBot('Por favor selecciona una de las opciones mostradas para esta pregunta.');
    return true;
  }
  return false;
}

/* ---------- Nuevas preguntas: historial, preferencia, barreras, urgencia (mantengo) ---------- */
function askPastTreatments(){
  pushSnapshot();
  showTyping(700).then(()=>{
    appendBot('¿Has intentado algún tratamiento antes (terapias, programas, medicación)?');
    showQuickReplies([
      {text:'Sí', className:'positive', onClick:()=>answerPastTreatments(true)},
      {text:'No', className:'negative', onClick:()=>answerPastTreatments(false)}
    ]);
  });
}
function answerPastTreatments(val){
  state.pastTreatments = val;
  appendUser(val?'Sí':'No'); showQuickReplies([]);
  if(val) showTyping(700).then(()=>{ appendBot('¿Cuál fue el resultado? ¿Ayudó, fue parcial o no funcionó?'); showQuickReplies([
      {text:'Ayudó', onClick:()=>{ appendUser('Ayudó'); askTreatmentPreference(); }},
      {text:'Parcial', onClick:()=>{ appendUser('Parcial'); askTreatmentPreference(); }},
      {text:'No funcionó', onClick:()=>{ appendUser('No funcionó'); askTreatmentPreference(); }}
    ]); });
  else askTreatmentPreference();
}

function askTreatmentPreference(){
  pushSnapshot();
  showTyping(700).then(()=>{
    appendBot('¿Tienes preferencia por tratamiento ambulatorio (seguir en casa) o residencial (internamiento)?');
    showQuickReplies([
      {text:'Ambulatorio', onClick:()=>answerTreatmentPreference('ambulatorio')},
      {text:'Residencial', onClick:()=>answerTreatmentPreference('residencial')},
      {text:'No sé / necesito orientación', onClick:()=>answerTreatmentPreference('indiferente')}
    ]);
  });
}
function answerTreatmentPreference(val){
  state.treatmentPreference = val;
  appendUser(val==='indiferente'?'No sé / necesito orientación':(val==='ambulatorio'?'Ambulatorio':'Residencial'));
  showQuickReplies([]);
  askBarriers();
}

function askBarriers(){
  pushSnapshot();
  showTyping(700).then(()=>{
    appendBot('¿Qué barreras tienes para acceder al tratamiento? (puedes elegir varias)');
    showMultiSelect(['Costo','Transporte','Trabajo / permiso','Estigma / familia','Tiempo / horario','Ninguna / puedo acceder'], (sel)=>{
      state.barriers = sel;
      appendUser(sel.join(', '));
      showQuickReplies([
        {text:'Continuar', className:'positive', onClick:()=>postTreatmentOptions()}
      ]);
    });
  });
}

function postTreatmentOptions(){
  pushSnapshot();
  showTyping(700).then(()=>{
    appendBot('Con la información que nos diste, podemos ofrecer:\n- Orientación en terapia individual/grupal\n- Opciones de tratamiento ambulatorio o residencial\n- Programa Sofía (apoyo psicosocial)\n- Programa de Recaídas (seguimiento)');
    showQuickReplies([
      {text:'Programa Sofía', onClick:()=>ctaAction('sofia')},
      {text:'Programa de Recaídas', onClick:()=>ctaAction('recaidas')},
      {text:'Quiero agendar', className:'positive', onClick:()=>ctaAction('agendar')},
      {text:'Hablar con un especialista', className:'negative', onClick:()=>ctaAction('llamar')}
    ]);
  });
}

function askUrgentHelp(){
  pushSnapshot();
  showTyping(500).then(()=>{
    appendBot('¿Hay riesgo inmediato para la persona (pensamientos suicidas, riesgo de daño a sí mismo o a otros)?');
    showQuickReplies([
      {text:'Sí', className:'negative', onClick:()=>answerUrgentHelp(true)},
      {text:'No', onClick:()=>answerUrgentHelp(false)}
    ]);
  });
}
function answerUrgentHelp(val){
  state.urgent = val;
  appendUser(val?'Sí':'No');
  showQuickReplies([]);
  if(val){
    showTyping(700).then(()=>{
      appendBot('Si hay riesgo inmediato, llama a los servicios de emergencia locales (911) o a la línea de crisis. ¿Deseas que te muestre contactos de emergencia?');
      showQuickReplies([
        {text:'Sí, mostrar contactos', onClick:()=>{ appendUser('Sí, mostrar contactos'); showCrisisContacts(); }},
        {text:'No, gracias', onClick:()=>{ appendUser('No, gracias'); postTreatmentOptions(); }}
      ]);
    });
  } else {
    postTreatmentOptions();
  }
}

function showCrisisContacts(){
  appendBot('Contactos de emergencia sugeridos:\n- Emergencias (911)\n- Línea de ayuda local / estado\n- Si deseas, podemos conectar por teléfono con uno de nuestros especialistas.');
  showQuickReplies([
    {text:'📞 Llamar ahora', className:'negative', onClick:()=>ctaAction('llamar')},
    {text:'💬 WhatsApp', onClick:()=>ctaAction('whatsapp')},
    {text:'📅 Agendar', className:'positive', onClick:()=>ctaAction('agendar')}
  ]);
}

/* ---------- CTA actions ---------- */
function ctaAction(action){
  showQuickReplies([]);
  if(action==='agendar'){ appendBot('Te llevamos a la página de agendamiento'); window.open('https://tu-sitio-agenda.example.com','_blank'); }
  else if(action==='llamar'){ appendBot('Número: +52 55 1234 5678'); try{ window.location.href='tel:+525512345678'; }catch(e){} }
  else if(action==='whatsapp'){ appendBot('Conectando a WhatsApp...'); window.open('https://wa.me/52XXXXXXXXXXX','_blank'); }
  else if(action==='sofia'){ appendBot('Programa Sofía: apoyo psicosocial y seguimiento. Te enviamos información y opciones de inscripción.'); showQuickReplies([
      {text:'Quiero inscribirme', className:'positive', onClick:()=>ctaAction('agendar')},
      {text:'Más info', onClick:()=>appendBot('El Programa Sofía incluye sesiones psicoeducativas, acompañamiento y derivación cuando es necesario.')}
    ]); }
  else if(action==='recaidas'){ appendBot('Programa de Recaídas: seguimiento especializado para reducir riesgos y prevenir futuras recaídas.'); showQuickReplies([
      {text:'Quiero seguimiento', className:'positive', onClick:()=>ctaAction('agendar')},
      {text:'Más info', onClick:()=>appendBot('Incluye grupos de prevención de recaídas, herramientas prácticas y acompañamiento profesional.')}
    ]); }
  else if(action==='info_terapia_individual'){ appendBot('Terapia individual: sesiones uno a uno con terapeutas especializados. Podemos agendar o darte opciones de horarios.'); showQuickReplies([{text:'Agendar', className:'positive', onClick:()=>ctaAction('agendar')},{text:'Hablar con especialista', className:'negative', onClick:()=>ctaAction('llamar')}]);}
  else if(action==='info_ambulatorio'){ appendBot('Tratamiento ambulatorio: programas con visitas regulares y terapias sin internamiento.'); showQuickReplies([{text:'Quiero este', className:'positive', onClick:()=>ctaAction('agendar')},{text:'Preguntar precio', onClick:()=>appendBot('Nuestros costos varían según el plan; podemos darte opciones privadas y con apoyo según disponibilidad.') }]);}
  else if(action==='info_residencial'){ appendBot('Tratamiento residencial: estadía supervisada con programa terapéutico completo, contención y desintoxicación cuando es necesario.'); showQuickReplies([{text:'Ver disponibilidad', className:'positive', onClick:()=>ctaAction('agendar')},{text:'Más detalles', onClick:()=>appendBot('Incluye: alojamiento, terapias diarias, actividades psicosociales y supervisión médica cuando es necesario.')}]);}
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
    // Si estamos procesando contacto/socio, atender primero
    if(state.pending === 'collect_contact' || state.pending === 'socio'){
      const handled = processContactInput(val);
      if(handled){
        if(input) input.value='';
        return;
      }
    }
    appendUser(val);
    if(input) input.value='';
    // priorizar special keywords
    if(handleSpecialKeywords(val)) return;
    // fallback keyword routing
    const cat = findKeywordCategory(val);
    if(cat) showTyping(900).then(()=> handleKeyword(val));
    else showTyping(900).then(()=> appendBot('Gracias. Puedes seleccionar una opción o escribir una palabra clave (ej. "terapia", "tratamiento", "antidoping" o "agendar").'));
  });
}
if(resetBtn) resetBtn.addEventListener('click', ()=> startConversation());
if(input) input.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); sendBtn && sendBtn.click(); }});

/* ---------- Suggestions (incluye 'antidoping') ---------- */
const DEFAULT_KEYWORDS=['tratamiento','terapia','recaídas','consumo de sustancias','contacto','Programa Sofía','Programa de Recaídas','antidoping'];
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
    chip.addEventListener('click', ()=>{ appendUser(k); showTyping(700).then(()=> { if(handleSpecialKeywords(k)) return; handleKeyword(k); }); });
    suggestChips.appendChild(chip);
  });
}

/* ---------- Basic keyword handler (no special words) ---------- */
function handleKeyword(text){
  const cat = findKeywordCategory(text);
  if(cat==='ramaA'){
    showTyping(700).then(()=>{
      appendBot('Entiendo. ¿Es para alguien más (familiar, amigo o conocido)?');
      showQuickReplies([
        {text:'Familiar', onClick:()=>{ state.subject={type:'familiar'}; appendUser('Familiar'); askSubstancesThirdParty('familiar'); }},
        {text:'Amigo', onClick:()=>{ state.subject={type:'amigo'}; appendUser('Amigo'); askSubstancesThirdParty('amigo'); }},
        {text:'Conocido', onClick:()=>{ state.subject={type:'conocido'}; appendUser('Conocido'); askSubstancesThirdParty('conocido'); }}
      ]);
    });
    return;
  }
  if(cat==='ramaB'){
    showTyping(700).then(()=>{
      appendBot('Gracias por confiar. ¿Actualmente consumes o fue una recaída reciente?');
      showQuickReplies([
        {text:'Actualmente sí', className:'positive', onClick:()=>answerConsume(true)},
        {text:'Fue una recaída', onClick:()=>{ appendUser('Fue una recaída'); state.consumes=true; askSubstancesSelf(); }},
        {text:'No, pero necesito orientación', onClick:()=>{ appendUser('No, pero necesito orientación'); postQuestionFlow(); }}
      ]);
    });
    return;
  }
  if(cat==='ramaC'){
    showTyping(700).then(()=>{
      appendBot('Ofrecemos varios servicios incluyendo Programa Sofía y Programa de Recaídas. ¿Cuál te interesa?');
      showQuickReplies([
        {text:'Programa Sofía', onClick:()=>{ appendUser('Programa Sofía'); ctaAction('sofia'); }},
        {text:'Tratamiento Ambulatorio', onClick:()=>{ appendUser('Tratamiento Ambulatorio'); ctaAction('info_ambulatorio'); }},
        {text:'Tratamiento Residencial', onClick:()=>{ appendUser('Tratamiento Residencial'); ctaAction('info_residencial'); }}
      ]);
    });
    return;
  }
  if(cat==='ramaD'){
    showTyping(600).then(()=>{
      appendBot('Puedes contactarnos por: teléfono, WhatsApp o agendar una cita. ¿Qué prefieres?');
      showQuickReplies([
        {text:'📞 Llamar', className:'negative', onClick:()=>ctaAction('llamar')},
        {text:'💬 WhatsApp', onClick:()=>ctaAction('whatsapp')},
        {text:'📅 Agendar', className:'positive', onClick:()=>ctaAction('agendar')}
      ]);
    });
    return;
  }
  showTyping(700).then(()=> appendBot('Lo siento, no entendí completamente. Usa las sugerencias o escribe "tratamiento", "terapia", "antidoping" o "agendar".'));
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


