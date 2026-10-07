# 原8组的诊断输入更新 / NOT_OPEN

2026-10-07T03:09:49Z，status_read / gpt-6-astra。开始HEAD `e3b9a3d5b354b75baaabac9da12a691bb5d54514` clean；一次fresh ledger available，原 `9ec4dbc8-b4d3-4e16-801f-caa3a2cd85ac` v2 ACTIVE /18 scope身份与路径相同，未修改领取。

chatui01_owner / gpt-6-astra 于2026-10-07T03:07:01Z独立批准 `e3b9a3d5b354b75baaabac9da12a691bb5d54514`：SOURCE/DIAGNOSTIC_RESULT_REVIEW_APPROVED，0 P1/P2，5 bindings/25660B，4项InventoryTests真实4/4、exit0、262.528ms、raw734B及自有新空TMP同身份清理。审者0运行/import/PG/写；首错有限事实、原异常/停止/KEEP规则未松。R1具体原因仍UNKNOWN，旧未知目录不读取或清理；该批准不证明8组PG通过。

当前唯一源码小改：`execute-pg.py`新增 `FLOW_S01P07_PG_INPUT`，仅允许 `pg-slot-request.json` 与 `pg-diagnostic-slot-request.json` 两个literal，默认旧名；未知名在资源建立前拒绝，记录实际已读取输入的name/SHA。默认旧包仍按原Git历史解释，不能让当前新wrapper冒用旧hash。未修改任何监督、计量、信号、deadline或fixture行为；没有新运行器/恢复框架。此selector增量待原reviewer只读确认，不复跑旧检查。

新[slot request](pg-diagnostic-slot-request.json)仅重绑wrapper/test，原8组、16task、160HTTP、15理论连接、120s work、70s fixture cleanup/80s afterAll、200s外部全程、raw1MiB/TMP32MiB不变。原floor1,207,959,552B；若另配local，其完整TMP/raw/source/metadata/收尾预算须在实际开窗消息中加到floor且确认隔离，未知则串行。当前无namespace、无holder、**PG NOT_OPEN**。新窗口仍需fresh HEAD=origin/clean、claim、所有inputs/30SQL/24dependency realpath+metadata、10个准确后缀lstat不存在及fresh空间。映射既有admin配置但不输出凭据。

静态复核：原65绑定除已审wrapper/test两个预期变更外，63项仍同旧manifest；30SQL和24dependency realpath/package.json hash均符合。产品保持83a，旧85非PG/strict5/3wrapperfake未重跑，原4capacity PG单列NOT_RUN。原R1和旧slot/prepared manifest原字节保留；新delta manifest引用旧65项并明确两个替代与新slot，不复制旧raw。当前没有执行wrapper、import或任何检查/PG。

复用既有methods.json的本地find-skills/clean-code/codebase-design：有限选择只负责输入绑定，单record仍负责资源事实，无任意路径/默认放宽，无新状态权威。任务开始UNKNOWN/完成NOT_COMPLETED不以本段时间代替。下一交付是同一8组真实验证，不能把本准备当产品完成。
