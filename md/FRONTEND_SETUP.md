# Township FloodOps — Frontend Setup Guide

> Maintainer: Jiajie (frontend / 3D / user interaction)
>
> Stack: React 19 + TypeScript + Vite + Three.js / React Three Fiber (R3F) + Drei + Tailwind CSS

## 1. Quick start

### Requirements

- Node.js >= 20 (previously verified with v24.14.1).
- npm >= 10 (previously verified with 11.11.0).
- A modern browser with WebGL support.

From the repository root:

```bash
npm install
npm run dev:web
```

Open `http://localhost:5173`. The app opens the upload-first site portal. The portal checks source files, builds the supplied geometry and runs the FloodOps TypeScript engine in the browser; it does not require FastAPI.

To run the web workspace directly after installing the repository dependencies:

```bash
cd apps/web
npm run dev
```

Run the main app's production build and TypeScript checks from the repository root:

```bash
npm -w township-floodops-web run build
npm -w township-floodops-web run lint
```

## 2. Site portal and data modes

### Default: your imported site

The portal accepts a required SWMM `.inp`, an optional layout `.geojson` and an optional height grid `.asc`, all in the same projected metric reference. Importing a `.inp` here runs the browser FloodOps engine, not native EPA SWMM. Projects, retained runs, inspections/media and proposals use browser-local storage. The operations register also remains local to the browser.

Use **Check my files**, review separate map and simulation readiness, then choose **Build my township**. See the [file specification and sample walkthrough](../apps/web/public/site-examples/README.md).

### Separate illustrative demo

Choose **Open illustrative demo** on the portal to access the earlier synthetic township and its Settings menu. The demo supports three explicit data modes:

| Mode | Environment setting | Behaviour |
|---|---|---|
| **Engine** (default for the illustrative demo) | `VITE_DATA_MODE=engine` | Runs the TypeScript browser engine on the synthetic demo township. Results remain uncalibrated. |
| **Mock** | `VITE_DATA_MODE=mock` | Uses `src/mocks/fixtures.ts` and an explicitly identified mock mode. Fixtures are not newly executed SWMM runs. |
| **Live FastAPI** | `VITE_DATA_MODE=api` | Connects to the Python API, defaulting to `http://localhost:8000`. API or engine failures remain visible; there is no silent mock fallback. |

`VITE_API_BASE_URL` sets the API destination. Change modes through **Settings**; the selection and API URL are retained in `localStorage`. A saved browser choice takes precedence over the environment default. These settings select the illustrative demo's source; they do not turn the upload-first portal into a server-backed import flow.

For native calculations, follow the [backend setup guide](BACKEND_SETUP.md). For the browser story, use the [three-minute runbook](DEMO_RUNBOOK.md) or [exact operator walkthrough](EXACT_DEMO_WALKTHROUGH.md).

## 3. Architecture and directory layout

```text
apps/web/
├── src/
│   ├── api/
│   │   └── client.ts            # Explicit Engine / Mock / API client
│   ├── components/
│   │   ├── StatusHeader.tsx     # Settings, source mode, health and errors
│   │   ├── SceneViewer.tsx      # Illustrative R3F township viewport
│   │   ├── SimulationHUD.tsx    # Scenario, run, timeline and metric controls
│   │   ├── AssetDetailModal.tsx # Asset details and inspection history
│   │   └── InspectionModal.tsx  # Inspection observations and attachments
│   ├── site/                   # Upload portal, imported-site scene and comparisons
│   │   ├── api.ts              # Local site request adapter
│   │   └── local/              # Browser engine execution and IndexedDB store
│   ├── operations/             # Problems register and follow-up records
│   ├── maintenance/            # Evidence-linked proposals and lifecycle
│   ├── story/                  # Guided D07 demo and calculation checks
│   ├── engine/                 # Engine adapters and workers
│   ├── mocks/
│   │   └── fixtures.ts         # Explicitly labelled demo fixtures
│   ├── types/
│   │   └── index.ts            # Contract types: assets, frames, metrics and records
│   ├── App.tsx                 # Portal/demo routing and application state
│   ├── main.tsx                # React entry point
│   └── index.css               # Base styles and Tailwind setup
├── .env.example                # Environment setting template
├── package.json
└── vite.config.ts              # Vite configuration; port 5173
```

The original team boundary and initial API schema are documented in the [team workflow](TEAM_WORKFLOW.md), sections 5 and 6. Current machine-readable API interfaces are in [contracts/openapi.json](../contracts/openapi.json).

## 4. Coordinates and data conventions

- **Local coordinates:** `position_m: {x, y, z}` means east, north and elevation in metres.
- **Three.js mapping:** use the shared `toThreeCoords` conversion to produce `[x, z, -y]`; avoid hard-coded coordinate conversions inside components.
- **Source labels:** distinguish `observed`, `synthetic`, `assumed` and `simulated`. A synthetic township is not a surveyed site.
- **Inspection versus hydraulics:** visible grate coverage and assumed hydraulic inlet restriction are separate inputs.
- **Failures:** show calculation, storage and API failures. Never silently substitute mock output for a failed real calculation.

## Documentation update — 22 October 2026

Converted this guide to English and corrected the outdated mock-default instructions to match the current upload-first portal and separate demo settings. This was a documentation update; no dependencies, application code or simulation behaviour changed.
