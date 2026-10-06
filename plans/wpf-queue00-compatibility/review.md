# WPF-QUEUE00 独立审查

**状态：APPROVED**

Review target commit：5acc5b1bde23e9c587a4580da55a75340811ecdd

Base：75a33dec228e17bbbd0d3be9fd01bc9ac18a0133。
Scope：apps/web/src/conversations/projection.ts、apps/web/test/conversation-projection.test.ts。

验收：false/true加载与CREATE receipt都可用；普通follow-up mode/keys不变；活动turn仍不能发送，不能自动queue/steer/promote；其它能力及非法queue仍明确拒绝；原未知ACK/历史gap/连接隔离行为不回退。

可复制审查说明：先核本worktree/branch/dirty与指定target，按base→target只读审查两个文件，运行直接projection tests和必要typecheck；不要改产品、不要调用模型或停止他人服务。findings记录severity/触发/行号并交唯一owner修复，结论只绑定固定SHA。本模板未执行不代表通过。

作者检查：26 projection + 9 outbox、Web typecheck通过，见[validation](../../docs/evidence/wpf-queue00/validation.md)。已执行独立检查见下文。Blocking findings：无。修复/复审：本片未产生需修复finding。后台CHAT04/UI/真实中心联合部署均不在本片验收范围。

## 正式独立结论

Root / gpt-6-astra ultra，限定 **APPROVED** 固定target 5acc5b1bde23e9c587a4580da55a75340811ecdd / base 75a33dec228e17bbbd0d3be9fd01bc9ac18a0133。完整读2文件实现/测试差异；独立35 projection+outbox测试于2026-10-06 04:45:45 UTC PASS（336ms）；04:48:10 UTC核固定实现diffcheck0、HEAD afd308f352a0c62db8eefb24795ad1befcef10f5 clean，后续仅自身metadata。

boolean queue可接受且busy send仍禁止，无公共合同/driver/outbox/Thread/App变化。旧Thread两处“center不支持”的静态文案明确留后继UI take，本片不扩大范围，不声称完整队列UI或真实中心联调。Root未额外运行browser/build，作者typecheck证据独立列于validation。所有正式结论绑定上述实现target，不以metadata HEAD替代。
