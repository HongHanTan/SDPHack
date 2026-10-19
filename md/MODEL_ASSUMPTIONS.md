# T1 model assumptions and numerical validation

This is a synthetic scenario model inspired by the project context, not a reconstruction of Taman Kyra drainage or an independently calibrated forecast. A successful SWMM calculation verifies execution, not site accuracy. `is_verified_site_model` remains false.

## Inputs and model boundary

- Registry: 8 junctions, one outfall, 8 circular conduits and 4 inlet display assets. IDs and node connectivity come from `data/synthetic/taman_kyra_assets.json` and are preserved in the SWMM input and output. Conduit offsets are zero.
- Coordinates: arbitrary local metres east/north/elevation. Nodes sit at pipe invert elevation; inlet markers sit at surface grate elevation. All diameters, slopes, Manning roughness (0.013), ground levels and grate areas are synthetic.
- Catchments: four 1 ha subcatchments draining to `NODE-J01`, `NODE-J02`, `NODE-J04`, `NODE-J07`. Each is 80% impervious, width 100 m, slope 1%. They are effective model catchments without surveyed polygon boundaries.
- Surface reservoir: impervious/pervious Manning roughness 0.015 / 0.15, depression storage 1 / 4 mm; 25% of the impervious area has zero depression storage. No routing between pervious and impervious subareas. All runoff goes to the specified outlet.
- Horton infiltration: maximum/minimum 75 / 5 mm/h, decay 4 per hour, drying time 7 days, no maximum cumulative infiltration limit. Evaporation is zero and initial catchments are dry.
- Rain: constant 80 or 120 mm/h for 3600 s, then 3600 s dry drainage. A 5-minute intensity time series feeds the raingage. Actual SWMM accumulated rain totals were checked against 80 / 120 mm, so time-series boundary conventions do not silently alter the storm duration.
- Outfall: fixed stage at outfall invert plus the selected depth (normal 0 m, high 1.2 m). T1 validates **normal** only. The high preset has not undergone the same validation suite.
- Entry: the clean case uses unlimited direct runoff entry into sewer nodes. Inlets are not separate SWMM hydraulic elements yet; their visual markers identify the entry locations. Finite capture, grate area effects, debris restriction, bypass and surface recirculation are T3 work. Nonzero restriction is explicitly rejected by this runner.
- Flooding: `ALLOW_PONDING=NO`. SWMM overflowing water leaves the 1D network. No street inundation depth, surface extent, flood return flow or coupled 2D terrain is available.

Every run retains its resolved input snapshot, complete rendered input and canonical SHA-256 hash. No random input or decorative animation controls the hydraulics.

## Numerical settings and QA

The model uses dynamic wave routing and the EXTRAN surcharge algorithm, single thread, maximum routing step 1 s, adaptive step factor 0.75, minimum 0.1 s, maximum 40 iterations and head tolerance 0.0005 m. Wet runoff step is 10 s and output reporting step is 60 s. Full `.rpt` and `.out` files are retained.

Project QA policies are deliberately explicit: absolute runoff/flow continuity error above 1% produces a warning; above 5% rejects results. More than 1% nonconverging routing steps warns and more than 5% rejects. These are project thresholds, not a claim that a passing model is calibrated or engineering-approved. Missing convergence statistics, nonfinite values, wrong units, wrong IDs, incomplete report coverage, rainfall-total disagreement, native engine errors or inconsistent flood totals also reject results.

The report flood total (rounded in 10^6 litre units) must agree with the sum of full-precision native node flood volumes within 0.501 m3. Small positive native floods are preserved; trace events below 0.1 m3 generate a warning. No clipping of positive flooding or hiding affected nodes is performed.

Actual standard-step results on 2026-10-19, SWMM 5.2.4 / toolkit 0.17.0:

| Input | Native flood volume m3 | Flooded nodes | Any-node surcharge s | Runoff continuity % | Routing continuity % | Nonconverging steps % |
|---|---:|---:|---:|---:|---:|---:|
| 80 mm/h, 60 min | 0.014893 | 1 | 2970.000 | -0.001592 | -0.031312 | 0.24 |
| 120 mm/h, 60 min | 728.764885 | 6 | 3478.747 | -0.001600 | -0.030688 | 0.28 |

Independent repeats produced exactly equal parsed frames/metrics and binary output files. Halving the routing step changed flood volume by about 0.000857103 m3 for baseline and 0.046669953 m3 for stronger rain. Flood-volume refinement acceptance is max(0.1 m3, 1% of standard flood volume). Baseline flooded-node count changed from 1 to 2, so trace node membership is **not** numerically robust. The full data, including trace volumes, remain available. These checks support the large rainfall response while leaving small transient peaks uncertain; they do not replace independent calibration or detailed stability review.

## Results, status and units

Flow is signed `m3s` along each conduit's declared from/to direction; depths are `m`, flood volume is `m3`, and time is elapsed `s`. The binary reader verifies SI/CMS units and engine version. It resolves entity IDs from `.out`, rather than relying on array order.

- `total_flooding_volume_m3`: sum of SWMM native `node_get_stats(...).volFlooded`, already converted by the toolkit to m3 in this CMS model. It uses every routing step, not the 60 s report samples. Native stats are queried before `swmm_end`, as required by the toolkit.
- `flooded_node_count`: count of native accumulated node flood volumes greater than 1e-6 m3, including short events between report samples. Interpret it together with volume and the trace-event warning.
- `surcharge_duration_s`: time union of junction crown exceedance, sampled at each native routing-step endpoint and weighted by that step's elapsed duration. Overlapping nodes count once; outfall is excluded. This is an approximation at maximum 1 s resolution. The engine's individual node durations are also retained in `native.json`.
- Frames: actual binary outputs at 60, 120, ..., 7200 s. No invented time-zero frame. Report sampling can miss short routing-step peaks, so frame-derived maxima/counts need not equal the native summary.
- Node surcharge flag: junction depth + 0.00003048 m reaches the largest connected pipe diameter, matching the SWMM crown test for this zero-offset circular network. This tolerance corresponds to SWMM's 0.0001 ft numerical FUDGE. Outfall is not assigned junction surcharge status.
- Node display status: `flooding` when reported loss rate >1e-9 m3/s; otherwise `surcharged` if crown criterion is met; otherwise `normal`.
- Pipe `surcharged`: both endpoint hydraulic heads exceed their respective pipe crowns by more than 0.00003048 m. Otherwise `near_capacity` when reported depth/diameter >=0.8, or `normal`. The 0.8 threshold represents geometric fullness for display; it is not a validated flow-capacity percentage or failure threshold.
- Inlet: every T1 frame carries independent assumed clogging fraction 0 with `assumed_not_calibrated`. This is a clean-entry assumption, not a measured efficiency. Photo coverage is not converted into hydraulic loss.

Machine-readable definitions are included in every frames/metrics response under `status_definitions` and `metric_definitions`. Errors and failed native runs produce explicit failed run metadata and logs, never mock results.

## Evidence and remaining work

`data/validation/t1/summary.json` indexes six actual executions and their artifact hashes. `models/illustrative_taman_kyra/{baseline,stronger}.inp` are runnable snapshots matching the generator. `contracts/examples/{run,frames,metrics}-{baseline,stronger}.json` contain real offline results validated against OpenAPI response models.

`/api/health` distinguishes library availability from matching retained execution evidence. It checks engine/toolkit version, current resolved input hash and retained raw-file hashes before reporting `execution_verified=true`. T2 implements real HTTP execution and SQLite persistence (`capabilities.simulations=true`). Actual HTTP/restart evidence and samples are in `data/validation/t2/` and `contracts/examples/http-*.json`. T2 accepts constant 0..300 mm/h rain lasting 300..21600 seconds in 300-second increments, with the same 3600 s drain-down and native QA rules. Only clean direct-node entry and normal tailwater are enabled. Restriction is T3; mitigation is T4; Docker and broader engineering validation remain T5.

Primary reference material: [EPA SWMM 5.2 User's Manual](https://www.epa.gov/system/files/documents/2022-04/swmm-users-manual-version-5.2.pdf) for input formats, reporting and numerical troubleshooting; [EPA hydraulics reference](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P100S9AS.TXT) for surcharge concepts; [toolkit statistics source](https://github.com/pyswmm/Stormwater-Management-Model/blob/develop/src/solver/stats.c) for unit conversions and crown-based node statistics. Published sources describe the engine; all numerical results above come from this repository's actual retained runs.
