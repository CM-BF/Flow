# PG01后的最小修正与第二段准备

固定源 `f73534fb8f5d4af9def063863b9551a7217280dc`。相对已审1bb仅两个test-only源改变：production.test material先固定同一sourceMessageId，再按canonical mapper/store的session/message/block/kind生成ID；fixture增加最多16条静态route/name/code/status错误元信息，test保最多16notice。无正文/凭据输出，原256请求与全部生产验证/两个验收断言不放宽。publish错误和runner拒绝不再被轮询掩盖；work先捕获的错误保持primary，runner收尾另记安全secondary，不能由finally覆盖。

原PG01 0/2、exit1、UNKNOWN_RETAIN原件在pg-run-01与pg01-result-manifest。其独立CONFIRMED清理原样保留。第二项500/257与夹具请求上限一致，但先前report错误未保存；已删除自有spool不能补造内容。相同ID错误可能导致原outbox失去确认并保留，但这是源码推断，不把它写成第二项实际根因。

新局部只有两个不同纯检查：local-run-05 material从实际生产测试AST提取私有构造，与真实canonical mapper核身份/字节；local-run-06从实际work/finally边界提取，注入不同work和cleanup错误，核primary/secondary独立。每轮再做受影响focused types（包括fixture与production.test）。2/2、两轮types0，合计5606ms/raw1121B，四组absent/双EOF/四scratch正常移除；原41不同检查不重跑。AST提取不加载PG hooks，也不把此方法当真实factory测试。

原caller仅加入明确 `repair-02` 参数选择新inputs/config/namespace，继续单一OPS14监督与原marker/OID/devino/checkpoint/正常DROP规则，无复制监督循环。原无参数仍指已消费pg-run-01并拒重复。第二段只能在新实际共享窗口执行：`FLOW_CHAT05P02_PG_WINDOW=authorized PYTHONDONTWRITEBYTECODE=1 <固定Python3.13> docs/evidence/chat05p02/pg-entry/run.py repair-02`。新namespace必须不存在。90s正常测试与cleanup +0.5TERM+2reap；16MiBtmp/2MiBraw/96MiBPG/1GiBlive。inputs保守fresh1,287,651,328B并须叠加现场更大并发预算。

285原输入仅fixture/production.test/caller3字节变更，加新report config共286；21aliases不变。原manifest352绑定保持历史固定，不能要求已修改三个路径继续等同原current字节。继承清单与superseded项在delta-manifest中明列。生产reader/host/runtime/route未改，原默认off/singleattempt/真实SDK、CLI、UI尚未验的边界保持。第二段PG仍NOT_RUN；本次不是自动重试。
