# CTX01 独立review

状态：NOT_STARTED

Review target commit：f58fdf36b073e2a98a683c8f40442dbb64ee7eec

Base：75a33dec228e17bbbd0d3be9fd01bc9ac18a0133。Scope：experiments/context-kernel与自身计划/证据。请先核实际HEAD/dirty，再只读固定包hash/许可、公开core调用、host版本门禁、独立进程恢复、fork隔离、统计样本/字节预算/CPU/RSS、原始失败与限制。禁止真实模型或借此写生产接口。不把零模型toy当语义质量/真实agent容量/节省账单证明。

Findings：尚未审查，不构成approval。作者修复回原scope；独立review可读保存原始证据，不必重跑负载。

作者证据：[方法/结果](../../docs/evidence/ctx01/README.md)、[原始60样本](../../docs/evidence/ctx01/measurements.json)、[来源hash/许可](../../docs/evidence/ctx01/provenance.json)、[3/3行为](../../docs/evidence/ctx01/host-tests.txt)。实际被测四脚本hash包含在raw，vendored三core文件逐字对应固定tarball。已复算nearest-rank分位数与字节总量，无负载重跑。完整diffcheck只有逐字LICENSE原文末尾空行警告，其余通过；不能为绿格式改原license/hash。未知schema/旧revision/身份门禁是host，不是生产CAS。
