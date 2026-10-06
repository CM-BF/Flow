# WPF-RELEASE03 独立审查

**状态：NOT_STARTED**

Review target commit：269103d44f153f13a2f35fadb08bf11d4f62e48d

Base：362af3bac77541e5a60979326bcf4d4b8c947915

完整兼容审查范围：两新验证脚本及相应固定输入/原始运行证据。实际A已失败、B未运行，完整兼容审查仍NOT_STARTED；已完成的源码条件批准单独如下。

## 后续只读任务

核 actual factory/client/contracts 来源、正式 format2 全 descriptor、history attachment-only/mixed门槛、实际App原key/body与新稿保护、生命周期/累计预算/清理、SVC observation条件。绑定固定commit；问题交作者修，原始失败不覆盖。检查与未执行范围分别列明；个人发布不在此批准内。

当前A两项业务失败且清理完成，B未验；无兼容通过结论。原997d定向strict noEmit通过，未对432b重复。

## 原checkpoint限定审查

997d A-only guard-source已由panels只读APPROVED/0blocking，root传达认可；没有运行兼容矩阵。后继432b仅源码条件批准如下；整体RELEASE03继续NOT_STARTED，不将源码审查当业务通过。

## 432b A-only 源码条件批准

独立reviewer：root。实际时间2026-10-06 15:06:08.401448 UTC。原报告[原样归档](../../docs/evidence/wpf-release03/source-review-432b.json)。结论APPROVED，0 blocking，仅覆盖997d→432b两脚本差异：mode对应资源余量、60秒含20秒清理、监视先于import/CREATE、关键await检查、确认marker与自有进程组边界。当前/source/hash一致，保护路径零差、源码diffcheck0。

未执行PG/HTTP/Chrome/build/provider，没有验证实际清理。32MiB仅基于此前12,360,727B数据库观察的准入余量，不是PG/WAL/OS物理峰值硬保证；250ms轮询不等硬配额。budget.complete不等cleanup成功。原997d noEmit1.839676秒证据复用，未重跑本delta。

随后15:07:01Z管理fresh准入因空间不足拒绝，gate未生成；[准入原文](../../docs/evidence/wpf-release03/history-admission-not-run.json)。两项历史与B均NOT_RUN，不能制作或导入SVC全绿报告。

## 2026-10-06 15:29:28 UTC 实际A证据待核

一次已授权history-only运行已结束，两项失败，完整原始索引见[history-result](../../docs/evidence/wpf-release03/history-result-152729.json)。这不是新增源码审查finding或环境错误；需要原后台owner处理已知兼容缺口。B/Chrome未运行，未生成SVC兼容报告。上文15:07无gate为历史时点，不覆盖本次事实。

## 2026-10-06 15:34:33 UTC 后继重绑待审

当前target=dbaa88fa7a5adf1da077be7739842b6e42664c26，两脚本修改；仅静态hash/差异/断言不变审计，未重复类型或运行。旧432b源码批准与362实际兼容FAILED保留，不能扩为新tuple批准。新输入必须freshgate绝对realpath/HEAD/tree、仅已审store修复、实际factory从候选加载；计数不归零。[接口](../../docs/evidence/wpf-release03/backend-input-interface.md)。

## 2026-10-06 15:47:11 UTC 新源码待独审

当前target=1a7c42ac90e73471cce1fc8e1d56f4d0e60c2098：B-only原始证据准入、共享history事实断言、contractregion与外部13metadata闭包。纯SOURCE审查待开始，types/PG/Chrome均NOT_RUN；原dbaa批注只说明旧guard不接实际backend，不冒本轮已审。最新实际input见root原样af51审计；旧362业务FAIL独立保留。

## 2026-10-06 15:53:47 UTC 1a7源码P1与新修复

root固定1a7源码结论REQUEST_CHANGES：GET ContextDetail不含executionInputId/executionInputDigest，不能调用reference响应schema。此为源级必然拒绝，不是新A运行失败。修复target 269103d44f153f13a2f35fadb08bf11d4f62e48d：只有fixture详情校验改动，公共合同与原history断言保持；新target独审NOT_STARTED，不能把旧源码批准扩为本轮批准。[作者窄修审计](../../docs/evidence/wpf-release03/detail-contract-fix.json)。未重新types/PG/Chrome。
