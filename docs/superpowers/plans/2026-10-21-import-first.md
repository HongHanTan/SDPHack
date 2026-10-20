# Import-First Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In engine mode, open on a full-page Import site screen. Upload files, then Generate city opens the dashboard. Watching for file changes continues on the dashboard.

**Architecture:**
- The file picking, checking, generating and watching logic moves out of the modal `SiteImportPanel` into an app-level hook, `useSiteImport`.
- A presentational `SiteImportPage` renders it full-page.
- `App` holds a `stage` (`'import' | 'dashboard'`) and a `siteChosen` flag, decided by pure helpers in `siteFlow.ts`.
- The header gets a watch chip, and the dashboard a dismissible error banner.

**Tech Stack:** React 19, Tailwind 4, Vitest 2.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-10-21-site-import-design.md` §9.
- **Engine-mode start:**
  - The app opens on the **Import site** page: **Choose files… → Check files → Generate city**, which opens the dashboard.
  - A secondary link, **"Use built-in demo township (Taman Kyra)"**, opens the dashboard with the built-in site.
- **Mock and SWMM API:** open on the dashboard as before. Switching to engine mode before any city has been chosen shows the Import page.
- **Header:**
  - **📂 Import site** opens the full-page Import page. The modal is removed. Once a city has been chosen, the page shows **Back to dashboard**.
  - A watch chip, **"Watching N files · updated hh:mm:ss"** (or "· no changes yet"), has a ✕ that stops watching.
- **Watching** continues on the dashboard. A change with errors keeps the current city and shows a dismissible red banner below the header, with the first error and an **Open Import site** button.
- Every page load starts on the Import page. Nothing is stored. Files are read in the browser only.
- **Unchanged:**
  - Mock and SWMM API behaviour;
  - built-in engine behaviour after choosing it;
  - all existing behaviour of checking, reports, watching (1.5 s, 3-failure retry, same-key skip) and `applySite`.
- **Process:**
  - Commits by the user only. NEVER add Co-Authored-By or any co-author line. Do not push. Never stage `md/progress/honghan.md`.
  - Body line on commits touching Jiajie's files: "App/StatusHeader by TEH JIA JIE; engine-mode import flow only."
- **Verify:**
  - `npm -w township-floodops-web test`
  - `npm -w township-floodops-web run build` (check the exit code)
  - `npm -w @floodops/engine test`
  - root `npm test`

  Delete `dist` afterwards.

---

### Task 1: App-level import state, full-page Import screen, stage flow

**Files:**
- Create:
  - `apps/web/src/site/siteFlow.ts`
  - `apps/web/src/site/useSiteImport.ts`
  - `apps/web/src/site/SiteImportPage.tsx`
- Test: `apps/web/src/site/__tests__/siteFlow.test.ts`
- Delete: `apps/web/src/site/SiteImportPanel.tsx` (its logic moves into the hook, its markup into the page)
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- **Consumes:**
  - `useSiteFiles` (unchanged);
  - `buildSiteFromFiles`;
  - App's `applySite(site | null)`.
- **Produces:**
  - `type Stage = 'import' | 'dashboard'`
  - `initialStage(mode: DataMode): Stage` → `'import'` for `'engine'`, else `'dashboard'`
  - `stageOnModeSwitch(newMode: DataMode, siteChosen: boolean, current: Stage): Stage`
  - `useSiteImport({ activeSiteKey: string; onApply: (site: SiteSpec) => void })` → `{ files, roleOf(name), warnName(name), pick(), check(), checked, errors, report, status, busy, canWatch, watching, setWatching, lastChange, dismissStatus() }`
    - `errors` = read errors + report errors.
    - `status` = `{ kind: 'ok' | 'bad'; text: string; firstError?: string } | null`.
  - `<SiteImportPage imp activeSite onGenerate(site) onUseBuiltIn() onBack? />`

- [ ] **Step 1: Failing test** `apps/web/src/site/__tests__/siteFlow.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { initialStage, stageOnModeSwitch } from '../siteFlow';

describe('siteFlow', () => {
  it('starts on the import page in engine mode only', () => {
    expect(initialStage('engine')).toBe('import');
    expect(initialStage('mock')).toBe('dashboard');
    expect(initialStage('api')).toBe('dashboard');
  });
  it('shows the import page when entering engine mode before a city is chosen', () => {
    expect(stageOnModeSwitch('engine', false, 'dashboard')).toBe('import');
    expect(stageOnModeSwitch('engine', true, 'dashboard')).toBe('dashboard');
    expect(stageOnModeSwitch('mock', false, 'import')).toBe('dashboard');
    expect(stageOnModeSwitch('api', true, 'import')).toBe('dashboard');
  });
});
```

Run `npm -w township-floodops-web test`. It should FAIL with the module not found.

- [ ] **Step 2: `apps/web/src/site/siteFlow.ts`**

```ts
import type { DataMode } from '../api/client';

export type Stage = 'import' | 'dashboard';

/** Engine mode opens on the Import site page; Mock and SWMM API open on the dashboard. */
export function initialStage(mode: DataMode): Stage {
  return mode === 'engine' ? 'import' : 'dashboard';
}

/** Entering engine mode before any city has been chosen shows the Import site page. */
export function stageOnModeSwitch(newMode: DataMode, siteChosen: boolean, current: Stage): Stage {
  if (newMode !== 'engine') return 'dashboard';
  return siteChosen ? current : 'import';
}
```

- [ ] **Step 3: `apps/web/src/site/useSiteImport.ts`.**
  - Move these from `SiteImportPanel.tsx` into a hook, keeping their behaviour exactly:
    - the state `checked`, `readErrors`, `status`, `busy`;
    - the refs `readRef`, `stopWatchRef`, `seqRef`, `activeKeyRef`, `readFailuresRef`, `retryRef`;
    - `handleChange`, `doPick` (exposed as `pick`) and `check`;
    - `cls`, `roleOf` and `warnName`.
  - **Changes from the panel:**
    - It is a hook used by `App` and is never unmounted while the app runs, so drop `mountedRef`. Keep `seqRef`, so only the latest change applies.
    - On an errored change, `status` becomes `{ kind: 'bad', text: <as before>, firstError: result.report.errors[0] }`. On a read failure after the retries, use `firstError: <message>`.
    - Add `dismissStatus()`, which sets `status` to null.
  - Return the interface listed above.

- [ ] **Step 4: `apps/web/src/site/SiteImportPage.tsx`.**
  - **Layout:** a full-screen page (`fixed inset-0 z-40 overflow-y-auto bg-slate-100`) with a centred white card (`max-w-3xl mx-auto my-10 rounded-2xl border border-slate-200 shadow-xl bg-white`).
  - **Header:**
    - title "Import site";
    - subtitle "Upload a SWMM model (.inp), and optionally a GIS layout (.geojson) and a height grid (.asc). The city is generated to scale from these files.";
    - "Active city: {activeSite.label}".
  - **Body:** the same markup as the old panel. Use `imp` for the file list with roles, the helper text, **Check files**, the summary `<dl>`, Errors, Warnings, Assumptions and the status line.
  - **Footer:**
    - **Generate city** (primary, red; disabled unless `imp.report?.ok && imp.checked?.site`) → `onGenerate(imp.checked.site)`;
    - the watch checkbox "Watch for changes (Chrome/Edge): keeps running on the dashboard", only when `imp.canWatch`;
    - **Back to dashboard**, only when `onBack` is given;
    - below the card, a small link-styled button "Use built-in demo township (Taman Kyra)" → `onUseBuiltIn()`.
  - Copy the class names from `SiteImportPanel.tsx` so the look matches. Then delete `SiteImportPanel.tsx`.

- [ ] **Step 5: App wiring.**
  - **State:**
    - `const [stage, setStage] = useState<Stage>(initialStage(apiClient.getDataMode()));`
    - `const [siteChosen, setSiteChosen] = useState(false);`
    - `const imp = useSiteImport({ activeSiteKey: site.key, onApply: applySite });`
    - Remove `isSiteImportOpen` and the modal render.
  - **Handlers:**
    - Generate: `const generateCity = (s: SiteSpec) => { applySite(s); setSiteChosen(true); setStage('dashboard'); };`
    - Use built-in: `const useBuiltIn = () => { applySite(null); setSiteChosen(true); setStage('dashboard'); };`
    - In `handleToggleMode`, add `setStage((cur) => stageOnModeSwitch(newMode, siteChosen, cur));`.
    - Header button: `onOpenSiteImport={engineMode ? () => setStage('import') : undefined}`.
  - **Render:** when `engineMode && stage === 'import'`, render only `<SiteImportPage imp={imp} activeSite={site} onGenerate={generateCity} onUseBuiltIn={useBuiltIn} onBack={siteChosen ? () => setStage('dashboard') : undefined} />`, and not the dashboard tree. Otherwise render the dashboard as now.
  - **Watched changes** keep calling `applySite` through the hook while on the dashboard.
  - **`applySite` stability:** `applySite` is read through the hook's `onApply`. If it is not stable, the hook must read it through a ref, so a watched change always uses the latest one.

- [ ] **Step 6: Verify.**
  - Run `npm -w township-floodops-web test` (PASS), `npm -w township-floodops-web run build` (exit 0) and root `npm test`. Delete `dist`.
  - Reason through each path:
    - engine start → import page;
    - Generate → dashboard with the imported city;
    - Use built-in → dashboard with Jiajie's scene;
    - Mock start → dashboard;
    - Mock → Engine before choosing → import page;
    - Import site button → page with Back.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): import-first flow — full-page Import site, then the dashboard; app-level file watching" -m "App/StatusHeader by TEH JIA JIE; engine-mode import flow only."
```

---

### Task 2: Header watch chip, change-error banner, docs

**Files:**
- Modify:
  - `apps/web/src/components/StatusHeader.tsx`
  - `apps/web/src/App.tsx`
  - `packages/engine/scripts/samplePackage.ts` (README text), then regenerate `data/samples/taman_kyra_site/README.md`
  - `docs/browser-checklist.md`

**Interfaces:**
- **Consumes:** `imp` from Task 1 (`watching`, `files`, `lastChange`, `setWatching`, `status`, `dismissStatus`).
- **Produces:** StatusHeader optional prop `siteWatch?: { count: number; updatedAt: Date | null; onStop: () => void }`.

- [ ] **Step 1: `StatusHeader`.**
  - When `siteWatch` is given, render a compact chip next to the 📂 Import site button: `👁 Watching {count} files · {updatedAt ? 'updated ' + hh:mm:ss : 'no changes yet'}`.
  - The chip has a small ✕ button (`title="Stop watching"`) → `onStop`.
  - Style: emerald pill (`bg-emerald-50 text-emerald-800 border border-emerald-200`), matching his header's pill sizes.
- [ ] **Step 2: App.**
  - **Chip:** pass `siteWatch={engineMode && imp.watching ? { count: imp.files.length, updatedAt: imp.lastChange?.at ?? null, onStop: () => imp.setWatching(false) } : undefined}`.
  - **Banner:** when `engineMode && stage === 'dashboard' && imp.status?.kind === 'bad'`, render it fixed below the header (`top-16`, centred, `z-30`) in red. It shows:
    - `imp.status.text` and `imp.status.firstError`;
    - an **Open Import site** button → `setStage('import')`;
    - a ✕ → `imp.dismissStatus()`.
  - **Success:** a successful watched update is shown by the chip's time only, with no banner.
- [ ] **Step 3: README.**
  - In `samplePackage.ts`, change demo step 1 to: "Start the app in engine mode: it opens on the **Import site** page. **Choose files…** → pick the three files `taman_kyra.inp`, `taman_kyra_layout.geojson` and `taman_kyra_ground.asc` → **Check files** → **Generate city**." Adjust any other "📂 Import site" mention to "the header's 📂 Import site button (back to the Import site page)".
  - Run `npm -w @floodops/engine run sample`. Then `npm -w @floodops/engine test` (drift) must PASS.
- [ ] **Step 4: Checklist.**
  - In `docs/browser-checklist.md`, change item 42 to begin "Open the app (engine mode): the Import site page appears first →", keeping the rest of the item.
  - Append:

```markdown
51. Fresh load in engine mode shows the Import site page, not the dashboard; "Use built-in demo township (Taman Kyra)" opens the dashboard with the original scene.
52. After Generate city with Watch on, the header shows "👁 Watching 3 files"; saving an edited .inp updates the city on the dashboard and the chip's time; a broken save shows the red banner and keeps the city; ✕ on the chip stops watching.
53. Header 📂 Import site returns to the Import site page with Back to dashboard; Mock/SWMM API start on the dashboard as before.
```

- [ ] **Step 5: Verify.**
  - Run `npm -w township-floodops-web test`, `npm -w township-floodops-web run build` (exit 0), `npm -w @floodops/engine test` and root `npm test`. Delete `dist`.
- [ ] **Step 6: Commit**

```bash
git add apps/web/src packages/engine/scripts/samplePackage.ts data/samples/taman_kyra_site/README.md docs/browser-checklist.md
git commit -m "feat(web): header watch chip and change-error banner; import-first docs" -m "StatusHeader by TEH JIA JIE; engine-mode import flow only."
```
