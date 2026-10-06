# WPF-QUEUE00 — 队列能力读取兼容

创建/更新：2026-10-06 04:46 UTC。状态：completed。Owner：workspace_panels_owner / gpt-6-astra ultra。

本轮是 CHAT04 后台发布前的最小兼容片段：旧中心 `queue:false` 与新中心 `queue:true` 都能加载会话、接收 CREATE receipt 并继续已支持的普通 follow-up。不能仅因后台宣告 queue 自动启用本 Web 尚未实现的排队/steer/UI；活动执行期间保持发送门禁。当前不实现 pause/resume、队列管理、取消组合或本地自动 promote。

固定基线：75a33dec228e17bbbd0d3be9fd01bc9ac18a0133。新独立 worktree/branch 与正式 D04 receipt 见 [status](status.md)。写入仅 projection、直接 projection 测试及本计划/证据目录，公共 contracts/client、Thread、App、outbox、旧 fixture 不改。共享类型仍可能 literal false；测试在 wire seam 明确模拟新 boolean，不能借类型转换伪造后台已集成。

方案：在现有 capabilities 校验中仅将 queue 限制调整为 boolean，其余尚不支持能力继续要求 false。对活动 turn 的提示明确为“此 Web 版本未提供”，不将 true 中心说成无能力。通过现有公开 projection interface 测加载、创建回执、后续发送、活动阻挡、非法 wire 值与幂等/历史回归，不另造兼容模块。

## TODO

- [x] WPF-QUEUE00-01 核固定基线、独立树、live claim 与本地技能，建立唯一三件套。
- [x] WPF-QUEUE00-02 修复 boolean 能力读取，保留其它能力及发送限制。
- [x] WPF-QUEUE00-03 false/true 与直接回归、typecheck、clean-code 证据。
- [x] WPF-QUEUE00-04 固定候选独立 review、dashboard 聚合与交付 Lead 集成。

完成标准：局部行为验证通过、正式 review 绑定实现 SHA；分支通过与 main 集成分别记录。0模型/DB，不启动新产品预览，所有既有服务保留。最小读取兼容不等于 CHAT04 完整 UI 或后台联合部署验收。
