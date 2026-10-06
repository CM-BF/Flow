# ATTACH01 skills and clean-code

2026-10-06 10:08:41 UTC：实读本树AGENTS/plans及固定f181合同/context/runner边界；find-skills先本地匹配，无安装。

- /Users/citrine/.agents/skills/find-skills/SKILL.md SHA256 `c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f`
- /Users/citrine/.agents/skills/codebase-design/SKILL.md SHA256 `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2`
- /Users/citrine/.agents/skills/clean-code/SKILL.md SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`
- /Users/citrine/.agents/skills/brainstorming/SKILL.md SHA256 `74edf03ea6d24ef53db48677b93558d14a979bdf052ca3f57ecdca0c66791608`

clean-code固定来源sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。应用：合同模块只做类型/纯校验，不混HTTP/PG授权；context保持旧分支严格兼容；不造第二上传/runner权限authority。接口说明明确状态/生命周期/错误/资源上限；root已冻结设计替代重复用户审批。约30分钟安全点与每段/交付复核命名、单一职责、重复、错误处理及意义测试。


2026-10-06 10:20:46 UTC 定段/phase1交付clean-code：三文件按resource DTO/纯context receipt验证/行为测试分责；不把权限/HTTP/PG混入contracts，不抽通用上传框架。命名区分reference/descriptor/metadata、saved ready receipt/current observation。先检查严格UTF8与有界长度再编码，不trim/BOM丢失；digest真实核验与shape区分，调用方仍负责abort后授权核验。root指出HTTP header Unicode/trim风险，改visible ASCII无空白key并实际Headers roundtrip回归。

旧v1 selection/guard算法未改；保留合法空v1sources兼容现consumer，v2必须非空attachments且完整顺序匹配。合计4/8192跨两类，source current-version metadata一致，duplicate/ref/body泄漏失败关闭。新helper只处理v2，不复制旧UI helper，消费方外层身份仍是权威。错误不会把历史unknown解释未受理。真实旧projection/queue模块test可复用无需放松产品门禁；两次fixture构造错误如实记录，已45/45+types0。

未解决项是已分段后继：runtime/admission/retention/PGHTTP；全局journal无GC；浏览器upload恢复实现、Send/Queue跨reload未知receipt不在本phase。当前原始response/body和授权并未实接，公共types不能冒称端到端完成。兼容按root最窄裁决，无新header或GET阻断。

2026-10-06 10:22:19 UTC 共享ACK对齐复核：按root正式接口要求，producer strict与consumer known-field projection分离；用Zod safeExtend/strip保留原source/locator refinement，两个版本共用validateContextReferences，不复制整份ACK规则。future字段逐层剥离与已知字段错误两组实际回归通过；最终39+8=47、根typecheck0。保持原45/40/首轮证据各自源码，不回填执行target。固定实现311a932f6bef0efe81367569da00c13bf3bf6ac8后只metadata收口，源码冻结待root快审。

2026-10-06 10:25:00 UTC 最后接口复核：TUI只持有序列化frozenAdmission，因此公共v2 helper必选输入改为完整ordered refs；已核upload descriptor只作可选额外期望，避免从ref捏造name/bytes。完整accepted.resource结构合法作为descriptor，通过投影四字段兼容其状态/时间附字段；保持完整ref/名称/bytes核验。新增实际结构性consumer回归，最终41+8=49与根types0；正式target 6bc2918cf35a652e241e6378c3b6297cac179adb。producer/consumer共用结构，无新网络/协议/权限状态。原wire48项与additive47项证据各自保留，最终report在resource-checks.json。

2026-10-06 10:27:21 UTC phase1独审交付安全点：root 10:26 UTC完整合同/测试/Interface clean-code review APPROVED，无blocking；独立49/49，source/dependency hashes核实。本人本段只记录结论和原log，未再改已审三源、未重测。下一后端stack仍复用本地find-skills/codebase-design/clean-code；本地无独立PostgreSQL技能，采用现仓库transaction/command/fixed-material模块工程方法，runtime先精确claim再写。

2026-10-06 10:29:57 UTC runtime开始：Node24/TypeScript/Fastify5/pg8/PostgreSQL栈用既有本地codebase-design/clean-code；本地find无专门PG skill，未安装无关技能。复用commandInTransaction与owner hook、project row锁、context private claim，不新建权限状态。原资源状态由DB产生；lazy内容与metadata查询分开；cap查询基于migration/project，旧DB v1查询保兼容。当前runtime NOT_STARTED检查，不复用phase1批准。

2026-10-06 10:39 UTC runtime定段clean-code：storage负责固定资源/锁/幂等，index只挂现owner认证下的窄路由与迁移；context复用既有执行编排而不增runner权限。清码发现JSON对象canonical键序会让attachments先于sources，已改明确两段编排并用实际prompt顺序断言。锁后clock_timestamp、24 hours与retained仅审计策略已统一。首types/resource套件发现server无直接zod依赖，复用已有contract UUID/version schema消除非法包依赖；不是安装新依赖。首context报告19失败中首项是作者knowledge请求漏expectedVersion，后18项因该首setup未安装026级联；修fixture后19通过，不称19产品缺陷。当前7资源+19context真实PGHTTP通过，最终检查尚待后续边界。

Root授权phase1测试单点随runtime转换：原old strict center拒[]断言依赖当时旧schema，正式49/6bc证据永久保留；新schema现在接收optional attachments，其当前测试改验证omitted不注入、[]合法，真实旧Web GET/ACK矩阵仍运行，不把新schema伪称旧center。attachments.ts/conversation-context.ts保持6bc字节。

10:42 UTC运行边界复核：resource/core第一次组合76断言虽通过但有一个unhandled pg错误，整轮不算绿；来自测试直接terminate服务器连接，暴露既有pool异常退出语义。改用cancel_backend专测事务取消，再加独占子中心SIGKILL/restart真实进程崩溃用例，不屏蔽错误、不动共享database.ts。下一轮77/77且无unhandled、3个独占DB均清零。Root要求独审不污染作者证据，fixture新增可选FLOW_ATTACH_EVIDENCE_DIR仅测试输出接缝；逐步cleanup即使单步失败仍观察残留、不得静默清理失败。最终候选后此接缝与实际cleanup并入hash。

2026-10-06 10:46:51 UTC runtime交付clean-code：固定8701a6cf547248e70aa5758f05da1d7d314ae9c0，14文件运行增量、全feature16源；合同实现2文件字节保持phase1。职责仍resource storage/route/migration/context glue，复用owner auth/command journal/private claim，无第二权限或任务权威。清码追加JSON传输fatal decode只封装附件路由，64KiB body与合法U+FFFD/非法UTF8实测；Fastify类型含string分支，显式Buffer收窄而非as断言。最后78/78、根types0，3DB无残留；before/after/sourcecandidate hash全等。

保留原始失败与数据：26早轮通过、76+unhandled非整轮通过、77通过、78-first直接过但types2，最终78/types0。未反复全库；四显式路径覆盖本module+既有收据直接消费者，runner generic adapter没有provider调用。当前metadata收口与parser/link核，源码冻结待独审；F01实际mount/client、App附件输入/持久恢复仍后继，不冒称已上线。

2026-10-06 10:50:41 UTC runtime独审交付clean-code安全点：root10:49:15UTC独立APPROVED8701，全读14运行增量与冻结合同；独立78/78、3DB清零、16源/19只读依赖/两phase1字节核实。职责/锁序/rollback/metadata界限/UTF8/锁后expiry/原key重放/runner prompt无blocking。本人本段只归档原独审日志和准确状态；未改产品、未重复测试/启动服务。phase1与作者最终执行记录不改；公共接线、Web上传、provider仍明确后继。局部文档检查只核链接、parser、TODO和目标一致，源码保持固定。

2026-10-06T11:21:02.251672+00:00 factory兼容定段/交付clean-code：本地find-skills/codebase-design/clean-code沿固定来源实读复用，无安装。两个已有测试文件内复用原迁移/领域函数与生产factory，不复制认证/新增public测试能力开关；旧schema显式前向构造，安装前后入口如实区分。六route检查在async plugin排空后执行，部分注册失败，不把单route当整套。预升级独立DB避免test顺序依赖，所有owned清理错误继续记录。实际6选中case通过/23未选，严格types0，4DB清零；无新产品源变更，旧8701/78证据不改。后续自动factory分支缺实际输入，明确pending，不拿fallback结果当上线。实现target 1f0c1966e3cbfef166c58c4aebb7f1aece8c1da9，原执行1d236+dirty哈希绑定。
