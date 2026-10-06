# 唯一 P01 host 上移：固定 2498 的独立只读第二意见

方向可行，现有 public API 足以继续设计；必要工作是私有生命周期/lease 适配，不是新 slot、第二 host 或公开认证命令。本报告不批准任何实现，不把推演当已复现缺陷。产品依据仅固定 `249894321f22763ec4801af8bd9c2ef0e0e3c36b` 的十个文件，路径相对 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery`。逐字哈希在 `source-manifest.json`，独立复算与 W01 十源记录全同。Recovery 724 当前源码未改。

## 一、已有 API 足够的部分

- `plugins/validation.ts:9–26,127–139`：settings.sections 接受 global，global 严格仅 kind。`plugins/types.ts:95–114,134–154`：HostPort 已提供按 plugin/capability/context 授权、带 activation AbortSignal 的执行；button/menu/panel 均已有。认证 generation/namespace 不能偷偷塞入 public context。
- `plugins/react.tsx:17–71,191–280`：ExtensionSlot 画 button/menu，PluginView 画 panel。`plugins/builtins.ts:52–94` 与 `builtins/theme.tsx:4–39` 已有 Appearance panel/主题命令/订阅。无需重造主题设置 registry。
- `plugin-integration/react.tsx:25–30,108–110`：AppSlot 当前必须有 AppPluginSession。连接页应直接使用同一外层 host 的窄 renderer 接缝，不伪造 session/client。`App.tsx:783–790,819,1244–1247` 证明现 provider/host 在 Workspace 内，Connection 在外。
- `connection/session.ts:35–64,102–126` 已提供 subscribe、公开 authority generation、namespace 校验及同步撤权。业务 lease 的准入还必须满足 `App.tsx:1215–1232` 的 retained guard 和实际 ready；session GET ready 本身不足。

## 二、需要收紧的五个接缝

### 1. 精确 registration disposer 已有保护；不要把按 ID 的停用当旧 lease cleanup

`plugins/host.ts:96–105` 禁止同 ID 同时注册；返回的 disposer 在 `114–124` 捕获原 entry，且先置 removed=true。因此在正常 public API 序列中，新同 ID 注册必须等旧 disposer 删除后才能成功；旧 disposer 再次调用直接返回。虽然 delete 按 ID、没有 entry equality guard，本次没有找到普通旧 disposer 延迟调用可删掉新 entry 的可达路径，不能据此报现存 blocking bug。

但 `deactivate(pluginId):182–188` 每次按 ID 找当前 entry；旧异步 cleanup 若调用它，确实可能停用后继。私有适配要持有本次 register 返回的精确 handle，先撤本 lease，再串行释放本次 handle；不能 cleanup 时从共享 Map 按 ID 取“最新 handle”，也不能用 deactivate(id) 代替原 registration.dispose。`own:217–245` 的旧异步资源清理已有幂等和 generation 约束，可以复用。

新旧交接验收应分两项：旧 exact handle 在新同 ID 注册后再 dispose 不影响新 entry；旧 lease 的任何延迟清理都不得调用 current-entry-by-ID 路径。StrictMode 重建同样适用。未要求修改 host.ts。

### 2. P01 activation generation 不等于认证 generation；同 global 下旧回调并不天然失效

`host.ts:209–215,575–592` 只识别 entry/session activation。`execute:344,356` 在 activation 前后授权；`369–370` 在 handler 完成后只检查 activation current，**不是再次 auth authorize**。W01 报告中的“调用前后授权”须收窄为这个准确事实。`bridge:400–420` 也在执行前授权，执行后仅 current。

如果保同一 activation、只把外层 currentSession/actions 换成 B，旧 renderer 保存的 global execute 仍可通过 P01，handler 也可能借到 B。`PluginView:204–230` 的 key 仅 contribution/context/attempt；private lease 变化不会触发 show effect。`host.ts:608–643` 也不会因 HostPort.authorize 闭包变化自行 publish。

最小要求：私有连接动作在意图产生时捕获准确 session 对象、公开 authority generation、namespace/当前 form 身份和自己的 lease signal；所有 await 后核同一意图，不从 mutable currentSession 重取新权限。旧 activation 必须被终结，或 handler/执行绑定本身固定到原 lease，不能仅 rerender/换 React key。实际私有 renderer 还需 lease 订阅和代际 key，使当前可见性/错误刷新；这个 UI 刷新不能代替命令门禁。Connect button 和 Enter 走同一宿主 form，但旧按钮回调不能去 requestSubmit 新 B 的 form。

Connect/logout 自己会同步改变 auth generation (`connection/session.ts:46–61,102–116`)；完成检查要允许本次明确动作的预期状态转换，仅呈现其结果，再由公共 session read 授权新业务，不能把旧 lease 重新续期或把正常 logout 误报为服务器失败。无自动重发。

### 3. auth revoke、用户 disabled、最终 dispose 是三个动作

`host.ts:199–207` stop 把 entry 变 disabled 并 abort/清 activation；无公开“认证暂停但保持用户启用事实”状态。`register:106–112` 新 entry 总是 registered。故每次 auth loss unregister/re-register 后自动 activate，会丢失此前用户 disable 的事实；把全部 revoke 都当 deactivate，再无条件 activate 也会重新启用原本 disabled 的插件。

Appearance/可信本地连接定义应由外层 app 生命周期注册一次，认证更替不重新注册主题。业务定义若必须按 retained session 重建，适配要以同一 P01 entry 的真实状态做一次受控交接，保 disabled/failed 的显式恢复语义；不要创建长期第二份 enabled/grants registry。必要的 activation 撤销和用户启停意图须在 private adapter 中明确区分。

只禁 auth lease 也不足以清所有展示：slot 快照只过滤 disabled，不按授权过滤 (`host.ts:623–636`)；ExtensionSlot 按钮本身没有 permission-disabled (`plugins/react.tsx:50–62`)。已禁/失败说明、当前操作可用状态必须由现私有 renderer/安全壳表达，不能声称 manifest 自动处理。停用连接插件不等于 logout；不得保留旁路 hardcoded action 静默绕过停用。

### 4. retained Workspace 必须保旧 tuple 和控制器，外层只接管 host 所有权

`App.tsx:1195,1220–1247` 已把 namespace/session/client 一起保留，ready 失败时 native hidden 而非销毁。`plugin-integration/session.ts:327–345` dispose 会 abort lifetime、dispose steering/recovery、清 attachment/knowledge subscriptions，并最终 host.dispose。把 host 移到外层后，不能在 auth revoke 时调用这套最终销毁，也不能只删除最后 host.dispose 就把业务权限都当已撤销。

私有 lease revoke 应同步拒绝旧命令/新读、隔离迟到结果；保原 view、draft、capture、unknown 及其原 client/session。最终放弃/替换仍沿 retained guard/明确确认，才清本 session 的精确注册和 bindings。外层 app teardown 才关闭唯一 host。既有 `App.tsx:797–804` online/authorized 同步仍须保留，隐藏并不自动等于 effect dispose。

外层 HostPort 不能继续无条件复用 session 当前 authorize 尾部 true (`session.ts:165–174,314–325`)，也不能凭任意 ui.layout 声明给予认证动作。可信连接 closure 与当前业务 lease 是不同私有授权入口；先有真实 retained ready 再接业务。

### 5. 主题和 readonly navigation 也有跨认证所有权

`session.ts:337–343` 当前旧 session.dispose 会直接通过旧 actions.setTheme 重置 custom palette；借用外层 host 后保留它，旧 Workspace 最终销毁可覆盖外层正在使用的主题。必须将主题 store/setter/fallback 的所有权一并上移，不能只上移 PluginHost 实例。主题动作本地可用，不应依赖中心 CSRF/ready。

`host.ts:490–507` 只在被卸载 entry 拥有当前 custom theme 时 fallback，且直接调用 HostPort.execute，pluginId 为 flow.host、新 signal，不走正常 plugin authorize。因此外层 adapter 要保这个窄内部 fallback 到内置 scheme 的路径，不把 flow.host 解释为通用认证豁免；保持本地 theme commit 同步/无 auth 网络等待，避免把原本同步作用延迟到新的主题选择之后。仅主题 contribution owner 停用/卸载才 fallback，不能 auth loss 就重置全部主题。

`host.ts:250–281,359–364` navigation/theme Readable 只校 activation current，不经过 capability authorize。`session.ts:146–163` publish 仅 closed 门禁，`App.tsx:791–796` 的 retained Workspace layout effect 仍会 publish。因此外层必须只接受当前有效 lease 的 navigation/context 发布，auth loss 清公开 navigation 为无 task 的本地形状；隐藏旧 Workspace 不能再把旧 principal 的 taskId 发布给连接页。theme 则属于 app 本地层，不能被这个 navigation 清空一起销毁。不传 token、CSRF、client、journal 或旧账号材料给 public readable/props/diagnostics。

## 三、对原提案的最小修订与验收

保 W01 的私有 lifetime + 连接 definition 两模块方向；public types/validation/host/slots 默认不动。补充三个清晰职责即可：

1. app 本地 owner：唯一 host、稳定 Appearance/连接 entry、单 theme store；只有 app teardown dispose host。
2. 认证/业务租期：基于 ConnectionSession 对象+generation+exact namespace+retained ready；同步 revoke，精确 registration handle，旧 closure 不得借新 authority。控制器和完整草稿仍是原 session 的 authority。
3. 显示订阅：private lease 状态驱动连接 renderer 可用性/代际；仅有效业务 owner 可发布 navigation/context；不是公共新 slot 或另一个 permission engine。

建议将原验收补为以下可判定时序（本次均未运行）：

- 同一 host object：preauth→ready→offline/logout→reauth；0重复 ID/主题订阅。retained 原 text/材料/capture/unknown 不变，仍原 client/session，hidden 0新业务读。
- A 的旧 global execute/form intent 在 await 或保存回调后遇 B 接管：0 B 请求/写入/新 form submit；旧结果不改变 B。只换 React key不能算通过，必须实际调用保存的旧回调。
- 用户 disable Appearance/connection/business entry→auth切换→显式重启：切换本身不重新启用；按当前 P01 真实状态展示，不另维护平行开关。插件失败可见并显式恢复。
- exact旧 registration.dispose 在新注册后重调；晚旧 cleanup；StrictMode effect cleanup；新 entry、其命令和当前 renderer仍存活。
- custom theme owner disable 的合法 fallback；旧 Workspace 最终 dispose 不覆盖新 palette；light/dark across unauth remains usable。停用连接 entry 不触发 logout。
- retained旧 layout effect/旧 readable subscriber 在 auth loss/B 后触发：连接页导航无旧 task/principal元数据；公共command/context/diagnostics无凭据。正确的本地主题更新仍可见。
- retained guard 阻塞时，公共 session 虽 ready，仍不建立业务 lease；显式处理后只一次接管。Connect Enter/button同一路径，lost ACK只现有一次 connect POST+session read。

这些是后继实现的验收修订，不是 Recovery 当前新增阻塞，也不证明方案已运行。未新建任务、claim、worktree、公共协议或产品文件；本报告没有给出实现 APPROVED。

## 方法与执行限制

复用已读本地 find-skills / codebase-design / clean-code，版本哈希随 manifest。方法应用为：按唯一资源 owner 拆 lifetime/revocation/dispose，追踪两实际消费者（连接命令、Appearance），检查异步错误、旧 callback、订阅与 cleanup；不以抽象数量或文件长度为目标。只 git show 固定十源与读取提案；0 product import/tests/typecheck/HTTP/PG/Chrome/provider/空间采样/安装/项目改写。只写本目录报告与 manifest，总量小于64KiB。
