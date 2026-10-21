# Recorded FloodOps walkthrough

Recorded with actual clicks and typing in a visible Playwright Chromium window on localhost:5173. The MP4 has burned-in step captions and click highlights, with no voice narration. The recording uses a separate browser context and fictional practice data. No original browser records were changed.

Length: 07:01. Start with **FloodOps-walkthrough.mp4** or **Watch-walkthrough.html**. The original recording is **FloodOps-full-walkthrough.webm**.

| Time | Action |
|---|---|
| 00:01 | 1. Open the operations dashboard |
| 00:06 | 2. Record the D07 complaint |
| 00:21 | Saved: 1 open, 1 overdue, 1 needs inspection |
| 00:33 | 3. Record an inspection with an attachment |
| 00:45 | Inspection and PDF saved |
| 00:50 | 4. Define the road and storm |
| 01:06 | 5. Calculate the current network |
| 02:13 | Current network: 60.0 cm; 760 m2; 75 minutes |
| 02:20 | 6. Try cleaning D07 |
| 03:30 | Cleaning: 59.8 cm; 760 m2; 74 minutes |
| 03:36 | 7. Test the larger P07 pipe |
| 05:03 | Larger pipe: 7.7 cm; 0 m2 above 15 cm |
| 05:29 | 8. Check the calculation basis |
| 05:54 | Five reference checks passed |
| 05:59 | 9. Prepare an engineering-review proposal |
| 06:31 | Draft saved: cost remains unknown |
| 06:38 | 10. Give the follow-up an owner and date |
| 06:50 | End: an assigned investigation, not a claimed repair |

The workflow records a D07 complaint, uploads its synthetic inspection PDF, computes original/cleaning/larger-pipe cases, shows matching-input and browser/native reference checks, saves an engineering-review draft with unknown cost, exports evidence, and assigns a follow-up.

Observed in this recording: baseline R1 peak 60.0 cm, cleaning 59.8 cm, pipe option 7.7 cm; maximum simultaneous selected area above 15 cm 760/760/0 m2; approximate R1 durations 75/74/0 minutes. Five idealised reference checks passed. These results do not establish real-site or 2D street-depth validation.

The engineering-review proposal remains Draft. Its cost rates remain blank. The problem remains Investigating, assigned to Township engineering team with due date 2026-10-22; no contractor was contacted.

The replay-final folder contains exported proposal/problem JSON, CSV, selected screenshots, chapter timing and the isolated demo browser state. The browser state contains only the synthetic records from this run, including the PDF attachment.

Exact-entry instructions: ../../md/EXACT_DEMO_WALKTHROUGH.md. Re-recording script: ../../tests/e2e/record-walkthrough.cjs (run from the repository root; requires the verified temporary Playwright/encoder setup used in this session).
