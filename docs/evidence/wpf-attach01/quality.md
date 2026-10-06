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
