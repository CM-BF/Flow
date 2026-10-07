# 首个临时目录计量错误诊断

2026-10-07 02:58:05–02:59:41 UTC，status_read / gpt-6-astra。开始时 HEAD `16a938a465e49dfaf8a0b1ed1d4356bcc5eaa4b8` clean；fresh 协调 available，原 claim `9ec4dbc8-b4d3-4e16-801f-caa3a2cd85ac` v2 ACTIVE / 18 scope 身份与路径一致，未更改领取。

沿已授权 bounded 方案，只将原 sampler 提到同文件 `sample_temporary`，运行中与最终样本共用。首错写入同一运行 record 的 `firstInventoryFailure`：有限操作 phase、reason、errno、已计节点数和文件字节数；不记录路径、异常 message 或正文。`setdefault` 保持首错，即使最终采样成功或后来又失败也不覆盖。原异常原样抛出，原 faults、停止、UNKNOWN / KEEP、4096 节点限制、禁止 symlink / 非普通节点、空间与时间门槛均保持。

准备 4 个定向 fake 检查：ENOENT 的原异常身份与部分计数且后续结果不覆首错；root/open/iterate 的有限 OS 错误阶段；根身份/symlink/特殊节点仍拒绝；4096 成功与4097拒绝。全为注入对象，无真实根遍历。源码准备后获 Mika 同段 local 授权，2026-10-07 03:01:08.458787–03:01:08.721302 UTC 仅运行 `InventoryTests`，Python3.13.3 `-B`，4/4、exit0，原3个LifecycleTests未选。单次262.528ms（unittest自身0.114s）、raw734B，PID69752退出且双EOF；自有新TMP最终0文件/0B，同dev/ino清理absent。见[原始检查receipt](checks/inventory-diagnostic-1.json)与stdout/stderr。没有另跑syntax、types、PG、provider或旧85项。原 `qsnu91s5` KEEP 根未递归、未读取内容、未清理；R1原因仍无法追溯确定，不由新诊断假填旧raw。

| 修改文件 | SHA256 |
| --- | --- |
| execute-pg.py | 0bc4313170282bcdaf4eef973e4a86b7c4b6557c47c0bd3c105c67edc54f885a |
| execute-pg.test.py | d6e71805ef5abafa69d6c3a8901f8b91e706cf1a4b045f3f576f4adc0b1b8ee7 |

原准备包、R1 manifest/raw 按固定 Git 保留，产品和 fixture 不变。当前 wrapper 已不同于旧 slot request 的 hash，旧包不能作为修后运行输入；新源码及4项定向检查待一次独立审查，任何后继 PG 必须另给新窗口及准确输入，当前 **NOT_OPEN**。本段只有1次local检查，小于2分钟/最多3次各15s边界；raw734B小于64KiB、最终空TMP小于1MiB，source/metadata小于1MiB，未安装。

R1 忠实性回执：architecture_read / gpt-6-astra，2026-10-07 02:56:25 UTC，RESULT_FIDELITY_APPROVED / 0 P1/P2，绑定 `16a938a465e49dfaf8a0b1ed1d4356bcc5eaa4b8`；6 raw / 6586B 与固定 Git/WT/hash 相符。只能确认0条case结果，不能说8失败/跳过或通过。原 fixture 在所有 DB 初始化前必须耐久写 reservation，五项前置/最终产物均 ENOENT 且源码不删除它们，结合已结束child/group/EOF支持未进入该DB初始化链；这是控制流证据，不是实际零连接或DB absent查询证明。

方法：复用本地 find-skills / brainstorming（已授权有界方案）/ clean-code / codebase-design。只将两个真实调用点共用的采样职责提取，保留错误身份与单一记录所有权，无新框架；未以错误分类代替门禁，也未抬上限。时间遵循主树 `plans/AGENTS.md#task-timing`；本段时间来自实际clock，不推断整个task开工时间。
