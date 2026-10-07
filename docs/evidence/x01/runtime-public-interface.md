# X01 runtime 插件执行接缝

本片生产代码只扩既有 `runRunner` 与单一客户端领域模块。`RunnerOptions.pluginExecution` 是 operator 提供的可信可选端口，store 的 root/storeId/allowlist 在首次 await 前快照；qualification 从该 store 派生。transport 工厂只接 runtime 所创建的同一个 FlowClient，应由其单一 request closure 构造 PluginRunnerClient，禁止第二 fetch/认证重试循环。

持久 journal 是完整协议/key/qualification 的唯一事实源。旧 v2 不升级、已有 v3 不降级或换 store；status missing 才同 request claim，未知 ACK 不换 key。assignment 与 next key 成功落盘后才分派插件。绑定任务先于普通 adapter 检查，普通 v3 无绑定与旧 v2 保持原 adapter。load/invoke 使用绑定完整身份的稳定 key，经过现 pending/auth-fatal/deadline；未知阶段 ACK 或未证实 package 停止保留 assignment，不发送 completed。重启仅恢复原 outbox，不重执 package。正常 artifact/verification/completed 仍由同一 outbox 排序和 ACK。

PluginRunnerClient 本身无 HTTP 实现；直接消费给定 JsonRequest，负责输入 await 前深复制、最大响应字节、strict ACK/完整身份校验。FlowClient index 当前合法归 LAZY，尚未接入；接入所需一次极小 delta 为由 private request 构造 readonly pluginRunner。其构造闭包形状为 `(path, init, limit) => this.request(path, init, undefined, limit)`，沿唯一认证、CSRF、错误类和请求处理。不修改另一 owner 的入口。

生产默认仍未启用完整公开插件链。Server factory 现未挂载 plugin runtime 管理/phase routes；后继挂载必须显式 TrustedPluginHostPolicy，并先在 generic retryReconciled 阻止把 plugin binding 丢弃为普通 fixture task。该恢复路径尚未领取，本片不偷偷 mount。main/config CLI trusted-store recipe 与 FlowClient index 接线仍开放；当前直接行为使用注入 package host/transport，运行的是实际 runRunner/journal/outbox/executePluginTool，不称真实 npm/public HTTP。既有9/3真实材料测试和5PG关联测试不重复。

验证源码镜像固定 main2a7e，保留 P02 body 与 Codex；唯一合同组合是已审685978的 pluginSource import+optional两行，原 native-body 不删除。74直接源以 Git/hash记录，生产四源使用当前本树字节，镜像不是产品loader或第二运行器。输入0PG/网络/provider/tar，测试只真实本地journal/outbox目录，现OPS14监督器拥有唯一进程组/输出和TMP生命周期。

技能沿已读本地 find-skills、codebase-design、clean-code（sickn33固定基线）、brainstorming；以状态唯一owner、稳定小Interface和未知语义复核。架构新增domain边界及既有runtime一支可信分派，不新增调度状态；dashboard架构基线待此片真正main后由Lead更新。
