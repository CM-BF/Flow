# MATURE06-04 中心会话消费者接口补充

2026-10-06 13:04 UTC。来源为 panels 经 root 认可的只读报告：管理 proposal 固定 `ca0ba84c2bc3b7e694939353e3a00659b8570082`，client/watch/streams 固定 `aeb764e5d2c2ec043ae8673cde2724f5330db2ab`。本记录没有实施、实验或服务操作；不是另一份进度源。归原 MATURE06-04，完整设计和 owner 指派见 [既有 proposal](connection-recovery-readonly-proposal.json)。

Lead 已指派 `native_center_owner` 承接候选 `WPF-CONNECTION01`，独立 `browser-connection-session/codex/browser-connection-session`、`plans/wpf-connection-session`，六中心产品 literal 加正式预留 `packages/storage/migrations/028-browser-sessions.sql` 与自身计划/证据；F01 处理 mount/exports/client。尚未收到 COMMITTED receipt，不把候选范围当已领取。Web consumer/Recovery 拟 panels，须 ATTACHI02 main/release 后另取合法范围。所有实现子task直接归 MATURE06。

Lead 设计语义为绝对 8 小时、GET 不续期、32 有效 session 满额拒新不踢旧；随机 center/principal 同 DB 持久，owner token 轮换推进 epoch 并撤销旧 cookie。配置明确 trusted Origin、Origin 绑定和 mutation CSRF；非法 Bearer 不回退 cookie。SameSite/HttpOnly/每中心 cookie 名不构成端口隔离。以下六项是固定 DTO 前必须明确的消费者接口，尚非已实现能力。

1. **稳定身份与代际。** 成功 DTO 建议必要字段 centerId、ownerPrincipalId、非授权凭据 sessionRef、authEpoch、boundOrigin、issuedAt、expiresAt、serverTime，并明确 CSRF 获取方式；cookie secret 不公开。durable namespace 用中心地址＋centerId＋principal；sessionRef/authEpoch 只隔离认证代际，不进入持久恢复 namespace，避免同 owner 换 token 后原收据不可达。
2. **无 token 刷新。** readSession 不新建 session、不续期；刷新/新 tab 先读它，认证确认前不 hydrate 私有草稿。F01 明确 Bearer/cookie 两模式；cookie 模式完全省略 Authorization，不能发送 Bearer undefined 或旧 token。HTTP 与 watch 共用 credentials 策略。connect 后必须 cookie-only read 确认浏览器确实接收 cookie；credentials:include 不绕过 SameSite。来源为 panels 已读 [MDN Fetch credentials](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#including_credentials)。
3. **Origin 绑定。** 同源 GET/HEAD 通常没有 Origin，JS 不能手填该 forbidden header。中心须明确受信同源/代理读取的安全判定，不能一律拒绝或把缺 Origin 直接当授权。另一个获准 Origin 显式 connect 替换 cookie 后，旧 Origin 应明确 blocked，不能循环重连。来源为 panels 已读 [MDN Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin)。
4. **失败语义。** 区分 session missing、可识别的 expired/revoked、origin-forbidden、session-limit、旧中心 unsupported。浏览器已删除 cookie 时仅能确认 missing，不伪称服务端知道 expired。资源 403 不自动清整个登录；离线/EOF 不等于过期。全部保原 unknown 命令，重新认证后零自动 mutation。
5. **SSE。** 当前 watch 将每个 data 当 EventPage，不能混入未适配认证对象。最小方案为中心授权失效关流，consumer 异常结束后一次 readSession：auth blocked 停重连，网络问题仅恢复观察并保原 cursor。中心核首帧及后续发布权限；session metadata 刷新不拆健康流。
6. **32 session 与多 tab。** 固定计数域和过期释放规则；刷新/新 tab 不占新槽。建议有效同身份 cookie 重复 connect 复用且不延长原 8 小时；connect 丢 ACK 先 cookie-only read，避免盲建占槽。满额不踢旧、不清有效 cookie。logout(expectedSessionRef) 或等价校验防旧 tab 晚到撤新 session；同 cookie 各 tab 共享退出，只停观察、不 cancel task、不删 journal。BroadcastChannel 仅触发重新核验，不授身份。

不扩展账户 CRUD、会话管理页面或第二命令 authority。现 upload journal 单 namespace read→JSON→write 无跨 tab CAS、RecoveryPicker 未认证 metadata 展示是独立缺口，不能由新 session/send journal 支持推定已修。4 MiB/32 draft/128 command 仍为待完整序列化和状态增长预算审定的恢复容量候选，不与中心 32 有效 session 配额混同。

## 迟到注销响应补充（panels/root规范推演，未浏览器复现）

expectedSessionRef只能限制服务端撤销目标：A已撤销S1，但B的connect先用同名/domain/path设置S2，A迟到的clearCookie或过期Set-Cookie仍可能让浏览器清掉S2；JS epoch也无法拦浏览器处理响应头。最小候选为logout只撤销指定session，不在logout/read/error中无条件clearCookie；保留的旧cookie仅是失效标识，下次read明确revoked/missing，显式connect覆盖。此项须中心owner冻结，不是现实现已验证保证；不能推为任意connect响应乱序已解决，仍以cookie-only read核最终实际身份。

来源为panels只读规范核对：[RFC6265并发Set-Cookie](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.1)、[cookie存储算法](https://www.rfc-editor.org/rfc/rfc6265.html#section-5.3)、[MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)。固定aeb公开client index:38–53/545–551强制Bearer，514–537的watch独立Bearer并将data当EventPage；该固定代码尚无session协议，不能声称竞态已解决。

## 首个固定 DTO 输入（13:08 root 实读回传，字段建议按此收敛）

已收到中心固定 `31824d831ef72b331459d568301371bb037d9734`，权威入口为 browser-connection-session 的 `docs/evidence/wpf-connection-session/interface.md` 与 `packages/contracts/src/browser-session.ts`。root实际读取后报告：ready字段为centerId/ownerPrincipalId/expiresAt/csrfToken；安全同源GET无Origin采用Sec-Fetch-Site:same-origin＋明确配置scheme/Host且不信Forwarded，cookie-only read不创建/续期，全DB singleton32上限明确。本管理仅归因记录，没有新运行或审查。

上方六项保持语义目标，不机械要求新增每个字段：csrfToken若按cookie派生，可等价绑定旧tab意图而省sessionRef；generation可以宿主私有local实现。固定logout目前空body＋Cookie＋CSRF并clearCookie；迟到clear响应仍待中心确认，重复connect行为待补。panels正在针对此固定输入收敛最小delta，不把早期字段建议冒成最终合同或要求扩大账号模型。COMMITTED领取回执仍待正式来源；fixed DTO不等整个中心实现或Web已接通。
