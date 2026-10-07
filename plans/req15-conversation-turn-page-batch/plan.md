# REQ15 会话轮次分页批量读取

| 字段 | 内容 |
| --- | --- |
| 计划编号 / 状态 | REQ15 / completed |
| 创建日期 / 最近更新 | 2026-10-06 20:39:12 UTC |
| 所属大task | [FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)，REQ-15 |
| co-lead | mika |
| Owner / model | db_transaction_owner / gpt-6-astra |
| Worktree / branch | /Users/citrine/Projects/AgentHarness/Flow-worktrees/conversation-turn-page-batch / codex/conversation-turn-page-batch |
| 基线 | 22a0806bc2465e11096949618113833f31766b19 |

目标：每页最多50轮在同一个只读REPEATABLE READ事务内批量读取，使数据库往返次数有明确上界，同时保持分页和每轮回复的现有语义。减少往返不等于消除PostgreSQL TOAST读取或全文hash成本，不沿用历史252条SQL作为当前测量。

初始范围由10 literal claim约束：5个既有读模块、3个新模块/测试、自己的计划和证据。不得修改tasks、contracts、client、migration或context写入路径；沿既有contextReferences。真实PG/HTTP和字节/roundtrip测量另排共享窗口，本片先做公开Interface的非PG证据。

## Module 与 Interface

- assistant/store：新增最多50个task+attempt绑定的final preview批读，返回与输入位置对应的preview/missing/既有校验错误；单条readAssistantFinalPreview复用并原样抛错。SQL保留完整UTF8 digest及left(content,4000)，JS再截UTF16的4000并移除尾孤高代理。
- conversations/replies：批量读取同client的current attempt/ownerVersion/session runner+harness证据；每task session细节LIMIT2保持歧义判断。仅针对符合原条件的legacy结果批读，不把typed invalid降级为legacy。
- conversations/turn-read：turnViews(client,rows)一次加载最多50任务、复用contextReferences与assistant批读，保持输入顺序、冻结message settings/context/effective字段。旧turnView只包装单项；queries.turnPage保留conversation 404、limit+1与RR事务，改消费批量结果。

## TODO

- [x] **REQ15-01** 核实际源、规则/技能、独立worktree并取得原子claim。
- [x] **REQ15-02** 先固定批量Interface与失败反例，最小实现单轮/分页复用。
- [x] **REQ15-03** 显式两个非PG测试入口及局部types；记录selected/pass/exit/wall，固定源码独审。
- [x] **REQ15-04** 隔离真实PG/HTTP消费者、当前roundtrip/UTF8字节测量和main集成，由Lead窗口协调。

## 验收

覆盖mixed50、空与超界、分页顺序/limit+1/crossconversation/404、同client与RR事务调用、foreign attempt和ownerVersion/session binding、每task两条session/artifact歧义、typed缺失/invalid/legacy和pending各分支、全文digest与surrogate边界、冻结上下文/settings。fake只证查询调用/传参和投影，不声称数据库真实快照隔离、SQL执行或真实并发；这些进入REQ15-04。

遵守[根模块化规则](../../AGENTS.md#modular-design)。plan/status/review分别记录实现、检查、独审及main事实；索引/架构基线由Lead协调，不越scope更新。

2026-10-06 21:49:49 UTC：局部source/fake/strict复审已通过；REQ15-04按[最小真实PG准备](../../docs/evidence/req15-turn-page-batch/pg-acceptance-plan.md)继续。产品冻结；当前仅精确两SQL请求和可审方案，非执行入口批准。

2026-10-07 03:47:30 UTC：main7b6已接收批量产品；真实2PG与测量已验，REQ15-04仅余最窄HTTP直接消费者。按[HTTP固定准备](../../docs/evidence/req15-turn-page-batch/http-window.md)保留现有单case所有断言，固定main含SVC07事务，专库与动态port0；types0/collect1仅说明准备可加载，实际HTTP待独审与新heavy窗口。state/replies在安全点原子amend交回，当前owner只保留其余8scope。

2026-10-07T04:05:44Z 本批验收完成：owner在固定HTTP结果独审通过后逐项核完REQ15-01～04，见[最终验收/主线接收索引](../../docs/evidence/req15-turn-page-batch/main-intake.json)。26/strict、真实2PG及8query/UTF8样本、主线Pool mock11和fixed-main7b6 HTTP1分别沿原证据/批准，不合算新通过数。产品已main7b6；本批page-batch任务完成，不是完整FLOW REQ-15分层性能、最新main全集或部署完成。后继架构基线责任仍由mika协调，不冒称图已更新。
