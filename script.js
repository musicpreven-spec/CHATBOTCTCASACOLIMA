/* script.js - Chat UI (frontend only) */

/* Avatar image files in assets/ - ajusta si cambias nombres */
const AVATARS = {
  idle: 'assets/avatar_idle.png',
  blink: 'assets/avatar_blink.png',
  smile: 'assets/avatar_smile.png',
  wink: 'assets/avatar_wink.png',
  nod: 'assets/avatar_nod.png'
};

/* Preload */
function preloadImages(list){
  const promises = [];
  Object.values(list).forEach(src => {
    const img = new Image();
    img.src = src;
    promises.push(new Promise(res => { img.onload = res; img.onerror = res; }));
  });
  return Promise.all(promises);
}

/* DOM refs */
const msgs = document.getElementById('msgs');
const input = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const avatarImg = document.getElementById('avatarImg');
const avatarGlow = document.getElementById('avatarGlow');

/* scroll helper */
function scrollBottom(){ msgs.scrollTop = msgs.scrollHeight; }

/* message helpers */
function appendBot(html, opts = {}) {
  const bubble = document.createElement('div');
  bubble.className = 'bubble bot';
  bubble.innerHTML = html;
  if (opts.reaction) {
    const r = document.createElement('span');
    r.className = 'reaction-pop';
    r.textContent = opts.reaction;
    bubble.appendChild(r);
  }
  msgs.appendChild(bubble);
  scrollBottom();
}
function appendUser(text) {
  const bubble = document.createElement('div');
  bubble.className = 'bubble user';
  bubble.textContent = text;
  msgs.appendChild(bubble);
  scrollBottom();
}
function showThinking() {
  const wrap = document.createElement('div');
  wrap.className = 'bot-row';
  const thinking = document.createElement('div');
  thinking.className = 'thinking-bubble';
  const dots = document.createElement('span');
  dots.className = 'dots';
  dots.innerHTML = '<span></span><span></span><span></span>';
  thinking.appendChild(dots);
  wrap.appendChild(thinking);
  msgs.appendChild(wrap);
  scrollBottom();
  return wrap;
}

/* Avatar expression API */
let avatarTimer = null;
function setAvatarExpression(name = 'idle', opts = {}) {
  opts = Object.assign({ effect: 'none', duration: 800 }, opts);
  if (!AVATARS[name]) name = 'idle';

  // remove possible classes
  avatarImg.classList.remove('avatar-spin', 'avatar-flip');
  avatarGlow.classList.remove('avatar-glow-on');

  if (opts.effect === 'spin') avatarImg.classList.add('avatar-spin');
  if (opts.effect === 'flip') avatarImg.classList.add('avatar-flip');
  if (opts.effect === 'glow') avatarGlow.classList.add('avatar-glow-on');

  // crossfade swap
  avatarImg.style.transition = 'opacity .18s ease, transform .35s ease, filter .35s ease';
  avatarImg.style.opacity = '0.14';

  if (avatarTimer) clearTimeout(avatarTimer);
  avatarTimer = setTimeout(() => {
    avatarImg.src = AVATARS[name];
    avatarImg.style.opacity = '1';
    if (opts.effect === 'glow') {
      setTimeout(() => avatarGlow.classList.remove('avatar-glow-on'), Math.max(600, opts.duration || 800));
    }
  }, 140);
}

/* expose to global for console */
window.chatbotAvatar = { setAvatarExpression };

/* Chat demo logic (frontend only) */
function botReplySimulated(text, opts = {}) {
  setAvatarExpression('blink', { effect: 'flip' });
  const thinking = showThinking();
  const delay = 800 + Math.min(1200, text.length * 10);
  setTimeout(() => {
    thinking.remove();
    appendBot(text, opts);
    setAvatarExpression('smile', { effect: 'glow', duration: 900 });
  }, delay);
}

function startChat() {
  appendBot('<strong>Hola — soy el especialista de Casa Colima.</strong><br>¿En qué te puedo ayudar hoy?');
  const wrapper = document.createElement('div');
  wrapper.style.marginTop = '8px';
  const chips = document.createElement('div');
  chips.className = 'quick-options';
  ['Problemas de adicción', 'Buscar apoyo', 'Contacto', 'Recursos inmediatos'].forEach(opt => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = opt;
    b.onclick = () => {
      appendUser(opt);
      setAvatarExpression('nod', { effect: 'spin' });
      if (opt === 'Problemas de adicción') botReplySimulated('Siento que estés pasando por eso. ¿Qué sustancia te preocupa o afecta a alguien cercano?', { reaction: '⚠️' });
      else if (opt === 'Buscar apoyo') botReplySimulated('Puedo ayudarte a encontrar grupos de apoyo y terapia presencial o en línea. ¿Qué prefieres?');
      else if (opt === 'Contacto') botReplySimulated('Tel: 55 1234 5678 · correo: contacto@casacolima.mx');
      else botReplySimulated('Te envío técnicas breves para manejar ansiedad y craving. ¿Por cuál vía prefieres recibirlas?');
    };
    chips.appendChild(b);
  });
  wrapper.appendChild(chips);
  msgs.appendChild(wrapper);
  scrollBottom();
}

/* send handling */
sendBtn.addEventListener('click', () => {
  const val = input.value.trim();
  if (!val) return;
  appendUser(val);
  input.value = '';
  setAvatarExpression('blink', { effect: 'flip' });
  const thinking = showThinking();
  setTimeout(() => {
    thinking.remove();
    if (/adicci|droga|cristal|alcohol|heroína|cocaína/i.test(val)) {
      appendBot('Gracias por compartir. ¿Hay riesgo físico inmediato? (si/no)', { reaction: '⚠️' });
      setAvatarExpression('smile', { effect: 'glow' });
    } else if (/gracias|ok|vale|perfecto/i.test(val)) {
      appendBot('Me alegra ser de ayuda. ¿Deseas que reserve una sesión o te envío recursos?', { reaction: '😊' });
      setAvatarExpression('smile', { effect: 'spin' });
    } else {
      appendBot('Entiendo. ¿Deseas que te ofrezca recursos, un contacto o agende una llamada?');
      setAvatarExpression('idle');
    }
  }, 700 + Math.random() * 600);
});
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendBtn.click(); } });

/* Start once assets are preloaded */
preloadImages(AVATARS).then(() => {
  setAvatarExpression('idle');
  startChat();
}).catch(() => {
  setAvatarExpression('idle');
  startChat();
});
