# 自托管服务生命周期后继输入

所属唯一计划：FLOW-001-T04-LIFECYCLE-01；本记录仅只读设计依据。固定输入 b178d17a6e711d4f4c28ee0e33f001171ed42652，2026-10-06 23:47 UTC；reviewer native_center_owner / gpt-6-astra。没有新probe、私密配置读取、服务操作或测试。

| 现模块 | 已核职责 | 后继边界 |
| --- | --- | --- |
| compose.yaml | 单PG、固定image/volume/loopback/healthcheck，无restart | 容器只由一个管理层监督；不能监督OrbStack宿主 |
| process.mjs / runService | detached+unref、预登记nonce/PID；一次child及有限exit记录 | 先明确前台可监督入口与单role身份，不能直接KeepAlive现私有入口 |
| startPreviewServices | 整套启动 | 单role恢复不能覆盖仍在跑的runner/Web |
| OPS14 | 有界test/operator监督 | 不停止detached用户服务，不承担常驻监督 |
| SVC06 | 固定source/deps/runtime描述与校验 | 不冒称启用常驻监督或已完成个人接入 |

候选小Interface为observeRole/reconcileStoppedRole：安装identity handle、role、fixed backend descriptor、显式有界restart policy作为输入；返回owned running/stopped/unknown，primary failure与cleanup unknown分栏。复用withPreviewLock/assertMarker/backendRuntime/spawnOwnedProcess/ownsListener。只有exact-owned且已证stopped可受控登记并替换；unknown、EPERM、旧组仍在或持久写入失败停止。平台只监督一个正确前台host入口，不另建任务调度权威。实际API由后继设计确定，本轮没有正式产品DTO。

DB/runner身份、lease/fence、admission journal/outbox、maintenance仍原模块持有；退出不证明外部副作用settled，不改token、不清uncertain、不重claim或自动resume。恢复旧合法队列可能继续原工作，自动策略必须明确启用。每次重启不增加模型健康探针。有限安全日志不采用户正文或秘密。

受影响局部验收：controlled crash、依赖暂失、明确stop保持停止、同持久数据与原身份恢复、没有第二进程、次数/退避到限停止；关Web与logout分别说明。先自有0模型环境，真实机器策略及切换另受控交付。23:32退出原因仍unknown。

技能方法：沿现有find-skills/codebase-design/clean-code，按真实生命周期所有权提取单role接缝，不合并DB清理、业务状态机与平台监督。官方来源见父plan；Docker on-failure不覆盖daemon重启，Apple受监督进程不得自行daemonize。
