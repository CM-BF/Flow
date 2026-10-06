# CHAT10 补充指令的可信开关与受理状态

状态：in-progress。Owner runner_owner / gpt-6-astra，2026-10-06 08:20:02 UTC。基线32c371d389a913f8dd71c3bd8b98dd0697411256；GO已批准有界设计及PG/HTTP seam。

目标：产品可只读判断当前task/attempt能否接新steering命令；可信server配置默认关闭、非法值failclosed。既有attemptAvailable语义保持；GET不建control/command，不拿写锁，不将ready当预留。POST仍现锁内重验，成功幂等replay不被自己的pending阻断。

只读新GET /api/tasks/:id/steering/admission，attemptId可选。off或024未安装安全返回unavailable，不查询缺表；身份、lease/revoke/decision/session、已知profile、final/seal/pending/unknown与command限额均须满足才ready。复用CHAT09 profile校验与现控制policy，不加cap引擎或migration。cap/UI/个人identity不动，0provider。

| TODO ID | 交付与验收 | Owner | 依赖 |
| --- | --- | --- | --- |
| CHAT10-01 | claim、固定DTO与可信配置Interface | runner_owner | CHAT09 main |
| CHAT10-02 | config parser与只读GET完整reason | runner_owner | 01 |
| CHAT10-03 | 同policy下POST竞争/重放，随机PG/HTTP验证 | runner_owner | 02 |
| CHAT10-04 | fixed证据、独审、F01薄接线/main | runner_owner / Lead | 03 |

6literal由claim定义。F01独占server main/index/client/export；本模块提供parseActiveSteeringConfiguration，默认undefined/'0'=false、'1'=true，其它拒绝且不输出值。生产CLI只由共享owner薄接线。技能沿find-skills本地codebase-design/clean-code/tdd/brainstorming实际应用；批准方案不重复设计审批，质量记录见证据。
