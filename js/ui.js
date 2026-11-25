// Small UI helpers: escaping, formatting, icons, toast and modal dialogs.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const go = (hash) => { location.hash = hash; };

const parseISO = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };

export function fmtDateShort(iso) {
  const d = parseISO(iso); // manual month names: some engines print "Sept"
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtDateLong(iso) {
  const d = parseISO(iso);
  return `${d.toLocaleDateString('en-GB', { weekday: 'long' })}, ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}
export const fmtSigned = (n) => (n > 0 ? `${n}` : `${n}`).replace('-', '−');
export const fmtNum = (n, d = 1) => (Number.isInteger(n) ? String(n) : n.toFixed(d));

const svg = (body, size = 26) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  history: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  players: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 13.7c2.7 0 4.5 1.9 4.5 4.3"/>'),
  stats: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  timer: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 24),
  chevronDown: svg('<path d="M6 9l6 6 6-6"/>', 22),
  chevronUp: svg('<path d="M6 15l6-6 6 6"/>', 22),
  back: svg('<path d="M15 5l-7 7 7 7"/>', 24),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 22),
  minus: svg('<path d="M5 12h14"/>', 22),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 18),
  calc: svg('<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>', 20),
  dice: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/>', 26),
  shuffle: svg('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', 20),
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>', 30),
  pause: svg('<path d="M8 5v14M16 5v14" stroke-width="3"/>', 30),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', 24),
  next: svg('<path d="M5 5l9 7-9 7zM19 5v14"/>', 24),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', 18),
  cloud: svg('<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/>', 20),
};

export function toast(msg, ms = 2600) {
  let wrap = document.getElementById('toasts');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toasts'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
}

export function openModal(innerHtml, onMount, onClose) {
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  el.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${innerHtml}</div>`;
  document.body.appendChild(el);
  document.body.classList.add('modal-open');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.remove(); document.body.classList.remove('modal-open'); document.removeEventListener('keydown', onKey);
    onClose && onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  onMount && onMount(el.firstElementChild, close);
  return { el, close };
}

export function confirmDialog({ title, message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    openModal(
      `<h3>${esc(title)}</h3>${message ? `<p>${esc(message)}</p>` : ''}
       <div class="modal-actions">
         <button class="btn ghost" data-r="0">${esc(cancelLabel)}</button>
         <button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(confirmLabel)}</button>
       </div>`,
      (m, close) => m.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]');
        if (b) { result = b.dataset.r === '1'; close(); }
      }),
      () => resolve(result)
    );
  });
}

export const shell = {
  head(title, right = '') {
    return `<header class="head"><h1 class="h1 big">${esc(title)}</h1>${right}</header>`;
  },
};
