# TUI01C — 逐段正文与按需活动

状态：in-progress。创建：2026-10-06。所属大task：[TUI-001](../../../tui-client/plans/tui01-terminal-client/plan.md)，对应 TUI001-03；co-lead：Execution Lead。

目标：终端自动看到当前回合逐段正文，按需阅读活动与完整回复；Web/Ink 共用协议与中心展示结算规则，各自保留renderer。遵循[模块设计规则](../../AGENTS.md#modular-design)。只观察中心，不新增执行循环、不改变final权威或unknown语义。

## TODO

- [x] TUI01C-01 固定Interface、作用域、技能与依赖。
- [ ] TUI01C-02 提取浏览器安全stream/activity纯模块，Web真实消费。
- [x] TUI01C-03 接终端单回合观察与惰性活动/回复详情，退出只停止观察。
- [ ] TUI01C-04 共享协议、HTTP fixture、真实PTY及Web直接消费者分层验收。
- [ ] TUI01C-05 独立review与main集成。

## 设计与验收

[Interface](../../docs/evidence/tui01c/interface.md)为本片接口说明。共享模块只依赖contracts/浏览器标准API；interaction controller负责连接epoch、用户选择与有界资源，Ink/Web只渲染中性正文段。最终替换严格消费中心settlement；完整性不足保留draft，不猜最后一块/相同文字。

初四scope及Web三stream文件、native projection与Web package依赖现已正式领取（v2）。锁文件由F01单写。无第三方新增依赖、0provider、个人服务不操作。单观察回合，2并发读取，活动20条/页、4份正文缓存，每份按协议64KiB，stream每attempt1MiB/256blocks/4096patches。

公共seam检查已获派工：shared projection/presentation/codec、interaction controller经真实HTTP、TUI真实PTY、现Web纯模块及host消费者。保留原TUI/ACK行为。fixture只证客户端读取/呈现，不证明provider首token、成本或完整大task。
