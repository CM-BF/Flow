# REQ15 证据与质量

2026-10-06 20:39:12 UTC。任务：Node24/TypeScript/pg8.23.1/Vitest4.0.18的有界conversation页读取。find-skills方法先匹配本地：`/Users/citrine/.agents/skills/find-skills/SKILL.md`、`clean-code/SKILL.md`、`codebase-design/SKILL.md`，已读，无安装/更新。clean-code沿既定sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，SHA256 3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317。

实际应用：同client、保留小batch Interface、单项复用批量投影、每条数据错误隔离且DB错误继续传播；不复制context投影/冻结规则、不新增缓存或通用框架。启动检查确认旧turnView顺序N+1、preview在PG全文hash但只传prefix，session/artifact各自LIMIT2不能变整页LIMIT2。

当前原子[回执](claim-receipt.json)已成功。依赖9入口由Lead按[请求](dependency-request.json)供给；owner不安装/复制/建link。首片非PG只允许两个显式测试路径、局部types，fresh free>=1,107,296,256B，cache/tmp/raw归本目录，NODE_DISABLE_COMPILE_CACHE=1。真实PG/HTTP/并发快照与UTF8字节测量NOT_RUN；无历史性能数字移用。

## 静态实现检查点

2026-10-06 21:33:34 UTC：已应用clean-code/codebase-design逐段复核命名、职责、接口、错误、重复与资源所有者。assistant/store保持唯一final验证路径，per-binding错误容器仅捕获原三个HttpError，未知DB/投影错误不降级；replies统一单/批读取，持久任务ID去重以避免重复turn输入放大legacy歧义；turn-read只负责装配，contextReferences无复制。未增加缓存/新调度器/迁移/外部契约，事务仍由queries拥有。源码静态确认paired unnest、current owner/session runner+harness、每task子查询LIMIT2、typed-invalid不落legacy、full UTF8 digest与UTF16边界。未知项：尚无green/strict/真实SQL执行，静态自检不宣称通过。

首红 [red.json](red.json) / [red.log](red.log)：26 selected、17 failed、9 passed，exit1/0.824651s；10455B raw完整、PGID52890 absent、TMP前后0B，同inode移除。17失败为新接口缺失和mixed50旧查询调用上界（该受控fake实数214，不是实际PG roundtrip/历史252）。首次green准入free1042001920B <1107296256B，0 child；green/strict状态均NOT_RUN_RESOURCE。依赖已由Lead供给并核9 realpaths/version/package SHA。

[run-check.py](run-check.py)只复用已审固定SVC07的supervise纯函数，在进程内将module.ROOT设成本worktree，不调用main、不修改SVC文件或导入跨树产品。显式两test路径/strict、30s总预算（27s监督+最多1s关闭）、合并raw64KiB、Node编译和Vitest缓存关闭；独立TMP只做前后有界空目录检查，非实时32MiB硬隔离，异常内容/身份保留UNKNOWN。每次own PID/PGID立即fsync，原始stdout与结果分开且不覆盖。0真实PG/provider/native。

## 稳定内部Interface（待独审）

| Interface | 输入/输出与生命周期 | 查询预算 |
| --- | --- | --- |
| readAssistantFinalPreviews | 同PoolClient，≤50个task+attempt对，同序preview/null/既有typed error；单项包装保throw | 空0，否则1；正文fullhash仍在PG |
| assistantProjections | 同PoolClient，≤50持久TaskRecord，同序assistant/effective；task ID去重用于底层读取，冻结状态由caller提供 | session1 + typed1 + 仅eligible legacy1 |
| turnViews（state再导出） | 同PoolClient，≤50 TurnRow，返回同序ConversationTurn；task404不变；caller拥有RR快照 | task1 + 可选context1 + replies最多3 |

turnPage保留conversation读取+limit+1，最大7 reads加BEGIN/COMMIT=9次调用；无context/legacy时更少。单turnView、assistantProjection、sessionEvidence、readAssistantFinalPreview复用批量路径。legacy仍传完整body到JS核digest；session detail最多每task2条，未声称全部传输字节有界或消除TOAST/hash。实际并发snapshot、真实SQL正确性、HTTP和UTF8字节/roundtrip测量仍属REQ15-04，不能从fake或本静态预算推断。
