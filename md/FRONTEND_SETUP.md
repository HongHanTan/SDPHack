# Township FloodOps — 前端开发与运行指南 (Frontend Setup Guide)

> 维护者：Jiajie (前端 / 3D / 用户交互)  
> 技术栈：React 19 + TypeScript + Vite + Three.js / React Three Fiber (R3F) + Drei + Tailwind CSS

---

## 1. 快速启动

### 依赖环境
- Node.js >= 20 (已在 v24.14.1 验证)
- npm >= 10 (已在 11.11.0 验证)

### 安装与启动步骤

1. **进入前端应用目录并安装依赖：**
   ```bash
   cd apps/web
   npm install
   ```

2. **启动本地开发服务器（默认端口 5173）：**
   ```bash
   npm run dev
   ```
   打开浏览器访问 `http://localhost:5173`。

3. **构建生产版本并校验类型：**
   ```bash
   npm run build
   ```

---

## 2. 数据模式与后端对接 (Data Modes)

前端严格执行并行开发协议（`md/TEAM_WORKFLOW.md` 第 5 条与第 6 条）：

| 模式 | 环境变量配置 | 说明与行为 |
|---|---|---|
| **开发 Mock 模式** (默认) | `VITE_DATA_MODE=mock` | 使用 `src/mocks/fixtures.ts` 静态数据。页面顶部醒目标注“开发 Mock 模式，非 SWMM 结果”。 |
| **真实 API 模式** | `VITE_DATA_MODE=api` | 连接 FastAPI 后端（默认 `http://localhost:8000`）。若后端不可用或接口报错，**严格显示真实错误状态，不隐蔽降级为 mock 或伪造 SWMM 结果**。 |

### 动态切换模式
页面顶部状态栏右侧提供了 `[Mock] / [Real API]` 实时切换按钮，开发者可随时在界面上切换测试，选择会自动保存在浏览器的 `localStorage` 中。

---

## 3. 架构设计与目录结构

```
apps/web/
├── src/
│   ├── api/
│   │   └── client.ts            # 统一切换 Mock/Real API 的客户端实现
│   ├── components/
│   │   ├── StatusHeader.tsx     # 顶部状态栏（模式切换、SWMM 引擎健康状况、错误提醒）
│   │   ├── SceneViewer.tsx      # R3F 3D 住宅区数字孪生视口（节点、管网、进水口、地面上下文）
│   │   ├── SimulationHUD.tsx    # 水力工况设定、不可变 Run 执行、时间轴回放与指标卡片
│   │   ├── AssetDetailModal.tsx # 资产属性详情与现场巡检历史抽屉
│   │   └── InspectionModal.tsx  # 现场目测格栅覆盖率录入表单
│   ├── mocks/
│   │   └── fixtures.ts          # 严格符合团队 v1 契约的合成住宅区管网与模拟帧数据
│   ├── types/
│   │   └── index.ts             # 契约 TypeScript 定义（Asset, Conduit, Inlet, Frame, Metric 等）
│   ├── App.tsx                  # 核心交互状态管理与总控装配
│   ├── main.tsx                 # React 入口
│   └── index.css                # Tailwind 基础样式
├── .env.example                 # 环境变量模板
├── package.json
└── vite.config.ts               # Vite 构建配置（端口 5173）
```

---

## 4. 坐标与数据规范

- **局部坐标系：** 资产数据中的 `position_m: {x, y, z}` 分别为东、北、高程（米）。
- **Three.js 映射：** 集中通过 `toThreeCoords` 转换为 `[x, z, -y]`，禁止组件内部硬编码魔数。
- **数据来源标识：** 始终区分 `observed`、`synthetic`、`assumed` 与 `simulated`，不将合成住宅区伪装为现场实测。
