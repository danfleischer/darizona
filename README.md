# The Darizona Masters

A Masters golf pool app for Darren Sweetwood's bachelor party. Tracks picks across 6 tiers of golfers, Saturday prop bets, a live leaderboard pulling from ESPN, a trash talk board, and automatic payout calculation.

No backend — uses Firebase Realtime Database directly from the browser. Deployed as a static site on GitHub Pages.

---

## Setup (first-time commissioner)

### 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in
2. **Add project** → name it anything → click through → Create project
3. Left sidebar: **Build → Realtime Database → Create Database** → any location → **"Start in test mode"** → Enable
4. Copy the database URL shown: `https://your-project-default-rtdb.firebaseio.com`

### 2. Run the app locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, paste your Firebase URL, and follow the setup flow.

### 3. Deploy to GitHub Pages

```bash
npm run build
```

Push the repo to GitHub, then enable Pages from the `gh-pages` branch or the `dist/` folder (via GitHub Actions or manually).

Because `vite.config.js` uses `base: './'`, all asset paths are relative — works in any subdirectory.

---

## How it works

Shareable URL format: `https://your-site/?fb=<firebase-url>&pool=<pool-key>`

Anyone with the link lands on the join page and can pick their golfers and props without creating an account. The commissioner's name is stored in `poolData.config.by`.

### Picks lock times
- **Masters picks**: Thursday 8am ET (`MASTERS_LOCK` in `src/constants.js`)
- **Prop bets**: Saturday 10am ET (`PROPS_LOCK` in `src/constants.js`)

### Scoring
- Masters: sum of finishing positions across your 6 picks. Missed cut = +80. Lowest wins.
- Props: 1 point per correct answer. Closest guess wins number props (tie: lower guess wins).

### Payouts
- Masters: 70% first, 30% second
- Props: 90% first, 10% second; tiebreak on Darren's exact score guess

---

## Local development

```bash
npm run dev      # dev server with HMR
npm run build    # production build → dist/
npm run preview  # preview the dist/ build locally
```
