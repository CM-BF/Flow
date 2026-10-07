# 仅新 Cookie App 的 HTTP 解析诊断准备

[固定提案](proposal.json)绑定 fc2916c275efe86203d91ec33656ea9871eac42a；[纯文本检查](static-audit.json)仅核原正式四App断言与导入函数不变。完整候选在 `/private/tmp/rel01-recovery-diagnostic-c1`。source/native独审与必要strict实际已接受，见当前结论；诊断actual仍NOT_RUN/NO_GRANT，不能当正式兼容通过。

本次沿原actor/生命周期，追加有界被动clientError观测，只跑新Cookie必要链；不重跑旧三App，不importReports，不忽略400。旧c2失败与完整RETURN见[原件](../pair-779a-cd27-second/README.md)。

历史修复点2026-10-07T16:40:47.350Z：32KiB检查改为真实pretty JSON加末尾newline字节，与saveJson一致；单行静态修复，未运行types/browser。

## 当前批准与必要类型结果

2026-10-07T16:50:24.040Z：固定fc291诊断源码/精确native边界已获[Root source approval](root-source-review.json)与[native approval](root-native-boundary.json)，0blocking。32KiB采用实际pretty JSON加newline字节。[必要strict实际](strict-actual/README.md)首失败和只读alias纠正后PASS完整保留；2775/20000ms CLOSED。90s诊断仍NO_GRANT/NOT_RUN，正式四App仍FAILED/reports=null。0条clientError仅未复现，关联仅候选，不作兼容性或因果证明。

必要strict实际已经[独立接受](strict-actual/root-result-review.json)，诊断包仅READY/NO_GRANT。K01未明确RETURN时不启动任何诊断进程。
