# WPF-K02C01：项目身份与上下文元数据读取兼容

创建/更新：2026-10-06；状态：in-progress；唯一 owner：workspace_panels_owner / gpt-6-astra ultra。

目标：既有聊天能保留可选项目身份，严格核对创建回执；兼容旧中心省略字段及新中心上下文元数据。用户尚不能通过本片选择知识引用，本片不发 context 请求、不开放引用发送、不把元数据渲染成回答正文。O07 普通聊天 profile allowlist 不变。

输入为已集成 QUEUE 的固定 main `3d4985fca060155435b159e0467815bf8e88b8b8` 与 Lead 原样三契约补丁，独立输入提交 `e9a0259151fcb215e1bd607b5461d81412da2742`。补丁来源 `7368497ade6b80725e024d86541b87c971389476`，只代表接口准备，K02 领域后端未审、未在本片集成。见[输入验证](../../docs/evidence/wpf-k02-compatibility/input-verification.json)。

## 范围与方案

精确实现范围见 [status](status.md)，只有两个生产接缝与四个直接测试文件。projection.creationFields 和 selection.assertCreationReceiptMatches 同时保留 projectId presence/value；可选 knowledgeContext 只校验 boolean，不启功能。现有 outbox 已经解析并冻结完整 creation，排队/普通正文投影原样保留元数据；以回归核实，不扩生产模块。shared 三文件是 Lead 输入例外，不手改、无 export/client/backend/依赖变更。

验收：缺省/显式项目相同/不同/缺失/新增身份；CREATE 未知回执重试保持 key 与 payload；knowledgeContext 缺省/false/true 与非法值；turn/queue context 只保留元数据，正文不夹上下文且详情初始零请求；普通发送不暗加 knowledge；原 unknown/late ACK/gap 与 O07 allowlist 保持。

## TODO

- [x] WPF-K02C01-01：正式领取、固定输入逐文件哈希核验及技能应用。
- [ ] WPF-K02C01-02：修复项目身份保留与回执核对，兼容能力标记。
- [ ] WPF-K02C01-03：四直接测试文件与 Web typecheck，记录清码和限制。
- [ ] WPF-K02C01-04：固定实现、独立 review、dashboard 聚合与交 Lead；main 集成单列。

后继：知识引用选择/发送、citation 深冻结、context detail/正文展示、K02 后端运行验收不属于此片，须另领取。验证不运行模型/真实 DB，不创建新预览或停止旧服务。计划索引与聚合登记由 manager/Lead 单点维护。
