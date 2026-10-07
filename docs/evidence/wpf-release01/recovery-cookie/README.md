# RELEASE01 新版 Cookie 网页：固定源码准备

固定实现 `8964dc1185f62ed8934c15416e9798929359ab89`，只有原 fixture/browser 两文件变化。新 claim `27c36b97-162d-45e0-9150-25269d3d3f34 v1` 已原子 COMMITTED；[领取原件](claim-receipt.json)和[请求](claim-request.json)固定。旧38b9释放及原9658/c3/main交付不回改。[前状态原件](previous-status.md)保留。当前strict已单次通过，root源码与必要局部检查独审APPROVED；真实兼容仍未完成，不继承历史绿结果。

## 固定8964入口事实与当前供给政策

`runRecoveryReleaseCompatibility(RecoveryAdmission, adminUrl, OwnedBrowserLifetime)` 是新入口；原 `runReleaseCompatibility` 仍只做三 retained App。新入口要求新 Web 和后台的 sourceHead 都为 `7272151bb1e3e59e08937dca44949dcdeb42f009`，新 Web descriptor/manifest/namespace 必须真实供给。空输入或旧6c后台在启动 fixture 前拒绝，不填占位 artifactId、不 fallback、不重建。规范公开 context/policy 沿原真实供给。上述为已审8964代码现状；Original新授权独立04da/6c后端组合，供给不再强制同源7272。待真实Web/backend pair及各自正式审查到齐，才最窄更新该guard/caller绑定；本批不改或绕过输入断言，不追moving main。

前三个 App 保持原 immutable 身份和原生 Bearer 旅程；第四个是真实新版 App，通过其连接页建立 HttpOnly Cookie。每个 App 仍只有既有 read/send/same-key-recover/negotiation 四项报告，绑定同一新后台与 context。format1 retained manifest 仍没有 releaseId；报告format2不为它补造身份。四App完成且 Chrome/HTTP/markedDB 清理成功后才导入公共报告 codec。当前没有第四报告或任何新实际证据。

输入上限沿发布接口：原三份各10文件；新 manifest 1–128文件、单文件8MiB、四App合计192MiB上界，不是实际资源用量。新资产/root identity/字节和后台完整闭包须由 Original 提供并在准入前核实；旧30asset审查可作为旧身份来源，不能代替当次完整绑定。具体空缺在[source manifest](source-manifest.json)。

## 真实旅程与最小行为差量

1. 新 App UI 输入显式 bootstrap token 建立 Cookie；只观察 Cookie HttpOnly、页面不可读及 token 未落 local/sessionStorage 的布尔值，不封存秘密。
2. 写入草稿，等实际 Recovery 行出现；刷新页面后无需再输入 token，通过真实 Cookie GET 恢复会话。点“Restore without sending”恢复确切草稿，明确退出仍打开的 Recovery dialog，断言没有 POST。
3. 选择原授权 profile、真实发送；owned proxy 对成功 ACK 仅发送严格前缀，产生 unknown。写入独立下一草稿并等真实持久行/原 receipt 身份，不自动 retry。
4. 公共零 provider runner 在任务 running 时执行一次独立 logout 竞态：同 BrowserContext 的真实 probe 页面发 Cookie/CSRF logout，proxy 等后台真实成功响应后暂不转发原 headers/body。确认旧 GET 已失权、旧 Cookie SSE 真关闭；mounted App 刷新并在连接页重新登录。随后原样释放旧 logout 的真实 headers/body，断言新 Cookie 值仍同、ready GET 可用、任务仍 running。没有 setCookie/value 赋值、response fulfill 或新网络 client；不是“App 的旧 callback 已覆盖全部生命周期”的额外证明。
5. 任务按原公共 runner/verifier 完成；真实 Recovery 原 receipt 的“Retry original request”产生相同 key/body/turn，accepted 后显式恢复下一草稿，禁止额外新 POST。原 legacy/negotiation/asset/console 检查继续。

独立 Cookie/CSRF policy probe 与各 App 报告分开。7272 的 logout 撤销服务端旧会话却不删除可能更新的 Cookie，故新入口独立 probe 保留该 Cookie 并验证服务端 unauthenticated；历史三App入口保留旧后台的删除语义。

## 权限、错误与清理

61228 仅是精确公开 origin，由专用 Chrome 的显式代理路由至 owned 动态后台/immutable assets；不连接个人61228。`page.request`、`context.request`、`route.fetch` 不用于此 origin；页面只做真实 relative fetch。Node 仅访问自有动态后台。保持 canary、无 DIRECT fallback、原SSE流转和ACK前缀规则，Chrome 原生 sandbox/无自定义外层egress强隔离的既有差异不漂白。

新增 logout hold 最多一条、响应捕获≤16KiB；成功释放原headers/bytes，只记录received/released/downstreamFinished/setCookie布尔值。失败时沿原 context/Chrome→fixture cleanup销毁所持socket和pending请求；不会写成功报告。每阶段仅预定义 phase/app与errorCode，失败raw仍保留。后继caller必须绑定新entry/四App结果和实际两个process group，不复用已消费c3 gate或把旧unused预算转新信用。

## 检查与交付边界

[必要局部提案](local-check-proposal.json)：原两entry strict + noUncheckedIndexedAccess + noEmit，仅一个 Node，20s含5s cleanup、TMP8MiB/raw1MiB、0网络/PG/Chrome。已读实际 tsc shim 与 `_tsc.js` 两者pin；动态后台不据此冒类型覆盖。经理随后明确授一次该独立局部段，实际strict0/outer0/1125ms/完整清理，见[strict原件](strict-actual/README.md)；没有browser预约。浏览器预算/最终caller须在descriptor供给和集中生命周期审查后另给有界输入。

本段进行了文本、Git对象、hash、metadata parser/link和一次两harness strict/noEmit；浏览器兼容 NOT_RUN。真实新网页可见发布仍由 Original 的产物/发布流程完成。主状态与 TODO07/08 是唯一当前事实，旧完成时间只保历史。

## 正式独审与下一供给

[Root原件](root-source-local-review.json)固定8964两source和本次strict实际，decision为APPROVED_SCOPED_SOURCE_AND_NECESSARY_TYPES_ONLY，0 findings；不是browser或发布批准。[最小供给请求](supply-request.json)给d01/Original，当前两个descriptor均未提供。正常metadata封存后全四scope STOP，claim保留，不重复strict/旧source研究。

## 供给校准记录

见[supply-request](supply-request.json)、[原请求历史](supply-request-before-04da.json)及[校准与质量记录](supply-calibration.json)。04da候选包含3个server产品/测试文件62增6删，另78行fixture-cleanup支持档案；授权候选不等正式源审或artifact。新Web只纳必需且获批的完整草稿保护delta；b924目前待root审，不能先记批准。两个descriptor均NULL，无gate或运行。
