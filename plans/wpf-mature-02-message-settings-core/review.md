# WPF-MATURE-02-CORE 独立审查

**APPROVED — 仅固定 contract leaf，0 P1/P2；下一片不继承。**

## Target 与 scope

- Review target commit: 4e7b7f968a2160a60989b3b6343506ae8fb5ef6a
- Base: `70cc4e852365e974cefde30bfad75c7d233985c6`。
- WT: `/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core`；branch `codex/claude-message-settings-core`。
- scope: `packages/contracts/src/claude-turn-settings.ts`、`packages/contracts/src/claude-turn-settings.test.ts`。本树5/5与局部strict0已执行，仍待独立review。
- 排除：shared export/center/profile/SDK bridge/client/UI/migration、实际模型支持、持久化不可变性与恢复生命周期。

## 可复制只读审查说明

```text
请对 WPF-MATURE-02-CORE 固定 source target 做只读 review。先读 AGENTS/plans/AGENTS、本 plan/status；fresh 核 WT/branch/HEAD/dirty/claim。用本地 find-skills、clean-code、codebase-design；审完整两文件和 manifest Git/hash/bytes。重点完整无 defaults、effort not-requested 不宣称重置、缺可信能力 unknown 与可信空集合 unsupported 区分、profile 三元身份、完整组合而非各轴拼接、UTF8 canonical bounds、ACK 精确匹配、无 runtime imports/循环/IO。已固定的5/5和strict0原始证据无需重跑；默认只读 review，不运行PG/SDK/provider或目标。修复交 owner，不写本树。
```

## 检查与证据

| 检查 | 状态 | 证据/边界 |
| --- | --- | --- |
| 设计与依赖自审 | 作者只读 | [quality.md](../../docs/evidence/wpf-mature-02-message-settings-core/quality.md) |
| 五组 Vitest | PASSED | [vitest.log](../../docs/evidence/wpf-mature-02-message-settings-core/vitest.log)，5/5；不存在运行前红证据 |
| 局部 strict | PASSED | [checks.json](../../docs/evidence/wpf-mature-02-message-settings-core/checks.json)，strict exit0、继承root基线 |
| 独立 review | APPROVED | [receipt](../../docs/evidence/wpf-mature-02-message-settings-core/independent-review.json)，Mika15:31:09 / architecture_read15:31:25 UTC |

## Findings / 作者回应 / 复审

Mika与architecture_read正式固定审均0 P1/P2；无待修finding。完整来源/时间/范围见独审receipt。未复跑检查；批准不覆盖export/consumer/admission/SDK/resume。后继source需新target与独审。

## main接收与后继范围

首leaf source4e7/metadata b342已接main22d5ca67159b35bb794b2711cf6df0cb905b92e8，owner两源比对一致，不重测。后继optional turnSettings纵向已于独立source checkpoint实施；仍不继承首leaf批准，当前范围见下节。

## 下一纵向 SOURCE_REVIEW（运行未开放）

- Review target commit: 92f768e3517a64235629858f50cdc3926d099b2d
- 修复 target: ea276572c3c99fb8400808a93efc69ce530d55a4（仅新test hook80s与自备分页前提）。
- Mika/root只读完整生产链：profile/catalog→send/queue→first promotion/empty resume→SDK query/init→final/context/retry，无新增生产P1/P2；本owner于2026-10-06 16:15:42 UTC收录，原消息未提供单独审时，不伪造通过时间。
- architecture_read只读确认5239新base refinement导致interaction extend异常的P2在92f移除后静态关闭；032/helper于16:07:10静态未见阻断。不是PG或正式组合批准。
- architecture提出92f fixture afterAll60s短于最多9×8s清理链P2，已ea276将hook80s以覆盖清理；分页用例额外自建第二profile，保留断言。待原审者固定delta确认。
- 所有新pure/HTTP/PG/typecheck仍NOT_RUN；源码审查不证明运行、迁移、shared factory/ACK与用户consumer可用。[manifest](../../docs/evidence/wpf-mature-02-message-settings-core/vertical-source-manifest.json)是SOURCE_REVIEW包，非integration-ready。

2026-10-06 16:17:01 UTC architecture_read/gpt-6-astra 窄复审绑定ea276：cleanup P2、分页独立性P3 CLOSED；.extend P2在92f静态关闭。新test Git=WT/21171B/SHA8d65be70cf7e3c239b9604b05488895bc5f0eec793a1f916ef95b7c7ed1a3db6。SOURCE_REVIEW本范围无剩余P1/P2，VALIDATION_PENDING/0运行；[结构receipt](../../docs/evidence/wpf-mature-02-message-settings-core/vertical-static-review.json)。不是工程/整体APPROVED。
