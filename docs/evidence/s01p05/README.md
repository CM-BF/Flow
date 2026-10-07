# S01P05：一次保存事件任务状态

同一已受锁保护的事件事务原先对同一个task连续UPDATE三次。本片在原persistEventState内改为一次固定列UPDATE；attempt序号和event时间仍先写，公共签名、调用者、错误、fence和事务不变。没有池/锁/schema/缓存改动，未测延迟或吞吐。

输入已审main `3609d8dabd3713e37d877af4f96d2daa2bd96e57`，受控integration `f0ebd514a2d10ad04a88782eaa99a86865fcfc90`。初始aeb十项影响输入逐字未变。F01 v33停写移除后，本owner v2合法追加events.ts及event-state.test.ts；receipt在本目录。旧仅metadata/阻塞段保留历史，不代表当前仍阻塞。

## 实际证据

- 红测固定 `7b25946261f8092d2847493bbc63ba4d2e19281c`：1selected failed / 8未选，真实专库audit观察task写3次，期望1；该失败不是fixture问题。
- 最小生产变更后完整新文件9/9通过（10功能tasks），Node24.20.0 / Vitest4.0.18 / PG160013；局部strict noEmit0。red与green不是累计10个不同通过；实际不同green只有9。
- 两次随机专库分别1与10tasks，均app/自有pool/admin关闭，先核0连接、普通DROP后确认absent；无FORCE/kill、无保留资源、无凭据输出。严格类型检查最初三次依赖图错误原样留存，最终只补本验证config的既有固定依赖解析，未修改根strict基线或安装依赖。

9项对应[原7类矩阵](validation-matrix.md)：完整状态/ACK及attempt先写；usage null/unknown与新旧artifact版本；终态过期纯重放0写与updated_at不变；混合重放与冲突/缺序/乱序回滚；普通批task写拒绝及后置verification错误的全部副作用回滚；finalize成功/完成后重放；finalize verifier或task写故障回滚seal/artifact/final/receipt；stale/current/uncertain/expired拒绝；018/021非空绑定和实际UPDATE OF guards保护。

真实调用reportEvents/finalizeSteering，数据库触发器只用于私有fixture计数/故障，生产无测试hook。公开函数入口不等于HTTP认证覆盖；没有启动HTTP监听、真实SDK/provider或容量负载。Claude final输入为符合固定合同的合成source/session证据，不表示运行模型。snapshot逐表精确比对包含task/attempt timestamps、timeline/detail/artifact/usage/decision/session/final/steering/receipt，无孤儿副作用。

A/B是单独尚未开放的候选，总256task/attempt、300s/512MiB；当前0容量调用。共同observer c259、固定两版除P05生产delta外一致以及顺序/观测开销要求继续有效；不能由SQL少两次直接推性能/SLO结论。
