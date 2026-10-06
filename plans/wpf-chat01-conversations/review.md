# WPF-CHAT01 独立审查入口

**状态：NOT_STARTED**

Review target commit：UNKNOWN

Base：I01最终b5844442699733558a152c12392ea78f26c393a4；公共输入合同4c2408e4db3595879f6471cb5fffccadec975b3d与client84117ca1c7446ee2e2b50f0526f3460dd42a2869，后者由Lead精确compat patch按hash输入为a3b9cfaaa4be4ea8b34e6135107b0401f121fbd0，共享冲突已解决。没有本feature实现候选，不能继承I01 approval。

审查scope与验收见[plan](plan.md)、[status](status.md)。重点正文来源、outbox冻结payload/key与新草稿并行、409不自动重发、queue/steer快捷键一致、真实Thread、跨连接隔离、0→1→cache与观察预算。完整后继queue/steer/settings/voice不因首批通过消失；fixture/协议中心/真实模型分别记录。

已执行：固定源码/claim/技能只读核验。未执行：本feature模块/类型/browser/真实中心/真实模型/独立review。未知/空finding不表示通过。

可复制任务：先核实际tree/branch/完整target/base/dirty/liveclaim，只读固定提交，核相同输入和当前公共client；针对变化运行局部模块及产品路径。每个finding提供severity/trigger/文件位置/blocking/复验条件，改动交owner。禁止拿作者fixture结果当真实模型验收，结论绑定完整SHA，metadata不扩大review。作者修复/回应/复审：待固定候选。
