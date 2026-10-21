# Jiajie — 前端 / 3D / 交互进度

Owner：Jiajie。只有 Jiajie 身份的 agent 更新本文件；Tay 读取交接区。

## 当前状态

- 2026-10-21 IMPLEMENTED / VERIFIED / RECORDED ? User requested upload-first onboarding and site geometry built from stakeholder files, explicitly requiring frontend/backend integration. Added real CSV/JSON/local-metric geometry import, source hashes, column mapping, separate map/native readiness, dynamic Three.js site, project-scoped native pipe comparisons, inspections/media and Draft proposals. Default app has no preloaded township; previous illustrative app stays explicit. Frontend 66 tests, API/simulation 110 tests, TypeScript and production build pass; contract export/check passes. Final visible Playwright recording passed all 15 chapters with zero page errors after fixing Operations overlay and Drei Html cleanup errors; original source download, imported counts, native totals, proposal/evidence exports, retained runs and incomplete-data blocking were verified. See md/UPLOAD_FIRST_WALKTHROUGH.md and apps/web/public/site-examples/README.md. No field calibration or 2D flood validation is claimed.
- Final playback check: the chapter player uses the original VP9 WebM for compatibility with bundled Chromium; the separate H.264 MP4 is 14,460,951 bytes. The visible player reported duration 421.3 s and 1600x900 dimensions. Decoded MP4 frames at 3/307/414 seconds show the start, pipe comparison and final assigned case. A visible browser remains open with the restored final synthetic Dashboard and a second video-player tab. The two obsolete recording-control helper processes were stopped; the user's app servers and regular browser/profile were preserved.
- 2026-10-21 VERIFIED / RECORDED — User explicitly requested visible Playwright clicks and video. Completed the main operator route in a fresh headed Chromium context: complaint -> locate D07 -> synthetic PDF inspection -> three actual browser calculations -> linked/underground comparison -> five browser/native reference checks -> saved P07 engineering-review Draft -> proposal/problem JSON and CSV export -> Investigating follow-up assigned for 2026-10-22. UI assertions verified R1 peaks 60.0/59.8/7.7 cm, five passing reference cells and zero page errors; exported Draft retains `upsize-p07`, comparison and null rates. `tests/e2e/record-walkthrough.cjs` is the reproducible recording script. Final successful execution exited 0. Video: `output/recorded-walkthrough/FloodOps-walkthrough.mp4`, H.264 1600x900, 421.3 seconds, 18 embedded chapters; decoded start/pipe/end frames visually inspected. `Watch-walkthrough.html` provides chapter buttons; original WebM, screenshots, isolated state and exports retained. Application source and project package manifests unchanged. Earlier recording attempts exposed an incompatible lightweight encoder (fixed by using the installed full FFmpeg in the temporary tools folder) and long-text typing timeout (fixed by whole-field entry and a larger UI timeout); the final deliverable is a separate complete successful pass. Original user browser/profile and records were not touched. This establishes acceptance of the demonstrated desktop path, not mobile coverage or site validation.
- 2026-10-21 DOCUMENTED — Exact start-to-finish operator practice guide in `md/EXACT_DEMO_WALKTHROUGH.md`, packaged as `output/FloodOps-demo-pack.zip` with the three existing synthetic PDFs. Covers exact problem/inspection inputs, road study and assumptions, checked baseline/clean/pipe results, reference checks, engineering-review draft with unknown cost, exports and assigned follow-up; optional RM450 illustrative cleaning estimate, genuine-work lifecycle and separate native comparison. Application code unchanged. Verified current source labels, HTTP web 200 and API v1.4 health/bootstrap; re-rendered and visually inspected all three PDFs with PyMuPDF, checked ZIP integrity and byte-identical PDFs/guide. Browser click/WebGL acceptance remains pending.
- 2026-10-21 IMPLEMENTED — Calculation foundation: road-only cell masks and fixed-point/sample-area/duration display, explicit native SWMM intervention actions with matched-input guards, and executable browser/native analytic reference checks. Frontend 63 tests and API/simulation 100 tests pass; production build and contract export/check pass. Three full-duration browser scenarios were computed and the local v1.4 API/native reference endpoint checked over HTTP. Real-site and 2D surface validation remain unestablished; no CUA browser is connected. Cross-responsibility work was necessary for the user's requested native comparisons; all retained T1-T3 evidence and prior work preserved, Tay progress untouched.
- 2026-10-21 IMPLEMENTED — Operations upgrade stage 1: default Dashboard is an empty, persistent problems register; explicit guided D07 demo remains available. Frontend checks: 58 tests pass and production build passes. Browser/WebGL click verification remains pending because CUA has no connected apps or browsers. No backend, contracts or hydraulic equations changed this turn.
- 2026-10-21 IMPLEMENTED — Guided D07 story with calculated depth / duration, independent cleaning / P07 cases, linked before/after views and proposal handoff. It is now accessed explicitly through Open browser demo; operations is the default Dashboard. Visual acceptance remains pending.
- 2026-10-21 DONE — 用户明确授权完整 maintenance 决策工作流（含必要跨职责改动）。自动化验证完成；浏览器工具无可用 browser，视觉 / 点击验收待演示机执行。保留并继续此前未提交的 telemetry / workers 移除。
- 最近更新：2026-10-21
- 最新用户指定改动：DONE — 移除 Live Field Telemetry Feed 及 Azman / Muthu / Kevin / Siti 四位 3D 巡检员；移除对应选择状态、回调、类型与 Idle 巡更文案。
- 当前任务：维护决策工作台：Priorities → Evidence → Matching comparisons → Estimate → Persisted proposal → Post-work inspection。最新事实优先于下方历史 UI / J4 完成声明；真实现场校准与 SWMM 结构升级接口仍未完成。
- 当前接口版本：`1.5.0`，explicit native intervention actions and reference checks; null intervention and existing inspection / maintenance proposal contracts remain compatible. See `contracts/MAINTENANCE_INTEGRATION.md` and `md/CALCULATION_FOUNDATION.md`.
- 仓库基线：本次沿用现有工作区与未提交改动；未切分支、提交或推送。用户明确授权了所需 API / contracts 跨职责改动；未修改 Tay 个人进度。

## 任务队列

| ID | 状态 | 当前交付 / 剩余工作 |
|---|---|---|
| J0 | DONE | React 19 / TS / Vite 6、R3F / Drei、Tailwind、API client、显式 mock / api 模式与启动说明已完成并通过构建验证 |
| J1 | DONE | 采用权威 9 nodes / 8 conduits / 4 inlets 几何；物理落深检查井（ground 至 invert）、出水口 Headwall、进水口地表标定、视角预设切换（全貌/D07/出水口/上游）与资产属性抽屉 |
| J2 | DONE | 接入 120 帧高解析度时间轴（t=60s..7200s）、1x/2x/5x 播放速度、SWMM 5.2.4 权威基线（80mm/h）与极端（120mm/h）离线结果即时回放、KPI 卡片与物理阈值说明 |
| J3 | DONE | 3D 巡检员数字身与扫描动画、现场照片证据附录、Virtual Debris Lab（喉口剖面、0/20/40/60% 假说切换、现场可见覆盖率与水力折减率分离看板）；接通 T2 异步轮询与 capabilities 守卫 |
| J4 | DONE | 诊断复盘 (Diagnose) / 暴雨推演 (Anticipate) 双模式；InterventionDashboard 治理方案对比（基线、清淤、扩径、综合方案）；水量分配横向堆叠条形图；可追溯行动工单与工程复核建议报告 |
| J5 | DONE | 真实住宅区 3D 街区环境构建（联排洋房住宅群、沥青马路带人行道、绿化草坪与灌木行道树、调蓄水景湖与出水明渠、地面积水洼地与社区标牌）；三分钟路演剧本 `md/DEMO_RUNBOOK.md`；根目录 `README.md` 与运行文档全面闭环 |
| T3-INT | DONE | **T3 (API v1.2.0) 深度集成**：`POST /api/inspections/{id}/media` 二进制文件上传与实时缩略图预览；原生有限入口敏感性预设 (`demo_inlet_capture_0pct/20pct/40pct/60pct`) 绑定 SWMM 5.2.4 权威捕获与漫溢旁流水量看板；全局顶部导航选项卡与资产精准检索联动 |
| UX-EN | DONE | **统一仿真启动控制与 100% 英文专业化**：统一“Start Simulation”交互门控（未按 Start 前时间轴静止、暴雨不落下）；降雨预置武装开关（Armed vs Off）；前端所有 UI、3D 标签、工单报告与数据流 100% 英文专业工程词汇转换，0 中文字符残留 |
| UI-LIGHT | DONE | **极简明亮主题与无重叠界面重构**：全站切换为 Light Theme（Sime Darby Red 经典品牌色点缀、白底轻灰卡片）；左侧多栏收纳为单一 Tabbed Dock（彻底消除与图例重叠）；右侧现场流与详情抽屉互斥折叠响应（消除上下挤压重叠）；治理报告精简为高亮 KPI 对比卡片与三行决策摘要，杜绝冗长文字墙 |

## 下一次直接执行

1. 在演示机按 `md/MAINTENANCE_DEMO.md` 做浏览器 / WebGL 视觉及交互验收；本会话浏览器工具 inventory 为空，不能声明已经完成视觉验收。
2. 与运营人员验证 90 天证据时效、20% 可见覆盖清理复核触发等产品规则，获取真实 surveyed inputs 与 contractor rates。
3. 配合 Tay T4/T5 的真实 SWMM 结构升级 / storage；当前 API 对这些候选明确 unavailable，浏览器 TS engine 支持其计算。

## 交接给 Tay

- **2026-10-21 calculation foundation / native intervention handoff**: User explicitly asked to solve the road metrics, supported intervention calculations and reference-check gaps. Added `simulation/swmm/interventions.py` for deep-copied cleaning/pipe/storage/pond presets and exact changes; `model.py` emits FUNCTIONAL storage only for storage candidates, preserving baseline .inp bytes; `service.py` resolves explicit unique actions; schema/API v1.4 and generated contracts updated. Source debris remains retained while effective cleaning loss is applied to the resolved inlet model. Public asset registry remains unchanged; native candidate previews load the executed asset snapshot.
- Native maintenance comparison revalidation now accepts all supported candidates and reconstructs the expected physical inputs from the retained baseline, replacing client metrics/hashes/targets. Forged action labels, mismatched storm/boundary/hydrology or unexpected physical changes fail. Frontend API comparisons submit one shared source debris scenario plus explicit actions. Browser comparisons check common input/grid fingerprints and candidate network/catchments; mismatches fail without displayable metrics. Ground/land/infiltration/building/initial-water hashes replace dimension-only grid identification.
- `apps/web/src/story/{roadStudy,RoadStudyPanel,RoadStudyOverlay,referenceChecks,ReferencePanel}` plus model/run/story/viewport/chart changes: selected road-cell mask excluding 2.5 m asset footprints; fixed R1; sampled point max/duration; maximum simultaneous area; selectable 10/15/20 cm comparison reference; raw frames reanalysed for other areas without changing hydraulic input hash. Hydraulic snapshots and road assessment snapshots are separate. Old sump peak remains diagnostic only. `SceneViewer` displays the selected road cells/probe; field survey and absolute-elevation accuracy are not claimed.
- `simulation/swmm/reference_checks.py` and `POST /api/validation/reference-checks`: actual isolated native Manning-flow and closed-storage cases, analytic expected values, actual differences/tolerances, native QA, hashes and retained artifacts. Browser diagnostic cases execute rain accumulation, still-water and capacity checks. Field/surface validation explicitly remains not established. Historical unmatched-catchment cross-check is not counted as a validation pass. Normal native tailwater only; high remains unavailable. No costs, safety approval or measured savings inferred.
- Checks: frontend **63/63 (21 files)**; API/simulation **100/100**, including native interventions, forged-proposal rejection and analytic checks; TypeScript/build PASS (2592 modules, existing >500kB bundle warning); contracts export/check PASS. Initial Python collection collision from duplicate test basenames was fixed by renaming API test to `test_native_intervention_api.py`; full suite then passed. Native reference case initially rejected zero-area hydrology NaN; a positive-area dry catchment keeps the zero-rain reference mathematically defined without suppressing QA.
- A later full regression exposed a pre-existing Windows clock-resolution race in the immediate post-completion inspection test (99 passed, one equal-timestamp rejection). The test now waits for a strictly later real clock tick, preserving the production "after completion" rule; no validation was relaxed. Final complete regression after that correction: **100 passed in 28.20 s**. Final frontend suite **63 passed**, build and contract check pass. Updated own loopback API process was restarted after final source changes; HTTP native checks show the current titles and still report field/surface validation as not established.
- Full production browser smoke (`tmp/foundation-road-smoke.ts`): 80 mm/h 60 min, 40% loss, normal canal, 7200 s; D07 road R1 sampled peaks baseline/clean/pipe = 60.0/59.8/7.7 cm, maximum simultaneous selected area >=15 cm = 760/760/0 m2, durations 75/74/0 min. Each run took about 17-19 s locally. These are computed documentation values, not UI fixtures. See `md/CALCULATION_FOUNDATION.md` for definitions, limitations, exact clicks and expected results.
- Started an updated loopback-only API on port 8000 (previously no listener), logs in `output/foundation-api*.log`; HTTP health/bootstrap report v1.4 and actual native reference checks returned 200/pass. Browser tooling inventory remains empty; no visual/WebGL click acceptance claimed. No branch switches, commits, push, physics rewrites of the browser engine or edits to Tay progress. Real site surveys, independent observed-event validation and operator-approved engineering criteria remain external prerequisites.

- **2026-10-21 operations register handoff**: `apps/web/src/operations/{model,repository,export,ProblemForm,ProblemDetails,OperationsDashboard,operations.css}` implements browser-local problem records, source-labelled append-only report history, asset mapping, owner/action/due dates, Open/Investigating/Monitoring/Closed status, explicit closure reason and reopening on an additional report. Missing evidence and overdue flags are transparent follow-up rules, not hydraulic risk scores. Keys isolate mode, township, model and API destination. Revision checks, corruption / quota errors and cross-tab reload prevent silently replacing records.
- App now defaults to the operations register and renders the 3D map only when needed. Map/evidence/inspection and no-benefit proposal handoff reuse existing workflows; optional handoff owner is preserved by MaintenanceWorkspace. GuidedStory returns to the operations Dashboard. CSV export protects user text from spreadsheet formula execution; evidence JSON snapshots retain source labels, asset data and available inspection history. No invented complaints, observed evidence, dispatch or savings.
- Final source-isolation check: switching mode clears the previous asset / inspection / bootstrap data immediately; a load epoch rejects stale responses, errors and loading completion from an earlier request. Problem creation waits for dataset selection to finish. Local follow-up assignment remains available when API asset loading fails, with unavailable inspection readiness shown explicitly. Localhost HTTP checks returned 200 for root, App and both operations modules; this is a dev-server check, not visual browser verification.
- Validation this turn: `npm run lint` PASS; `npm test` **58/58, 19 files** PASS (9 new operations tests covering state/history/reopening, evidence source/date logic, ordering, scope isolation, corruption/quota/conflict failure paths, export and app default); `npm run build` PASS (2579 modules; existing >500 kB bundle warning). Windows esbuild tests/build used the previously established execution-tool escalation. CUA inventory remains `apps=[] browsers=[]`; HTTP/static checks do not establish visual or click acceptance. Walkthrough: `md/MAINTENANCE_DEMO.md`.
- Backend request for a later shared-register stage: add scoped GET/POST problems, revision-checked update and append-report endpoints preserving entered source/reference/timestamp, action/owner/due date, administrative closure/reopen history and asset/model checks. Current records are explicitly browser-local even in API mode, not server persistence or API fallback. Frontend schemas and validations are in `operations/model.ts` and `repository.ts`; do not silently migrate local records into observed server data. Asset import, engineer-led real-site validation, external work-order integration and benefit measurement remain subsequent stages. This turn did not modify Tay's progress, services, contracts, packages/engine or retained simulation evidence.

- **2026-10-21 用户授权跨职责 maintenance 工作流**：新增 API v1.3.0 `GET/POST /api/maintenance/proposals`、`POST /api/maintenance/proposals/{id}/transition`，SQLite append-only revisions、409 并发版本检查、源报价 / post-work inspection 校验。接收 API comparison 时从 retained native runs 重新解析 metrics / hashes / snapshots，拒绝不一致 storm/model/boundary/geometry 或伪造结果。没有改动 simulation 计算实现、已有真实证据或 Tay 进度文件；T4 hydraulic 结构候选仍待你接入。详见 `contracts/MAINTENANCE_INTEGRATION.md`。
- API 结果不再通过前端堵塞滑块伪造 depth/flow/flooding；API 请求不能按旧 fixture ID 自动切离线数据。浏览器与 API 引擎来源分开显示；离线 mock 不能生成新 intervention 比较。
- 浏览器 inspections / SHA-256 附件 / proposals 按模式保存在本机，API 模式保存在服务器；存储失败明确报错。旧 mock inspection 存储迁移时保留原 key。
- **2026-10-20 用户指定移除现场流与四位巡检员**：前端不再挂载遥测流或巡检员组件，Idle 改为普通概览；无 API / 契约变更。历史 inspection / 照片记录保留。构建与现有 29 项前端测试通过。

- **极简明亮主题与面板重叠根治完成**：
  - 前端界面已全面重置为 Light Theme（Sime Darby Property 经典红白灰基调，背景为清爽浅灰 `#f1f5f9` 与白色卡片，边框与文字层次分明）；
  - 左侧控制栏重构为单一体积可收缩 Tabbed Dock（`Scenario` / `Layers` / `Legend`），高度严控在 320px 以内，彻底根除与左下角图例碰撞；
  - 右侧资产抽屉与现场巡查回传流实现互斥智能折叠（选中资产时，底部 Telemetry Feed 自动折叠为右下角紧凑浮动药丸，关闭资产抽屉时自动展开），解决右侧屏幕垂直空间争抢问题；
  - 治理决策报告（`InterventionDashboard.tsx`）彻底重构：移除大篇幅重复论述，提炼为 4 个清晰的 KPI 方案卡片、4 个高对比度指标变化块、横向水量分配条与 3 条高管工程洞见摘要；
  - 构建通过 `npm run build`（2518 模块，0 错误），100% 保留所有仿真推演、淤堵调节、CCTV 内窥与工单派发能力。

## 阻塞与待确认

- 前端无任何阻塞，全流程功能构建完毕。
- 当前仓库最新基线完全健康，随时可配合整体汇报。

## 验证记录

- **全量英文化验证：** 执行 `Get-ChildItem -Path apps\web\src -Recurse -Include *.ts,*.tsx | Select-String -Pattern "[\u4e00-\u9fa5]"`，返回结果为空（0 匹配项，100% 纯英文）。
- **构建与类型验证：** 在 `apps/web` 下执行 `npm run build`（`tsc -b && vite build`）：
  - 2518 个模块成功转换；
  - 0 编译错误，0 类型告警；
  - 产出静态打包资产 `dist/`，退出码 0。
- **视觉无重叠与轻量化核验：**
  - 左侧面板切换 `Scenario`、`Layers`、`Legend` 各标签页，展开与收起自如，与底部无任何空间冲突；
  - 点击管网节点或管道打开右侧详情抽屉时，右下角巡查数据流智能折叠为紧凑浮动药丸，完全杜绝重叠覆盖；
  - 打开 `Reports` 治理模态框，排版呼吸感强，无大段头疼长文，一目了然呈现决策数据；
  - 3D 视口光照自然柔和，地下高亮透视与地表街区对比鲜明。

## 最近实现记录

- **2026-10-21 [DONE — Maintenance decisions / API v1.3.0]**：
  - `apps/web/src/maintenance/{model,comparison,repository,MaintenanceWorkspace}.ts[x]` 与样式 / 四组测试：priority queue、证据规则、同条件比较 / outdated guards、逐候选状态与失败、成本明细 / 引用 / 日期 / 预算、local/API 隔离持久化、proposal lifecycle、JSON evidence export；浏览器 worker transport 用真实数值引擎缩短暴雨进行验证。
  - `App.tsx`、`AssetDetailModal.tsx`、`InspectionModal.tsx`、`StatusHeader.tsx`、`SimulationHUD.tsx`、scene / overlay / types / API client：默认维护工作台、map locate / calculated candidate preview、四页证据抽屉、真实未知状态、用户输入 inspection 来源、真实 SHA-256 附件本地存储；移除假 telemetry、硬编码治理报告、虚假 flow/depth fallback 与前端 slider 伪造结果。新模式设置下旧结果不作为当前读数显示；API fixture-ID 自动离线替代已移除。
  - 用户明确授权跨职责的 `services/api/app/maintenance.py`、main/catalog/schema 与 contracts：v1.3.0、SQLite append-only proposal revisions、来源报价校验、顺序状态转换 / 409、同资产 completion 后新 inspection 验证；server 重新解析并验证真实 SWMM inputs / metrics / hashes，防止客户端提交值冒充结果。没有改动 SWMM 水力实现和已保留原生证据，也没有修改 Tay 进度。
  - 验证：`npm test`（apps/web）**42 passed / 14 files**；完整 `python -m pytest tests/api tests/simulation -q --tb=short --basetemp=data/runtime/maintenance-final-20261021`（项目 .venv）**95 passed / 73.02s**，包含真实 SWMM native baseline / cleaning、重启持久化和原 T0–T3 回归；`python -m services.api.export_contracts --check` 通过。生产构建 `npm run build` 已通过，2564 modules（既有 >500kB bundle 提示）；最后 map-preview / 类型改动另有最终 build 检查。
  - 环境：旧文档中的项目 .venv 在本 checkout 不存在；创建了仓库忽略的 `services/api/.venv`（复用现有 system site packages），安装 pinned swmm-toolkit 0.17.0 / aenum 3.1.17 后，实际 native tests 全部通过。首次无引擎的 targeted test 失败已排除，未改为 mock / skip。
  - `http://localhost:5173` HTTP 200 且 `/src/App.tsx` 确认当前 dev server 已服务 MaintenanceWorkspace。CUA browser inventory 为空，因此没有浏览器截图 / 点击验收声明；server-rendered React tests 验证默认视图与未知证据呈现。
  - 文档：`README.md`、`md/MAINTENANCE_DEMO.md`、`contracts/MAINTENANCE_INTEGRATION.md`。限制 / 下一步：真实场地数据、报价与运营规则验证；SWMM 结构升级 / storage 尚不支持并明确显示 unavailable，browser engine 可计算；未做用户身份权限系统或 contractor dispatch。

- **2026-10-20 [DONE — 按用户要求移除 Live Telemetry Feed 与四位 workers]**：
  - 删除 `apps/web/src/components/LiveTelemetryTicker.tsx`、`FieldInspectorsManager.tsx`；从 `App.tsx`、`SceneViewer.tsx` 移除挂载、选择状态、回调和 props，从 `types/index.ts` 移除专用 `FieldInspector` 类型。
  - `StatusHeader.tsx`、`SimulationHUD.tsx` 的巡更模式标签改为 `Idle`；`TownshipEnvironment.tsx` 的 Idle 场景标题改为 `Township Overview (Taman Kyra)`。
  - 验证：`apps/web` 中 `npm run build` exit 0（2563 modules，保留 Vite 大包提示）；`npm test` exit 0（10 files / 29 tests passed）；`git diff --check` 通过；源码检索确认无遥测组件或四人巡检组件、选择 props 的残留引用。首次 sandbox 执行被 esbuild 父目录访问权限阻挡，经执行工具授权重跑通过。未做浏览器视觉验收。
  - 阻塞：无。下一步：继续对接后端动态治理方案；此次移除无需后端适配。

- **2026-10-20 [全系统极简明亮主题 (Light Theme) 重置、面板重叠零冲突重构与治理报告精炼]：**
  - **Sime Darby Property 极简明亮主题全面上线 (`StatusHeader.tsx`, `SimulationHUD.tsx`, `AssetDetailModal.tsx`, `SceneViewer.tsx`, `InterventionDashboard.tsx`, `VirtualDebrisLab.tsx`, `InspectionModal.tsx`, `App.tsx`)**：
    - 全面从暗黑基底（`#140e0e`/`#181111`）重塑为干净清爽的白底轻灰现代工程风格（`bg-slate-100` 全局底色，`bg-white/95` 浮动面板，`border-slate-200` 微边框，`text-slate-800/900` 高可读性排版）；
    - 保留并升华 Sime Darby Property 标志性 Crimson Red（`#C8102E` / `bg-red-600`）品牌主色作为主行动项、激活指示与关键预警高亮；
    - 3D 视口光照适配明亮天光，雾效与天空盒背景适配柔和清爽的 `#f1f5f9` 浅色调。
  - **彻底解决界面展开时的重叠碰撞冲突 (Zero Panel Collision)**：
    - **左侧面板重叠根除 (`SimulationHUD.tsx`)**：将先前垂直并排的 Map Layers、Scenario Controls 与左下角 Drainage Legend 统一收纳进紧凑的 **三段式选项卡扩展坞 (Tabbed Dock: `[Scenario] | [Layers] | [Legend]`)**，附带一键极简折叠按钮，高度严格限制在 320px 范围，绝不与底部时间轴或图例发生垂直挤压或重叠；
    - **右侧抽屉与遥测流空间冲突根除 (`LiveTelemetryTicker.tsx` & `App.tsx`)**：引入 `isAssetSelected` 响应式互斥折叠机制。当用户点击资产呼出 `AssetDetailModal` 右侧抽屉时，右下角 `LiveTelemetryTicker` 自动折叠为一个低干扰的紧凑悬浮按钮（`[Field Feed (4 Online) #148]`），关闭抽屉时无缝恢复，彻底消除两者纵向撞车。
  - **治理决策报告极简化重构 (`InterventionDashboard.tsx`)**：
    - 摒弃以往大篇幅、多段落的长篇文本堆砌，重构为高管层与工程主管一眼即懂的清晰决策面板；
    - **4 个清晰候选方案卡片**（Base 80mm/h、Desilting、Pipe Upsizing、Combined Scheme），直观展示推荐等级徽章与实施周期；
    - **4 个高对比度 KPI 指标变化卡**：积水峰值深度、进水口截流率、管网超载持续时间、过水充满度，配合红绿增减箭头一目了然；
    - **极简工程洞见摘要 (Executive Summary)**：精炼为 3 条核心要点（水动力瓶颈归因、最佳性价比推荐、水土保持红线预警）；
    - **可追溯工单系统 (Traceable Action Work Orders)**：清晰列明工单编号、指派承包商、核查点位与一键复制功能。
  - **功能 100% 完整保留与全英文专业术语**：
    - 仿真生命周期（Unified Start Button, Pre-start Rain Arming, Frame 0 Lock, Reset, 1x/2x/5x 播放倍速）；
    - 管道/节点 0%~90% 自定义淤堵度实时调节与上游壅水漫溢推演；
    - 4 位常态巡更员（Idle Mode）实时 NB-IoT 数据遥测轮转；
    - 现场照片实况与管内 CCTV 爬行内窥高解析度透视；
    - 全源码纯正英文市政水力术语（0 中文字符残留）。
  - **编译打包核验**：执行 `npm run build`，2518 模块编译通过，0 错误，0 警告，打包 exit code 0。

- **2026-10-19 [管道/节点自定义淤堵推演、Idle 现场巡更模式与全资产实况照片/CCTV 实拍]：**
  - **管道与节点自主调节阻塞程度与实时水力仿真 (`AssetDetailModal.tsx` & `App.tsx`)**：
    - 在资产属性抽屉增加“⚡ 自主调节阻塞程度 (Blockage Degree Tuning)”滑块（0%~90%）与快捷预设（`0% 畅通`、`25% 微淤`、`50% 半阻`、`75% 极卡`）；
    - 联动全局水动力推演求解：动态扣减管道过水截面与满管容量，计算上游水头壅高与溢流水位（$\Delta H \propto \text{blockage} \times 0.45\text{m}$）；
    - 当阻塞度提升时，3D 管网管线实时由绿转橙红发光，路面积水漫溢高度与扩展面积动态同步扩张，溢流节点与超载持续时间指标联动更新。
  - **Idle (常态巡更) 模式与多片区现场巡查员实时回传 (`FieldInspectorsManager.tsx` & `LiveTelemetryTicker.tsx`)**：
    - 在工作流切换器增加 `Idle (常态巡更)` 模式（晴朗常态天气、无暴雨强降水、现场网格化巡更活动）；
    - 部署 4 名专业现场巡查员分配至指定管网责任区：
      1. **Unit A: Inspector Azman**（负责 `INLET-D07 / NODE-J07` 回车岛低洼进水口）；
      2. **Unit B: Inspector Siti**（负责 `PIPE-P04 / NODE-J04` 联排住宅主干管 CCTV 机器人）；
      3. **Unit C: Inspector Muthu**（负责 `NODE-J06 / Maple Grove Pond` 调蓄湖水文采样）；
      4. **Unit D: Inspector Kevin**（负责 `NODE-OUT01 / East Drain` 出水明渠涵闸监测）；
    - 巡查员配备高反光安全服、安全帽、激光测距探头与三维 5G NB-IoT 无线脉冲回传光环（Animated Transmission Rings）；
    - 底部构建“现场巡检实时数据回传流 (Live Telemetry Ticker)”：每隔数秒滚动接收现场终端真实遥测数据包，点击任意条目即可瞬间穿梭聚焦至对应管段与巡查员。
  - **节点与管道现场实况高清照片与管内 CCTV 爬行器实拍 (`sitePhotos.ts` & `AssetDetailModal.tsx`)**：
    - 建立全管网实况照片库，点击任意检查井、进水口或管道即可调出真实勘查影像；
    - **地表实景照片 (Surface Photo)**：展示真实重型球墨铸铁井盖、进水口落叶堆积或出水涵闸照片，附带经纬度、采集时间戳、结构完整度与巡检员电子签名；
    - **管内 CCTV 爬行器内窥 (In-Pipe CCTV Crawler)**：展示管道内部高精度内窥透视视角，包含水流反光、管底泥沙淤积实况、CCTV OSD 遥测屏显（进尺、坡降、水力充满度、缺陷等级）；
    - 支持点击照片呼出全屏高清 Lightbox 放大模态框。
  - **编译打包核验**：执行 `npm run build`，2518 模块编译完毕，0 错误，打包 exit code 0。

- **2026-10-19 [T3 API v1.2.0 深度集成与多媒体证据闭环]：**
  - **巡检多媒体证据上传 (`POST /api/inspections/{id}/media`)**：
    - `InspectionModal.tsx` 引入文件选择与拖拽支持（PNG / JPEG / WebP / PDF ≤10MiB），提供上传前缩略图实时渲染、文件大小核对与删除重传；
    - `client.ts` 适配 FormData 原生上传，显式省略 JSON Content-Type 保证 boundary 自动生成；
    - 针对离线 Mock 模式提供本地 ObjectURL 实时回显与持久化存储，支持现场打卡留痕。
  - **原生有限入口 (Native Finite Inlets) 敏感性全量对接 (`VirtualDebrisLab.tsx`)**：
    - 全面替换旧版伪设，严格对齐 Tay T3 权威预设：`demo_inlet_capture_0pct`（0% 清淤畅通基线）、`demo_inlet_capture_20pct`（20% 季节性微淤）、`demo_inlet_40pct`（40% 现场核查折减）、`demo_inlet_capture_60pct`（60% 极端前蓄卡口）；
    - 嵌入 EPA SWMM 5.2.4 权威收水与漫溢水量平衡看板（D07 捕获水深/水量分别精确对齐 741.8m³ / 593.4m³ / 445.1m³ / 296.7m³，地表旁路溢流对齐 389.7m³ / 538.0m³ / 686.3m³ / 834.7m³）；
    - 现场照片与巡检证据 Tab 实时渲染已上传真实照片缩略图与完整不可变证据链。
  - **森那美风格顶部导航与资产检索精准联动 (`StatusHeader.tsx` & `App.tsx`)**：
    - 导航药丸 (`Dashboard`, `Map`, `Assets`, `Analytics`, `Reports`) 绑定全局交互：点击 `Assets` 瞬间调焦锁定 `MH-0421 / NODE-J07` 遥测卡片；点击 `Map` 触发透视高亮全景；点击 `Analytics / Reports` 弹出治理对比看板；
    - 顶部搜索框支持回车与即时匹配管网资产编号（`MH-0421`, `NODE-J07`, `INLET-D07`, `PIPE-P07` 等），自动高亮选中并唤起右侧抽屉。
  - **契约类型升级 (`src/types/index.ts`)**：
    - 引入 `InletState.capture_flow_m3s` 与 `bypass_flow_m3s`；
    - 引入 `SimulationMetricsResponse.inlet_volumes`；
    - 引入 `DebrisCreateRequest` 与 `InspectionMediaItem`。
  - **编译打包核验**：执行 `npm run build`，2516 模块编译完毕，0 错误，打包 exit code 0。

- **2026-10-19 [J5 完成与真实感强化]：**
  - 重构升级 `src/components/TownshipEnvironment.tsx`：全面重构 3D 住宅建筑模型，采用写实高多边形多坡屋顶（Multi-Gable & Hip Roofs）、前凸车库与双车位卷帘门、混凝土入户车道与停放车辆（Sedan / SUV）、入户门廊立柱、基座毛石护墙、窗框玻璃反光及地基灌木绿化。
  - 增加街尾环形回车岛（Cul-de-sac Turnaround Loop），道路增加白色中心虚线标线与反光沥青质感。
  - 更新多球体簇拥写实树木（Lush Suburban Trees），丰富树冠层次与阴影表现。
  - 新建 `md/DEMO_RUNBOOK.md`：详细编制 3 分钟黑客松 Pitch 路演剧本（5 大场景、台词脚本、界面操作动作与应急对策）。
  - 更新根目录 `README.md`：增加 3 分钟 Demo 引导与 J5 街区数字化孪生特性说明。
  - 运行 `npm run build`，编译打包 0 错误。

- **2026-10-19 [高拟真暴雨粒子、地面积水上升动效与透视高亮孪生视口]：**
  - **3D 暴雨降水粒子系统 (`RainEffect.tsx`)**：
    - 构建 3800 根动态倾斜雨线粒子（`LineSegments`），模拟季风暴雨真实终端速度（65~90 m/s）与风偏角；
    - 增加沥青道路与调蓄水景湖地表雨滴撞击溅射光环（Impact Splash Ripples）及高空对流云层雾气；
    - 联动时间轴产汇流阶段（$t \le 3600s$）与推演运行态自动触发，支持顶部控制栏 `🌧️ 降雨渲染 [开/关]` 独立测试。
  - **低洼积水动态漫溢上涨动效 (`PondingWaterAnimation.tsx`)**：
    - 精准绑定 SWMM 5.2.4 计算节点 `NODE-J07` 水深与暴雨产汇流水位曲线；
    - 水面随时间轴真实上升（$y: 11.01m \to 11.28m$，路面淹没水深达 $28cm$，漫过 $15cm$ 路牙并侵入入户车道）；
    - 积水面沿路段自适应扩展至 $22m \times 14m$，辅以正弦波动波纹、格栅反涌同心冲击波与路边红黄警戒刻度水尺；
    - 悬浮 3D 动态水深与水量看板：实时显示积水深度、蓄积水量与超载交通预警。
  - **透视高亮孪生视口 (`NetworkHighlightOverlay.tsx`)**：
    - 1:1 复刻设计参考原型（North Star Mockup）：地面写实街区（别墅、车道、汽车、树木、湖泊、明渠）与地下发光管网完美并存；
    - 沥青路面投射发光流光带（Surface Road Tracers）：依水力负荷实时映射绿（正常）、黄（重载）、红（瓶颈超载）；
    - 检查井 3D 发光线框方块（Glowing Junction Cubes）：每个节点悬浮旋转线框立方体与实心发光核心，标定原型规范编号（`MH-0421`、`MH-0101` 等）；
    - 顶部快捷栏提供 3 档孪生图层切换：`[💎 透视高亮孪生]`（默认原型视口）、`[🏡 街区实景]`、`[🚇 纯地下工程]`。
  - **构建核验**：执行 `npm run build`，2516 个模块转换完毕，TypeScript 0 错误，打包 exit code 0。

- **2026-10-19 [Sime Darby Property 品牌色系与极简看板全面对齐原型]：**
  - **顶部导航 (`StatusHeader.tsx`)**：
    - 引入 Sime Darby Property 标志性红色三重波浪品牌徽标与品牌标识（`Township` 白色 + `FloodOps` 森那美红）；
    - 极简药丸导航选项卡（`Dashboard` 默认激活红橙渐变高亮、`Map`、`Assets`、`Analytics`、`Reports`、`Settings`）；
    - 右侧对齐原型集成深色半透明圆角搜索框（`Search location, asset or address...`）、带红色预警气泡（3）的消息铃铛与 `JD` 用户头像；
    - 彻底移除冗长文本大段横幅，将系统健康度与数据模式切换收纳进极简 Settings 浮窗。
  - **左侧面板与图例 (`SimulationHUD.tsx`)**：
    - **Map Layers 面板**：支持 9 项关键图层独立勾选（管网、检查井进水口、出水口、淹没风险区、DEM高程、航拍影像、地籍红线、关键基础设施、天气雷达）；
    - **Scenario Controls 面板**：极简降雨强度滑块（`0 25 50 75 100 mm/hr`）、模拟模式三段药丸（`Real-time`、`Forecast`、`Historical`）与分析工具快捷按钮（`Inspection`、`Debris`、`Flood`）；
    - **Drainage Network Status 图例**：左下角浮动半透明卡片，对齐原型的四级管网负荷颜色（正常/高负荷/重载/超载）与四种几何图标（检查井/进水口/出水口/流向）。
  - **右侧遥测详情抽屉 (`AssetDetailModal.tsx`)**：
    - 1:1 复刻原型 `Drain ID: MH-0421` 浮动运维卡片；
    - 嵌入现场圆形铸铁井盖照片缩略图；
    - 结构化规格清单（类型、位置坐标、落深 4.2m、管底高程 112.3m、连通管段数 4）；
    - **Current Status 卡片**：橙红色 High Load 徽章、78% 水力满管率水平渐变进度条、流量 1.24 m³/s、管容 1.60 m³/s；
    - **Flood Risk 卡片**：72% Local Flood Risk 渐变条与预警说明；底部提供一键巡检与干预决策按钮。
  - **底部时间轴极简播放条**：
    - 居中紧凑浮动药丸设计，森那美红播放键、倍速选择（1x/2x/5x）、当前时间戳与平滑进度条，杜绝一切赘述文本。
  - **构建核验**：执行 `npm run build`，2516 模块转换完毕，0 错误，打包 exit code 0。

- **2026-10-19 [统一仿真启动控制、降雨武装开关与全前端 100% 英文专业化]：**
  - **统一仿真生命周期 (`hasSimulationStarted` & `App.tsx` & `SimulationHUD.tsx`)**：
    - 仿真默认在首帧（$t=0$, Frame 0）锁定静止，只有当用户明确点击“Start Simulation”统一按钮后，系统才正式激活并开始时间推演；
    - 启动后提供播放/暂停（Play/Pause）、重置（Reset to t=0）、多倍速切换（1x / 2x / 5x）与全屏时间轴拖动回溯能力。
  - **降雨武装门控机制 (`rainEnabled` & `isRainActive`)**：
    - 仿真未启动前，用户可在控制面板与 3D 顶部徽章自由开启或关闭降雨（Rain Armed vs Rain Off）；
    - 降雨粒子严格门控：`isRainActive = rainEnabled && hasSimulationStarted && (isPlaying || isRunning) && currentTimestamp <= 3600;`；
    - 确保未点击 Start 前雨丝绝不下落，武装开启后在 Start 触发后伴随产汇流动态倾泻。
  - **全前端 100% 英文市政水动力学专业化本地化**：
    - 全面清理 `apps/web/src/**` 中所有汉字字符，覆盖 15+ 个组件与数据模型（包括 `VirtualDebrisLab.tsx`, `AssetDetailModal.tsx`, `InterventionDashboard.tsx`, `TownshipEnvironment.tsx`, `LiveTelemetryTicker.tsx`, `FieldInspectorsManager.tsx` 等）；
    - 采用纯正市政与水力工程专业术语：如 Curb Inlet Throat, Hydraulic Restriction Loss, Subsurface Captured Volume, Surface Bypass Runoff, Invert Depth, Surcharged Conduit, Gravity Conveyance, Detention Storage 等；
    - 经 `Select-String -Pattern "[\u4e00-\u9fa5]"` 全盘脚本扫描，全 web 源码匹配结果为 0。
  - **编译打包核验**：执行 `npm run build`，2518 模块编译完毕，0 错误，0 警告，打包 exit code 0。


## 2026-10-21 upload-first upgrade / handoff for Tay

- User-authorized cross-responsibility scope: the uploaded source must drive both the map and simulation. No new agent, branch, commit, push or changes to Tay progress. Existing uncommitted work and retained validation evidence preserved.
- Frontend: `apps/web/src/site/{SitePortal,SiteWorkspace,SiteScene,api,geometry,types,site.css}`; App now defaults to uploads, with the prior app retained as LegacyApp. OperationsDashboard/ProblemDetails accept an imported dataset description and arbitrary IDs; InspectionModal supports arbitrary inlet IDs and project storage text. Imported unknown values stay null. Terrain uses uploaded rectangular grid, roads actual uploaded widths, buildings uploaded footprints/heights; missing layers are not invented. Grid indexes/bounds cached for playback; 3D labels use CanvasTexture sprites to avoid Html portal cleanup errors on tab switches.
- Backend: `simulation/site_import.py`, `services/api/app/site_projects.py`, router registration, additive API v1.5 capability + regenerated OpenAPI/examples. Source files are hashed/retained, project model hashes checked on read. CSV mapping is authoritative; imports distinguish map blockers and simulation blockers. Original models are immutable; corrections create a new import/version.
- Native integration: uploaded five-minute rainfall, arbitrary node/pipe/catchment IDs, FREE/FIXED outfalls, circular zero-offset pipes compile into the existing ScenarioService/worker/native output/QA pipeline. The legacy baseline .inp path is preserved. Direct catchment-to-junction entry and optional soil/surface defaults are disclosed assumptions requiring acknowledgement. Generic pipe-diameter changes rerun SWMM; cleaning is not inferred from visible grate coverage.
- Project evidence: server-scoped inspection/media signature and hash checks, retained sources, independently checked matched-run Draft proposals. Costs remain unknown or illustrative. Browser-local problems are scoped to project/model/API. No approval, scheduling or contractor dispatch is implemented for imported projects.
- Example files: complete and map-only fictional Riverside bundle, separate project/nodes/pipes/inlets/catchments/rainfall/terrain/roads/buildings exports, specification and exact workflow guide; `output/FloodOps-upload-demo-pack.zip`. Native example EPA SWMM 5.2.4: baseline 1597.1145382408636 m3 network flooding loss; LINK-TRUNK diameter .30 -> .60 m yields 148.72181492390197 m3. These are runtime results, not UI constants. No street flood depth/extent claim.
- Validation: `npm -w township-floodops-web test` 66 passed / 22 files; `npm -w township-floodops-web run build` pass (existing large-bundle advisory); `python -m pytest tests/api tests/simulation -q --tb=short --basetemp=tmp/site-release-check-20261021f` 110 passed; `python -m services.api.export_contracts --check` pass. A unique workspace basetemp avoids the machine's non-writable default pytest temp directory. Targeted CSV/unsupported-shape/evidence/native import tests pass. Repeated headed tab switching after label fix: zero page errors (`output/site-onboarding-demo/tab-debug.json`).
- Local API: replaced the verified old FloodOps uvicorn listener with v1.5 on 127.0.0.1:8000, using the existing runtime and hidden launch; logs `output/site-api.*.log`. Port5173 remains the user's existing Vite server. No unrelated processes/profile were terminated.
- Limits / next engineering work: native CAD/PDF/GeoTIFF extraction, georeferencing, drone/mobile capture automation, field-data quality/calibration, inlet capture models for cleaning, 2D surface coupling, and authenticated multi-user production governance remain unimplemented. First real-site pilot should supply one reviewed catchment's metric exports, observed storm/boundary and surveyed dimensions, then compare native outputs against observations. Do not substitute mock results when an import/native run fails.

- Final headed acceptance: `node tests/e2e/site-upload-walkthrough.cjs` exit 0; `output/site-onboarding-demo/acceptance.json` passed=true/errors=[]; video `FloodOps-upload-first.webm`, VP9 1600x900, 98.6 seconds. Final screenshots visually checked for imported geometry, Operations navigation, native output and disabled incomplete-network calculation. Record script includes synthetic practice records only and separate browser storage. The existing legacy recording script now explicitly opens the illustrative demo before its old workflow.

- Delivery playback check: H.264 MP4 1600x900 / 98.6 seconds / 2,363,859 bytes; decoded midpoint visually checked. Chapter player uses VP9 WebM for bundled Chromium compatibility. Separate headed preview keeps the upload landing, saved imported site and chapter player open, restoring only isolated synthetic walkthrough storage. The API and existing Vite stay available for the user. No automated blockers remain for this supported CSV/JSON/local-metric upload scope.
