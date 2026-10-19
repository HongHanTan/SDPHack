# Actual T2 HTTP and API-restart evidence — 2026-10-19

Generated with `python -m services.api.check_http --output data/validation/t2` using the project's Python environment. This directory already exists; reproduce with no `--output` to create a new runtime under `data/runtime/`.

This uses real TCP HTTP against a separately launched Uvicorn process, not TestClient. It submits baseline 80 mm/h rain, creates a new immutable 120 mm/h storm via POST, submits that new storm ID, polls real run statuses, downloads results/artifacts, stops the API, and starts a new API process using the same SQLite database and files. It confirms identical storm/run/frames/metrics after restart and that the later storm did not change baseline inputs.

`summary.json` records the checks, run IDs, input hashes, observed statuses and exact evidence-file SHA-256 values. Baseline and stronger volumes are 0.014893 and 728.764885 m3. These are real SWMM 5.2.4 calculations on an uncalibrated synthetic model. Preserve their trace-flood warnings; these do not establish site accuracy.

- `baseline/`, `stronger/`: exact HTTP request, 202 acceptance, run, frames, metrics, and observed pre-completion 409 response.
- `storm-create-request.json`, `storm-created.json`: actual immutable storm creation and response.
- `runtime/`: the SQLite database and original native run artifacts/event logs used across both API processes.
- `initial-server.log`, `restart-server.log`: actual process logs.
- `unsupported.json`, `not-found.json`: actual rejection responses.

The sample IDs belong to this evidence runtime; a normal fresh backend does not automatically import them. Use its POST endpoint to create new runs, or replay the sample files explicitly offline. Do not launch a server against this curated runtime, because doing so may modify SQLite evidence bytes; reproduce into a new directory instead. The README was added after execution and is not part of the run's hash manifest. Parent attributes preserve evidence bytes across checkouts.
