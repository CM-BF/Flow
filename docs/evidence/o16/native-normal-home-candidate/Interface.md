# O16 planner 的正常账户 HOME 候选

仅修改原实验 `native-environment.mjs` 的内聚策略；operator、driver、phase-host、worker、query decorator 继续消费同一 export。工厂默认 private 与旧 digest 保持；实际 planner export 显式选择固定 `normal-account`，不接受 JSON 路径、账户或认证布尔作为授权。新 recipe 含固定 HOME 选择及共享写边界，其 digest 与旧411不同，旧许可及 binding 因现有检查拒绝。不是生产认证或服务改动。

| 接口 | 不变量 | 所有者/失败 |
| --- | --- | --- |
| createNativeEnvironmentPolicy | runtime3固定；可信代码只选 private/normal-account | 默认private兼容；normal只接受当前citrine，不能传任意HOME |
| prepare/verify | 原private home/config/tmp/dev/ino/mode和native文件hash全保留 | 未使用的private home也保留身份核验；不探测正常HOME正文 |
| environment/queryInput | 与private映射只差 HOME；CONFIG/TMP/secure override/USER/cwd保持 | 所有外加env被替换；persistSession:false、禁止resume/continue/sessionStore/forkSession不变 |
| permit/query decorator | 新source+environment摘要必须对应新明确许可，原一次slot保持 | auth状态不能开query；取消/首失败/unknown不fallback、不自动重投 |

直接消费者为原 Claude adapter→createObservedQuery→policy.queryInput，测试在真正 nativeQuery 调用点注入拒绝，不运行SDK/native/auth/PG。新检查还核旧digest、HOME唯一差值、其他选项和工具/caps保持、旧permit/账户/恢复拒绝、当前固定sourceIdentity。复用已有环境fixture，仅增加可选可信policy参数，不新造测试宿主或诊断框架。

正常账户 HOME 可以触发已授权的原生辅助锁、文件fallback及Keychain正常认证刷新；这些共享写入不在private8MiB承诺内。CONFIG/TMP/material/workdir、无会话持久化和原受限工具仍私有。A/B结果仅支持本次公开状态可见性不同；不能证明R3根因、订阅模型资格或未来query成功。

下一实际候选拟1次planner、claude-sonnet-5-5、maxTurns4、SDK maxBudgetUsd0.20、query90s/work120s+cleanup30s/outer150s，1proposal/0apply/0child/最多2node1edge。SDK USD是请求/报告口径，不是订阅账单保证；公开Pro不表示成本0。当前累计SDK3，第四次 **NOT_GRANTED**；不生成真实permit/reservation，也不重用任何旧namespace。只有将来GO单独模型预算及fresh窗口才可进入该候选。

资源与接受条件沿原planner：private8MiB、raw2MiB（诊断8192B/正文4096B包含其中）、DB规划128MiB，own连接8+3+1、管理余量16、live1GiB；正式floor必须用当时完整账本单项合计，不沿用已消费历史combined常量。需一条实际SDK entry/有界成功result、唯一审计propose及0apply/child、匹配原goal/material/profile/tools、实际清理与15分钟pause；任何缺项仍UNKNOWN/KEEP，不降成功断言。

采用既有 find-skills/codebase-design/clean-code 方法：职责在单环境Module，授权在原permit模块；无多处HOME判断/新调度器，直接消费者检查，不重跑历史13/8或完整PG。
