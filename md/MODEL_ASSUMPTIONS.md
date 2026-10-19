# T1 / T2 / T3 model assumptions and numerical validation

This is a synthetic scenario model inspired by the project context, not a reconstruction of Taman Kyra drainage or an independently calibrated forecast. A successful SWMM calculation verifies execution, not site accuracy. `is_verified_site_model` remains false.

## Inputs and model boundary

- Registry: 8 junctions, one outfall, 8 circular conduits and 4 inlet display assets. IDs and node connectivity come from `data/synthetic/taman_kyra_assets.json` and are preserved in the SWMM input and output. Conduit offsets are zero.
- Coordinates: arbitrary local metres east/north/elevation. Nodes sit at pipe invert elevation; inlet markers sit at surface grate elevation. All diameters, slopes, Manning roughness (0.013), ground levels and grate areas are synthetic.
- Catchments: four 1 ha subcatchments draining to `NODE-J01`, `NODE-J02`, `NODE-J04`, `NODE-J07`. Each is 80% impervious, width 100 m, slope 1%. They are effective model catchments without surveyed polygon boundaries.
- Surface reservoir: impervious/pervious Manning roughness 0.015 / 0.15, depression storage 1 / 4 mm; 25% of the impervious area has zero depression storage. No routing between pervious and impervious subareas. All runoff goes to the specified outlet.
- Horton infiltration: maximum/minimum 75 / 5 mm/h, decay 4 per hour, drying time 7 days, no maximum cumulative infiltration limit. Evaporation is zero and initial catchments are dry.
- Rain: constant 80 or 120 mm/h for 3600 s, then 3600 s dry drainage. A 5-minute intensity time series feeds the raingage. Actual SWMM accumulated rain totals were checked against 80 / 120 mm, so time-series boundary conventions do not silently alter the storm duration.
- Outfall: fixed stage at outfall invert plus the selected depth (normal 0 m, high 1.2 m). T1 validates **normal** only. The high preset has not undergone the same validation suite.
- Retained T1/T2 entry: `demo_inlet_clean` uses unlimited direct runoff entry into sewer nodes. Its visual inlet markers identify entry locations without finite capture. Its input generation and retained evidence remain unchanged. T3 finite capture uses the separate assumptions below.
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

`/api/health` distinguishes library availability from matching retained execution evidence. It checks engine/toolkit version, current resolved input hash and retained raw-file hashes before reporting `execution_verified=true`; this flag describes T1 evidence. T2 implements real HTTP execution and SQLite persistence (`capabilities.simulations=true`). Actual HTTP/restart evidence and samples are in `data/validation/t2/` and `contracts/examples/http-*.json`. Constant 0..300 mm/h rain lasts 300..21600 seconds in 300-second increments, with the same 3600 s drain-down and native QA rules. Normal tailwater is enabled; high remains unvalidated and rejected. T3 finite inlet proof is separately retained in `data/validation/t3/`. Mitigation is T4; Docker and broader engineering validation remain T5.

## T3 native finite inlet model

`models/illustrative_taman_kyra/inlet_capture.json` versions the assumptions as inlet-capture-v1. All original 9 node / 8 conduit / 4 inlet registry IDs and pipe geometry remain unchanged. Each of the four catchments instead drains to a controlled auxiliary approach node, then a rectangular open channel, a bypass junction, an exit channel and a free surface outfall. There are 12 auxiliary nodes and 8 auxiliary links; they are not published as additional site assets. Their exact IDs and inlet/sewer/catchment mapping enter each immutable input snapshot.

Channels are each 20 m long, 2 m wide, 1 m maximum depth, Manning n=0.016; approach/bypass/outfall invert offsets relative to the associated surface inlet are +0.05/-0.05/-0.15 m. They are independent synthetic routing elements, not inferred street geometry. A native CUSTOM DIVERSION inlet uses the explicitly assumed approach-flow/captured-flow points (0,0), (0.25,0.20), (2,0.20) in m3/s. The independent loss fraction enters native `[INLET_USAGE]` as percent clogging at the selected inlet; other inlets use zero loss. No whole pipe diameter is reduced. The legacy direct-node scenario is preserved as a different assumption group.

The pinned [EPA SWMM 5.2.4 inlet implementation](https://github.com/USEPA/Stormwater-Management-Model/blob/v5.2.4/src/solver/inlet.c) applies the retained-capacity factor to this native custom capture curve and transfers water between bypass/capture nodes. These input formats are described in the [EPA SWMM 5.2 manual](https://www.epa.gov/system/files/documents/2022-04/swmm-users-manual-version-5.2.pdf). The curve and channel dimensions are project assumptions; the model does not claim surveyed HEC-22 geometry or calibrated grate-area hydraulics.

A separate bypass junction is necessary: an exploratory connection directly to a surface outfall produced large continuity error and was rejected. Adding the junction/exit channel gave routing continuity errors around -0.024% to -0.016% for the four 120 mm/h sensitivity cases. Full native QA remains enforced; exploratory runs are not retained as successful validation evidence.

Report-frame inlet capture is the receiving sewer node's native lateral inflow (this model has no other lateral input there); bypass is the separate surface outfall's total inflow. Both are actual 60s binary samples. Full-volume `inlet_volumes` integrates toolkit capture, backflow and bypass flows in CMS at native routing-step endpoints using elapsed seconds. Native sewer node overflow/backflow is preserved in its own statistics; surface bypass may include returned sewer water and must not be double-counted as an independent flood loss. No street inundation area/depth or 2D surface recirculation is inferred.

At 120 mm/h for one hour followed by one hour drainage, D07 capture is 741.777064 / 593.429322 / 445.071560 / 296.698003 m3 under 0/20/40/60% loss; bypass is 389.679076 / 537.984428 / 686.348132 / 834.683663 m3. Sewer overflow declines in this controlled test because less water enters the sewer; this is not evidence of lower total surface risk. Compare finite loss cases with finite 0%, identical rain and boundary, and show bypass explicitly.

The independent 40% repeat has exactly identical binary output and inlet volumes. Halving routing step changes D07 capture/bypass by about 0.010534/0.010474 m3, below the stated 0.5% inlet-volume refinement threshold. Zero-rain and maximum supported 300 mm/h/21600s runs are covered by API integration tests. These checks verify this illustrative execution path, not site calibration or all hydraulic regimes.

## T3 evidence and debris accounting

Inspections retain client-declared source, timezone-aware collection time (normalized to UTC), server created_at, model/asset IDs and append-only media with byte count and SHA-256. A virtual record is synthetic; actual field provenance must be supplied explicitly. The system does not verify a photograph's authenticity. Created scenarios freeze inspection/media and storm snapshots; newly appended media does not change previous inputs.

`simulation/debris/mass_balance.py` uses 60s kg accounting: add loading_kg_per_day * dt/86400 to surface stock, wash available stock by 1-exp(-wash_off_per_mm * interval_rain_mm), split transported mass into retained/exported fractions, then apply any end-of-interval cleaning removal. Cumulative added/exported/removed stocks make initial+added = surface+retained+exported+removed independently checkable at every sample. The 120 mm/h proof has maximum error 8.88e-16 kg; tests cover no rain, empty stocks, high wash-off, capture fractions 0/1 and full/partial cleaning.

There is no calibrated mass-to-clogging or coverage-to-clogging mapping. The independently selected constant hydraulic loss is stored alongside the calculated timeline, explicitly labelled assumed_not_calibrated. A mass cleaning event therefore does not silently change hydraulic loss; a separate 0% scenario is needed to express clean hydraulics. The model resolves no individual leaf motion or solid-fluid interactions. Jiajie may animate the computed timeline as a visual representation with clear provenance.

Primary reference material: [EPA SWMM 5.2 User's Manual](https://www.epa.gov/system/files/documents/2022-04/swmm-users-manual-version-5.2.pdf) for input formats, reporting and numerical troubleshooting; [EPA hydraulics reference](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P100S9AS.TXT) for surcharge concepts; [toolkit statistics source](https://github.com/pyswmm/Stormwater-Management-Model/blob/develop/src/solver/stats.c) for unit conversions and crown-based node statistics. Published sources describe the engine; all numerical results above come from this repository's actual retained runs.
