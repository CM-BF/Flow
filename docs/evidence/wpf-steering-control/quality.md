# Skills and clean-code

2026-10-06 08:46:54 UTC：按find-skills方法发现React/typed公共port/异步回执/测试域，优先已装本地技能并实际读取，无安装。
- /Users/citrine/.agents/skills/find-skills/SKILL.md SHA256 `c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f`
- /Users/citrine/.agents/skills/codebase-design/SKILL.md SHA256 `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2`
- /Users/citrine/.agents/skills/clean-code/SKILL.md SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`
- /Users/citrine/.agents/skills/assistant-ui/SKILL.md SHA256 `20bd24ab58c8d281b329e1df34655c8a6dc0cd56d8a087aff252b37025c6937c`
- /Users/citrine/.agents/skills/webapp-testing/SKILL.md SHA256 `51b7349e77ec63b7744a6f63647e7566a0b4d2e301121cc10e8c2113af6556a2`

应用：codebase-design把状态校验/冻结/页刷新封在小control Interface；clean-code按每段命名/职责/错误/重复/复杂度复核；UI只render/trigger，公共FlowClient为HTTPfixture与未来host共同接缝。clean-code固定安装sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不重新安装。SDK按现有锁，无默认steer adapter/新harness类型。读取新树AGENTS/plans规则/D04说明，先live字段核身份8scope再写。

启动发现：TaskSummary没有attempt，admission没有nativeSessionId，不能伪造预绑定；server owner/profile检查早于saved ACK replay，unknown重试4xx不能洗白；state.revision不包含receipt变化，refresh不能只读tail。上述纳入实际回归。

首实现段：control集中校验/有界缓存/回执与读门禁，UI独立draft只render/trigger；timeout包装先查abort再调用reader并消费迟到拒绝。首类型检查出现TS cursor推导问题，补number标注；首27断言通过但测试在port尚未被调用时拒绝外部deferred导致unhandled，已加确认调用后再dispose的精确前提，未删断言。原first-direct/first-typecheck保留。未来消费者不得把request gate当全局权限或model compliance。

HTTP段：Chrome在fixture直接destroy响应时透明重试相同POST并获得原ACK，所以首browser未知态断言失败；改为中心已保存后返回明确503的可重复丢ACK场景，不把这个脚本假设误称产品丢幂等。首图/log保留。新增4历史attempt预算测试先误计已读的额外初始attempt，修正初态后30项通过；未降低上限。清码发现loadMore不应把失败admission读的stale状态清空，已保留stale并加直接行为断言。

最终清码发现并先红后绿验证两处真实边界：POST完成早于同时手动读取的旧metadata时，旧Map会丢掉新ACK命令；ACK新增命令的session未与同attempt已知metadata核对。统一小mergeCommand校验并在批次发布前合并当前权威引用；保持receiptRevision单调、跨页原子校验。interleaving-red.log为2真实产品失败+31通过，不混入早期夹具失败。

2026-10-06 09:00:20 UTC 交付clean-code：逐读control/UI/HTTPfixture，合并ACK与分页共有的身份和receiptRevision规则，避免两套校验；controller负责事实/生命周期，UI只render和trigger，未扩通用框架。33 direct与dev8/prod8和Web tsc全部通过；目视production light1280/dark390。实现target `b2cbbca5f823e122ec4e234e16fb7ef45a063af9`，后续只metadata。详细失败归因与未完成App/跨reload边界见validation/README，不把局部成功当大task Done。
