# WPF-QUEUE01 技能与质量

2026-10-06 05:20 UTC。按find-skills方法识别React外部状态/官方assistant-ui输入生命周期/AI Elements Queue/HTTP行为验证；已有本地技能足够，无新安装。读取本地find-skills、ai-elements及references/queue.md、assistant-ui、clean-code；复用已读codebase-design、React最佳实践、webapp-testing，brainstorming收敛已授权方案而不重复审批。官方AI Elements queue与assistant-ui llms入口联网核对，本地实装react0.15.23/core0.3.22作为行为依据。

技能路径均/Users/citrine/.agents/skills/<name>/SKILL.md。固定clean-code来自sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，SHA2563c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317；assistant-ui@139674dc888ee076982b6726e8e6f5d0fe0b5f67，SHA25620bd24ab58c8d281b329e1df34655c8a6dc0cd56d8a087aff252b37025c6937c。Queue实际采用片段/固定源hash另记，不运行会改根依赖的全量CLI。

首段clean-code：将不可变命令receipt与可变GET投影分离，单次pause/cancel不能混成一个事务承诺；原key重试不绑观察generation，隐藏页只撤观察不撤已受理任务。所有副作用走既有FlowClient公共方法，不自建HTTPclient。输入seam只限主composer可选handler，遵官方form/send、IME与默认事件，不伪造runtime状态。不手写第二套业务状态源。
