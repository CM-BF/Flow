# SVC08 合法 Flow 来源宿主产物候选

状态：短准备，NOT_RUN。固定输入见[inputs.json](inputs.json)。仅自有证据，无新打包器、来源例外、构建窗口或个人切换许可。

## 最小构建

调用已有 `prepareBackendArtifact({repository, target, directory, offlineStore, pnpmCli})` / `verifyBackendArtifact`。repository 固定 `/Users/citrine/Projects/AgentHarness/Flow`，target 固定 `422f4b150e5801d6010e5bbd6b53574e35384f87`。原 build Module 从该仓库执行固定 commit 的 Git archive，working HEAD 不作为源码输入；不移动 Flow checkout/main。Node24.20.0、pnpm9.15.4、原离线 store 和已审正式 YAML parser/精确依赖选择复用，安装仍 offline/frozen/ignore-scripts，私有 HOME/config/store。新独占700产物根，只接受真实 manifest.sourceRepository 等于 Flow；来源字段不可重标。

复用 SVC06 `artifact-first-run` 的单入口职责与 OPS14 监督：固定输入、reservation/目录身份、既有 prepare/verify、产物内部 import-only、原始结果与保留。下一步只需本 evidence 内参数化薄调用，不复制 builder/依赖选择/监督循环。旧 e5 的 sourceRepository 是 backend-release WT，保留原件，它不是个人 Flow 产物；其25.39秒和约366MB记录只是预算参考，不证明新目标已构建。新输入与3230的具体差异按 inputs 逐字标记；相同 lock 不等于新缓存/完整闭包已加载。

建议沿已审保守预算：420秒工作+0.5秒TERM+2秒reap、独立外层期限；raw总2MiB（OPS14合计capture1MiB，余量给原record/import/最终证据）；fresh至少3,391,094,784B，新增预算2,317,352,960B且live保留1GiB。stage/archive/selectedseed/installcache/产物与metadata同时计入，不能把clone逻辑字节当物理回收。实际执行前须核本队及其他holder合计资源、旧unknown资源状态和精确运行入口，不沿用历史free。本准备未重新哈希全部CAS或运行任何包。

## 产物到真实宿主的验收分段

1. **0PG 构建与加载**：完整 verify/Node身份/内部 Vite与pg解析，固定 static-web/host/preview 内容，serviceRuntime 的公开选择与来源拒绝。所有结果独立绑定新descriptor；不是完整internal-service启动。
2. **真实隔离 Web 宿主**：现 `runService(...,'web')` 仍无条件 `assertMarker`，故必须另排一专库和明确marker，不能用0PG替代。只起自有Web角色、动态loopback端口，原有process/nonce与release目录，真实Vite/static子进程及身份/保留版本读取；center/runner不启动，使用合成状态保留断言不冒个人在线证明。必须先完整固定driver/输入/清理及预算，复用原SVC工具，不能使用 SVC06 仍unknown的宿主资源。开发树不可用验证不得靠禁掉ps而破坏身份观察；具体隔离方法仍待该片准备。
3. **个人采用仍是独立操作**：产物要位于该installation的 backend-artifacts 下才可由现backendRuntime选择。隔离产物的迁入/正常校验、容量、同卷移动或确切复制策略尚未实施；不能把临时产物路径写成descriptor绕过现布局。工具输入冻结与checkout切换应区分：普通CLI从config.repository=Flow加载仅核moduleRoot真实路径；replace核backend state.source及owned身份，并不要求当前GitHEAD等于expectedBackendHead。因此未来可保Flow在明确固定已审新CLI版本并冻结实际8个host输入，调用replace；不必先把checkout切回af51，也不必从新artifact的CLI自举。新Web service独立从descriptor产物启动。实际driver仍须核工具bytes、旧center/runner身份和来源保留；不得更改整个config.repository、state.source或state.backendArtifact来迁就新Web。实际操作前由owner固定这一最窄接缝，当前只承诺候选。

成功的Web-only部署必须保持center/runner记录、配置/profile/maintenance、release pointer与三个Web版本namespace。同一operation只观察；pending/unknown不换key、不自动重启，任何失败保留首错误和独立cleanup事实。后台任务未完成/lease/unknown不因Web ready而改变。旧tab不操作，长连接中断与页面旧lazy可达性分别验收。

## retained=3 只读结论

沿[已审retained-three设计](../deployment-candidate/retained-three.md)。唯一可信候选是owner显式选择非current、非受保护rollback的版本，并明确接受该版本旧tab未来lazy请求可能失败；无请求、TTL、pagehide或immutable均不是退役依据。保版本namespace与旧兼容报告；先可逆完整归档/确切恢复，不在此片实现删除、恢复或定时策略。原设计所述SVC06路径占用已变动，未来必须fresh claim，不沿旧记录推断权限。

方法：复用本地 find-skills / codebase-design / clean-code；构建、角色选择、进程监督各维持单一Module和小Interface。此次仅固定来源、生命周期、失败和预算，未增加产品或执行事实。
