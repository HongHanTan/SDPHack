# Backend setup — Tay

Run all commands below from the repository root in PowerShell. Python 3.12 is the tested runtime (3.12.10 on Windows x64). Dependencies live in `services/api/`; model code lives in `simulation/`.

## Install and run

```powershell
python -m venv services/api/.venv
.\services\api\.venv\Scripts\python.exe -m pip install -r services/api/requirements-dev.txt
.\services\api\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000
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

On 2026-10-19, Python 3.12.10 / Windows x64 loaded `swmm-toolkit==0.17.0` and executed complete models with engine `5.2.4`. `available=true` means the native library loaded and answered a version request. `execution_verified=true` means current resolved inputs, engine/toolkit version and retained raw-file hashes match the successful T1 validation evidence. Missing/stale evidence makes that flag false. API `status=ok` is independent of SWMM availability. If the package/DLL is missing, health returns `available=false` and the actual loader error, while assets remain accessible. `capabilities.simulations=false` still indicates that HTTP execution is unavailable until T2.

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

Read [`contracts/README.md`](../contracts/README.md) for supported endpoints and frontend conventions. `data/synthetic/` is the authoritative asset/preset seed; `contracts/examples/` is generated handoff material. No database or Docker daemon is required for T0/T1. Runtime artifacts live under ignored `data/runtime/`; curated model/run evidence is retained separately. A unique repository-local pytest base directory avoids Windows system-temp permissions and prevents overwriting an existing test directory. Native integration tests require `requirements-swmm.txt`; without the toolkit they are explicitly skipped, which is not full T1 validation.

## Current boundaries and troubleshooting

- Simulation submission/status/frames/metrics are planned contracts only and return `501 NOT_IMPLEMENTED`. Other future endpoints are absent and return `404 NOT_FOUND`. No UI should treat an unavailable workflow as a successful run.
- T1 is verified offline. T2 adds storm creation, HTTP execution and persistence. Restriction is T3. Model/bootstrap readiness describes retained offline validation, while capabilities describes the available HTTP workflows.
- Run module commands from the repository root, not `services/api`; this keeps the HTTP and simulation packages importable. Seed loading itself resolves paths relative to the source files, not the current directory.
- If port 8000 is occupied, stop the server you own or choose another port and update the frontend base URL. Do not terminate an unknown process.
- For dependency download/socket errors, check network access to the package index; keep T0 usable with the base dependencies and record the actual SWMM error. No fallback results are generated.
