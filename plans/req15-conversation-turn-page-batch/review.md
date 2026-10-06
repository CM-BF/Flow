# REQ15 独立审查

状态：**NOT_STARTED**。尚无实现target，无approval。

## Target / scope / 验收

base为22a0806bc2465e11096949618113833f31766b19，唯一树/分支及拟scope见[status](status.md)。实现提交固定后只按目标中实际存在的产品路径审查；metadata不扩大approval。验收见[plan](plan.md)，fake与真实SQL/并发/性能证据分开。

## 可复制审查任务

请只读审查REQ15。先核真实worktree/branch/base/HEAD/dirty、规则与技能，绑定完整实现commit。核批量与单轮共用逻辑、<=50上界、session/attempt/ownerVersion身份、per-task LIMIT2、typed invalid与legacy差别、Unicode/digest、RR/404/分页顺序及冻结上下文。复核原始selected/pass/exit/wall与未执行项，不因fake推断真实PG能力。回传severity、行证据、阻断影响和修复建议，不修改实现。正式review记录仅由owner归档。

## 检查 / Findings / 结论

全部NOT_RUN；findings未评估；结论NOT_STARTED。独审后按固定commit归档，若修复则记录新commit和复审，空模板不表示通过。

## 本次固定source审查请求

Target `3cd7a6e867bd84ca877e07ea4e6e97f70d685e32`，base22a0806bc2465e11096949618113833f31766b19，scope为[source manifest](../../docs/evidence/req15-turn-page-batch/source-manifest.json)8路径（6产品+2测试）。独立结论PENDING，不视空模板为通过。请核pair绑定/当前attempt-owner-session/每task LIMIT2/known typed错误隔离/legacy fallback/冻结context-settings/UTF8全文digest与UTF16边界/同client与单项复用。

已执行：首红26selected/17failed/9passed、exit1，fake旧mixed50实数214次；新source的green/strict **NOT_RUN_RESOURCE**，此前green准入0child。真实SQL/PG/HTTP/并发snapshot/字节测量/main均未执行。源码静态审与后继测试回执各自绑定，不通过删断言或降低预算收口。
