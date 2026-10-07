# ConnectionSession — first fixed Interface

## Public wire

`GET /api/browser-session` → BrowserSessionRead (`flow.browser-session.v1`, ready | unauthenticated | unsupported). ready只含随机持久centerId/ownerPrincipalId、绝对expiresAt和CSRF token；不返回owner token或Cookie。GET不创建/续期/撤销，不派发任务。

`POST /api/browser-session/connect` body `{}`，**显式owner Bearer** +受信Origin → BrowserSessionReady + HttpOnly随机Cookie。无Bearer或runner拒绝；已有Cookie不代替connect身份。最多32个有效session，超额409不驱逐；绝对8小时，无GET滑动续期。

`POST /api/browser-session/logout` body `{}`，有效Cookie+受信Origin+`X-Flow-CSRF` → unauthenticated +清Cookie。只撤销当前连接，不取消任何任务。其他Cookie写请求也要求该CSRF header；浏览器HTTP/watch都使用credentials include。

所有显式非法Authorization在Cookie之前401，合法runner只可访问原/api/runner/。旧无Cookie owner/runner Bearer不要求浏览器Origin/CSRF，行为保持。

## Trusted factory ports (shared owner integration)

- `migrateBrowserSessions(pool): Promise<void>`：固定028；沿原migration锁与transaction。
- `createBrowserSessionAuthentication(pool, { ownerToken, browserSession? }): Promise<BrowserSessionAuthentication>`。browserSession为受信启动配置 `{cookieOrigin, trustedOrigins, authEpoch}`，不从请求推导；未配置保留Bearer auth，readSession为unsupported，connect/logout不可用。
- `registerBrowserSessionRoutes(app, authentication): void`。
- `authentication.authenticate(request): Promise<void>`：供唯一preHandler；健康检查/OPTIONS沿既有例外，readSession允许无会话但非法显式Authorization仍401，connect只owner Bearer；其他请求原角色约束。request.runnerId保持原字段。
- `authentication.authorizeStream(request): Promise<void>`：同一鉴权判断，无新权限FSM；每readcycle及发布前重新核会话有效性，失败关闭stream。
- `authentication.corsOptions`：可选精确allowlist、credentials:true及有限methods/headers；factory以该配置替代原单Origin CORS，不叠两个CORS hook。无任意Origin反射或wildcard。
- `registerStreams(app,pool,authorize?)`：第三参为可注入异步authorize(request)；旧二参消费者行为不改，生产启用本模块时必须传统一port。

## Lifetime / security facts

数据库singleton随机centerId/principal一次生成，restart同DB保留。受信startup authEpoch与owner credential hash绑定；轮换任一使旧Cookie失效，principal不变，旧epoch实例不能重建有效旧session。数据库只存随机Cookie的hash/绑定/expiry，不存owner token或Cookie明文；CSRF为Cookie的域分离hash，仅有效会话读回，不是新身份。

cookieOrigin是中心**精确origin（含端口）**，session/name绑定该origin和随机centerId；入站scheme+Host必须匹配受信配置，不信Forwarded头。Origin必须精确trustedOrigins；同源浏览器无Origin的安全GET仅允许Sec-Fetch-Site:same-origin。写请求必须Origin+CSRF，connect的显式Bearer与Origin是登录CSRF门。

HTTPS cookie使用Secure/HttpOnly/Path=/，SameSite=None允许明确受信跨站origin；仅本地loopback HTTP允许无Secure且SameSite=Strict（跨端口same-site可用，跨站HTTP不支持）。cookie不隔离端口或同UID服务；binding/名称避免误用不能阻止同hostname恶意服务读到Cookie，须受信co-host。无Domain属性，不承诺浏览器第三方Cookie政策必放行。

资源：trustedOrigins最多16，origin/epoch有界；32有效session由singleton事务锁串行创建；清理过期/已撤销记录仅在受信startup/connect/logout命令，不在GET。SSE现250ms单query循环/backpressure/preClose资源保持，初始取数前和每次发布前授权。

## Scope / evidence

DTO与factory ports已实现；本模块自有fixture真实Fastify+HTTP+PG组合，不写共享createServer/index/client出口，不称生产已挂。真实随机DB先身份记录，动态端口，有限自有streams关闭；expiry/revoke、restart同session、invalidBearer+validcookie、runner、Origin/CSRF、多端口/中心、已有SSE失效、0任务cancel/模型；旧Bearer直接消费者。

方法：本地find-skills/codebase-design/clean-code/brainstorming。既有auth/stream调用路径的有界扩展已Lead授权，不重复普通审批。设计对照[MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)与[MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)：credentials、Secure/SameSite和精确origin规则；真实browser行为留给Web验收，不用HTTP模拟冒充。

## Module ownership / composition

| Module | Owns | Dependency / extension |
| --- | --- | --- |
| browser-session DTO | finite wire/limits | client与center复用；无认证状态 |
| store | singleton身份、epoch与32有界session事务 | PG；新cookie发放只能经create，GET纯读 |
| authentication | Bearer/role与cookie/Origin/CSRF单判断 | store；HTTP hook与SSE port用同函数，宿主替换原hook |
| streams | 现观察循环/背压/关闭 | 注入authorize；不拥有登录FSM、不撤销任务 |

生命周期：生产宿主先执行028再打开auth store，再注册唯一hook/routes/stream授权。关闭不创建新observer；expiry/revoke每read与publish前重核。认证端口失败即HTTP拒绝/SSE关闭；没有把响应未收到解释成logout已执行。connect响应丢失可能留下一个至多8h的会话并占32限额，不自动重试/驱逐。health与OPTIONS沿原公开例外，其他被鉴权请求显式非法Authorization无cookie fallback。中心HTTP实例重建和独立Node进程重启均实测；shared生产挂载另审。
