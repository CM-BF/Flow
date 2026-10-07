# CHAT05P01 可追回的原生工具正文

状态：in-progress。所属大task：FLOW-001（CHAT05-06 / REQ15）。Owner：assignment_review；co-lead：Execution Lead。

让声明上限内的完整工具输入和结果即使超过64KiB、单材料超过2MiB，也能持久传输并按页追回。先保存完整SDK公开表示，再用原事件outbox和原接纳事务分块；不提高EventBatch或旧detail上限，不造第二调度器。旧历史截断尾部无法补回。

| TODO ID | 产出与验收 |
| --- | --- |
| CHAT05P01-01 | 固定body合同、显式跨版本开通与12scope领取 |
| CHAT05P01-02 | 完整材料spool、固定envelope、背压与原outbox恢复 |
| CHAT05P01-03 | 033独立存储、fenced接纳与授权轻descriptor/分页正文 |
| CHAT05P01-04 | 0provider纯故障/大材料/顺序直接消费者；PG另排窗口 |
| CHAT05P01-05 | 独立review、共享接线/正式开通、main接收 |
| CHAT05P01-06 | 后继Web/TUI展开消费与真实provider边界验收 |

确认范围和小Interface见[interface](../../docs/evidence/chat05p01/interface.md)。共享runtime/client/index/exports由Lead与现S01P07协调；当前不写这些路径。8MiB/body、16MiB/attempt、256材料、64KiB/chunk，<=8chunk/批、<=4chunk/页。原2MiB/50events限制保持。完整材料先持久，首次网络前冻结ID/sequence；未知保留原件/身份，不自动模型重跑、换key或迁移attempt。最终正文/成功completed不得越过未sealed材料。

生命周期、错误、背压与验证方法统一引用[模块规则](../../AGENTS.md#modular-design)。不记录隐藏/redacted thinking或整个SDK帧；JSON/UTF8可公开表示不等于原HTTP网络编码。产品未挂载/未测试时不称可用。

后继聚合容量（CHAT05P01-06 / S01）：16MiB/attempt乘并发16的256MiB仅原文，不含JSON/base64/Buffer/manifest和未ACK历史。高并发正式开通前须验证runner聚合字节/历史扫描/空间不足停止新admission而保恢复心跳，以及确认后的受控保留回收；未知不能超时丢弃。本片缺port仍旧协议，不扩scope实现全宿主容量政策。
