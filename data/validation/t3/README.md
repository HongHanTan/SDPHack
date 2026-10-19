# T3 actual HTTP / inspection / debris / native inlet validation

Generated on 2026-10-19 with `python -m services.api.check_t3 --output data/validation/t3`, SWMM 5.2.4, toolkit 0.17.0. All geography, evidence records, rainfall and inlet curves are synthetic/assumed. The one-pixel image only checks byte-preserving upload, not site evidence.

The CLI used actual loopback TCP, separate API/native processes, a new SQLite runtime and four created debris scenarios bound to the same newly created 120 mm/h storm. It verified append-only media, frozen inspection/media snapshots, independent 65% visible coverage versus 0/20/40/60% hydraulic loss, debris mass conservation, unchanged retained direct-node baseline, real native results, and readback across a full API process restart. Its processes have stopped.

`native-{0,20,40,60}/` retains requests/accepted/status/frames/metrics. `runtime/runs/` retains original `.inp`, `.rpt`, `.out`, full inputs, hashes, QA and native statistics. `repeat-40/` is an independent exact input repeat with identical inlet volumes and binary output; `half-step-40/` halves maximum routing step to 0.5s. Maximum debris accounting error is 8.88e-16 kg; D07 half-step capture/bypass differences are about 0.01053/0.01047 m3 (below the stated 0.5% acceptance threshold).

`summary.json` is the authoritative manifest and controlled sensitivity table. `.gitattributes` preserves original evidence bytes. README is explanatory metadata added after the manifest. Keep this directory immutable; a fresh verification must use a new output directory. Do not launch a developer API against this retained database, as writes would invalidate the manifest. Sample IDs do not exist in a fresh development runtime.

See `contracts/T3_INTEGRATION.md` for client wiring and `md/MODEL_ASSUMPTIONS.md` for interpretation. Higher restriction increases surface bypass in this test while sewer flooding decreases; do not present sewer flooding alone as total surface risk or claim a calibrated inundation map. Frontend/browser G2 acceptance remains separate.
