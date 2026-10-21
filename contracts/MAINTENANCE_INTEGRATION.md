# Maintenance decisions — API v1.4.0

v1.4 extends simulation requests with explicit intervention actions and an executable native reference-check endpoint. See [calculation foundation](../md/CALCULATION_FOUNDATION.md). Null intervention and existing proposal/evidence endpoints remain compatible. Native structural candidates now execute; old v1.3 unavailability notes below are superseded by this update.

The web dashboard now opens a maintenance queue for township operations. The existing synthetic asset IDs and SWMM contracts are unchanged. Location names in the frontend are illustrative zone labels, not verified street addresses.

## Evidence and comparisons

- Missing, synthetic, future-dated or older-than-90-day inspections trigger inspection first. The 90-day policy is a configurable product assumption currently defined in `apps/web/src/maintenance/model.ts`; agree it with the operator before a field pilot.
- Current observed inlet coverage of at least 20% triggers cleaning **review**, not automatic hydraulic loss. Other recorded network debris findings trigger engineering review; clear records remain routine monitoring. The 20% trigger is also a product policy, not a calibrated hydraulic threshold.
- Browser comparisons use the FloodOps TypeScript engine, independently of the map's applied intervention. Every candidate uses the same selected storm, baseline D07 blockage and tailwater. Only explicit intervention changes differ. Browser input snapshots/hashes and metrics are retained in the proposal; their generated run IDs are local references, not retrievable API runs.
- SWMM comparisons create one shared finite D07 source scenario, then submit/poll independent native runs with `intervention: null` or `{actions:[...]}`. Cleaning changes only effective inlet loss; P07 upsizing changes its diameter; conceptual storage adds explicit nodes/links. Storm, hydrology and boundary remain matched. Exact input changes and native artifacts are retained. Native proposal saving reconstructs the allowed physical changes from its retained baseline and rejects a mismatched candidate.
- Changing mode/model/storm/debris/tailwater marks previous comparisons outdated and prevents attaching their modelled benefit to a new proposal. Map preview reruns a browser candidate or loads the retained SWMM run. It never edits result frames to imitate a blockage or upgrade.
- API mode never falls back to offline fixtures. Mock mode is explicitly retained offline replay and cannot calculate intervention comparisons.

## Proposal endpoints

`GET /api/maintenance/proposals` returns `{items: [...]}` with the latest revision of each proposal.

`POST /api/maintenance/proposals` accepts:

```json
{
  "asset_id": "INLET-D07",
  "location": "Cul-de-sac / low point (illustrative)",
  "scope": "Inspect inlet and document condition",
  "owner": "Township operations",
  "justification": "Current field evidence is missing",
  "mode": "api",
  "estimate": {
    "lines": [{"description": "Inspection", "quantity": 1, "unit": "visit", "rate": null}],
    "source": "", "date": "", "basis": "illustrative", "exclusions": "Estimate required"
  },
  "inspection_ids": [], "inspection_snapshot": [],
  "comparison": null, "option_id": null
}
```

The server generates the proposal ID, timestamps, revision 1, Draft status and history. Unknown rates stay null. No monetary savings, contractor dispatch or engineering approval is inferred.

For a hydraulic cleaning proposal, use `option_id: "desilt-d07"` and attach the comparison's exact scenario and baseline/cleaning run references. The server checks matching retained native inputs, resolves inspection snapshots itself and replaces supplied metrics/hashes/input snapshots with retained server evidence. Client-supplied numbers cannot substitute for those results.

`POST /api/maintenance/proposals/{id}/transition` accepts:

```json
{"revision": 1, "status": "Reviewed", "note": "Reviewer checked scope and quote", "verification_inspection_id": null}
```

- Status order: Draft → Reviewed → Scheduled → Completed → Verified.
- Review requires complete non-negative rates, a quote source and a valid quote date.
- Verification requires a new inspection of the same asset captured after completion. Its source remains visible; synthetic verification is demonstration evidence, not proof of field work.
- Every transition appends a new immutable SQLite revision and a history entry. A stale revision returns HTTP 409 `REVISION_CONFLICT`.
- Wrong references, mismatched inputs or skipped states return explicit errors. No external messages are sent.

Browser and mock proposals are isolated in local storage by mode. Browser inspections and actual SHA-256 attachment metadata persist locally with their file data; storage failures are surfaced. API inspections/media/proposals persist on the server. Exported proposal JSON contains the cost basis, evidence snapshots, inputs/results and lifecycle history. Exports may include attached photographs; choose their recipients deliberately.

## Verification

`tests/api/test_maintenance.py` covers persistence across application restarts, sequential status transitions, stale revisions, quote/evidence validation, append-only storage and real native baseline/cleaning result retention. Frontend maintenance tests cover priority rules, stale settings, unknown prices, local persistence failures, rendering and worker transport with shortened real numerical runs.

The current rollout has no authentication/role authorization or contractor integration. Statuses record internal review activity. User-entered quotes require independent review; the software does not verify their commercial accuracy.
