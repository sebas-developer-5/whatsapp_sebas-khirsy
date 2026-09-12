// ==============================
// CONFIGURAZIONE
// ==============================
const CONFIG = {
  title: 'Chat',
  primarySender: 'khirsy', // i messaggi di questo mittente vanno a destra
};

// ==============================
// RIFERIMENTI DOM
// ==============================
const chatContainer = document.getElementById('chat-container');
const messagesEl = document.getElementById('messages');
const stickyDate = document.getElementById('sticky-date');
const loadingEl = document.getElementById('loading');
const emptyStateEl = document.getElementById('empty-state');
const chatTitleEl = document.getElementById('chat-title');
const chatSubtitleEl = document.getElementById('chat-subtitle');

const searchToggle = document.getElementById('search-toggle');
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const searchCloseBtn = document.getElementById('search-close');
const searchCounter = document.getElementById('search-counter');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

const jumpBtn = document.getElementById('jump-latest');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxError = document.getElementById('lightbox-error');

let allMessages = [];
let searchResults = [];
let currentIndex = -1;
let debounceTimer = null;

chatTitleEl.textContent = CONFIG.title;

// ==============================
// UTILITY: escaping, link, evidenziazione
// ==============================
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function linkify(escapedText) {
  const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;
  return escapedText.replace(urlRegex, (match) => {
    const href = match.startsWith('http') ? match : `https://${match}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });
}

function highlight(escapedText, rawQuery) {
  const safeQuery = escapeRegExp(escapeHtml(rawQuery));
  if (!safeQuery) return escapedText;
  return escapedText.replace(new RegExp(`(${safeQuery})`, 'gi'), '<mark>$1</mark>');
}

// Se c'è una query di ricerca evidenzia il testo, altrimenti trasforma i link in <a>.
// Le due cose non vengono combinate per evitare di rompere gli attributi href.
function renderMessageText(rawText, query) {
  const escaped = escapeHtml(rawText);
  return query ? highlight(escaped, query) : linkify(escaped);
}

// ==============================
// UTILITY: date
// ==============================
function parseChatDate(dateStr) {
  const [d, m, y] = dateStr.split('/').map(Number);
  const fullYear = y < 100 ? 2000 + y : y;
  return new Date(fullYear, m - 1, d);
}

function formatDateLabel(dateStr) {
  const date = parseChatDate(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  if (sameDay(date, today)) return 'Oggi';
  if (sameDay(date, yesterday)) return 'Ieri';

  const label = date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ==============================
// MEDIA (sticker, immagini, vocali)
// ==============================
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const AUDIO_EXTENSIONS = ['opus', 'ogg', 'mp3', 'm4a'];

function buildMissingMediaPlaceholder(kindLabel) {
  const div = document.createElement('div');
  div.className = 'media-missing';
  div.textContent = `⚠️ ${kindLabel} non disponibile`;
  return div;
}

function buildMediaElement(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const src = `media/${encodeURIComponent(filename)}`;

  if (IMAGE_EXTENSIONS.includes(ext)) {
    const wrapper = document.createElement('div');
    wrapper.className = 'media-bubble image-bubble';

    const img = document.createElement('img');
    img.src = src;
    img.alt = ext === 'webp' ? 'Sticker' : 'Immagine';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('click', () => openLightbox(src));
    img.addEventListener('error', () => {
      wrapper.replaceChildren(buildMissingMediaPlaceholder(ext === 'webp' ? 'Sticker' : 'Immagine'));
    }, { once: true });

    wrapper.appendChild(img);
    return wrapper;
  }

  if (AUDIO_EXTENSIONS.includes(ext)) {
    const wrapper = document.createElement('div');
    wrapper.className = 'media-bubble audio-bubble';

    const label = document.createElement('div');
    label.className = 'audio-label';
    label.textContent = '🎤 Messaggio vocale';

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = src;
    audio.addEventListener('error', () => {
      wrapper.replaceChildren(buildMissingMediaPlaceholder('Audio'));
    }, { once: true });

    wrapper.append(label, audio);
    return wrapper;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'media-bubble file-bubble';
  wrapper.textContent = `📎 ${filename}`;
  return wrapper;
}

// ==============================
// RENDER MESSAGGI
// ==============================
function buildDateSeparator(dateStr) {
  const div = document.createElement('div');
  div.className = 'date-separator';
  div.dataset.date = dateStr;
  const span = document.createElement('span');
  span.textContent = formatDateLabel(dateStr);
  div.appendChild(span);
  return div;
}

function buildMessageBubble(msg, query) {
  const div = document.createElement('div');
  const isPrimary = (msg.sender || '').toLowerCase() === CONFIG.primarySender;
  div.className = `message ${isPrimary ? 'from-khirsy' : 'from-contact'}`;
  div.dataset.date = msg.date;

  if (msg.message) {
    const textEl = document.createElement('div');
    textEl.className = 'text';
    textEl.innerHTML = renderMessageText(msg.message, query);
    div.appendChild(textEl);
  } else if (msg.sticker) {
    div.appendChild(buildMediaElement(msg.sticker));
  }

  const timeEl = document.createElement('div');
  timeEl.className = 'time';
  timeEl.textContent = msg.time || '';
  div.appendChild(timeEl);

  return div;
}

function renderMessages(msgs, query) {
  const fragment = document.createDocumentFragment();
  let lastDate = null;

  msgs.forEach((msg) => {
    if (msg.date !== lastDate) {
      fragment.appendChild(buildDateSeparator(msg.date));
      lastDate = msg.date;
    }
    fragment.appendChild(buildMessageBubble(msg, query));
  });

  messagesEl.replaceChildren(fragment);

  const isEmpty = msgs.length === 0;
  emptyStateEl.hidden = !isEmpty;
  messagesEl.hidden = isEmpty;
}

// ==============================
// SCROLL: data sticky + pulsante "vai in fondo"
// ==============================
function updateStickyDate() {
  const separators = messagesEl.querySelectorAll('.date-separator');
  let current = null;
  const scrollTop = chatContainer.scrollTop;

  for (const sep of separators) {
    if (sep.offsetTop <= scrollTop + 8) {
      current = sep.dataset.date;
    } else {
      break;
    }
  }

  if (current) {
    stickyDate.textContent = formatDateLabel(current);
    stickyDate.hidden = false;
  } else {
    stickyDate.hidden = true;
  }
}

function updateJumpButton() {
  const distanceFromBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight;
  jumpBtn.hidden = distanceFromBottom < 400;
}

chatContainer.addEventListener('scroll', () => {
  updateStickyDate();
  updateJumpButton();
});

jumpBtn.addEventListener('click', () => {
  chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
});

// ==============================
// LIGHTBOX
// ==============================
function openLightbox(src) {
  lightboxError.hidden = true;
  lightboxImg.hidden = false;
  lightboxImg.src = src;
  lightbox.hidden = false;
}
function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.src = '';
}
lightboxImg.addEventListener('error', () => {
  const filename = decodeURIComponent(lightboxImg.src.split('/').pop() || '');
  console.error('Impossibile caricare l\'immagine ingrandita:', lightboxImg.src);
  lightboxImg.hidden = true;
  lightboxError.hidden = false;
  lightboxError.textContent = `⚠️ Impossibile caricare "${filename}". Il file potrebbe mancare dalla cartella media/ o essere corrotto.`;
});
lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
});

// ==============================
// RICERCA
// ==============================
function runSearch() {
  const query = searchInput.value.trim();
  renderMessages(allMessages, query);

  if (!query) {
    searchResults = [];
    currentIndex = -1;
    updateSearchCounter();
    return;
  }

  searchResults = Array.from(messagesEl.querySelectorAll('.message')).filter((el) => el.querySelector('mark'));
  currentIndex = searchResults.length ? 0 : -1;
  updateSearchCounter();
  if (searchResults.length) scrollToResult(0, false);
}

function updateSearchCounter() {
  const query = searchInput.value.trim();
  if (!query) {
    searchCounter.textContent = '';
  } else {
    searchCounter.textContent = searchResults.length ? `${currentIndex + 1} / ${searchResults.length}` : '0 / 0';
  }
  const disabled = searchResults.length === 0;
  prevBtn.disabled = disabled;
  nextBtn.disabled = disabled;
}

function scrollToResult(index, smooth = true) {
  currentIndex = index;
  searchResults[index].scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  updateSearchCounter();
}

nextBtn.addEventListener('click', () => {
  if (searchResults.length) scrollToResult((currentIndex + 1) % searchResults.length);
});
prevBtn.addEventListener('click', () => {
  if (searchResults.length) scrollToResult((currentIndex - 1 + searchResults.length) % searchResults.length);
});

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSearch, 150);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (searchResults.length) {
      if (e.shiftKey) prevBtn.click();
      else nextBtn.click();
    }
  } else if (e.key === 'Escape') {
    closeSearch();
  }
});

function openSearch() {
  searchBar.hidden = false;
  searchToggle.setAttribute('aria-expanded', 'true');
  searchInput.focus();
}

function closeSearch() {
  searchBar.hidden = true;
  searchToggle.setAttribute('aria-expanded', 'false');
  searchInput.value = '';
  searchResults = [];
  currentIndex = -1;
  updateSearchCounter();
  renderMessages(allMessages, '');
}

searchToggle.addEventListener('click', () => {
  if (searchBar.hidden) openSearch();
  else closeSearch();
});
searchCloseBtn.addEventListener('click', closeSearch);

// ==============================
// CARICAMENTO INIZIALE
// ==============================
async function init() {
  try {
    // I dati sono incorporati in chat-data.js (variabile CHAT_DATA) invece di essere
    // scaricati con fetch('chat.json'): aprendo il file con doppio click (file://),
    // il browser blocca sempre le richieste fetch verso altri file locali, quindi
    // usare una variabile JS già caricata evita del tutto il problema.
    if (typeof CHAT_DATA === 'undefined') {
      throw new Error('chat-data.js non caricato: assicurati che <script src="chat-data.js"> sia presente in index.html prima di app.js');
    }
    allMessages = CHAT_DATA;

    loadingEl.hidden = true;
    chatSubtitleEl.textContent = `${allMessages.length.toLocaleString('it-IT')} messaggi`;

    renderMessages(allMessages, '');

    requestAnimationFrame(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
      updateStickyDate();
      updateJumpButton();
    });
  } catch (err) {
    console.error('Errore caricamento chat:', err);
    loadingEl.textContent = 'Impossibile caricare la chat. Riprova più tardi.';
  }
}

init();
