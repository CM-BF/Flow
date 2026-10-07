# 固定主线插件真实 App 接线增量（只读）

结论：下一最窄交付是把已存在的中心启停 reader/controller 接到 **真实 App 的管理会话**，不是重建插件 host、加载系统或新的按钮协议。冻结主线 `ae8500dd534a8ba18673a078c8563f4e3c13034e` 的 runtime 五源逐字等 `9f0fe5b2c096a49195ff8060d97584de235785d2`；但真实 Settings 从未传入 `centerRuntime`。独立模块的已审六组/两图不能证明这一真实接线。下述是后继设计输入，不是实现批准或 runtime PASS。

## 已有研究与真正差量

已先读管理 plugin-integration/plugin-system 两迁移入口、10:15 的 `plugin-runtime-web-interface-research.json`、`plugin-settings-followup.json`，并追到权威 I01/P01/runtime 原 plan/status。原研究已明确 lazy view 之外的单命令控制器、原 key/body、会话失效、中心与 Browser extensions 分离；本件不重做这些设计。原“公共 command 尚待发布”已过时：主线 `runtime-command.ts:1–6,62` 已直接消费公有 `FlowClient.commandPluginRuntime`，不需要第二 fetch。runtime plan 的当前片明确排除 App/session；TODO05 是后续任务引用视图，不能把它改名冒充本次真实接线完成。此增量归既有 X01-06 / WPF-001-05 与 I01 App 集成职责，由经理更新原计划，不新增层级。

本树实际类名为 `AppPluginSession`（`plugin-integration/session.ts:58`），并非另一个 PluginWorkspaceSession；复用此唯一连接宿主。

## 固定源码事实与最小接缝

| 事实 | 下一最小改动 / 必须保留 |
| --- | --- |
| `App.tsx:384–389` 只创建四方法 registry，`:913` 只传 registry。`plugin-integration/react.tsx:141–154` lazy mount 只传 session.id/registry/host。`PluginManagement.tsx:12–24,35–43` 已支持可选 centerRuntime，并拒绝 controller.sessionId 不匹配。 | App 提供窄公有 reader/writer 与 live authority；session 持有一个 controller；react wrapper 只透传已有接口。无需修改已 main 的 management UI/controller 五源。 |
| `runtime-command.ts:27–47,80–102` 单未决命令、冻结 key/body、显式 retry 与不可逆 revoke 已存在；`:60–74` 在 await 后重验 authority；`:111–121` 阻止旧 GET 覆盖 ACK。独立 fixture `test/plugin-management/fixture/main.tsx:47–72,96,106–107` 已在 lazy view 外持有/销毁，但那是合成 sessionEpoch。 | 关闭 Settings、折叠、切 registration/task 不销毁或重建 controller，也不自动重发。sending/unknown 原命令仍保留；初始409和 unknown retry409继续沿原区分。不要把 useRead.retry 当写重试。 |
| `App.tsx:815–822` AppPluginSession 只随 client 更换；`:379–381` 才是 live authorized 判断；`:1293` 可保留 hidden Workspace。`connection/session.ts:39–40,46–70,120–126` 同 baseURL 的失效/重新认证也会改变权限 generation。 | controller 不能仅凭“session对象没dispose”授权。窄 authority 必须读当前 namespace/principal/generation、active/authorized 和 session.signal；凭据不进入插件。权限失效主动 revoke/abort，晚 ACK 不更新新会话；重新授权创建新 command lifetime，不能复活已 revoke 的旧命令。新 controller 仍在 session/host authority 层，不置于 disclosure 内。 |

最小生产 literal 为 `apps/web/src/App.tsx`、`apps/web/src/plugin-integration/session.ts`、`apps/web/src/plugin-integration/react.tsx`。App 私有 actions 可接窄端口，session 管理生命周期并由 updateActions 读最新 authority；不把完整 FlowClient、token 或任意存储交 PluginContext。具体实现应沿既有生命周期，而非再设 session/store/FSM。

## 卸载、草稿和 pending 的区别

1. **中心停用不等本地 UI 卸载。** `PluginManagement.tsx:85–111,147–207` 显示中心 desiredEnabled/bindingAllowed，loaded/callable 仍 unknown；`react.tsx:174–178` 的本地 Enable/Disable 直接操作 host。即使 registration 名同 sample.notes，中心 ACK 也不能调用 host.deactivate、清 materials 或声称已取消运行任务。公有安装身份/手工精确 runner UUID 是现有高级入口，不在本片另造 host discovery。
2. **本地 disable 是 generation/能力撤销，不能顺手销毁草稿。** `plugins/host.ts:182–207` 同步撤销 session、abort 并清贡献/命令；register 返回 disposable 在 `:116–123` 才移除注册。`ConversationAttachments` 在 `plugin-integration/attachments.tsx:104–105,125–134` 订阅 host，通过 lease/readiness 取消访问；controller `attachments/controller.ts:127–145` 保留 items，把已发送上传标 unknown，不 DELETE 资源。重新 enable 不自动上传/发送，须显式恢复原请求。
3. **最终 App dispose 是另一条破坏性本地释放。** `session.ts:215–238` 先检查 recovery/附件/知识/Steer protection；`:328–346` 终态才释放 bindings 和 host。`attachments.tsx:274–284` 明确保护 pending/unknown/held submission，dispose 会清本地 input。App `:564–607,838–847,852` 保留关闭/换中心的保护与 flush。接 runtime controller 时只增其 revoke，不以“清理新插件命令”为由调用 releaseView/dispose、丢现稿，或将 center disable 映成整个 session.dispose。
4. **真实 pending 写的本地 abort 不证明服务器取消。** 断连后的 controller 应保持 revoked/原命令身份及诚实未知说明，不在新中心重试旧 key。只关闭管理面板时则仍在同 session 保存 unknown，用户重新打开才可原命令 retry。跨断连持久化中心命令不是本片既有承诺，不偷偷加第二 journal。

以上为可复用实现与需验不变量；本轮没有复现某个卸载丢稿 bug。MSG03 的材料 A/B/显式 Restore 后继尚未 actual 通过，不能把主线旧附件逻辑或其受控测试外推成该新功能已完成。

## “所有组件可插拔 / 随时加按钮”的当前可用边界

`plugins/types.ts:7–64` 已有 typed ResourceContext、权限和16个具名 slots；`plugin-integration/react.tsx:108–122` 把真实 task/message/composer 身份传入，`session.ts:130–151` 注册可信本地定义。新增授权按钮应声明 contribution/command/activation，使用现 slot 和 HostPort；`host.ts:89–125,327–355` 做注册/重复ID/授权/禁用检查。中心安装/启用记录不会自动转换为浏览器代码、贡献或权限。当前不是任意第三方 URL/npm 执行沙箱、任意 DOM 插入或所有组件任意替换；不能用本次接线消除这些诚实边界，也无需为管理启停新造 slot。

## 所需交权与验收

三生产 literal **当前全部在 MSG03 7e3f v2 exact19**（13:43:37.884Z 自身合法观察，现 STOP 但未 release）。不能因停写/主线已更新直接覆盖；经理需选择同 owner 合法串行并整合 MSG03 的增量，或旧 owner STOP→当前 version amend 移出→新 owner fresh take。冻结 ae8500 与 MSG03 6a 不是同一组合，后继不得用此旧基线覆盖 MSG03 私有 port/restore 修复。拟测试 exact literal：

- `apps/web/test/plugin-integration.test.ts`：现真实 AppPluginSession 实例及迟到命令/activation 用例（79–101），补管理 controller lifetime/同 baseURL 权限变化。
- `apps/web/test/plugin-management-integration.browser.ts` 和 `apps/web/test/plugin-management-integration.fixture.ts`：现真实 App 的 lazy/本地与中心分离/换中心入口，补公有 runtime 读写。旧 launcher 不等未来安全执行包，实际资源/隔离需原 owner 有界供给。

这三个测试路径及其他 writer 冲突本轮未 fresh 查询，必须经理在正式派工时核；不假称空闲。已 main module 五源、`plugins/host.ts`、attachments controller/core 当前只读消费，不纳初始写范围。

最小行为验收（未来一次固定实现审后按合法有限段执行）：

- 真实 App 首次展开可读中心 runtime；未显式操作0写。关闭/重开 Settings、折叠或切 registration 时一个 unresolved command 保持原 key/body；401/409/unknown/明确retry结果按现 controller 语义呈现。
- pending/unknown 期间切中心或同址权限失效，旧 controller abort/revoke；忽略 abort 的迟到响应不能改新会话，无自动重发。真实 ConnectionSession 的实际路径与受控 ignore-abort 对照分开记录。
- 本地插件 disable/enable 与中心启停互不冒充；当前正文、已选有序文件/知识、材料准备/unknown 上传、已冻结 Send/Queue/Steer receipt 不被管理面板开关或中心 ACK 清空。本地权限撤回保材料/原 key，explicit retry 后才继续。
- 真实键盘开关/回焦点和390双主题观察 pending/unknown/revoked；关闭页面不冒取消中心工作。模块原六组不全部重跑，追加真正 App 接线受影响用例。

## 方法与限制

复用本地 find-skills、clean-code、codebase-design；assistant-ui 只用已读层次参考，本次坚持固定源码、不联网追版本。实践：复用窄深模块/原 command authority，拒绝第二 transport、store、host 或清理框架；分离宣告能力、当前授权与真实执行。19固定源码/test输入 + 9既有计划/研究输入，完整 hashes/blobs 见 `pins.json`（约409KB）；五源主线逐字核对见 `main-five-comparison.json`。0项目修改/Node/import/tests/HTTP/PG/Chrome/真实env/资源采样；仅本 TMP。Original1347窗口不被本研究占用。MSG03 exact19继续STOP/NO_NEXT。
