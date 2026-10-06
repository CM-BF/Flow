# WPF-CHAT01 独立审查入口

**状态：APPROVED**

Review target commit：7cbabb737f26b108275e80f1b6cd0425699f3c18

Base：I01最终b5844442699733558a152c12392ea78f26c393a4；公共输入合同4c2408e4db3595879f6471cb5fffccadec975b3d与client84117ca1c7446ee2e2b50f0526f3460dd42a2869，后者由Lead精确compat patch按hash输入为a3b9cfaaa4be4ea8b34e6135107b0401f121fbd0，共享冲突已解决。typed合同精确输入746364ea2581b8c563a09b07560de5e0b63bcab8。完整review必须包含本feature早期0d4e outbox，不能因746输入提交更晚而漏审。不能继承I01 approval。

审查scope与验收见[plan](plan.md)、[status](status.md)。重点正文来源、outbox冻结payload/key与新草稿并行、409不自动重发、queue/steer快捷键一致、真实Thread、跨连接隔离、0→1→cache与观察预算。完整后继queue/steer/settings/voice不因首批通过消失；fixture/协议中心/真实模型分别记录。

作者已执行33 direct/typecheck/build/dev11/production11+最终局部1，具体时间与复用范围见[validation](../../docs/evidence/wpf-chat01/validation.md)。作者未执行本Web真实中心/真实模型。Root/GoalOwner的moving观察与最后固定target批准分开记录；最终正式结论见下文。

可复制任务：先核实际tree/branch/完整target/base/dirty/liveclaim，只读固定提交，核相同输入和当前公共client；针对变化运行局部模块及产品路径。每个finding提供severity/trigger/文件位置/blocking/复验条件，改动交owner。禁止拿作者fixture结果当真实模型验收，结论绑定完整SHA，metadata不扩大review。作者修复/回应/复审：原842→R1/R2修复→7cb独立批准闭环见下文。

04:05 UTC w01独立模块review发现P2 blocking：后发retry replay旧受理turn以更高请求seq覆盖已GET的final。作者已接单，仅projection/tests修复，root正式编号CHAT-R1；fixed84242不能整体通过。

## 固定修复复审

2026-10-06 04:07 UTC：root正式842整体REQUEST_CHANGES，CHAT-R1（P2 blocking，saved ACK replay降级final）与CHAT-R2（P2 blocking，多轮刷新中间gap静默且无法加载）。作者固定修复`7cbabb737f26b108275e80f1b6cd0425699f3c18`仅projection.ts与其test，交w01原审查者只读复审；该停点尚不能标APPROVED；后续独立结果见最终正式结论。

R1把receipt确认与读到的当前turn分开，已知turn不受saved ACK覆盖，新ACK仅以最低read优先级插入。新增unknown→final GET→replayed running/pending用例在842实际失败，7cb通过。R2以已读连续turn前缀计算loadable cursor；[1]→中心revision3→[1,3]明示Load more，按20条分页补齐[1,2,3]，不要求预取全历史。作者16projection+9outbox/typecheck PASS；未跑无关视觉/benchmark，等待独立结论。

## 最终正式结论

2026-10-06 04:09 UTC，Root整体限定APPROVED：implementation target `7cbabb737f26b108275e80f1b6cd0425699f3c18`，完整base `b5844442699733558a152c12392ea78f26c393a4`。CHAT-R1、CHAT-R2均CLOSED。原842 REQUEST_CHANGES历史保留。

独立证据：w01运行16projection tests，并额外复现saved ACK replay保留final对象/状态、54turn gap且分页期间继续append至62全齐（1/21/41/61 cursor）、fresh ACK→GET升级三探针，均PASS；固定源码/test与target diff0。Root读固定App、官方Thread、ConversationThread/List/messages、bridge及窄修复diff，无其他blocking；原842独立33检查复用，不称在7cb重跑。Root source/shared对7cb diff0、排除两raw patch全source/docs diffcheck0；原transport上下文空格例外保留。

Root CUA核焦点修复、两轮UI与消息打开Terminal，视觉截图已核；不同turn的fixture terminal文字相同，因此不能声称root UI独立证明消息身份，源码resolver已审。整体批准仅覆盖首批Web和公共协议fixture，不覆盖真实模型/真PG作者验收、main集成、capfalse后继、语音、PTY/fs或全产品插件管理。
