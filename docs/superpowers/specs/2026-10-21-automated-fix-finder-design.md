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
