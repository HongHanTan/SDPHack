# Tay — 后端 / 数据 / SWMM 进度

Owner：Tay。只有 Tay 身份的 agent 更新本文件；Jiajie 读取交接区。

## 当前状态

- 最近更新：2026-10-19（分工初始化）。
- 当前任务：尚未开始实现。
- 当前接口版本：手册中的初始 v1 约定；`contracts/openapi.json` 尚未创建。
- 仓库基线：三份原始规划资料 + 团队执行文档，没有应用代码；下次执行需重新核实。

## 任务队列

| ID | 状态 | 当前交付 / 剩余工作 |
|---|---|---|
| T0 | TODO | FastAPI 基础、health / CORS、基础契约、asset fixture 与启动说明 |
| T1 | TODO | 尽早验证真实 SWMM、小型网络、baseline / 较强 rainfall 与结果解析 |
| T2 | TODO | storm、持久化、不可变 run、状态 / 错误、frames / metrics API |
| T3 | TODO | inspection / media、debris mass balance、inlet restriction 实际接入 |
| T4 | TODO | clean / upsize 比较、storage、统一 replay 执行链 |
| T5 | TODO | Docker / 复现、数值与 API 检查、假设说明、联调修复 |

## 下一次直接执行

读取 `AGENTS.md` 与 `md/TEAM_WORKFLOW.md`，核实代码与环境后开始 T0；同时尽早验证 T1 的 SWMM 安装 / 执行路径。先给前端可消费的基础契约与样例，不等待整个模拟后端完成。

## 交接给 Jiajie

- 职责已确认：Tay 后端，Jiajie 前端。
- 当前没有 API server / 已生成契约 / 真实结果；可以按团队手册 v1 在前端建立显式 mock。
- 后续在此记录：接口版本、可用 endpoints、样例路径、启动命令、需适配的变更。

## 阻塞与待确认

暂无已验证的技术阻塞；SWMM、Python、Docker 与依赖是否可用尚未检查。不得把“尚未检查”写成失败。

## 验证记录

当前没有应用代码验证记录。

## 最近实现记录

尚无。每次追加：任务 ID、修改文件、真实完成内容、验证命令 / 结果、剩余工作与下一步。
