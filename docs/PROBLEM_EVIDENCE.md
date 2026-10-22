# FloodOps problem evidence and comparison notes

Checked on 22 October 2026. This note separates official context, documented product capabilities and the repository's synthetic demonstration.

## Official problem evidence

| Source | Evidence used | Interpretation boundary |
| --- | --- | --- |
| [DOSM, Special Report on Impact of Floods in Malaysia, 2025](https://www.dosm.gov.my/site/downloadrelease?id=special-report-on-impact-of-floods-in-malaysia2025&lang=English), released 15 April 2026, PDF page 2 | National damage totals and the public-assets/infrastructure and living-quarters categories for 2024 and 2025. | Covers multiple flood types and locations. It does not establish a blocked-drain share, township-specific loss, addressable market or preventable savings. |
| [DID, Flood Management — Programme and Activities](https://www.water.gov.my/index.php/pages/view/419), “Causes of flood” | Rain intensity, impervious area, sediment and channel obstruction are among the documented drivers. | General mechanisms do not identify the cause of an individual complaint. |
| [DID, Urban Stormwater Management Manual, chapter 24](https://www.water.gov.my/jps/resources/auto%20download%20images/58464dc10bb4f.pdf), §24.1 (printed page 24-1) and §24.7 (printed page 24-15) | Downstream capacity affects inlet function; regular inspection and cleaning address debris blockage. | Supports considering both capacity and maintenance. It does not establish an observed rate of failed maintenance decisions. |

The README's **25.3%** infrastructure-loss increase is calculated as `(380.2 - 303.4) / 303.4 × 100`, rounded to one decimal place. The report also shows that total losses declined; the README preserves that context.

## Existing solutions

| Primary documentation | Supported comparison |
| --- | --- |
| [DID Public InfoBanjir](https://publicinfobanjir.water.gov.my/main/?lang=en) | Rainfall, water-level reporting and flood warnings. FloodOps has no live-feed integration or operational warning service. |
| [EPA SWMM overview and capabilities](https://www.epa.gov/water-research/storm-water-management-model-swmm) | Free, open-source hydrologic/hydraulic modelling, drainage-system outputs and infrastructure evaluation. FloodOps is not claiming to introduce scenario analysis or replace native SWMM. |
| [Autodesk InfoWorks ICM — Key Concepts](https://help.autodesk.com/cloudhelp/2025/ENU/ICM-Help/files/GUID-8BC95C3D-3957-4C59-8024-2DB91228CBF2.htm) | Integrated drainage/catchment modelling, 2D/3D presentation, shared models, audit trails and scenario management. These capabilities already exist in established tools. |

This is a comparison of documented roles and the current FloodOps workflow, not a hands-on benchmark, exhaustive competitor survey or claim that other products cannot be configured for similar workflows. No unverified price, accuracy, time-saving or market-exclusivity claims are used.

## What the repository demonstrates

The product position is the linked township workflow: report → asset → inspection evidence → explicit assumptions → matching calculation → retained follow-up draft. Relevant implementation includes:

- [Site portal](../apps/web/src/site/SitePortal.tsx): distinct map and simulation readiness.
- [Local site service](../apps/web/src/site/local/localSiteApi.ts): source manifests, input snapshots, candidate checks and browser persistence.
- [Calculation foundation](../md/CALCULATION_FOUNDATION.md): retained synthetic D07 comparison, assumptions, road mask, R1 definition, reproduction command and numerical limits.
- [Maintenance integration](../contracts/MAINTENANCE_INTEGRATION.md): proposal evidence and lifecycle rules.

The D07 numbers are previously recorded browser-model outputs. They were not rerun for this documentation edit. The cleaning and pipe options independently change the baseline; the pipe case retains the baseline inlet restriction. The example illustrates hypothesis testing, not field performance, verified cost savings or a general recommendation for larger pipes.

## What still needs validation

The connected workflow is a product hypothesis supported by a working pilot, rather than evidence of market-wide uniqueness. Operator interviews, measured investigation time, surveyed site inputs, field calibration and post-work measurements are needed to demonstrate operational value and real-site benefits.

## Impact target assumptions

The README's expected operational figures are proposed pilot targets using an illustrative planning scenario. They are not observed operator baselines, literature benchmarks, product forecasts or measured savings. No survey or timing study currently establishes the assumed 8-hour baseline or 2-hour target.

| Input | Assumed value | Scope |
| --- | ---: | --- |
| Annual investigation workload | 100 cases per township | Illustrative workload, not an adoption or demand estimate. |
| Current preparation effort | 8 staff-hours per case | Assumed effort assembling evidence, comparing options and drafting a reviewable action. |
| FloodOps preparation target | 2 staff-hours per case | Proposed target to test at comparable review quality, including rework. |
| Value assigned to staff time | RM50 per staff-hour | Illustrative internal planning rate, not a verified wage, quotation or market benchmark. |
| Scale illustration | 10 townships | Identical assumed workloads; no claim of current users or rollout commitments. |

Calculations:

- Preparation effort reduction: `(8 - 2) / 8 × 100 = 75%`.
- Annual effort: `100 × 8 = 800` staff-hours before; `100 × 2 = 200` after.
- Released capacity: `800 - 200 = 600` staff-hours per township per year.
- Capacity value: `600 × RM50 = RM30,000` per township per year, from RM40,000 before to RM10,000 after.
- Ten-township illustration: `10 × 600 = 6,000` staff-hours and `10 × RM30,000 = RM300,000` of annual staff capacity.

Released staff capacity does not establish a cash saving, avoided flood damage or net return on investment. Field visits, approvals and construction are outside the preparation-time allowance; implementation, training, surveys and engineering costs are excluded from the capacity valuation. A pilot must measure the existing process and the assisted process on comparable cases, including review quality and rework, before treating the targets as achieved. Report-to-review elapsed time is a separate measure from staff effort.

The hydraulic before/after figures remain the recorded synthetic D07 example, not expected field performance. R1 depth reduction is approximately 87.2% from rounded outputs; area and duration reductions apply only at the selected 15 cm comparison reference. No property-protection or road-safety claim follows from them.

## Change record — 22 October 2026

Expanded the root README's problem statement, added a cause-to-investigation diagram, placed “What makes us unique” beneath “What makes FloodOps useful”, and added a sourced comparison with existing platforms plus a clearly labelled synthetic example. Preserved existing branding and setup instructions. No application or simulation code changed. Personal progress files remain unchanged because no Tay/Jiajie identity was declared for this explicit documentation task.

Verification: `python tmp/check-readme.py` passed 40 README references, local paths and section anchors, manifest-backed commands and balanced fences. The four implementation links above resolve. `node tmp/preview-readme.cjs` passed both theme-image checks; `node tmp/preview-readme-evidence.cjs` rendered the updated sections for visual review. `git diff --check` passed. DOSM values and publication date were checked against its release; the infrastructure percentage was independently calculated. No blockers remain for the documentation task. Next: team review, followed by operator and real-site validation for the product claims described above.

### Impact section — 22 October 2026

Completed the root README's Impact section at the user's request and added its navigation link. It describes intended value for operations teams, engineers, township managers/developers and residents; connects that value to the recorded synthetic D07 comparison; and defines operational and field measurements for a real-site pilot. The approximately 87.2% R1 peak reduction is calculated from the existing rounded 60.0 cm and 7.7 cm outputs: `(60.0 - 7.7) / 60.0 × 100`. The 760 to 0 m² result is explicitly limited to the selected road area at or above the 15 cm comparison reference. No measured cost savings, protected-property count or field-validated benefit is claimed. The simulations were not rerun for this documentation edit.

Changed files: `README.md` and this evidence note. Personal progress files remain unchanged because no Tay/Jiajie identity was declared for this explicit documentation task. Verification: README links, heading anchors, Markdown tables/fences, percentage calculation and `git diff --check` passed. No application code changed or application tests were needed. Next: operator review and a surveyed-site pilot to measure the stated impact indicators.

### Quantified impact revision — 22 October 2026

At the user's request, strengthened the impact presentation with headline figures and explicit before/after tables for recorded synthetic outputs and expected operational impact. Added the illustrative 8-to-2-hour preparation target, 100-case workload, RM50/hour rate and ten-township scale example with the assumptions above. These are proposed planning targets, not evidence of achieved outcomes. Preserved existing unrelated README changes and personal progress files. Verification: README links/anchors, Markdown table structure, all percentage/annual/scale arithmetic and `git diff --check` passed. No simulation or application behaviour changed. Next: collect operator timing data to replace the assumed baseline and validate the target.

### Malaysian English wording — 22 October 2026

Reworded only the README Impact section in clear, professional Malaysian English at the user's request. Used familiar terms such as drainage works, site visits, complaints, proposed upgrades and staff time freed up, while retaining British spelling, RM amounts, all figures and the distinction between synthetic results and assumed pilot targets. Verification: unchanged numerical figures, three impact tables, README links/anchors and `git diff --check` passed. No application changes or personal progress updates; next step remains operator review and pilot measurement.
