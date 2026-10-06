# A/B preparation synchronous Git deadline fix

2026-10-06 14:08:55 UTC，status_read/gpt-6-astra。da932原准备APPROVED已由reviewer撤回为CHANGES_REQUESTED，1P2；root未曾OPEN。

原缺口：preparation Promise timer不能中断同步Git；其timeout使用outer300剩余，14.9秒仍可获5秒。修复：从entry15s绝对deadline传入exportInputs/frozenFiles，每个同步调用的timeout=`min(5000,floor(preparationDeadline-now),floor(outerRemaining))`，不足1ms零执行；返回后先按实际Buffer扣账，再核predeadline和work门禁。exec timeout/OS停顿/失败保持unknown，不当取消或可靠清理，不启动A/B后继。无新Supervisor/生产变化。

Red source `eda844a14e5a510e880703a6764ab4edf33fa2ef`保留原timeout行为并抽窄exec seam，3个实际pure反例全红：14.9秒应≤100ms、耗尽0command、late-return应扣账后拒绝。修后3新+5input+9budget=17/17；局部strict0。旧61未重跑，不把17全当新增；总新行为只3个。0真实Git输入导出/PG/HTTP/runner/SDK/provider/目标；fake fixtures全部finally删除自己的小tmp。

clean-code：只增加小preparedGit同步seam，absolute deadline参数贯穿两callsite，命名/错误边界保持；旧da932 source/raw/manifest按fixedGit冻结，其余85当前绑定不改。实际RESOURCE_PENDING/NOT_OPEN，共享空间低于1GiB通知已接收，本片检查已自然结束，仅小metadata封存，不新增build/测试/安装/复制。P06已另树main+release，本writer508f仍v1。
