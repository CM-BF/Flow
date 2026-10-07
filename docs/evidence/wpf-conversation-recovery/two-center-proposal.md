# RECOVERY01：真实第二中心 / principal 与 A→B→A 最窄补验

**只读提案，全部新旅程 NOT_RUN。** 固定产品/测试输入 `a80339a463c4a1a1a5a679d9a89ea79b1650340e`，对应已运行 metadata `d06baf3c70cddcb1614088ac2349a1d416d61851`。研究开始观察 d06 的 owner 正在封存 metadata/raw，未触碰 moving 文件；root 随后给出的 seal `8919b89bde85aa63c8a8d79978b201531370c533` 与本报告 11 个固定源逐字无差。读取旧 panels 报告/pins 后只补当前接缝；没有重新审 Steer 全链。2 selected Steer PASS 不等于第二中心通过。

## 推荐：一个 origin、一个 context、一个 base URL、两套真实 DB 身份

沿旧报告“两 DB”结论，把原先两个 base-path 建议进一步收窄为**同一个公开 base URL 下的显式自有代理 A→B→A**。原因：换端口或路径已经换 namespace.baseUrl；即使隔离成功，也无法排除只按地址分区。保持地址恒定，让真实 GET 公共身份的 centerId/principal 实际变化，证据更有区分力。

- 一个现有 Chrome/context/page，不清 IndexedDB/localStorage/cookies，不创建第二 context。页面 origin、配置 Center URL、journal 数据库名都固定。
- 两个 marked test DB，由同一获准 PG 实例管理，不起第二 PG daemon；两套真实 createServer 各连接自己的 DB。各自 ownerToken 由 fixture 内存生成，只通过真实 Connect 表单提交，原 raw 不写 token/cookie/CSRF。
- 一个现有 publicServer + 一套 Vite 实际 App；两个 center 同时配置该唯一 public origin 为 cookieOrigin/trustedOrigins。只给 fixture 一个明确 `switchCenter(A|B)` 测试控制函数，worker 调用，不增加公共 HTTP 管理路由。
- 每个入站请求在接收时固定 targetLabel、switchGeneration 与实际 owned upstream。旧请求永远送原 A，不因之后切 B 而改目的地；切换无 DIRECT/fallback、不转写 Cookie/Authorization/CSRF/响应身份。正常 SSE 仍原流式 pipe/backpressure，不缓存后伪造 SSE。
- 用**真实页面的公共 session response**记录白名单 `protocol/state/centerId/ownerPrincipalId`、request ordinal/当前代理 target；只将这几个公开字段入 raw，不存完整 session JSON。分别确认 A、B 的身份实际不同，回 A 与原 A 完全相同。同一 base URL 是固定 fixture 输入，不从私有对象读 authority。

这是可实现的当前公共链，不要求新增 server/contract 能力。不同数据库初始身份由已有生产 startup 正常生成，不直接 INSERT/UPDATE browser_identity，不拷贝 A 的 DB 或 IDB 来造碰撞。

## 固定源码依据与容易混淆的身份

| 输入/行号 | 可支持的事实 |
| --- | --- |
| journal.ts:4、39–51、190–207 | key 是 `[baseUrl,centerId,ownerPrincipalId]`，路径可保留；list 严格按 tuple 过滤，写入还要 live authorized。 |
| connection/session.ts:39–61、72–100、120–126 | 公共 ready 才有 authority；CSRF/center/principal 改变会提升 authorityGeneration；请求 generation/abort/dispose 拒绝旧完成。方法名实际为 `authorized`。 |
| App.tsx:1223–1294 | 一个 BrowserWorkspace journal；同地址 connect 可得到新身份，retained namespace 不同先 await guard；Workspace 按完整 namespace key；只有显式 connect/read 成功退出 chooser。旧工作区可能暂时 hidden，隐藏不等于可写。 |
| App.tsx:660–673、829–838；binding.tsx:232–259、310–359 | actual restore/command ports 核完整 namespace、当前 generation、active authorization；异步读取前后都核 lease。当前源码应被真实旅程消费，不复制第二套 authority。 |
| server/browser-session/store.ts:19–32 | 每 DB 一次生成随机 center/principal singleton；改 owner token/authEpoch 只撤销 session，不轮换两个身份。 |
| server/browser-session/index.ts:47–68、91–107 | cookieName 由 centerId+cookieOrigin 派生，同公开 origin 两中心使用不同 cookieName；Path=/、HttpOnly，服务只读自己的那一个。Origin/Host/CSRF 仍由真实服务校验，不需代理替换凭据。 |
| contracts/browser-session.ts:8–13；client/index.ts:66–76、581–598 | public ready 提供稳定随机身份，login 后 cookie-only GET；client 真实 fetch、credentials include，写入需当前 CSRF。GET 原件的 CSRF 是秘密，不能整包归档。 |
| fixture.ts:319–465；browser.ts:225–273、487–508 | 当前实际 App fixture 只有一个 DB、center、publicServer/Vite，一个 context。可复用路由/有界 wire/真实认证；双 DB 生命周期尚未实现。 |

区分：同 DB 新端口/新 ownerToken/authEpoch 不是第二身份；另 BrowserContext 会隔离存储，不能证明同 IDB namespace 过滤。A/B 同时改变 centerId 与 principal 只能证明真实两 tuple 的端到端隔离，**不能单独证明 principal 那一维**。 inspected public connect/logout/store 没有“同 centerId 轮换 ownerPrincipalId”的公开入口。该真实单维正例仍需身份 owner 的正式能力；不能写 SQL 冒公开链。

现 direct 使用合成 namespace、受控 session/storage/transport（test.ts:23、79–83、243–246、509–512 等）；它可证明真实函数的控制流，不是两个实际中心/principal。这里未重新运行或继承其数量；也不在未定位对应 case 时宣称已有 principal-only actual PASS。

## 一个最小 selected journey（候选，非运行授权）

复用原 `sameKeyTurn`/draft/Restore helper，不重新跑 Steer、provider、Queue 全链或 completeDraft 全材料矩阵。建议一个 selector `second-center-cycle`，内部报告独立阶段，不把旧 full7/selected2 自动计入。

1. **A 原身份和保留工作**：真实 Connect A，取得公开 tuple A。实际 App 建立一份易识别的当前 draft A；通过原 Send + genuine ACK strict-prefix loss 留一个真实未知 turn receipt A，并保下一稿 A。只读 observer 核实际 IDB 已有记录与 namespace；不得种 records。记录 A 的原 key/body hash/conversation/turn/task（依据真实 ACK），随后阶段按中心标记统计业务 POST。
2. **同地址切到 B**：用户 Change connection 后切代理目标 B，保持 Center URL 完全同值，用 B 自有 token 明确 Connect。公共 cookie-only GET 必须是 B 的两个不同 ID。B 的 visible workspace/recovery list 不展示 A 的文本、receipt、材料身份或 Retry；原 journal 的 A 记录依然存在且 key/body/version 没有被迁移/删除。除显式 login 外，切换和读取零业务 POST，B 后端从未收到 A 原 key/body/资源访问。
3. **B 自有新稿**：用 B 的真实 conversation 或新草稿写一段唯一文本 B，等待真实 journal commit；与 A 共处同一个 IDB。不要用 page.goto(B origin) 或 context.clearCookies。代理记录只泄露 boolean 认证方式与已批准字段。
4. **回 A**：先 Change connection，切代理 A，明确 Connect/公共 GET 再核 tuple 等于最初 A。A recovery 仅列 A，B 记录保留但不可见；显式 Restore A draft 后完整文本/意图保持，零自动业务 POST。显式 Retry A 原 receipt 才重发**原 key/body**到 A；真实 ACK replayed、conversation/turn/task 同原件。下一稿 A 与 B draft 均不被该 ACK 覆盖。若改成 read 自动证明未知命令未发送，判失败。
5. **可选一次 B 只读回看**：若验收要证明 B 可恢复，不额外发送，回 B 显式 Restore B 且 A 不可见。否则只读真实 IDB 保留断言可覆盖“B 未被 A 操作删除”，但不能称 B 的完整 UI Restore 已测。是否纳入应在单 selected group 的固定 expectedChecks 中事先明确，不能临时混算。

同 title 不足以证明身份相同；不要求制造相同 UUID（公开创建 API 随机生成），更不能 SQL 改 ID。必须按 UI 保存后真实记录 id+namespace 定位，不用 first/nth 或 hidden 全局 text 假定位。App 暂留 hidden old Workspace 合法；断言要分别检查当前可访问 UI 与旧 namespace 的原始保留事实。

## 晚响应：必须记录实际交付，不能把取消冒“忽略晚到成功”

沿同一自有 proxy 在**一次**精确 A GET（可选 conversation read；优先无 session secrets 的响应）捕获真实 upstream 完整有界响应，保留 body hash，短暂阻住下游。记录 request ordinal/target A，用户切 B 或完成 B→A 后才明确 release；此过程不改响应值、原 API 或生产对象。原生 Request/Response 事件和 proxy `finish/close/error` 分开记录。

- 旧请求真实被 abort、没有下游完整 body：可接受“旧请求被撤销且未污染 B”，不能写“晚成功已送达并被忽略”。source 已有 begin/dispose abort，这条结局很可能出现，不能以吞 route.fulfill 失败凑绿。
- 只有真实完整响应已交付并有 body/consumer settling 证据，才可断言“晚到 A 不使 chooser 退出、不把 B 改回 A、不覆盖当前 draft/receipt、不写 B journal”。A→B→A 也须确认旧 ordinal 不被新 A 授权重新采用。
- 若要求**确定性 ignore-abort 已完成 Promise**，真实浏览器 fetch 的取消可能使该前提不可达。不要在本片临时替换 fetch/注入假 ready/直接调 private session 或打开第二 context；用现有 direct seam 单独补最小 generation 受控 case，明确它是 direct，不升级为 browser 证据。需要更强实际 consumer-delivery seam 时由 owner 提供精确设计再集中审。

因此最小 browser 接收合同可列 `identityCycle` 与 `oldRequestIsolation`，第二项细分 deliveredRejected / abortedWithoutDelivery；若需求明确要求前者，而实际只得到后者，应标该覆盖 NOT_PROVEN，不把整个“晚成功隔离”打 PASS。

## 双 DB 生命周期、scope 与资源增量

仅方案交 panels 原 owner，不新 take/组件/树。最小改动仍在：

- `apps/web/test/conversation-recovery.fixture.ts`：已有 publicServer 精确双中心 target、白名单 session 身份观察/单 GET barrier；两真实中心 startup/关闭，不复制 generic proxy 或认证逻辑。
- `apps/web/test/conversation-recovery.browser.ts`：新的固定 selector/expected phases、上述 UI 流程；parent 两份 RecoveryDatabaseLease 及完整 cleanup 接收。
- `plans/wpf-conversation-recovery`、`docs/evidence/wpf-conversation-recovery`：同 TODO 后继与证据。
- 只有需要隔离一个纯 generation/namespace case 时才用原 `apps/web/test/conversation-recovery.test.ts`；不是默认重跑全部旧测试。App/session/journal/binding 等生产源先保持只读；发现实质问题由 owner 在原合法范围处理。

**重要接缝**：现 lease 固定写 `database-owner.json` / `database-cleanup.json`（fixture.ts:232、308），两个 lease 不能共用同目录覆盖。分别使用 run/db-a、run/db-b；每个 create-attempt/confirm/marker/end-pool/两次 bounded zero-connections/normal DROP/remaining/errors 独立留证。B 创建失败也必须继续清理已存在 A；不让第一 cleanup error 跳过第二。所有 unknown owner/marker/连接状态保持 FAIL/KEEP，无 FORCE DROP/全库终止。父 hard-stop 要同时记录两 DB 状态；旧 prior receipt/raw 不回填或改 schema冒旧包能跑。

关闭顺序：停止/解除全部有限 hold → close 页面/contexts 与各流、两 server/pools → 确认 owned groups/两 DB 正常清理 → 删除 exact own scratch。双 EOF、真实 outer exit、唯一 sealed result 与各 cleanup 原件仍必需。两个 UI fixture 不需要两个 Vite、两个 Chrome 或模型/runner actor。

**供协调的保守候选，不是 grant**：下一独立 bounded phase 可建议 ≤90s（≤60s工作+≥30s双 DB cleanup），一 Chrome/一 Node worker、两 DB、零 provider、一个64MiB scratch；相对一 DB baseline 先列第二 DB/WAL **128MiB预算估计**，新增 evidence≤4MiB（含outer/两个DB原件/有界wire）+metadata≤1MiB，合计新增空间声明 **133MiB**。该估计尚无 actual 测量，原 owner/manager须按 fixture最终输入与当前 PG声明确认；历史 retained另完整carry，不能从旧9MiB或旧剩余时间偷借，也不能因本建议放宽原 cap。新 phase 与 current90s/历史60s等账分开，actual 前独立源/生命周期集中审和资源组合，当前没有第二 DB/runtime 授权或预约。

## 边界与当前结果

当前真实第二中心/principal/reconnect依旧未验；本提案不把 Steer 2/2 或 8919 metadata 变成全 feature/main PASS。最小公开入口足以建立两真实身份，但 principal-only rotation 无合法公开机制；晚响应的实际送达必须诚实分级。pins.json 保留11固定源与旧研究原件。复用本地 find-skills、clean-code、codebase-design：保持单公共身份 authority、复用原 marked lease/ACK-loss/消费者，不复制第二状态机；全部为固定源码分析，无产品检查、资源取样或私人配置读取。
