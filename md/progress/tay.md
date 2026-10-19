# Tay — 后端 / 数据 / SWMM 进度

Owner：Tay。只有 Tay 身份的 agent 更新本文件；Jiajie 读取交接区。

## 当前状态

- 最近更新：2026-10-19（T1 已完成，6 次真实执行与结果交接已保存）。
- 当前任务：T1 DONE；下一项 T2：storm 创建、持久化、不可变 run、HTTP 执行与结果查询。
- 当前接口版本：`1.0.0`，schema 保持兼容，新增真实离线 run / frames / metrics 样例；HTTP 模拟接口仍为 planned，实际返回 501，等待 T2。
- 仓库基线：开始时 Git 工作区干净、只有规划资料；现已新增后端基础代码、seed、契约和测试。当前在 `tay` 分支，未修改 Jiajie 文件。
- Git 共享：IN_PROGRESS（用户已授权提交、push 并合并到 main）；已 fetch origin，远端 `JJ_Branch` 有 J0 / J1 工作。`gh` 与可用浏览器均缺失，采用独立临时 worktree 的 Git 合并 / push 路径，不创建 PR。本次只发布 Tay 的 T0 / T1，不合并或修改 JJ_Branch。

## 任务队列

| ID | 状态 | 当前交付 / 剩余工作 |
|---|---|---|
| T0 | DONE | FastAPI、health / CORS、基础 OpenAPI / examples、9 nodes / 8 conduits / 4 inlets 的 synthetic assets、启动说明；实际 HTTP 启动检查通过 |
| T1 | DONE | SWMM 5.2.4 实际执行 80 / 120 mm/h；两者各自重复及半步长验证，共 6 次；保留 .inp / .rpt / .out / logs / hash / QA，解析真实 frames / metrics，实体 ID 对齐 |
| T2 | TODO | storm、持久化、不可变 run、状态 / 错误、frames / metrics API |
| T3 | TODO | inspection / media、debris mass balance、inlet restriction 实际接入 |
| T4 | TODO | clean / upsize 比较、storage、统一 replay 执行链 |
| T5 | TODO | Docker / 复现、数值与 API 检查、假设说明、联调修复 |

## 下一次直接执行

读取 `AGENTS.md` 与 `md/TEAM_WORKFLOW.md`，核实 Git 状态及双方交接后开始 T2。项目已有 `services/api/.venv`，Windows x64 / Python 3.12.10，`swmm-toolkit==0.17.0` 与 SWMM 5.2.4 的完整执行已验证。

复用 `simulation/swmm/runner.py::run_model` 与 `model.py::resolve_inputs` / `build_inp`，不要再写第二套模拟器。先实现 immutable storm 与 SQLite run 存储，再接 `POST /api/simulations` -> 202 / run_id、状态、frames / metrics；坏输入、未知 ID、结果未就绪、引擎错误都要有明确状态 / 错误与日志。runner 使用独立子进程与超时，拒绝覆盖已存在的 run 目录；API 默认 run ID 用 UUID，离线 suite 的 `t1_*` ID 只用于固定证据样例。

T1 只支持 constant storm（正的 5 分钟时长增量、总时窗 <24h）、clean direct-node entry、normal tailwater 的已验证案例；T2 接自定义参数时应显式校验支持范围，不要静默忽略 hyetograph / 非零 restriction / intervention。高 tailwater preset 虽可生成输入，尚未完成同等级 QA；非零入口限制依然留给 T3。storm 创建后要使用新 ID / 参数，持久化的 input hash 含完整渲染 .inp。更新 OpenAPI / examples / capabilities 并保留前端所用字段。

## 交接给 Jiajie

- 职责已确认：Tay 后端，Jiajie 前端。
- 已发布契约 `contracts/openapi.json` v1.0.0；消费约定见 `contracts/README.md`。可直接读取 `contracts/examples/assets.json` / `bootstrap.json`，和真实 API 同形状，来源始终为 synthetic / assumed。
- 已实现 `GET /api/health`、`GET /api/bootstrap`、`GET /api/townships/taman_kyra_demo/assets`。CORS 支持 `http://localhost:5173` 与 `http://127.0.0.1:5173`。
- T1 新增真实离线样例：`contracts/examples/{run,frames,metrics}-baseline.json`（80 mm/h）与 `...-stronger.json`（120 mm/h）。两者都降雨 3600s、总模拟 7200s、normal tailwater、clean direct-node entry。完整证据在 `data/validation/t1/`，不是 mock。可用于明确标为离线真实 SWMM 结果的回放。
- frames 为实际 .out 每 60s 的样本，共 120 帧，t=60..7200，没有伪造 t=0；native 指标包含 report 帧之间的短时事件。直接消费返回的 `status_definitions` / `metric_definitions`，不要用动画重新计算物理指标。
- 标准结果：baseline 溢流 0.014893m3、计数 1；stronger 溢流 728.764885m3、计数 6。baseline 的微小瞬态事件计数在半步长下变成 2，不宜当作稳定的洪点结论；请展示 `warnings`。所有输出仍为 synthetic 模型上的 simulated，`is_verified_site_model=false`。
- 启动（仓库根目录 PowerShell）：`.\services\api\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000`。完整安装 / 验证见 `md/BACKEND_SETUP.md`。HTTP smoke 用的临时服务已停止；当前不保证有后台 server。
- 资产：`township_id=taman_kyra_demo`，`model_version_id=taman_kyra_synthetic_v1`；9 nodes（含 `NODE-OUT01`），8 conduits，4 inlets；`INLET-D07 -> NODE-J07`。请按返回的节点连接生成 pipe geometry。
- `position_m` 为局部 east/north/elevation 米，Three.js 映射 `[x,z,-y]`；node 坐标为管底，inlet 坐标为地面 grate，两者高程不同。
- `bootstrap` 每项带 `parameters`，包含 80 / 120 mm/h、3600s 的 synthetic storm，normal / high 的 assumed tailwater，clean / 40% 的 D07 restriction 假设。它们当前只用于输入与 UI 开发；`debris_scenarios[].swmm_supported=false`。
- 请按 `bootstrap.capabilities` 禁用未可用的真实操作。目前只有 `assets=true`；storm_creation / simulations / inspections / debris / comparisons 均为 false。模拟请求、run、frames、metrics 已有 schema，但有效请求实际返回 `501 NOT_IMPLEMENTED`；坏请求返回统一 `422 VALIDATION_ERROR`，未知路径 / township 返回统一 404。`intervention` 暂时只接受 null。
- `/api/health.swmm.execution_verified=true` 现在表示当前引擎 / toolkit、resolved input hash 与保留的 T1 原始证据相匹配；bootstrap model `readiness=execution_verified` 表示离线模型已验证执行。它们不等于 HTTP simulation 可用，`capabilities.simulations` 仍为 false，直到 T2 完成。真实模式失败不自动降级。
- `hydraulic_inlet_clogging_fraction` 与 inspection visible coverage 独立。未来 pipe / node status 分别消费 `status_definitions`，inlet 状态独立；`surcharge_duration_s` 是“任一节点超载”的时间并集。

## 阻塞与待确认

- T0 / T1 无阻塞。Python 3.12.10、项目本地依赖、native SWMM 5.2.4 加载与完整模型执行已验证。
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

仍未运行：入口限制、debris 质量守恒、Docker、前端端到端联调；T2 HTTP 提交 / 持久化尚未实现。

## 最近实现记录

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
