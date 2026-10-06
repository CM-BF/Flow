# REQ17 / CHAT06 测量接口，全部指标未运行

本次把 GO 经 root 的[原入站要求](dispatch-intake.json)归入既有 WPF-REQ-17（研究→owner→验证）、WPF-REQ-21（性能）、MATURE06-03、CHAT06-06/07 与 WPF-PERF01-02。没有新增任务、writer、测试或优化实现；QuickControls 与 Recovery 优先顺序不变。

[固定接缝报告](panels-report.md)及[30 个精确输入](panels-source-pins.json)以 main `d721cf28123b45dab5b4e531281b312956e1bc28` 为准。Root [验收口径](root-measurement-acceptance.json)与[独立 pin 复核](root-peer-intake.json)均已归档。现有 memo/defer/content-visibility 不能当作增量 AST；runner 的增量 hash 也不证明客户端完整前缀 digest 已优化。

后继复用 `installStreamFixture` 和实际 ConversationThread/官方 Thread。相同最终 UTF-8 原文/hash，分别准备短段、长代码、长表格的有界对照；总 patch 上限含 terminal、合法 UTF-8 边界与既有页上限不变。第一轮只选一个明确 pair，资源与独立准入就绪后才运行。

- digest：记录实际调用的字节，identity/fingerprint/full-prefix/unknown 分类，生成fixture与汇总hash另列。
- parse：记录实际 parser 调用与 UTF-8 输入，包括未提交的 render attempt；preprocess、remark transformer或渲染次数不能冒充解析次数。
- commit：实际 Profiler提交独立计数，声明 profiling构建/StrictMode与插桩开销；patch、publish、parse、commit不假设一一对应。
- 输入：真实 composer 的非发送按键，EventTiming 阈值、舍入、缺样明确；fallback只称handler→值提交，不冒产品INP或完整paint延迟。
- 终态：流结束、canonical final、task结束与显示追平分别观察；原文/复制与表格语义必须完整可达。

1MiB 的128/4096等分前缀求和只是算术，不能写成耗时或收益。输出仅有界计数/样本及一份最终原文，禁止重复日志记录全部前缀。共享 digest 与锁定 parser 的两处透明测试构建观测仍需原owner协调；不修改共享依赖、协议、hash或renderer，不换Streamdown。所有性能指标 **NOT_RUN**。
