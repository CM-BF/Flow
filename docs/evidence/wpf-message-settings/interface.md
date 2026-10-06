# WPF-MESSAGESETTINGS01 Interface

## 能力与状态所有权

`createMessageSettingsCatalog(reader)` 接受真实 `FlowClient.claudeMessageSettingsProfiles` 的已绑定 closure，例如 `(options, signal) => client.claudeMessageSettingsProfiles(options, signal)`。host 每 connection 拥有一个实例，显式 refresh/loadMore、退出时 dispose；两种目录协议共用私有生命周期，但分开实例/codec，不混缓存。每页请求 20，公共 codec 与严格升序/cursor 检查全页后才发布；错误保留原页面且 stale，refresh 取消旧页并 fencing 晚结果。旧 read-only creation Interface 未变。

`MessageSettingsPicker` 是受控 value/onChange 展示，仅拥有 Dialog 打开状态。选择始终是公共完整 tuple；没有第二草稿仓库/命令/授权 registry。首屏中文显示模型、思考/力度、速度、不可用原因；技术身份在 details。`details(navigate)` 延续现有 close-auto-focus 回调，先关闭再让宿主动作接管焦点，仅 presentation 接缝。

`MessageSettingsContext` 的 profile/capability 必须由认证会话 owner 供给。公开 IDs、目录存在、可见 UI 都不授予权限。`messageSettingsAvailability` 检查当前可信 capability 协议和指向的完整 profile 三元组、当前已加载非 stale 目录及非空 choices。

`captureMessageSettings(value,catalog,context)` 是同步纯函数，非空值由公共 schema/allowed helper 验完整 tuple，返回 detached 深冻结公共 snapshot。undefined 明确省略，即使旧中心缺能力也保普通兼容；显式 not-requested 不等于省略、重置或继承。拒绝不会清 caller 的 value，host 必须捕获错误保稿。`sameMessageSettings` 沿公共 canonical JSON 比较。

catalog 是 configured policy，不是 provider/account entitlement。无探测、HTTP 重实现、DTO 副本、SDK 升级；公共客户端负责 opt-in header/公共 page parse，leaf 不降级 legacy page。目录和已捕获值不含原文或凭据。

## 真实消费者与后继

本片实际直接消费者是公共 FlowClient HTTP 目录专测和受控 React fixture；源码已准备，均尚未运行。fixture 的 A/B 为纯本地 capture 样本，不是发送/排队回执。旧 ExecutionProfilePicker 锁定分支保留；新 requested.model 不用 creation model 代替。

App/Thread 后继须在用户 click 同步栈捕获 settings+intent/profile/materials/text；准备附件的 await 之后不能重新读取新 UI。已有 outbox/Queue/Recovery 是唯一请求/key/body/持久身份 authority；当前 A、队列 B、后续草稿 C 各自 snapshot。新提交须核当前 conversation profile/cap；重试沿原 frozen body/key，不因目录更新覆盖原值。公共 matcher 处理 ACK，坏 200 为 unknown，不自动重发。

requested/observed 读回另属后继：保真实 nullable/omitted fast/effort 与 init 观测范围，不补造 provider 成功。`message-settings-unsupported` queue 原因必须保留。details 不扩大 PluginHost 权限。

## 运行入口（当前 NOT_RUN）

Direct：`apps/web/test/message-settings.test.ts` + 原 `execution-profiles.test.ts`。必要 noEmit 使用本树公共 source aliases，第三方只读固定 realpaths，禁止 moving @flow/dist。具体依赖指纹见 [proposal](readonly-dependency-proposal.json)。无本树 node_modules 安装/链接。

Browser 文件没有自动 launcher；导出 `startMessageSettingsFixture({cacheDir,aliases})` 与 `checkMessageSettingsPicker(page,fixture,evidence)`。未来获准外层 supervisor 先持有 own scratch/deadline，再创建唯一 Chrome/Page，调用一次检查，finally 独立关闭 browser 与 fixture。Vite configFile=false，缓存必须落 own scratch，aliases 固定本树 @flow source 与已审第三方；不会调用默认实际 registry/center。所有类型、import、HTTP、浏览器运行目前 NOT_RUN。预算与全体 cleanup 由后续明确准入的父 runner 负责，不能直接把导出函数当运行许可。
