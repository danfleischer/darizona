# CLAUDE.md — Darizona Masters

## Project overview

Vite + vanilla JS SPA. No framework. Supabase Postgres for persistence. ESPN public API for live scores.
PIN-only login; Supabase Auth + RLS are not used.

**Mobile-first — this is the primary use case.** Everyone accesses the app on their phone. All UI decisions should prioritize the mobile experience. Key constraints: 16px minimum font-size on inputs (prevents iOS auto-zoom), touch targets ≥44px, no horizontal overflow, single-column layouts.

---

## Module map

```
src/
├── main.js          Entry point: CSS import, event listeners, init()
├── constants.js     TIERS, PROPS, MASTERS_LOCK, PROPS_LOCK, CUT_PENALTY, NUM_PROPS, NAME_ALIASES
├── state.js         Single mutable state object
├── espn.js          fetchESPN, lookupScore, normName — ESPN leaderboard API
├── utils.js         show, getParam, shareURL, mastersLocked, propsLocked, fmtTime, isCommissioner, perPropPot, esc, normName
└── pages/
    ├── auth.js      PIN login
    ├── picks.js     startPicking, renderPickPage, renderTiers, toggleTier, togglePick, submitPicks
    ├── propPicks.js showPropPicks, renderPropPickScreen, syncPropPicksFromDOM, setPropPick, submitPropPicks
    ├── leaderboard.js showLeaderboard, loadLeaderboard, renderLeaderboard, scoreClass, loadTestScores
    ├── summary.js   showSummary, renderSummary, copyLink, exportCSV
    └── fun.js       showFun, showFunSection, renderPropsView, showResultsEntry,
                     renderResultsForm, setResult, saveResults, calculateAndShowPayouts
```

## Dependency order (no circular imports)

```
constants  ← nothing
state      ← nothing
utils      ← state, constants
espn       ← state, constants, utils
pages/*    ← state, constants, utils, espn (+ sibling pages as needed)
main.js    ← everything
```

**Navigation**: Pick/Prop screens go back to Summary (no join page).

---

## State

All mutable state lives in `src/state.js` as a single default-exported object.

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
| `#tier-list` | `togglePick`, `toggleTier` |
| `#prop-pick-list` | `setPropPick` |
| `#results-form` | `setResult` |

---

## Key gotchas

- **`normName`** is in `utils.js` — imported into `espn.js`. Do not duplicate.
- **`pendingResults`** lives in `state.pendingResults` — used by `fun.js` for yes/no result entry before saving.
- **`lbTimer`** must always be `state.lbTimer`, never a local var, or clearInterval won't work across navigations.
- **XSS**: use `esc()` from `utils.js` for any user-provided data in innerHTML.
- **`syncPropPicksFromDOM()`** must be called before any re-render in propPicks page, to capture number inputs and select values before they're replaced.

---

## Build & deploy

```bash
npm run build    # outputs to dist/
```

GitHub Pages: push `dist/` or configure Pages to build from `main` branch using Vite.
