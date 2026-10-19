# FloodOps API v1.0.0 — T0 / T1 handoff

`openapi.json` is generated from `services/api/app/main.py` and its Pydantic schemas.
It is the machine-readable interface source. Never edit generated JSON by hand.

Implemented:

- `GET /api/health`: service health, native-library availability/version, execution verification and capabilities.
- `GET /api/bootstrap`: versioned synthetic model, storm/debris/boundary presets and capabilities.
- `GET /api/townships/taman_kyra_demo/assets`: 9 nodes (including one outfall), 8 conduits and 4 inlets.

Planned simulation routes have `x-implementation-status: planned` in OpenAPI.
They expose future request/response schemas for frontend development, but **currently return HTTP 501 `NOT_IMPLEMENTED`** for valid requests, including result queries. An invalid submission returns HTTP 422 `VALIDATION_ERROR`. They do not create runs or return calculated frames/metrics.

The reserved `intervention` field only accepts `null` in v1.0.0. Inspection/media/debris creation and comparison endpoints will be added in T3/T4; they are not implemented in this release. Storm creation arrives in T2. `bootstrap.capabilities` identifies the currently implemented workflows. `debris_scenarios[].swmm_supported` is false until the inlet restriction adapter is verified.

`examples/assets.json` and `examples/bootstrap.json` are actual API-shaped responses derived from the versioned seed in `data/synthetic/`. `simulation-request.json` is a valid request shape, using preset IDs. `simulation-not-implemented.json` and `validation-error.json` are actual error responses. Machine-specific engine health is read from `/api/health` rather than frozen as a portable example.

**T1 real offline results are available:** `examples/{run,frames,metrics}-baseline.json` and `examples/{run,frames,metrics}-stronger.json` come from actual SWMM 5.2.4 runs (80 / 120 mm/h, each for 60 minutes plus 60 minutes drainage). They use the existing response schemas; no field rename or schema breaking change is needed. Full raw `.inp` / `.rpt` / `.out`, logs, QA, input hashes, repeat runs and half-step checks are in `data/validation/t1/`. `models/illustrative_taman_kyra/` holds runnable model snapshots.

These fixtures can drive a clearly labelled offline replay while T2 is pending. They do not mean that HTTP simulation endpoints are implemented. All inlet states have assumed clogging fraction zero with unlimited direct-node entry. The nonzero restriction preset remains unsupported. Preserve the output warnings: baseline has about 0.015 m3 of tiny transient flooding and its counted flooded nodes change under routing-step refinement. Consult `md/MODEL_ASSUMPTIONS.md` before interpreting results.

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
