# WPF-RECOVERY01 连接、草稿和未决发送恢复

状态：in-progress。创建：2026-10-06 13:49 UTC；更新：2026-10-06 18:02 UTC。直接父任务 [WPF-MATURE-06](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-06-chat/plan.md)，沿原06-04，不建立第三执行层。唯一owner workspace_panels_owner / gpt-6-astra ultra；co-lead Web /root。

目标：真实App在有效会话刷新后恢复同一中心的草稿和原未决命令身份；重新认证不自动发送，退出不取消中心任务。遵循[模块规则](../../AGENTS.md#modular-design)。

已批准设计：ConnectionSession只消费固定公开cookie client，ConversationJournal负责namespace/IDB事务/CAS/预算；Outbox、QueueCommands、Steering controller仍为原命令authority。P01 sidebar.footer私有binding提供实际恢复入口，App保持view唯一权威。完整草稿含正文、intent、profile/project、knowledge、附件metadata及steering草稿，恢复原顺序与refs，不自动上传/读正文。库异常可继续内存编辑，不能绕过prepare/CAS发送纯文。

同步localreceipt接管→strict IDB事务complete→dispatching CAS complete→HTTP。CREATE两key/两body先冻结，绑定checkpoint完成后才turn。未知不自动重投、不换key、不靠同文GET猜受理；其他tab不能覆盖unknown。原稿交接严格draft version CAS，composer空通知或迟到ACK不得删除下一稿。普通close/switch/auth失效保journal，eligible dismiss另明确操作。

候选容量：command初始record+slot/index128KiB，增长32KiB全额预收；draft128KiB，最多32draft/128logicalcommands，global4MiB含namespace/manifest。每个状态精确UTF8 JSON计费，unknown不可淘汰。合法完整envelope超限需提高单条cap/接受更少条，不截身份或材料；现116451B设计样本不冒完整证明。上传旧journal的跨tabCAS/历史namespace展示不纳本片解决。

固定base 84005a260dfcb668cd38b09c21564d0754a0f513。共享client/domain/factory已正式main；不改shared/server/认证DTO，不复制HTTP。callerOrigin、迟到Clear-Cookie、重复Connect32slot三语义仍由中心owner协调，最终真实browser/approval前核准。

## TODO

- [ ] WPF-RECOVERY01-01：固定输入、合法scope和唯一canonical；实现有界ConnectionSession/Journal。
- [ ] WPF-RECOVERY01-02：四类原controller同步接管和durable barrier，CREATE两阶段及错误/CAS恢复。
- [ ] WPF-RECOVERY01-03：实际App/P01入口、完整草稿/材料和namespace隔离恢复。
- [ ] WPF-RECOVERY01-04：定向storage/controller直接行为验证与来源hash。
- [ ] WPF-RECOVERY01-05：资源允许后真实cookie/HTTP/SSE/App旅程，累计≤90s含≥15s清理、≤8MiB、1PG+1Chrome、0provider/个人服务。
- [ ] WPF-RECOVERY01-06：独立固定审查、修复、push和明确main接收。

## 验证与资源

当前仅轻量source/metadata；禁止安装/build/PG/browser。SVC06整套准备要求fresh空间≥2.5GiB；单Web/小验证按实际physical增量和约1GiB收尾余量另核，不以旧统一门槛误挡。这不新增install/build/PG/browser许可。基础direct tests另记，不冒browser/IDB真实运行。浏览器失败保raw并评估剩余预算，不无限重跑。个人61227/61228/4320不采不改。

## 范围与证据

精确21literal以[take回执](../../docs/evidence/wpf-conversation-recovery/take-receipt.json)为准；新增path须先amend。[Interface](../../docs/evidence/wpf-conversation-recovery/interface.md)、[质量](../../docs/evidence/wpf-conversation-recovery/quality.md)、[状态](status.md)、[审查](review.md)。

### 未来浏览器入口的运行前门禁（RB1–RB4）

父进程在启动前拥有worker和Chrome进程组，独立监督累计90s并保留至少15s清理；数据库CREATE尝试/确认/marker持久记录，只有精确marker且零连接可删，unknown与非空remaining均阻止通过/重跑。唯一scratch目录与递归evidence/日志预算、实时free监测须先于业务import/CREATE。材料稿及无reload认证失效纳入显式coverage矩阵；未实际运行保持NOT_RUN，不能沿text-only旅程宣称完整恢复。

### 7244 用例窄修

现范围内修恢复附件重新验证后同步到真实composer；binding订阅生命周期保持稳定，held submission不得被状态重渲染清理。浏览器在材料用例完成前核实际chip，再保原首POST attachment ref断言。不重新Use/重新选取或remount。SSE只核握手的当前断言准确标注；键盘用真实打开/关闭焦点断言。本段仅源码，0运行许可。

### 02d 材料完整性 / 原序修复

Send/Queue均先从现绑定检查本稿完整Input选择与composer同序、同ID交接，零chip不等于无选择；未验证、部分同步或不同顺序须在原receipt/HTTP前保稿报错。先B后A的目录验证只更新ready事实，同步不得跳过未ready前项；不改Input或receipt排序。held/inTransit旧交接与已consume材料不混入下一稿；显式remove才缩小本稿选择。必要验证包括受控binding的两个intent、分批metadata/延迟add、原refs有序handoff、显式remove和held/consumed/inTransit隔离，以及未来实际App双文件首POST。此段均源码准备，未增加运行预算。

本段独立来源复核：固定1b8的M1/M2仅源码addressed，见[review](review.md)所归档原报告；不勾选TODO、不将历史20case扩大到当前27case。完整target UNKNOWN / feature review NOT_STARTED；当前direct、types、browser均未运行。五源码继续冻结，后续检查须另有fresh门槛。

### 2026-10-06 16:23 UTC — 当前定向检查事实

固定1b8的27个受控IDB/mock-fetch直接用例已单次通过，execution HEAD0eef，runner2.034s、清理fulfilled，累计4.574/30s。[原始结果](../../docs/evidence/wpf-conversation-recovery/direct-second.json)。完整实现仍需真实App/cookie/CSRF/SSE/刷新旅程及固定独审；TODO不因局部检查全数关闭。当前types/browser未运行，剩余预算不自动授权新运行。

### 2026-10-06 17:09 UTC 验证入口修正

RECOVERY01-05真实浏览器入口先修原fixture代理传输：public Host/Origin/Sec-Fetch-Site按浏览器请求送达私有center；多个Set-Cookie分别转发，SSE保持流式取消/清理。只改既有fixture及own记录，当前source-only；历史1b8 direct27不覆盖该修正，browser与三项中心语义仍未验。

### 2026-10-06 17:28 UTC 验证前提窄修

RECOVERY01-05保留真实body-loss：完整中心ACK先验证并记录，再送真实headers/full字节Content-Length与严格正文prefix，优雅关闭连接；既有lost-turn须观测同一Request的headers→requestfailed和exact1 preRetry/exact2 postRetry、原key/body/refs。CREATE/Queue仅支持故障helper，不冒实际用例通过。ownedDB清理在marker前后均短时观察零连接，受同一parent硬截止；持续连接/查询错为失败，不FORCE、不终止其他连接。此段source-only，无新运行门槛。

### 2026-10-06T17:43:28.863916+00:00 — 768语义断言修复

Root/peer唯一P2按公共decoder修复，固定 `667889058d3decc0abc9f635a37fd0f05f2c090c`。要求ACK真实task身份为 `turn.task.id`；不再比较不存在的两个taskId。原请求通过现有conversationTurnSchema，公共decoder消费attachments/knowledge与原conversation，禁止另造codec；导入只worker。无新journey或预算。另明确DB1s为观察policy，非连接获取硬上限；原parent绝对清理截止不变。源码修复不是运行通过。

### 2026-10-06T17:45:10.279831+00:00 — 限定源码审批

固定667 ACK identity及768 harness源审由root批准，0blocking；[review](review.md)保原文。此结论不完成RECOVERY01-05真实旅程或RECOVERY01-06完整独审/main。原27受控检查与新browser未运行保持分开，源码继续冻结。

### 2026-10-06 18:01 UTC — 首真实子集失败

RECOVERY01-05首一次真实浏览器cookieRead通过，随后草稿存储旅程出现对象仓库缺失/超时，后续材料与重试均未完成；[原始证据](../../docs/evidence/wpf-conversation-recovery/browser-first-validation.md)绑定667/0fe939。清理确认、原raw保留；累计14.846267375/90s，余量不自动授权重跑。根因待定位，TODO不关闭，完整feature仍未审；首same-origin子集与中心三语义/完整覆盖分别记录。

### 18:08 UTC 首次失败修复边界

原RECOVERY01-03/04/05落实已授权配置的默认插件生命周期，撤权/namespace/generation/disabled仍守门；缺库observer只能pending并abort升级，已有malformed明确失败，不修库。复用同一纯observer于browser与受控case，五源限定。0运行，新检查NOT_RUN；首轮失败不是两静态问题唯一动态因果证明。
