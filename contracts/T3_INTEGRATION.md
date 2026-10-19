# T3 → Jiajie：inspection / media / debris / native inlet capture

接口 v1.2.0；T3 后端已本地验证，Git 发布状态以 `md/progress/tay.md` 为准。没有修改前端或 Jiajie 进度。既有资产 / run / frames / metrics 主字段保留；新增字段见 OpenAPI。G2 浏览器体验仍由 Jiajie 接线验收。

## 1. 保存巡检与证据

`POST /api/inspections` → 201，字段形状兼容已有表单，但必须提供带时区的采集 `timestamp` 和明确 `source_type`：

```json
{
  "asset_id":"INLET-D07",
  "timestamp":"2026-10-19T01:00:00Z",
  "inspector":"Demo inspector",
  "method":"visual",
  "source_type":"synthetic",
  "visible_grate_coverage_fraction":0.65,
  "debris_category":"leaf_litter",
  "notes":"Illustrative virtual inspection, not a site observation.",
  "source_reference":"Virtual demonstration"
}
```

采集时间保留为 UTC，另存服务器 created_at；省略时区或未知 asset 返回 422 / 404。source_type 不会被后端自动改成 observed；3D 虚拟巡检使用 synthetic，现场观察才由用户声明 observed。`is_verified_site_model=false` 始终保留。coverage 可为 null，但只允许 inlet 上的数值覆盖率；pipe / node 巡检不能填 grate coverage。

`GET /api/inspections?asset_id=INLET-D07&limit=50` 返回 `{items:[]}`，按采集时间降序。`GET /api/inspections/{inspection_id}` 返回单条及媒体。原记录不可修改或删除；再次巡检新增记录。

`POST /api/inspections/{inspection_id}/media` → 201，使用 multipart 字段 `file`。支持 PNG / JPEG / WebP / PDF，单文件 ≤10 MiB，检查内容签名与 MIME；不支持任意 URL 代替文件。每次上传生成新 media_id，保留原文件名、字节数、SHA-256、来源、created_at 和 `url`。同名追加不会覆盖旧附件。返回的 `url` 可 GET 下载原字节；缺失 / 损坏时 500 MEDIA_ARTIFACT_INVALID，保留原元数据。

前端用 FormData 时必须省略 JSON Content-Type，让浏览器设置 multipart boundary；现有 ApiClient 的通用 JSON header 需要为上传另行适配：

```typescript
const body = new FormData();
body.append('file', file);
// Use the configured API base URL and the existing visible-error handling.
const response = await fetch(`${baseUrl}/api/inspections/${inspectionId}/media`, {
  method: 'POST', body,
});
```

记录的 `media` 是结构化元数据，`media_urls` 为兼容现有 UI 的 URL 列表。这些 URL 相对 API base URL，前端预览 / 下载时应拼接 API 地址，不能直接当作 Vite 前端 origin 的路径。添加媒体后重新 GET inspection 刷新。附件继承 inspection 的来源，不是 CV 输出；当前不实现图像识别或内容真实性校验。

## 2. 创建独立的 debris 假设

`POST /api/debris/scenarios` → 201，发送扁平请求；现有 `Partial<DebrisPreset>` 的嵌套请求需要适配。inspection_id 可省略，提供时必须与 inlet_id 相同：

```json
{
  "name":"D07 assumed 40% capture loss",
  "inlet_id":"INLET-D07",
  "storm_id":"synthetic_120mmh_60min",
  "inspection_id":"<saved inspection_id>",
  "hydraulic_inlet_clogging_fraction":0.4,
  "debris_parameters":{
    "initial_surface_kg":2,
    "initial_retained_kg":0,
    "loading_kg_per_day":0.2,
    "wash_off_per_mm":0.03,
    "capture_fraction":0.6,
    "cleaning_events":[
      {"timestamp_s":1800,"surface_removal_fraction":0.5,"inlet_removal_fraction":0.5}
    ]
  }
}
```

hydraulic loss 为独立常量假设，范围 0..0.6，可选 0 / 0.2 / 0.4 / 0.6；**不是可见覆盖率，也不是 retained kg 的换算值**。返回 `source_type=assumed`、`parameters.parameter_status=assumed_not_calibrated`。mass balance 使用固定 60s 步长，单位 kg，输出 t=0..雨时长+3600s 的 calculated `time_series`；可直接驱动 debris 曲线 / 示意动画，不从粒子数量反推质量。

Cleaning event 必须位于此窗口内、为唯一正 60s 边界。它移除指定质量份额，但不自动改变该场景的常量 hydraulic loss；若要比较清理后的水力情景，需要另建 0% 场景。质量模型中的 capture_fraction 是“杂物质量截留份额”，不是 SWMM 的收水效率。

`GET /api/debris/scenarios/{id}` 查询已创建记录；bootstrap 列出 preset 与创建记录的摘要。场景冻结完整 storm、inspection 与当时媒体元数据/hash；后来追加 inspection 媒体不会更改旧场景。自定义场景绑定其 storm_id，换雨必须新建场景；跨 storm 提交返回 422 SCENARIO_STORM_MISMATCH。无 inspection 引用时仍明确标为 assumed。

## 3. 运行与回放

使用新 debris_scenario_id 按 T2 流程 POST simulation → 轮询 → 终态 → frames / metrics。high tailwater 和 intervention 仍不可用。只有选中的 inlet 施加限制，其他三个 inlet 用相同有限 capture 模型的 0% 假设。

无需先建自定义记录也可选 bootstrap 的 finite sensitivity presets：

| ID | 假设 |
|---|---|
| `demo_inlet_capture_0pct` | finite capture，0% loss，对比基线 |
| `demo_inlet_capture_20pct` | finite capture，20% loss |
| `demo_inlet_40pct` | finite capture，40% loss，保留既有 ID |
| `demo_inlet_capture_60pct` | finite capture，60% loss |
| `demo_inlet_clean` | 保留 T1/T2 unlimited direct-node baseline，属于不同收水模型 |

按 `capture_model` 区分这两组。不要把旧 `demo_inlet_clean` 与有限 40% 直接解释成清理效果。finite 组必须使用相同雨量、边界，与 finite 0% 比较；preset 自身不带巡检或质量时间序列，需要这些 provenance 时走 POST 创建流程。

对外仍为 9 nodes / 8 sewer conduits / 4 inlets；所有辅助 surface nodes / links 只存在于不可变 `input_snapshot.inlet_model.elements` 中，明确映射到 inlet/sewer IDs。不要把这些数值辅助元素画成新增现场资产。

新增结果：

- `frame.inlet_states[].capture_flow_m3s`、`bypass_flow_m3s`：native finite 模式的实际 60s 报告样本；direct-node 模式为 null，不伪造 0。
- `metrics.inlet_volumes[]`：各 inlet 全部 routing steps 的 captured / backflow / surface bypass m3；direct-node 为 null。旁路出口包含经入口返回地表的 sewer backflow。
- 原 `total_flooding_volume_m3` 继续是 native 节点 overflow 统计，不包含全部 bypass；不要把其下降解读为总地表风险下降。同时展示 bypass 与 warnings。没有计算街道二维积水深度或面积。

固定 120 mm/h、60 min、normal 的实际 D07 验证结果：

| Loss | Captured m3 | Surface bypass m3 |
|---:|---:|---:|
| 0% | 741.777064 | 389.679076 |
| 20% | 593.429322 | 537.984428 |
| 40% | 445.071560 | 686.348132 |
| 60% | 296.698003 | 834.683663 |

这些是 synthetic channels + assumed diversion curve 上的实际 SWMM 5.2.4 结果，不能当作现场预测。完整假设见 [MODEL_ASSUMPTIONS.md](../md/MODEL_ASSUMPTIONS.md)。

## 4. 接线验收与复现

Jiajie：在 API 模式保存 synthetic inspection → 上传文件 → 刷新/重启后重读 → 独立选择 hydraulic loss → 创建场景 → POST 真实 run → 轮询 → 在同一组资产回放，并显示 inspection/media、质量时间序列、capture/bypass、输入假设与警告。相同 storm 下比较 finite 0/20/40/60，记录实际 run IDs；失败保持可见，不回退 fixture。G1 中的 API/offline 混用与轮询问题仍需按 [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md) 处理。

后端独立复现：`.\services\api\.venv\Scripts\python.exe -m services.api.check_t3`。使用独立 runtime/临时端口，执行实际 TCP 链、新进程重启、独立重复与半步长检查；停止自己的子进程，不修改开发数据库。

长期证据：`data/validation/t3/summary.json` 与同目录原始文件/SQLite/日志。`contracts/examples/{inspection-*,media-created,debris-*,native-inlet-*}.json` 来自该证据，UUID 只属于证据 runtime，新数据库需自行 POST。synthetic-pixel.png 只是上传完整性测试像素，不是现场照片。
