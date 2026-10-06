# WPF-RELEASE01 真实产品 Web 发布兼容验证

状态：in-progress。创建/更新：2026-10-06 10:28 UTC。父任务：[WPF-MATURE-01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-01-visual/plan.md)。沿[模块规则](../../AGENTS.md#modular-design)。

在隔离随机 PostgreSQL、动态端口、零 provider 的受控 runner 上，用真实产品旧 Web 与新 Web 检查固定旧后台。旧 Web / backend：b1c2e39837c2208e6fc2c59a80e16797f26448b5；新 Web / SVC 工具输入：8d8ab520a9d43c7b9dafb22911416ee799ebf665。两套构建来自 clean detached 固定输入，VITE_FLOW_FIXTURE=false，不用 miniWeb 或直接调用函数替代页面发送。

## Interface 与边界

fixture 模块拥有两构建产物、随机专库/owner marker、真实中心、合成 runner、代理故障与清理；返回浏览器所需局部 URL、临时身份、已发布 profile、产物 descriptor 和受控结束方法。browser 模块通过产品连接表单、官方 Composer 和恢复入口验证 read/send/recover/negotiation，用网络原字节核原 key/body/turn。结果按 SVC04 的四 JSON 及 report hash 格式导入自有私有目录。每文件不超过4KiB；完整协议证据另存，无 token/连接串。工具仅复用不修改。

依赖：Node24、pnpm9.15.4、当前Playwright、PG、固定server/runtime和SVC04工具；无新增依赖。不操作个人61227/61228、个人凭据、已有服务/标签；不调用SDK/provider。所有临时资源有上限、own marker、finally清理；失败保留原记录而不签发兼容报告。性能数不是本片目标，provider能力也不由合成adapter推断。

## TODO

- [ ] RELEASE01-01 构建真实双版本产品与隔离后台/runner，记录来源及资源清理。
- [ ] RELEASE01-02 浏览器验证四项真实旅程，生成原始hash绑定的兼容报告。
- [ ] RELEASE01-03 独立review、向主线交可复现证据；个人发布由Lead另行执行。

范围只含两个新测试脚本及本plan/evidence。完整用户视觉/全部接口/未来版本兼容不在本检查内；没有证据的协商项不得填true。
