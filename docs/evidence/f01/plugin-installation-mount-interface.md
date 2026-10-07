# F01 X01 production 接线

2026-10-06。固定输入：domain a578bfd、thin client 67fd459（独审中）。本段只消费已发布领域接口，不另写安装状态机。

| 模块 | 唯一职责与 Interface |
| --- | --- |
| private-json-configuration | 两个真实本机配置消费者复用绝对路径、owned 0600 regular/NOFOLLOW/NONBLOCK、65,536B+1、strict UTF8 读取；返回 unknown，领域各自校验，不外露正文。 |
| plugin-installation-configuration | 严格 `artifactStore:{root,storeId}` 与 `materialStore:{root,storeId,allowedDigests}`，最多512个sha256；不接受 URL/token/回调；缺省关闭，非法启动失败。 |
| server factory | 029 在023/008后、任何worker/scheduler前；仅trusted `pluginInstallHost` 注册原owner routes；原domain负责关闭/请求取消与真实FS结算。 |
| CLI | 五条小命令 install/installs/install-show/install-history/install-change → strict bounded DTO → 原client，必须原stable key；202只表示原受理receipt。 |

`FLOW_PLUGIN_INSTALL_CONFIG` 仅可信host启动入口。不给HTTP/body注入路径/allowlist，不伪造 `executionSettled`；缺失真实停止证明的reconcile沿领域unknown。静态installed不等于enabled/loaded/callable。默认个人配置不改、无启动安装、无新循环。

验证：既有fetch配置直接消费者与新配置边界；CLI真实HTTP只验映射/拒绝/abort；实际生产factory一随机DB，默认路由缺省、029、owner/runner角色、真实fetch+静态安装+restart receipt/懒历史。PG先fresh资源与Web窗口协调；不重跑领域14例/容量/模型。0 provider。

方法：本地find-skills、codebase-design、clean-code（已读）用于两真实消费者共享reader、小接口、严格边界与资源释放；不安装技能。有限设计已沿F01-41授权，不新增审批层。
