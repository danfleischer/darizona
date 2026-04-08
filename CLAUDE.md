# CLAUDE.md — Darizona Masters

## Project overview

Vite + vanilla JS SPA. No framework. Supabase (Postgres + Auth + RLS) for persistence. ESPN public API for live scores.

**Mobile-first — this is the primary use case.** Everyone accesses the app on their phone. All UI decisions should prioritize the mobile experience. Key constraints: 16px minimum font-size on inputs (prevents iOS auto-zoom), touch targets ≥44px, no horizontal overflow, single-column layouts.

---

## Module map

```
src/
├── main.js          Entry point: CSS import, all static event listeners, init()
├── constants.js     TIERS, PROPS, MASTERS_LOCK, PROPS_LOCK, CUT_PENALTY, NUM_PROPS, NAME_ALIASES
├── state.js         Single mutable state object — fbUrl, poolKey, poolData, me, myPicks, ...
├── firebase.js      fbGet, fbPut, fbPatch, fbPost — all use state.fbUrl
├── espn.js          fetchESPN, lookupScore, normName — ESPN leaderboard API
├── utils.js         show, getParam, shareURL, mastersLocked, propsLocked, fmtTime, isCommissioner, perPropPot, esc, normName
└── pages/
    ├── setup.js     doSetup
    ├── create.js    addPlayer, removePlayer, renderPlayerTags, refreshPot, createPool
    ├── join.js      renderJoinPage, showJoin
    ├── picks.js     startPicking, renderReadOnlyPicks, renderPickPage, renderTiers, toggleTier, togglePick, savePicks
    ├── propPicks.js showPropPicks, renderPropPickScreen, syncPropPicksFromDOM, setPropPick, savePropPicks
    ├── leaderboard.js showLeaderboard, loadLeaderboard, renderLeaderboard, scoreClass, loadTestScores
    ├── summary.js   showSummary, renderSummary, copyLink, exportCSV
    └── fun.js       showFun, showFunSection, renderPropsView, calcPropWinners, showResultsEntry,
                     renderResultsForm, setResult, saveResults, countCorrect, darrenScoreDiff,
                     calculateAndShowPayouts, loadTrash, renderTrash, postTrash
```

## Dependency order (no circular imports)

```
constants  ← nothing
state      ← nothing
firebase   ← state
utils      ← state, constants
espn       ← state, constants, utils
pages/*    ← state, constants, utils, firebase, espn (+ sibling pages as needed)
main.js    ← everything
```

**Circular risk resolved**: `picks.js` back button calls `renderJoinPage()` + `show('pg-join')` directly (imports from `join.js`), NOT `showJoin()`. `join.js` does NOT import from `picks.js`.

---

## State

All mutable state lives in `src/state.js` as a single default-exported object:

```js
{ fbUrl, poolKey, poolData, me, myPicks, myPropPicks, setupList,
  espnScores, lbTimer, tierCollapsed, pendingResults }
```

- `poolData` shape: `{ config: { players, buyin, prop_buyin, by }, picks, prop_picks, prop_results, trash }`
- `myPicks` shape: `{ t1: "Golfer Name" | null, ..., t6: ... }`
- `myPropPicks` shape: `{ [propId]: value | null }`
- `state.lbTimer` must always be cleared with `clearInterval(state.lbTimer)` before navigating away from the leaderboard page

---

## Event handling

### Static buttons → `addEventListener` in `main.js`
All buttons that exist in the HTML at parse time are wired once in `main.js`.

### Nav tabs → `data-nav` attribute
All 16 nav tab instances use `data-nav="join|leaderboard|summary|fun"`. A single delegated listener on `document` dispatches to the right function.

### Dynamic content → `data-action` + `data-*` on containers
Generated HTML uses `data-action` + `data-*` instead of `onclick`. Containers listen once:

| Container | Actions |
|-----------|---------|
| `#name-list` | `startPicking`, `startPropPicking` |
| `#player-tags` | `removePlayer` |
| `#tier-list` | `togglePick`, `toggleTier` |
| `#prop-pick-list` | `setPropPick` |
| `#results-form` | `setResult` |

---

## Key gotchas

- **`normName`** is in `utils.js` — imported into `espn.js`. Do not duplicate.
- **`pendingResults`** lives in `state.pendingResults` — used by `fun.js` for yes/no result entry before saving.
- **`lbTimer`** must always be `state.lbTimer`, never a local var, or clearInterval won't work across navigations.
- **XSS**: use `esc()` from `utils.js` for any user-provided data in innerHTML (player names from Firebase, prop results). Trash talk text is `.replace(/</g, "&lt;")` escaped in `renderTrash`.
- **`base: './'`** in `vite.config.js` is required for GH Pages subdirectory deployment.
- **Test button** (`#test-btn`) visibility is controlled in `showLeaderboard()` — must fire on navigation, not at init. Hidden when `mastersLocked()`.
- **`exportCSV`** uses a local `propPicks` var (from `state.poolData.prop_picks`) — do not confuse with `state.myPropPicks`.
- **`syncPropPicksFromDOM()`** must be called before any re-render in propPicks page, to capture number inputs and select values before they're replaced.
- **`create.js` imports `renderPickPage` from `picks.js`** — after creating a pool, commissioner goes straight to pick page.

---

## Build & deploy

```bash
npm run build    # outputs to dist/
```

GitHub Pages: push `dist/` or configure Pages to build from `main` branch using Vite.
