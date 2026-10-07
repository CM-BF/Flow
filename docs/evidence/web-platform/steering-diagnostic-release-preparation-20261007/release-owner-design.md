# RELEASE01 / REQ19 三份保留 App 固定 origin 兼容：只读准备

状态：DESIGN_ONLY / NOT_RUN。最终 backend source/artifact tuple 尚未交付；本报告不是运行入口、claim、发布或代理授权。原 RELEASE01/03 released claim 不复用。全部研究限定 Git 固定对象、已有证据及只读依赖文件；只写本 TMP。

## 1. 结论与固定输入

复用原 RELEASE01 两文件方法的真实页面 read/send/recover/negotiation 四项断言，替换其 rebuild、动态 origin 和旧 ACK 故障方式。静态 assets、流式转发与真实 ACK headers 后截断复用 RELEASE03 已有方法；报告仍由现有 web-release.mjs 消费，不新建发布体系。固定方法参考 main `8c2ae379a77cffcc1bab3e6f73ebb0fa8681447c` 不是最终运行 backend。

原树 branch/HEAD/clean 和全部 source SHA256 在 `pins.json`。候选复用 `web-release-compatibility / codex/web-release-compatibility`，起点 `41276e2ecd154087f66958339d9abfce4d44964c`；旧实现 `7805b7dd20b1dda1b24ecb7497b1fca84bc5a63b`。RELEASE03 参考 `ef458ff06cf7f12549b4bf3e10fc9b3e4c886ec7`。不 reset/rebase/整树覆盖。

直接复用 root 的 30 assets / 4,538,660 B 完整性原审计（SHA b655c872739f25d0dfc0611d988e53b88c4d096e2d2041f1c4ec76a63307a65c），本 worker 没有重复全量 hash：

| artifact 前缀 | 固定 App source | manifest | releaseId |
|---|---|---|---|
| 461a9732 | b1c2e39837c2208e6fc2c59a80e16797f26448b5 | format1 | null；不能补造 |
| caa1e938 | 8d8ab520a9d43c7b9dafb22911416ee799ebf665 | format2 | 8d8ab520a9d43c7b9dafb22911416ee7 |
| d629631d | 5069586a9f17332de526e101eca3a4250cbc8d91 | format2 | 388371a4972c469b8ace623454594132 |

完整 descriptor、保留根 identity、manifest 哈希/路径见 `candidate-interface.json` 和引用原审计。历史 af51、3230/e5fe、b2b/c2c 不是自动获准的下一运行 tuple。每 App 四项及总报告均须绑定同一最终 backend/context。

候选 context 是 `{format:1, publicOrigin:"http://127.0.0.1:61228", policySha256:"81a8abe98d6541c34d07b15611e773f9bd4b53f8c6785bbaaab6e3dd03b3d638"}`。必须另获最终非敏感 normalized browser-session settings（cookieOrigin/trustedOrigins/authEpoch）并实际按现有算法算出相同 policy hash。摘要 hash 不能反向代替配置，不能读取个人配置或手填 context 当运行事实。

## 2. 旧方法哪些能用，哪些必须更换

- RELEASE01 fixture:122–135 创建两个 detached checkout、offline install、prepareWebArtifact；35–45 启动动态 Vite preview。全部不复用执行。143–180 的真实 center/公共 runner 路径只作结构参考；旧默认 PG URL 也不能复用。
- RELEASE01 browser:34–120 的真实 UI、冻结 body/key、唯一 turn、读取与四观察项可沿用；不能把旧 labels/两个版本循环直接改成三次便宣称新兼容。
- RELEASE03 fixture:107–142 已有真实成功 JSON ACK 完整读取/严格 prefix/完整 Content-Length/Connection close/有界优雅关闭；181–236 有静态流式 proxy、SSE 直接转发和有界观测。保留这些窄职责。
- RELEASE03 browser:408–485 钉住 click 前的同一 Request，观察 response headers 后同 Request requestfailed，再 unknown UI/恰一 preRetry POST/显式 Retry/恰第二个同 key/body/replayed turn。不要等待 Playwright 1.63 的 response.finished() 来判断 failed 请求结束。
- RELEASE03 旧 362/cde/metadata 白名单、factory 路径和 d629-only 限制是历史输入，不能复用来冒最终 backend；必须实际从最终已核 artifact 加载 factory/client/contracts，不能只更换报告标签。

## 3. 最小接口与固定 origin 路由

在原 fixture 只增加一个显式输入对象：`finalBackend`（实际 source/artifact/manifest/root identity/Node/factory entry）、`browserSettings + derivedContext`、三个原样 `appDescriptors`、独立 owned output/root 与已批准预算。无默认 backend、无端口扫描、无 moving main/旧 @flow dist fallback。具体未来 CLI 名称以固定源码为准，本报告不造可运行 gate。

顺序一个 owned Chrome/profile，App 各自 fresh context，唯一自有 marked DB 和 center factory；每个 App 用独立 project/conversation 身份。实际模型任务由已存在的 synthetic runner 方法经真实公开注册/profile/claim/report HTTP 完成，不调用 provider/SDK、不伪造页面响应。公共 client/contracts 必须与最终 artifact 相符。

浏览器手动代理候选沿 root 已核 Chromium 文档方向：专用 loopback proxy，`--proxy-server=http://127.0.0.1:<ownPort>` 与 `--proxy-bypass-list=<-loopback>`。它只有一项 route：规范化后的精确 `http://127.0.0.1:61228`。拒绝 CONNECT、其他 scheme/authority、userinfo、重复或冲突 Host、泛代理与 DIRECT fallback。固定 upstream 只来自自有 backend listener 回执，绝不从请求 URL 推导；own backend/proxy 端口不得为 61228。静态资源只读固定 manifest allowlist，format1 `/` 与 format2 release namespace 分开。

建议在访问 61228 前增加最小 routing canary：访问本次 proxy 自己的动态 loopback 地址，proxy 仅记录拒绝请求的原始 request-target 是 absolute-form 还是 origin-form。前者支持已走显式代理，后者说明 direct/bypass；失败立即停止，未探测个人 61228。这是未实现/未运行的防误连候选，不单凭 canary 宣称所有网络被 OS 禁止；精确 Chrome 配置、默认 loopback bypass 和无 fallback 仍需准备源码审与实际观测。不给浏览器注入产品功能脚本。

`Host:127.0.0.1:61228`、Origin、Sec-Fetch、Cookie/CSRF 和 Set-Cookie 原样保持公共 origin 语义；不能把 Host 改成 own upstream 动态端口，否则 browserOrigin 校验对象改变。仅移除 HTTP hop-by-hop/proxy headers，保留多值 Set-Cookie；SSE 保持流、backpressure、错误/取消传播，不先读完整 body。仅选中 ACK 截断和明确 legacy negotiation header omission 为受控故障。

**禁止 Node 端 fetch(publicOrigin)**：Node 不会自动走该 Chrome proxy，原 browser 获取 index/asset 的直接 fetch 必须改为本次 browser context 内请求或实际浏览器 response 观测。Node runner/admin 只访问自己已登记动态 backend。页面 `location.origin`、资源真实 bytes/hash、route 命中和无意外目的地各自留证，不访问个人 endpoint。

`loadReleaseAssets` 当前要求已有兼容通过记录，不能用于首次构建待验 snapshot 或造绿 pointer。可用三个 manifest 构造 fixture 私有只读 snapshot，再复用 releaseAsset 的路径/字节校验。现 `verifyWebArtifact` 经 artifactRoot 会 mkdir；不能仅因名字是 verify 就授 retained 根写权。准备时须保证既有目录且不执行会新增状态的路径，或将其所需只读校验局限到已存在 fixture；共享工具不在候选 scope。

## 4. 原生认证、Cookie 补证与四项观测

三份固定 App 的 client 均明确对普通请求和 SSE 使用 Bearer（b1c:447/474；8d8:450/477；506:515/547），没有 browserSession 客户端。保持真实旧 App 登录和后续 Bearer 请求，不能通过注入、请求 header 改写或代登录把它们变成 Cookie App。root 已确认现有四项报告接口不要求这种虚假结论。

Cookie/CSRF policy 使用**独立 fresh context**的公共 session/connect/logout 接口补证：真实服务 settings 与候选 context 同值，公共 origin Host 被保留；实际 Cookie 的 host/path/HttpOnly/SameSite/Secure 和 CSRF 缺失拒绝/合法提交/logout 撤销分别观察。只保存非秘密状态/flags/键名；不持久化 owner token、Cookie 或 CSRF 值。不与 App context 混用，以免 Cookie 让原 unauthenticated request 的 401 断言失效。此补证不叫“三旧 App Cookie 客户端通过”。

每 App 必须真实完成既有四项：

1. **read**：ownerAuthenticated/conversationBound/taskBound。页面读取该 run 创建的实际 conversation/task；SSE 观测须能证明有事件在 stream 结束前到达，并记录 legacy 可读边界，不能以缓存 fulfill 代替。
2. **send**：acceptedTurnBound/requestedProfilePreserved。实际 UI 选择已声明 profile、点击发送，服务端接受的请求/body/profile 和实际 turn/task 对应；0 provider 的真实 runner 经公共接口完成任务。
3. **recover**：sameKey/sameBody/sameTurn。选择成功 ACK 后先完整核 upstream：UTF-8 JSON、无压缩/歧义 framing、有效真实身份、≤128KiB，再送真实 headers/full-byte Content-Length 与非空严格 prefix，Connection close 优雅结束。保 upstream full hash、downstream prefix length/hash、精确 Request headers→failed、unknown receipt、新草稿未丢。显式 Retry 前恰1 POST，之后恰2、同 key/body、replayed identity 与单 turn/task/history。无未授权多次 drop、假 JSON ACK 或吞预期外错误。
4. **negotiation**：legacyReadable/streamHeaderHandled/profileHeaderHandled。原 legacy/header 分支真实执行并分别留证；不把其他 App 未具有的 Queue/material 新能力混入四项或用补充探针代替 App 旅程。

当前 server/browser-session:51–113 证明 cookieOrigin 取 request protocol+Host，Bearer 与 Cookie 两条合法认证路径独立，mutation Cookie 有 CSRF 检查；这仅是方法参考 main 源事实。最终 artifact 若接口变更，须重新核实际入口，不继承当前源码结论。

## 5. 报告、失败与清理闭包

现 web-release.mjs:11–55 已支持 format2 / flow-web-api-v2 + exact context。每 App 各4个有界 raw JSON（每份≤4096B）+ report，确切 keys 仍沿现 schema；外部 source/artifact/tree/factory/Node/root identity 与 proxy/cookie/SSE详细证据放 run manifest，不擅加 report 不接受的顶层字段。App manifest format1 与兼容 report format2 独立；461a releaseId 仍 null。

`importWebCompatibility`/verify 仅在未来新建自有 private output state 中使用，不写 retained artifact state、不改个人 release pointer；由原 operator 在三份全部成功、清理完整并独审后执行其实际接收。单份通过可保留，但任一未跑/失败/unknown cleanup 均不能汇总 ALL_PASS 或发布。

未来运行必须独立新预算/admission，不能挪旧180s/60s余额：资源监测在 import/create 前，绝对截止含清理；精确 own processes/PGIDs/监听端口/DB marker，控制 raw cap 与 retained cap。proxy 停接、abort SSE/socket、关闭 context/Chrome并 drain EOF、关闭 factory/pool、确认自己的 DB marker 和连接后正常 DROP；不能 force DROP/按 prefix 清理其他 DB。各 cleanup 尝试继续，保 first error 与完整 cleanup errors；CREATE 未确认结果不得猜测清理。最后 reap 后删 scratch 前仍采最终资源，证据未知保持 FAIL/KEEP，实际 outer exit/唯一终态/原件哈希共同接收。网络代理本身不是 native Chrome 外层 OS containment 的等价替代；精确新增 proxy argv 与能力边界须未来一次审定。

## 6. 依赖、写权与就绪缺口

原 RELEASE01 已有 filesystem 可读依赖：tsx4.23.15、Playwright/@playwright/test/core1.63.0、pg8.23.1、TS5.9.3；package/entry realpath/hash 在 pins.json。root playwright-core alias 缺失但同树固定 .pnpm entry 存在，可显式只读使用，无需安装/links。Node realpath24.20.0、Chrome plist154.0.8037.99 已只读记录，binary hash/未来实际版本和完整 runtime closure 尚未核准。RELEASE03 的 ATTACHI donor 不必为此重用或修改。

候选 exact4 scope 见 scope-proposal.json：原两 test + own plan/evidence。无需新 WT，但必须先 fresh 合法 take；原released claim不可写。两 harness 内容从原HEAD演进，reference实现只摘必要逻辑，不能复制旧server/backend源覆盖新版。若 final artifact 未包含所需公开 runtime exports，给原 operator 精确 source/entry 缺件清单，不自行补共享源码/lock/node_modules/新框架。

HOLD 条件：最终 center/runner backend descriptor 与 webHost artifact 若分离须分别明确；真实可导入 factory/client/contracts/Node依赖闭包；与 policy hash 相符的非敏感 settings；finaltuple 独审与三个仍保留 roots；proxy/native 运行能力与受监督预算；合法四scope及唯一 runtime 资源段。当前没有这些最终输入，不能给可执行最终命令或声称 READY。

## 7. 方法、复核及未验范围

复用本地 find-skills、clean-code、codebase-design、webapp-testing（路径/技能原件 SHA 在 pins.json），没有重装/联网找包。实际应用：把 descriptor/context/auth/report 分离；复用原两文件和既有 importer，避免第二状态库/发布流程；每个错误可归因且 cleanup 不抹首错；真实UI/request事件不替代成 mock成功；明确候选与实际边界。

结束 clean-code 复核：发现并记录旧 rebuild/dynamic origin、不经 proxy 的 Node fetch、Bearer/Cookie混称、verify隐式mkdir、缺settings仍手填policy、format1 releaseId补造、SSE缓存和beforeheaders ACK重发风险。未实施任何修正，全部作为最小后继接缝。0项目写/claim变更/产品import或测试/Node执行/PG/Chrome/HTTP/proxy/build/install/free/proc采样。没有三App新行为结果、没有性能/个人部署或最终兼容通过证据。
