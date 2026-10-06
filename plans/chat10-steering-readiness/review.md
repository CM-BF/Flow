# CHAT10 独立 Review

| 字段 | 记录 |
| --- | --- |
| Review | NOT_STARTED |
| Review target commit | a3296e0f6ffc37c746cf1d59a7105aeb2131579b |
| Base | 32c371d389a913f8dd71c3bd8b98dd0697411256 |
| Reviewer | 待 Execution Lead 唯一只读审查 |
| Scope | packages/contracts/src/active-steering.ts, apps/server/src/active-steering, apps/server/src/active-steering-configuration.ts, apps/server/src/active-steering-configuration.test.ts |

请核实际 HEAD/dirty、[manifest](../../docs/evidence/chat10/manifest.json) 的固定 blob 与 raw hash。8 个变化 source；读取完整 readiness/新命令 policy/parser，与现有 owner auth、runner→task→attempt、profile-before-replay、final seal 事务链对照。核 GET 默认 off/缺024不触缺表、只读不创建记录、未知 profile/过期 fence 拒绝、读后竞争 POST 重验、pending 自己不阻断同 key receipt。检查旧 attemptAvailable 未变，main/index 无越权写。

作者检查是 46 + 新增 2 = 48 distinct，types exit 0；原始命令和失败保留于 [checks](../../docs/evidence/chat10/checks.json)。默认独立审查不重跑；若需复现只运行相关随机专库局部例。原 fixture SHA256 输入修正不减少断言。

尚无独立结论；此模板不表示 approval。不含 F01 thin main/client mount、真实 provider/native、模型遵从、UI/cap 启用或个人服务部署。
