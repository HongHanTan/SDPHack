# Township FloodOps

> **Evidence-backed drainage maintenance planning for township operations.**
> Upload a catchment's site and drainage data, identify missing inputs, build its 3D map, test a pipe option with native EPA SWMM, and prepare an evidence-linked investigation draft. Imported files remain uncalibrated until checked against the real site.

The default page is now **upload-first**. It starts without a township scene. CSV, JSON and local metric geometry exports supply the actual coordinates, terrain grid, roads, buildings and network. Readiness checks distinguish a usable map from a runnable hydraulic model. Original file hashes, normalized model versions and native run snapshots remain traceable. [Exact upload walkthrough](md/UPLOAD_FIRST_WALKTHROUGH.md) · [sample files and specification](apps/web/public/site-examples/README.md).

Each imported project's **Operations** tab retains the problems register: record report sources, identify missing evidence, assign follow-up and prepare investigation drafts. Problems are browser-local and project/API-scoped. Imported models, inspections/media, native runs and Draft proposals are saved on the API. The pilot does not dispatch work or approve construction. The explicit **Open illustrative demo** button retains the earlier D07 browser story and illustrative catalog workflows.

The demo now measures an explicit **road-only area and fixed road point**, excluding grates/manholes, with sampled depth, simultaneous affected area and duration. Executable analytic reference checks show calculation errors and limits. The SWMM API supports explicit conceptual cleaning, pipe and storage actions with retained input changes and matching-baseline checks. Neither engine establishes validated site flood depths. See the [calculation walkthrough, checked example values and limitations](md/CALCULATION_FOUNDATION.md).

Current API: **v1.5.0**, with additive `/api/site-projects` routes. Uploaded-site comparisons currently support circular pipe diameter changes and 1D network outputs. Native CAD/PDF/GeoTIFF extraction, field calibration and 2D street-flood mapping are not implemented. Earlier illustrative workflow: [guided D07 demo and maintenance workflow](md/MAINTENANCE_DEMO.md); [maintenance integration](contracts/MAINTENANCE_INTEGRATION.md).

---

## 团队分工与架构 (Team Architecture)

本项目由 Tay 与 Jiajie 协作并行开发：

| 模块 / 领域 | 负责人 | 职责与归属路径 |
|---|---|---|
| **后端 / 数据 / SWMM** | **Tay** | `services/api/**`, `simulation/**`, `contracts/**`, `md/BACKEND_SETUP.md`, `md/progress/tay.md` |
| **前端 / 3D / 交互** | **Jiajie** | `apps/web/**`, `md/FRONTEND_SETUP.md`, `md/progress/jiajie.md`, `README.md` |

协作规则与接口标准详见 [团队分工与执行规则 (TEAM_WORKFLOW.md)](md/TEAM_WORKFLOW.md)。

---

## 快速开始 (Quickstart)

### 1. 前端 3D 数字孪生 (Web 3D Twin)

进入前端工作目录并启动开发服务器：

```bash
cd apps/web
npm install
npm run dev
```

浏览器访问：`http://localhost:5173`。

- The default upload workspace requires the updated FastAPI backend at `http://localhost:8000`; native calculations require the installed SWMM toolkit. See the backend setup below. The illustrative browser demo remains an explicit separate option.
- The upload page includes API connection settings. Connection or native calculation errors are displayed without a mock fallback.
- 详细说明请参见 [前端开发与运行指南 (md/FRONTEND_SETUP.md)](md/FRONTEND_SETUP.md)。

### 2. 评委与路演演示演练 (3-Minute Pitch Runbook)

完整 3 分钟路演故事线、台词配搭与界面点击动作请参见：  
👉 [**三分钟演示剧本 (md/DEMO_RUNBOOK.md)**](md/DEMO_RUNBOOK.md)

---

## 核心设计原则

1. **真实物理引擎为准：** 采用 EPA SWMM 5.2 求解非定常水动力学；前端 3D 负责沉浸式场景表现与交互映射，不凭空伪造负荷计算。
2. **证据与假设显式区分：** 现场照片记录的“格栅表面覆盖率（65%）”与水动力学模型的“水力收水折减假设（40%）”分别存储并明确标识来源。
3. **真实模式错误透明暴露：** 真实 API 连接失败或引擎报错时明确在界面呈现错误体，绝不隐蔽回退至 mock 数据。
4. **数字孪生环境对齐：** 3D 场景忠实还原 Taman Kyra 联排住宅街区、沥青道路、绿化带、调蓄水景湖与出水明渠。

---

## TypeScript flood engine (Hong Han)

This repository also contains a browser-based flood simulation engine written in TypeScript, merged in from `github.com/HongHanTan/SDPHack` with its full history.

- **Engine** (`packages/engine`):
  - surface flow on a 2D grid (virtual-pipes shallow-water scheme with a stability guard), coupled to a capacity-routed pipe network with inlets, surcharge, outfall backflow, flap gates and pumps;
  - MSMA-form design storms;
  - mid-run network patching for live what-if;
  - a water balance checked on every run.
- **Legacy UI** (`apps/legacy`): the engine's original three.js interface (Live/Compare modes, x-ray, plan view, intervention panel). The team UI in `apps/web` will replace it.

### Integration roadmap
- Steps 1–3 are done: the histories are merged into this monorepo, the engine's township is rebuilt on the Taman Kyra network, and the `apps/web` 3D twin and dashboard are driven by the engine through adapters.
- The team UI (`apps/web`) opens the upload-first project workspace. Its separate illustrative demo retains Engine, Mock and SWMM API modes.
- `npm run dev:web` is the main way to run it.

### Run (from the repo root)

    npm install
    npm test              # engine + legacy UI unit tests
    npm run dev:legacy    # engine UI at http://localhost:5173
    npm run dev:web       # upload-first main app; illustrative demo is an explicit option
    npm run story         # slow demo-story and effect-drift checks (~15 min)
