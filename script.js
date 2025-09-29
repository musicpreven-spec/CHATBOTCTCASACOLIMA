/* script.js - frontend only (no blink; suggestions toggle; reiniciar) */

/* DOM refs */
const msgs = document.getElementById('msgs');
const input = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const suggestBtn = document.getElementById('suggestBtn');
const suggestPanel = document.getElementById('suggestPanel');
const avatarImg = document.getElementById('avatarImg');

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
  const dots = document.createElement('span'); dots.className='dots'; dots.innerHTML = '<span></span><span></span><span></span>';
  thinking.appendChild(dots); wrap.appendChild(thinking); msgs.appendChild(wrap); scrollBottom();
  return wrap;
}

/* Conversation flow: initial greeting only (no quick chips) */
function startConversation(){
  clearMessages();
  appendBot('<strong>Hola — ¿en qué te puedo ayudar hoy?</strong>');
  // ensure suggestions panel hidden
  suggestPanel.classList.remove('show');
  suggestBtn.setAttribute('aria-pressed','false');
}

/* Send handling */
sendBtn.addEventListener('click', ()=> {
  const val = input.value.trim();
  if(!val) return;
  appendUser(val);
  input.value = '';
  const thinking = showThinking();
  setTimeout(()=> {
    thinking.remove();
    // simple reply rules
    if(/tratam|terap|recaid|consum|droga|adicc|cristal|alcohol|cocaína|heroína/i.test(val)){
      appendBot('Gracias por compartir. ¿Quieres información sobre tratamiento, contacto con profesionales o recursos de urgencia?', { reaction:'⚠️' });
    } else if(/hola|hola|buen/gi.test(val)) {
      appendBot('¡Hola! ¿Podrías decirme en una frase qué te preocupa?');
    } else {
      appendBot('Entiendo. ¿Quieres que te dé sugerencias de búsqueda o prefieres que conecte con un especialista?');
    }
  }, 700 + Math.random()*600);
});

/* Restart handling */
resetBtn.addEventListener('click', ()=> {
  startConversation();
});

/* Suggestions toggle */
suggestBtn.addEventListener('click', ()=> {
  const shown = suggestPanel.classList.contains('show');
  if(shown){
    suggestPanel.classList.remove('show');
    suggestBtn.setAttribute('aria-pressed','false');
  } else {
    suggestPanel.classList.add('show');
    suggestBtn.setAttribute('aria-pressed','true');
  }
});

/* Enter key to send */
input.addEventListener('keydown', (e)=> { if(e.key === 'Enter'){ e.preventDefault(); sendBtn.click(); }});

/* Avatar image crispness note: console logs */
document.addEventListener('DOMContentLoaded', ()=> {
  avatarImg.addEventListener('load', ()=> console.log('[avatar] loaded', avatarImg.currentSrc));
  avatarImg.addEventListener('error', ()=> console.warn('[avatar] failed to load', avatarImg.src));
  // Start initial conversation
  startConversation();
});
