# WPF-VISUAL01 共享浮层与渐进消息设置

| 字段 | 内容 |
| --- | --- |
| 所属大task | [WPF-MATURE-01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-01-visual/plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| Owner / model | w01_owner / gpt-6-astra ultra |
| 状态 | in-progress；同 task 后继，原 shell 已交付历史不重置 |
| 固定基线 | 3c9345df4aec85a37e8a2a155e079db260d515b1 |
| Worktree / branch | web-shared-overlays / codex/web-shared-overlays |
| 写权 | [新 take](../../docs/evidence/wpf-visual01/shared-overlays/take-receipt.json)，exact8；不含 App/session/attachments/Thread |

## 已接受设计与接口

直接实施[既定设计](../../docs/evidence/wpf-visual01/shared-overlays/accepted-design.md)及[消费者清单](../../docs/evidence/wpf-visual01/shared-overlays/consumer-report.md)。共享 Dialog 只负责圆角、遮罩、阴影与布局安全边界，保 Radix 的 Portal、modal、标题、关闭与焦点契约。消息设置仍由 host 唯一持有 draft 与同步 CAS；组件只维护当前 opening 的筛选与待应用候选，不改 tuple、omit 或 authority。主题继续只有颜色权限，不开放材质参数。

默认模型入口、更多筛选、完整配置详情逐层展开；主应用/取消固定可达。长身份限制视觉高度但可查看完整值并消歧。内侧留白同时考虑 classic 与 overlay scrollbar，不能仅凭 stable gutter 声称 overlay 模式已验。桌面与390浅/深、原生键盘、焦点返回、reduced-motion 为受影响验收；使用真实 Picker 与 App Recovery 消费者，旧业务断言保留。

## 稳定 TODO

- [x] **WPF-VISUAL01-01** 原设计/技能/基线与唯一来源，历史交付已完成。
- [x] **WPF-VISUAL01-02** 原四主题、共享 builtin、轻质 shell 已交付。
- [x] **WPF-VISUAL01-03** 原 a8b2b22 检查已完成，不作为新浮层证据。
- [x] **WPF-VISUAL01-04** 原 a8b2b22 已 main4391 接收/旧 claim 已释放。
- [x] **WPF-VISUAL01-05** 新独立树/领取/共享 Dialog 与渐进消息设置源码；保全部行为边界。
- [ ] **WPF-VISUAL01-06** 受影响局部检查与真实代表消费者桌面/390/主题/焦点/滚动模式证据。
- [ ] **WPF-VISUAL01-07** 固定源码独审与主线接收；实际发布另列。

## 验证与未验范围

四入口 affected strict/noUnchecked/noEmit 已实际通过，首轮失败保留；Recovery appearance 已实际通过cookieRead/themes390两个选定组，2张390图已独立目视接受；Picker、完整Recovery与构建仍未运行。不重跑无关业务。真实 scrollbar 模式和图片可读性待实际观察；不以几何数值/截图存在冒视觉通过。不改官方 Thread、完整 Arc pane 管理或任何 draft/plugin 权威。

历史原计划/结果见[历史 plan](../../docs/evidence/wpf-visual01/shared-overlays/historical-plan.md)、[历史 status](../../docs/evidence/wpf-visual01/shared-overlays/historical-status.md)。模块化与性能方法遵循[根规则](../../AGENTS.md#modular-design)。

本次固定源码 4ca1deac319afac89f7c0ae5e0142cb9de429a2a；必要检查方案见[validation proposal](../../docs/evidence/wpf-visual01/shared-overlays/validation-proposal.json)。必要局部30s段已CLOSED累计5765ms，原类型段闭合；后续Recovery独立实际段见下文，未使用类型余额。

后续 parent preset 将 appearance 的任务、账目、输出作为一个受信固定配置，不接收任意 evidence 路径。默认 MSG03 guard 不变；必要 local 与两 browser consumer 提案集中于[准备入口](../../docs/evidence/wpf-visual01/shared-overlays/validation-prepared/proposal.json)，affected types已实际结束；browser仍待准备与实际段。

### 2026-10-07 浏览器准备分阶段

类型与窄guard已root517678接受；Picker固定候选先审/后准入，Recovery只读链接与运行闭包另闭合，二者不互相阻塞。见[准备说明](../../docs/evidence/wpf-visual01/shared-overlays/browser-prepared/README.md)。原TODO06/07保持未完成，未授actual。

### Recovery准备闭合（source-only）

38个private readonly links已exclusive供给，现固定614own与406installed roots完整字节；33SQL齐全。原TODO06仍等实际Picker/Recovery与目视，TODO07仍等最终独审/main；不以准备审完成任务。见[当前入口](../../docs/evidence/wpf-visual01/shared-overlays/recovery-prepared/README.md)。

### 2026-10-07 Recovery appearance 实际结果

固定source `4ca1deac319afac89f7c0ae5e0142cb9de429a2a`、执行HEAD `d85257e067eb96888f2b26479625b86572869995`。[单一原件索引](../../docs/evidence/wpf-visual01/shared-overlays/recovery-actual/index.json)记录真实outer/parent exit0、cookieRead与themes390选定PASS、两张390图及geometry；20:15:46.418134Z资源完整归还，10,325/60,000ms CLOSED。原parent9653.026ms不改写，保守账使用outer最晚观察向上取整；未用49,675ms不构成后继许可。

TODO06仍未完成：Picker代表行为、正常/长名称桌面与390图片尚未执行；本次仅当前系统观测滚动条，不证明classic与overlay两OS模式。TODO07仍待全片独审与main接收。两个consumer分别保真，不以Recovery通过代Picker或个人页面恢复。

[root0e1独审](../../docs/evidence/wpf-visual01/shared-overlays/recovery-actual/root-actual-visual-review.json)接受本次选定行为、双主题当前dialog几何/可读性与完整归还，0blocking；不补签未运行Picker或全suite，原TODO06/07仍开放。

### Picker最后准备绑定

原候选源与native边界已分别由root/经理接受，见[ready记录](../../docs/evidence/wpf-visual01/shared-overlays/picker-ready/ready.json)。本10min/2MiB段只固定数据批准和自然metadataHEAD，不改source/runnable或重新扫闭包，不重跑类型。原6行为+2展示组/7PNG均未实际执行，TODO06/07不变；个人恢复优先，90s提案不是运行授权。
