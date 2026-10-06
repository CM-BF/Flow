# WPF-CHAT01 独立审查入口

**状态：NOT_STARTED**

Review target commit：84242ca1d214f9a9ff369b07c13657918862f226

Base：I01最终b5844442699733558a152c12392ea78f26c393a4；公共输入合同4c2408e4db3595879f6471cb5fffccadec975b3d与client84117ca1c7446ee2e2b50f0526f3460dd42a2869，后者由Lead精确compat patch按hash输入为a3b9cfaaa4be4ea8b34e6135107b0401f121fbd0，共享冲突已解决。typed合同精确输入746364ea2581b8c563a09b07560de5e0b63bcab8。完整review必须包含本feature早期0d4e outbox，不能因746输入提交更晚而漏审。不能继承I01 approval。

审查scope与验收见[plan](plan.md)、[status](status.md)。重点正文来源、outbox冻结payload/key与新草稿并行、409不自动重发、queue/steer快捷键一致、真实Thread、跨连接隔离、0→1→cache与观察预算。完整后继queue/steer/settings/voice不因首批通过消失；fixture/协议中心/真实模型分别记录。

作者已执行33 direct/typecheck/build/dev11/production11+最终局部1，具体时间与复用范围见[validation](../../docs/evidence/wpf-chat01/validation.md)。未执行：本Web真实中心/真实模型与整包独立review。Root/GoalOwner已作moving用户视角观察，不代替固定target批准。未知/空finding不表示通过。

可复制任务：先核实际tree/branch/完整target/base/dirty/liveclaim，只读固定提交，核相同输入和当前公共client；针对变化运行局部模块及产品路径。每个finding提供severity/trigger/文件位置/blocking/复验条件，改动交owner。禁止拿作者fixture结果当真实模型验收，结论绑定完整SHA，metadata不扩大review。作者修复/回应/复审：固定候选已交，等待独立结论。
