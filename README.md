# Ducky 🦆

A private personal site — everything about my favorite person, all in one place.

---

## What's in here

| File | What it does |
|------|--------------|
| `index.html` | The site itself — every section from the mind map |
| `styles.css` | All styling (warm cream scrapbook aesthetic) |
| `script.js` | Tab switching, gift-checklist memory, copy-wallet button |
| `robots.txt` | Tells search engines and AI crawlers to stay away |
| `.gitignore` | Keeps junk files out of git |

---

## Running it locally

Just open `index.html` in any browser. That's it — no build step, no dependencies.

If you want to test it with a tiny local server (recommended so paths behave like the deployed version):

```bash
# Python (already installed on most machines)
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## Pushing to GitHub as a private repo

1. **Create a new private repo** on GitHub
   - Go to <https://github.com/new>
   - Name it whatever (e.g. `ducky`)
   - **Select "Private"** ← important
   - Don't add a README, .gitignore, or license (you already have them)
   - Click "Create repository"

2. **Push from your terminal** (in the folder with these files):

   ```bash
   git init
   git add .
   git commit -m "Ducky site"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/ducky.git
   git push -u origin main
   ```

   Replace `YOUR-USERNAME` with your GitHub username.

---

## How "private" actually works (read this!)

There are **two separate** privacy layers, and they do different things:

### 1. Private GitHub repo
Hides the **source code**. Only people you explicitly invite can see the files. ✅ Handled — you just need to set the repo to "Private" when creating it.

### 2. `robots.txt`
Tells search engines (Google, Bing) and AI bots (ChatGPT, Claude, Perplexity, etc.) **not to index** the site. ✅ Already included.

### ⚠️ The catch: the deployed site itself
If you deploy this to **GitHub Pages on a free account**, the live site URL is **public** — anyone with the URL can visit it. The private repo just hides the code, not the page.

**Options for keeping the live site actually private:**

- **Option A — Don't deploy it.** Keep it in the repo. Open `index.html` directly when you want to view it. Most private. Works on any machine that clones the repo.
- **Option B — Cloudflare Pages with Access.** Deploy free at <https://pages.cloudflare.com> and add Cloudflare Access (free for up to 50 users) to require email login. Very private.
- **Option C — Netlify with password protection.** Netlify offers site-wide password protection on paid plans (~$19/mo).
- **Option D — GitHub Pages with GitHub Pro.** GitHub Pro ($4/mo) lets you make Pages from a private repo also private (visitors must log in to GitHub and be invited).

The `robots.txt` here helps in all cases — it keeps the site out of search results even if it's technically reachable.

---

## Editing the content

All the content lives in `index.html`. Find the section you want (each is clearly commented — look for `<!-- ============== SAYINGS ============== -->`), edit the text, save, refresh the browser.

To add a new gift idea to the checklist, copy one of the existing `<li>` lines and change the `data-gift` value to something unique (the value is what `localStorage` uses to remember if it's been ticked).

---

## Made with love 💛
