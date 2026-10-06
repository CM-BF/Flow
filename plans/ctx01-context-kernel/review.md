# CTX01 独立review

状态：APPROVED

Review target commit：f58fdf36b073e2a98a683c8f40442dbb64ee7eec

Base：75a33dec228e17bbbd0d3be9fd01bc9ac18a0133。Scope：experiments/context-kernel与自身计划/证据。请先核实际HEAD/dirty，再只读固定包hash/许可、公开core调用、host版本门禁、独立进程恢复、fork隔离、统计样本/字节预算/CPU/RSS、原始失败与限制。禁止真实模型或借此写生产接口。不把零模型toy当语义质量/真实agent容量/节省账单证明。

Findings：无阻断项。Goal Owner / gpt-6-astra 独立只读审查；owner于2026-10-06 04:51:14 UTC记录。审查观察clean HEAD5317fe4fb80019a20f5d4190ec89f1338ad940e0，源码对固定target无差异。

作者证据：[方法/结果](../../docs/evidence/ctx01/README.md)、[原始60样本](../../docs/evidence/ctx01/measurements.json)、[来源hash/许可](../../docs/evidence/ctx01/provenance.json)、[3/3行为](../../docs/evidence/ctx01/host-tests.txt)。实际被测四脚本hash包含在raw，vendored三core文件逐字对应固定tarball。已复算nearest-rank分位数与字节总量，无负载重跑。完整diffcheck只有逐字LICENSE原文末尾空行警告，其余通过；不能为绿格式改原license/hash。未知schema/旧revision/身份门禁是host，不是生产CAS。

## 独立审查事实与限制

Root已读四份authored脚本、测试、README、完整LICENSE及harness-limits；4份source与5份vendor的固定提交/当前树hash均与manifest匹配。核对原始measurements SHA256 `5d633b104a23990b435c734f650a20da6dde803fd15eacc05c76231d0d8850bc` / 162144 bytes，独立离线复算60样本、各20重复、2220 session实例、两阶段各8880 refs、8,265,090原文bytes及wall/CPU nearest-rank p50/p95、peakRSS。逐样本PID/digest/4N refs/fork/0warning均一致。实际RSS before/after合并范围也无差异。

原始3/3输出SHA256 `2cd0b2a6b6e0497b3e08916c870f94dbb42960379ec0c7c78a87410610fa3eb7` 已核对；初始module-missing red仅是加载失败，不当行为red。Reviewer未重跑tests/benchmark、未写项目文件，0模型。

批准仅toy引用、恢复、fork及有界测量。手写摘要不证语义质量；100顺序小session不是并发agents；JSON checkpoint扩大；host门禁不等生产PG CAS/native resume。源码RSS汇总目前仅min-before/max-after，对本批复算无影响；后继复用时可合并两端，本次无需改源码/raw或重复负载。

作者回应：接受全部范围限定；不修改固定source或原始测量，无待修blocking。main集成由Lead另记，不把本批准写成生产能力。
