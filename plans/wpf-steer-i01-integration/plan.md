# WPF-STEIRI01 运行中指令接入

状态：in-progress。所属大 task [WPF-MATURE-06](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-06-chat/plan.md)，co-lead Web /root（执行管理 d01_owner）。2026-10-06，唯一 owner w01_owner / 派发 gpt-6-astra ultra，固定基线 df29fb511df029a0922ace0f4973f3fe3736e502。遵循[根模块规则](../../AGENTS.md#modular-design)。

## 已批准范围与接口

复用已审 STEER01 控件，不改其 control/UI/CSS。仅显式打开运行任务的消息页脚入口才分配私有 controller / 读取；普通 Send / Queue 保持独立。P01 唯一生命周期与 read/write capability 复核，三条 bound ports 前后核 connection / stable view / conversation / turn / task，attempt/owner/revision 由中心 admission 确定。write command 只调用私有原始 HTTP port，不递归回 control。

稳定已访问 surface 在可移动聊天 groups 外保存控件内部 draft；hidden/offline/revoke 暂停观察并使旧代际无效，不取消中心任务。session 最多八个已访问绑定，不自动淘汰 unknown；控件原八 receipt / 四 attempt / 每 attempt64 command 界限不变。显式打开/Refresh 读取既有页，保留控件原提交或失败后的单次有界刷新，无 per-message timer。关闭 view / 换 connection 的未决提示须明确本页原 key 恢复将丢失，确认才销毁；reload 恢复不在本片。

## TODO

| TODO ID | 目标 |
| --- | --- |
| WPF-STEIRI01-01 | 唯一领取、接口与保护范围 |
| WPF-STEIRI01-02 | 私有授权、稳定 surface 与实际任务入口 |
| WPF-STEIRI01-03 | 生命周期 / unknown / 双 split / 键盘双主题 HTTP fixture |
| WPF-STEIRI01-04 | 固定独审、交付与主线接收 |

## 验收与限制

零自动读 / 历史逐 turn 创建；第九绑定明确背压；非 focused split 仍按自己身份合法；只读权限不能 POST；unknown 原 key / body 不因 attempt变化或4xx改成新提交。new draft 不受旧 ACK 清除。Actual App native hidden 与 React mounting 生命周期实测分开。双主题390 / 键盘 / 返回焦点，退出取消与确认两路径。0真实模型 / DB，provider服从不从 accepted/received 推断。

以[十三 literal receipt](../../docs/evidence/wpf-steer-i01/take-receipt.json)为准；保护 conversation-steering、Context helpers、official Thread、projection/outbox/queue/stream/shared/deps。新增路径先 amend。架构影响为已审控件的 App/P01 消费接线，完成后由管理者登记架构后继。

[状态](status.md) · [审查](review.md) · [质量](../../docs/evidence/wpf-steer-i01/quality.md)
