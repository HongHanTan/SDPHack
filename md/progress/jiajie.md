# Jiajie — 前端 / 3D / 交互进度

Owner：Jiajie。只有 Jiajie 身份的 agent 更新本文件；Tay 读取交接区。

## 当前状态

- 最近更新：2026-10-19
- 当前任务：J0、J1、J2、J3 全部完成；下一项 J4：Diagnose / Anticipate 模式、清淤 (Clean) 与扩径 (Upsize) 方案对比及可追溯 Proposed Action 展示
- 当前接口版本：`1.1.0`，已与 Tay 发布的 T2 异步仿真轮询机制、`contracts/openapi.json` 及 `contracts/FRONTEND_INTEGRATION.md` 全面接通
- 仓库基线：已从 `origin/main` 合并至 `c6c847b`，通过前端完整编译与打包测试

## 任务队列

| ID | 状态 | 当前交付 / 剩余工作 |
|---|---|---|
| J0 | DONE | React 19 / TS / Vite 6、R3F / Drei、Tailwind、API client、显式 mock / api 模式与启动说明已完成并通过构建验证 |
| J1 | DONE | 采用权威 9 nodes / 8 conduits / 4 inlets 几何；物理落深检查井（ground 至 invert）、出水口 Headwall、进水口地表标定、视角预设切换（全貌/D07/出水口/上游）与资产属性抽屉 |
| J2 | DONE | 接入 120 帧高解析度时间轴（t=60s..7200s）、1x/2x/5x 播放速度、SWMM 5.2.4 权威基线（80mm/h）与极端（120mm/h）离线结果即时回放、KPI 卡片与物理阈值说明 |
| J3 | DONE | 3D 巡检员数字身与扫描动画、现场照片证据附录、Virtual Debris Lab（喉口剖面、0/20/40/60% 假说切换、现场可见覆盖率与水力折减率分离看板）；接通 T2 异步轮询与 capabilities 守卫 |
| J4 | TODO | Diagnose / Anticipate、clean / upsize / storage 方案对比与 proposed action |
| J5 | TODO | 完整端到端联调、演示稳定性、README、三分钟 demo runbook |

## 下一次直接执行

执行 J4：
1. 建立 Diagnose（事故复盘 / 现状诊断）与 Anticipate（极端天气预测预警）双模式视口。
2. 实现 Interventions 方案对比视图：
   - 对比 Baseline、Cleaned Inlet（消除 D07 限制）与 Upsized Conduit（PIPE-P07/P08 扩径）；
   - 展示溢流总量削减、超载时长缩短指标对比条形图；
   - 形成带有现场照片与水力仿真证据溯源的 Proposed Maintenance / Engineering Action 建议报告。

## 交接给 Tay

- 前端已与 main 保持完全一致，并完成 J3 与 T2 协议接线：
  - **异步仿真轮询已闭环**：`POST /api/simulations` 获取 `run_id` 后，以 800ms 间隔轮询 `GET /api/simulations/{run_id}`，优雅处理 409 `RESULTS_NOT_READY`，终态 `succeeded` 后自动拉取 `/frames` 和 `/metrics`，失败则明确展示 `run.error.message`。
  - **初始化守卫健全**：按 `bootstrap.capabilities` 决定请求；在 `capabilities.inspections=false` 时走前端本地持久化证据库，彻底消除初始化 404。
  - **工况合法性遵循**：默认工况使用 `demo_inlet_clean` + `normal`，不向 T2 后端触发非零限制的 422 `UNSUPPORTED_SCENARIO`。
  - **杂物实验室概念严格隔离**：现场 65% 格栅覆盖率保存在现场证据中，0/20/40/60% 折减率保存在水动力学假说中，界面提供醒目的概念区分警示。
- 当 Tay 在 T3 交付真实入口限制（Supported Inlet Restriction）与 Debris Mass Balance 接口时，前端实验室的折减假说滑块即可直连后端写入不可变 Run 快照。

## 阻塞与待确认

- 暂无前端内部阻塞。
- G1 真实在线水动力学闭环在启动本地 FastAPI 服务（端口 8000）后可立即验证；J4 方案对比 UI 可与 T3/T4 后端并行开发。

## 验证记录

- **构建与类型验证：** 在 `apps/web` 下执行 `npm run build`（`tsc -b && vite build`），2511 个模块转换成功，0 错误，耗时 10.24s，输出 `dist/`，退出码 0。
- **交互验证：**
  - 点击 3D 场景中的巡检员或顶部“★ 进水口虚拟实验室”按钮，即刻弹出 `VirtualDebrisLab` 弹窗；
  - 自由切换 0%、20%、40%、60% 折减率预设，喉口过水截面阻水层动态重绘；
  - 切换至“现场照片与巡检证据”标签，可查阅照片证据档案与打卡时间；
  - 点击“录入新巡检”，录入带照片预览与经纬度水印的巡检记录，自动同步至本地持久化数据库。

## 最近实现记录

- **2026-10-19 [J3 完成]：**
  - 新建 `src/components/InspectorAvatar.tsx`：身着高反光安全服的 3D 巡检员数字身，配备地面雷达波扫描动画、手持发光平板与 2D 悬浮打卡交互 HUD。
  - 新建 `src/components/VirtualDebrisLab.tsx`：
    - 针对 `INLET-D07` 的局部特写实验室；
    - 喉口过水截面（1.8m × 0.15m）示意图与动态阻水层表现；
    - 0%（清淤）、20%（微淤）、40%（核查条件）、60%（极端卡口）折减假说切换器；
    - 严格落实“目测格栅覆盖率 ≠ 水力收水折减率”概念隔离看板；
    - 杂物组分分析（阔叶枯枝 60%、泥沙 25%、生活垃圾 15%）；
    - 历史现场照片与证据档案回放。
  - 更新 `src/components/InspectionModal.tsx`：增加现场照片证据附录预览与防伪水印标识。
  - 更新 `src/components/SceneViewer.tsx`：在 `INLET-D07` 旁挂载 `InspectorAvatar`，并在顶部预设栏增加实验室快捷入口。
  - 更新 `src/api/client.ts` 与 `src/App.tsx`：
    - 按照 `contracts/FRONTEND_INTEGRATION.md` 实现 T2 异步仿真轮询处理循环（800ms 周期，处理 409 状态）；
    - 修复初始化 inspections 守卫，避免在能力未开放时产生 404；
    - 默认工况采用 clean + normal，避免 422 错误。
  - 运行 `npm run build`，编译打包无任何错误。
