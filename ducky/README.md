# Ducky 🦆

A private personal site with **editable, syncing content**. Edits saved on one device show up on every device.

---

## How sync works (read this once)

- `data.json` lives in this repo and holds every piece of content (sayings, movies, foods, gifts, birthdays, the wallet address, the accent color — everything).
- When you open the site, JavaScript fetches `data.json` from GitHub via the API so you always see the latest.
- When you make an edit (add a saying, tick a gift, change the color, anything), the JS PUTs the updated JSON back to GitHub.
- A short **personal access token** is what lets the browser write to your repo. It's stored only in your browser's localStorage on each device you use — never sent anywhere except `api.github.com`.

So on each device the first time, you'll set the site up with your username, repo, and token. After that it just works.

---

## First-time setup (one device, one time)

### 1. Create a GitHub Personal Access Token

1. Go to <https://github.com/settings/tokens?type=beta> (fine-grained tokens) **or** <https://github.com/settings/tokens> (classic — simpler)
2. Click **"Generate new token (classic)"**
3. Name it something like `Ducky site`
4. Expiration: pick whatever you like — **"No expiration"** is fine for personal use, or 1 year if you want to rotate
5. Under **Select scopes**, tick **`public_repo`** (or **`repo`** if your repo is private)
6. Click **Generate token** at the bottom
7. **Copy the token immediately** — it starts with `ghp_…` and GitHub only shows it once

### 2. Open the site

The first time it loads, a setup modal appears asking for three things:

- **GitHub username** — yours (e.g. `blangston465-dev`)
- **Repository name** — the repo holding the site (e.g. `ducky-notes`)
- **Personal access token** — paste the one you just made

Click **Save & sync**. The site reads `data.json` from your repo and shows the content. Done.

### 3. Repeat on every device you want to use

Same modal pops up on each new device/browser. Paste the same creds. Future sessions on that device skip the modal — your creds are remembered locally.

---

## Day-to-day use

- **Click the ✎ Edit tab** to add, remove, or edit anything.
- Every change saves automatically — watch the gold dot in the nav. It pulses while syncing and turns green when done. If it goes red, hover over the toast at the bottom for the error.
- The gift checklist, the color picker, even the wallet address — all of them write back to `data.json` the moment you change them.

---

## Privacy

- The repo can be public or private — both work. If private, use the `repo` token scope instead of `public_repo`.
- `robots.txt` keeps search engines and AI crawlers out either way.
- The token is stored only in `localStorage` on each browser you use. Clearing cookies or browser data wipes it; you'll just re-enter it next time.

---

## Files

| File | What it does |
|------|--------------|
| `index.html` | Page structure — all content sections are empty, JS fills them |
| `styles.css` | Styling (scrapbook aesthetic, modal, edit forms, sync indicator) |
| `script.js` | App logic — GitHub sync, rendering, edit handlers |
| `data.json` | The actual content — single source of truth |
| `robots.txt` | Tells crawlers to stay away |
| `.nojekyll` | Tells GitHub Pages to skip Jekyll |
| `.gitignore` | Keeps junk files out of git |

---

## Pushing changes to the live site

After replacing files in your local repo:

```bash
git add -A
git commit -m "Update site"
git push
```

Wait ~60 seconds for GitHub Pages to redeploy. Hard refresh the site (Cmd+Shift+R) or use an incognito window to skip the browser cache.

---

## Troubleshooting

**"Token invalid or expired"** — Token got revoked, expired, or you typed wrong. Click ⚙ Change GitHub config and paste a fresh one.

**"Sync failed: GitHub API error 403"** — Token doesn't have write access. Recreate it with `public_repo` (or `repo` for private repos) scope.

**Edits aren't showing on my other device** — Pull-down to refresh, or hard reload. JS only fetches `data.json` on page load.

**I'm seeing old content** — Browser cache. Hard reload (Cmd+Shift+R) or open in incognito.

---

Made with love 💛
