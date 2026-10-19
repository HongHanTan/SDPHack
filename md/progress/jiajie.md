# Jiajie — 前端 / 3D / 交互进度

Owner：Jiajie。只有 Jiajie 身份的 agent 更新本文件；Tay 读取交接区。

## 当前状态

- 最近更新：2026-10-19
- 当前任务：J0 已完成，J1 基础视口与数据驱动资产已就绪
- 当前接口版本：手册中的初始 v1 契约约定；前端 types、fixture 与 client 完全对齐
- 仓库基线：`apps/web` 独立工程建立完成，构建验证通过，文档已建立

## 任务队列

| ID | 状态 | 当前交付 / 剩余工作 |
|---|---|---|
| J0 | DONE | React 19 / TS / Vite 6、R3F / Drei、Tailwind、API client、显式 mock / api 模式与启动说明已完成并通过构建验证 |
| J1 | IN_PROGRESS | 3D 住宅区底座与网格已就绪，已实现数据驱动的 nodes / inlets / pipes / 资产选择与详情抽屉；后续补齐地形/地表精细化模型 |
| J2 | TODO | storm 控件、run 轮询、结果播放 / 图例 / KPI，随后接真实 API |
| J3 | TODO | inspector 动画、inspection / media / evidence、virtual debris lab |
| J4 | TODO | Diagnose / Anticipate、intervention comparison、proposed action |
| J5 | TODO | 完整联调、布局 / 演示、README、三分钟 demo runbook |

## 下一次直接执行

继续推进 J1 / J2：
1. 细化 3D 住宅区街区与道路高程视觉，优化地下管网透视。
2. 完善场景工况切换与真实 API 轮询逻辑（接 T0 / T1 / T2 结果）。
3. 扩展时间轴多指标曲线与历史 Run 比较视图。

## 交接给 Tay

- 前端工程已在 `apps/web` 建立完毕，运行端口为 `5173`。
- API Base URL 默认为 `http://localhost:8000`，请在 FastAPI 中配置针对 `http://localhost:5173` 的 CORS。
- 前端支持顶部右上角一键切换 `[Mock] / [Real API]` 模式，并在 `localStorage` 记忆选择。
- 在 Real API 模式下，若后端连接失败或报错，前端会显示错误横幅，**绝不自动隐蔽降级为 mock 或伪造 SWMM 结果**。
- Tay 产出 T0 的 `GET /api/health`、`GET /api/bootstrap`、`GET /api/townships/{id}/assets` 后请在 `md/progress/tay.md` 通知，前端切到 API 模式即可联调。

## 阻塞与待确认

- 暂无前端内部技术阻塞。
- 等待 Tay 交付 T0 基础契约接口与 T1 / T2 真实 SWMM 模拟结果。等待期间 Jiajie 继续推进 J1/J2 的独立 UI 与交互组件。

## 验证记录

- **依赖安装验证：** `cd apps/web && npm install`，安装 147 个依赖包，0 漏洞，耗时 53s，退出码 0。
- **构建与类型验证：** `cd apps/web && npm run build`（执行 `tsc -b && vite build`），2501 个模块转换成功，输出 `dist/`，退出码 0。

## 最近实现记录

- **2026-10-19 [J0 完成，J1 启动]：**
  - 新建 `apps/web/package.json`：配置 React 19, Three.js, @react-three/fiber, @react-three/drei, Tailwind CSS, Lucide icons, Vite 6。
  - 新建 `apps/web/src/types/index.ts`：依照 `md/TEAM_WORKFLOW.md` 第 6 节严格定义 v1 契约类型（资产、工况、模拟帧、指标、巡检）。
  - 新建 `apps/web/src/mocks/fixtures.ts`：包含 10 个节点、12 条管段、4 个进水口（含重点 `INLET-D07`）、完整 3600s 模拟帧及巡检记录。
  - 新建 `apps/web/src/api/client.ts`：支持 Mock/API 模式无缝切换与真实错误拦截。
  - 新建 `apps/web/src/components/StatusHeader.tsx`：模式展示、Mock 警告、引擎健康指示与模式切换器。
  - 新建 `apps/web/src/components/SceneViewer.tsx`：Three.js 3D 数字孪生，遵守 `[x, z, -y]` 坐标映射规范，支持交互选择。
  - 新建 `apps/web/src/components/SimulationHUD.tsx`：时间轴回放、雨量/堵塞/尾水工况选择、KPI 指标卡与图例。
  - 新建 `apps/web/src/components/AssetDetailModal.tsx` & `InspectionModal.tsx`：资产详情抽屉与巡检记录填报。
  - 新建 `apps/web/.gitignore`、`md/FRONTEND_SETUP.md` 与根目录 `README.md`。
  - 运行 `npm run build`，通过编译。
