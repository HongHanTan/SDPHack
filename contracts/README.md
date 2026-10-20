# FloodOps API v1.2.0 — T0 / T1 / T2 / T3 handoff

`openapi.json` is generated from `services/api/app/main.py` and its Pydantic schemas.
It is the machine-readable interface source. Never edit generated JSON by hand.

Implemented:

- `GET /api/health`: service health, native-library availability/version, execution verification and capabilities.
- `GET /api/bootstrap`: versioned synthetic model, storm/debris/boundary presets and capabilities.
- `GET /api/townships/taman_kyra_demo/assets`: 9 nodes (including one outfall), 8 conduits and 4 inlets.
- `POST /api/storms` / `GET /api/storms/{storm_id}`: create and read immutable storms, also listed by bootstrap.
- `POST /api/simulations`: persist immutable inputs and return `202 {run_id,status:queued}`. One background job runs at a time, with at most 8 queued/running by default.
- `GET /api/simulations` / `GET /api/simulations/{run_id}`: persisted history/status, timestamps, full input snapshot/hash, warnings, error and evidence URLs.
- `GET /api/simulations/{run_id}/frames` / `metrics`: actual native results, available only after success.
- `GET /api/simulations/{run_id}/artifacts/{artifact_name}`: allowlisted `.inp` / `.rpt` / `.out`, native/QA JSON and event/worker logs.
- `POST /api/inspections`, `GET /api/inspections?asset_id=...`, `GET /api/inspections/{id}`: append-only, timestamped evidence with explicit source and per-asset history.
- `POST /api/inspections/{id}/media` (multipart `file`), `GET /api/inspections/{id}/media/{media_id}`: append-only PNG/JPEG/WebP/PDF attachments, 10 MiB limit, size/SHA-256 verified downloads.
- `POST /api/debris/scenarios`, `GET /api/debris/scenarios/{id}`: independent constant hydraulic-loss hypothesis, frozen inspection/media and storm provenance, calculated kg mass timeline, bound to its storm ID.

Simulation routes are implemented. Query the returned run ID until `succeeded` or `failed`; `queued` / `running` results return `409 RESULTS_NOT_READY`, failed results return `409 SIMULATION_FAILED` with the persisted run error. Missing IDs return 404, schema errors 422, unsupported restriction/boundary 422, and queue overflow 429. Missing or corrupt persisted success results return `500 RESULT_ARTIFACT_INVALID`. No empty or fabricated results are returned.

The reserved `intervention` field still accepts only null. Comparisons remain T4. `bootstrap.capabilities` now enables inspections/debris as well as storm creation and simulations; comparisons remains false. Normal tailwater is executable; high is explicitly marked unsupported and rejected. `demo_inlet_clean` preserves unlimited direct-node inflow. Native finite-capture presets and created scenarios form a separate comparison group, with their own finite 0% baseline. Read [T3_INTEGRATION.md](T3_INTEGRATION.md) before wiring inspection/media/debris or interpreting capture/bypass metrics.

`examples/assets.json` and `examples/bootstrap.json` are actual responses from a fresh isolated runtime. `simulation-request.json` selects the executable retained clean scenario. `simulation-unsupported.json` is now an actual 422 response for high tailwater; native restriction is supported in T3. `validation-error.json` is an actual 422 schema error. Export never starts real jobs or mutates the developer's database. Machine-specific health is queried from `/api/health`.

**T1 real offline results are available:** `examples/{run,frames,metrics}-baseline.json` and `examples/{run,frames,metrics}-stronger.json` come from actual SWMM 5.2.4 runs (80 / 120 mm/h, each for 60 minutes plus 60 minutes drainage). They use the existing response schemas; no field rename or schema breaking change is needed. Full raw `.inp` / `.rpt` / `.out`, logs, QA, input hashes, repeat runs and half-step checks are in `data/validation/t1/`. `models/illustrative_taman_kyra/` holds runnable model snapshots.

**T2 real HTTP fixtures:** `examples/http-{accepted,run,frames,metrics}-{baseline,stronger}.json` and `storm-created.json` come from actual TCP HTTP execution plus a separate API process restart, retained in `data/validation/t2/`. The stronger run uses a newly created storm ID. These sample IDs do not automatically exist in a fresh developer database; start your own run or explicitly replay the fixture offline. Preserve trace warnings: baseline has about 0.015 m3 of transient flooding and its node count is sensitive to routing settings. Consult `md/MODEL_ASSUMPTIONS.md`.

Creating a custom storm uses a flat request, e.g. `{"name":"Assumed custom rain","intensity_mmh":120,"duration_s":3600,"source_type":"assumed"}`. The response keeps parameters nested under `parameters`; use the new `storm_id` in the next simulation request. Supported inputs are constant intensity 0..300 mm/h and duration 300..21600 seconds in 300-second increments. Hyetographs and unsupported fields are rejected. Every run includes 3600 seconds dry drainage.

v1.2.0 preserves the existing asset, request, frames and metrics field names. Native finite inlet runs add nullable inlet capture/bypass report flows and full-routing-step `inlet_volumes`; retained direct-node runs use null for these unmodelled quantities. Created debris scenarios include `mass_balance.time_series`, independent of hydraulic loss; their frozen storm/inspection/media snapshots enter run input hashes. Older T1/T2 offline fixtures remain valid. Jiajie's `1860feb` already aligns the asset fields; online polling, explicit offline replay separation and T3 wiring remain frontend work. See [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md) and [T3_INTEGRATION.md](T3_INTEGRATION.md).

**T3 real HTTP fixtures:** `examples/{inspection-request,inspection-created,media-created,debris-request,debris-created,native-inlet-*}.json` come from the retained TCP/process-restart proof in `data/validation/t3/`. Its UUIDs exist only in that evidence runtime. Four native 0/20/40/60% cases, a preserved direct-node baseline, independent 40% repeat and half routing-step check retain complete native artifacts and a SHA-256 manifest. A synthetic test pixel checks upload bytes; it is not a field photo.

From repository root in PowerShell:

```powershell
.\services\api\.venv\Scripts\python.exe -m services.api.export_contracts
.\services\api\.venv\Scripts\python.exe -m services.api.export_contracts --check
```

Consumers must preserve these conventions:

- IDs: `run_id`, `conduit_id`, `node_id`, `inlet_id`; featured `INLET-D07` joins `NODE-J07`.
- Coordinates: local metres east/north/elevation, Three.js mapping `[x, z, -y]`. Node positions are pipe **inverts**; inlet positions are **surface grate** elevations. Build conduit geometry by joining the returned node IDs.
- Flow `m3s` (signed from-to direction), depth `m`, volume `m3`, duration `s`, rain intensity `mmh`. Fractions are in `[0,1]`.
- All geometry is synthetic and `is_verified_site_model=false`. These assets are not a surveyed map.
- `hydraulic_inlet_clogging_fraction` is an assumed capacity-loss parameter, independent of an inspection's visible coverage.
- Pipe and node status enums are separate from inlet obstruction. T1 result outputs include `status_definitions` with physical basis/thresholds; the registry itself has no hydraulic status. Pipe `near_capacity` uses geometric depth/diameter >=0.8, not a discharge-capacity percentage.
- `surcharge_duration_s` means elapsed time during which **any** junction exceeds its connected-pipe crown, counted at native routing-step endpoints and weighted by step duration. Overlaps count once. Frames are actual 60 s report samples starting at t=60 s; native metrics can include shorter events absent from those frames.
- Errors always use `{"error":{"code":"...","message":"...","details":{}}}`. API failure must stay visible; no automatic mock fallback.
