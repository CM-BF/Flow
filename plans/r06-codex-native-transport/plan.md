# R06 原生 Codex 传输与生命周期

状态：in-progress。创建 / 更新：2026-10-06。所属大task：[FLOW-002](../flow-002-provider-harness/plan.md)。co-lead：Execution Lead。唯一 owner：runner_owner / gpt-6-astra。

## 边界与方案

遵循[统一模块规则](../../AGENTS.md#modular-design)。本片是有界 JSONL 子进程传输，不拥有 agent loop、模型目录、回合完成、授权或 Flow 状态。后继 adapter 组合本模块；不改变 configuration/main/runtime/contracts/dependencies。

选独立小模块 + 实际合成子进程；不引通用 RPC 框架，不复制 Paseo decoder/长期 timeout。模块内区分 UTF8 帧、写队列背压、进程与请求生命周期；唯一公开入口详见 [Interface](../../docs/evidence/r06/interface.md)。

固定参考为本机 Codex 0.154.0 stable 生成声明。只证明所声明的 envelope/initialize 顺序，不启动真实 app-server/auth/provider。已授权检查 seam：公开 transport API ↔ 自有 Node stdio 子进程；真实分片、压力、超时、断线和清理。

## TODO

- [x] R06-01 固定 scope、Interface、来源与技能记录。
- [x] R06-02 实现有界传输/初始化/关联/背压/退出语义。
- [x] R06-03 公开边界合成子进程行为检查、typecheck、清理证据。
- [x] R06-04 固定实现与 manifest、独立 review、集成。
- [ ] R06-05 后继真实 app-server/adapter conformance（不在本片验收内）。

## 风险与非目标

退出仅说明本地 owned child 状态，不能证明远端副作用撤回。传输不是 OS 沙箱；spawn 可执行文件由受信宿主提供，生产凭据/登录配置另审。请求 timeout/abort 后已送出的操作是 unknown，不重发。stdout 严格协议、stderr 仅计字节不保存原文。容量为硬内存/协议上限，不是 provider/agent 吞吐结论。
