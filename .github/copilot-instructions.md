# Copilot / AI Agent Instructions — RadQy

This file gives a compact, actionable orientation for AI coding agents working in this repository.

1) Big picture
- Front-end only static UI living under `UserInterface/` (HTML/CSS/JS). There is no server-side code in this repo; the app runs in a browser and expects `window.DATA` to be populated with a dataset object.
- Key folders: `UserInterface/` (entry `index.html`), `UserInterface/scripts/` (JS), `UserInterface/css/` (styles), `UserInterface/libs/` (third-party libs), and `Data/` (sample datasets).
- The UI is event-driven: components communicate via custom DOM events (e.g. `radqy:data:ready`, `radqy:data:updated`, `radqy:colorby:changed`, `radqy:selection-changed`, `radqy:legend:update`). See `UserInterface/scripts/legend.js` and `pcp.js` for examples.

2) Runtime shape & globals (very important)
- `window.DATA`: primary data object with `HEADERS`, `ROWS`, and optional `META` (fields used: `N`, `tags`, `iqms`, `auxs`, `exts`, `N_selected`, `colorByLegend`). Many modules read from and write to `window.DATA`.
- `window.VIEW_STATE` and `window.CHART_STATE`: global view/chart settings. `pcp.js` exposes and mutates `window.CHART_STATE` and uses `window.VIEW_STATE.colorBy`.
- `window.dt`: DataTables instance used by table synchronization code.
- Helper functions exposed globally: `radqyMergedDataset`, `radqyInferNumericColumns`, `renderChartsView`, `selectRowInTable`, `selectCaseAndRefresh`, `hoverPCPLine`, `bringPCPLineToFront` (see `pcp.js`).

3) Event & communication patterns (copyable examples)
- Emit data-ready: `window.dispatchEvent(new CustomEvent('radqy:data:ready'))` once `window.DATA` is set.
- Update legend metadata: `window.dispatchEvent(new CustomEvent('radqy:legend:update', {detail:{meta: {...}}}))`.
- Change color-by: `window.dispatchEvent(new CustomEvent('radqy:colorby:changed', {detail:{header: 'MyHeader'}}))`.
- Other modules listen via `document.addEventListener('radqy:data:ready', ...)` and similar — prefer using these events when adding features.

4) Third-party libs & compatibility notes
- D3 version: `libs/d3-3.5.17/` — the code uses D3 v3 APIs (`d3.svg.line`, `d3.scale.ordinal`, `d3.behavior.drag`). Do NOT modernize to D3 v4+ APIs without updating all usages.
- DataTables is used (`libs/DataTables/`), jQuery 1.12.4 is present. Code frequently uses `window.dt.rows()` and jQuery-style DOM manipulation.
- Other libs: `umap-js`, `d3-lasso`, `xlsx` — search `UserInterface/libs/` to confirm glue code.

5) File-level conventions and patterns to follow
- The codebase favors plain ES5-style patterns to maintain compatibility; comments in `pcp.js` explicitly mention "No optional chaining". Avoid modern syntax changes unless you update project-wide dependencies.
- Many modules add functions to `window` and rely on global mutable state; when modifying code, prefer exposing minimal helpers and keep existing event names and global keys stable.
- CSS variables are used for palette colors (see `UserInterface/scripts/pcp.js` referencing `--cat2-base`, etc.). Prefer using existing variables/classes (`pcp-axis-tag`, `pcp-axis-iqms`, `pcp-selected-line`) instead of adding new global style conventions.

6) Developer workflow & quick commands
- No build system: open `UserInterface/index.html` in a browser, or serve the folder with a simple static server. Example (zsh/macOS):

```bash
cd UserInterface
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

- Alternatively: `npx http-server UserInterface -p 8000` or any static server of choice.
- Debugging: use browser DevTools (console, breakpoints). Many interactive behaviors are triggered by custom events — you can dispatch them from the console to exercise components.

7) Quick heuristics for changes and PRs
- Keep D3 v3 usage intact unless you intentionally upgrade the whole codebase.
- Preserve event names and `window.*` keys; many components discover state via those globals.
- When changing data shape, update both `scripts/data.js` (producer) and consumers (`pcp.js`, `legend.js`, `table.js`). Document `window.DATA` shape changes in `UserInterface/scripts/data.js` and update `META` consumers.

8) Key files to inspect for common edits
- `UserInterface/scripts/pcp.js` — main charting and PCP logic; exposes many globals.
- `UserInterface/scripts/legend.js` — legend rendering, `radqy:legend:update` handlers, `radqy:colorby:changed` handling.
- `UserInterface/scripts/table.js` — DataTables integrations and selection syncing (look for `window.dt` usage).
- `UserInterface/scripts/data.js` — data loading and normalization helpers.

If anything here is unclear or you want the file to include additional examples (e.g., example `window.DATA` JSON or a list of event payload shapes), tell me which examples you want and I will add them.
