# WPF-PROFILE01 模块 Interface（实现前冻结）

输入：固定公共合同 / client 4e0289f29ffa48c6c49003837d4520f57c22b6b0。接入 owner 已确认此拆分；App 接入另行领取。

- `src/execution-profiles/catalog.ts`：`createExecutionProfileCatalog(port: Pick<FlowClient, "executionProfiles">)` 返回 `getSnapshot/subscribe/refresh/loadMore/dispose`。snapshot 为不可变 `profiles/nextCursor/loading/error/loaded/stale/canLoadMore`。每 connection 创建一个实例并在断开/换中心时 dispose。refresh abort 旧请求并原子替换目录；在途/失败保留旧页并标陈旧。loadMore 失败保留旧页/游标可重试。401 同样保留只读旧声明并标陈旧，不能选择新 profile。迟到结果不复活。方法处理错误到 snapshot，不产生 unhandled rejection。
- `selection.ts`：`ProfileSelection` 为显式 `legacy-default` 或 `configured`（完整 profile）；`configuredSelection`、`legacyDefaultSelection`、`freezeConversationCreation(title, selection)`；后者 schema 校验并深冻完整 `ConversationCreation`，包含 ref 及 requested。无 HTTP/key。`assertCreationReceiptMatches(expectedCreation, receivedSummary)` 核 title/harness/requested 和 pin 有无及所有字段，错误抛 Error。必须用 outbox 已冻结输入核 ACK，不从后来 catalog/selection 重建。
- `ExecutionProfilePicker.tsx`：受控 `catalog` snapshot、`selection`、`onSelect`、`onRefresh`、`onLoadMore`，可选 `locked={creation:ConversationCreation,reason:'created'|'receipt-pending'}`。locked 优先显示冻结输入；即使未知 ACK 无 summary 也锁定。refresh 不自动改变 selection；不存在/陈旧选择明确提示，不静默替代。UI 不发送/创建/重试命令。

控件选整份 runner-configured profile。默认旧兼容项是显式 unpinned runner-default / disabled / configured-readonly。configured requested 精确取 config.model、disabled、config.access。provider availability 始终 not-probed，模型 resolved/effective 未知；不从 runner/profile 声明推在线。配置在 CREATE 时 pin，非首 turn；无 effort/thinking 热切换。需要消除 catalog 陈旧与 create 竞争由中心 admission 再验证完整 ref，UI 不保证准入。

新模块直接按上述文件导入，不新增 barrel。既有 App/outbox 持有 lifecycle/key/draft；未来接线必须保持新草稿不被旧 ACK 覆盖及 center epoch 隔离。


消费接缝确认（2026-10-06 04:41 UTC）：Picker 无 mount 请求，初次 catalog.refresh 由调用者明确执行；locked 无目录依赖。刷新成功只加载第一页，选择项不在 loaded profiles 只表示“尚未在已加载页确认”，不能推全目录删除。消费端新 configured CREATE 应同步核 loaded、非 stale、所选 ref 在当前已读页完整确认；旧 default 不冒充在线。未知 CREATE ACK 的相同 key/body retry 绕开目录门禁；已知 CREATE 成功后即使首 turn 失败仍锁 created。若现 outbox 再次 schema.parse，解析会产生新对象，必须由接入 owner 再深冻 executionProfile/requested；本 helper 不保证跨后续 parse 的对象仍冻结。

`canLoadMore` 表示当前可执行分页请求：refresh在途/失败后为false（需重试refresh），append失败保留cursor且true可原页重试，防止看似可点但无操作的分页按钮。
