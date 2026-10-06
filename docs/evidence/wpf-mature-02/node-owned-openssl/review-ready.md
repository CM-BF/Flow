# Owned OpenSSL：固定准备包待独审

本片仅文件/hash封包，实际 **NOT_OPEN**。源码 `ca6a7a15f76d333f20caf0690ed85b76e29d2c54`；原四fake证据 `261918f251bd330e76fe66a184df762a07d4c860` / validation-manifest SHA7802ae46…e083：单次4/4 exit0。原SOURCE_REVIEW无P1/P2仅原范围；本段0新检查/入口/目标/监听/PG/provider，不声称新syntax/inert通过或组合APPROVED。

[driver-input](driver-input.json) / [manifest](manifest.json)固定17个运行文件、26个去重prepared共145978B（≤262144）；旧failure-text15闭包去其wrapper、保留被新entry导入的delivery entry，再加本片entry/wrapper/34B注释配置；共享host采用ca6字节。固定Node+27external共28文件O_NOFOLLOW流式hash已比对，144既有closure节点kind/link/absent与resolved realpath已核；未运行derive-policy。13输出均不存在；local .gitignore为private stderr/outer唯一当前忽略来源。

仅一目标、30s、1MiB总量；prepared一次+实际双流观测+全部磁盘副本（删除不扣账）+16KiB收据/CLI+4KiB outer+128KiB人工archive。prepared/archive互斥，[archive准备快照](archive-preparation.json)额外计自身实际字节，尾部至少24KiB；外部依赖读取不是新增输出。机器time从Node加载/hash至捕获/关闭/清理/末次持久化/CLI，outer最终门禁之后真正shell退出仍须外部pre-call/tool-finish UTC收据，超30s失败；人工review/Git在时钟外但bytes进archive。

唯一未来调用（独审及Mika精确execution HEAD OPEN后才一次）：
`/bin/sh experiments/codex-app-server-conformance/node-owned-openssl/execute-window.sh --reviewed-node-owned-openssl-window`
入口会先写reservation，绝不可作为准备检查调用。此前失败窗口保持消费；新窗口当前无运行产物。执行前freshclaim/clean/input/external/closure/13outputs与资源≥1GiB+32MiB；不可因磁盘恢复自动执行。

同candidate37023e/Node/flags/env/immediate脚本，只追加指向自有34B配置的argv；无用户配置读取/新grant。精确exit7+stdout0+stderr40固定hash且EOF/group/fd/cleanup/accounting成立才过。retainedDiagnosticArtifact与process/root清理分开，复制失败保原完整自有raw/根；部分/unknown明确保留身份，private0600文本只在授权后诊断，公共不泄raw，独审后再获授权同inode清理。失败停批不重试，无真实Codex/SDK/provider/auth。

方法：本段按本地find-skills优先复用clean-code（既有sickn33@bdacd76方法基线；16:41重新读取本地SKILL.md），复核单一process owner/默认分支隔离/错误身份保留/互斥计量。不新增永久生成器、framework或测试。旧failure-text `38e78c119ee14a24c076abad1d4f7412618faedd` 仅固定Git历史引用，不把旧manifest冒称当前WT全同。Claude产品consumer继续独立优先推进。
