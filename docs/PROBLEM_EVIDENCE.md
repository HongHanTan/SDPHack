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

## Change record — 22 October 2026

Expanded the root README's problem statement, added a cause-to-investigation diagram, placed “What makes us unique” beneath “What makes FloodOps useful”, and added a sourced comparison with existing platforms plus a clearly labelled synthetic example. Preserved existing branding and setup instructions. No application or simulation code changed. Personal progress files remain unchanged because no Tay/Jiajie identity was declared for this explicit documentation task.

Verification: `python tmp/check-readme.py` passed 40 README references, local paths and section anchors, manifest-backed commands and balanced fences. The four implementation links above resolve. `node tmp/preview-readme.cjs` passed both theme-image checks; `node tmp/preview-readme-evidence.cjs` rendered the updated sections for visual review. `git diff --check` passed. DOSM values and publication date were checked against its release; the infrastructure percentage was independently calculated. No blockers remain for the documentation task. Next: team review, followed by operator and real-site validation for the product claims described above.
