# FloodOps README brand assets

The README uses an original AI-generated township-and-water logo with a red, burgundy and warm gold palette inspired by [Sime Darby Property](https://www.simedarbyproperty.com/). These are creative palette choices, not official brand colour specifications. The design reference for the README structure is [Givlah](https://github.com/Givlah/Givlah#getting-started).

## Assets

- `floodops-logo.png`: transparent PNG with a charcoal wordmark for light backgrounds.
- `floodops-logo-dark.png`: transparent PNG with a light wordmark for dark backgrounds.

The root README selects the appropriate version with a `picture` element. Generation used the built-in imagegen tool. Preserve the PNG alpha channel when reusing these assets.

## Original generation prompt

```text
Use case: logo-brand
Asset type: GitHub README brand logo for Township FloodOps, a township drainage and flood-maintenance planning tool.
Primary request: Create one polished, original logo, a compact abstract township roofline integrated with flowing water and a subtle protective enclosing form. A memorable clean geometric silhouette, strong negative space, flat vector-like colour fields, professional civic technology identity.
Composition: landscape horizontal lockup roughly 2:1, symbol on the left and precise wordmark on the right; balanced compact spacing, trim outer padding. Main text "FloodOps" in bold modern geometric sans serif, dark charcoal; small uppercase "TOWNSHIP" above it. No other words.
Color palette: Sime Darby Property-inspired heritage crimson red (#C8102E), deeper burgundy (#8F1738), warm golden yellow (#F5B335), charcoal (#23252B). Red dominant, small gold accent; use these as an inspired palette rather than claiming exact official brand specifications.
Background: genuinely transparent, clean antialiased edges.
Constraints: a new FloodOps identity, no copied corporate logo, no Sime Darby text, no mockup, no shadow, no paper, no border, no gradients, no photographic elements, no tiny intricate details. Clearly legible at GitHub README display size.
```

## Dark-background adaptation prompt

```text
Edit the provided Township FloodOps logo only for GitHub dark mode. Preserve exactly the existing composition, red / burgundy / golden yellow township-and-water symbol, typography, shapes, dimensions, spacing and transparent background. Change only both wordmark texts TOWNSHIP and FloodOps from dark charcoal to warm off-white #F8F6F2. Keep the original transparent alpha and all other visual elements unchanged. No new elements, no background, no extra text.
```

## Change record — 2026-10-22

Revamped the root README with a centred brand header, jump links, product problem and workflow, current capabilities, repository-root setup commands, a synthetic sample walkthrough, separate browser/native architecture, documentation links, repository layout and contributor credits. Preserved the upload-first portal as the default and the native API as optional. No application code or simulation behaviour changed.

Validation: `python tmp/check-readme.py` passed all 31 link/image references (local targets and section anchors), checked documented npm commands against the manifests and checked balanced code fences. `node tmp/preview-readme.cjs` loaded both theme-specific images successfully in headless Chromium; light and dark header screenshots were visually inspected. `git diff --check` passed. Both final PNGs retain transparency. These were documentation and asset checks; application tests were not rerun.

No blockers remain for this README task. The next step is normal team review and publication through the repository's existing Git workflow; no commit or push was performed. Personal progress files were left unchanged because no Tay/Jiajie identity was declared for this explicitly requested documentation task.

