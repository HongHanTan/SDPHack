# T2 / T3 → Jiajie：真实 API 接线与 G1 验收

2026-10-19，当前接口 v1.2.0。对照 Jiajie `1860feb` 检查；J1 的资产字段与 T1 离线结果已经对齐，以下为在线接线要求。T3 已新增 inspections / media / debris 与 finite inlet capture，详情及请求见 [T3_INTEGRATION.md](T3_INTEGRATION.md)。后端 HTTP / SWMM / 重启持久化已验证；浏览器中的 G1/G2 闭环仍待前端接线验收。

## 同步与启动

在 Jiajie 自己的 checkout 保存已有工作，然后在自己的分支执行：

```powershell
git fetch origin
git merge origin/main
```

按 [后端启动说明](../md/BACKEND_SETUP.md) 安装 Python、dev 与 SWMM 依赖。从仓库根目录启动：

```powershell
.\services\api\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

前端设置 `VITE_DATA_MODE=api`、`VITE_API_BASE_URL=http://127.0.0.1:8000`，确认页面实际选择 API 模式（localStorage 的已存模式会覆盖环境变量）。默认开发 runtime 为 `data/runtime/api`；不要把保留证据 `data/validation/t2/runtime` 当作开发数据库。

## 需要修改的前端接线

| 位置 | 当前行为（1860feb） | T2 接线要求 |
|---|---|---|
| `App.tsx::loadData` | `Promise.all` 总是调用 inspections 和固定离线 run | 先加载 health / bootstrap / assets；按 capabilities 决定附加接口。T3 inspections 已实现；固定离线 run 不能充当 API 结果 |
| `App.tsx` 默认参数 / HUD | 默认 `demo_inlet_40pct` | 该 ID 现在是 finite 40%；finite 对比默认选 `demo_inlet_capture_0pct` + normal。保留 direct-node `demo_inlet_clean` 为单独来源组，禁用不支持边界 |
| `App.tsx::handleRunSimulation` | POST 后立即读取 frames / metrics | 保存 POST 返回的 run_id，轮询状态到终态，成功后才加载结果 |
| `api/client.ts::createStorm` | 发送 `Partial<StormPreset>`，参数通常嵌套 | 新建独立 StormCreate 请求类型，发送下面的扁平 body；响应仍是嵌套 parameters |
| `api/client.ts::getSimulation*` | API 模式也按 `t1_` / `120mmh` 字符串返回本地 fixture | API 模式全部真实请求；离线真实 T1 回放通过独立、明确标识的入口读取 fixture，显示离线来源 |
| 初始化 / `handleLoadVerifiedRun` | 自动使用固定 `t1_baseline` / `t1_stronger` IDs | 新数据库没有这些 HTTP run。API 初始场景可以没有结果；提交新 run，或从真实 history 选择成功 run |
| 播放 / 提示 | T1 固定 120 帧 | 按返回 frames 的长度与 timestamp_s 播放；自定义 duration 会改变帧数。保留 warnings / assumptions / metric_definitions |

资产、坐标、frames、metrics 字段维持兼容，J1 的几何适配无需重做。`TailwaterPreset` 增加 `swmm_supported`；run 可读取顶层 storm/debris/tailwater IDs、时区时间戳和 evidence_references。以 `openapi.json` 为准。

## 请求与状态流程

预设 storm 可直接使用 `synthetic_80mmh_60min` 或 `synthetic_120mmh_60min`。自定义雨量先执行 `POST /api/storms`（201）：

```json
{"name":"Assumed rain 120 mm/h","intensity_mmh":120,"duration_s":3600,"source_type":"assumed"}
```

允许 constant 0..300 mm/h，duration 为 300..21600 秒且是 300 的倍数。使用响应中的新 storm_id 提交 `POST /api/simulations`（202）：

```json
{"model_version_id":"taman_kyra_synthetic_v1","storm_id":"<returned storm_id>","debris_scenario_id":"demo_inlet_clean","tailwater_case":"normal","intervention":null}
```

保存响应的 run_id，然后每约 500–1000ms 请求 `GET /api/simulations/{run_id}`：

1. `queued` / `running`：显示状态，继续轮询。不要请求结果。
2. `succeeded`：加载同一 run_id 的 `/frames` 和 `/metrics`，再开始播放。
3. `failed`：展示 run.error.code / message 与 evidence_references，停止轮询。

网络错误保持可见并提供重试。组件卸载、切换模式、选择其他 run 时取消旧轮询及过期响应；旧 API 结果不能覆盖新模式或另一个 run。用户改变参数后创建新 run，不修改旧结果或沿用旧 run_id。

| 响应 | 前端处理 |
|---|---|
| 409 `RESULTS_NOT_READY` | run 尚未成功，继续查询状态 |
| 409 `SIMULATION_FAILED` | 展示持久化失败原因 |
| 404 `NOT_FOUND` | ID 不属于当前数据库，显示错误 |
| 422 `VALIDATION_ERROR` / `UNSUPPORTED_SCENARIO` / `SCENARIO_STORM_MISMATCH` | 展示输入 / 能力错误；跨 storm 时新建 debris 场景，不启动假结果 |
| 429 `QUEUE_FULL` | 显示繁忙，允许稍后重试 |
| 500 `RESULT_ARTIFACT_INVALID` | 证据文件缺失或损坏，显示错误 |

`capabilities.simulations=true` 表示路由已实现；引擎缺失仍可能产生 failed / ENGINE_UNAVAILABLE。T3 inspections / debris 为 true；comparisons 为 false，high tailwater 留待后续实现。非零限制必须走明确的 native finite capture 场景，不能通过改变 UI 数字冒充输入变化。

## Jiajie 的浏览器验收（待执行）

- API 模式首次打开无需本地 fixture 或预设 run，9 nodes / 8 conduits / 4 inlets 正常显示；T3 的 inspections 按 capability 加载。
- clean / normal 下分别提交 80 与 120 mm/h，记录两个新 run_id；经历状态轮询后同一资产上的时间轴 / KPI 改变。60 分钟雨量各有 120 帧，t=60..7200s。
- 自定义 storm 创建后使用新 ID 提交；重启后端，history / storm / 结果仍可读取；旧 baseline 的 input_hash / 指标不变。
- 参考结果：80 mm/h 洪量约 0.014893m3，120 mm/h 约 728.764885m3。baseline 微小瞬态对步长敏感，展示返回的警告；全部为 synthetic network 上的 simulated，并非现场校准预测。
- 断开后端或提交不支持参数，页面显示真实错误；切换模式后不会残留另一个模式的结果或继续旧轮询。离线回放始终标识其来源。
- 运行 `npm run build`，把实际交互结果、run IDs 和发现的问题写入 Jiajie 自己的进度交接区。后端问题请附请求、状态码和 run_id，由 Tay 修复。

后端独立复现：仓库根目录执行 `.\services\api\.venv\Scripts\python.exe -m services.api.check_http`。它在独立端口和新 runtime 上执行真实 POST → 轮询 → 结果 → API 进程重启，不会修改开发数据库。已保留的验收证据见 `data/validation/t2/summary.json`；证据中的 UUID 不能用于新数据库。
