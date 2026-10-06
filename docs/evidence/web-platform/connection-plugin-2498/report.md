# Connection 页面真实 P01 接线：固定源码只读提案

结论：沿 REQ22/23、WPF-001-05 的既有覆盖后继，先把**现有唯一 P01 host 的所有权移到认证外层**，连接页复用 `settings.sections` 的真实 button/menu/panel 与现成 Appearance contribution。认证后 Workspace 的私有业务绑定作为该 host 的一段授权租期。无需默认新增 public SlotId、公开 auth command 或第二 host/registry。此为后继候选，不是 Recovery 的新阻塞；未领取、未实现。

## 固定依据与范围

产品基线为 Recovery `249894321f22763ec4801af8bd9c2ef0e0e3c36b`，所有产品引文来自 `git show`，不是 moving 工作树。读取 10 个关键产品文件；逐文件 SHA256、字节数、读取路径见 `sources.json`。管理需求固定到 `ead94de736093c91d0cc9b1d56e33b76ea36eec9`：`plans/web-platform/plan.md:77–78,145` 和 `docs/evidence/web-platform/conversation-plugin-coverage-research.md:64–66`。f13 原始调查 `/tmp/root-connection-plugin-surface-f13.json` 仅作历史来源，本报告已在 2498 重新定位。

产品相对路径均相对于 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery`。总需求仍原 WPF-001-05 / REQ22–23；不新开平行插件计划，不宣称整个插件目标完成。

## 现状：哪些是真的，哪些只是标记

| 固定出处 | 源码事实 / 影响 |
|---|---|
| `App.tsx:783–790,819–1108` | AppPluginSession 在 Workspace 内创建、销毁，PluginProvider 也仅包住 Workspace。 |
| `App.tsx:1130–1184` | Connection 的 check/logout/discard、Connect 和表单均为固定 JSX；1140 的 `data-extension-slot="settings.sections"` 不注册、不订阅、不授权 contribution。 |
| `App.tsx:1244–1247` | Connection 在 provider 外；已保留 Workspace 只是 native `hidden`，不会因为连接页出现就清理所有 effect。不能另造 preauth host 后让旧 Workspace 的独立 host 同时充当第二权威。 |
| `plugin-integration/react.tsx:25–30,108–110` | AppSlot 依赖 AppPluginSession 的 Context，无 session 返回 null；单独给 Connection 补 AppSlot 没用。 |
| `plugins/react.tsx:17–71,191–243` | 低层 ExtensionSlot / PluginView 已直接接受同一 PluginHost。前者只画 button/menu，panel 需要实际 PluginView；光画 ExtensionSlot 也不会展示 Appearance panel。 |
| `plugins/types.ts:7–30,48–64,95–114,134–154`；`plugins/validation.ts:9–26,93–146` | `settings.sections` 已支持 global；global context 严格仅有 kind，不得偷偷塞 connection/token 字段。HostPort 与 public command 参数没有认证凭据/FlowClient。 |
| `plugins/builtins.ts:52–93`；`plugins/builtins/theme.tsx:4–39` | Appearance 已是实际 settings.sections panel、theme.write 命令和订阅，适合作为第二个真实消费者，无需重造设置 registry。 |
| `plugin-integration/session.ts:83–125,165–174,314–345` | 当前 AppPluginSession 自建 host、注册整套业务 plugins；global context 一般有效，非特殊 capability 的 authorize 最后返回 true。不能不加约束直接提前构造假 AppActions 或把现 global fallback 当 preauth grant。dispose 会同步撤授权再 await host.dispose；借用外层 host 后必须只撤本 session 绑定/registration，不能误关全局 host。 |
| `plugins/host.ts:89–126,182–215,286–324,326–423,530–592` | manifest/command/slot 校验、单注册表冲突、deactivate/unregister、AbortSignal/own 清理、调用前后授权、旧 activation callback 拒绝均已有。Manifest 声明仍须 HostPort.authorize；同 realm trusted host 不是任意第三方代码安全沙箱（:60）。 |
| `connection/session.ts:18–40,46–117,120–126` | cookie/public session endpoint 唯一认证权威。CSRF 私有；generation/namespace/ready 校验已有。connect 丢 ACK 后 GET 恢复而不重 POST；logout 在网络 await 前同步撤销业务授权。不能绕开这些动作另发请求。 |
| `App.tsx:1215–1232` | `phase=ready` 不等于 Workspace 可接管：不同 namespace 还需 retained guard/flush，且 session、identity、namespace、selecting 均匹配。新插件租期应服从这个实际 ready，而非只看 URL 或 phase。 |

## 一个最小的 Interface

只引入应用私有的宿主生命周期模块，例如 `AppExtensionLifetime`。它内部仍只有现有 `PluginHost`，负责：

1. **本地可信层**：初始化已审核、打包内置的连接 UI 与 Appearance 定义；复用 host 的 register/activate/command/contribute/own。preauth 不加载中心插件、外来模块或整个 Workspace catalogue。信任来自应用实际提供的定义，而不是任意代码自报一个 `flow.*` ID。
2. **连接绑定**：接受应用私有 lease，含 ConnectionSession 对象身份、authority generation、AbortSignal 及无凭据动作。更新/撤销时同步失效旧 lease，再让已有 P01 机制清理对应 activation/registration；不能仅以相同 `{kind:'global'}` 或相同 URL 判断 callback 仍有效。
3. **业务绑定**：Workspace 接管通过 retained guard 后，AppPluginSession 借用该 host，注册自己的业务贡献并持有精确 disposable。旧 Workspace 可保草稿/receipts/cache，但 preauth/reauth 时没有网络读写授权。最终 session dispose 只清自己的 registration/private bindings；app teardown 才 dispose 唯一 host。

私有连接动作可收敛为 `requestCredentialSubmit / checkSession / logout / discardRetainedView` 加非敏感 phase/可用状态。它们不是 public PluginContext/HostPort 的新增通用认证 API：

- Connect contribution 的无参数命令只请求宿主自有 form `requestSubmit()`；password state、读取 token、调用 `ConnectionSession.connect(token)` 仍留在宿主。Enter 走同一个私有 form submit。不得把 token 放 command args、ResourceContext、插件配置、navigation、错误/日志、recovery 或 broadcast。
- Check / Sign out / discard 的 handler 仅由审核 builtin factory 闭包绑定无参操作；各操作在私有 lease 内核对当前真实 session/generation/phase，必要时调用现有 retained guard/confirm，异步结束再次核对。public contribution 的 capability 声明只描述 UI 操作，不能授予登录、登出或任意网络权力。
- 使用现有 ui.layout / theme.write 等声明承载对应 UI/local theme 意图；具体 connection 动作另受**精确可信 builtin + 私有 lease + 真实 ConnectionSession**约束，不以“任意 plugin 声明 ui.layout 就能认证”作为授权规则。现公开 HostCommand union 不增加 token-bearing command。
- 不把真实 FlowClient、CSRF getter、owner token、整个 AppActions、journal/全部 namespaces 注入任何 public plugin object。可信 builtin 仍是同 realm 模块，不声称这解决 X01 第三方隔离。

连接页实际接入现有 settings.sections：用同一 host 的 ExtensionSlot 展示贡献动作；用 PluginView 展示 Appearance / 连接状态设置 panel。需要按 phase 表达禁用/错误时，由真实 builtin panel 的轻状态订阅与 host 执行结果处理；现 ExtensionSlot 自身不会根据 authorize 自动生成 disabled 状态（plugins/react.tsx:50–62），不能只写 manifest 就宣称 UI 已禁用。业务按钮不同时保留另一套可绕过停用的 hardcoded action。

宿主保留最小认证安全壳：私有 form、状态/错误、插件失败或停用说明以及既有扩展管理的显式恢复入口。凭据 UI 不变成泛用 renderer 的 secret props。停用插件应停贡献/命令而不是误登出中心；不能为恢复页面而静默重新激活被用户停用的插件。正常工作区与连接页使用同一 P01 entry 的启停事实，不维护第二 enable/grant 配置。

## 认证前后、撤权和 retained 状态

- **preauth**：仅可信本地 UI/主题；Check 可显式读取 session，Connect 由私有 form 提交；不存在 workspace/task/ref/client 授权。unsupported/offline/forbidden/error 保现有可理解状态，不变成“插件加载失败”。
- **postauth**：公共会话身份核验且 retained guard 通过后才绑定业务 authority。具体 task/view/project/reference 仍由原 AppPluginSession 私有成员校验，不用 global context 代替。
- **logout/offline/401/403/namespace change/dispose**：ConnectionSession 的同步失效先发生，host 私有 lease 立即撤销；旧 plugin activation/异步 callback 不得在新身份下借到新 actions。现有 P01 deactivate/unregister 负责旧 activation 的 signal/owned cleanup。恢复必须建立新有效 lease，且不得自动重发命令或静默恢复用户已停用的 entry。
- **reauth 页面但 retained Workspace 尚在**：只撤业务读取/写入权，保原 draft、pending capture、unknown receipt、split/view 身份；不能把显示连接页等同于 unmount/释放 Recovery 状态。discard 仍明确确认，且不替代 journal retention 规则。
- **相同 global context**：PluginView 的 key 由 contribution/context/attempt 构成（plugins/react.tsx:204–230）；context 相同不会天然触发新身份。因此 lease 切换必须通过明确订阅/registration 代际失效刷新，不能把重新 render 或 WeakMap 首次授权当完整身份保证。

## 最小候选写范围（未 take；须等 Recovery App 交权）

产品路径均为相对仓库路径：

1. `apps/web/src/App.tsx`：外层唯一 lifetime、连接页真实 renderer/动作、私有 form/retained guard 接线。
2. `apps/web/src/plugin-integration/session.ts`：借用外层 host / 精确业务 registration disposer；保当前业务校验、同步撤权与草稿存活。
3. `apps/web/src/plugin-integration/react.tsx`：让连接页拿到 host 的窄渲染接缝；不要伪造 AppPluginSession。Workspace 现消费者兼容。
4. `apps/web/src/plugin-integration/extension-lifetime.ts`（新）：单 host、私有连接/业务 lease 及权限分派；不增 registry/cache/配置权威。
5. `apps/web/src/plugin-integration/connection-extensions.tsx`（新）：已审核 builtin 定义/commands/panel 与私有无凭据 port 的绑定。
6. `apps/web/src/plugins/builtins.ts`：把既有 Appearance 定义可独立取得，避免 preauth 构造 workspace fake dependencies；现 factory 导出兼容。
7. `apps/web/test/connection-plugin-integration.test.ts`（新）：真实 P01 host + ConnectionSession 的权限/代际/owned cleanup 接缝。
8. `apps/web/test/connection-plugin-integration.browser.ts`（新）：实际 App preauth/reauth 与原 Workspace 保稿/禁用/键盘组合；fixture 入口如需额外文件，领取前列出，不能默改已有 fixture。

上述是最小实现 seam 候选，不是已经评审可 take 的完整执行范围。自有 plan/evidence 应由管理者沿既有覆盖后继确定，不在本研究另建。`plugins/types.ts`、`validation.ts`、`host.ts`、`plugins/react.tsx`、ConnectionSession/public client/shared contracts 默认只读；若实践证明现 API 无法保持上述授权/renderer 更新，不以 cast、假 global context 或旁路回调绕过，先给具体原因再精确 amend。App/session 当前 Recovery 独占；本研究不声称 live scope 已释放。

## 必要验收（本次全部未运行）

1. 真正 preauth App：同一 P01 registry 的 Check button 与 Appearance panel 有可见贡献来源；命令/button/menu/panel 按真实能力声明工作，停用/卸载移除自己的贡献与旧 handler。仅 data 属性或 mock AppSlot 不算通过。按需增加一个已审核 sample，无需改核心 slot 表。
2. 凭据隔离：Connect button 与 Enter 调同一宿主 form；spy public context/args/config/navigation/error/journal 不含 token/CSRF/client；lost connect ACK 仍最多一个 POST、随后 cookie GET；第三方相同 ui.layout 声明无 auth 权。缺插件/故障可见且可明确重新启用，不静默旁路。
3. 实际 retained 跨身份：旧 session ready→logout/失联→reauth/same URL different namespace，旧回调/迟到 read 不作用于新 session；授权在 await 前撤，guard 未完成不建立业务 lease。保旧文字/knowledge/attachments/pending/unknown 及 split 状态，不启动隐藏业务读。
4. 生命周期/回归：同一个 host 实例跨 Connection/Workspace 切换，无双注册/双 theme listener；旧 registration cleanup 不移除新 session 的项；StrictMode 与真实 native hidden 区分，disabled 不自动启动；390 浅深主题、焦点返回、错误/unsupported/offline 及 keyboard form/菜单均实测。

## 方法与限制

复用已安装本地 find-skills、codebase-design、clean-code，路径与本次内容 hash 见 sources.json；无联网查找、安装或更新。应用方法：以真实两个消费者（连接动作、Appearance）确定 seam，把认证/注册/视图存活分成明确责任；复用已有 P01 生命周期；错误与撤权从私有 authority 返回，拒绝 fake session / 第二状态仓库 / 过早公共 slot。clean-code 本段只读复核：接口不传整个客户端，命名区分 local UI 与 authenticated operation，cleanup 只归自己资源，禁止重复 enable/grant 权威。

本报告仅固定源码推导，0 产品 import/tests/build/PG/browser/service/provider，0 项目文件改动、0 claim、0 worktree。不评价 moving Recovery 修复，不代替其独审，不宣称 preauth 插件已经实现或认证安全已运行证明。
