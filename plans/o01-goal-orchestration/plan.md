# O01 目标编排

编号：O01。创建/更新：2026-10-06。状态：in-progress。Owner：assignment_review / gpt-6-astra。父需求：[FLOW-001](../flow-001-architecture/plan.md)。

目标：保存用户原始目标、约束与验收，通过受限 Flow 工具操作已有 G01 计划图，按实际输入与依赖产物版本授权执行，保留验证及变更解释。整体目标包含未来原生 harness 的自然语言编排；当前首片段只验证真实 PG/HTTP/fixture 的命令受理和输入绑定。

已授权决定：复用 G01 节点/依赖及现有 task/verifier/C02；全局 revision 仅记录出处。每节点输入独立版本；固定依赖产物的授权与 task 受理原子提交。0 模型、0 云。不得把 fixture 或规则 verifier 视为自然语言理解/完整验收。

## TODO

- [ ] O01-01 固定 domain/受限工具合同、权限、幂等及版本规则，记录 SDK 实际 seam。
- [ ] O01-02 实现持久 goal、节点输入版本、原子命令受理和执行绑定，真实 HTTP/PG 验证。
- [ ] O01-03 真实 fixture runner 验证 diamond、独立分支、共同依赖替换、失败/不确定恢复边界。
- [ ] O01-04 完成有界纯工具 handlers、质量记录、证据与独立 review 交付。
- [ ] O01-05 后续原生 harness 自然语言编排及统一解释验收（依赖 E01 明确 harness/预算，本段不执行）。

## 范围及取舍

接口与取舍见 [设计](../../docs/architecture/o01-goals.md)。不创建通用 workflow 引擎，不改 G01/P02 核心、不改共享 exports/client/入口/锁；Lead 接线。没有自动重试或自动取消正在运行的旧输入任务。固定旧证据保留；当前交付资格通过实际输入及依赖版本判断。

完成条件：前四项须有固定代码、真实公开接口证据、clean-code 和独立审查；O01-05 未验证时整体保持 open。专用 flow_o01、动态端口、受控清理。当前技术决定已授权，无需重复审批。
