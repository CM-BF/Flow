# SVC06 启动诊断小接口

目标只让原真实宿主启动失败保留可行动证据。固定前像b2b；旧c2c/r1及此前失败保持。r1被native限定APPROVED_RESULT_FIDELITY_WITH_PRESERVED_HOST_FAILURE，不当宿主成功。

1. startPreviewServices保留首次失败的role、phase、白名单形态error code、时间；独立cleanup失败另外记录。对外保持原START_UNCONFIRMED_CHECK_STATUS及现有lastError，公开额外摘要绝不含message/stack/argv/env/body/token。
2. runService在配置/nonce身份确认后记录pre-spawn阶段：marker、policy、artifact-runtime验证、child spawn、child exit。阶段缺失仍unknown，不把缺失推成没启动。原10秒ready、detach/nonce/stop、真实子进程参数和业务行为不放宽。启动前配置load仍是由父层身份及缺少阶段界定的未知区间，不伪造具体原因。
3. 仅真实runService子进程stderr增加有界私有接缝：每role/nonce最多64KiB，0600，私有根与leaf不接受symlink/别的owner；满后持续drain，不杀服务、不将内容公开。摘要只bytes/SHA256/truncated/EOF与原exit事实。stdout仍ignore。异步输出不得无限排队；记录失败与主启动失败分开。
4. 诊断Module承担安全字段与私有持久材料；原process拥有进程身份/TERM。不复制监督/维护FSM、不做通用日志平台。证据绑定当前nonce；旧一代不能被当新启动证据。
5. 0PG/provider局部覆盖受控首错/cleanup不覆盖、阶段nonce/权限/symlink、真实自有child exit与stderr截断/持续drain，复用原process两直接例。累计≤180s、tmp≤16MiB/raw≤2MiB，既有OPS14；其它已绿44/host/build不重跑。真实新host和artifact另固定输入/窗口，不重用r1。

共享scope已fresh原子amend v8：preview/process与两专测、startup-diagnostics与专测，以及原own plan/evidence。仅固定b2b九个必要输入逐字供给于本树，来源见source-provision；不编辑它们的新行为或覆盖他人树。继续应用已安装find-skills/codebase-design/clean-code方法，合并前复核职责、错误/取消/资源与直接消费者。
