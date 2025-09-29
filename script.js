/* script.js - Avatar full header + suggestions chips + keyword handling */

/* DOM refs */
const msgs = document.getElementById('msgs');
const input = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const suggestBtn = document.getElementById('suggestBtn');
const suggestPanel = document.getElementById('suggestPanel');
const suggestChips = document.getElementById('suggestChips');
const avatarImg = document.getElementById('avatarImg');

/* Default keywords (will appear as chips) */
const KEYWORDS = ['tratamiento','terapia','recaídas','consumo de sustancias','contacto'];

/* Helpers */
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
function showThinking(){
  const wrap = document.createElement('div');
  wrap.className = 'bot-row';
  const thinking = document.createElement('div'); thinking.className = 'thinking-bubble';
  const dots = document.createElement('span'); dots.className = 'dots'; dots.innerHTML = '<span></span><span></span><span></span>';
  thinking.appendChild(dots); wrap.appendChild(thinking); msgs.appendChild(wrap); scrollBottom();
  return wrap;
}

/* Build suggestion chips */
function renderSuggestionChips(){
  suggestChips.innerHTML = '';
  KEYWORDS.forEach(k => {
    const chip = document.createElement('button');
    chip.className = 'suggest-chip';
    chip.textContent = k;
    chip.addEventListener('click', ()=> {
      // when user clicks a chip, act as if they sent that keyword
      appendUser(k);
      handleKeyword(k);
    });
    suggestChips.appendChild(chip);
  });
}

/* Toggle suggestions panel */
suggestBtn.addEventListener('click', ()=> {
  const shown = suggestPanel.classList.contains('show');
  if(shown){
    suggestPanel.classList.remove('show');
    suggestBtn.setAttribute('aria-pressed','false');
  } else {
    suggestPanel.classList.add('show');
    suggestBtn.setAttribute('aria-pressed','true');
    // ensure chips present
    renderSuggestionChips();
  }
});

/* Keyword handler - aqui conectaremos el flujo real más adelante */
function handleKeyword(keyword){
  // placeholder: show thinking then route to the 'keyword process'
  const thinking = showThinking();
  setTimeout(()=> {
    thinking.remove();
    appendBot(`Recibí la palabra clave <strong>${keyword}</strong>. Te guío hacia recursos y pasos específicos sobre "${keyword}". (Flujo a desarrollar)`, { reaction: '🔎' });
    // TODO: aquí puedes disparar navegación a la sección correspondiente o mostrar más opciones
  }, 700 + Math.random()*400);
}

/* Send handling: if user types a known keyword, call handleKeyword */
sendBtn.addEventListener('click', ()=> {
  const val = input.value.trim();
  if(!val) return;
  appendUser(val);
  input.value = '';

  // check if matches a keyword (simple contains check, case-insensitive)
  const matched = KEYWORDS.find(k => val.toLowerCase().includes(k.toLowerCase()));
  if(matched){
    handleKeyword(matched);
    return;
  }

  // else generic reply
  const thinking = showThinking();
  setTimeout(()=> {
    thinking.remove();
    appendBot('Entiendo. ¿Deseas buscar por palabras clave o prefieres que te conecte con un especialista?');
  }, 700 + Math.random()*500);
});

/* Restart */
resetBtn.addEventListener('click', ()=> {
  startConversation();
});

/* Enter key */
input.addEventListener('keydown', (e)=> { if(e.key === 'Enter'){ e.preventDefault(); sendBtn.click(); }});

/* Start conversation state */
function startConversation(){
  clearMessages();
  appendBot('<strong>Hola — ¿en qué te puedo ayudar hoy?</strong>');
  // hide suggestions panel initially
  suggestPanel.classList.remove('show');
  suggestBtn.setAttribute('aria-pressed','false');
  // render chips in background (but hidden)
  renderSuggestionChips();
}

/* Avatar crispness: log the source */
avatarImg.addEventListener('load', ()=> console.log('[avatar] loaded', avatarImg.currentSrc));
avatarImg.addEventListener('error', ()=> console.warn('[avatar] failed to load', avatarImg.src));

/* init */
document.addEventListener('DOMContentLoaded', ()=> {
  startConversation();
});
