# Backend setup — Tay

Run all commands below from the repository root in PowerShell. Python 3.12 is the tested runtime (3.12.10 on Windows x64). Dependencies live in `services/api/`; model code lives in `simulation/`.

## Install and run

```powershell
python -m venv services/api/.venv
.\services\api\.venv\Scripts\python.exe -m pip install -r services/api/requirements-dev.txt
.\services\api\.venv\Scripts\python.exe -m pip install -r services/api/requirements-swmm.txt
.\services\api\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Activation is unnecessary. For API-only operation install `requirements.txt` instead of `requirements-dev.txt`. A tested full dependency snapshot is `services/api/requirements-tested.txt`; use it in place of the above install for the exact tested package versions, including optional SWMM and test tools. This is a version snapshot, not a hash-verified supply-chain lock.

Open `http://127.0.0.1:8000/docs` for interactive OpenAPI, or use:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
Invoke-RestMethod http://127.0.0.1:8000/api/bootstrap
Invoke-RestMethod http://127.0.0.1:8000/api/townships/taman_kyra_demo/assets
```

CORS permits `http://localhost:5173` and `http://127.0.0.1:5173` for frontend development. Set frontend `VITE_API_BASE_URL=http://localhost:8000` (or `http://127.0.0.1:8000`). The API binds loopback by default in the command above.

## Native SWMM probe

SWMM is optional for T0 catalog endpoints. To install the native toolkit and read its engine version:

```powershell
.\services\api\.venv\Scripts\python.exe -m pip install -r services/api/requirements-swmm.txt
.\services\api\.venv\Scripts\python.exe -m simulation.swmm.engine
```

On 2026-10-19, Python 3.12.10 / Windows x64 loaded `swmm-toolkit==0.17.0` and executed complete models with engine `5.2.4`. `available=true` means the native library loaded and answered a version request. `execution_verified=true` means current resolved inputs, engine/toolkit version and retained raw-file hashes match successful T1 evidence. Missing/stale evidence makes that flag false. API `status=ok` is independent of SWMM availability. T2 sets `capabilities.simulations=true` to identify the implemented route; check `swmm.available` separately. A missing package/DLL leaves the catalog usable and makes accepted runs explicitly fail with `ENGINE_UNAVAILABLE`.

Integration uses the [maintained swmm-python toolkit](https://github.com/pyswmm/swmm-python) directly rather than an additional PySWMM wrapper; hydraulic execution, input generation and parsing will remain under `simulation/swmm/`.

## Real offline SWMM validation

```powershell
.\services\api\.venv\Scripts\python.exe -m simulation.swmm.demo
```

This runs baseline (80 mm/h) and stronger (120 mm/h) constant one-hour rain, repeats both, then halves their routing steps. Each run includes one hour dry drainage. Outputs go to a fresh `data/runtime/t1-...` directory and include `.inp`, `.rpt`, `.out`, worker logs, immutable input snapshots/hashes, native statistics, frames, metrics, QA and a validation summary. A custom `--output` path must not exist. The native engine runs in a separate process with a timeout; failures retain logs and failed metadata without fabricated frames/metrics.

Curated successful evidence is retained in `data/validation/t1/`; portable runnable inputs are `models/illustrative_taman_kyra/{baseline,stronger}.inp`. Real schema-compatible fixtures are `contracts/examples/{run,frames,metrics}-{baseline,stronger}.json`. Read [`MODEL_ASSUMPTIONS.md`](MODEL_ASSUMPTIONS.md) for hydrology, QA policies, status thresholds and trace-flood sensitivity. No finite inlet restriction is implemented in T1.

## Verification and contract export

```powershell
New-Item -ItemType Directory -Force data/runtime | Out-Null
$tayTestTemp = Join-Path (Get-Location).Path ('data/runtime/pytest-' + [guid]::NewGuid().ToString('N'))
.\services\api\.venv\Scripts\python.exe -m pytest tests/api tests/simulation -q --basetemp=$tayTestTemp
.\services\api\.venv\Scripts\python.exe -m services.api.export_contracts --check
.\services\api\.venv\Scripts\python.exe -m pip check
```

After intentional schema/seed changes, regenerate the OpenAPI and response examples, then run the checks:

```powershell
.\services\api\.venv\Scripts\python.exe -m services.api.export_contracts
```

Read [`contracts/README.md`](../contracts/README.md) for supported endpoints and frontend conventions. `data/synthetic/` is the asset/preset seed; `contracts/examples/` is generated handoff material. T2 creates a local SQLite database without requiring an external DB server or Docker. A unique repository-local pytest base directory avoids Windows system-temp permissions and overwriting an existing test directory. Native integration tests require `requirements-swmm.txt`; explicit skips do not count as complete simulation verification.

## T2: HTTP execution and persistence

The default runtime is ignored `data/runtime/api/`: `floodops.sqlite3`, `runs/{run_id}/` raw/parsed artifacts, and `events/{run_id}.log`. Storm records and accepted model/storm/boundary snapshots are immutable; new parameters require new storm/run IDs. Original seed storms are inserted only when absent. API history remains queryable after restart.

Use one API instance per runtime directory. An OS file lease prevents another instance from opening the same runtime and incorrectly recovering its live jobs. For an independent runtime, set a distinct directory before launch:

```powershell
$env:FLOODOPS_DATA_DIR = Join-Path (Get-Location).Path 'data/runtime/api-demo'
```

The local worker runs one SWMM job at a time, permits at most eight queued/running jobs, and times out each native subprocess after 120 seconds. `POST /api/simulations` returns 202 immediately. Poll its run ID until a terminal status; queued/running frames/metrics return 409. Native errors, numerical QA failures and timeouts persist as `failed` with error/log references. A process interruption is marked `RUN_INTERRUPTED` on next startup; it does not silently rerun or create successful results. Normal shutdown finishes the active job and cancels queued jobs explicitly.

Example from PowerShell:

```powershell
$stormBody = @{name='Assumed 120 mm/h'; intensity_mmh=120; duration_s=3600; source_type='assumed'} | ConvertTo-Json
$storm = Invoke-RestMethod http://127.0.0.1:8000/api/storms -Method Post -ContentType 'application/json' -Body $stormBody
$runBody = @{model_version_id='taman_kyra_synthetic_v1'; storm_id=$storm.storm_id; debris_scenario_id='demo_inlet_clean'; tailwater_case='normal'; intervention=$null} | ConvertTo-Json
$accepted = Invoke-RestMethod http://127.0.0.1:8000/api/simulations -Method Post -ContentType 'application/json' -Body $runBody
do {
    Start-Sleep -Milliseconds 250
    $run = Invoke-RestMethod ("http://127.0.0.1:8000/api/simulations/" + $accepted.run_id)
} while ($run.status -in @('queued','running'))
$run
if ($run.status -eq 'succeeded') {
    Invoke-RestMethod ("http://127.0.0.1:8000/api/simulations/" + $accepted.run_id + '/metrics')
}
```

Custom storms support constant intensity 0..300 mm/h, duration 300..21600 s in 300 s increments, and 3600 s drain-down. Hyetographs, interventions and high tailwater remain rejected. T3 adds explicit native finite inlet capture; it does not change the retained direct-node baseline. `GET /api/simulations?limit=20` discovers saved IDs, including after restart; do not request mock IDs against the API. Raw artifacts are downloadable through the allowlisted `evidence_references` URLs. Frames/metrics downloads verify their saved SHA-256 before serving.

To verify actual TCP HTTP and a full API process restart, using its own fresh runtime/ephemeral loopback ports:

```powershell
.\services\api\.venv\Scripts\python.exe -m services.api.check_http
```

It creates a fresh `data/runtime/t2-http-...` directory, runs 80 mm/h and newly created 120 mm/h storms, checks artifacts and baseline immutability, restarts the process and checks that storms/runs/frames/metrics are unchanged. Curated evidence is `data/validation/t2/`; its run IDs belong to that evidence runtime, not a fresh developer database. `--output` must name a new directory. The CLI stops only its own subprocesses.

## T3: inspections, media and native inlet capture

Install the updated requirements to include `python-multipart==0.0.32`. API v1.2.0 adds append-only inspection/media and debris records in the existing SQLite runtime; startup creates missing tables/indexes/triggers without replacing T2 storms or runs. Local media files live under `media/{media_id}.blob`, identified by immutable metadata/hash rather than a user-supplied path. Back up the database and its media/run directories together.

Read [`contracts/T3_INTEGRATION.md`](../contracts/T3_INTEGRATION.md) for complete requests and Jiajie wiring. Inspection timestamp must be timezone-aware, source_type explicit; a virtual inspection must not silently be labelled observed. Upload multipart `file`, PNG/JPEG/WebP/PDF up to 10 MiB. Downloads verify size/hash and report missing/corrupt files. Existing records are never edited; append another inspection or media item.

Debris creation freezes the selected storm and optional same-inlet inspection/media snapshot. It calculates a transparent 60s mass balance in kg and independently records a constant 0..0.6 hydraulic capture-loss assumption. Use its new ID with the same storm when starting a run. A different storm needs a new debris scenario. Cleaning mass events do not automatically change hydraulic loss; create a separate 0% scenario for a clean hydraulic hypothesis.

Native presets are `demo_inlet_capture_0pct`, `demo_inlet_capture_20pct`, `demo_inlet_40pct`, `demo_inlet_capture_60pct`. Compare this group against finite 0% using the same rain/boundary; `demo_inlet_clean` remains the different, unlimited T1/T2 baseline. Native CUSTOM capture curves and auxiliary surface channels are synthetic assumptions, not surveyed terrain or a calibrated inlet design. Show returned inlet capture/backflow/bypass volumes alongside sewer flooding.

```powershell
.\services\api\.venv\Scripts\python.exe -m services.api.check_t3
```

The CLI uses a fresh runtime and temporary loopback ports. It tests actual inspection → media → debris → real native run → API process restart, four sensitivity cases, a fixed baseline, exact repeat and half routing step. It stops its own processes. Curated evidence and manifest are in `data/validation/t3/`. Use a new output directory for verification; never run a developer API against a curated evidence database. `/api/health.execution_verified` continues to describe matching retained T1 execution evidence; T3 evidence is independently checked by this CLI and the evidence tests.

## Current boundaries and troubleshooting

- T2/T3 HTTP execution, inspection/media and debris creation are implemented. Comparison endpoints remain absent (404); high tailwater is disabled and returns 422. Hydraulic loss is independent of visible coverage and retained debris mass, not a calibrated conversion.
- Jiajie's J1 geometry/types are aligned. Online polling, removing API-mode fixture shortcuts, flat creation payloads, multipart upload and G1/G2 browser validation remain frontend work. Detailed handoff is in `contracts/T3_INTEGRATION.md` and `md/progress/tay.md`.
- Run module commands from the repository root, not `services/api`; this keeps the HTTP and simulation packages importable. Seed loading itself resolves paths relative to the source files, not the current directory.
- If port 8000 is occupied, stop the server you own or choose another port and update the frontend base URL. Do not terminate an unknown process.
- For dependency download/socket errors, check network access to the package index; keep T0 usable with the base dependencies and record the actual SWMM error. No fallback results are generated.
