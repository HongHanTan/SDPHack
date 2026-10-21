# FloodOps architecture diagram

[floodops-architecture.svg](floodops-architecture.svg) is the self-contained image used in the root README's “Architecture at a glance” section. It has a fixed light background for legibility in both GitHub themes, scalable vector icons, accessible title/description and no external fonts, scripts or image dependencies.

The user's reference informed only the visual treatment: short labels, simple outlined component icons, whitespace and direct arrows. The components and connections represent FloodOps. The default browser route and the optional native API route are deliberately shown separately.

## Edit and rebuild

The source is [build_architecture.py](build_architecture.py). Run from the repository root:

```bash
python docs/diagrams/build_architecture.py
```

The generator uses only the Python standard library. Icon geometry, labels and connections remain editable in code. Raster image generation was not used for this diagram.

## Architecture basis

- [Browser site API](../../apps/web/src/site/api.ts) handles portal requests locally.
- [Browser simulation runner](../../apps/web/src/site/local/runs.ts) runs the TypeScript engine through a Web Worker.
- [Project store](../../apps/web/src/site/local/store.ts) uses IndexedDB.
- [Operations repository](../../apps/web/src/operations/repository.ts) uses localStorage for problem records.
- [Backend setup](../../md/BACKEND_SETUP.md) describes FastAPI and native SWMM.
- [API storage](../../services/api/app/storage.py) retains SQLite metadata; native artifacts remain local files.

Arrows describe the main logical flow rather than every internal function call. The native solver's inputs/outputs are retained by the API service. There is no live telemetry, authentication service, load balancer, CDN, cache or replicated database in this pilot diagram.

## Change record — 22 October 2026

Replaced only the architecture Mermaid block in the root README with this icon-based diagram and a short route caption. Existing branding, problem evidence, comparison table and implementation summary were preserved. No application behaviour changed. No Tay/Jiajie identity was declared for this explicit documentation task, so personal progress files were left unchanged.

Verified the generated SVG as XML with no script or external asset dependencies. Chromium rendering checks found every text label inside the canvas, and the README loaded the SVG in both light and dark themes. The full diagram and its README presentation were visually inspected. `python tmp/check-readme.py` passed 37 references, local paths and section anchors; all diagram-source links resolve. `git diff --check` passed after removing an extra trailing blank line. No blockers remain; the diagram is ready for team review. Application tests were not rerun for this documentation-only change.
