# T1 synthetic SWMM model

`baseline.inp` and `stronger.inp` are complete runnable SWMM 5.2 inputs for constant 80 and 120 mm/h rain respectively, lasting 60 minutes plus 60 minutes dry drainage. Both use the published `taman_kyra_synthetic_v1` asset IDs and assumed normal tailwater. Only the rain intensity changes.

The deterministic generator is `simulation/swmm/model.py`. Geometry comes from `data/synthetic/taman_kyra_assets.json`; hydrology and numerical settings come from `hydrology.json`. These JSON files and the generator are authoritative. Tests ensure the checked-in `.inp` snapshots match them. All hydrology and geometry are uncalibrated synthetic inputs.

Run the six-run validation suite from the repository root:

```powershell
.\services\api\.venv\Scripts\python.exe -m simulation.swmm.demo
```

Each invocation uses a new ignored `data/runtime/t1-...` directory. An explicit `--output` must name a directory that does not exist; existing runs are never overwritten. The suite runs both rain intensities, repeats each, and halves each routing step. It retains `.inp`, `.rpt`, `.out`, native statistics, logs, frames, metrics, run snapshots, QA and a summary.

The curated execution evidence is `data/validation/t1/`; model assumptions and metric/status definitions are documented in `md/MODEL_ASSUMPTIONS.md`. The T1 clean case assumes unrestricted direct entry of runoff into sewer nodes. A real finite-capacity inlet adapter is T3, and is not approximated by narrowing a pipe.
