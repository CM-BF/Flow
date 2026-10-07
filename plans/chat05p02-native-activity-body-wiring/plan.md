# CHAT05P02 工具全文公开接线

状态：in-progress。所属大task：FLOW-001/CHAT05–06；owner assignment_review / gpt-6-astra，co-lead Execution Lead。

复用P01已交付的正文spool、原outbox、接纳事务与分页读口，提供唯一共享client reader和受中心明确确认的host opt-in。先独立leaf，再共享出口；默认legacy，unknown不重投模型。完整Interface见[证据](../../docs/evidence/chat05p02/interface.md)。不改旧claim/权限，不造第二codec/调度器或附件平台。

| TODO ID | 产出与验收 |
| --- | --- |
| CHAT05P02-01 | 新树/领取/固定Interface与共享依赖 |
| CHAT05P02-02 | 有界单inflight reader与取消/坏页/完整性直接检查 |
| CHAT05P02-03 | 鉴权支持确认及admission前/正文报告前host接缝 |
| CHAT05P02-04 | 共享client/contracts/factory挂载与真实无provider组合 |
| CHAT05P02-05 | 独审、主线接收及后继UI/provider交接 |

普通局部初始累计180s、tmp16MiB/raw2MiB，0PG/Chrome/provider；实际运行先核本组local并沿已有OPS14，无安装。真实PG另待固定入口/共享窗口；本计划不预占。全8MiB取回不代表全UI渲染成本，完整宿主聚合/真实模型仍后继。模块规则见[根规则](../../AGENTS.md#modular-design)。
