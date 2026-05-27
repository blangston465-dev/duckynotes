/* =======================================================================
   script.js — Ducky site app logic
   -----------------------------------------------------------------------
   Architecture:
     - `data.json` in this repo is the single source of truth.
     - On load, fetch data.json via the GitHub API (so we always see the
       latest, even after edits from another device).
     - On every edit, PUT the updated JSON back to GitHub (with SHA for
       conflict-safety).
     - GitHub creds (username/repo/token) are stored in localStorage on
       this device only — never transmitted anywhere except api.github.com.

   Sections in this file:
     1.  Defaults + state
     2.  Base64 helpers (UTF-8 safe — needed for emojis + Korean)
     3.  GitHub config (load/save/show modal)
     4.  GitHub API sync (load + save with SHA refresh on conflict)
     5.  Sync status indicator + toast
     6.  Data helpers (get/set, with auto-save)
     7.  Rendering — one function per section + renderAll()
     8.  Tab switching
     9.  Edit handlers (add + remove for every category)
    10.  Color picker (writes to appData.accentColor, syncs)
    11.  Wallet copy button
    12.  Init
   ======================================================================= */


/* ---------- 1. Defaults + state ---------- */
const DEFAULTS = {
  accentColor: "#5fb89a",
  sayings: [],
  movies: [],
  tvShows: [],
  alreadyWatched: [],
  games: [],
  faveMovies: [],
  foodSushi: "",
  foodChipotle: "",
  foods: [],
  foodNoLikey: [],
  gifts: [],
  funIdeas: [],
  birthdays: [],
  facts: [],
  ethWallet: "",
  poemIdeas: "",
  poems: []
};

let appData = JSON.parse(JSON.stringify(DEFAULTS));
let githubConfig = null;     // { username, repo, token }
let currentSha = null;       // GitHub file SHA for conflict detection
let isInitialLoad = true;    // suppresses "saved" toast on first paint


/* ---------- 2. Base64 helpers (UTF-8 safe) ---------- */
function encodeToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function decodeFromBase64(str) {
  return decodeURIComponent(escape(atob(str)));
}


/* ---------- 3. GitHub config ---------- */
const CONFIG_KEY = "duckyNotesConfig";

function loadConfigFromStorage() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function saveConfigToStorage(cfg) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch (_) {}
}

function showSetupModal(prefill = true) {
  document.getElementById("setupModal").classList.add("is-open");
  if (prefill && githubConfig) {
    document.getElementById("cfg-username").value = githubConfig.username || "";
    document.getElementById("cfg-repo").value     = githubConfig.repo || "";
    document.getElementById("cfg-token").value    = githubConfig.token || "";
  }
}

function hideSetupModal() {
  document.getElementById("setupModal").classList.remove("is-open");
}

document.getElementById("saveConfigBtn").addEventListener("click", () => {
  const username = document.getElementById("cfg-username").value.trim();
  const repo     = document.getElementById("cfg-repo").value.trim();
  const token    = document.getElementById("cfg-token").value.trim();

  if (!username || !repo || !token) {
    showToast("All three fields are required", "error");
    return;
  }

  githubConfig = { username, repo, token };
  saveConfigToStorage(githubConfig);
  currentSha = null;                // force a fresh fetch with the new creds
  hideSetupModal();
  loadDataFromGitHub();
});

document.getElementById("changeConfigBtn").addEventListener("click", () => {
  showSetupModal(true);
});


/* ---------- 4. GitHub API sync ---------- */
function ghContentsUrl() {
  return `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/data.json`;
}

async function loadDataFromGitHub() {
  if (!githubConfig) { showSetupModal(false); return; }

  try {
    setSyncStatus("syncing");
    const res = await fetch(ghContentsUrl(), {
      headers: { Authorization: `Bearer ${githubConfig.token}` }
    });

    if (res.status === 404) {
      // First-time: data.json doesn't exist in the repo yet. Seed from
      // bundled defaults (data.json file shipped in the repo) and PUT it.
      const seeded = await tryFetchLocalData();
      appData = seeded || JSON.parse(JSON.stringify(DEFAULTS));
      renderAll();
      setSyncStatus("ok");
      isInitialLoad = false;
      // Push it up so future loads succeed
      await saveDataToGitHub({ silent: true });
      return;
    }

    if (res.status === 401) throw new Error("Token invalid or expired. Click ⚙ Change GitHub config and re-enter.");
    if (res.status === 403) throw new Error("Token lacks access. Make sure scope is public_repo (or repo for private repos).");
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`);

    const data = await res.json();
    currentSha = data.sha;
    const decoded = decodeFromBase64(data.content);
    const parsed = JSON.parse(decoded);

    // Merge with defaults so newly-added keys don't break old data
    appData = Object.assign({}, JSON.parse(JSON.stringify(DEFAULTS)), parsed);

    renderAll();
    setSyncStatus("ok");
    isInitialLoad = false;
  } catch (err) {
    console.error("Load failed:", err);
    setSyncStatus("error");
    showToast("Sync failed: " + err.message, "error");
    // Fall back to bundled data.json if it's available
    const local = await tryFetchLocalData();
    appData = local || JSON.parse(JSON.stringify(DEFAULTS));
    renderAll();
    isInitialLoad = false;
  }
}

/* Try to load the bundled data.json (same directory) — used as a fallback
   and as the seed when data.json doesn't yet exist in the GitHub repo. */
async function tryFetchLocalData() {
  try {
    const res = await fetch("data.json", { cache: "no-cache" });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
}

async function refreshShaFromGitHub() {
  try {
    const res = await fetch(ghContentsUrl(), {
      headers: { Authorization: `Bearer ${githubConfig.token}` }
    });
    if (!res.ok) return false;
    const data = await res.json();
    currentSha = data.sha;
    return true;
  } catch (_) { return false; }
}

/* Save the current appData to GitHub. Retries once on 409 SHA conflict. */
async function saveDataToGitHub({ silent = false, _retried = false } = {}) {
  if (!githubConfig) { showSetupModal(false); return; }
  if (isInitialLoad) return;

  try {
    setSyncStatus("syncing");
    const body = {
      message: "Update data via Ducky site",
      content: encodeToBase64(JSON.stringify(appData, null, 2))
    };
    if (currentSha) body.sha = currentSha;

    const res = await fetch(ghContentsUrl(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubConfig.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (res.status === 409 && !_retried) {
      // Someone else (or another tab) updated the file. Refresh SHA, retry once.
      const ok = await refreshShaFromGitHub();
      if (ok) return saveDataToGitHub({ silent, _retried: true });
    }

    if (!res.ok) {
      let msg = `GitHub API error ${res.status}`;
      try {
        const errBody = await res.json();
        if (errBody.message) msg += ` — ${errBody.message}`;
      } catch (_) {}
      if (res.status === 401) msg += " (token invalid — click ⚙ Change GitHub config)";
      if (res.status === 403) msg += " (token needs write access — recreate with public_repo or repo scope)";
      throw new Error(msg);
    }

    const result = await res.json();
    currentSha = result.content.sha;
    setSyncStatus("ok");
    if (!silent) showToast("Saved ✓", "success");
  } catch (err) {
    console.error("Save failed:", err);
    setSyncStatus("error");
    showToast("Save failed: " + err.message, "error");
  }
}


/* ---------- 5. Sync indicator + toast ---------- */
function setSyncStatus(state) {
  const dot = document.getElementById("syncDot");
  const txt = document.getElementById("syncText");
  dot.classList.remove("is-syncing", "is-error", "is-ok");
  if (state === "syncing") { dot.classList.add("is-syncing"); txt.textContent = "syncing…"; }
  else if (state === "error") { dot.classList.add("is-error"); txt.textContent = "error"; }
  else { dot.classList.add("is-ok"); txt.textContent = "synced"; }
}

let toastTimer = null;
function showToast(message, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = message;
  t.classList.remove("is-error", "is-success");
  if (type === "error") t.classList.add("is-error");
  if (type === "success") t.classList.add("is-success");
  t.classList.add("is-show");
  clearTimeout(toastTimer);
  const duration = type === "error" ? 7000 : 2200;
  toastTimer = setTimeout(() => t.classList.remove("is-show"), duration);
}


/* ---------- 6. Data helpers (auto-save on every set) ---------- */
function gd(key) {
  if (appData[key] === undefined) appData[key] = JSON.parse(JSON.stringify(DEFAULTS[key]));
  return appData[key];
}

/* Set a value at a key and save. Also re-renders. */
function sd(key, value) {
  appData[key] = value;
  renderAll();
  saveDataToGitHub();
}

/* Remove the i-th element of an array at key. */
function removeAt(key, i) {
  const arr = gd(key);
  arr.splice(i, 1);
  sd(key, arr);
}


/* ---------- 7. Rendering ---------- */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Sayings — quote-grid blockquotes */
function renderSayings() {
  const el = document.getElementById("view-sayings");
  el.innerHTML = gd("sayings").map(s => `<blockquote class="quote">${esc(s)}</blockquote>`).join("");
}

/* Generic <ul><li>… for movies/tv/games/favorites */
function renderList(viewId, key) {
  const el = document.getElementById(viewId);
  el.innerHTML = gd(key).map(item => `<li>${esc(item)}</li>`).join("");
}

/* Food */
function renderFood() {
  document.getElementById("view-foodSushi").textContent    = gd("foodSushi");
  document.getElementById("view-foodChipotle").textContent = gd("foodChipotle");

  // The general "foods" list renders as individual non-feature food cards
  document.getElementById("view-foods").innerHTML = gd("foods").map(f => `
    <div class="food-card">
      <h3>${esc(f.name)}</h3>
      <p>${esc(f.note || "—")}</p>
    </div>
  `).join("");

  document.getElementById("view-foodNoLikey").innerHTML =
    gd("foodNoLikey").map(item => `<li>${esc(item)}</li>`).join("");
}

/* Gifts — interactive checkboxes whose state lives in data.json */
function renderGifts() {
  const el = document.getElementById("view-gifts");
  el.innerHTML = gd("gifts").map((g, i) => {
    const labelHtml = g.url
      ? `<a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer">${esc(g.name)}</a>`
      : esc(g.name);
    return `
      <li>
        <label>
          <input type="checkbox" data-gift-index="${i}" ${g.bought ? "checked" : ""} />
          <span>${labelHtml}</span>
        </label>
      </li>`;
  }).join("");

  el.querySelectorAll("input[type=checkbox]").forEach(box => {
    box.addEventListener("change", () => {
      const i = parseInt(box.dataset.giftIndex, 10);
      const arr = gd("gifts");
      arr[i].bought = box.checked;
      sd("gifts", arr);
    });
  });
}

/* Fun ideas — sticky notes */
function renderFun() {
  const el = document.getElementById("view-funIdeas");
  el.innerHTML = gd("funIdeas").map(s => `<div class="sticky"><p>${esc(s)}</p></div>`).join("");
}

/* Birthdays — date cards */
function renderBirthdays() {
  const el = document.getElementById("view-birthdays");
  el.innerHTML = gd("birthdays").map(b => `
    <div class="remember-card remember-card-date">
      <span class="date-month">${esc(b.month)}</span>
      <span class="date-day">${esc(b.day)}</span>
      <p>${esc(b.person)}'s birthday</p>
    </div>
  `).join("");
}

/* Facts — small fact cards */
function renderFacts() {
  const el = document.getElementById("view-facts");
  el.innerHTML = gd("facts").map(f => `
    <div class="remember-card">
      <h3>${esc(f.label)}</h3>
      <p>${esc(f.value)}</p>
    </div>
  `).join("");
}

/* Wallet — populates the existing card */
function renderWallet() {
  document.getElementById("walletAddress").textContent = gd("ethWallet") || "—";
}

/* Poems */
function renderPoems() {
  document.getElementById("view-poemIdeas").textContent = gd("poemIdeas");
  document.getElementById("view-poems").innerHTML = gd("poems").map(p => `
    <article class="poem">
      <h3>Poem</h3>
      ${esc(p).split(/\n\s*\n/).map(stanza => `<p>${stanza}</p>`).join("")}
    </article>
  `).join("");
}

/* ---- Edit tab renderers ---- */

/* Tag-list editor (string arrays) */
function renderEditTags(listId, key) {
  const el = document.getElementById(listId);
  if (!el) return;
  el.innerHTML = gd(key).map((item, i) => `
    <span class="edit-tag">
      <span>${esc(item)}</span>
      <button type="button" data-remove="${key}" data-index="${i}" title="Remove">×</button>
    </span>
  `).join("");
}

/* Stacked row editor (object arrays + long strings) */
function renderEditRows(listId, key, labelFn) {
  const el = document.getElementById(listId);
  if (!el) return;
  el.innerHTML = gd(key).map((item, i) => `
    <div class="edit-row-item">
      <span>${esc(labelFn(item))}</span>
      <button type="button" data-remove="${key}" data-index="${i}">Remove</button>
    </div>
  `).join("");
}

function renderEditAll() {
  // Tag-style (simple string arrays)
  renderEditTags("edit-movies", "movies");
  renderEditTags("edit-tvShows", "tvShows");
  renderEditTags("edit-alreadyWatched", "alreadyWatched");
  renderEditTags("edit-games", "games");
  renderEditTags("edit-faveMovies", "faveMovies");
  renderEditTags("edit-foodNoLikey", "foodNoLikey");
  renderEditTags("edit-funIdeas", "funIdeas");

  // Row-style (objects or long strings)
  renderEditRows("edit-sayings", "sayings", s => s.length > 70 ? s.substring(0, 70).replace(/\n/g, " ") + "…" : s);
  renderEditRows("edit-foods", "foods", f => `${f.name}${f.note ? " — " + f.note : ""}`);
  renderEditRows("edit-gifts", "gifts", g => `${g.name}${g.url ? "  ·  " + g.url : ""}`);
  renderEditRows("edit-birthdays", "birthdays", b => `${b.month} ${b.day} — ${b.person}`);
  renderEditRows("edit-facts", "facts", f => `${f.label}: ${f.value}`);
  renderEditRows("edit-poems", "poems", p => p.substring(0, 80).replace(/\n/g, " ") + "…");

  // Prefill the "save" textareas/inputs with current values
  setValIfExists("in-foodSushi",    gd("foodSushi"));
  setValIfExists("in-foodChipotle", gd("foodChipotle"));
  setValIfExists("in-ethWallet",    gd("ethWallet"));
  setValIfExists("in-poemIdeas",    gd("poemIdeas"));
}

function setValIfExists(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

/* Master render */
function renderAll() {
  // Apply accent color
  applyAccent(gd("accentColor") || DEFAULTS.accentColor);

  // View sections
  renderSayings();
  renderList("view-movies", "movies");
  renderList("view-tvShows", "tvShows");
  renderList("view-alreadyWatched", "alreadyWatched");
  renderList("view-games", "games");
  renderList("view-faveMovies", "faveMovies");
  renderFood();
  renderGifts();
  renderFun();
  renderBirthdays();
  renderFacts();
  renderWallet();
  renderPoems();

  // Edit tab
  renderEditAll();
}


/* ---------- 8. Tab switching ---------- */
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabs.forEach(t => t.classList.remove("is-active"));
    panels.forEach(p => p.classList.remove("is-active"));
    tab.classList.add("is-active");
    const targetPanel = document.getElementById(target);
    if (targetPanel) targetPanel.classList.add("is-active");
    window.scrollTo({ top: window.scrollY > 200 ? 200 : 0, behavior: "smooth" });
  });
});


/* ---------- 9. Edit handlers ---------- */
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}
function clearField(...ids) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
}

// One delegated click handler for every add button + remove button
document.addEventListener("click", e => {
  const addBtn = e.target.closest("[data-add]");
  const saveBtn = e.target.closest("[data-save]");
  const removeBtn = e.target.closest("[data-remove]");

  if (addBtn) {
    handleAdd(addBtn.dataset.add);
  } else if (saveBtn) {
    handleSave(saveBtn.dataset.save);
  } else if (removeBtn) {
    const key = removeBtn.dataset.remove;
    const i = parseInt(removeBtn.dataset.index, 10);
    if (!isNaN(i)) removeAt(key, i);
  }
});

function handleAdd(kind) {
  switch (kind) {
    case "saying": {
      const v = getVal("in-saying"); if (!v) return;
      const arr = gd("sayings"); arr.push(v); sd("sayings", arr);
      clearField("in-saying"); break;
    }
    case "movie": {
      const v = getVal("in-movie"); if (!v) return;
      const arr = gd("movies"); arr.push(v); sd("movies", arr);
      clearField("in-movie"); break;
    }
    case "tvShow": {
      const v = getVal("in-tvShow"); if (!v) return;
      const arr = gd("tvShows"); arr.push(v); sd("tvShows", arr);
      clearField("in-tvShow"); break;
    }
    case "alreadyWatched": {
      const v = getVal("in-alreadyWatched"); if (!v) return;
      const arr = gd("alreadyWatched"); arr.push(v); sd("alreadyWatched", arr);
      clearField("in-alreadyWatched"); break;
    }
    case "game": {
      const v = getVal("in-game"); if (!v) return;
      const arr = gd("games"); arr.push(v); sd("games", arr);
      clearField("in-game"); break;
    }
    case "faveMovie": {
      const v = getVal("in-faveMovie"); if (!v) return;
      const arr = gd("faveMovies"); arr.push(v); sd("faveMovies", arr);
      clearField("in-faveMovie"); break;
    }
    case "food": {
      const name = getVal("in-food-name"); if (!name) return;
      const note = getVal("in-food-note");
      const arr = gd("foods"); arr.push({ name, note }); sd("foods", arr);
      clearField("in-food-name", "in-food-note"); break;
    }
    case "foodNoLikey": {
      const v = getVal("in-foodNoLikey"); if (!v) return;
      const arr = gd("foodNoLikey"); arr.push(v); sd("foodNoLikey", arr);
      clearField("in-foodNoLikey"); break;
    }
    case "gift": {
      const name = getVal("in-gift-name"); if (!name) return;
      const url = getVal("in-gift-url");
      const arr = gd("gifts"); arr.push({ name, url, bought: false }); sd("gifts", arr);
      clearField("in-gift-name", "in-gift-url"); break;
    }
    case "funIdea": {
      const v = getVal("in-funIdea"); if (!v) return;
      const arr = gd("funIdeas"); arr.push(v); sd("funIdeas", arr);
      clearField("in-funIdea"); break;
    }
    case "birthday": {
      const month = getVal("in-bday-month");
      const day = parseInt(getVal("in-bday-day"), 10);
      const person = getVal("in-bday-person");
      if (!month || !day || !person) { showToast("Fill in month, day, and person", "error"); return; }
      const arr = gd("birthdays"); arr.push({ month, day, person }); sd("birthdays", arr);
      clearField("in-bday-day", "in-bday-person"); break;
    }
    case "fact": {
      const label = getVal("in-fact-label"); const value = getVal("in-fact-value");
      if (!label) return;
      const arr = gd("facts"); arr.push({ label, value }); sd("facts", arr);
      clearField("in-fact-label", "in-fact-value"); break;
    }
    case "poem": {
      const v = getVal("in-poem"); if (!v) return;
      const arr = gd("poems"); arr.push(v); sd("poems", arr);
      clearField("in-poem"); break;
    }
  }
}

function handleSave(key) {
  switch (key) {
    case "foodSushi":    sd("foodSushi",    getVal("in-foodSushi")); break;
    case "foodChipotle": sd("foodChipotle", getVal("in-foodChipotle")); break;
    case "ethWallet":    sd("ethWallet",    getVal("in-ethWallet")); break;
    case "poemIdeas":    sd("poemIdeas",    getVal("in-poemIdeas")); break;
  }
}

/* Enter-key adds inside single-line inputs */
document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  if (e.target.tagName === "TEXTAREA") return;
  const id = e.target.id || "";
  const map = {
    "in-movie": "movie", "in-tvShow": "tvShow", "in-alreadyWatched": "alreadyWatched",
    "in-game": "game", "in-faveMovie": "faveMovie", "in-foodNoLikey": "foodNoLikey",
    "in-funIdea": "funIdea",
    "in-food-name": "food", "in-food-note": "food",
    "in-gift-name": "gift", "in-gift-url": "gift",
    "in-bday-day": "birthday", "in-bday-person": "birthday",
    "in-fact-label": "fact", "in-fact-value": "fact"
  };
  if (map[id]) handleAdd(map[id]);
});

/* Reset button */
document.getElementById("resetBtn").addEventListener("click", async () => {
  if (!confirm("Reset everything back to the bundled defaults? This will overwrite your synced data and cannot be undone.")) return;
  const local = await tryFetchLocalData();
  appData = local || JSON.parse(JSON.stringify(DEFAULTS));
  renderAll();
  saveDataToGitHub();
});


/* ---------- 10. Color picker ---------- */
const DEFAULT_ACCENT = "#5fb89a";
const picker = document.getElementById("colorPicker");
const resetColorBtn = document.getElementById("resetColor");

function hexToRgb(hex) {
  if (!hex) return null;
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return null;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if ([r, g, b].some(isNaN)) return null;
  return { r, g, b };
}

function darkenHex(hex, factor) {
  const c = hexToRgb(hex);
  if (!c) return hex;
  const r = Math.max(0, Math.min(255, Math.round(c.r * factor)));
  const g = Math.max(0, Math.min(255, Math.round(c.g * factor)));
  const b = Math.max(0, Math.min(255, Math.round(c.b * factor)));
  return `rgb(${r}, ${g}, ${b})`;
}

function applyAccent(hex) {
  const root = document.documentElement;
  const c = hexToRgb(hex);
  if (!c) return;
  root.style.setProperty("--accent", hex);
  root.style.setProperty("--accent-soft", `rgba(${c.r}, ${c.g}, ${c.b}, 0.32)`);
  root.style.setProperty("--accent-tint", `rgba(${c.r}, ${c.g}, ${c.b}, 0.18)`);
  root.style.setProperty("--accent-deep", darkenHex(hex, 0.78));
  if (picker) picker.value = hex;
}

/* Debounce color saves — picker fires `input` rapidly while dragging.
   Save 600ms after the user stops moving. */
let colorSaveTimer = null;
picker.addEventListener("input", e => {
  const hex = e.target.value;
  applyAccent(hex);
  appData.accentColor = hex;
  clearTimeout(colorSaveTimer);
  colorSaveTimer = setTimeout(() => saveDataToGitHub(), 600);
});

resetColorBtn.addEventListener("click", () => {
  applyAccent(DEFAULT_ACCENT);
  appData.accentColor = DEFAULT_ACCENT;
  saveDataToGitHub();
});


/* ---------- 11. Wallet copy ---------- */
const copyBtn = document.getElementById("copyWallet");
const walletEl = document.getElementById("walletAddress");

copyBtn.addEventListener("click", async () => {
  const address = walletEl.textContent.trim();
  if (!address || address === "—") return;

  try {
    await navigator.clipboard.writeText(address);
  } catch (_) {
    const tmp = document.createElement("textarea");
    tmp.value = address;
    document.body.appendChild(tmp);
    tmp.select();
    try { document.execCommand("copy"); } catch (_) {}
    document.body.removeChild(tmp);
  }

  const original = copyBtn.textContent;
  copyBtn.textContent = "Copied ✓";
  copyBtn.classList.add("is-copied");
  setTimeout(() => { copyBtn.textContent = original; copyBtn.classList.remove("is-copied"); }, 1800);
});


/* ---------- 12. Init ---------- */
(async function init() {
  // First paint with bundled data so the page isn't blank during fetch
  const local = await tryFetchLocalData();
  if (local) {
    appData = Object.assign({}, JSON.parse(JSON.stringify(DEFAULTS)), local);
    renderAll();
  }

  githubConfig = loadConfigFromStorage();
  if (githubConfig) {
    await loadDataFromGitHub();
  } else {
    setSyncStatus("error");
    showSetupModal(false);
  }
})();
