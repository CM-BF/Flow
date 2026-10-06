# 验证来源与选择数

所有stdout为实际进程重定向；*.json记录真实退出码。Node24.20.0/pnpm9.15.4/Vitest4.0.18。新DB随机名、端口0、finally正常cleanup写入*-resources.json。初始历史运行使用当时未提交候选，最终manifest固定当前源码与对应行为用例；不把历史16项重复计入。

| 组 | 实际结果 | 限制/修复 |
| --- | --- | --- |
| contract-pg-load-failure | exit1，0tests加载失败 | client包非server直接依赖，修为同WT相对源码输入；beforeAll未运行 |
| contract-pg-first | 9pass/1fail | 旧attempt测试fixture违反既有唯一约束；产品未改 |
| contract-pg-selected | 1pass/9未选 | 修fixture标记旧attempt结束后定向重跑 |
| contract-typecheck-first | exit2 | 同client导入错误及派生类型错误 |
| contract-typecheck | exit0 | E0实际类型检查 |
| e1-module-first | 16pass | 早期候选；后续snapshot稳定/unknown/资源有界修正后以18项为准，不叠加计数 |
| e1-modules-consumers | 65pass | 18工程+33runner+2contracts+12随机PG reconciliation |
| e1-pg-first | 1pass/2fail | unknown通过；成功/失败均已入库但测试错误读取reference.kind，改为公开detail.kind；产品未改 |
| e1-pg-selected | 1pass/1fail/1未选 | failed通过；新加丢ack时错误期待继续succeeded，与既有host lost不符；改为独立保留/replay断言，未改host规则 |
| e1-pg-success-replay | 2pass/2未选 | 成功真实修复读回；丢ack只重放artifact且pending/journal保留、不重做 |
| e1-pg-misdirected | 1pass/4未选 | 误指普通fixture实际claim但无工程verification/最终uncertain；同用例验证旧text成功 |
| e1-typecheck-first | exit2 | 两处测试reference.kind错误 |
| e1-typecheck | exit0 | 最终当前源root类型检查 |

E1合计70不同检查；E0合计10，总80。早期/tmp/flow-eng01a-e1-types-first.stdout还曾显示HarnessContext无attempt的候选诊断；其shell最后cat退出0并非tsc成功证据，已改为配置runnerId注入，未把该临时检查计为通过。保留该实际文本为e1-prototype-types.stdout。

不为metadata重跑已绿组；首E1 PG失败/成功原输出与资源回执都保留。丢ack及unknown是明确注入故障，真实worktree写改/Node checker/HTTP/PG均实际执行；不称实际原生provider conformance。
