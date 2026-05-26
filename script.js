/* =======================================================================
   script.js — Ducky site interactivity
   -----------------------------------------------------------------------
   1) Tab switching between panels
   2) Gift-idea checkboxes persisted in localStorage
   3) ETH wallet copy-to-clipboard
   4) Accent color picker — "her color":
        - default mint (#5fb89a)
        - editable via native color input
        - saved to localStorage ("ducky.accentColor")
        - drives --accent, --accent-soft, --accent-deep, --accent-tint
          so every decorative element updates instantly everywhere
   ======================================================================= */


/* ---------- 1) Tab switching ---------- */
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    tabs.forEach(t => t.classList.remove('is-active'));
    panels.forEach(p => p.classList.remove('is-active'));

    tab.classList.add('is-active');
    const targetPanel = document.getElementById(target);
    if (targetPanel) targetPanel.classList.add('is-active');

    window.scrollTo({ top: window.scrollY > 200 ? 200 : 0, behavior: 'smooth' });
  });
});


/* ---------- 2) Gift checklist persistence ---------- */
const GIFT_STORAGE_KEY = 'ducky.gifts';
const giftBoxes = document.querySelectorAll('#giftList input[type="checkbox"]');

function loadGiftState() {
  try {
    const raw = localStorage.getItem(GIFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function saveGiftState(state) {
  try { localStorage.setItem(GIFT_STORAGE_KEY, JSON.stringify(state)); }
  catch (err) { /* localStorage may be unavailable; fail silently */ }
}

const giftState = loadGiftState();
giftBoxes.forEach(box => {
  const key = box.dataset.gift;
  if (giftState[key]) box.checked = true;

  box.addEventListener('change', () => {
    const current = loadGiftState();
    if (box.checked) current[key] = true;
    else delete current[key];
    saveGiftState(current);
  });
});


/* ---------- 3) Copy ETH wallet address ---------- */
const copyBtn = document.getElementById('copyWallet');
const walletEl = document.getElementById('walletAddress');

if (copyBtn && walletEl) {
  copyBtn.addEventListener('click', async () => {
    const address = walletEl.textContent.trim();

    try {
      await navigator.clipboard.writeText(address);
    } catch (err) {
      const tmp = document.createElement('textarea');
      tmp.value = address;
      document.body.appendChild(tmp);
      tmp.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(tmp);
    }

    const originalLabel = copyBtn.textContent;
    copyBtn.textContent = 'Copied ✓';
    copyBtn.classList.add('is-copied');

    setTimeout(() => {
      copyBtn.textContent = originalLabel;
      copyBtn.classList.remove('is-copied');
    }, 1800);
  });
}


/* ---------- 4) Accent color picker ---------- */
const DEFAULT_ACCENT = '#5fb89a';                  // mint — her color
const ACCENT_STORAGE_KEY = 'ducky.accentColor';

const picker = document.getElementById('colorPicker');
const resetBtn = document.getElementById('resetColor');
const swatch = document.querySelector('.swatch');

/* Convert "#rrggbb" to { r, g, b }. Returns null if input is malformed. */
function hexToRgb(hex) {
  if (!hex) return null;
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return null;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if ([r, g, b].some(isNaN)) return null;
  return { r, g, b };
}

/* Multiply each channel by `factor` (0.78 = 22% darker) and clamp to 0..255. */
function darkenHex(hex, factor) {
  const c = hexToRgb(hex);
  if (!c) return hex;
  const r = Math.max(0, Math.min(255, Math.round(c.r * factor)));
  const g = Math.max(0, Math.min(255, Math.round(c.g * factor)));
  const b = Math.max(0, Math.min(255, Math.round(c.b * factor)));
  return `rgb(${r}, ${g}, ${b})`;
}

/* Push all four accent variables onto :root. Anything in styles.css that
   references --accent / --accent-soft / --accent-deep / --accent-tint
   updates immediately. */
function applyAccent(hex) {
  const root = document.documentElement;
  const c = hexToRgb(hex);
  if (!c) return;

  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent-soft', `rgba(${c.r}, ${c.g}, ${c.b}, 0.32)`);
  root.style.setProperty('--accent-tint', `rgba(${c.r}, ${c.g}, ${c.b}, 0.18)`);
  root.style.setProperty('--accent-deep', darkenHex(hex, 0.78));

  if (picker) picker.value = hex;
}

function loadAccent() {
  try {
    return localStorage.getItem(ACCENT_STORAGE_KEY) || DEFAULT_ACCENT;
  } catch (_) {
    return DEFAULT_ACCENT;
  }
}

function saveAccent(hex) {
  try { localStorage.setItem(ACCENT_STORAGE_KEY, hex); }
  catch (_) { /* private mode — won't persist, but live update still works */ }
}

/* Init on load */
applyAccent(loadAccent());

/* Live update as user drags the picker (works on the native color UI) */
if (picker) {
  picker.addEventListener('input', (e) => {
    applyAccent(e.target.value);
    saveAccent(e.target.value);
  });
}

/* Reset to mint */
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    applyAccent(DEFAULT_ACCENT);
    saveAccent(DEFAULT_ACCENT);
  });
}
