# WPF-CONNECTION01 中心浏览器连接会话

状态：completed（中心子片）；创建2026-10-06，更新2026-10-07；owner native_center_owner / gpt-6-astra，co-lead ExecutionLead。所属大task：[WPF-MATURE-06](../../../web-platform-management/plans/wpf-mature-06-chat/plan.md)，对应06-04；非新大task。遵循[模块规则](../../AGENTS.md#modular-design)。

中心拥有持久随机center/principal、有限Cookie会话与HTTP/SSE统一鉴权；readSession/connect/logout只处理连接，logout不cancel。默认未配置unsupported，旧Bearer owner/runner保持。migration028已Lead预留，无共享index/client/export写权。

- [x] **WPF-CONNECTION01-01** 原子claim、技能、首DTO/Interface及计划。
- [x] **WPF-CONNECTION01-02** migration/store/统一auth及生命周期路由/SSE窄authorize。
- [x] **WPF-CONNECTION01-03** 真HTTP/隔离PG的恢复、轮换/到期、Origin/CSRF、多中心与SSE撤销、旧Bearer直接消费者。
- [x] **WPF-CONNECTION01-04** 固定原始证据/独立review/main受控挂载。

详细输入输出与限制见[Interface](../../docs/evidence/wpf-connection-session/interface.md)。Web真实浏览器与Recovery后继分开，0provider/不触个人61227/61228。固定source与当前分支验证不代表生产已挂载。

## Recovery TODO06 后继：迟到 Logout

- [x] **WPF-CONNECTION01-05** 精确撤销旧会话且迟到响应不删除新Cookie；4selected与focused types后独审/main。

实际续接 2026-10-07T11:33:16.858479+00:00；新claim已take，旧四TODO已main不重开。详见[本片Interface](../../docs/evidence/wpf-connection-session/late-logout/interface.md)。

2026-10-07T11:46:00.003450+00:00：TODO05中心修复与限定直接验证已独审并main7272，见[回执](../../docs/evidence/wpf-connection-session/late-logout/main-receipt.json)。本计划中心子片完成，不替代WPF-MATURE-06完整浏览器恢复验收或个人部署。
