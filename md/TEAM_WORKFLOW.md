# Township FloodOps — Tay / Jiajie 并行开发手册

> 最后确认：2026-10-19。**Tay：后端、数据、SWMM；Jiajie：前端、3D、交互。**
> 建立本文件时，仓库只有三份项目规划资料，没有应用代码。以下是执行计划，不代表功能已经实现。

## 1. 每次怎样使用

在这个仓库启动支持读取根目录 `AGENTS.md` 的 coding agent，输入：

```text
我是 tay，继续我的任务。
```

或：

```text
我是 jiajie，继续我的任务。
```

Agent 应自动读取本手册、自己的进度文件及对方交接区，检查当前代码，选择本人的下一个任务并执行、验证、记录。用户无需每次重新解释整个项目。若使用的 agent 不会自动读取 `AGENTS.md`，首次加一句：`先阅读 AGENTS.md 和 md/TEAM_WORKFLOW.md，按我的身份继续。`

个人续接记录：

- Tay：[`progress/tay.md`](progress/tay.md)。
- Jiajie：[`progress/jiajie.md`](progress/jiajie.md)。

这些文件必须随代码同步到另一人的 checkout；只有本地文件、未共享的 branch 或聊天记录，对方的 agent 看不到。

## 2. 已阅读的资料与共同目标

| 原始资料 | 主要作用 |
|---|---|
| [Idea and Pitch Story](Township_FloodOps_Idea_and_Pitch_Story.md) | Diagnose / Anticipate / Act 三个产品支柱、三分钟 pitch、MVP 边界 |
| [System Architecture and Tech Stack](Township_FloodOps_System_Architecture_and_Tech_Stack.md) | React + R3F、FastAPI、SWMM、数据流、工程检验要求 |
| [Feature Flow and Module Breakdown](Township_FloodOps_Feature_Flow_User_Flow_Module_Breakdown.md) | F01–F08 功能、M01–M15 模块、用户流程和验收 |

**最终共同交付：** 一个明确标记为 illustrative / synthetic 的住宅区，用户能选 inlet → 保存 inspection → 选择 debris / rainfall 假设 → 实际运行 SWMM → 在同一套 3D asset 上回放结果 → 比较清理与管道升级 → 追溯证据和提出维护 / 工程复核行动。

先完成这条闭环，再扩展。第一版以约 8–12 个节点、8–15 条管线、3–5 个 inlet、一个 outfall、一个 inspector 为目标。至少比较 baseline、restricted inlet、cleaned 三种情景，再加入 upsize；storage 随后补齐。首版可用 SQLite 与本地文件存储，保留迁移到 PostgreSQL / PostGIS / S3 的边界。CV、实时天气、认证、多租户、自建 CFD 均不阻塞 MVP。

## 3. 两人的责任

| 工作 | Tay 的交付 | Jiajie 的交付 |
|---|---|---|
| 网络与资产 M03 | 权威 asset ID、连接关系、坐标、模型版本、synthetic seed | 根据 API / fixture 绘制资产、点击选择和详情 |
| 场景与调度 M04 | 校验输入、保存不可变 run、状态、错误、结果查询 | 雨量 / 时长 / tailwater 控件、提交与轮询、失败提示 |
| SWMM M05 | `.inp`、真实执行、版本与日志、结果解析 | 消费结果；动画只负责表现 |
| 结果映射 M06 | 计算物理指标、单位、状态阈值与说明 | 3D 图层、图例、时间轴、曲线和 KPI |
| Inspection M07 / M08 | inspection / media 存储、历史、provenance | inspector 动画、表单、上传、证据历史与回放 |
| Debris / Lab M09 / M10 | mass balance、假设版本、restriction scenario 与 SWMM 接入 | inlet close-up、控制器、时间轴、示意粒子与假设提示 |
| Diagnosis M11 | 同一模型下的历史 / synthetic replay 和假设比较数据 | Diagnose / Anticipate 模式、数据缺口与比较界面 |
| Intervention M12 | 克隆输入、clean / upsize / storage 重跑、比较指标 | 选项、before / after、可追溯的 proposed action 展示 |
| 运行与验证 | API / 模拟测试、Docker、后端启动与排错说明 | 前端构建与交互验证、联调、三分钟 demo 路径 |

职责以交付边界划分，不按“某人独占整个 inspection 功能”划分。每个完整功能都有前端与后端两侧任务。

## 4. 文件归属：同时开发时避免互相覆盖

以仓库根目录为项目根，不再创建额外的 `floodops/` 外层目录。原始资料有两种目录示例，这里统一如下：

| Owner | 可自主创建 / 修改的路径 |
|---|---|
| Tay | `services/api/**`、`simulation/**`、`models/**`、`data/**`、`infra/**`、`contracts/**`、`tests/api/**`、`tests/simulation/**` |
| Tay | `md/BACKEND_SETUP.md`、`md/MODEL_ASSUMPTIONS.md`、`md/progress/tay.md`、根 `.gitignore`、后端相关 CI |
| Jiajie | `apps/web/**`（含 package / lockfile / UI fixtures / API client / 前端测试）、`tests/e2e/**` |
| Jiajie | `md/FRONTEND_SETUP.md`、`md/DEMO_RUNBOOK.md`、`md/progress/jiajie.md`、根 `README.md`、前端相关 CI |
| 协作规则 | 根 `AGENTS.md`、本手册及原始三份资料：仅在用户要求调整分工 / 规格或确有共同规则变更时修改，并写清交接 |

后端在 `simulation/` 内放 SWMM / debris / scenario 的计算逻辑，API 调用它；不要同时在 `services/api/app/services/` 再实现第二套模型。前端依赖与 lockfile 放 `apps/web/`，后端依赖放 `services/api/`，避免两人同时维护根 package 配置。未来的 CI 分为 `frontend.yml` 和 `backend.yml`。

## 5. 从第一天就能并行的方式

1. **两边立即开工。** Tay 做 T0 / T1；Jiajie 做 J0 / J1，不必等待 API server 或 SWMM 完成。
2. **本节与第 6 节是初始接口约定。** Tay 在 T0 将其落成 `contracts/openapi.json` 和 `contracts/examples/`。这些文件发布前，Jiajie 可按下面的形状先建自己的 types / mock。
3. **Jiajie 提供显式数据模式。** 如 `VITE_DATA_MODE=mock|api` 与 `VITE_API_BASE_URL=http://localhost:8000`。Mock 页面始终显示“开发 mock，非 SWMM 结果”；真实 API 失败不自动降级。
4. **Fixture 只在 UI 层。** Jiajie 的临时样例放 `apps/web/src/mocks/`；Tay 的 seed、契约样例与真实 SWMM 输出放自己的路径。收到后端样例后在前端适配，避免相互修改同一个文件。
5. **Tay 尽早交付一组真实结果。** 不等所有后端功能齐全，先给 assets + 一个 run + frames + metrics，Jiajie 立即接入。
6. **接口变更由 Tay 维护契约。** 已被前端消费的字段优先向后兼容；破坏性变更先在自己的交接区写出字段、原因、迁移方法和版本，待对方同步确认后移除旧字段。等待期间继续其他任务。

端口约定：前端 `5173`，API `8000`；Tay 配置本地 CORS，Jiajie 配置 API base URL。原始 docs 中 JSON 只是示例；双方实现统一使用下节命名，不混用 `simulation_id` / `run_id`、`pipe_id` / `conduit_id`。

## 6. 初始接口契约 v1

以下是需要在 T0 实现、补齐为可校验 schema 的约定，当前没有运行中的 API。`contracts/openapi.json` 发布后是实际接口的唯一机器可读来源；新增字段同步更新样例与交接，避免本节与实现悄悄分叉。

### 6.1 通用规则

- JSON 使用 `snake_case`；统一标识符：`township_id`、`model_version_id`、`asset_id`、`node_id`、`inlet_id`、`conduit_id`、`inspection_id`、`debris_scenario_id`、`storm_id`、`run_id`。
- 初始 `township_id = taman_kyra_demo`，`model_version_id = taman_kyra_synthetic_v1`；保留重点 inlet `INLET-D07`，其 `node_id = NODE-J07`；其他资产 ID / 拓扑 / 坐标由 Tay 的 seed 发布。Jiajie 可先画临时 layout，切换 API 后必须用返回的几何，不硬编码正式连接关系。
- 局部坐标用米，`position_m: {x, y, z}` 分别为东、北、高程；Three.js 显示映射为 `[x, z, -y]`。不将局部坐标伪装为真实经纬度。
- 流量 `m3s`、深度 `m`、体积 `m3`、时长 `s`、雨强 `mmh`；比例用 `[0,1]` 的 `_fraction`，只有 UI 显示百分比。日期使用带时区的 ISO 8601，回放时间用 `timestamp_s`（相对 run 开始）。
- 输入记录的 `source_type`：`observed | literature_derived | assumed | synthetic`；真实计算输出 `result_type = simulated`。另提供 `engine`、`engine_version`、`is_verified_site_model = false` 与 `assumptions`；synthetic 网络上的真实 SWMM run 仍不等于现场观测。
- Run 状态：`queued | running | succeeded | failed`。统一错误体：`{"error":{"code":"...","message":"...","details":{}}}`；运行失败还需持久化到 run 的 `error`，成功前不提供貌似有效的空白结果。具体错误码 / HTTP 状态写入 OpenAPI。

### 6.2 HTTP 边界

| Endpoint | 输入 / 输出的最低约定 | Owner |
|---|---|---|
| `GET /api/health` | 服务状态、SWMM 是否可用及版本；API 在线不代表引擎已可用 | Tay |
| `GET /api/bootstrap` | `township_id`、可用 `model_versions`、`storms`、`debris_scenarios`、`tailwater_cases`；每项带 ID / 名称 / 来源 / 参数 | Tay |
| `GET /api/townships/{id}/assets` | `{model_version_id, nodes:[], inlets:[], conduits:[], assumptions:[]}`；node 有坐标 / 高程 / 类型，inlet 关联 node，conduit 有起止 node 和直径 / 长度 | Tay |
| `POST /api/storms` | 雨强、时长或 hyetograph、来源 → 保存不可变 storm，返回 `storm_id` 与完整参数；不能只改 slider 却仍发送旧 storm ID | Tay |
| `GET /api/inspections?asset_id=...` | `{items:[]}`，按时间列出 inspection 与 media 引用 | Tay |
| `POST /api/inspections` | asset、采集时间、方法、inspector、来源、可见覆盖比例、debris 类别、notes → 新 inspection | Tay |
| `POST /api/inspections/{id}/media` | multipart `file` → media 引用与元数据；不覆盖旧记录 | Tay |
| `POST /api/debris/scenarios` | inlet、可选 inspection 引用、独立的 clogging 假设、可选 debris 参数 → `debris_scenario_id`、参数 / 假设、计算时间序列 | Tay |
| `POST /api/simulations` | 下方请求 → `202 {run_id, status}`；即使小规模实现同步计算，也保留相同的查询边界 | Tay |
| `GET /api/simulations/{id}` | run 状态、完整输入快照 / hash、引擎版本、warnings、error、证据引用 | Tay |
| `GET /api/simulations/{id}/frames` | `{run_id, model_version_id, frames:[]}`；按时间排序，frame 形状见下方 | Tay |
| `GET /api/simulations/{id}/metrics` | run 与来源信息、`total_flooding_volume_m3`、`flooded_node_count`、`surcharge_duration_s`、指标定义 / warnings；duration 明确是任一节点超载的时长，或改用清楚命名的其他统计 | Tay |
| `POST /api/interventions/compare` | `{base_run_id, candidates:[{type, target_asset_id, changes}]}` → `202 {comparison_id, status}`；`type` 为 `clean_inlet | upsize_conduit | add_storage` | Tay |
| `GET /api/interventions/comparisons/{id}` | 比较状态、baseline run、各 candidate run / 状态 / metrics / delta、共享 storm / tailwater 快照；部分失败要明确展示 | Tay |

Inspection 的 `visible_grate_coverage_fraction` 与 debris scenario 的 `hydraulic_inlet_clogging_fraction` 必须分别存储；没有校准关系时由用户独立选择假设，不得直接赋值转换。Debris 算法具体参数和单位由 Tay 在契约样例中发布，Jiajie 在此之前可以先做 controls 和示意动画。

Simulation 请求示例（ID 需由 bootstrap / 创建接口取得）：

```json
{
  "model_version_id": "taman_kyra_synthetic_v1",
  "storm_id": "synthetic_80mmh_60min",
  "debris_scenario_id": "demo_inlet_40pct",
  "tailwater_case": "normal",
  "intervention": null
}
```

单帧示例（数值仅用于说明格式，不能当计算结果）：

```json
{
  "timestamp_s": 1800,
  "pipe_states": [
    {
      "conduit_id": "PIPE-P07",
      "flow_m3s": 0.31,
      "depth_m": 0.48,
      "status": "near_capacity"
    }
  ],
  "node_states": [
    {
      "node_id": "NODE-J07",
      "depth_m": 0.8,
      "flooding_rate_m3s": 0.02,
      "surcharge_flag": true,
      "status": "flooding"
    }
  ],
  "inlet_states": [
    {
      "inlet_id": "INLET-D07",
      "hydraulic_inlet_clogging_fraction": 0.4,
      "parameter_status": "assumed_not_calibrated"
    }
  ]
}
```

Pipe status 统一为 `normal | near_capacity | surcharged | unknown`；node status 为 `normal | surcharged | flooding | unknown`。Tay 定义并返回状态依据 / 阈值，Jiajie 负责映射图例。没有物理计算依据就用 `unknown`，不能为了红色效果编造阈值或假装算出了负荷。

### 6.3 契约交付顺序

T0 先覆盖 health、bootstrap、assets、simulation 请求 / 状态 / frames / metrics；T2 / T3 增补 inspection、media、debris；T4 增补 comparison。所有阶段的 TypeScript、Pydantic 与 fixtures 都应按相同字段验证。尚未实现的 endpoint 明确记录，不用假成功响应冒充完成。

## 7. Tay 的任务队列：后端 / SWMM

| ID | 任务与交付 | 完成条件 |
|---|---|---|
| T0 | 建立 `services/api/`、依赖、health、CORS；发布基础 OpenAPI、assets fixture、ID / 单位约定与启动说明 | API 可启动；Jiajie 能不依赖 SWMM 获取或读取同形状的 assets / 示例响应；标明尚未实现的接口 |
| T1 | 在目标环境尽早验证 EPA SWMM 5.2；制作小型有效 `.inp` 与 synthetic seed；执行 baseline 与较强 rainfall，解析 frames / metrics | 保存真实 `.inp` / `.rpt` / `.out`、引擎版本、连续性误差；结果可重复；输出 ID 能与 assets 对齐 |
| T2 | storm 创建、不可变 run 输入 / hash、状态与失败处理、持久化和结果查询；完整接通 T1 | HTTP 提交 → 查询 → 真实 frames / metrics 成立；坏输入或引擎错误有明确错误与日志 |
| T3 | inspection / media / provenance；debris mass balance 与 0 / 20 / 40 / 60% 假设场景；supported inlet restriction 接入 | inspection 可重新读取；两个覆盖比例概念分开；restriction 改动确实进入 SWMM 输入，且在有效测试条件下改变输出 |
| T4 | clean inlet 与 upsize 比较，随后 storage；historical / synthetic replay 共用执行链 | baseline 不变；各候选共用 storm / tailwater；比较返回 run IDs、指标、失败项与假设 |
| T5 | Docker / 本地复现、API 与模拟检查、模型假设说明；协助处理前端发现的后端问题 | 新 checkout 按说明可跑；数值 QA、质量守恒、可重复性、counterfactual 输入一致性有验证记录 |

T1 是最早的技术风险验证，不要等 CRUD / 数据库完善后才尝试 SWMM。若 PySWMM / native engine 安装失败，记录具体日志，优先验证 Docker 或 SWMM executable 路径；可继续做 T0 / 持久化，但不得把 mock 宣称为真实引擎成功。Inlet 限制要验证当前版本支持的建模方式，不能用缩小整条 pipe 直径冒充堵塞 inlet。

## 8. Jiajie 的任务队列：前端 / 3D

| ID | 任务与交付 | 完成条件 |
|---|---|---|
| J0 | 建立 React / TS / Vite、R3F / Drei、图表、API client、显式 mock / api 模式与个人启动说明 | 前端可独立启动和构建；mock 有醒目标记；真实错误有 UI 状态 |
| J1 | 住宅区 scene、surface / underground toggle、数据驱动的 nodes / inlets / pipes、asset 选择与详情 | mock 也遵守同一 schema；资产按 ID 选中；用集中转换处理坐标，不把拓扑写死在组件中 |
| J2 | 场景设置、创建 storm、run 状态轮询、frames 时间轴、独立 inlet / pipe / node 图例、指标曲线 | mock 路径先通；T1 / T2 到位后接真实结果；参数变化触发新请求，历史 run 不被覆盖 |
| J3 | inspector 动画、inspection 表单 / media / history、evidence replay；inlet lab 控件与 debris 动画 | 表单持久化后能重读；动画与数值来源清楚；独立选择 hydraulic restriction 假设 |
| J4 | Diagnose / Anticipate、clean / upsize / storage 比较、前后 KPI 与 proposed action 视图 | 同一比较的 storm / boundary 显示一致；能回查每个 run / inspection / 假设；未实现选项明确禁用 |
| J5 | 主导端到端联调、易读布局与演示稳定性、三分钟 demo runbook、前端 README 与已验证启动命令 | 完整真实模式闭环可重放；失败态可见；build / 关键交互验证有记录；问题按接口归属交接 |

J2 的 UI / mock 可与 T1 / T2 同时进行；J3 的 lab 视图可先做 controls / 示意效果，再接 T3 数值时间序列。依赖未完成时继续自己的下一项独立工作，不去另写一套 Python 模拟或悄悄修改后端。

## 9. 共同里程碑与真正的依赖

| Gate | Tay | Jiajie | 联合验收 |
|---|---|---|---|
| G0 并行启动 | T0 基础契约 / seed 样例 | J0 / J1 mock scene | 两边独立运行，字段 / ID 能对齐 |
| G1 真实水力闭环，最高优先 | T1 / T2 | J1 / J2 接真实 API | 改 storm → 新 SWMM run → 相同 asset 上的 frame 与 KPI 改变，有日志可追溯 |
| G2 核心 pitch 体验 | T3 | J3 | 保存 inspection → 独立选择 restriction → 改变模型输入 → 回放结果与证据 |
| G3 决策与演示 | T4 / T5 | J4 / J5 | 同条件比较 clean / upsize，storage 随后补齐；三分钟真实模式演示完整通过 |

前端界面全部好看、API 能返回 JSON、或 mock 能播放，均不单独代表 G1 / G2 / G3 已完成。任一方等接口时，先做表格中的独立任务；涉及数值模型的完成条件仍需真实 SWMM 证据。

## 10. 每次 agent 执行与交接规则

1. 阅读根 `AGENTS.md`、本手册、自己的进度；查看对方进度的“交接给对方”与接口版本，首次还需阅读三份原始资料。
2. 检查 `git status`、现有文件及运行配置；进度与代码不一致时先核实，再修正自己的记录，不重复 scaffold、不删除未知文件。
3. 按队列找自己的最早未完成、可执行任务。用户指定某项时优先该项；任务太大则切成一个有明确验收的小部分，留下精确续接点。
4. 在自己的进度标记 `IN_PROGRESS`，记录当前范围；完成实现后做与改动相关的 build / 测试 / 手动检查，把实际命令、退出结果、限制写入记录。
5. 使用 `TODO / IN_PROGRESS / BLOCKED / DONE`。`BLOCKED` 要写缺少什么与可继续的替代任务；某接口未齐不代表整个人停工；未运行的验证写“未运行”，不写“通过”。
6. 更新自己的交接区：新增 endpoint / schema 版本、fixture 路径、API 启动方式、需对方适配的字段、已知问题。前端发现后端问题时记录复现请求和预期 / 实际响应；后端请求前端适配时提供 payload。
7. Agent 最后简要报告：完成什么、怎样验证、下一项任务。下一次只报名字即可从文件续接，不依赖上次聊天记忆。

### Git 与并行工作环境

- 推荐每人独立 checkout / worktree 与工作分支（例如 `tay/backend`、`jiajie/frontend`），同步同一基线，尽早共享契约和小批量改动。
- 尚未有初始 commit 时，先建立可共享基线再从它创建工作分支 / worktree；不能假定当前仓库已经有 remote、commit 或可用的 Git 托管。
- 同一物理工作目录开两个 agent 时，严格按路径归属工作，**不要让任一 agent 自动 checkout / switch 分支**；分支切换会影响另一边正在使用的文件。
- 不执行 `reset --hard`、`clean -fd` 或覆盖另一人的未提交改动。提交、push、merge 按用户授权和团队正常流程执行；只提交本人的文件，不用 `git add .` 混入对方工作。
- 联调问题各自修自己目录；需要跨边界时先通过个人交接区说明范围。用户明确要求某次跨职责修改时照做并记录。

## 11. 产品与模拟的共同验收底线

- 使用真实 SWMM 处理 hydraulics；Rational Method / Manning 仅作合理性检查，粒子 / avatar 动画只作表现。
- Synthetic、assumed、observed、simulated 的来源区别始终可见；真实 SWMM 跑 synthetic network 也不是 Taman Kyra 实测预测。
- 照片覆盖率不直接等于 hydraulic capture loss；inlet obstruction 不等于 pipe surcharge，必须分开显示。
- 普通 SWMM node flooding 不能冒充经过验证的街道二维淹水深度图。没有地形 / surface coupling 时只展示有依据的指标与示意。
- 同一输入 / seed / 引擎版本应可重复；每次 run 留下模型版本、参数、输入 hash、QA warnings 和结果引用。
- 改 restriction 的物理效果在设计好的情景中验证，不假定所有情景都单调变差；cleaning 也不能保证消除高 tailwater 导致的风险。
- 比较候选必须保持 rainfall 与外部 boundary 一致；baseline 不可原地修改；失败的候选不能获得虚假的改善分数。
- Action 是 proposed maintenance / engineering review；未验证成本不写成真实报价，未校准案例不写成确定历史成因或精确洪水预报。

完成闭环后再根据剩余时间选择 CV、实时天气、额外视觉效果或报告导出。后续新增范围仍按 **Tay 计算 / 数据，Jiajie 展示 / 交互** 拆分。
