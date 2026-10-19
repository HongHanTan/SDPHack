# Tay — 后端 / 数据 / SWMM 进度

Owner：Tay。只有 Tay 身份的 agent 更新本文件；Jiajie 读取交接区。

## 当前状态

- 最近更新：2026-10-19（T3 本地完成，88 项测试及实际 TCP / 新 API 进程重启、原生入口 0/20/40/60%、独立重复与半步长验证通过）。
- 当前任务：T3 DONE，按用户要求提交 / push 并创建 tay → main PR 中；下一项 T4：同条件 clean / upsize 比较，再做 storage / replay。G1/G2 浏览器闭环仍待 Jiajie 接线验收。
- 当前接口版本：`1.2.0`。新增 append-only inspection / media / provenance、独立 debris mass balance、原生 CUSTOM DIVERSION / INLET_USAGE 有限入口限制及 capture/backflow/bypass 结果；保留 T1/T2 direct-node 基线和核心字段。high tailwater / interventions 仍拒绝。
- 仓库基线：开始时 Git 工作区干净、只有规划资料；现已新增后端基础代码、seed、契约和测试。当前在 `tay` 分支，未修改 Jiajie 文件。
- Git 共享：T0 / T1 核心提交 `1703f75` 已推送 `origin/tay`。独立临时 worktree 已从 `origin/main` fast-forward 合并并通过 22 项测试、契约与 native 证据检查；本条交接随 main 发布。`gh` 与可用浏览器均缺失，采用 Git 合并 / push，不创建 PR。主工作目录保持 `tay`，不合并或修改 `JJ_Branch`。
- 最新共享基线：发布前 main=`97b2394`（合入 Jiajie PR #2 / `1860feb` 的 J1/J2）；T2 核心 `594f846` 已推送 origin/tay，并在独立 worktree 合并为 `a78242f`，验证通过。本条最终记录随合并版本发布 main，再将 tay fast-forward 同步；Jiajie 前端与进度文件与 `97b2394` 完全一致。
- T3 开发起点：tay / origin/main / origin/JJ_Branch 均为 `c6c847b`，工作区干净。发布前 fetch 确认远端仍在该提交；用户要求 push 并开 PR，本次只发布 tay 与创建目标 main 的 PR，不直接合并 main。未修改前端、Jiajie 进度或分支。

## 任务队列

| ID | 状态 | 当前交付 / 剩余工作 |
|---|---|---|
| T0 | DONE | FastAPI、health / CORS、基础 OpenAPI / examples、9 nodes / 8 conduits / 4 inlets 的 synthetic assets、启动说明；实际 HTTP 启动检查通过 |
| T1 | DONE | SWMM 5.2.4 实际执行 80 / 120 mm/h；两者各自重复及半步长验证，共 6 次；保留 .inp / .rpt / .out / logs / hash / QA，解析真实 frames / metrics，实体 ID 对齐 |
| T2 | DONE | POST storm / async run -> SQLite 状态 / 不可变快照 / hash -> 真实 frames / metrics；历史 / 日志、重启读取、失败 / 超时 / 排队 / 中断恢复；与最新 J1/J2 合并后 49 tests + 实际 TCP / restart 通过，已共享 |
| T3 | DONE | append-only inspection / media / provenance、storm-bound debris kg 时间序列、原生有限入口 0/20/40/60% 与独立 capture/bypass；88 tests、实际 TCP / restart / repeat / half-step 通过，提交及 PR 发布中 |
| T4 | TODO | clean / upsize 比较、storage、统一 replay 执行链 |
| T5 | TODO | Docker / 复现、数值与 API 检查、假设说明、联调修复 |

## 下一次直接执行

读取 AGENTS.md、TEAM_WORKFLOW、双方交接，检查工作区与远端。T3 已本地完成；如用户要求共享，只提交 Tay 文件并验证后发布。开发下一项为 T4，同条件 clean / upsize 比较先做可验证单元，storage 随后补齐。

复用现有 SQLite、不可变 scenario / run 快照及 simulation/swmm 唯一执行链。比较 baseline 与 candidate 必须保持相同 storm / tailwater、相同有限入口模型和全部其余参数；原 baseline 不得修改。finite 0% 是有限入口清理基线，旧 demo_inlet_clean 是不同的 unlimited direct-node 模型，不能混为清理效果。upsize 只改目标管径，记录每个候选 run_id / 输入差异 / 成功失败 / 实际 metrics / delta，失败不给改善分数。

T3 mass cleaning events 只更新质量库存；hydraulic loss 仍是独立常量假设。未来清理候选要显式克隆为 0% hydraulic loss，并保留 inspection / media / mass provenance。比较与 replay 不另造 Python 水力算法，不覆盖 T1/T2/T3 原始证据。high tailwater、现场校准、Docker 与前端 G1/G2 尚未完成。

## 交接给 Jiajie

### 当前 T3 交接（优先于下方 T2 历史记录）

- T3 DONE，API v1.2.0；完整请求、状态、限制、前端字段适配和验收见 [`contracts/T3_INTEGRATION.md`](../../contracts/T3_INTEGRATION.md)。按用户要求发布 tay → main PR 中；main 合并前可在独立 checkout 显式同步 origin/tay，不能把远端 main 当成已有 T3。
- 新增 POST/GET inspections、GET 单条；POST inspections/{id}/media multipart file、GET 附件；POST/GET debris/scenarios。inspections / debris capabilities=true，comparisons=false。依赖新增 python-multipart==0.0.32，安装 updated requirements 后重启后端。
- Inspection 必须显式提交带时区 timestamp / source_type，3D 虚拟巡检填 synthetic；保留独立 created_at / asset/model/source_reference / visible coverage。GET 历史按采集时间降序；媒体追加、不覆盖，保留大小 / hash / 类型和 URL。FormData 上传不得使用现有 JSON Content-Type。文件错误 413 / 415 / MEDIA_ARTIFACT_INVALID 明确显示。
- Debris 请求扁平化：name / inlet_id / storm_id / optional inspection_id / 独立 hydraulic_inlet_clogging_fraction / debris_parameters；响应兼容原 DebrisPreset.parameters，并附完整 inspection/media/storm 快照、质量守恒 time_series。质量 kg 与照片覆盖率不会自动映射水力损失。场景固定关联 storm；跨 storm 返回 SCENARIO_STORM_MISMATCH，需新建场景。
- Native finite presets：demo_inlet_capture_0pct、demo_inlet_capture_20pct、demo_inlet_40pct、demo_inlet_capture_60pct。与 finite 0% 比较并保持雨量 / 边界一致；旧 demo_inlet_clean 保留 direct-node 假设，属于不同 capture_model，不能当成有限入口清理候选。preset 无巡检/质量时间序列，需证据链时 POST 新场景。
- 新 frame inlet capture_flow_m3s / bypass_flow_m3s 是实际报告样本；metrics.inlet_volumes 是 native routing-step 积分的 capture/backflow/bypass m3，direct 模式为 null。限制增强可能降低 sewer flooding 并提高 bypass；必须一起展示，不画成校准二维淹水深度。
- 资产公开仍是 9 nodes / 8 pipes / 4 inlets；12 个辅助节点和 8 个辅助 links 仅存于 input_snapshot.inlet_model.elements 的受控映射。不要把它们当新现场资产。原 pipe geometry 未改，完整假设 / native 曲线 / loss 全部进入 input_hash。
- 真实证据在 data/validation/t3/，契约样例为 contracts/examples/{inspection-*,media-created,debris-*,native-inlet-*}.json。UUID 只属于保留 runtime；新开发数据库应重新 POST。synthetic-pixel.png 仅为字节上传测试，不是现场照片。CLI python -m services.api.check_t3 可在新目录独立复现并停止自己的服务。
- Jiajie 下一步：先补齐 J2 轮询 / API 与 offline fixture 分离，再实现 J3 表单 / multipart / 证据回放 / mass 曲线与 native finite 场景，执行 G1/G2 浏览器验收，记录真实 run IDs。Tay 不修改你的进度或前端，发现后端问题请附请求 / 状态码 / run_id。

### T2 历史交接（v1.1.0，以下未实现限制已由上述 T3 更新）

- 职责已确认：Tay 后端，Jiajie 前端。
- 2026-10-19 T2 已按用户要求共享，与 main=`97b2394` 的 J1/J2 无冲突合并并验证；最终共享记录见下方。请同步最新 main，然后先补齐在线 J2 接线。
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

- T0–T3 后端单元无阻塞；T0–T2 已共享，T3 本地待发布。Python 3.12.10、SWMM 5.2.4、实际 HTTP 与重启持久化已验证。G1/G2 浏览器联调待 Jiajie 接线验收，未宣称联合闭环通过。
- 首次 sandbox 中 pip 下载遇到 WinError 10013；经授权的依赖安装执行后成功，非当前阻塞。
- Docker CLI 存在，但 daemon / 容器执行未检查；T0 不依赖 Docker。
- 测试有 1 条依赖弃用警告：Starlette 0.52.1 引用 AnyIO 4.15.1 的 `anyio.abc.BlockingPortal` alias；当前测试 / HTTP 功能均通过。未屏蔽警告。
- Windows 系统临时目录 `.../Temp/pytest-of-Tay` 无读权限；测试改用仓库内唯一 `--basetemp` 后通过，命令见下方及 `md/BACKEND_SETUP.md`。
- 微小瞬态溢流的节点计数对步长敏感，已保留原值并发出 trace warning；完整说明见 `md/MODEL_ASSUMPTIONS.md`。T3 已验证原生有限入口及控制场景；尚未验证现场校准、高 tailwater 完整对比、Docker 或前端联调。

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

### 2026-10-19 — T3 DONE（本地待提交 / 推送）

- `services/api/app/{schemas,storage,evidence,errors,main,service,catalog}.py`：v1.2.0，已有 SQLite 上追加 inspection/media/debris 表与 append-only triggers；采集时间 / 来源 / per-asset history、multipart 媒体与大小/SHA-256、完整场景 / 证据 / storm 快照和明确错误。运行状态 / worker / 输入 hash 仍复用 T2，不创建第二套水力计算。
- `simulation/debris/{__init__,mass_balance}.py`：60s buildup / rain wash-off / capture / export / cleaning removal kg 时间序列，逐步质量守恒；独立常量 hydraulic loss，不从 coverage / retained mass 自动转换。
- `models/illustrative_taman_kyra/inlet_capture.json`、`simulation/swmm/{inlets,model,worker,results}.py`：SWMM 5.2.4 原生 CUSTOM DIVERSION / INLET_USAGE，完整辅助元素映射、实际 capture/backflow/bypass、原始 native QA。未改变任何原管径 / roughness，旧 direct-node 输入生成和 T1/T2 证据保留。
- `data/synthetic/bootstrap.json`、`contracts/**`：native 0/20/40/60% preset 与 v1.2 capability / OpenAPI；导出真实 inspection/media/debris/native HTTP examples，完整前端接线文档 T3_INTEGRATION.md。保留有限 0% 与 legacy direct-node 两种假设组，要求同条件比较。
- `services/api/check_t3.py`、`data/validation/t3/**`：实际 TCP inspection → media → debris → SWMM → 新 API 进程重启，保留 5 个 HTTP runs（旧 direct baseline + 四个 native）、独立 40% 重复和半步长、完整 SQLite / 原字节 / .inp / .rpt / .out / logs / manifest。synthetic pixel 明确不是现场照片；没有覆写 T1/T2。
- `tests/api/{test_inspections,test_debris_scenarios,test_foundation,test_simulations}.py`、`tests/simulation/{test_debris,test_swmm_execution}.py`：校验来源 / 时区 / 资产、append-only、重启 / hash / 上传错误、scene join / storm 绑定、冻结快照、kg 守恒、零雨 / 最大支持暴雨、原生输出变化与重复 / 步长。为超限上传参数明确短 test ID，避免 pytest 将 10 MiB 测试字节变成 Windows 目录名；修正后完整通过。
- `services/api/requirements{,-tested}.txt` 新增 python-multipart==0.0.32；项目虚拟环境已安装；`md/BACKEND_SETUP.md` / `MODEL_ASSUMPTIONS.md` / 本进度更新边界与复现。没有修改 apps/web、tests/e2e、README.md 或 Jiajie 进度。

| T3 验证命令 / 检查 | 实际结果 |
|---|---|
| `python -m pytest tests/api tests/simulation -q --tb=short --basetemp=<唯一仓库 runtime 目录>`（项目 .venv） | **88 passed**，19.82s，1 条既有 Starlette/AnyIO 弃用警告；无跳过 |
| `python -m services.api.check_t3 --output data/validation/t3` | exit 0；实际 TCP、新 API 进程重启、旧 baseline 不变、inspection/media 快照不变、四个真实 native inlet runs、独立重复与半步长全部通过；服务已停止 |
| 独立 native 40% repeat / half routing step | binary output 完全相同；半步长 D07 capture / bypass 绝对差 0.010534 / 0.010474m3，低于 0.5% 验收阈值 |
| 0/20/40/60% native 120mm/h cases | D07 capture 741.777064 / 593.429322 / 445.071560 / 296.698003m3；bypass 389.679076 / 537.984428 / 686.348132 / 834.683663m3；routing continuity 约 -0.024%..-0.016%，均低于 1% |
| Debris mass balance / zero & maximum native rainfall controls | 最大质量误差 8.88e-16kg；zero rain 与 300mm/h、21600s 原生 HTTP 执行通过；时间轴按真实长度返回 |
| `python -m pip check` / `python -m simulation.swmm.engine` | exit 0；无损坏依赖；SWMM 5.2.4 available=true，T1 execution_verified=true |
| 最终 `python -m services.api.export_contracts` / `--check`，随后 `pytest tests/api/test_foundation.py` | exit 0；最终 OpenAPI / T0–T3 examples 与实际应用一致，schema / CORS / catalog 等 **10 passed**（2.57s，既有警告） |
| `git diff --check`；`git diff --exit-code -- apps/web tests/e2e README.md md/progress/jiajie.md`；T3 evidence attributes | exit 0；无 whitespace 错误（仅 LF/CRLF 提示），未修改另一方文件；129 个 T3 文件可由 Git 跟踪，原字节 text / whitespace 属性 unset |

下一项 T4；T3 后端完成不代表 Jiajie 的 J3 或联合 G2 浏览器闭环完成。发布前按用户授权提交 Tay 范围、更新远端状态并交接，不覆盖另一方文件。

### 2026-10-19 — T2 Git 发布与 Jiajie 交接

- 用户授权 push 与对接；T2 核心提交 `594f846` 已推送 origin/tay。发布前 fetch 取得 main=`97b2394`、JJ_Branch=`1860feb`；在独立 worktree 从 main 合并 origin/tay，得到 `a78242f`，无冲突。主工作目录保持 tay，不切换分支，不修改 JJ_Branch。
- 合并后的新 checkout：pytest tests/api tests/simulation **49 passed**（18.11s，1 条既有依赖弃用警告）；export_contracts --check 通过；SWMM 5.2.4 available / execution_verified 均 true；保留 T1/T2 原始证据 hash 校验通过。
- 合并后的实际 TCP / 新 API 进程重启验证通过：baseline=`run_a548364a407a40beafe483a18e13f801`，stronger=`run_c3ccb18450ae48fc9fd087e756bb28eb`；洪量仍为 0.014893 / 728.764885m3。临时独立服务已停止，临时 runtime 随 worktree 清理，长期证据仍是 data/validation/t2，不覆写。
- `git diff --exit-code origin/main -- apps/web md/progress/jiajie.md` 通过：Jiajie 最新文件原样保留。当前只做后端发布与仓库交接，没有宣称 Jiajie 已收到私人消息或完成浏览器验收。
- 新增 `contracts/FRONTEND_INTEGRATION.md`：以最新 J1/J2 代码列出 capability 初始化、clean / normal 默认、flat StormCreate、run 状态轮询、API 与离线 fixture 分离、动态时间轴、失败处理和 G1 验收；contracts/README 与本交接区链接到它。
- 下一步 Tay 做 T3；Jiajie 同步 main 后按上述说明补齐 J2 在线接线，执行 G1 浏览器验收，在自己的进度中记录 run IDs / 实际结果及后端问题。

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
