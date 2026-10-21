# Automated Fix Finder (Option A: simulation-based optimisation, no LLM)

**Date:** 2026-10-21
**Where:** the uploaded-site workspace, **Compare actions** tab. It works on any uploaded site.

## 1. Goal and honesty

A **"Find the best fix"** button runs an automated analysis in four steps:
1. **Diagnose** the uploaded baseline run.
2. **Generate** candidate fixes.
3. **Simulate** each candidate with the FloodOps engine on the same uploaded rainfall.
4. **Rank** them, and show the best as pins on the map with result cards.

**OK** saves the chosen fix's run as the candidate and opens the side-by-side BEFORE/AFTER view. Nothing is run again; the run is the one already simulated.

**Wording:**
- Use "Automated analysis" and "optimisation engine".
- Never say "AI model", "machine learning" or "LLM".
- Every number shown comes from a simulation run during the analysis.
- **Costs are indicative placeholders**, labelled as such.

## 2. Fix types (engine actions on any `SiteSpec`)

Each action returns a new `SiteSpec` with a new `key` and a `label`. It is **never** applied to the original.

| Action | Effect | Indicative cost |
|---|---|---|
| `upsizePipe(pipeId, d)` | Sets that conduit's diameter (existing `withPipeDiameter`) | length × d × RM 5,000 per m per m of diameter (`CUSTOM_PIPE_RM_PER_M_PER_M_DIA`) |
| `reliefPipe(from, to, d)` | New conduit `RELIEF-<from>-<to>`: length = plan distance, Manning n = 0.013, from-invert > to-invert required | as above |
| `addStorage(nodeId, volumeM3)` | Gives that node a storage plan area = volume ÷ its max depth (asset field `storage_area_m2`) | RM 1,500 per m³ |
| `extraInlet(nodeId, grates = 1)` | Adds grate area at that node's inlet (+0.6 m² per grate; an inlet is created at the node if none exists) and scales that node's catchment capture by (n + 1) ÷ n | RM 8,000 per grate |

**Standard pipe sizes (m):** 0.30, 0.375, 0.45, 0.525, 0.60, 0.675, 0.75, 0.825, 0.90, 1.05, 1.20, 1.35, 1.50.

**Engine support:**
- `AssetNode` gains an optional `storage_area_m2`, which sets the node's storage area in `buildNetwork` (default unchanged).
- `SiteSubcatchment` gains an optional `captureScale` (default 1), which multiplies the captured flow values of its capture curve.
- The built-in Taman Kyra is unaffected.

## 3. Diagnosis (pure, from the baseline run)

Inputs: team frames, metrics and the `SiteSpec`. Outputs:
- **Per pipe:** peak load (max `capacity_fraction`) and minutes at ≥ 0.999.
- **Per node:** whether it ever floods (`status === 'flooding'`) and its peak depth.
- **Totals:** the hotspot node and its peak (`metrics.j07_peak_depth_m`), homes flooded, and street flood volume.
- **Bottlenecks:** pipes with peak load ≥ 0.999, sorted by minutes surcharged (descending), then by peak load.

## 4. Candidate generation (pure, at most 6 candidates)

1. **Upsize:** for each of the top 2 bottlenecks, the next 2 standard sizes above its current diameter.
2. **Relief pipe:**
   - From the worst flooding node A (the hotspot if it floods; otherwise the node with the most flooding frames), follow the downstream path.
   - Pick the first node B at least 2 links downstream with `invert(B) < invert(A) − 0.1`.
   - Diameter = the diameter of the first pipe leaving A.
   - Skip if there is no such B.
3. **Storage** at the upstream node of the top bottleneck:
   - volume = max(200, ceil(baseline street flood volume × 1.2 / 100) × 100) m³;
   - skip if that node's max depth is under 0.5 m.
4. **Extra inlet:** +1 grate at the hotspot node.

**Rules:**
- Drop duplicates.
- Keep the order above, truncated to 6.
- With no bottleneck and no flooding, there are no candidates, and the log says "No flooding found; nothing to fix".

## 5. Ranking

**Improvement:** a candidate counts as an improvement if any of these hold:
- homes flooded decrease;
- street flood volume decreases by ≥ 1% (and ≥ 1 m³);
- hotspot peak decreases by ≥ 0.01 m.

Non-improving candidates are listed as "no effect" in the log and excluded from the cards.

**Sort order:**
1. fewest homes flooded;
2. lowest street flood volume;
3. lowest hotspot peak;
4. lowest cost.

The **top 3** become cards and pins. The first is marked **Recommended**.

## 6. Running

- **Baseline:** if there is no baseline run yet, the analysis runs one first, saved as the baseline run exactly like **Run uploaded baseline**.
- **Candidates:**
  - simulated on a pool of up to 3 engine workers (`min(3, max(1, hardwareConcurrency − 1))`), same storm and same options;
  - each result kept in memory (frames, metrics, depth) until the user picks one or leaves the tab;
  - only the chosen one is saved as a run (`input_snapshot.intervention = { kind, label, changes }`).
- **Streaming log**, in the order events happen:
  - "Reading baseline results… {pipe} full for {m} min; {hotspot} peaks at {d} m; {h} homes flooded; street flood volume {v} m³";
  - "Bottleneck found: {pipe} (Ø{mm}) at {pct}% capacity" (one line per bottleneck, max 2);
  - "Generating {n} candidate fixes: {labels}";
  - "Simulating {i}/{n}: {label}…", then "{label}: {hotspot} peak {d} m, homes {h}, flood volume {v} m³ ✓ / no effect";
  - "Ranking by homes flooded, flood volume, peak depth, then cost…";
  - "✔ Recommended: {label}: {before → after values}, about RM {cost} (indicative)".
- **Cancel** stops the analysis between candidates.
- **Elapsed time** is shown. The note says "about 20–30 s per candidate; candidates run in parallel".

## 7. User interface (Compare actions tab)

- **Button:** "🔍 Find the best fix (automated analysis)" sits above the manual pipe test.
- **Analysis panel:**
  - the streaming log, monospaced, auto-scrolling;
  - a progress bar (`i / n` simulated);
  - Cancel;
  - when finished, up to 3 **result cards**: label, Recommended badge, before → after for homes flooded, street flood volume and hotspot peak, indicative cost, and **Show on map**, **OK** and **Dismiss** buttons.
- **Map pins** (`SiteCityScene`):
  - one pin per card, at the fix's location: pipe midpoint, node, or relief-pipe midpoint;
  - a numbered badge;
  - clicking a pin highlights its card;
  - relief pipes are previewed as a dashed line.
- **OK:**
  - saves the chosen run;
  - sets it as the candidate;
  - switches to side by side;
  - the AFTER title uses the fix label;
  - the comparison strip works for every fix type.
- **Dismiss** hides a card and its pin.
- **Footer:** "Every option was simulated by the FloodOps engine on your uploaded storm. Costs are indicative placeholders; engineering and site checks still required."

## 8. Process

- Commits by the user only, with no co-author lines. No push until asked.
- Tay's files: minimal, gated edits, with credit lines.

## 9. Amendment: automatic analysis and pins timed to playback (2026-10-21)

This replaces the button-and-card-list flow in §1, §6 and §7.

**Trigger:**
- The analysis starts **automatically in the background** as soon as a baseline run finishes, or when a stored baseline is shown and no analysis exists for it in this session.
- There is no "Find the best fix" button. A small "Analysing fixes… i/n" status shows in the Compare sidebar.

**Problems and their onset:** the diagnosis also lists **problems**, each with a location and an **onset time** taken from the baseline frames:
- **Bottleneck pipe:** the first frame where its load is ≥ 0.999. Location: the pipe midpoint.
- **Ponding node:** the first frame where the node is `flooding`, or the hotspot's street depth reaches ≥ 0.15 m. Location: the node.

At most 3 problems, ordered by onset.

**Fix per problem:**
- Candidates are tied to a problem:
  - upsize, relief and storage → the bottleneck (relief and storage attach to the bottleneck's upstream node);
  - extra inlet → the ponding node.
- The pin shows the best-ranked improving fix for that problem. If none improve: "No tested fix reduced flooding here".

**Pins during playback:**
- While the baseline plays (single view), each problem's pin pops up on the city map at its location when playback time ≥ its onset, with a short animation.
- Card text: "⚠ {problem}: {pipe/node} {full / water 0.15 m} at {mm:ss}", then the suggested fix label with before → after for homes flooded, street flood volume and hotspot peak, an indicative cost, and **OK** / **Dismiss**.
- **Analysis not finished yet:** the pin shows "⚠ {problem} detected — testing fixes… (i/n)" and fills in when ready.
- **Seeking backwards** hides pins whose onset is later than the current time.

**OK:** saves that fix's run, sets it as the candidate, and switches to side by side. **Dismiss** hides the pin.

**Analysis details:**
- A collapsible "Analysis details" section in the sidebar holds the real streaming log (§6 message formats) and the list of every tested fix with its result, including "no effect".
- Footer as §7.

## 10. Amendment: per-problem fixes and a 3-zone demo package (2026-10-21)

**Why:** the current sample has a single cause (PIPE-P07), so every pin suggests an upsize. The finder should be able to show different fix types where different causes exist. The demo needs a synthetic package in which they do.

### Finder changes (engine)

- **Series bottlenecks become one problem.** Bottleneck pipes that are consecutive along the flow path (the downstream end of one is the upstream end of the next) are merged into one problem, located at the most upstream pipe of the chain.
- **Candidates are generated per problem**, in onset order, for up to 3 problems:
  - **Bottleneck chain:**
    - upsize the most-loaded pipe in the chain to the next 2 standard sizes;
    - one relief pipe from the chain's upstream node to the first node at least 1 link below the chain's last pipe, with invert(B) < invert(A) − 0.1. Diameter = the largest pipe in the chain. The existing duplicate-route and uphill pre-filters apply.
  - **Ponding node:** an extra inlet grate at that node.
- **Storage is no longer generated.** The storage action stays in the engine.
- **Cap:** at most 8 candidates. Each problem keeps at least 1 candidate.
- **Best fix per problem:** the best improving fix tied to that problem. The §9/§3 fallback to another problem's fix applies only if none of its own fixes improves.

### Demo package `data/samples/taman_kyra_demo/` (synthetic, alongside the existing sample)

- **Base:** the same Taman Kyra layout and ground (houses, roads, pond, canal). The network is changed so there are 3 independent problem zones in different parts of the map:
  - **Zone A, trunk:** one undersized trunk pipe. Its best fix is an **upsize**.
  - **Zone B:** two undersized pipes in series on a separate branch. Upsizing either one alone barely helps; a **relief pipe** bypassing both is best.
  - **Zone C:** a low street with a small, partly blocked grate and spare pipe capacity below it. Only **extra inlet grates** help.
- **Plausible values:** MSMA ranges for diameters, n and slopes.
- **Labelling:** everything is labelled synthetic in the file titles and README; the coordinates are the illustrative projected metres used by the sample.
- **Generator:** `npm -w @floodops/engine run sample` also writes this package, and the drift test covers it. The portal links it as "Download the 3-zone demo (synthetic)".
- **Reproducibility:** a slow test (in `story`) runs the real finder pipeline on the package. It asserts 3 problems in different zones, with best fixes of upsize, relief and extra inlet respectively. Nothing is hard-coded: the engine must arrive at these outcomes.
