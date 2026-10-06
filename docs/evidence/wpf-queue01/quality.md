# WPF-QUEUE01 技能与质量

2026-10-06 05:20 UTC。按find-skills方法识别React外部状态/官方assistant-ui输入生命周期/AI Elements Queue/HTTP行为验证；已有本地技能足够，无新安装。读取本地find-skills、ai-elements及references/queue.md、assistant-ui、clean-code；复用已读codebase-design、React最佳实践、webapp-testing，brainstorming收敛已授权方案而不重复审批。官方AI Elements queue与assistant-ui llms入口联网核对，本地实装react0.15.23/core0.3.22作为行为依据。

技能路径均/Users/citrine/.agents/skills/<name>/SKILL.md。固定clean-code来自sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，SHA2563c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317；assistant-ui@139674dc888ee076982b6726e8e6f5d0fe0b5f67，SHA25620bd24ab58c8d281b329e1df34655c8a6dc0cd56d8a087aff252b37025c6937c。Queue实际采用片段/固定源hash另记，不运行会改根依赖的全量CLI。

首段clean-code：将不可变命令receipt与可变GET投影分离，单次pause/cancel不能混成一个事务承诺；原key重试不绑观察generation，隐藏页只撤观察不撤已受理任务。所有副作用走既有FlowClient公共方法，不自建HTTPclient。输入seam只限主composer可选handler，遵官方form/send、IME与默认事件，不伪造runtime状态。不手写第二套业务状态源。

2026-10-06 05:34 UTC 工作段clean-code：完成commands/read projection责任分离；命令ACK仅确认receipt，最新GET才决定paused/currentTask；同queueRevision接受task动态变化。修复首次typecheck推断items递归any（显式public类型），加强ACK身份/preview/sequence校验。控制可见性与命令生命周期分开、序列化poll无重叠。加入UTF-8 CJK越界在冻结分配前拒绝、旧capfalse零请求、pause replay新task分开cancel、offline同key回归，48项通过。未知receipt跨reload未实现，保持独立F01 pending。Queue取官方固定MIT源片段并适配既有Button/Collapsible，无新增依赖，动作保持键盘/触摸可见；原源与hash见queue-source.json。下一段实际浏览器检验官方Input Enter路由、IME、窄屏，不用假runtime或queue adapter。

2026-10-06 05:40 UTC 交付clean-code：范围11源/专测已核，shared/App/oldoutbox/profile/root依赖0diff。实际browser发现并修复官方primitive额外running门禁，窄化可选submit接口，不修改SDK/加adapter；startRun:false避免client tool abort。检查command slots同步pending gate，SDK send():void和isSubmitting(附件准备)不能当HTTP锁。补隐藏迟到ACK不发GET、删除后焦点回落与窄屏footer遮挡修复，局部及实际UI复验；51模块/11dev/11prod通过、源码hash全匹配309ec0e。无进一步复杂抽象/后台定时技能任务；跨reload key恢复F01仍明确未解决。
