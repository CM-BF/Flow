# SVC02 独立审查

状态：APPROVED

Review target commit：9aa790552cb8847d6feb8c8f90c870407a54e572

base6b4b89f397b35d7e769846df457e76bb29f4a265。固定target后独立只读核016/domain/旧claim兼容、host持有与失败关门、明确resume、原始检查；不可把临时专库测试视为真实服务已更新。作者检查9/9 PG/HTTP与12/12 host/直接消费者、tsc通过；Root独立只读APPROVED，正式范围见下文。

验收重点：old75a33真实claim事务原语句与输入可核，INSERT gate拒绝时session/attempt/task整体回滚；drain仅拒新领取，active心跳/上报保持，uncertain不释放；CAS/幂等/重启审计；可信host无第二center/scheduler、保密/专库marker/进程identity/operation.lock；暂停保门不等于任务取消。review者不改源码，findings交唯一owner，0模型。

证据与失败见[README](../../docs/evidence/svc02/README.md)，来源hash见[manifest](../../docs/evidence/svc02/manifest.json)。host实测d122到固定target仅缩进；domain-final包含测试admin连接修复。不重跑模型或用户服务。维护事务不跨stop/start；HTTP禁止maintenance恢复，本机operation.lock串行；原始失败均保留。


## Root独立只读审查（2026-10-06，owner于05:27:29 UTC转录）

Review target commit：9aa790552cb8847d6feb8c8f90c870407a54e572。现场clean129cc7751900809e321080d770c8a55710954ab1；reviewer Root / gpt-6-astra。

已核17 source/12 raw及fixed target hash；manifest SHA256 `6f46cd26a2435353d3e77e9f71fdd6f7ca418ed8d7736f50bfe814deb605805b`。完整阅读domain/guard/host/进程持有/9PG+12host测试与原始输出；旧75a fixture仅imports/comment，host d122→9aa whitespace-only实核。无blocking finding，未重跑tests/模型、未写项目。

批准范围为**单个受管runner的本机预览更新**，不是多runner整个center停机安全。真实窗口前必须核全DB无其他runner未完成attempt、无其他活动runner部署；若存在或不确定，保留关闭并升级协调，不能只凭本runner计数0就停center。快照不是锁，也不能由idle=0推断其他部署离线。

作者回应：不改变已审源码、不重跑；只把此边界登记到status/证据/部署提案。真实部署仍等已审main、当时任务事实和Root明确窗口；61227/61228未操作。

## 新维护窗口准备（2026-10-06 07:33 UTC）

原工具APPROVED9aa保持；本次assignment_review只准备b54更新，产品对253b、维护工具/领域对9aa零差异，证据绑定[manifest](../../docs/evidence/svc02/refresh-b54-manifest.json)。固定源码/原始快照/单runner边界见[方案](../../docs/evidence/svc02/refresh-b54-proposal.md)。本次操作窗口和resume均NOT_GRANTED，不以工具原批准代替部署许可；未重跑产品测试或调用provider。

## 2026-10-06 08:25 UTC 新32c维护方案

原实现9aa及历史部署批准保持。本次仅[新方案](../../docs/evidence/svc02/refresh-32-proposal.md)/固定只读事实，等待GO新窗口；NOT_STARTED是本次操作方案评估，不撤销原工具批准。不由作者自审工具或声称获新resume许可。
