# REQ15 证据与质量

2026-10-06 20:39:12 UTC。任务：Node24/TypeScript/pg8.23.1/Vitest4.0.18的有界conversation页读取。find-skills方法先匹配本地：`/Users/citrine/.agents/skills/find-skills/SKILL.md`、`clean-code/SKILL.md`、`codebase-design/SKILL.md`，已读，无安装/更新。clean-code沿既定sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，SHA256 3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317。

实际应用：同client、保留小batch Interface、单项复用批量投影、每条数据错误隔离且DB错误继续传播；不复制context投影/冻结规则、不新增缓存或通用框架。启动检查确认旧turnView顺序N+1、preview在PG全文hash但只传prefix，session/artifact各自LIMIT2不能变整页LIMIT2。

当前原子[回执](claim-receipt.json)已成功。依赖9入口由Lead按[请求](dependency-request.json)供给；owner不安装/复制/建link。首片非PG只允许两个显式测试路径、局部types，fresh free>=1,107,296,256B，cache/tmp/raw归本目录，NODE_DISABLE_COMPILE_CACHE=1。真实PG/HTTP/并发快照与UTF8字节测量NOT_RUN；无历史性能数字移用。

## 静态实现检查点

2026-10-06 21:33:34 UTC：已应用clean-code/codebase-design逐段复核命名、职责、接口、错误、重复与资源所有者。assistant/store保持唯一final验证路径，per-binding错误容器仅捕获原三个HttpError，未知DB/投影错误不降级；replies统一单/批读取，持久任务ID去重以避免重复turn输入放大legacy歧义；turn-read只负责装配，contextReferences无复制。未增加缓存/新调度器/迁移/外部契约，事务仍由queries拥有。源码静态确认paired unnest、current owner/session runner+harness、每task子查询LIMIT2、typed-invalid不落legacy、full UTF8 digest与UTF16边界。未知项：尚无green/strict/真实SQL执行，静态自检不宣称通过。

首红 [red.json](red.json) / [red.log](red.log)：26 selected、17 failed、9 passed，exit1/0.824651s；10455B raw完整、PGID52890 absent、TMP前后0B，同inode移除。17失败为新接口缺失和mixed50旧查询调用上界（该受控fake实数214，不是实际PG roundtrip/历史252）。首次green准入free1042001920B <1107296256B，0 child；green/strict状态均NOT_RUN_RESOURCE。依赖已由Lead供给并核9 realpaths/version/package SHA。

[run-check.py](run-check.py)只复用已审固定SVC07的supervise纯函数，在进程内将module.ROOT设成本worktree，不调用main、不修改SVC文件或导入跨树产品。显式两test路径/strict、30s总预算（27s监督+最多1s关闭）、合并raw64KiB、Node编译和Vitest缓存关闭；独立TMP只做前后有界空目录检查，非实时32MiB硬隔离，异常内容/身份保留UNKNOWN。每次own PID/PGID立即fsync，原始stdout与结果分开且不覆盖。0真实PG/provider/native。

## 稳定内部Interface（产品source已独审）

| Interface | 输入/输出与生命周期 | 查询预算 |
| --- | --- | --- |
| readAssistantFinalPreviews | 同PoolClient，≤50个task+attempt对，同序preview/null/既有typed error；单项包装保throw | 空0，否则1；正文fullhash仍在PG |
| assistantProjections | 同PoolClient，≤50持久TaskRecord，同序assistant/effective；task ID去重用于底层读取，冻结状态由caller提供 | session1 + typed1 + 仅eligible legacy1 |
| turnViews（state再导出） | 同PoolClient，≤50 TurnRow，返回同序ConversationTurn；task404不变；caller拥有RR快照 | task1 + 可选context1 + replies最多3 |

turnPage保留conversation读取+limit+1，最大7 reads加BEGIN/COMMIT=9次调用；无context/legacy时更少。单turnView、assistantProjection、sessionEvidence、readAssistantFinalPreview复用批量路径。legacy仍传完整body到JS核digest；session detail最多每task2条，未声称全部传输字节有界或消除TOAST/hash。实际并发snapshot、真实SQL正确性、HTTP和UTF8字节/roundtrip测量仍属REQ15-04，不能从fake或本静态预算推断。

## PG准备独审与质量安全点

2026-10-06 23:39:37 UTC：沿同一find-skills本地匹配（Node/TS/pg/Vitest）、固定clean-code和codebase-design复核。本次仅归档已完成独审，不改源码，不重新安装技能。fixture seed、协议观察、case/DB生命周期和进程调用方各守单一职责；观察器延后到Pool.query seed结束再装，避免callback-form不兼容；SQL结果不替换，原操作不提前释放，清理错误与原错误区分。未新造通用监督框架，复用固定旧supervisor纯函数；其宿主I/O/非实时TMP边界仍显式记录，OPS14后继未迁移。

chatui01_owner 23:38:54UTC fixture/SQL/observer/两case APPROVED/0 P1/P2；Mika/root补审封套/身份清理/失败保留/输出预算无P1/P2。固定target5ddddd6a7991243b5c42e223b11df879f0fa9498，95输入429768B，manifest SHA df2cd82a7951b030b90e02c5f84d5ef2ce8150dc72901ab8fd4d11e8fb25439e。Root核261相对import edges/4原始SQL/9deps/8driver/fixed supervisor与Git=WT一致。结论仅PG_PREPARATION_SOURCE_APPROVED；types/collect/PG/HTTP仍NOT_RUN，原26/26与strict-v2保持历史事实。准备包及6个实际输出absent状态冻结；留存claim等待窗口。

## 局部类型与收集段质量安全点

2026-10-07 02:54:01 UTC：沿本地find-skills匹配Node24/TS/pg/Vitest，应用既定clean-code/codebase-design，不安装或更新技能。固定命令注册表是唯一选择源，pg-collect只收集一个精确fixture并校验真实文件/数量，清除PG/admin/OPEN环境；复用原supervisor，不增加通用执行平台。输出独占、失败原件与进程/TMP生命周期语义保留；TMP只提供前后采样边界，wrapper时长不含解释器启动/最后持久化。没有产品改动或需要修复的本段失败。

[结构化结果](local-validation-segment.json)绑定结果target `01d798cb7f4666a738375febe7eb8bb74a1594a6`中的4原件：types exit0，collect2/exit0（非测试执行），child raw共536B；2次启动、0重跑、两own组absent/EOF且TMP独核absent。原95 PG输入及d209产品逐字不变，真实PG/HTTP/main仍未验，段末独立review待完成。不将局部类型/collect作为SQL性能、事务或UTF8传输测量证据。

## 真实PG段质量安全点

2026-10-07 03:09:02 UTC：沿已固定find-skills/clean-code/codebase-design方法，仅执行原有2例，不改产品、fixture、封套或95输入；不加第二平台/重试或OPS迁移。检查测量名与口径、同client RR所有权、paired task/attempt、per-task LIMIT2、first failure与cleanup边界，原始stdout不改行尾。两例实际通过，原raw/marker/进程与DB closure分别保留，[checks](checks.md)报告样本字段UTF8与真实8次query/ReadyForQuery，不将fake214或旧SQL252冒充基线。当前HTTP/main尚未验，PG结果独审待回传。

本段独审已由chatui01_owner于2026-10-07T03:08:27Z完成，绑定b00a181f，RESULT_FIDELITY_REVIEW_APPROVED/0 P1/P2；准确范围与未执行边界见唯一review。source未改，无需为metadata复跑任何检查。

## 主线直接消费者兼容安全点

2026-10-07 03:17:45 UTC：find-skills本地匹配Node/TS/Vitest测试依赖接口，沿固定clean-code/codebase-design只修测试替身职责：真实EventEmitter处理client listener，Pool callback/Promise双形态提供借出client。没有生产兼容补丁或重复transaction实现；main只读donor为已审完整字节，窄resolve seam与transform SHA/加载marker固定依赖。原断言全保留，单文件11/11，新raw及所有权清理有证据；旧26/strict/2PG不重复或改写。source9e6/结果ae899，当前增量独审待完成，HTTP/main仍open。

2026-10-07T03:18:33Z architecture_read对source9e6/targetae899独审SOURCE_AND_RESULT_REVIEW_APPROVED/0 P1/P2；14绑定、donor相等、11/11 raw与资源closure全符，准确范围见review。本次仅归档，不重复任何工程检查。

## HTTP准备与局部段质量安全点

2026-10-07 03:47:30 UTC：find-skills继续本地匹配Node24/TS/Vitest/pg，沿固定clean-code sickn33@bdacd76与codebase-design，无重装。原main产品组合只读snapshot是验证依赖，不另实现API；单case正文全保留，权限断言贴近同一路由。DB/port/池由fixture拥有，进程组/TMP/raw由已有supervisor调用方拥有；首失败与cleanup unknown分开，不复制监督循环或改产品迁就测试。snapshot绑定source+动态SQL，@flow本树，实际供给/检查各有单份结构化记录。当前7个actual输出absent，60s/13连接是待实际窗口预算；未把types0/collect1称HTTP通过。两local child结果/raw/资源均闭合，0重跑/0PG/HTTP/provider。wrapper未执行，本次source/结果待一次独审。

2026-10-07 03:54:30 UTC 清理边界复核：按独审P2把已知进程终态归到一个process_closed判断，成功判断与TMP回收共用；事实缺失/历史unknown保持原inode，不依最后absent掩盖未知。固定source e099，03:53:34 status_read独审关闭P2并批准准备/local结果。只改caller与manifest绑定，无新抽象或工程复跑；HTTP仍待独立窗口。
