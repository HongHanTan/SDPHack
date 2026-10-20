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
