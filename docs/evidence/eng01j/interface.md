# ENG01J Interface v1 — 关键机制先验

父授权沿ENG01I authority-candidate；固定main ee98e65c，独立claim七literal。当前不改native-writer/adapter/runtime/contracts/C02。

先实现纯Darwin策略描述器：可信host给出真实独占scratch内的固定可执行文件和唯一既有calculator文件，生成default-deny profile。只允许初始固定exec、必需系统只读加载及该文件data写；拒绝fork、其他exec、网络、Mach/Unix委托和目录/其他文件改动。路径归属和完整policy覆盖须实际验收，不凭字符串称合格。该策略描述器不是NativeWriteAuthority grant。

第一段tiny C使用自己的loopback/Unix socket与文件；不读个人目录、外部服务或凭据。测试允许目标写/越界文件/新文件/删除rename/symlink/hardlink/fork/其它exec/自有Unix委托，另测host预开FD。父runner持有生成binary/文件真实身份，默认关闭额外FD；故意继承FD仅用于验证机制缺口，不把它注入生产R06。R06只接stdio pipes、不接外部PID或任意argv/environment。

只有限制写入主体集合与所有实际通道经证明，R06持有child的确认退出才可合并为revoked；EOF/group/取消/turn final单独不够。若初步syscall否定关键机制，先固定失败/具体替代，不写空壳authority。若成立再把真实Darwin层接现G.open/close，不复制loop或journal。实际模型来源/no-fallback门禁独立：缺可信证据不能授native生产grant，OS测试仍可直接推进。

一次普通本队local段累计≤30s（编译/所选syscall/必要修复合计），raw+私有≤2MiB；复用OPS14 newChildSession监督，无PG/Chrome/provider。独占scratch父dev/ino和固定源先记，确认自己的组消失且结果耐久后仅清理自己的scratch。unknown保留，原轮次不覆盖。总外层不以等待fsync作为进程停止条件；无新监督框架。

技能发现：本地find-skills优先发现 codebase-design / clean-code / brainstorming，已读路径 /Users/citrine/.agents/skills/<name>/SKILL.md。本段为已获明确设计授权的有界机制验证；使用小Interface、职责集中、真实调用验收与原失败保留；无需重复用户确认/安装。clean-code既有sickn33固定基线复用，不反复更新。
