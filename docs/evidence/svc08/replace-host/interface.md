# SVC08 replace-host Interface（实施片）

已审设计 ad77；采用当前 fixed main 0967607a 工具，直接验证 legacy config 无 backendArtifact 且 state.source=af51 的保真行为，不维护历史工具分叉。当前仅合法四产品路径；retained3 仍设计后继。

`replacePreviewWebHost(request)` 是本地受信受管操作，CLI `web replace-host --directory PATH --request FILE`。严格有限输入：operationId（UUID）、expectedVersion、expectedBackendHead、compatibilityId、expectedWebRecordSha256、expectedPointerSha256、expectedHostSourceDigest、allowConnectionInterruption=true；不收路径/argv/env/ref。host digest来自当前受信 runtime 的明确host文件集合；独立于backend state.source与Web artifact。`inspectPreviewWebHostSource({directory})`只读该来源，不连接DB或创建状态。

同一原operation.lock：配置与marker、backend身份→已有operation只观察（相同body）→新操作全部CAS/兼容/source检查→durable exclusive journal先行→原stop→原launch/pending record→source/protected值复核→durable result。每个journal≤16KiB，总最多32；unknown不会重启，operationId更改不能旁路未结算journal。旧bootstrap/publish/rollback入口原义保持。

新测试使用真实私有文件/锁/manifest与兼容报告，受信构造函数仅注入marker和进程端口，生产入口固定默认实现；不构造第二spawn或状态机。覆盖legacy af51、先checkpoint、CAS、重复/矛盾body、unknown停止/启动、并发锁和保护字段。0PG/provider/个人操作。局部段累计≤60s，私有fixture+raw≤16MiB，复用OPS14总界；每轮独立raw保留，不跑旧PG/fullbuild/selector。

停止前复用 `loadReleaseAssets` 校验指针每个精确compatibilityId、backendHead、完整保留内容、namespace与192MiB上限；不另写验证器。hostSource八文件是有界字节身份，不是完整依赖/不可变目录保证。runtime仍由backendRuntime选择：无backendArtifact时legacy repository，有时原backend artifact。当前不增加Web独立artifact selector，不通过改state.backendArtifact伪造后台升级；真实legacy部署须另核固定源窗口与旧后台完整生命周期的动态读取边界。
