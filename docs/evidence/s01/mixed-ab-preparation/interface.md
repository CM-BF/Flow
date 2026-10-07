# S01 A/B preparation Interface

2026-10-06 13:43 UTC；owner status_read / gpt-6-astra，co-lead Mika。当前只授权 preparation；唯一未来窗口仍 **NOT_OPEN**。权威 WT /Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe，branch codex/runner-capacity-probe；claim 508f9c85-a27c-4382-bfe9-caca43be4b0e v1，四 literal 见 claim-receipt.json。

## 固定输入与唯一变化

A=`a3e670b906c1b65d586b7730ca19da83109f1dcc`，B=`aae1eb1054d75e78273e7c91ed048aeac80195da`。生产唯一差异为已审 P05 `apps/server/src/events.ts`，非 runtime 的 event-state.test.ts 另有变化。A events SHA256 4a2404d4a82f05dc3538c871dac3e9f0c15f5936310624bee787d6039e37f853；B 270065bc93cb5c5aeb306ffd3329ea122e6ee00eec6ba1808628694b1f7a1e02。共同 mixed 实现复用 6de928d8092ba8c22ac2222ac7c16af3660be48a 的26源，observer两源采用 c259e8e53cd53830fe1bc78ce3c8dae7b34d5540。新变更另固定 target，不改旧 raw/manifest；历史绑定按 fixed Git，不再声称当前 WT 源都相同。

不 merge 移动 main。main2f16 的 plugin 依赖增量不在这两个固定输入中；P06等待 Module 也不加入。A/B各自导出 apps/server、apps/runner、packages 及必要根 package/tsconfig/lock 声明，纯 Git blob、无认证/config。两个自有只读输入 root 仅充当加载目录，不是第二套 driver 或可写产品分支。所有导出/哈希/清理在唯一总 clock 内。package workspace依赖链接只依据各固定 package.json 指向同一导出 root 中真实 package；外部依赖复用既有固定安装，并核版本/真实路径、pg同一Pool。不得由旧WT aliases暗中加载产品。

## 最小 Module / Interface

`runComparison(windowId, executionHEAD)` 顺序调用现有 `runMixed` 两次；只传内部固定 A/B identity、已验证 sourceDirectory、同一总 ledger。现有 runMixed 仍拥有 PG/HTTP/child/outbox/证据与清理；不复制 case loop。新增窄 hooks 只将每次 byte charge / task admission / work gate 同步提交外层 ledger。三个实际生产 dynamic import 指向选定 sourceDirectory；legacy identity省略该选项仍走原路径。父目录 processes/http/evidence Helpers只读复用，当前无需扩大scope。

外层掌管固定源码导出、共同输入预扣、A/B生命周期与最终 receipt；内部无retry。B只在 A success、已证明 children/DB/journals/stream/evidence 完整收束、无unknown/retained 且剩余时间≥150秒、余byte足额240MiB+尚未预扣最终reserve时启动。异常停止，不补task/attempt；每侧最多128，合计最多256，未知POST仍扣额。请求错误保留非敏感分类/身份/phase，不保留body/token。

## 固定预算与负载

总300000ms/512MiB，外层软停384MiB、余128MiB供收束；每侧135000ms/240MiB、work105000ms/soft192MiB。共同输入/最终证据32MiB单独上限；其中最终receipt/CLI/archive先预扣，导出实际字节实时再扣，重复可见输入按保守口径记录。计量是可见实验输入、Node流、IPC、证据，不是模块加载全部OS I/O或网卡流量。共同输入与每侧上限合计512MiB；不能只在两侧结束相加。外层时间门禁覆盖Git导出、校验、所有自动写入、cleanup与CLI送达；物理进程启动/退出由明确外部time receipt独立核验。

A→B各一组8 runtime×16（同runner child），每侧128唯一 fixture task/attempt/持久session，6s、2Hz、256B、await emit、heartbeat1s、poll500ms、request3s、lease10s、DB observer200ms、轻读100ms最多2并发、memory1s、settlement5s；与旧128相同。侧内cleanup绝对偏移117/120/121/123/125/128/130/131/132/133.5/134.5秒，均不能超过外层deadline。A/B固定顺序与背景负载、观测器开销作为混杂报告，不声称严格speedup/SLO/native容量。

## 本片验证 / 未运行

只执行有界pure/fake红绿：实时扣账/共同reserve、B启动余量、A失败与unknown不启动B、不同source只允许events、依赖解析与owned root清理、旧identity保持。fake不得调用PG/HTTP/runner/provider；固定后独立review才申请唯一窗口。旧128 raw及FKye9L journal不读不动。共享磁盘需始终≥1GiB，当前take前1,607,438,336B；不安装/大复制。

技能：本地 find-skills 先发现已有 clean-code/codebase-design/brainstorming/tdd，无需联网安装。clean-code受控来源 sickn33/agentic-awesome-skills bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，SKILL SHA3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317；路径 /Users/citrine/.agents/skills/{find-skills,clean-code,codebase-design,brainstorming,tdd}/SKILL.md。实际应用：单一编排责任、固定枚举输入、同步失败传播、资源finally、真实legacy路径回归；不新造通用driver/状态机。

## 磁盘与执行门禁补充（2026-10-06 13:52 UTC）

当前磁盘实际条件不满足，actual仍NOT_OPEN。入口/两侧前均要求fresh `statfs` 至少1GiB保留+512MiB可见实验余量；运行期间单flight每秒采样，低于1GiB或采样失败会停止新work/领取并走原cleanup。该检查不声称共享PG/WAL/其他任务增长有静态上界；实际时机仍须Lead/GO确认共享资源条件。输入导出两侧合计约6.64MB逻辑，Git输出与导出双计、直接外部manifest计入共同32MiB，最终证据/CLI预扣4MiB；源副本自身与证据有硬上限，未知文件操作保留root不删除。未建立PG新集群/新存储框架/容量预演，也未清理任何他人资源。

候选window literal为 `s01-event-state-ab-once`，不是OPEN。共用编排进程顺序拥有A/B各center+runner child，两个侧的runner各承载8runtime；报告4个child实例（不同时常驻），不是16个独立runner进程。code performance clock覆盖automatic entry之后至CLI callback，外部 `/usr/bin/time` wrapper另存物理process start/exit；二者均须≤300s，不以内部PASS替代外部送达/exit。
