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

## 固定source独立结论

Reviewer：status_read，2026-10-06 21:36:02UTC；Mika另核六源diff/SQL约束/UTF16等价无blocking。Target `3cd7a6e867bd84ca877e07ea4e6e97f70d685e32`，结论 **SOURCE_REVIEW_APPROVED / VALIDATION_PENDING，0 P1/P2**。8 paths /55175B逐Git(target)=WT=manifest hash；manifest SHA256 `45fcdaee14075d904bb1a170bb7859019e690d1ce31c8c3a0a7fe9194fda6c90`。

本结论仅为source/SQL静态审，不证明运行正确性或main能力。首红26selected/17failed/9passed原件保持；新实现green/strict为NOT_RUN_RESOURCE，0新运行。真实PG后继须覆盖suffix坏但prefix相同的完整digest、每task LIMIT2混合、错误attempt/owner/session及并发RR快照。mixed50部分expected复用新turnView，只提供公开投影的一致性约束，不能代替SQL执行证据。

作者接受，无源码修复请求。本次仅metadata归档，claim保留；空间恢复后按Lead新准入补green/strict，实际PG另行窗口。

## 验证与fixture修复复审请求

Target `d209eb7275777d50f214fd73f66d6b3c1520c459`，产品6源相对3cd不变；仅turn-page-batch.test.ts一行显式row guard修复TS18048。green26/26在修前test/固定产品上执行；strict首错保留，修后focused strict-v2 exit0，26绿组未重跑。不自动扩大上次source approval：结果忠实性/fixture修复复审PENDING。请核[检查记录](../../docs/evidence/req15-turn-page-batch/checks.md)、[来源manifest](../../docs/evidence/req15-turn-page-batch/validation-source-manifest.json)、[原始输出manifest](../../docs/evidence/req15-turn-page-batch/validation-output-manifest.json)。真实PG/HTTP/main仍NOT_RUN。

## 定向验证与fixture修复独立复审

Mika，2026-10-06 21:45UTC，target `d209eb7275777d50f214fd73f66d6b3c1520c459`，**APPROVED /0 P1/P2**（限局部source+fake行为+strict）。Reviewer核5b8eb93 clean、6产品与3cd无diff、唯一row guard不删断言；green26/26、strict-v2实际exit0，108B首次类型错误与own组/TMP清理原件保留。source manifest SHA `2abe118da942b25be4f22c872c015dec123b8597f19a740409c2ba2213e1bfd0`（8/55181B）、output SHA `6f4f40ba876ecca2734a5122e0774f851e5e0151d476e033bdba2da65f04b120`（6/12275B）逐Git(d209)=WT=bytes/hash。非PG/HTTP/main批准。

下一片仅[真实PG准备设计](../../docs/evidence/req15-turn-page-batch/pg-acceptance-plan.md)与两SQL固定供给请求，未执行、未作为本approval范围。产品冻结，准备packet待下一轮审查。
