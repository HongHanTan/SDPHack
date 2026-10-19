# Township Flood Simulator

Sime Darby Property University Hackathon 2026 — Theme: PLANET (Climate Resilience).

A browser-based 3D what-if tool: apply candidate drainage interventions to a township, run an MSMA-style
design storm, and compare flood depth, homes flooded, time-to-passable and indicative cost against the baseline.

## Run

    npm install
    npm run dev        # http://localhost:5173
    npm test           # unit tests
    npm run story      # demo-story acceptance checks (~5 min)
    npm run tune       # metrics table for all presets
    npm run build      # static site in dist/

## Model (honest summary)

- Surface: virtual-pipes shallow-water scheme on a 128×128 grid at 4 m (Mei et al. 2007).
- Timestep: 0.5 s coupling step; the surface is sub-stepped by a stability guard (n = ceil(dt / maxStableDt),
  maxStableDt = 0.8·√(dx/4g) ≈ 0.255 s at 4 m), with the river stage re-imposed every sub-step. See docs/tuning.md.
- Pipes: Manning full-bore capacity with capacity-based routing, surcharge spill, orifice outfall with river backflow.
- Rain: MSMA 2nd Ed. IDF form, alternating-block hyetograph. **Coefficients are provisional until replaced from Table 2.B1.**
- Water balance is checked every run (< 1% error).
- Simplified relative to SWMM dynamic-wave; validation against SWMM is the next step.
- Site is synthetic; costs are indicative placeholders.

See `docs/superpowers/specs/` for the design and `docs/tuning.md` for calibration notes.
