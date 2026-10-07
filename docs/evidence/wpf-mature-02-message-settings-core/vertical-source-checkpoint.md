# Claude 消息设置纵向 source checkpoint（未验证）

2026-10-06 16:12:49 UTC；owner status_read/gpt-6-astra；v3/39 literal ACTIVE。原base70cc不变；本包只实现既有批准的v2 optional turnSettings纵向，首leaf4e7/5检查不重新归功于本片。

当前source已接 contracts→profile catalog/publication→send/enqueue→自动/手动promotion→既有Claude Query→final/context/retry。032精确迁移已实现，actual factory挂载由F01负责；client ACK/header/export和Web/TUI消费仍外部协作。base turn schema可extend P2最小修复及publication ACK union已入源码；known opt-in缺snapshot拒绝，legacy unavailable pin仍排队。

测试源码：contracts新6组+两个旧直接文件；runner新5组实际adapter注入（不调用SDK默认query）；server新8组，一个随机专库/真实HTTP（public route，非FlowClient DTO验收）。新fixture先调用旧1/2/7/10/11真实迁移，断言32不存在，seed旧task/queue后32，再createServer其他正常迁移，未来F01挂载不会改变升级证据。SQL错误/whole-batch rollback、legacy读续、profile隔离、same-session两消息、原CAS/replay/queue冻结、empty unpause、context和retry均有针对性断言源码。目录中的测试没有运行，不声称red/green/SQL正确或可用模型。

## 验证准入请求（当前 NOT_OPEN）

- 精确source只读闭包见 [vertical-source-closure.json](vertical-source-closure.json)：227文件，155当前不可见，673771逻辑字节。包含静态type/re-export与SQL URL，不扫描私有数据；Lead sole sparse provision，worker未物化/改config。
- 依赖仅既有固定安装：Node24、Vitest4.0.18、TS5.9.3、SDK0.3.290、pg8.23.1、pg-boss12.37.0等，JSON列精确路径/版本/package SHA。工作区alias只能指本WT相应source；第三方alias可指现有安装，不把main产品作为被测源。tar7.5.22与现package声明一致，不安装。
- 建议分两最小窗口：先contracts+注入runner纯检查及root严格选项局部noEmit；再server 8组专库HTTP。任何窗口均需root明确fresh资源准入，当前0tests/tsc/PG/目标/provider。
- 专库工作门限120s、每HTTP7s、256请求上限；最多32task，8组预计远低于上限但实际以DB总数receipt为准；close阶段每动作8s，保守总上限200s（非性能窗口）。证据32KiB上限，结果text每请求128KiB，0真实SDK目标。未知close或连接不空不DROP、不FORCE，CREATE先记request，存在性不由ACK推断；只写本scope指定新receipt。
- 验证前还须提供evidence内定向Vitest/strict配置及确认closure；现只源码与静态read，不申请空间之外的install/build或任何容量窗口。

旧queue.test会写chat04证据，明确不运行；新fixture自行覆本次必要兼容边界。未重跑旧native catalog专库/全库。上下文附件v2原三行保留，root/types检查将连同readonly输入在允许窗口验证。
