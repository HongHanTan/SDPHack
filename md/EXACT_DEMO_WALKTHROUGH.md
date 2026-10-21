# FloodOps: exact start-to-finish practice walkthrough

Checked against the current source and localhost HTTP services on 21 October 2026. This guide does not claim browser/WebGL click acceptance. Allow about 15 minutes on your first attempt; each of the three browser calculations previously took about 17-19 seconds on this machine.

## The person and the decision

You are a township operations manager. Someone reports water near a drain. You need to decide what to inspect, whether cleaning is enough, and whether an engineer should investigate the pipe. You then save a proposal and give the next action an owner and date.

The practice story is: **report -> inspect -> test the same storm -> compare cleaning and pipe size -> request engineering review -> export -> follow up**.

Everything entered below is fictional. The browser calculations run actual numerical code, but the site geometry and assumptions are synthetic and uncalibrated. The result is a proposal for investigation, not construction approval or proof of real flood reduction.

## 0. Open the correct version and get the files

Open `http://localhost:5173`. Both the web server and API were responding when this guide was prepared. If the web page is unavailable, run this from a PowerShell terminal in the repository and keep the terminal open:

```powershell
cd 'C:\Users\60115\OneDrive\Desktop\Y2S1\SDPHack'
npm run dev:web
```

Click **Settings -> Engine**, then close Settings. Use Engine throughout the main walkthrough. Switching mode changes the record collection you see; it does not move records between browser and API storage.

Extract `output/FloodOps-demo-pack.zip`. It contains this guide and three PDFs:

| File | Use |
|---|---|
| `demo-d07-before.pdf` | Upload to the D07 inspection in step 2. Synthetic record, not a site photo. |
| `demo-quote-q001.pdf` | Optional cleaning-cost exercise in appendix A. Fictional RM450 example, not an engineering-review or pipe-construction quote. |
| `demo-d07-after.pdf` | Reserved for a later post-work inspection exercise. Do not upload as evidence that today's proposed work has happened. |

Only the inspection form accepts these attachments. There is no ZIP import, automatic PDF field extraction or quote-PDF upload in the proposal form. Type the fields below yourself. Keep all practice evidence labelled **Synthetic demonstration** and costs **Illustrative estimate**.

**Expected:** Dashboard says **What needs follow-up?** An unused register is empty. Existing records may remain; do not delete them. The counts below describe changes from an empty register.

## 1. Record the problem: why are we investigating?

Click **Record a problem**. Enter:

| Field | Exact entry |
|---|---|
| Problem title | `Water reported near D07` |
| Location | `Example D07 street junction` |
| Linked asset | Select `INLET-D07 (inlet)` |
| Existing complaint / work-order reference | `DEMO-C01` |
| Incident date and time | Leave the current default |
| Report source | `Synthetic demonstration` |
| Source reference | `DEMO-C01` |
| What was reported? | `Practice report: water collected near the D07 inlet after rain.` |
| Reported impact | `Practice account of difficulty accessing a driveway.` |
| Responsible person / team | `Township maintenance` |
| Action | `Inspect location` |
| Due date | `2026-10-20` if running on 21 October 2026; otherwise choose yesterday |

Click **Save problem**.

**Expected:** One saved investigation appears. From an empty register: Open problems = 1, Overdue actions = 1, Needs inspection = 1, Unassigned = 0. Its detail shows one entered synthetic report. These are follow-up counts, not a flood-risk score. A linked inlet is an investigation target, not a confirmed cause.

**Why:** The manager starts with a reported problem and a named next action, rather than a rain animation.

## 2. Record an inspection: what evidence do we have?

Click **Locate asset** to see D07 on the map and its evidence drawer. Click the top **Dashboard** to return to the problem, then click **Record inspection**. Check the form title contains `INLET-D07`.

| Field | Exact entry |
|---|---|
| Inspector | `Demo Inspector` |
| Captured at | Leave the new current default |
| Evidence source | `Synthetic demonstration` |
| Source reference | `DEMO-INSP-D07-001 / DEMO-C01` |
| Method | `visual` |
| Debris | `leaf_litter` |
| Visible grate coverage (%) | `65` |
| Condition / notes | `Synthetic demo: leaves cover about 65% of the visible grate. Actual hydraulic restriction is unknown. Related problem: DEMO-C01.` |
| Attachment | Choose the extracted `demo-d07-before.pdf` |

Click **Save inspection**.

**Expected:** D07 inspection history gains a synthetic record and one attachment. Use **Locate asset** again to open the evidence drawer and inspect the attachment. The missing observed-inspection flag remains: a fictional practice record is not an actual site visit.

**Why:** Evidence and its source are retained. The system does not infer a hydraulic loss from the PDF or from 65% visible coverage.

## 3. Define the test: which road and which storm?

Return to **Dashboard -> Open browser demo**. The heading is **Will cleaning this drain be enough?** Set these values explicitly:

| Control | Exact selection |
|---|---|
| Study area | `D07 street junction` |
| Comparison reference | `15 cm` |
| Rain scenario | `80 mm/h for 60 minutes` |
| Other assumptions -> Inlet hydraulic loss | `40% assumed loss` |
| Other assumptions -> Canal level | `Normal assumed level` |

**Expected:** The road panel identifies 196 measured cells, covering 784 m2. Turquoise cells show the measured road area; gold R1 marks the fixed road measurement point. No storm result exists until you calculate it. The source strip says FloodOps browser engine, not EPA SWMM.

**Why:** Every compared option must use the same storm and measurement location. The **40% loss is an independent assumption**, not a conversion of the 65% visible coverage. The 15 cm setting is a comparison reference, not a safety standard.

## 4. Run the current network: how bad is this modelled case?

Click **Test this storm** and wait for the calculation to finish. Do not change assumptions during the three-case sequence.

**Expected, approximately:**

| Readout | Current network |
|---|---:|
| Sampled peak at road point R1 | 60.0 cm |
| Largest road area at or above 15 cm | 760 m2 |
| R1 time at or above 15 cm | 75.0 minutes |

These are previously checked full-run results for the exact settings above, not values typed into the dashboard. The worker simulates two hours: one hour of rainfall and one further hour of drainage. A depth can therefore remain above the reference for longer than the rainfall lasts.

The three values answer different questions: **how deep at one fixed road point; how much selected road area at the same moment; and how long that point stays above the reference**. They do not say every measured road cell is 60 cm deep.

The animation shows one selected time. The peak readout covers the full run. Use the jump buttons below the depth curve to inspect the current network's deepest sampled moment or largest affected road area.

## 5. Try cleaning: does the obvious fix solve the modelled issue?

Click **Try cleaning D07** and wait.

**Expected:** R1 peak about **59.8 cm**, maximum area still **760 m2**, R1 duration about **74.0 minutes**. Cleaning sets the effective D07 hydraulic loss to zero; the storm and other inputs stay the same.

**Meaning:** Cleaning helps little in this particular model. A dirty-looking grate does not establish that cleaning will remove the modelled road flooding. Do not describe this as proof that actual cleaning is useless.

## 6. Test the pipe: what changes if its diameter is larger?

Click **Test P07: 600 -> 750 mm** (the button uses an arrow), then wait.

**Expected:** R1 peak about **7.7 cm**, maximum selected area at or above 15 cm **0 m2**, R1 duration above that reference **0.0 minutes**.

| Same test conditions | R1 peak | Maximum simultaneous area >=15 cm | R1 duration >=15 cm |
|---|---:|---:|---:|
| Current network | 60.0 cm | 760 m2 | 75.0 min |
| Clean D07 | 59.8 cm | 760 m2 | 74.0 min |
| Larger P07 | 7.7 cm | 0 m2 | 0.0 min |

The pipe test is a **separate option**. It changes P07 from 600 to 750 mm while retaining the original 40% assumed inlet loss. It is not cleaning plus a larger pipe.

Click **Look underground** to locate P07. Drag either before/after view; the cameras move together. Move the shared timeline to compare the same moment. Choose **Clean D07 only** or **Larger P07 pipe** in the comparison selector to revisit the two options.

**Why / the main reveal:** The tool challenges the initial assumption before the manager requests work. The appropriate next step is to investigate pipe capacity and feasibility with an engineer. Zero area above 15 cm is not a dry road, guaranteed access or proven property protection.

## 7. Check the calculations: are these just invented display numbers?

Expand **Shared input checks passed** for the candidate. It shows checks that the candidate retains the common storm, boundary and grid inputs and only makes its declared changes.

Expand **Calculation checks and validation limits**. Click **Run browser reference checks**.

**Expected:** Three small calculations display their reference value, computed value, error, tolerance and **Passed this check**: rainfall accumulation, still water and full-pipe capacity. The simple rain case expects 0.002 m depth. These checks execute numerical code; they do not certify the township model.

If the API is available, also click **Run native SWMM reference checks** without switching the main walkthrough's data mode.

**Expected:** Two native cases: pipe flow around 0.6141 m3/s against a 0.6140 m3/s reference, and zero depth change in an isolated tank. A native report hash is shown. If unavailable, the UI shows an explicit error rather than a substitute result.

**Why:** The browser story is actual TypeScript numerical software. Native reference checks run EPA SWMM separately. Both use equations in software. Passing these idealised checks does not validate real street depths, catchments or intervention benefits. The screen correctly retains **Site and street-depth validation: not established**.

Optional measurement demonstration: select **Downstream street / J08 approach**. The stored baseline gives approximately **7.1 cm at its R1**, but **120 m2** of other selected road cells above 15 cm. A single point does not describe the whole street. Changing study area remeasures the stored frames; it does not rerun physics. Restore **D07 street junction** and **15 cm** before preparing the proposal.

## 8. Prepare the decision: request a review, not pipe construction

Click **Choose the next action**. Select **Request engineering review**, then **Prepare a work proposal**. Do not leave the default **Collect site evidence** selected if you want the pipe comparison attached.

Check **Target asset = PIPE-P07** and **Current comparison attached**. Enter:

| Field | Exact entry |
|---|---|
| Scope | `Review PIPE-P07 capacity and the feasibility of a 600 mm to 750 mm upgrade. Verify dimensions, road levels, utilities and downstream capacity before proposing construction.` |
| Responsible person / team | `Township engineering team` |
| Reason and unresolved constraints | Keep the generated numerical finding. Add: `Related complaint: DEMO-C01. D07 inspection reference: DEMO-INSP-D07-001. Request survey and engineering review; no construction approval is requested.` |
| Basis | `Illustrative estimate` |
| Quote / rate date | Leave blank |
| Rate / quote source | `No engineering-review quotation obtained - cost unknown.` |
| Cost rows | Keep Work: Qty `1`, Unit `item`; Mobilisation: Qty `1`, Unit `trip`; Disposal / reinstatement: Qty `1`, Unit `item`. Leave every RM / unit blank. These placeholders require scoping with the engineer. |
| Assumptions / exclusions | `Review cost and construction cost are unknown. Survey, utilities, downstream capacity, approvals and reinstatement require confirmation. No savings are claimed.` |

Click **Save draft proposal**.

**Expected:** A saved **Draft** for PIPE-P07, with **Estimate required**, current comparison/run/input references, scope, team and justification. Blank rates mean unknown cost, not RM0. The fictional RM450 cleaning quote does not apply to this pipe review.

D07's inspection belongs to **INLET-D07**; it is not automatically attached as a **PIPE-P07** inspection. Its reference is in your reason, and its actual record is retained in the problem export. The current app does not automatically connect the operations problem ID to this simulation handoff. The manually entered `DEMO-C01` provides the cross-reference.

**Why:** The output is a traceable next decision that states the remaining information and cost gaps. It does not turn a model result into a purchase approval.

## 9. Export and follow up: what does the manager leave with?

In the saved proposal click **Export full evidence snapshot**.

**Expected:** A `FloodOps-<proposal-id>.json` download containing the proposal, estimate, retained comparison and available target-asset inspection snapshot. This is JSON, not a generated PDF spending report.

Return to **Dashboard**, select `Water reported near D07`, and enter:

| Field | Exact entry |
|---|---|
| Responsible person / team | `Township engineering team` |
| Next action | `Engineering review` |
| Due date | `2026-10-22` if running on 21 October 2026; otherwise tomorrow |
| Status | `Investigating` |

Click **Save changes**, then **Export evidence JSON**. Click **CSV** in the Problems list if you also want the register table.

**Expected:** The case stays open, its overdue flag clears, and it has an engineering review due date and owner. The observed-inspection gap remains. The problem JSON includes its report/history and D07 inspection snapshot; the CSV is a list of saved problems. Refreshing the page preserves the local records in the same browser/mode.

**End of the main demo:** One complaint, one synthetic D07 inspection with attachment, three calculated scenarios, one engineering-review draft, and an assigned follow-up. You have not claimed that the street is fixed. The current browser mode saves these locally; it does not dispatch a contractor or synchronise a shared operations register.

## Appendix A. Optional exact cleaning-cost exercise

This shows how cost arithmetic works. It is a separate cleaning draft, not the recommended solution to the modelled road flooding. You can skip it during a short pitch.

Reopen **Open browser demo**. If the three results are no longer present, repeat steps 3-6; runs are not guaranteed to survive page refresh. Choose **Choose the next action -> Review inlet cleaning -> Prepare a work proposal**.

Check **Target asset = INLET-D07**. Keep **Basis = Illustrative estimate**. Enter:

| Field | Exact entry |
|---|---|
| Scope | `Review cleaning of one D07 inlet, including leaf removal, collection and disposal. Confirm access and condition after cleaning.` |
| Responsible person / team | `Township maintenance` |
| Reason and unresolved constraints | Keep the generated cleaning finding; add `Related complaint DEMO-C01. This cleaning option showed little change in the selected road metric and is not claimed to solve flooding.` |
| Quote / rate date | `2026-10-21` |
| Rate / quote source | `DEMO-Q001 - fictional test quotation; not a contractor offer.` |
| Assumptions / exclusions | `Demonstration rates only. Taxes, traffic control, pipe repairs and excavation excluded. No real expenditure approval.` |

Replace the three default cost rows with:

| Item | Qty | Unit | RM / unit | Calculated subtotal |
|---|---:|---|---:|---:|
| `Inlet cleaning` | `1` | `inlet` | `250` | RM250 |
| `Mobilisation` | `1` | `trip` | `150` | RM150 |
| `Disposal` | `1` | `load` | `50` | RM50 |

**Expected:** Total **RM450.00** because `(1 x 250) + (1 x 150) + (1 x 50) = 450`. The estimate uses entered quantities and rates, not hydraulic software or market pricing. The quote PDF is a reference to read; the form has no quote upload/parser.

Click **Save draft proposal**. The D07 inspection is attached because this draft targets D07. Export it if wanted. Keep it **Draft**: the illustrative estimate does not meet the sourced-quote requirement for Reviewed. The prototype checks entered quote details; it cannot authenticate a supplier.

## Appendix B. What happens after a genuine quote and actual work?

The current workflow supports **Draft -> Reviewed -> Scheduled -> Completed -> Verified**. The fictional files above do not establish real quotations or work. For a real case:

1. Obtain the actual scoped quote. Use **Revise as new draft** if revising a saved draft. Check the new draft's comparison: this revision action does not automatically carry over the original modelled benefit.
2. Enter Basis **Sourced quote**, genuine source/reference/date and all item rates. Only then can a saved draft progress to Reviewed.
3. Add a **Transition note** explaining the actual review, then click **Record Reviewed**. Add the actual schedule note, then **Record Scheduled**. After actual completion add its note, then **Record Completed**. These are internal records, not messages to a contractor.
4. Click **Record post-work inspection**. Record the actual evidence with a new timestamp later than completion and the correct asset ID. Select that record in **Verification inspection**, enter a verification note and click **Record Verified**. Verified is a workflow record, not independent proof of flood reduction.
5. For a separately authorised synthetic cleaning-workflow test only, the after-work PDF corresponds to `INLET-D07`, inspector `Demo Inspector`, source `Synthetic demonstration`, reference `DEMO-INSP-D07-002`, method `visual`, debris `none`, coverage `5`, notes `Synthetic demo: most visible debris has been removed. Minor residue remains. This does not confirm hydraulic performance.` It cannot serve as P07 evidence. Do not relabel it as observed evidence or use it to imply work happened in the main demo.
6. Return to the operations problem and decide its next status manually. Proposal verification does not automatically close the problem. To close administratively select **Closed**, enter the actual **Reason for closing**, and save. A new report reopens the case.

## Appendix C. Optional native EPA SWMM comparison

Use this separately after exporting the main browser demo. It changes data source and displays different network metrics; do not expect the browser road-depth numbers in this table.

1. Click **Settings -> Live FastAPI** and close Settings. The configured API must be available at `http://127.0.0.1:8000` (or your saved API base URL).
2. Click the top **Compare**. Select Storm **Synthetic constant 80 mm/h for 60 minutes**, Inlet loss assumption **Assumed 40% D07 capture-capacity loss**, Downstream condition **Assumed normal outfall level**.
3. Click **Run matching comparisons**. The updated v1.4 API supports original network, cleaning, P07 upsizing, their combination, conceptual off-line storage and conceptual pond relief. Candidate failures and numerical warnings remain visible.
4. Read each metric's definition. Native network-node flooding volume is not the browser road area or R1 depth. Compare capture/bypass as well as network flooding; one favourable metric alone does not establish the best intervention.
5. Expand each candidate's input checks. **View on map** loads the executed candidate asset snapshot, including the changed pipe or conceptual storage. **Estimate / draft** begins a proposal using that candidate. Cost evidence must still be supplied.
6. Native high-outfall presets remain unsupported. A failed API does not switch to a browser or mock result.

If needed, start the API in a second terminal from the repository root, leaving the web terminal running:

```powershell
.\services\api\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000
```

Do not start a duplicate if port 8000 already serves `/api/health`.

## If your result differs

- Confirm **Engine**, 80 mm/h for 60 minutes, 40% assumed loss, normal canal, D07 study and 15 cm reference. API/mock results use different calculations or replay data.
- Changing rain/loss/canal clears old guided runs. Recalculate all three. Changing study area/reference only reanalyses stored frames.
- A readout is a whole-run statistic; the animation is one time sample. Pause or use a jump button before comparing pictures.
- Extra existing cases change dashboard totals. Select the case with reference DEMO-C01 instead of expecting the whole register to contain exactly one case.
- Disabled problem actions can mean unsaved edits: click **Save changes** or **Reset edits** first.
- Keep the same browser, origin (`localhost:5173`) and mode to see local records. Different hostname, browser or API destination may show another collection. Export first; do not clear storage to repair a missing record.
- Failed calculations, unavailable API, attachment quota and storage errors need to be resolved explicitly. Do not replace an error with a claimed success.
