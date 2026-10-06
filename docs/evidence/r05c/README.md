# R05C 工程证据

Stack：Node24.20.0 / pnpm9.15.4 / Vitest4.0.18 / TypeScript；local find-skills发现已有适用方法，读取并应用 /Users/citrine/.agents/skills/find-skills/SKILL.md、codebase-design/SKILL.md、clean-code/SKILL.md。采用小显式错误合同隐藏原生细节，复用状态权威；行为测试直接覆盖durability/取消/并发，而非只测构造器。clean-code沿docs/quality/skills.md固定sickn33来源，不重复安装。brainstorming沿已授权两小步设计，不增加审批。

首次新WT CLI因未bootstrap依赖缺pg而失败，未取到claim；随后使用main现有协调CLI只读freshledger与原子take成功，未用main workspace symlink运行分支代码。receipt见claim.json。B1已main3418，owner receipt979fa26并push、release v3（predecessor-release.json），停止B1写入。

所有实际执行检查保存stdout/exit/selected与来源；不以计划代替运行。初始未测试。

## C0 实施与验证

原生失败显式settled/unknown，普通Error与结构相似的untrusted对象保持既有failed；unknown通过既有lost路径停止续租，不发completed、不清journal。若cancel已先到，额外结算值仅阻止误报cancelled，未更改AttemptControl先到理由规则。两个已在运行slot中，一项unknown不取消另一项；后一项可结算，未知assignment继续阻止补位和重启。

固定环境：离线lock安装成功，540复用/0下载，3.9s，manifest/lock无变化。原始安装输出bootstrap.stdout/exit来源bootstrap.json。实际显式6文件92不同检查通过，含runner33、S01并发23、lease23、admission8、outbox4、resume1；原始进程输出及exit保存在c0-tests.stdout/json。S01真实PG每次随机独立库，四个cleanup remaining均空；lease既有独占flow_r03 advisory保护，正常清理。没有停止他人服务。

最终test改为只依赖公开context.task.prompt后，单选并发检查1通过/32未选，见c0-concurrency-selected.stdout/json，不重复计入92。全workspace noEmit退出码见c0-typecheck.json与原stdout；不是全库行为测试。

Clean-code复核：2026-10-06 09:33:55 UTC，3源码文件。新class只传固定结算证据，不透传原生正文；无新调度器、存储状态或错误文本猜测。保留普通异常、取消、ownership lost、outbox与并发状态所有权，6条新增行为覆盖journal/重启/取消顺序/并发而非构造器。C1映射/deny/JSONL-to-PG尚未实现，不由本组通过推断。

## C1 固定投影入口提升

Mika回执许可只读提升固定0d0524c3439363d1fe60aad63f62817ba51fa2a5的final.mjs至apps/runner/src/native-harness/codex/projection.mjs，原算法逐字相同，SHA256见projection-source.json。公开入口createOrdinaryFinalProjection({threadId,turnId}).accept(notification)及声明projection.d.mts。没有写实验scope；待独审后Mika把实验改为薄import，避免长期双实现。

独立临时消费者用同一固定来源的15项final测试，仅把一次module import指向生产入口，其余断言字节保持；Node24实际15/15，原始输出/来源哈希见projection-tests.stdout/json，临时目录正常清理。此组证明算法提升，不证明C1宿主/deny/原生执行。原AssertionError可能携带原生内容，生产adapter必须归一且不保留cause；入口注释/Interface明确该约束。
