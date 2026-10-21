# Operations problems register, guided demo and maintenance workflow

Audience: township operations manager. Buyer: property developer / estate manager. Structural options require drainage-engineer review.

## Start with the operations Dashboard

Dashboard now opens the problems register in every data mode. It starts empty. These are browser-local records scoped to township, model version and data mode (and API base URL in API mode). They are not stored on the API, automatically imported complaints, dispatched work orders or detected floods. Inspections and proposals continue to use their existing explicitly selected local/API sources.

For a reproducible practice run, start in Browser engine mode with an empty register:

| Step | Enter / click | Expected result |
|---|---|---|
| 1 | **Record a problem** | Blank investigation form. No reports are invented. |
| 2 | Title: `Water reported at the cul-de-sac`; location: `Example D07 street`; linked asset: `INLET-D07`; existing reference: `DEMO-C01` | The entered location is linked to the illustrative asset, not declared a real surveyed address or confirmed cause. |
| 3 | Leave incident time at the current time. Keep source **Synthetic demonstration**. Source reference: `DEMO-C01`; description: `Practice report: water was reported near the inlet after rain.`; reported impact: `Practice account of driveway access difficulty.` | One report with explicit synthetic source. A recorded report would still be an account, not independent confirmation of flooding or cause. |
| 4 | Team: `Township maintenance`; action: **Inspect location**; due date: choose yesterday. Click **Save problem**. | From an empty register: 1 open problem, 1 overdue action, 1 needing observed inspection, 0 unassigned. Detail shows the evidence gaps, report and next action. |
| 5 | **Locate asset**, then return with **Dashboard** | Map selects D07 and opens its asset evidence drawer. Dashboard retains the investigation record. |
| 6 | **Record inspection**. Use the existing inspection form and keep practice evidence synthetic. Attach an image/PDF if available. | Asset inspection history updates. A synthetic inspection does not clear the missing observed-inspection flag. No hydraulic restriction is inferred from the photo. |
| 7 | Change team, next action, due date or status; **Save changes** | Revision and record history update. No notification or contractor dispatch occurs. Unsaved detail edits must be saved or reset before opening other actions. |
| 8 | **Add report**, using source reference `DEMO-C02` and a new practice description | Report count increases to 2, both synthetic. Repeat reports filter includes the case. This is an entered-report count, not an independent flood-event count. Avoid adding duplicates. |
| 9 | **Prepare investigation proposal** | Proposals opens with the asset, team, problem ID, existing reference, next action and reported finding. Modelled benefit is not attached or claimed. Enter a valid scope, justification and cost evidence before saving. |
| 10 | On Dashboard, choose status **Closed**, enter `Practice review recorded; monitor after rain.`, save, then use **Closed** filter | Administrative closure and its reason are visible; the case leaves active / overdue counts. It does not certify hydraulic performance. An additional report reopens it. |
| 11 | **CSV** or **Export evidence JSON** | CSV contains all saved problem rows with source-labelled counts; JSON includes the selected problem, report/history records, linked asset and available asset inspection snapshot. Refresh preserves browser records. |

The follow-up order is explicitly overdue actions first, then oldest initial report, with closed cases last. It is not a risk score. The dashboard flags absent asset links, absent observed asset inspection since the latest report, missing owner/date and overdue next actions. A later inspection is a prompt for review, not proof that it resolves this particular incident.

Storage errors and conflicting revisions do not overwrite existing records. Reload after changes in another tab. Invalid stored data blocks edits and can be exported for recovery. Asset/API errors remain visible; the local follow-up fields can still be edited, but map / inspection / proposal actions wait for usable asset information. The register does not fall back from a failed API to fabricated inspection or simulation data.

This completes the first operations upgrade. Shared server storage for problems, real asset import, engineering model validation, readable proposal packs and pilot benefit measurements remain later work. No real-site evidence or contractor rate is invented to fill those gaps.

## Start with the guided story

From Dashboard choose **Open browser demo**, or use **Guided browser demo** in the asset maintenance workspace. This explicitly selects Browser engine when another data source is active; API failures never fall back to it.

1. **Meet the street.** The opening question is “Will cleaning this drain be enough?” Leave rain at **80 mm/h for 60 minutes**, inlet loss at **40%**, and canal level at **Normal**. These are illustrative assumptions. No results appear before calculation.
2. Choose **D07 street junction** and **15 cm** in the road study panel. Click **Test this storm** and wait for the worker. Read **Sampled peak at road point R1**, **Largest road area above reference** and the R1 duration. Turquoise cells identify the actual road mask; grates, sumps and manhole footprints are excluded. Synthetic terrain is not surveyed pavement. The 15 cm reference is not a road-safety standard. Use either jump button to inspect the point peak or largest simultaneous road area. Exact definitions and checked sample values: [calculation foundation](CALCULATION_FOUNDATION.md).
3. Click **Try cleaning D07**. The engine reruns with zero D07 hydraulic loss and all other scenario inputs retained. The explanation follows the computed change: improvement, little change or worsening. It does not promise cleaning will solve the problem.
4. Click **Test P07: 600 → 750 mm**. This separate option changes only the pipe size; it retains the chosen inlet loss. The BEFORE / AFTER views share one time and camera. Drag either view, scrub the timeline, switch to **Look underground**, and change the comparison selector to revisit cleaning. The summary compares whole-run maxima; the pictures show one shared moment. The curve uses a common vertical scale for both options.
5. Click **Choose the next action**. Select evidence collection, cleaning review or engineering review, then **Prepare a work proposal**. The proposal receives the chosen asset, suggested scope, modelled finding, run comparison and input hashes. Enter the responsible team and actual cost evidence before saving. No cost saving or construction approval is invented.

Change rain, loss or canal assumptions to clear the old story results. Cancelled calculations can be restarted; failed calculations show their error and Retry. **Operations dashboard** or the top **Dashboard** returns to the problems register. Use **Asset maintenance** there for the workflow below.

The road display reuses the TypeScript worker and derives point/area/duration values from actual output samples (normally 30 seconds). Area is counted simultaneously in each frame. Changing study area/reference reanalyses the same frames; changing hydraulic conditions clears the old runs. **Calculation checks and validation limits** executes idealised browser/native reference cases. API v1.4 now supports explicit conceptual cleaning, pipe and storage actions. Native pipe checks do not validate the browser street-depth map. The technical browser volume metric remains a separate sum of cell peak volumes, not a simultaneous volume.

## Continue in the maintenance workspace

1. Start `npm run dev:web` from the repository root. Open **Asset maintenance** from Dashboard to see maintenance priorities beside the map. Explain that the model and named zones are illustrative.
2. Locate `INLET-D07`. Its evidence drawer shows real input dimensions and missing inspection state; no invented current readings appear. Open **Record inspection**. Enter inspector, captured time, source reference and condition. Keep **Synthetic demonstration** for a demo; use Observed only for actual field evidence. Attach an image/PDF if available.
3. Open **Compare**. Select storm, inlet loss and downstream condition. Coverage and hydraulic loss are independent. Click **Run matching comparisons**. Browser mode runs the TypeScript engine; **Settings -> Live FastAPI** uses native finite inlet scenarios and conceptual intervention actions on API v1.4. Choose Normal tailwater in API mode; high remains unavailable. Each result identifies its metric, run and input hash. Expand its input checks to inspect the retained changes. Older API versions explicitly mark new interventions unavailable.
4. Change a setting to demonstrate **Outdated comparison**, then restore the exact settings or rerun. **View on map** previews calculated results; browser candidates rerun with those inputs.
5. Choose **Estimate / draft**. Enter scope, responsible team, justification, quantities, rates, rate source/date and exclusions. Unknown rates remain **Estimate required**. Any made-up demonstration rate must remain Illustrative.
6. Save the draft. Refresh/reopen to show persistence. In browser mode it is stored on this browser; API mode uses server SQLite. Export JSON to retain the full evidence snapshot.
7. With a genuine sourced quote, progress through Reviewed → Scheduled → Completed. Enter a note at each step. Record a new inspection after completion, then select it to mark Verified. Synthetic evidence stays labelled synthetic. These actions do not contact a contractor or certify construction.

The business benefit to test with an operator is time and evidence quality when preparing a maintenance shortlist. Do not claim avoided damage, verified road flood depths, return on investment or real maintenance completion from this demonstration.

Technical setup and new endpoints: [maintenance integration](../contracts/MAINTENANCE_INTEGRATION.md). Visual browser QA remains necessary on the demonstration machine; automated rendering checks do not establish WebGL appearance or mobile layout quality.
