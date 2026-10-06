# O11 目标交付轻读：作者交付证据

2026-10-06 11:41 UTC。固定实现 `a9bde37e3b596adbf5e97c47c7efae09a4682ecd`；base `53ce2ec2c95b489aa7a2a2eaa49849821af00c16`。作者 assignment_review / gpt-6-astra，所属 FLOW-001 / Execution Lead，追溯 O01-05/M02。独立 review 尚未开始；此处是作者检查，不是批准。

新增 owner GET 读口将计划/输入身份与实时执行分开；正文按固定引用读取。无关节点活动不使计划游标或已读输入失效，相关版本变化仍由旧写事务拒绝。Module/DTO 见 [interface](interface.md)，函数体保持证明见 [preservation](preservation.json)。本分支没有改共享 export/client/server factory；测试在真实 factory 上手动注册路由，生产挂载与消费由 Lead 后继接入。无迁移、无新依赖、无 Web/MCP/模型或个人服务操作。

## 已执行检查

Node 24.20.0、pnpm 9.15.4、Vitest 4.0.18；动态端口、随机专用 PG、只清理本次数据库。共 **32 个不同检查，分两轮**，不是一次 32/32：

| 范围 | 结果 | 原始证据 |
| --- | --- | --- |
| O11 公开 HTTP/PG 7 场景 | 7/7；13.92s（测试12.925s） | [checks-final.txt](checks-final.txt) |
| 原 goals 9 + goal-context 10 + native admission 6 | 25/25；23.70s | [consumers.txt](consumers.txt) |
| 最终 TypeScript | exit 0，无输出 | [typecheck-final.txt](typecheck-final.txt)、[checks.json](checks.json) |
| 随机 DB 清理 | O11 remaining=[] / serverClosed=true；K03/O09 各自清理记录 | [O11](final-run/cleanup.json)、[consumer-resources](consumer-resources/) |

新检查覆盖：B 实时消息/人工决策不改变 A 输入与计划引用；目标/输入/decision 按需正文；有产物与无产物的机械验证状态；输入变化导致分页409及旧执行/接受拒绝；删除节点后 immutable 输入仍可读；共同依赖版本替换；知识来源过期；中心 close/recreate 后重读；自然租约过期 uncertain；owner/runner 权限与错误引用；200 节点四页无遗漏。新检查用确定性 runner 公共 HTTP 事件，不是 SDK 或新独立 runner 进程；旧 goals 9 项的独立 fixture 进程覆盖只是直接消费者回归。中心重启是同进程新实例，不是 OS 崩溃。

复跑（只影响自建 `flow_o11_*` 数据库；本地测试 PG 端口 55432）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH FLOW_O11_EVIDENCE_DIR=/tmp/flow-o11-review pnpm exec vitest run apps/server/src/goal-delivery/delivery.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsc --noEmit
```

原消费者路径：`apps/server/src/goals/goals.test.ts`、`apps/server/src/goal-context/context.test.ts`、`apps/server/src/goal-native-executions/admission.test.ts`。这些既有测试会向各自默认 evidence 路径写资源记录；本次意外生成的两个 K03 文件及 O09 cleanup 已复制到本任务 [consumer-resources](consumer-resources/)，然后仅恢复本次引起的非 scope 文件变化，当前 protected paths 与 base 相同。独立 reviewer 不必重跑 25 项；如复跑先协调该默认输出路径。

## 测量口径

[原始双节点记录](final-run/two-node-bytes.json)：两次匹配的 HTTP 刷新，旧 snapshot 合计 **9,196 B**，新 state 合计 **2,629 B**；两侧都是 2 个请求。新旧刷新均不含 input 材料，旧 snapshot 重复 originalGoal，新的 state 不含目标、输入、decision 或产物正文。固定输入只需一次读取，另有一次测试正确性复读。初始化成本分别为 input 2,092 B、originalGoal 2,537 B、首 plan 页732 B，不隐藏这些请求。该比较是未压缩 UTF-8 JSON，未测压缩传输、延迟、token、模型花费或整个 workload 吞吐。

[200 节点记录](final-run/bounds.json)：四个50节点页面6,688/6,680/6,688/6,494 B，50节点 state 10,115 B。此负载没有定义 input/执行历史，不代表最坏材料或依赖规模性能。内部读取仍遍历最多200个当前节点/输入版本元数据、最多400个 latest+accepted 执行，依赖元数据并非仅选中50节点；不把小 HTTP 输出说成按50节点 DB 成本。历史执行正文不读；现有 source-head 唯一128上限保留。

## 保留的失败与修正

- [read-red](read-red.txt)：初次公开路由404，1项真正 red。
- [read-import-failure](read-import-failure.txt)：server 直接 import 未声明 zod 导致0测试；改用已声明 contracts 校验，未新增依赖，零测试不算通过。
- [read-peer-timing-failure](read-peer-timing-failure.txt)：立即 claim 可能尚未有队列唤醒；测试 peer 改为有限轮询，未改调度器。
- [checks-first-complete](checks-first-complete.txt)：6项中一项 fixture remove-node 请求错用 expectedVersion；修正为既有 schema 的 expectedNodeVersion，旧过期拒绝断言保留。
- [typecheck-first](typecheck-first.txt)：测试类型/可选查询参数错误；显式类型及 null guard 修正。之前通过轮次及原始 JSON 也保留，不重复计数。

## 边界与交接

计划 ref 只代表图/节点/输入版本身份；task activity、decision、accepted artifact、knowledge head 变化由 state 体现，不全部使 plan 过期。`execution.inputCurrent` 沿旧有效性算法同时核 input、knowledge 和精确依赖绑定，不等 task 已结束或已验证。候选 artifact 不等交付已被接收，unknown/uncertain 不变绿；语义接收仍是 owner 旧命令事实。RR 只在单请求一致，跨页相关计划变化409，不是持久分页快照。历史正文虽然不可变，currentVersion/stale 是当前时刻结果。

没有新后台生命周期或取消工作；请求中断沿现有数据库读事务行为，无专用 SQL abort。生产共享挂载/client、Web/MCP 展示尚未验证；不以本片段关闭 FLOW-001 全部验收。架构新增 read 模块、共享纯有效性类型边界由 Lead 在固定 target 后登记看板。

交付时 actual4320 只读聚合 O11 为 live、3/4、checks passed、review not_started、issues=[]，详见 [dashboard](dashboard.json)。该观察发生于 metadata 未提交时，因此 raw git.dirty=true 如实保留；不是源码未固定或 review通过。
