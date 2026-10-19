# Township FloodOps

> **3D Hydraulic Digital Twin for Urban Township Stormwater & Debris Management**  
> An engineering platform that bridges field inspection evidence, EPA SWMM 5.2 hydraulic simulation, and interactive 3D twin visualization to diagnose surcharge bottlenecks, anticipate severe monsoon choke points, and evaluate proposed maintenance/capital interventions.

---

## 团队分工与架构 (Team Architecture)

本项目由 Tay 与 Jiajie 协作并行开发：

| 模块 / 领域 | 负责人 | 职责与归属路径 |
|---|---|---|
| **后端 / 数据 / SWMM** | **Tay** | `services/api/**`, `simulation/**`, `contracts/**`, `md/BACKEND_SETUP.md`, `md/progress/tay.md` |
| **前端 / 3D / 交互** | **Jiajie** | `apps/web/**`, `md/FRONTEND_SETUP.md`, `md/progress/jiajie.md`, `README.md` |

协作规则与接口标准详见 [团队分工与执行规则 (TEAM_WORKFLOW.md)](md/TEAM_WORKFLOW.md)。

---

## 快速开始 (Quickstart)

### 1. 前端 3D 数字孪生 (Web 3D Twin)

进入前端工作目录并启动开发服务器：

```bash
cd apps/web
npm install
npm run dev
```

浏览器访问：`http://localhost:5173`。

- 默认以 **开发 Mock 模式** 启动，无需安装配置 Python 或 SWMM 编译环境，即可完整体验 3D 住宅区街景视口、120 帧高解析度水力回放、巡检员现场打卡、杂物实验室与方案对比决策。
- 顶部支持一键切换至 **Real API 模式** 对接本地 FastAPI 后端 (`http://localhost:8000`)。
- 详细说明请参见 [前端开发与运行指南 (md/FRONTEND_SETUP.md)](md/FRONTEND_SETUP.md)。

### 2. 评委与路演演示演练 (3-Minute Pitch Runbook)

完整 3 分钟路演故事线、台词配搭与界面点击动作请参见：  
👉 [**三分钟演示剧本 (md/DEMO_RUNBOOK.md)**](md/DEMO_RUNBOOK.md)

---

## 核心设计原则

1. **真实物理引擎为准：** 采用 EPA SWMM 5.2 求解非定常水动力学；前端 3D 负责沉浸式场景表现与交互映射，不凭空伪造负荷计算。
2. **证据与假设显式区分：** 现场照片记录的“格栅表面覆盖率（65%）”与水动力学模型的“水力收水折减假设（40%）”分别存储并明确标识来源。
3. **真实模式错误透明暴露：** 真实 API 连接失败或引擎报错时明确在界面呈现错误体，绝不隐蔽回退至 mock 数据。
4. **数字孪生环境对齐：** 3D 场景忠实还原 Taman Kyra 联排住宅街区、沥青道路、绿化带、调蓄水景湖与出水明渠。
