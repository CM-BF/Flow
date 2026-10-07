# OPS-001-14：最小自有进程监督接口候选

2026-10-06 20:32 UTC，Execution Lead 采纳 native_center_owner 的有界只读比较；未领取产品范围、未实施/测试。当前发布和 F04 固定候选先收口。统一引用[模块化规则](../../AGENTS.md#modular-design)，沿本地 find-skills/codebase-design/clean-code，不新增监督平台。

首两个真实消费者选择 SVC05H 的 Python 外层 operator 和 SVC07 的 Python 执行封套：它们共享启动、有限pipe捕获、期限、停止与错误收束。O16 是进程内动态登记最多三个组的 IPC guard，当前不强行并入同一协议；其已审watchdog仍保留，F04继续直接复用。

| Interface | 明确边界 |
| --- | --- |
| Launch | 固定 argv/cwd/显式 env，只监督模块自己spawn且保留句柄的child；不接受任意外部PID |
| Ownership | childPidOnly 用于个人服务operator，不信号任何detached中心/runner/Web；newChildSession 仅可指模块自己创建的新session |
| Policy | 工作期限、停止宽限、输出上限；独立guard的停止决定不依赖operator或报告写盘完成 |
| Report | spawn身份、最早失败的phase/code/type/安全有界message、exit、观察/保留bytes及EOF、signals、ownedState absent/present/unknown、独立secondaryFailures |

深模块负责有限输出、TERM后有依据的KILL、reap/组观察与失败合并。EPERM/无法观察为unknown，不推定停止、不盲目升级信号，不让finally覆盖最早工作错误。caller先持久reservation，模块返回有界事实供caller保存；不得插入阻塞停止决定的同步日志/fsync回调。complete不能取消仍活着operator的总期限；unknown保留资源且不自动重跑。DB删除、连接观察、资源所有权和源码绑定仍由各自模块负责。

候选新源为 tools/owned-process-supervision/supervise.py、supervise.test.py、README.md；直接消费者候选是 SVC05H center-recovery/supervise.py及其专测、SVC07 execute-pg-once.py及其专测。这里只列候选，真实take前由两lead核双方当前literal claim、固定输入和停写/移交，不改正在使用的已审wrapper。新增子片仍挂OPS-001，自己的plan/evidence由实施owner领取。

局部验收先覆盖两实际caller的原有行为：SVC05H 118+2秒仅operator PID且detached服务存活；SVC07原有限期限和64KiB合并输出。故障例覆盖证据写入挂起、输出溢出、leader先退出而子组仍存活、EPERM及secondary failure；0PG/provider，不重跑个人恢复或既有产品全集。没有实际复用证据前不宣布抽象完成/更快。
