# 仅新 Cookie App 的 HTTP 解析诊断准备

[固定提案](proposal.json)绑定 fc2916c275efe86203d91ec33656ea9871eac42a；[纯文本检查](static-audit.json)仅核原正式四App断言与导入函数不变。完整候选在 `/private/tmp/rel01-recovery-diagnostic-c1`。source/native独审、必要新类型检查、诊断actual均尚未运行/接收，不能当正式兼容通过。

本次沿原actor/生命周期，追加有界被动clientError观测，只跑新Cookie必要链；不重跑旧三App，不importReports，不忽略400。旧c2失败与完整RETURN见[原件](../pair-779a-cd27-second/README.md)。

2026-10-07T16:40:47.350Z：32KiB检查改为真实pretty JSON加末尾newline字节，与saveJson一致；单行静态修复，未运行types/browser。
