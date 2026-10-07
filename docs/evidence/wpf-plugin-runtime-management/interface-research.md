# X01-06 / WPF-001-05：运行时插件设置接口提案

状态：READ_ONLY / NOT_CREATED / NOT_TAKEN / NOT_RUN。仅自有 TMP 产物，无项目修改、领取、CLI、Node 工程检查、HTTP、PG、Chrome、安装或服务操作。固定主线 `6aa2d42e96c33b73e511e69e2984b5279ce4eb7e`；共享客户端实现 `9f5d61a10504536f43adca28096878eb71d7fa52`，交付树 `a85fa4cf0d1efe3ea8f7e0d28f27d067f21e5e0b`（本次前后观察 clean）。后者已交付不等于已 main；本固定主线尚无新 plugin-management.ts。完整字节 SHA、输入、技能固定在 pins.json，20 个固定源版本、19 个独立路径；未重做旧九源完整审查。

## 可以立即收敛的结论

1. 新客户端已经把 enable/disable 的 ACK 与精确请求身份固定，可直接复用，不需 Web 自建 codec。旧 `commandPlugin` 的 config/grants 写入仍不具备这套 ACK 校验，首片仅只读展示它们。
2. 首次启用仍缺合法 targetRunnerId 来源。安装回执能给 materialInstallOperationId/storeId/版本/摘要，不能给已获 runtime policy 认可的 Runner；普通 runners 列表、私人配置和上次旧值都不能替代授权来源。
3. 管理视图可随 Settings 关闭/折叠卸载，未决命令不能随之丢失。最小接缝是现有中心连接会话持有一个窄启停 command controller，懒加载视图订阅它。真实接线需要 Recovery 对 App/session 的合法交权；本提案不取得写权。

## 固定源码支持的接口事实

| 源码（固定版本） | 事实与消费限制 |
| --- | --- |
| 主线 PluginManagement.tsx:8–24、47–94、128–134 | 现有 reader 只有 registry 四读；open=false 不挂 ManagementSession，且按 sessionId/projectId 重挂。注册和 Browser extensions 分开合理；“runtime unavailable”是旧硬编码，后继应由独立 runtime 读态替换，不把注册/安装/desiredEnabled 叫 loaded。 |
| 主线 plugin-integration/react.tsx:141–154、160–185 | `open && managementExpanded` 才挂 RegistryManagement，关闭、折叠会销毁整个 lazy 树。现只读行为没有这个写入缺陷；仅未来 mutation 必须处理生命周期。 |
| 主线 App.tsx:361–366、682–704；session.ts:57–75、283–306 | App 已用绑定 closure 提供 client，AppPluginSession 每 client 连接一个 lifetime、公开 signal，dispose 同步 closed/abort。Settings 展开不是 lifetime。beforeunload/离开提示目前只覆盖 steering/attachments 等原风险，插件未决命令不会自动受到其保护。 |
| 主线 use-read.ts:3–18 | 只读 load、AbortController、retry 重读；保留旧 data 并标 pending/error。不得将 POST 塞进此 loader，也不得以读重试创建命令。 |
| 客户端 9f5d index.ts:532–562，plugin-management.ts:5–19、33–76 | commandPluginRuntime 先公共 schema.parse，再固化请求 path/key/JSON body，ACK 校验原输入、revision、operation、exact runtime tuple。typed 中心 4xx 保留 FlowApiError；其他传输/坏 ACK 进入 UnknownPluginAcknowledgementError。无自动重试。 |
| 客户端 9f5d index.ts:515–526、568–569 | material reads 可复用；旧 commandPlugin 只是泛型 request。不得把运行时 ACK decoder 套用到 config/grants。material read 的 TypeScript 返回类型本身不是新的运行时校验保证。 |
| 主线 contracts/plugin-runtime.ts:34–40、69–81 | enable 必须完整 materialInstallOperationId/targetRunnerId/storeId + expectedRevision/reason；disable 不猜这些参数。视图有 desiredEnabled/bindingAllowed/reason，loaded/callable 明确 unknown；disabled 的 tuple 是 null。 |
| 主线 contracts/plugin-installations.ts:15–23 | 安装身份有 registration/version/admittedRevision/store/operation/artifact/treeDigest/API major，无 runnerId；安装成功不证明运行时已加载。 |
| 主线 plugin-runtime-configuration.ts:5–16；main.ts:12–24；index.ts:183；routes.ts:39–55 | 已有操作员 startup policy 输入，缺 policy 不挂 runtime routes；不是公开 host 目录。不能读私人配置给 Web，也不能从源码存在推断当前服务启用。404/坏读应展示 unavailable/unknown，不能合成为 desiredEnabled=false。 |
| 主线 plugin-runtime/commands.ts:16–57、101；store.ts:29–72 | 中心做 revision/config/grant/material/精确 host policy 校验。409 plugin_revision_conflict 并不附真实 currentRevision；另读才能得新 revision。disable 阻止新绑定，不代表取消已运行工作/撤销旧任务能力。 |

### 一个容易误用的客户端异常

`pluginRuntime` GET 也经过 pluginAcknowledgement，读错可能同样是 `plugin_ack_unknown`，但没有 request.key/body。消费端必须按自己发起的操作和冻结命令身份分类：读失败仍是读失败，不能生成未决写；schema/空 key 在 HTTP 前失败，不能写成“已发送、结果未知”。只有已发起的 write attempt 与其匹配 request 才能进入 UNKNOWN。typed 409 保稿，刷新现状不会自动重发，也不证明此前未知写未发生。

## 推荐最小 Interface 与生命周期

**只读展示**：保留原 PluginRegistryReader，不迫使当前 App 调用者立刻改写；增加单独可选、显式绑定的 runtime read port（pluginRuntime、pluginMaterialInstalls、按需 pluginMaterialInstall）。无 port 显示能力未接入，无假默认、无写按钮。首屏显示“期望启用/停用”“当前允许新绑定/原因”；展开可见 registration、version、current/enabled revision、material operation、store、摘要等精确身份。旧 config/grants 与 Browser extensions 各自明确来源。loaded/callable 继续未知，展示的 ready 不是下一次写入授权。

**窄命令模块**：候选 `runtime-command.ts` 仅管理该会话的一份未决 enable/disable；不增加通用队列、磁盘状态库或第二 transport。Interface 是 subscribe/getSnapshot、显式 submit、显式 retryOriginal、risk/protection 与 dispose；公共 DTO/ACK 继续由固定客户端负责。输入依赖是绑定 closure 与 active session/principal/scope guard，不向 PluginContext、第三方扩展或通用 slot 暴露 client/owner command port。

- submit 前同步确认当前会话和选中 registration/scope；公共 schema 校验后固定独立 input、expectedRevision、key 和对应 body，先发布 submitting/single-flight 再调用客户端。不得引用后续可变表单对象；前置失败不标 unknown。
- 只有一次明确用户动作生成 key。关闭 Settings、折叠、换查看项都只卸载视图；同 session 控制器及未知命令不消失。重新打开显示同一身份，零自动 POST；未决时禁新命令。安装选择/409 草稿由此有限控制器保留，不建另一份 authority。
- typed 409 显示冲突并保留原草稿，允许独立刷新现状；不得用新 revision 自动重基并重发。用户重新确认才构造新命令。其他 typed 拒绝与 UNKNOWN 区分。
- UNKNOWN 冻结原身份；retryOriginal 只重发同公共 input/key，由固定公共 schema 得相同 body，不读当前控件重新拼。GET 成功只更新观察，不清除未知命令、不宣布它从未执行。测试必须实际比对发送字节/key。
- late ACK 先核 session epoch 与原 attempt；旧连接/项目不得覆盖新 view。真实 session 结束前，复用 App 的离开风险提示/确认机制明确丢失本地重试身份，不能静默 dispose。确认结束时撤销写入能力并 abort；abort 不等于中心取消。旧回调不能借新会话授权重试。是否跨整页重载保留不在首片承诺范围；不要暗示持久恢复已实现。
- 在 `apps/web/src/plugin-integration/session.ts` 持有模块并由 signal/closed 管理，最贴合已有 lifetime；组件本地 useState 或 RegistryManagement useMemo 都不能替代它。

## 给原 db owner 的一次接口问题（经 root/Mika 转交）

固定 9f5d 已足够消费启停 ACK；请一次明确以下剩余约定，不要求 Web 自行改共享 contract：

1. **首 enable 的 runner 来源**：是否已有/准备提供 owner 可读、与 runtime policy 和 host 实际发布相同来源的 exact host tuple 目录？若不提供，是否正式选择由操作员显式输入已知 Runner UUID 的产品路径，如何给出其合法出处/错误提示？目前只可保留启用不可用原因，不默认选 runners()[0]、安装记录猜 runner 或读 FLOW_PLUGIN_RUNTIME_CONFIG。store/material 可以来自当前 registration/version 的已安装回执，但不能补足 runner。
2. **共享交付与延后范围**：确认 9f5d 的合法主线集成/供给 target；config/grants 首片仅只读，写入待其 ACK codec 独立固定。无需为本片添加 Web 专属 DTO、SDK 或通用 mutation wrapper。
3. **会话接缝确认**：中心/客户端是否确认“unknown 的唯一恢复动作是原 key/body 显式重发；当前 GET 非原命令结果查询”的现语义？现源码如此，Web 将把身份保留在连接 session，关闭设置不影响；真正离开连接需明确风险确认。后端不应要求 Web 从另一个 read 的同名 error.code 推断 write authority。

## 最窄 candidate scopes 与交权

`scope-proposal.json` 列精确 literal；全部 NOT_TAKEN。候选树/分支 `web-plugin-runtime-management` / `codex/web-plugin-runtime-management`，任务沿原 X01-06/WPF-001-05。供给基线须是包含已审客户端 9f5d 的固定组合或合法 exact source receipt，本研究不自行 merge/provision。

- **可先独立收的只读组件片：5 literals**：PluginManagement.tsx；既有 `test/plugin-management/fixture/main.tsx`、`test/plugin-management/browser.ts`；own plan/evidence 两目录。保旧 reader 向后兼容，额外 port 仅 fixture 绑定；没有 App 接线不能称用户真实 Settings 已完成。
- **同一任务后继命令组件片：7 literals（替代前项，非叠加新 task）**：以上 + 新 `src/plugin-management/runtime-command.ts`、`test/plugin-runtime-command.test.ts`。前置条件为首次 runner 产品路径有明确答复；测试使用真实公共 client/helper，不能用另一个假 ACK decoder 自证。
- **真实 App 接线另需交权的 5 literals**：App.tsx、plugin-integration/session.ts、plugin-integration/react.tsx、test/plugin-management-integration.fixture.ts、test/plugin-management-integration.browser.ts。前两项目前 Recovery 持有；需要 STOP→当前 version amend/release→新 take。其余也须 fresh conflictcheck；这份候选不声称现权属已空。既有 integration fixture 才覆盖真实 Settings lazy mount，独立 PluginManagement fixture 不等于该宿主。

不申请 CSS、use-read、公共 client/contracts/server、锁文件、共享配置、依赖或 Browser extension 权限；现有样式先复用。如真实实现需改一个额外 literal，届时给具体用途再协调，不 wildcard 扩目录。

## 必要验证（仅建议，未运行）

1. 只读实际 GET：缺 policy/404、unknown/ready/changed revision、材料回执缺 runner、已安装但未 enabled 均诚实；读重试只 GET，私有配置不可达；中心与本地 Browser extensions 状态不互相替代。
2. 窄 controller 真实公共 client：前置 schema 失败零 POST；typed 409 保原 draft；坏 ACK/断连/abort 保原 key/body，显式重试精确相等且 single-flight；GET 相同 error.code 不产生 write unknown。
3. 挂载真实 PluginSettings：发送后关 Settings/折叠再开，不新 key/POST；同 session 同 identity；换 registration/project 后未决命令仍可发现；旧会话 late ACK 不污染新会话；真正离开用现有 protection 窄扩展明确确认。
4. 390 双主题、键盘/focus、长版本/身份换行，错误原因及启停按钮可达；启停不声称取消已有 task。不得继承 db owner 18 tests 或旧 X03 browser 为新片 PASS。

## 方法与未证事项

复用本地 find-skills 发现法、codebase-design、clean-code；版本以 pins.json 的本地 SKILL.md SHA 固定，不安装、不推断全局上游 commit。实际应用：把请求身份收敛在单 session 模块；只读与写错分层；复用公共 decoder；删除新通用 outbox/第二 authority 的必要性。所有源码判断来自固定 Git 对象，不是服务观测。当前只证明消费接缝和缺口，未证明真实部署 runtime routes/hosts 已启用，也没有批准实施、运行或新的 claim。
