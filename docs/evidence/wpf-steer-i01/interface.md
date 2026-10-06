# Steering App/P01 接线界面

固定依赖：base `df29fb511df029a0922ace0f4973f3fe3736e502`，已审控件 `b2cbbca5f823e122ec4e234e16fb7ef45a063af9`。该片实现 `5cfebc639d7acd458d27f4543d00a32a9fd96fc7`；保护 `conversation-steering/control.ts` / `SteeringControl.tsx` / CSS，未修改其公共接口。

## 唯一生命周期和身份

`AppPluginSession.steering` 是当前连接的组合 owner，复用 P01 `flow.conversation-steering` 启用/禁用和 `chat.message.footer` panel。仅当前 running turn 的真实 user anchor 提供 `Guide running task`；有既存绑定的旧 turn 显示 `Steering receipts`。普通 Send / Queue 使用原 composer/runtime，Ctrl/Meta+Shift+Enter 不会偷偷发送成 steering。

私有 `SteeringPorts` 的 `allowed(identity, read|write)`、`admission`、`state`、`accept` 只授予 App-owned host，插件不能拿到 client/token。identity 精确含 connectionScope / stable viewKey / conversationId / turnId / user messageId / taskId。端口前后校验实际 projection 成员和该 view 可见/online，不依赖全局 focused task。manifest 声明不授予权限；App 当前显式 trusted owner-connection 策略对本连接真实任务授予读写，两个 mode 在边界上独立复核，直接测试只读能 GET 而不能 POST。中心 admission/POST 另行决定安装、支持、attempt/owner/revision 与实际权限，P01 active 不等于 server ready。已有 conversation.capabilities.steer=false 不伪改为 true；本片消费已公开独立 task steering endpoints。

写入路径为控件→已有 P01 command→私有 pending handoff→raw HTTP。command 不再次调用同一控件 accept port；未经控件创建的 pending key 不可伪造 raw write。初次错误保留 `FlowApiError` 身份，everUnknown 的原 key/body 重试语义沿既有控件；已结束 turn 禁止新指令但保留原 receipt 重试。任务在 digest 等待期间结束会切 gate 代际，尚未交付的文本不会发出。

## 稳定界面、预算和离开

每连接最多八个显式打开的 task/view 绑定；不为历史每条消息创建 controller 或定时器，不 LRU 丢 unknown。原控件自身八 receipts / 四 attempts / 每 attempt64 commands 不变。`SteeringSurfaces` 在可移动 groups 外，visited 控件一直保持同一 React identity，原组件内部 draft 不移到第二状态仓库；同时只打开一个 surface，切到另一任务仅隐藏旧 surface。注册零 HTTP；显式打开读取 admission/已加载 metadata。控件原提交/失败后的单次有界刷新保留，无额外轮询；恢复可见或重新授权不自动读/重发，用户 Refresh 才读取。

实际 App 使用 native hidden，由 App 已有 visible 经 Thread 显式传入；hidden/offline/plugin disable/write revoke 切代际并 abort observation。隐藏不是 center cancel。split 两可见 pane 按自身身份都可打开。session.dispose 先同步 closed/abort/manager.dispose，再 await host.dispose。关闭 view 或换连接的 preparing/sending/unknown/accepted未resolved 都先用现有 Dialog 警告：本页原 key 恢复将丢失，中心可能已执行，用户可保留页面；确认才丢该 view/连接。beforeunload 仅浏览器尽力提示，不保证reload/崩溃恢复，也不新建storage协议。关闭其他 view 不丢当前 draft。

控件 Accepted / Received / Consumption observed 均为中心/runner事实，不证明模型服从。只做 HTTP fixture，不调用实际 provider。
