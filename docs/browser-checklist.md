# Browser checklist

Run `npm run dev`, open http://localhost:5173.

## Live (default)
1. Page load: storm starts immediately; rain streaks fall; gauge shows mm/hr with the current bar highlighted; clock counts up ~1 min/s.
2. Speed ½× / 2× / 4×: clock rate changes accordingly.
3. Pause / Resume: water and clock freeze and continue.
4. "Peak rain": status says fast-forwarding, then the clock shows 60 min and rain is heaviest.
5. "Rain stops": at 120 min rain streaks disappear; water keeps draining.
6. Toggle "One-way valve" around 60–80 min: chart gets a "+ valve @ N min" marker and the sag depth trend changes within a few seconds.
7. Toggle the tank off mid-storm: no error; water balance badge stays ✓.
8. Draw a pipe (SL0 → O) mid-storm: it appears and the chart gets a "+ pipe SL0→O" marker.
9. Click "Cheapest fix" combo: valve + tank switch on, footer shows 2 installed · RM 2.65M.
10. Storm reaches 180 min: status "Storm over", Play button reads Restart.
11. Change storm to 10-year: run restarts; badges update.

## Panel and pins
12. Groups appear in order; badges green/red/grey as expected (bigger drain red).
13. Hover ⓘ: tooltip shows description, RM cost, homes change.
14. Click a map pin: popover with Install switch; toggling it updates the panel switch and pin colour (blue = installed). Esc / outside click closes it.
15. "Pins: off" hides pins; Draw mode hides them temporarily.

## Compare
16. Switch to Compare: live pauses; baseline preloads; Run storm works exactly as before (cards, chart, both balances).
17. During a Compare run tabs, panel, pins and draw are disabled.
18. Back to Live: resumes; any changes made in Compare are applied with a "changes" marker.

## Build
19. `npm run build && npm run preview`: both workers load; Live and Compare work.

## Visual upgrade
20. Day look: pastel ground with soft lot shadows, trees on the hill/park/boulevard, soil cross-section on the sides, warm light with shadows, sky gradient; water is teal, glossy, with white shallow edges and gentle ripples.
21. 🩻 X-ray: ~0.6 s fade to the dark digital-twin look; ground semi-transparent; pipes glow underground at their real depth; chevrons flow from upstream to downstream, faster on fuller pipes; overflowing manholes glow red; pins switch to dark/cyan.
22. X-ray off: fades back to day.
23. Plan: camera eases to top-down (north up); drag pans, wheel zooms, no rotation; flat coloured pipe ribbons with arrows; "N ↑" and a 50 m scale bar that resizes with zoom; pins and Draw pipe still work.
24. Plan + X-ray together works.
25. Quality Low: shadows, bloom and ripples off; noticeably lighter. High restores them.
26. Auto-drop: DevTools → Performance → CPU 6× slowdown; within a few seconds quality switches to Low once with a status message.
27. Live and Compare behave exactly as before in every look.

## Team UI (engine mode) — `npm run dev:web`
28. Header shows Engine | Mock | SWMM API; Engine is selected by default.
29. Run the 80 mm/h storm: water rises at the J07 junction over time, pipes P05/P07 turn red (surcharged), rain stops at 60 min and water drains afterwards.
30. The J07 pond surface looks flat (dips visible as a gentle hollow in lawn and roads); houses near J07 stand in water at the peak.
31. Intervention dashboard shows 7 cards from the engine; Desilt card shows "No effect on its own while P07 runs full"; Combined is tagged Optimal Holistic Solution; Apply re-runs and the water drops.
32. Live toggle: storm plays continuously; Apply mid-storm changes the water in place; speed/pause/jumps work.
33. Switch to Mock: the team's original app (inspectors, debris lab, offline SWMM run) works unchanged. Switch to SWMM API with the backend stopped: a clear error, no silent fallback.
34. `npm run build` passes; the built app loads both engine workers.

## Team UI: X-ray and 2D — `npm run dev:web`
35. 🔬 X-ray off by default; the scene looks exactly as before. Turning it on fades (≈0.6 s) to a dark navy scene: houses/roads ghosted, trees gone, pipes glowing with chevrons, manholes glowing, bloom.
36. X-ray works with each of Digital Twin, Realistic Surface and Underground Only (Underground + X-ray: no surface, glowing network).
37. Engine mode, 80 mm/h storm with X-ray on: chevrons speed up as pipes load; P07 turns red; flood water is bright cyan.
38. 3D | 2D: 2D glides overhead (≈0.5 s), north up; drag pans, wheel zooms, no rotation; camera presets are disabled; the scale bar changes step as you zoom.
39. In 2D: trees and 3D labels hidden; pipes drawn on top of roofs; clicking a pipe opens the asset panel. Back to 3D returns to the previous angle.
40. 2D + X-ray: dark map with glowing pipes.
41. Mock and SWMM API modes: both toggles work; with both off the team's original views are unchanged.

## Site import — `npm run dev:web` (engine mode)
Note: items 42–53 describe the engine-mode Import site page, which was replaced by Tay's upload portal; see items 57–59.

42. Open the app (engine mode): the Import site page appears first → choose `data/samples/taman_kyra_site/taman_kyra.inp`, `taman_kyra_layout.geojson`, `taman_kyra_ground.asc` → Check files: no errors; summary shows 9 nodes, 8 pipes, 4 inlets, 35 buildings, grid 125 × 145 at 2 m, moved by (−412000, −336000) m → Generate city: the township looks like the built-in one (roads, houses, pond, canal) and the HUD hotspot reads NODE-J07.
43. Run 80 mm/h: water gathers at J07, P07 turns red — same as the built-in run.
44. Re-import with `taman_kyra_p07_750.inp`: P07 no longer runs full; less water at J07.
45. Watch for changes (Chrome/Edge): edit `taman_kyra.inp` (e.g. move NODE-J05 by 20 m in [COORDINATES], or change PIPE-P05's diameter) and save → within ~2 s the city regenerates and the header chip's time updates.
46. Break the file (delete the [OUTFALLS] section) and save → errors shown, the current city kept.
47. Upload only the `.inp`: a city with ground from manhole levels, an outfall sink and default grates; assumptions list says so.
48. Intervention dashboard on an imported site shows the notice and no Apply; the **Use built-in demo township (Taman Kyra)** link on the Import site page (reached via the header's 📂 Import site) restores Jiajie's scene and the 7 cards.
49. X-ray and 2D work on an imported site; 2D frames the site and the scale bar is correct.
50. Mock and SWMM API modes: no Import site button; unchanged.
51. Fresh load in engine mode shows the Import site page, not the dashboard; "Use built-in demo township (Taman Kyra)" opens the dashboard with the original scene.
52. After Generate city with Watch on, the header shows "👁 Watching 3 files"; saving an edited .inp updates the city on the dashboard and the chip's time; a broken save shows the red banner and keeps the city; ✕ on the chip stops watching.
53. Header 📂 Import site returns to the Import site page with Back to dashboard; Mock/SWMM API start on the dashboard as before.
54. (Retired: replaced by items 57–59.) Portal: choose taman_kyra.inp + taman_kyra_layout.geojson + taman_kyra_ground.asc → a "SWMM package converted" card lists originals, counts and what was left out (trees, pond, canal, hotspot, roundabout) → Check my files: map and simulation ready.
55. (Retired: replaced by items 57–59.) Build my township → Compare actions → Run uploaded baseline → test PIPE-P07 at 0.75 m: the network flooding loss drops.
56. (Retired: replaced by items 57–59.) A building without height_m in a custom layout is omitted with a note; an .inp mixed with nodes.csv shows the "either … or" error. CSV/JSON uploads behave as before.
57. Upload screen shows three slots (SWMM model, Layout, Height grid); only the matching file type can be chosen in each; Check my files works with no API running.
58. Build my township shows Tay's map from the three files; Compare actions runs the baseline in the browser (progress shown), then PIPE-P07 at 0.75: the street flood volume drops.
59. Reload the page: the project is listed under Your saved projects and opens with its retained runs; inspections and proposals persist.
