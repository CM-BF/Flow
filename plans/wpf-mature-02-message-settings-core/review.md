# WPF-MATURE-02-CORE 独立审查

**NOT_STARTED — 当前完整纵向组合；原首leaf独审为下列历史，不自动继承。**

## 当前纵向固定交审

Review target commit: ea276572c3c99fb8400808a93efc69ce530d55a4

生产checkpoint92f，ea为两test修复；完整34source/readonly/config与所有原raw绑定见[交付manifest](../../docs/evidence/wpf-mature-02-message-settings-core/vertical-delivery-manifest.json)。已有SOURCE_REVIEW静态无剩余P1/P2；现29 distinct=16合同+5注入+8真实专库，contract/focused strict各0。最新8PG全部执行、14tasks11attempts116HTTP，清理conn0/absent。首PG beforeAll失败与第二窗口resource NOT_RUN原样，不能抹为通过。正式组合独审尚未收讫；F01 production mount/client/Web/TUI与真实provider未覆盖，完整准则见[review-ready](../../docs/evidence/wpf-mature-02-message-settings-core/vertical-review-ready.md)。

## 历史首leaf APPROVED（仅4e7）

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

Mika/root随后对metadata650bb固定包独核34 source + 3 prepared config + 3 historical support（manifest SHA b4625c80ac73161cb52cc5ddf990846402538f9300f0df6a14758cabccbdd606），Git/WT/hash/bytes 0 errors；三配置未加载，@flow本树/第三方固定/根strict继承/缓存归属静态成立。生产SOURCE_REVIEW结论延伸至ea276，仍NOT_OPEN/VALIDATION_PENDING/未main。具体审时未单独提供，不补猜时刻。

2026-10-06 16:21:52 UTC首个纵向检查证据：ROOT授权一次contracts-only，精确3文件16/16/exit0、752.427ms；原source ea276不变，raw/cache门限与清理记录见contracts-validation-manifest.json。新runner/真实PG/strict、外部consumer仍pending；不把源码SOURCE_REVIEW升级为整体APPROVED。


2026-10-06 16:26:54 UTC：Lead补全155只读source/673771B，正式receipt已归档为vertical-source-materialization.json；c33d于16:22:43提交与sole sparse窗口发生并发，Lead记录仅9metadata/无产品diff，未重复sparse，随后短锁明确解除。未将旧closure的采样HEAD改成新事实。

按ROOT分别开放的局部窗口：contracts-only strict exit0/931.641ms；注入query runner单文件5 selected/5 passed/exit0/713.736ms（raw2326B）；五入口focused strict exit0/2227.619ms。每步fresh free均满足1,107,296,256B，最终1,128,894,464B。runner owncache132B清理，自有TMPDIR结束为空并移除，combined observed peak998994B低于32MiB。当前21 distinct为先前16合同+新5注入，不累计历史leaf5；所有34源仍ea276。PG/真实SDK/provider/共享挂载仍NOT_RUN，完整交付review与main未完成。固定[新局部manifest](../../docs/evidence/wpf-mature-02-message-settings-core/vertical-local-validation-manifest.json)绑定source/readonly/config/16raw。

Root静态发现prepared PG config的`.js`引用在native loader下不存在；仅改为磁盘已有`.ts`，不放宽compiler、不重跑21项。旧source manifest保留历史config hash，新局部manifest显式绑定这一prepared delta；未实际加载PG配置或连接数据库。

2026-10-06 16:52:30 UTC实际专库验证失败收口：beforeAll缺动态migration URL输入012，1 failed suite/8 skipped/0case断言，保留原raw并交回窗口；真实专库已确认0连接/absent、ownedcache/temp清理。source ea276未修改，先前21distinct与两strict0不重复累计；4个只读SQL5539B补充给Lead，worker未物化/重试。此次失败不据静态审升级为整体APPROVED。错误根因为原静态closure遗漏固定数组模板URL；clean-code复核选择补输入事实，不修改生产错误处理或绕过migration求通过。

2026-10-06 16:58:48 UTC第二窗口仅预核，资源门槛不足NOT_RUN，0新增工程/PG/目标。4动态SQL恢复与独立静态closure输入已核/归档，原失败不回写；known input错误解除但运行未知保留。窗口立即交回，不以资源曾满足或static closure齐备替代fresh准入，不重跑已绿21项/两strict。
