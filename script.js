/* script.js - maneja chat + suggestions + avatar thinking swap animado */

/* DOM refs */
const msgs = document.getElementById('msgs');
const input = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const suggestBtn = document.getElementById('suggestBtn');
const suggestPanel = document.getElementById('suggestPanel');
const suggestChips = document.getElementById('suggestChips');
const avatarImg = document.getElementById('avatarImg');

/* Palabras clave por defecto */
const KEYWORDS = ['tratamiento','terapia','recaídas','consumo de sustancias','contacto'];

/* ---------- UTIL: append/scroll ---------- */
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

/* ---------- AVATAR REACTION HELPERS ---------- */

/*
  reactWithImage(fileName, duration)
  - fileName: 'avatar-thinking.png' (ruta relativa dentro de assets/, p.e. 'assets/avatar-thinking.png')
  - duration: ms antes de restaurar (opcional, default 900)
*/
let _avatarRestoreTimer = null;
function reactWithImage(fileName, duration = 900) {
  if(!avatarImg) return;
  // guarda estado actual
  const originalSrc = avatarImg.currentSrc || avatarImg.src;
  const originalSrcAttr = avatarImg.getAttribute('src');
  const originalSrcset = avatarImg.getAttribute('srcset');

  // intenta ruta absoluta relativa: si usuario puso 'avatar-thinking.png' permitimos ambas
  const newSrc = fileName.startsWith('assets/') ? fileName : `assets/${fileName}`;

  // animación cross-fade: bajar opacidad, cambiar src, pop
  avatarImg.style.opacity = '0.14';
  // limpia timer previo
  if(_avatarRestoreTimer) { clearTimeout(_avatarRestoreTimer); _avatarRestoreTimer = null; }

  setTimeout(() => {
    // cambia src y quitamos cualquier transformación previa
    avatarImg.src = newSrc;
    // si existen versiones @2x o @3x y deseas usarlas, puedes añadir srcset aquí también:
    // avatarImg.srcset = 'assets/avatar-thinking@2x.png 2x, assets/avatar-thinking@3x.png 3x';
    // restart pop animation
    avatarImg.classList.remove('avatar-react-pop');
    void avatarImg.offsetWidth;
    avatarImg.classList.add('avatar-react-pop');
    avatarImg.style.opacity = '1';
  }, 140);

  // restaurar después de duration
  _avatarRestoreTimer = setTimeout(() => {
    // restore original attributes
    if(originalSrcAttr) avatarImg.setAttribute('src', originalSrcAttr);
    else avatarImg.src = originalSrc;
    if(originalSrcset !== null) avatarImg.setAttribute('srcset', originalSrcset);
    // remove pop class
    avatarImg.classList.remove('avatar-react-pop');
    _avatarRestoreTimer = null;
  }, Math.max(700, duration));
}

/*
  withThinkingImage(asyncFnOrDelay)
  - Si pasas un número: se mostrará avatar-thinking por ese tiempo (ms).
  - Si pasas una función que devuelve una Promise, mostrará avatar-thinking hasta que la promesa resuelva.
  Ejemplo:
    await withThinkingImage(1000); // muestra thinking por 1s
    await withThinkingImage(() => fetch(...)); // muestra thinking hasta que termine fetch
*/
function withThinkingImage(workerOrMs = 900) {
  const thinkingFile = 'assets/avatar-thinking.png';
  if(typeof workerOrMs === 'number') {
    return new Promise(resolve => {
      reactWithImage(thinkingFile, workerOrMs);
      setTimeout(resolve, workerOrMs+10);
    });
  } else if (typeof workerOrMs === 'function') {
    // si la funcion retorna promesa, la esperamos
    const result = workerOrMs();
    if(result && typeof result.then === 'function') {
      reactWithImage(thinkingFile, 2000); // fallback duration si tarda mucho
      return result.finally(() => {
        // restore ocurre en reactWithImage por timer; si deseas restaurar inmediatamente, se puede forzar aquí
      });
    } else {
      // no promise -> tratarlo como delay ms si es number
      return withThinkingImage(parseInt(workerOrMs,10) || 900);
    }
  } else {
    return withThinkingImage(900);
  }
}

/* ---------- SUGGESTIONS / CHIPS ---------- */
function renderSuggestionChips(){
  suggestChips.innerHTML = '';
  KEYWORDS.forEach(k => {
    const chip = document.createElement('button');
    chip.className = 'suggest-chip';
    chip.textContent = k;
    chip.addEventListener('click', ()=> {
      appendUser(k);
      // cuando el usuario clickea chip, muestra thinking image mientras procesamos
      withThinkingImage(900).then(()=> {
        handleKeyword(k);
      });
    });
    suggestChips.appendChild(chip);
  });
}

suggestBtn.addEventListener('click', ()=> {
  const shown = suggestPanel.classList.contains('show');
  if(shown){
    suggestPanel.classList.remove('show');
    suggestBtn.setAttribute('aria-pressed','false');
  } else {
    suggestPanel.classList.add('show');
    suggestBtn.setAttribute('aria-pressed','true');
    renderSuggestionChips();
  }
});

/* ---------- KEYWORD HANDLING ---------- */
function handleKeyword(keyword){
  // aquí hacemos la reacción y la respuesta
  // mostramos thinking image por 1s mientras "procesamos"
  withThinkingImage(1000).then(()=> {
    // respuesta posterior al "thinking"
    appendBot(`Recibí la palabra clave <strong>${keyword}</strong>. Te guío hacia recursos y pasos específicos sobre "${keyword}".`, { reaction: '🔎' });
    // TODO: aquí enlazar el flujo real del keyword
  });
}

/* ---------- SEND / RESET ---------- */
sendBtn.addEventListener('click', ()=> {
  const val = input.value.trim();
  if(!val) return;
  appendUser(val);
  input.value = '';

  // si coincide con keyword: trigger reaction
  const matched = KEYWORDS.find(k => val.toLowerCase().includes(k.toLowerCase()));
  if(matched){
    // show thinking image and then handleKeyword
    withThinkingImage(1000).then(()=> handleKeyword(matched));
    return;
  }

  // genérico: react with thinking then answer
  withThinkingImage(900).then(()=> {
    appendBot('Entiendo. ¿Deseas buscar por palabras clave o prefieres que te conecte con un especialista?');
  });
});

resetBtn.addEventListener('click', ()=> {
  startConversation();
});

/* Enter key */
input.addEventListener('keydown', (e)=> { if(e.key === 'Enter'){ e.preventDefault(); sendBtn.click(); }});

/* ---------- INITIAL CONVERSATION ---------- */
function startConversation(){
  clearMessages();
  appendBot('<strong>Hola — ¿en qué te puedo ayudar hoy?</strong>');
  suggestPanel.classList.remove('show');
  suggestBtn.setAttribute('aria-pressed','false');
  renderSuggestionChips();
}

/* ---------- Avatar load logs ---------- */
avatarImg.addEventListener('load', ()=> console.log('[avatar] loaded', avatarImg.currentSrc));
avatarImg.addEventListener('error', ()=> console.warn('[avatar] failed to load', avatarImg.src));

/* init */
document.addEventListener('DOMContentLoaded', ()=> {
  startConversation();
});
