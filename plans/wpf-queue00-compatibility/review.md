# WPF-QUEUE00 独立审查

**状态：NOT_STARTED**

Review target commit：5acc5b1bde23e9c587a4580da55a75340811ecdd

Base：75a33dec228e17bbbd0d3be9fd01bc9ac18a0133。
Scope：apps/web/src/conversations/projection.ts、apps/web/test/conversation-projection.test.ts。

验收：false/true加载与CREATE receipt都可用；普通follow-up mode/keys不变；活动turn仍不能发送，不能自动queue/steer/promote；其它能力及非法queue仍明确拒绝；原未知ACK/历史gap/连接隔离行为不回退。

可复制审查说明：先核本worktree/branch/dirty与指定target，按base→target只读审查两个文件，运行直接projection tests和必要typecheck；不要改产品、不要调用模型或停止他人服务。findings记录severity/触发/行号并交唯一owner修复，结论只绑定固定SHA。本模板未执行不代表通过。

作者检查：26 projection + 9 outbox、Web typecheck通过，见[validation](../../docs/evidence/wpf-queue00/validation.md)。已执行独立检查：无。Blocking findings：未知。修复/复审：尚无。后台CHAT04/UI/真实中心联合部署均不在本片验收范围。
