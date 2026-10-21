# Township FloodOps — Tay / Jiajie Parallel Development Handbook

> Responsibilities last confirmed: 2026-10-19. **Tay: backend, data and SWMM. Jiajie: frontend, 3D and interaction.**
> When this handbook was created, the repository contained only three planning documents and no application code. The queues and initial interfaces below are the planning baseline, not a claim that every feature is implemented. Consult the individual progress files, current code and published contracts for implementation status.

## 1. How to use this workflow

Start a coding agent that reads the root `AGENTS.md`, then enter:

```text
I am Tay. Continue my tasks.
```

Or:

```text
I am Jiajie. Continue my tasks.
```

The agent should read this handbook, its owner's progress file and the other owner's handoff section; inspect the current code; then select, execute, verify and record the next task for that owner. The user should not need to explain the entire project again. If the agent does not automatically read `AGENTS.md`, first say: `Read AGENTS.md and md/TEAM_WORKFLOW.md, then continue according to my identity.`

Continuation records:

- Tay: [`progress/tay.md`](progress/tay.md).
- Jiajie: [`progress/jiajie.md`](progress/jiajie.md).

These files must travel with the code to the other person's checkout. The other agent cannot see files, branches or chat history that have not been shared.

## 2. Source material and shared objective

| Original document | Purpose |
|---|---|
| [Idea and Pitch Story](Township_FloodOps_Idea_and_Pitch_Story.md) | Diagnose / Anticipate / Act pillars, three-minute pitch and MVP scope |
| [System Architecture and Tech Stack](Township_FloodOps_System_Architecture_and_Tech_Stack.md) | React + R3F, FastAPI, SWMM, data flow and engineering checks |
| [Feature Flow and Module Breakdown](Township_FloodOps_Feature_Flow_User_Flow_Module_Breakdown.md) | Features F01–F08, modules M01–M15, user flows and acceptance criteria |

**Shared delivery objective:** an explicitly illustrative / synthetic township where a user selects an inlet → saves an inspection → selects debris / rainfall assumptions → executes SWMM → replays results on the same 3D assets → compares cleaning and pipe enlargement → traces evidence and proposes maintenance / engineering review.

Complete that loop before expanding. The initial target is about 8–12 nodes, 8–15 pipes, 3–5 inlets, one outfall and one inspector. Compare at least baseline, restricted inlet and cleaned scenarios, then add upsizing and subsequently storage. SQLite and local files are acceptable initially, with migration boundaries retained for PostgreSQL / PostGIS / S3. CV, live weather, authentication, multi-tenancy and a custom CFD solver do not block the MVP.

## 3. Responsibilities

| Area | Tay's delivery | Jiajie's delivery |
|---|---|---|
| Network and assets M03 | Authoritative asset IDs, connectivity, coordinates, model versions and synthetic seed | Render API / fixture assets; selection and details |
| Scenarios and scheduling M04 | Input validation, immutable runs, status, errors and result queries | Rainfall / duration / tailwater controls, submission, polling and failure states |
| SWMM M05 | `.inp`, actual execution, versions, logs and result parsing | Consume results; animation is presentation only |
| Result mapping M06 | Physical metrics, units, status thresholds and explanations | 3D layers, legends, timeline, curves and KPIs |
| Inspection M07 / M08 | Inspection / media storage, history and provenance | Inspector animation, forms, upload, evidence history and replay |
| Debris / Lab M09 / M10 | Mass balance, assumption versions, restriction scenarios and SWMM integration | Inlet close-up, controls, timeline, illustrative particles and assumption labels |
| Diagnosis M11 | Historical / synthetic replay and hypothesis comparisons using the same model | Diagnose / Anticipate modes, data gaps and comparison views |
| Intervention M12 | Clone inputs; rerun cleaning / upsizing / storage; comparison metrics | Options, before/after and traceable proposed actions |
| Operation and verification | API / simulation tests, Docker, backend startup and troubleshooting | Frontend builds, interaction checks, integration and three-minute demo route |

Ownership follows delivery boundaries; it does not mean one person owns an entire feature such as inspection. Every complete feature has both frontend and backend tasks.

## 4. File ownership: avoid overwriting parallel work

Use the repository root as the project root. Do not create another outer `floodops/` directory. The original documents contain two example layouts; the agreed layout is:

| Owner | Paths the owner may create or modify independently |
|---|---|
| Tay | `services/api/**`, `simulation/**`, `models/**`, `data/**`, `infra/**`, `contracts/**`, `tests/api/**`, `tests/simulation/**` |
| Tay | `md/BACKEND_SETUP.md`, `md/MODEL_ASSUMPTIONS.md`, `md/progress/tay.md`, root `.gitignore`, backend CI |
| Jiajie | `apps/web/**`, including packages, lockfile, UI fixtures, API client and frontend tests; `tests/e2e/**` |
| Jiajie | `md/FRONTEND_SETUP.md`, `md/DEMO_RUNBOOK.md`, `md/progress/jiajie.md`, root `README.md`, frontend CI |
| Shared rules | Root `AGENTS.md`, this handbook and the three original documents: change only when the user requests a responsibility/specification update or a shared rule genuinely changes; record a clear handoff |

Keep SWMM / debris / scenario calculations in `simulation/`, called by the API. Do not implement a second model under `services/api/app/services/`. Frontend dependencies and lockfiles belong under `apps/web/`; backend dependencies belong under `services/api/`, avoiding concurrent edits to root package configuration. Planned CI is split into `frontend.yml` and `backend.yml`.

## 5. Parallel work from day one

1. **Start both sides immediately.** Tay works on T0 / T1; Jiajie works on J0 / J1 without waiting for the API server or SWMM.
2. **This section and section 6 define the initial interface.** Tay turns it into `contracts/openapi.json` and `contracts/examples/` in T0. Before publication, Jiajie may build types / mocks against the shapes below.
3. **Jiajie exposes explicit data modes,** for example `VITE_DATA_MODE=mock|api` and `VITE_API_BASE_URL=http://localhost:8000`. Mock pages must visibly say “Development mock, not SWMM results”. A real API failure must not silently fall back.
4. **UI fixtures stay in the UI layer.** Jiajie's temporary examples belong in `apps/web/src/mocks/`. Tay's seeds, contract examples and real SWMM outputs stay in Tay's paths. Adapt backend examples in the frontend rather than editing each other's files.
5. **Tay delivers real results early.** Publish assets plus one run, its frames and metrics before the whole backend is complete, allowing immediate frontend integration.
6. **Tay maintains interface changes.** Prefer backward-compatible changes to consumed fields. Before a breaking change, record the fields, rationale, migration and version in the handoff; remove old fields after the other owner confirms synchronization. Continue independent work while waiting.

Ports: frontend `5173`, API `8000`. Tay configures local CORS; Jiajie configures the API base URL. JSON in the original planning documents is illustrative. Use the identifiers below consistently; do not mix `simulation_id` / `run_id` or `pipe_id` / `conduit_id`.

## 6. Initial interface contract v1

The following was the T0 schema baseline, written before a running API existed. Once published, `contracts/openapi.json` is the authoritative machine-readable interface. Update examples and handoffs when adding fields, avoiding silent divergence between this plan and implementation.

### 6.1 Common conventions

- JSON uses `snake_case`. Standard identifiers: `township_id`, `model_version_id`, `asset_id`, `node_id`, `inlet_id`, `conduit_id`, `inspection_id`, `debris_scenario_id`, `storm_id`, `run_id`.
- Initial `township_id = taman_kyra_demo`, `model_version_id = taman_kyra_synthetic_v1`. Retain focus inlet `INLET-D07`, associated with `node_id = NODE-J07`. Tay's seed publishes other asset IDs, topology and coordinates. Jiajie may initially use a temporary layout, but API mode must consume returned geometry rather than hard-code authoritative connectivity.
- Local coordinates are metres: `position_m: {x, y, z}` represents east, north and elevation. Map to Three.js as `[x, z, -y]`. Do not present local coordinates as actual latitude/longitude.
- Units: flow `m3s`, depth `m`, volume `m3`, duration `s`, rainfall intensity `mmh`. Ratios use `[0,1]` fields ending in `_fraction`; percentages are for UI display. Dates use timezone-aware ISO 8601. Replay uses `timestamp_s`, relative to run start.
- Input `source_type`: `observed | literature_derived | assumed | synthetic`. Actual computed outputs use `result_type = simulated`. Also expose `engine`, `engine_version`, `is_verified_site_model = false` and `assumptions`. Real SWMM execution on a synthetic network is not a site observation.
- Run states: `queued | running | succeeded | failed`. Standard errors: `{"error":{"code":"...","message":"...","details":{}}}`. Persist execution failure in the run's `error`; do not return apparently valid empty results before success. Define error codes / HTTP statuses in OpenAPI.

### 6.2 HTTP boundaries

| Endpoint | Minimum input / output contract | Owner |
|---|---|---|
| `GET /api/health` | Service status, SWMM availability and version; an online API does not imply an available engine | Tay |
| `GET /api/bootstrap` | `township_id`, available `model_versions`, `storms`, `debris_scenarios`, `tailwater_cases`; each item has an ID, name, source and parameters | Tay |
| `GET /api/townships/{id}/assets` | `{model_version_id, nodes:[], inlets:[], conduits:[], assumptions:[]}`; node coordinates / elevation / type, inlet-to-node association, conduit endpoint nodes / diameter / length | Tay |
| `POST /api/storms` | Intensity, duration or hyetograph and source → immutable storm with `storm_id` and complete parameters; moving a slider must not continue sending an unchanged old storm ID | Tay |
| `GET /api/inspections?asset_id=...` | `{items:[]}`: chronologically listed inspections and media references | Tay |
| `POST /api/inspections` | Asset, collection time, method, inspector, source, visible coverage, debris classes and notes → new inspection | Tay |
| `POST /api/inspections/{id}/media` | Multipart `file` → media reference and metadata; never overwrite an older record | Tay |
| `POST /api/debris/scenarios` | Inlet, optional inspection reference, independent clogging assumption and optional debris parameters → `debris_scenario_id`, parameters / assumptions and computed time series | Tay |
| `POST /api/simulations` | Request below → `202 {run_id, status}`; retain this query boundary even if a small implementation computes synchronously | Tay |
| `GET /api/simulations/{id}` | Run state, complete input snapshot / hash, engine version, warnings, error and evidence references | Tay |
| `GET /api/simulations/{id}/frames` | `{run_id, model_version_id, frames:[]}`; time-ordered frames shaped as below | Tay |
| `GET /api/simulations/{id}/metrics` | Run / source information, `total_flooding_volume_m3`, `flooded_node_count`, `surcharge_duration_s`, metric definitions / warnings; state whether duration is the time during which any node is surcharged, or choose another explicit name | Tay |
| `POST /api/interventions/compare` | `{base_run_id, candidates:[{type, target_asset_id, changes}]}` → `202 {comparison_id, status}`; `type` is `clean_inlet | upsize_conduit | add_storage` | Tay |
| `GET /api/interventions/comparisons/{id}` | Comparison status, baseline run, candidate runs / statuses / metrics / deltas and shared storm / tailwater snapshots; show partial failure explicitly | Tay |

Store inspection `visible_grate_coverage_fraction` separately from scenario `hydraulic_inlet_clogging_fraction`. Without a calibrated relationship, users select the hydraulic assumption independently; never assign one directly to the other. Tay publishes debris parameters and units in contract examples. Before that, Jiajie may build controls and illustrative animation.

Example simulation request (obtain IDs from bootstrap / creation endpoints):

```json
{
  "model_version_id": "taman_kyra_synthetic_v1",
  "storm_id": "synthetic_80mmh_60min",
  "debris_scenario_id": "demo_inlet_40pct",
  "tailwater_case": "normal",
  "intervention": null
}
```

Example frame (values explain the format and are not computed results):

```json
{
  "timestamp_s": 1800,
  "pipe_states": [
    {
      "conduit_id": "PIPE-P07",
      "flow_m3s": 0.31,
      "depth_m": 0.48,
      "status": "near_capacity"
    }
  ],
  "node_states": [
    {
      "node_id": "NODE-J07",
      "depth_m": 0.8,
      "flooding_rate_m3s": 0.02,
      "surcharge_flag": true,
      "status": "flooding"
    }
  ],
  "inlet_states": [
    {
      "inlet_id": "INLET-D07",
      "hydraulic_inlet_clogging_fraction": 0.4,
      "parameter_status": "assumed_not_calibrated"
    }
  ]
}
```

Pipe statuses: `normal | near_capacity | surcharged | unknown`. Node statuses: `normal | surcharged | flooding | unknown`. Tay defines and returns status criteria / thresholds; Jiajie maps them to legends. Without physical support, use `unknown`; never invent thresholds for a red visual effect or claim an uncomputed load.

### 6.3 Contract delivery order

T0 covers health, bootstrap, assets and simulation requests / states / frames / metrics. T2 / T3 add inspections, media and debris; T4 adds comparisons. At every stage, validate TypeScript, Pydantic and fixtures against the same fields. Explicitly document unimplemented endpoints rather than returning fake success.

## 7. Tay's task queue: backend / SWMM

| ID | Task and delivery | Completion criteria |
|---|---|---|
| T0 | Set up `services/api/`, dependencies, health and CORS; publish OpenAPI, asset fixtures, ID / unit conventions and startup instructions | API starts; Jiajie can obtain or read matching assets / response examples without SWMM; unimplemented interfaces are labelled |
| T1 | Verify EPA SWMM 5.2 early in the target environment; build a small valid `.inp` and synthetic seed; execute baseline / stronger rainfall and parse frames / metrics | Retain actual `.inp` / `.rpt` / `.out`, engine version and continuity errors; repeatable results; output IDs align with assets |
| T2 | Storm creation, immutable run inputs / hashes, states / failures, persistence and result queries integrated with T1 | HTTP submission → query → real frames / metrics; explicit errors and logs for invalid input or engine failure |
| T3 | Inspection / media / provenance, debris mass balance, 0 / 20 / 40 / 60% assumption scenarios and supported inlet restriction | Inspections can be reread; coverage concepts remain separate; restriction changes enter SWMM inputs and alter outputs under valid test conditions |
| T4 | Compare inlet cleaning and pipe upsizing, then storage; historical / synthetic replay shares the execution chain | Baseline stays unchanged; candidates share storm / tailwater; return run IDs, metrics, failed candidates and assumptions |
| T5 | Docker / local reproduction, API / simulation checks, model assumptions and backend fixes discovered during frontend integration | A fresh checkout runs from the instructions; record numerical QA, mass balance, repeatability and counterfactual input-consistency checks |

T1 is the earliest technical-risk check. Do not wait for complete CRUD / database work before trying SWMM. If PySWMM / native engine installation fails, record exact logs and prioritize checking Docker or a SWMM executable. T0 / persistence can continue, but mock output must not be reported as native-engine success. Validate an inlet restriction method supported by the installed version; shrinking an entire pipe's diameter must not masquerade as a blocked inlet.

## 8. Jiajie's task queue: frontend / 3D

| ID | Task and delivery | Completion criteria |
|---|---|---|
| J0 | React / TS / Vite, R3F / Drei, charts, API client, explicit mock / api modes and personal startup instructions | Frontend starts and builds independently; mock is clearly labelled; real errors have UI states |
| J1 | Township scene, surface / underground toggle, data-driven nodes / inlets / pipes and asset selection / details | Mock follows the same schema; select assets by ID; central coordinate conversion; topology is not hard-coded in components |
| J2 | Scenario controls, storm creation, run polling, frame timeline, separate inlet / pipe / node legends and metric curves | Mock path works first; integrate real T1 / T2 results when available; parameter changes create new requests without replacing historical runs |
| J3 | Inspector animation, inspection forms / media / history, evidence replay, inlet-lab controls and debris animation | Persisted forms can be reread; animation / numerical sources are clear; hydraulic restriction is selected independently |
| J4 | Diagnose / Anticipate, clean / upsize / storage comparisons, before/after KPIs and proposed-action views | Show matching storm / boundary; trace each run / inspection / assumption; disable unimplemented options explicitly |
| J5 | Lead end-to-end integration, readable layout, stable demos, three-minute runbook, frontend README and verified startup commands | Replay the complete real-mode loop; visible failures; recorded build / key interaction checks; hand off issues by interface ownership |

J2 UI / mocks may proceed alongside T1 / T2. J3 lab controls / illustrative effects may precede T3 time-series integration. When a dependency is incomplete, continue the next independent task; do not build another Python simulator or silently change the backend.

## 9. Shared milestones and actual dependencies

| Gate | Tay | Jiajie | Joint acceptance |
|---|---|---|---|
| G0: parallel start | T0 contract / seed examples | J0 / J1 mock scene | Both sides run independently with aligned fields / IDs |
| G1: real hydraulic loop, highest priority | T1 / T2 | J1 / J2 real API integration | Changed storm → new SWMM run → changed frames / KPIs on the same assets, with traceable logs |
| G2: core pitch experience | T3 | J3 | Saved inspection → independent restriction selection → changed model input → result / evidence replay |
| G3: decisions and demo | T4 / T5 | J4 / J5 | Matching-input clean / upsize comparison, then storage; complete three-minute real-mode demo |

An attractive frontend, an API returning JSON or playable mock output does not independently complete G1 / G2 / G3. While waiting for an interface, work on the independent tasks above. Numerical-model completion still requires actual SWMM evidence.

## 10. Agent execution and handoff rules

1. Read root `AGENTS.md`, this handbook and your own progress. Review the other owner's handoff and interface version. On the first visit, also read the three original planning documents.
2. Inspect `git status`, existing files and runtime configuration. If progress disagrees with code, verify first and correct your own record. Do not scaffold duplicates or delete unknown files.
3. Choose your earliest unfinished executable task. A user-specified task takes priority. Split large work into a clearly verifiable unit and leave an exact continuation point.
4. Mark your current scope `IN_PROGRESS`. After implementation, run relevant builds / tests / manual checks and record the actual commands, exit results and limitations.
5. Use `TODO / IN_PROGRESS / BLOCKED / DONE`. For `BLOCKED`, state the missing dependency and what can continue. One missing interface does not block all work. Record checks not run as “not run”, never “passed”.
6. Update your handoff: new endpoints / schema versions, fixture paths, startup method, fields requiring adaptation and known issues. Frontend reports include reproduction and expected / actual responses; backend adaptation requests include payloads.
7. End with a brief account of what changed, how it was verified and what comes next. A future session should continue from the files after the user states their identity, without depending on private chat history.

### Git and parallel working environments

- Prefer separate checkouts / worktrees and working branches, such as `tay/backend` and `jiajie/frontend`, sharing a baseline, contracts and small changes early.
- Before the first commit, establish a shareable baseline before creating branches / worktrees. Do not assume a remote, commit or usable Git hosting already exists.
- When two agents share a physical working directory, follow path ownership strictly. **Neither agent may automatically checkout / switch branches**; a switch affects the other person's files.
- Never run `reset --hard`, `clean -fd` or overwrite another owner's uncommitted work. Commit, push and merge only within user authorization and the normal team workflow. Commit only your files; do not mix others' work through `git add .`.
- Each side fixes integration issues in its own paths. Describe cross-boundary requests in the handoff first. If the user explicitly requests a cross-responsibility change, perform it and record the scope.

## 11. Shared product and simulation acceptance requirements

- Use real SWMM for hydraulics. Rational Method / Manning are reasonableness checks; particles / avatar animation are presentation only.
- Keep synthetic, assumed, observed and simulated sources visibly distinct. Real SWMM execution on a synthetic network is not a measured Taman Kyra forecast.
- Photo coverage is not directly hydraulic capture loss. Inlet obstruction is not pipe surcharge; show them separately.
- Ordinary SWMM node flooding is not a validated 2D street-inundation map. Without terrain / surface coupling, show only supported metrics and illustrations.
- The same inputs / seed / engine version should be repeatable. Retain model version, parameters, input hash, QA warnings and result references for every run.
- Verify restriction effects in designed scenarios rather than assuming every scenario worsens monotonically. Cleaning cannot guarantee removal of risk caused by high tailwater.
- Comparison candidates must share rainfall and external boundaries. Never mutate the baseline in place or award false improvement scores to failed candidates.
- Actions are proposed maintenance / engineering review. Unverified costs are not real quotations; uncalibrated examples are not established historical causes or precise flood forecasts.

After the loop works, use remaining time for CV, live weather, additional visual effects or report exports. Continue to split new scope as **Tay: calculations / data; Jiajie: presentation / interaction**.

## English documentation update — 22 October 2026

Translated the linked handbook at the user's request. Responsibility boundaries, task IDs, initial contract fields, JSON examples, milestones and acceptance rules are preserved. The initial plan remains distinct from current implementation status; this language update does not change the shared responsibilities or declare additional work complete. No personal progress file was modified because no Tay/Jiajie identity was declared for this documentation task.

Verification: audited all 11 files linked from the README Documentation table. Three guides required English updates: this handbook, `FRONTEND_SETUP.md` and `DEMO_RUNBOOK.md`; the eight already-English guides were preserved. `python -X utf8 tmp/verify-english-guides.py` passed the language scan, local links, balanced code fences, identical initial JSON examples, endpoint order and task/milestone IDs. `python tmp/check-readme.py` passed 37 README references. Chromium previews of the three updated guides were visually inspected, and `git diff --check` passed. No application tests were run for this documentation-only change. No blockers remain; the next step is team review of the English guides.
