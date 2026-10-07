# K01 留存后继：规划依据与验收建议

2026-10-07；本文件是[原K01计划](../../../plans/k01-knowledge-sources/plan.md)的设计证据，不是第二份权威计划。仅规划；没有实现、迁移、产品测试或实际留存设置变更。固定源码输入 `c3ba1adfe9374b80a955d45e20310f000fed0310`，逐文件绑定见[输入记录](retention-planning-inputs.json)。旧K01-01～05/31项验证/main接收事实不变，完整REQ-10仍开放。

## 已核事实与用户收益

现在 `KNOWLEDGE_LIMITS.versionsPerSource=16` 同时限制 version/expectedVersion/citation schema、015两个身份CHECK及publish guard。publish使用head+1，因此不是实际保留记录计数；即使有合法回收机制，版本17仍会被三层拒绝。015版本UPDATE/DELETE/TRUNCATE均拒绝，chunks是可重建投影；现存API无回收或pin。

现knowledge写入持project→source→命令幂等锁，版本/chunks/head/原ACK同事务；key重放先于首次分支的CAS/容量判断，原receipt不能随head前进被重写。read/resolve为快照；search只扫描project当前版本。不能把版本号上限简单改大就宣称持续更新已完成。

固定引用并不只出现在018/021。原create/publish ACK给出version+digest，持有正文者即可构造旧合法citation；search/read/resolve也不登记引用。缺少context反向引用不是“无人引用”的证明。旧冻结记录只保存有界摘录，不能替代完整原文归档。

目标是**在确有可回收版本和剩余容量时，成功发布17、18及后续单调版本，既有固定引用及已冻结执行字节不变**。有限存储且所有版本都被保护时仍必须拒绝；不承诺旧16版全保护来源无条件继续、无限历史或无限更新。

## 推荐方案与取舍

选择一个knowledge留存模块，使用显式的managed-retention协商。拒绝仅抬身份上限而不界定容量；也不另建无限冷库来绕过64MiB。不造通用GC服务、后台扫描器或第二命令存储。

1. **身份与容量分离。** `version/currentVersion/currentVersionAtFreeze/expectedVersion`保留JSON number与PostgreSQL int32，合法范围1..2,147,483,647；create expectedVersion仍0。source.current_version是已提交发布的单调高水位，新成功版本=head+1，绝不重排、复用、按digest合并；到int32末值显式拒绝。实际保留版本数仍建议每source16、project原文64MiB、source128、单正文256KiB。空正文也占一个保留槽。count与byte容量由同事务检查，不能由身份编号推导。
2. **永久保护与可释放固定引用分开。** 当前head、legacy/unknown引用状态和内部历史永久保护标记均不可回收。K02/K03已不可删除的历史首次引用某版本时，在原冻结事务中设置该版本永久保护标记，不为每次冻结新增无限holder行。外部固定引用通过owner命令取得有界holder/pin；建议每保留版本至多64个活动holder，释放只能移除该holder，不能解除legacy/内部保护。引用正文/locator/digest校验和pin必须先于“固定引用成立”，且与调用命令提交原子一致；错误/锁超时/未知结果不能跳过pin继续。
3. **preview不是固定引用。** managed来源新发布receipt/search/read可返回明确的临时身份/preview；永久引用必须取得pin，或者在Send/Queue/goal定义的同事务中永久保护。KnowledgeCitation字段和canonical字节不改；保护状态放在独立协议/envelope，不把pin ID塞进既有citation/digest。临时preview与原文缓存不保证以后仍可固定：回收先发生时pin明确version_gone，不能偷偷换head。
4. **legacy保守兼容。** 前进迁移保留全部既有号/正文/digest/ACK并标记legacy保护，不据018/021反查为空而解除。未协商managed能力的旧客户端不能在managed可回收版本上静默取得被它当永久引用的结果：首片推荐明确upgrade-required错误、无部分结果；选择保守保护后兼容暴露是另一可行策略，但不得混用成隐式保护。新客户端到旧中心仅使用原保留语义，不发送未知字段或自动改协议。send/queue的协议选择必须与body/key一起冻结，未知ACK只重试原请求；不能同key切协议。协议变化须先处理原未知结果，再建立新的逻辑命令。既有legacy来源继续原兼容行为；是否新建/发布managed版本须明确选择，不能批量切换旧来源。端点/协商字段由后续合法owner固定，本次不抢共享接口。
5. **归档与回收不同。** 归档只表示退出当前检索/按需读取；保留的完整正文继续计入16/64MiB。可删除旧chunks来减少投影，但这不释放原文容量，也不是完整版本已回收。回收只删除已知managed、无内部/legacy保护且无外部holder的完整旧版本及衍生chunks。source/head不删除；冻结详情仍需它报告currentVersion。旧序号≤高水位且不在保留集合，可明确gone；未来号not-found，不为每个回收号永久增加tombstone。

新留存命令仍复用flow.commands保存不可变ACK；需独立、有界的feature receipt/metadata预算，不得把空正文或pin/release循环变成无限记录。候选初值：每project最多4096条新留存协议变更receipt，触顶拒绝新首次命令但允许原key重放；不清理旧receipt来假装容量恢复。活动holder行上限128×16×64，永久保护标记至多每保留版本一行。该预算只是待实施的保守初值，不能宣称现在已有；具体计数索引/计费字段需在合法migration中审定。不改变其它领域commands留存。

## 职责、事务与异常

| Module | 小Interface / 状态所有者 | 生命周期与依赖 |
| --- | --- | --- |
| knowledge存储/发布 | 分配下一身份、创建不可变正文、原receipt重放 | 原project→source→命令锁；保留current与总容量权威 |
| knowledge留存（候选 `knowledge/retention.ts`） | `protectVersionsInTransaction`、外部pin/release、规划本次回收候选 | caller拥有事务；稳定按(sourceId,version)排序锁版本保护行；只向下依赖版本与FK，不回锁project/source/conversation |
| K02/K03冻结消费者 | 校验/冻结原文字节后，在同事务保护精确版本 | 保留原输入/队列/目标状态权威；promotion、retry与运行中执行复用已冻记录，不重新resolve源 |
| contracts/client/Web | 范围codec与managed能力协商、区分preview/固定ACK | owner鉴权不扩大；runner不能因此直接读取或固定知识；错误不伪造成空结果/成功 |

**锁序是待验收推荐，不是已证明的并发实现。** K02当前是命令幂等→conversation锁，resolver只读project；不能声称已有project写锁。K03先普通goal读取再project锁。新增内部保护仅锁确定version保护行/FK，不在K02持conversation后再取得project/source锁。发布/回收从project/source向下竞争同version锁；不会反向取得conversation/goal。多个版本必须统一排序。外部owner pin/release如需要project级receipt计数，在外层按project→source→version锁，内部冻结不调用这个外层命令。

publish在同一事务拟定newhead后计算容量：旧current若无持久pin/legacy/内部保护，成功切head后可成为回收候选，不能一律把发布前current保护算永久。先锁候选并重新验证保护状态，按需要释放最少版本；插入新版本/chunks、切head、回收与保存receipt整体提交。读者只见旧快照或新快照；任何容量/插入/回收错误回滚旧head、正文、pin及receipt。保留版本上限按提交后的集合计数；不能先commit删除来腾位置。

数据库需同时提供：不可变身份/正文/digest的UPDATE/TRUNCATE拒绝、current FK保护、外部pin FK阻止删父、内部/legacy保护DELETE guard以及合法回收条件。必须前进migration，不能修改已经发布015，也不能临时禁用immutable trigger执行普通SQL删除。保护行缺失/状态未知一律不可回收。pin赢锁则回收重算/拒绝；回收赢锁则新pin明确gone且冻结命令无残留。未知、死锁或超时整条命令失败，不猜引用失效、不用TTL解除。

## 直接消费者与兼容清单

| 固定c3ba输入 | 已核风险 / 后继验证 |
| --- | --- |
| contracts/knowledge.ts；015；knowledge/storage.ts | 多处16身份上限；实际保留count、int32边界、旧schema/ACK摘要不变 |
| conversation-context/store.ts；goal-context/store.ts | `currentVersionAtFreeze>16`拒绝；即使citation1，head17也要可验证；冻结字节/摘要/重试不变 |
| contracts/conversation-context.ts；client/conversation-acknowledgement.ts | currentVersionAtFreeze codec≤16；不能返回假16取悦旧reader |
| context-transparency/projection.ts；contracts/context-transparency.ts、context-observation-history.ts | 独立硬16及嵌套citation schema；历史/透明度原有响应预算不扩大 |
| Web conversation-context/controller.ts、selection；client/index.ts | Web正文/选择验证；知识GET仅typed transport，拿到17不等于旧reader兼容；history有runtime parse，旧v1不能直接接收越界成功DTO；需明确协商后扩展协议或明确不支持 |
| conversations.ts/state.ts能力；新旧client | 现在knowledgeContext只有boolean，不代表managed版本/保留协商；需要明确新能力而非改变旧boolean含义 |
| 018/021及queue/promotion/claim | JSON摘录无source-version FK；同事务保护不得在promotion/claim重新resolve、改执行prompt或消耗模型 |

Root与chatui01只读输入已合入同一记录，不另造下游事实源。未来scope候选为knowledge模块/契约/前进migration及上述直接codec/冻结seam；共享client、Web、conversations/state.ts需现owner协调。2026-10-07 00:10:18.676Z Root看到state.ts由REQ15、client/index.ts由S01P07、Webcontroller由WPF-RECOVERY01占用；这是历史观察，不是当前写权。当前claim仅本plan/evidence。

## 后续验收矩阵（全部NOT_RUN）

| 稳定验收ID | 最小行为证据 |
| --- | --- |
| K01-R01 | managed来源发布至17/18/33，保留count≤16；每版identity单调、同digest仍不同号、空文本也计槽；int32越界400/耗尽显式拒绝 |
| K01-R02 | legacy16全保护、内部历史全保护、64MiB原文满、holder/receipt容量满均拒绝且全回滚；原31保守容量事实保持历史有效 |
| K01-R03 | 15历史保护+1无pin旧head：新publish可原子替换旧head并保留16；新head失败/回收失败不丢旧head或bytes |
| K01-R04 | 并发pin vs publish回收两种获胜顺序；pin先成功则不能删，GC先提交则gone/无冻结残留；锁超时/unknown不裸降级 |
| K01-R05 | 两发布者同CAS只有一个成功；同key丢ACK/restart回原receipt，更新或回收后重放仍不重新发布/改号/恢复已释放holder |
| K01-R06 | 旧citation与新外部pin的Unicode/CRLF/NFD/反斜杠原bytes/digest不变；release不影响其它holder/内部/legacy保护；无TTL过期回收 |
| K01-R07 | K02 send/enqueue来源更新/归档后automatic/explicit promotion、cancel、pause、restart及C02两种retry仍用原冻结bytes；raw prompt/metadata边界不变 |
| K01-R08 | K03旧goal input/已运行execution/accepted历史仍原bytes；source同digest新version仍stale，真实依赖失效保持；owner/runner权限不扩大 |
| K01-R09 | citation1+currentVersionAtFreeze17和citation17穿过server/client/Web/context history；旧中心/旧client/不协商managed明确兼容或拒绝，绝不假报head16 |
| K01-R10 | 前进迁移重启，旧015/018/021 bytes与receipt完整；直接UPDATE/DELETE/TRUNCATE保护不能绕过，current source不可删；已回收号gone/未来号not-found |
| K01-R11 | search仍只当前source、excerpt≤512B/JSON≤48KiB，resolve≤4KiB，context详情≤8KiB/JSON≤64KiB；projection删减不改变原文authority |

只在未来获产品scope后做唯一专库/动态端口/0模型功能验证及直接消费者检查；本次未运行它们。保留纯metadata审查与产品实现/验证/集成的区别。
