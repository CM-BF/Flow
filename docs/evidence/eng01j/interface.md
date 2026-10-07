# ENG01J Interface v1 — 实际 Darwin 受限启动层

本片新增真实 OS 启动层并直接消费现 R06 transport；固定基线 ee98e65c，原七 literal claim。没有修改 G/I、runtime、contracts 或 C02 pump。下表是本片实际接口，原首合同的完整 authority 接线仍属后继。

| Module | 输入 / 输出 | 状态、错误与依赖 |
| --- | --- | --- |
| createDarwinWriteProfile | host 固定的真实 root、executable、唯一既有 calculator.mjs → default-deny 策略文本 | 纯函数；拒绝非规范路径和 executable/write alias；不能凭该文本称模型合格 |
| prepareDarwinWriterHost | 受信 host 的私有目录、可执行文件 SHA256、最多 8 个有界参数 → policySha256、createTransport、close | 校真实路径/owner/mode/inode；只在此 host 实例允许一次 launch；实际 R06 拥有 stdio 与 child；无任意 stdio/env/外部 PID 参数 |
| createTransport | 原 CodexTransportFactory 的 signal / workingDirectory → 原 R06 transport | spawn 前再次核固定身份；取消或失败不另发 launch；初始化、backpressure、close 和子进程观察完全复用 R06 |
| close | 无参数 → policySha256、child 事实、writeAccess: unknown | 同一实际 transport handle；close 后永久禁止 launch；confirmed-exited 只表直属进程退出，不生成 G 的 revoked / locked-no-fallback grant |

Darwin profile 允许固定可执行文件、必要系统动态加载只读、workspace 只读及唯一既有文件 data 写。拒绝 fork、其它可执行文件、网络/Mach lookup 及新建/删除/链接/重命名。固定可执行文件的再次 exec 不产生额外进程。本次 tiny C 验证了列出的有限操作；没有证明任意 IPC、原生插件或全部 native 工具覆盖。

实测的决定性限制：只施加 profile 时，预先打开的 regular FD 可以继续越界写入。因此策略、固定 FD 集合及实际 launch handle 必须共同成立。round-03 的 Node host 先实际写同一 inherited FD；真实 R06 spawn 后 C 访问该编号得到 EBADF，不能把 Python close_fds 当成 R06 证据。R06 固定三条 stdio pipe，未增加传输循环或监督器。

输入归属假定是可信 host 私有目录、二进制及参数。当前 stat→exec 使用路径，不能抵御同 uid 的不受信并发宿主改写；不声称 inode 原子执行。二进制有界 hash 读取上限 512MiB、每次 64KiB；策略不限制目标文件增长，文件系统 quota/最终生产资源强制仍未实现。R06 帧/累计输入输出分别 16/32KiB，初始化 2s、TERM/KILL 200/300ms。

模型身份/no-fallback、实际 Codex binary 的可运行性和 provider 网络尚未验证。当前网络全部拒绝，所以不能直接作为在线 Codex 生产配置。本片提供可运行的实际 OS 机制与真实 transport seam；后继必须将受支持操作和模型来源证据闭合后才实现 G 的 grant/完整停止。无产品 profile 注册，也未消费真实 provider。ENG 完整模型写改与独立接受仍开放。

扩展一个合格生产 host 时，应复用此实际启动层与 G/I 编排，补明确受限 provider 网络/实际二进制和完整 writer 集合证据；不能再加一个只注入 qualified JSON 的包装层。改变 policy 或实际 binary 必须重新覆盖其受影响操作。没有第二 FSM、DB 清理器或 transport。

本轮预算累计 30s / raw+私有资源 2MiB；复用固定 OPS14 newChildSession。实际五轮累计 3569ms、stdout/stderr 5126B；最大结束时私有目录测量 139373B，不冒连续峰值或硬磁盘 quota。每轮先持久结果再按 exact dev/ino + 最终组 absent + 双 EOF 清理，仅自有 scratch。历史 pre-reap EPERM observations 保留，最终 absent 才是当前观察；不把该组事实等同所有写入者撤销。监督器进程期限不等于后续 fsync 的硬实时期限。

技能应用沿本地 find-skills / codebase-design / clean-code / brainstorming；路径 /Users/citrine/.agents/skills/<name>/SKILL.md。本任务已获设计授权，小 Interface、状态唯一所有者、直接真实消费者、错误与原失败保留。没有重复安装技能或引入依赖框架。
