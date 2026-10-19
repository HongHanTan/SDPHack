# Tay — 后端 / 数据 / SWMM 进度

Owner：Tay。只有 Tay 身份的 agent 更新本文件；Jiajie 读取交接区。

## 当前状态

- 最近更新：2026-10-19（T2 本地完成，49 项测试与实际 HTTP / API 进程重启验证通过）。
- 当前任务：T2 DONE，按用户要求发布及交接中；下一项 T3：inspection / media / provenance、debris 质量守恒及真实入口限制。
- 当前接口版本：`1.1.0`，保留原资产 / request / frames / metrics 核心字段，新增 storm 创建与查询、持久化异步 run / history、结果 / artifact 查询。HTTP 模拟已实现，非零 restriction / high tailwater 明确拒绝。
- 仓库基线：开始时 Git 工作区干净、只有规划资料；现已新增后端基础代码、seed、契约和测试。当前在 `tay` 分支，未修改 Jiajie 文件。
- Git 共享：T0 / T1 核心提交 `1703f75` 已推送 `origin/tay`。独立临时 worktree 已从 `origin/main` fast-forward 合并并通过 22 项测试、契约与 native 证据检查；本条交接随 main 发布。`gh` 与可用浏览器均缺失，采用 Git 合并 / push，不创建 PR。主工作目录保持 `tay`，不合并或修改 `JJ_Branch`。
- 最新共享基线：发布前 fetch 确认 `origin/main=97b2394`（合入 Jiajie PR #2 / `1860feb` 的 J1/J2）；T2 从本地 tay 发布，使用独立 worktree 合并和验证最新 main。没有修改 Jiajie 前端或进度文件。

## 任务队列

| ID | 状态 | 当前交付 / 剩余工作 |
|---|---|---|
| T0 | DONE | FastAPI、health / CORS、基础 OpenAPI / examples、9 nodes / 8 conduits / 4 inlets 的 synthetic assets、启动说明；实际 HTTP 启动检查通过 |
| T1 | DONE | SWMM 5.2.4 实际执行 80 / 120 mm/h；两者各自重复及半步长验证，共 6 次；保留 .inp / .rpt / .out / logs / hash / QA，解析真实 frames / metrics，实体 ID 对齐 |
| T2 | DONE | POST storm / async run -> SQLite 状态 / 不可变快照 / hash -> 真实 frames / metrics；历史 / 日志、重启读取、失败 / 超时 / 排队 / 中断恢复；49 tests + 实际 TCP / restart 通过，正在发布及交接 |
| T3 | TODO | inspection / media、debris mass balance、inlet restriction 实际接入 |
| T4 | TODO | clean / upsize 比较、storage、统一 replay 执行链 |
| T5 | TODO | Docker / 复现、数值与 API 检查、假设说明、联调修复 |

## 下一次直接执行

读取 `AGENTS.md` 与 `md/TEAM_WORKFLOW.md`，检查工作区 / 远端及双方交接。用户已要求共享 T2，当前执行提交 / push / 最新 main 合并验证；完成发布后开发下一项 T3，可先拆成 inspection / media 的可验证单元，再做 debris 与 SWMM inlet restriction。

复用 `services/api/app/storage.py` 的 SQLite 边界及 `simulation/swmm/runner.py::run_model` 的唯一计算执行链。inspection / media 要追加存储、可重读、带 source_type / timestamp / asset_id / evidence provenance。visible_grate_coverage_fraction 必须独立于 hydraulic_inlet_clogging_fraction；非零 restriction 尚未实现，当前必须继续明确拒绝。

随后在 simulation/debris 内实现带单位、假设版本和质量守恒的 buildup / wash-off / capture / removal 时序，以及 0 / 20 / 40 / 60% 假设；验证 SWMM 5.2 当前支持的真实入口建模方式。不得缩小整段 pipe 冒充入口堵塞。若需辅助 surface/inlet 节点，明确它们与已发布资产的映射，并更新 parser 的受控映射 / 契约，不把内部辅助节点直接当作现场资产。保留 T1 及 T2 原始证据，不覆写已存在 run。

T2 当前支持 constant 0..300 mm/h、duration 300..21600s 且为 300s 倍数，额外 3600s drain-down、demo_inlet_clean、normal tailwater。T3 的新参数必须继续完整进入不可变 input_snapshot / input_hash，并让同条件真实输出发生可验证变化。项目虚拟环境与 SWMM 5.2.4 已可用，启动 / 测试命令见 md/BACKEND_SETUP.md。

## 交接给 Jiajie

- 职责已确认：Tay 后端，Jiajie 前端。
- 2026-10-19 发布前确认 main=`97b2394`，包含 Tay T0/T1 与 Jiajie PR #2 的 J1/J2。已按用户要求开始发布 T2；最终共享状态见下方发布记录。
- 对照 Jiajie 最新 `1860feb`：资产字段已对齐，无需重做。真实模式仍会因初始化 inspections 404 失败；默认 40% restriction 会收到 422；POST 后立即取结果会收到 409；client 会按 `t1_` / `120mmh` 字符串在 API 模式返回离线 fixture。完整修复范围、请求、轮询和 G1 浏览器验收见 [`contracts/FRONTEND_INTEGRATION.md`](../../contracts/FRONTEND_INTEGRATION.md)。请先补齐这部分 J2 在线接线，再进行 G1 验收；J3 的独立 UI 可并行。
- Git 同步：在 Jiajie 自己的 checkout、`JJ_Branch` 上，先保存 / 提交已有工作，再执行 `git fetch origin` 和 `git merge origin/main`，然后重新阅读本交接区。T0 / T1 已按 Tay 范围发布，不需要等 J1 全部完成再同步。
- 本次 T2 契约升级 v1.1.0，消费约定见 `contracts/README.md`。资产 / frames / metrics 核心字段保持兼容，新增可选 run 顶层 storm_id / debris_scenario_id / tailwater_case 和带时区时间戳。
- T2 新增：`POST /api/storms`(201)、`GET /api/storms/{id}`；`POST /api/simulations`(202 queued)、`GET /api/simulations?limit=20`、run 状态、frames / metrics、allowlisted `artifacts/{name}`。所有状态 / 自定义 storm / 原始输入 / hash 持久化；API 重启后可重读，运行中中断会明确标记 failed / RUN_INTERRUPTED。
- 创建 storm 示例：`{"name":"Assumed rain","intensity_mmh":120,"duration_s":3600,"source_type":"assumed"}`。返回参数在 `parameters` 内；必须使用新 `storm_id` 提交 `{"model_version_id":"taman_kyra_synthetic_v1","storm_id":"<new id>","debris_scenario_id":"demo_inlet_clean","tailwater_case":"normal","intervention":null}`。POST 后轮询 `/api/simulations/{run_id}` 到 succeeded / failed，成功才请求 frames / metrics。不要提交后立即当作结果已就绪。
- 错误体保持统一：未就绪 409 RESULTS_NOT_READY；失败结果 409 SIMULATION_FAILED（run.error 持久化、有日志 URL）；未知 ID 404；非法字段 / 数值 422 VALIDATION_ERROR；非零 restriction / high boundary 422 UNSUPPORTED_SCENARIO；队列满 429；结果文件损坏 / 丢失 500 RESULT_ARTIFACT_INVALID。当前每个 runtime 单 API worker、单 native job，最多 8 个 queued/running，native timeout 120s。
- 新增实际 TCP HTTP / API 进程重启样例：`contracts/examples/http-{accepted,run,frames,metrics}-{baseline,stronger}.json` 与 `storm-created.json`，原始证据 `data/validation/t2/`。这些 UUID 只属于证据 runtime；新数据库应使用自己 POST 返回的 run_id，或明确选择离线样例回放。旧 T0/T1 `simulation-not-implemented.json` 已由 `simulation-unsupported.json` 替换，模拟接口不再返回 501。
- 已实现 `GET /api/health`、`GET /api/bootstrap`、`GET /api/townships/taman_kyra_demo/assets`。CORS 支持 `http://localhost:5173` 与 `http://127.0.0.1:5173`。
- T1 新增真实离线样例：`contracts/examples/{run,frames,metrics}-baseline.json`（80 mm/h）与 `...-stronger.json`（120 mm/h）。两者都降雨 3600s、总模拟 7200s、normal tailwater、clean direct-node entry。完整证据在 `data/validation/t1/`，不是 mock。可用于明确标为离线真实 SWMM 结果的回放。
- frames 为实际 .out 每 60s 的样本，共 120 帧，t=60..7200，没有伪造 t=0；native 指标包含 report 帧之间的短时事件。直接消费返回的 `status_definitions` / `metric_definitions`，不要用动画重新计算物理指标。
- 标准结果：baseline 溢流 0.014893m3、计数 1；stronger 溢流 728.764885m3、计数 6。baseline 的微小瞬态事件计数在半步长下变成 2，不宜当作稳定的洪点结论；请展示 `warnings`。所有输出仍为 synthetic 模型上的 simulated，`is_verified_site_model=false`。
- 启动（仓库根目录 PowerShell）：`.\services\api\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000`。完整安装 / 验证见 `md/BACKEND_SETUP.md`。HTTP smoke 用的临时服务已停止；当前不保证有后台 server。
- 资产：`township_id=taman_kyra_demo`，`model_version_id=taman_kyra_synthetic_v1`；9 nodes（含 `NODE-OUT01`），8 conduits，4 inlets；`INLET-D07 -> NODE-J07`。请按返回的节点连接生成 pipe geometry。
- `position_m` 为局部 east/north/elevation 米，Three.js 映射 `[x,z,-y]`；node 坐标为管底，inlet 坐标为地面 grate，两者高程不同。
- `bootstrap` 每项带 `parameters`，包含 seed 与已创建的 storm；只有 clean / normal 的 `swmm_supported=true`，非零 restriction / high 均为 false。默认 UI 请选 `demo_inlet_clean`，不能继续用 demo_inlet_40pct 启动 T2 run。
- `bootstrap.capabilities` 现在 assets / storm_creation / simulations 为 true，inspections / debris / comparisons 为 false。前端请先只加载基础接口，不要因 Promise.all 中的 inspections 404 或硬编码 mock run ID 404 导致整个 scene 初始化失败；T3 前禁用 inspection / restriction 操作。
- `/api/health.swmm.available` 表示本机库可加载，`.execution_verified` 表示与 T1 证据匹配；capabilities.simulations=true 表示路由已实现，不代表引擎永不失败。native 缺失时 run 会持久化为 failed / ENGINE_UNAVAILABLE，真实模式失败不自动降级。
- `hydraulic_inlet_clogging_fraction` 与 inspection visible coverage 独立。未来 pipe / node status 分别消费 `status_definitions`，inlet 状态独立；`surcharge_duration_s` 是“任一节点超载”的时间并集。

## 阻塞与待确认

- T0 / T1 / T2 后端单元无阻塞。Python 3.12.10、native SWMM 5.2.4、实际 HTTP 执行及进程重启持久化已验证；当前正在发布 T2，G1 浏览器联调待 Jiajie 接线验收。
- 首次 sandbox 中 pip 下载遇到 WinError 10013；经授权的依赖安装执行后成功，非当前阻塞。
- Docker CLI 存在，但 daemon / 容器执行未检查；T0 不依赖 Docker。
- 测试有 1 条依赖弃用警告：Starlette 0.52.1 引用 AnyIO 4.15.1 的 `anyio.abc.BlockingPortal` alias；当前测试 / HTTP 功能均通过。未屏蔽警告。
- Windows 系统临时目录 `.../Temp/pytest-of-Tay` 无读权限；测试改用仓库内唯一 `--basetemp` 后通过，命令见下方及 `md/BACKEND_SETUP.md`。
- 微小瞬态溢流的节点计数对步长敏感，已保留原值并发出 trace warning；完整说明见 `md/MODEL_ASSUMPTIONS.md`。尚未验证现场校准、入口限制、高 tailwater 完整对比、Docker 或前端联调。

## 验证记录

2026-10-19，仓库根目录 PowerShell，项目虚拟环境：

| 命令 / 检查 | 实际结果 |
|---|---|
| `python -m venv services/api/.venv` | exit 0，建立项目内环境 |
| `.\services\api\.venv\Scripts\python.exe -m pip install --disable-pip-version-check --retries 0 -r services/api/requirements-dev.txt -r services/api/requirements-swmm.txt`，随后按 requirements-dev 更新 Starlette pin | exit 0，安装完成；确切版本记录在 `services/api/requirements-tested.txt` |
| `.\services\api\.venv\Scripts\python.exe -m simulation.swmm.engine` | exit 0，available=true，engine_version=5.2.4，execution_verified=false |
| `.\services\api\.venv\Scripts\python.exe -m pytest tests/api tests/simulation -q` | exit 0，11 passed，1 dependency deprecation warning；覆盖 native 缺失、API 与 engine 健康分离、资产 ID / 几何 / 连通性、CORS、404 / 422 / 501、契约及样例校验 |
| `.\services\api\.venv\Scripts\python.exe -m services.api.export_contracts --check` | exit 0，OpenAPI 与样例和应用一致 |
| `.\services\api\.venv\Scripts\python.exe -m pip check` | exit 0，No broken requirements found |
| 临时 Python subprocess 启动 `python -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000`，使用 httpx 访问实际 TCP HTTP，finally 停止本次进程 | 通过：health / bootstrap / assets / docs / openapi 均 200；9 / 8 / 4 资产；有效 simulation 请求 501；HTTP OpenAPI 与导出 JSON 完全一致。日志在忽略的 `data/runtime/t0-http-smoke.log` |
| `git diff --check` | exit 0；仅 Git 的 LF -> CRLF 提示，无 whitespace 错误 |

上述为 T0 历史记录，T1 后续验证如下。

### T1 实际验证 — 2026-10-19

| 命令 / 检查 | 实际结果 |
|---|---|
| `.\services\api\.venv\Scripts\python.exe -m simulation.swmm.demo --output data/validation/t1` | exit 0；实际运行 baseline / stronger、两者独立重复、两者半 routing step，共 6 次；保存所有原始证据和 summary/hash |
| `.\services\api\.venv\Scripts\python.exe -m simulation.swmm.engine` | exit 0；available=true、engine_version=5.2.4、execution_verified=true，证据 hash 与当前输入匹配 |
| `$tayTestTemp = Join-Path (Get-Location).Path ('data/runtime/pytest-' + [guid]::NewGuid().ToString('N'))`，随后 `.\services\api\.venv\Scripts\python.exe -m pytest tests/api tests/simulation -q --basetemp=$tayTestTemp` | exit 0；22 passed、1 dependency deprecation warning。测试自身重新执行六次 suite，覆盖降雨变化、重复、半步长、native 错误、QA 拒绝、真实 .out 重解析、schema / ID、不可覆盖与证据 hash |
| `.\services\api\.venv\Scripts\python.exe -m services.api.export_contracts --check` | exit 0；OpenAPI / T0 examples / 真实 T1 examples 与来源一致 |
| `.\services\api\.venv\Scripts\python.exe -m pip check` | exit 0；No broken requirements found |
| 实际启动 uvicorn 8000 + httpx TCP HTTP smoke | 通过；health.execution_verified=true、model readiness=execution_verified，assets 200，capabilities.simulations=false，frames HTTP 501，HTTP OpenAPI 与导出一致。已停止本次服务；日志在忽略的 `data/runtime/t1-http-smoke.log` |
| `git diff --check`；`git check-attr text -- data/validation/t1/baseline/model.inp data/validation/t1/baseline/model.rpt data/validation/t1/baseline/model.out models/illustrative_taman_kyra/baseline.inp` | exit 0；无 whitespace 错误（仅原进度文件 LF/CRLF 提示）；原始证据禁止换行转换，模型 .inp 固定 LF，保证跨 checkout 的 byte hash |

标准 baseline / stronger runoff 连续性误差约 -0.001592% / -0.001600%；routing 约 -0.031312% / -0.030688%。非收敛步约 0.24% / 0.28%。两者重复的 binary output 和解析结果完全相等。半步长洪量差约 0.000857m3 / 0.046670m3；stronger 相对差约 0.0064%。surcharge 时间并集 2970.000s / 3478.747s。完整细节以 `data/validation/t1/summary.json` 为准。

以上是 T1 历史验证；T2 HTTP 提交 / 持久化现已实现，后续验证如下。入口限制、debris 质量守恒、Docker、前端端到端仍未验证。

### T2 实际验证 — 2026-10-19

| 命令 / 检查 | 实际结果 |
|---|---|
| `git fetch origin` / `git ls-remote --heads origin main tay JJ_Branch`，并验证 `a6579de` 是 origin/main 的祖先 | 远端 main=ffb50db，已包含 Tay 与 Jiajie PR #1；工作区干净后在 tay 上 `git merge --ff-only origin/main` 成功，未切换分支 |
| `.\services\api\.venv\Scripts\python.exe -m services.api.check_http --output data/validation/t2` | exit 0；实际 TCP HTTP，POST 自定义 storm、两个真实 run、轮询 / frames / metrics / artifact、baseline 不变；停止 API 后由新进程重读同一 SQLite / 文件成功。证据与 manifest 已保留，测试服务已停止 |
| `.\services\api\.venv\Scripts\python.exe -m services.api.export_contracts --check` | exit 0，v1.1.0 契约、fresh-runtime 响应及 T1/T2 真实样例一致；export 不启动模拟、不修改普通开发数据库 |
| `.\services\api\.venv\Scripts\python.exe -m simulation.swmm.engine` | exit 0，available=true、engine_version=5.2.4、execution_verified=true，T1 证据仍匹配 |
| `.\services\api\.venv\Scripts\python.exe -m pip check` | exit 0，No broken requirements found；T2 只新增标准库 SQLite / executor / file lease，无新依赖 |
| 唯一仓库内 `$tayTestTemp`，`.\services\api\.venv\Scripts\python.exe -m pytest tests/api tests/simulation -q --basetemp=$tayTestTemp` | exit 0，49 passed、1 既有 dependency deprecation warning；覆盖真实 80 / 120 / 短时 / 零降雨、不可变 storm / input、排队 / 409 / 429、native 缺失 / 真实超时、失败持久化、进程中断恢复、runtime 排他锁、结果损坏 / 缺失、schema、T1 / T2 evidence hash |
| `git diff --check` | exit 0；只有已知 LF/CRLF 提示，原始 T1 / T2 evidence 属性保留字节 |

实际 HTTP baseline run=`run_683638975fab4bfd9e9cd2ad7f9ff32b`，stronger=`run_58526011782848ecb34a408b4538e5a9`；洪量 0.014893 / 728.764885m3，两者 120 report frames。新创建 storm 的参数会进入新 run，旧 run input hash 保持不变，结果与 native T1 一致。完整证明见 `data/validation/t2/summary.json`。这些不是默认开发数据库的预置 run IDs。

## 最近实现记录

### 2026-10-19 — T2 DONE

- `services/api/app/{main,schemas,catalog}.py`：create_app / lifespan，v1.1.0，storm / async simulation / history / result / artifact HTTP 路由，完整错误码，保留已有核心 schema。
- `services/api/app/{storage,service,runtime_lock}.py`：SQLite、immutable triggers、queued/running/succeeded/failed 生命周期、完整快照/hash、串行 background worker + native 子进程、超时 / 队列限制、单 runtime 排他锁、重启恢复、日志与结果哈希检查。计算仍只复用 simulation/swmm，没有在 API 再造水力模型。
- `services/api/check_http.py`、`data/validation/t2/**`：真实 TCP HTTP / API 进程重启验收、两组真实结果 / 日志 / DB / 原始 native artifacts / manifest。采用新的输出目录，不覆盖 T1。
- `services/api/export_contracts.py`、`contracts/**`：fresh-runtime 无副作用导出，加入真实 T2 HTTP fixtures、storm 示例及 422 unsupported 示例；替换旧 planned 501 示例。
- `data/synthetic/bootstrap.json`、`simulation/swmm/engine.py`：更新版本 / capability / executable preset 声明与 health 文案，保留 T1 模型参数和证据有效性。
- `tests/api/{test_foundation,test_simulations}.py`：更新 API 契约验证，加入实际运行 / 持久化 / 失败 / immutable / queue / integrity 等检查；总计49项通过。
- `contracts/README.md`、`md/BACKEND_SETUP.md`、`md/MODEL_ASSUMPTIONS.md`、本进度：参数边界、请求 / 轮询 / error / runtime / 复现、Jiajie 字段适配和联调要求。没有修改 apps/web、README.md 或 md/progress/jiajie.md。
- 下一项 T3；G1 的后端 HTTP 链已验证，完整前端闭环仍需 Jiajie 按交接适配与验证。

### 2026-10-19 — T0 / T1 Git 共享交接

- 用户授权提交、push 并合入 main；核心提交 `1703f75`（Complete backend T0 and SWMM T1 validation）已推送 `origin/tay`。
- 独立临时 worktree 从 main 验证 fast-forward 合并，不切换共享工作目录分支，不修改 Jiajie 的进度 / 前端 / JJ_Branch。
- 从 Git checkout 后再次验证：22 passed，1 既有 dependency deprecation warning；contract export --check 通过；engine.execution_verified=true。原始 .inp / .rpt / .out 的字节 hash 在新 checkout 中保持一致。
- `data/validation/.gitattributes` 保留原始证据字节并关闭这些文件的 whitespace 检查，避免 Windows CRLF / 原生 SWMM 报表空白被误报；源码的 whitespace 检查正常启用。
- 新 checkout 的 `data/runtime` 默认不存在，已在 `md/BACKEND_SETUP.md` 的测试命令前补充创建父目录，避免 pytest --basetemp 建目录失败。
- GitHub PR 工具 / 浏览器不可用，因此本次使用直接 Git fast-forward 合并与 push；Jiajie 同步命令已写入上方交接区。

### 2026-10-19 — T1 DONE

- `simulation/swmm/{model,status,worker,results,runner,demo}.py`：deterministic .inp 生成、独立 native 子进程 / 超时、真实 .out 解析、routing-step 指标、错误 / 数值 QA、六次验证链。引擎错误不回退 mock，不覆盖已存在的 run 目录。
- `simulation/swmm/engine.py`：health 加载当前版本后校验证据、当前 resolved input hash 与 raw artifact hash，分别报告 available / execution_verified。
- `models/illustrative_taman_kyra/{hydrology.json,baseline.inp,stronger.inp,README.md,.gitattributes}`：明确标识的 hydrology seed、完整 runnable model 与来源说明。
- `data/validation/t1/**`、`data/validation/.gitattributes`：六次真实 .inp / .rpt / .out、完整输入、hash、native stats、logs、frames、metrics、QA、summary；保留字节供追溯。`data/synthetic` 只更新 assumptions / readiness，没有更改几何或 ID。
- `services/api/app/main.py`、`services/api/export_contracts.py`、`contracts/**`：继续明确 HTTP 501，发布 schema-compatible 的真实 baseline / stronger run / frames / metrics fixtures；接口 v1.0.0 兼容，无破坏性字段变动。
- `tests/simulation/test_swmm_execution.py`、`tests/api/test_foundation.py`：真实执行 / 失败 / QA / 复现 / schema 检查，总 22 项通过。
- `md/MODEL_ASSUMPTIONS.md`、`md/BACKEND_SETUP.md`、本进度：模型参数、指标阈值、trace flooding 限制、复现命令与前端交接。
- 下一项：T2，以现有 runner 为唯一执行链接通 HTTP、storm 创建及持久化；T1 不表示 G1 的前后端闭环已完成。

### 2026-10-19 — T0 DONE；T1 安装预检

- `services/api/app/{main,schemas,catalog}.py` 与 `__init__.py`：HTTP 服务、统一错误、typed schema、版本化 seed 读取、显式 planned simulation 边界。
- `services/api/requirements*.txt`：runtime / dev / optional SWMM 依赖与完整测试环境版本快照；虚拟环境保持忽略。
- `simulation/{__init__,swmm/__init__,swmm/engine}.py`：独立计算边界与真实 native-library probe，未冒充模型执行验证。
- `data/synthetic/{taman_kyra_assets,bootstrap}.json`：权威 synthetic 几何、ID、来源及参数预设。
- `services/api/export_contracts.py`、`contracts/openapi.json`、`contracts/examples/*.json`、`contracts/README.md`：可再生契约 / 实际 T0 响应样例与前端交接。
- `tests/api/test_foundation.py`、`tests/simulation/test_engine_probe.py`：11 项相关检查。
- `.gitignore`、`md/BACKEND_SETUP.md`、本进度文件：运行与复现说明、产物忽略、状态与交接。
- 验收：T0 API 能实际启动，Jiajie 可不依赖 SWMM 消费资产 / 契约；T1 完整模拟尚未完成。下一项按上方 T1 续接点执行。
