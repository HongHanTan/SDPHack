# Jiajie — 前端 / 3D / 交互进度

Owner：Jiajie。只有 Jiajie 身份的 agent 更新本文件；Tay 读取交接区。

## 当前状态

- 最近更新：2026-10-19（分工初始化）。
- 当前任务：尚未开始实现。
- 当前接口版本：手册中的初始 v1 约定；后端 OpenAPI 尚未发布。
- 仓库基线：三份原始规划资料 + 团队执行文档，没有应用代码；下次执行需重新核实。

## 任务队列

| ID | 状态 | 当前交付 / 剩余工作 |
|---|---|---|
| J0 | TODO | React / TS / Vite、R3F、API client、显式 mock / api 模式与启动说明 |
| J1 | TODO | 3D 住宅区、图层、数据驱动的网络、asset 选择 / 详情 |
| J2 | TODO | storm 控件、run 轮询、结果播放 / 图例 / KPI，随后接真实 API |
| J3 | TODO | inspector、inspection / media / evidence、virtual debris lab |
| J4 | TODO | Diagnose / Anticipate、intervention comparison、proposed action |
| J5 | TODO | 完整联调、布局 / 演示、README、三分钟 demo runbook |

## 下一次直接执行

读取 `AGENTS.md` 与 `md/TEAM_WORKFLOW.md`，核实代码与环境后开始 J0 / J1。用手册 v1 建立前端 types / fixtures，醒目标识 mock，不等待 SWMM 或 API；暂时缺少的权威几何由前端临时 layout 替代，接入后端后用返回的 assets。

## 交接给 Tay

- 职责已确认：Tay 后端，Jiajie 前端。
- 前端将使用 `5173`，默认 API base URL `http://localhost:8000`；请提供本地 CORS 与 assets / run / frames / metrics 的样例。
- 后续在此记录：已消费的契约版本、复现请求、预期 / 实际响应、缺少的字段。

## 阻塞与待确认

尚无阻止 J0 / J1 的已知阻塞；真实模式联调依赖 Tay 的契约与 T1 / T2 结果，先做独立 UI 任务。

## 验证记录

当前没有应用代码验证记录。

## 最近实现记录

尚无。每次追加：任务 ID、修改文件、真实完成内容、验证命令 / 结果、剩余工作与下一步。
