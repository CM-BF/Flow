# Late Logout response — Recovery TODO06

原WPF-MATURE-06下WPF-CONNECTION01后继；原239b树/branch延续，3产品preimage与固定main c13042ba逐字相同，原7域源无差。旧22不同分轮证据保持历史。

Logout只在原Origin/CSRF/有效session校验后撤销cookie请求中该tokenHash+cookieOrigin+authEpoch，成功仍unauthenticated，不发Set-Cookie。无效HttpOnly Cookie可残留至原期限或下一Connect覆盖，但GET无法恢复其身份、写/stream拒绝；任务不cancel。新Connect发Cookie/32容量/expiry/跨origin约束不变，store/DTO/SQL/SSE循环不修改。服务端不接管Web忽略旧响应的生命周期。

fixture新增可选beforeLogoutResponse，onSend仅成功logout响应等门；生产未注入此钩子。真实HTTP先连接A/开SSE，撤销A并hold其响应，再连接B，最后释放旧响应；核无删除头、B读写成功、A读/写失效、旧SSE关闭且任务仍running。此header与store组合不是新浏览器矩阵。

本片准确5scope见take-receipt。3产品=index.ts/session.test.ts/fixture.ts；own plan/evidence。已安装Node24/pnpm9.15.4/Vitest4.0.18/pg8.23.1复用，不安装，不改6c/SVC或个人服务。局部focused types先行；PG需Lead实际窗口，拟4selected（新race+原logout+原SSElogout单variant+Origin/CSRF），不重跑旧22。原fixture只28迁移旧基线，不能称现全server35的组合验收；main集成负责必要当前消费者。

预算120swork+30cleanup，总150；raw2MiB/private16MiB，0provider/browser/个人。复用OPS14及OPS-METER，own随机DB/marker/动态loopback端口；unknown停止KEEP不forceDrop，sharedPG连接/资源fresh后才运行。
