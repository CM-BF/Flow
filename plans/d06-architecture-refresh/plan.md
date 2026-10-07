# D06 架构固定快照更新

2026-10-07；completed（本固定快照与连线显示交付范围）。唯一owner d01_owner / gpt-6-astra ultra；原 worktree `dashboard-architecture-runtime` / `codex/dashboard-architecture-runtime`。直接父 [D01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/execution-dashboard/plans/d01-execution-dashboard/plan.md)。

本轮沿既有D01/D06后继，以固定 main `0da869f7bad98771177472539b5a192365c15117` 更新原五图策展数据。保现有renderer Interface，准确展示 Web/TUI→client→center→runner/adapter→外部package/PG，源码实现、实际挂载、验证和个人部署分别表达。原aeb批已正确交付，本轮是后继更新，非补做旧验收。

范围、来源与未运行边界见 [Interface](../../docs/evidence/d06/snapshot-0da/interface.md)；[新四范围领取](../../docs/evidence/d06/snapshot-0da/take-receipt.json)已COMMITTED，历史6cad与eccd均released。原 [计划](../../docs/evidence/d06/snapshot-0da/previous-plan.md)、[状态](../../docs/evidence/d06/snapshot-0da/previous-status.md)、[review](../../docs/evidence/d06/snapshot-0da/previous-review.md)原样保留。

- [x] D06-09：核原owner/树/基线与独占四范围，固定本轮main输入。
- [x] D06-10：按固定source核事实并更新五图数据与来源断言，保未集成边界。
- [x] D06-11：固定候选独立审查；必要定向检查另经资源准入，本轮不自动运行。
- [x] D06-12：原Lead主线接收与发布证据核齐、唯一status收口并停止写入；正常pushclean后的CAS释放由管理执行，实际版本以账本为准。

D06-01～08的完成事实与证据继续见历史，不重编号或撤销旧批准。status是唯一进度来源，D04是唯一领取来源；main registry已指向同一原树，无新父计划或重复source。

## 历史执行过程：D06-11 实测显示缺口

首轮新布局验收发现既有renderer中文背景估宽缺口。已[原子amend v2五范围](../../docs/evidence/d06/snapshot-0da/edge-label-bounds/amend-receipt.json)，仅新增 architecture.js；修复[Interface及来源](../../docs/evidence/d06/snapshot-0da/edge-label-bounds/interface.md)复用挂载SVG bbox、批量读写。新source固定后独审，原22与首轮FAIL/清理/6733预算保留，未自动复跑。CSS/server/registry及五图文本数据不改，原D06-12主线交付仍待验。

后继a28e renderer已获限定source批准；首轮FAIL归因/清理独审已接收。第二candidate只绑定新source/currentHEAD与剩余83267ms，scenario所有断言原样；原准备时待具体heavy交接。当前Lead明确允许隔离0PG浏览器与SVC06保留资源并存，须按[完整资源合同](../../docs/evidence/d06/snapshot-0da/browser-second-preparation/coexistence/admission-contract.json)复审与fresh准入；无当前gate，不重跑原22。

SVC06后于04:13:44.010Z实际归还，root明确D06下一窗口；上述完整高线保守保留，新HEAD绑定修订审查后才能fresh准入，当前未运行。

## 当前交付边界

[主线及发布核验](../../docs/evidence/d06/snapshot-0da/main-closeout-20261007/main-readproof.json)确认591完整exact8已接入02c880，Lead两静态资产GET与新main相同。复用已审22direct及第二5组/20观察；未重跑。390默认42%文字可读性缺口另归既有D01/REQ39后继，当前通过仅几何/键盘/source导航，不能扩大成完整视觉阅读通过。
