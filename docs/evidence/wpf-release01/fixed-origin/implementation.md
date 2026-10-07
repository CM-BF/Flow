# 固定origin实现入口（NOT_RUN）

两原test原位演进，无top-level启动：browser导出`runReleaseCompatibility(admission, adminUrl, lifetime)`。实际运行由已有受监督caller按最终source/tuple绑定，lifetime在每关键await核checkpoint/signal并提供ownedChrome启动/close。此接口不授权runtime；缺finalBackend直接失败。无需新增supervisor或默认CLI环境回退。

fixture：固定三个descriptor/原releaseId；只读manifest+served bytes；实际最终artifact verifier/factory/client/contracts/verifier从显式root导入；一个marked DB/center/公共synthetic runner。独立Node请求只动态ownedcenter；页面流量只精确61228→ownedproxy，拒绝CONNECT/非canonical/冲突Host/泛代理。proxy canary针对自有地址且需absolute-form成功才启用public route。真实SSE背压流式转发，ACK完整真实JSON→headers/full长度/1byte真prefix优雅关闭。

browser：原四观察/显式Retry冻结key/body/turn/task/profile；APIRequestContext禁用，所有61228请求仅page.goto、response或page.evaluate relative fetch。原native Bearer不改；独立probe页面/context真实Cookie/CSRF、cookie flags/logout，秘密只留内存。各App context关闭后保wire；Chrome/proxy/center/DB正常清理通过才生成format2/context四raw并交已有import/verify，写新owned output state，retained roots不写。

## 实际供给缺口

最终 backend `directory/root/artifact/sourceTree/node` 尚未给定，不能用历史b2b/c2c或8c2 main代替。需要该artifact实际只读模块入口/闭包：

- tools/personal-preview/backend-release/index.mjs（及其既有依赖）
- tools/personal-preview/browser-session-configuration.mjs
- tools/personal-preview/web-release.mjs（及asset/retention公共依赖）
- apps/server/src/index.ts
- packages/client/src/index.ts
- packages/contracts/src/index.ts
- apps/server/node_modules/pg/lib/index.js 的artifact内实际regular target
- apps/runner/src/verifier.ts

每个必要入口必须具备admitted canonical path/bytes/hash；runtime verifier另核完整artifact inventory与Node identity，非只标签改名。未供应的非敏感cookieOrigin/trustedOrigins/authEpoch必须算出已给policyhash，不能读取个人config。所有依赖仅只读，缺项列exact供应，不安装/links/修改共享source。

## 后继必要验证

已有Node24/TS5.9.3/@types/node/Playwright1.63可只读。两显式入口strict+noUnchecked+noEmit候选见typecheck-proposal.json：20s含5cleanup、1Node/tmp8MiB/raw1MiB、0网络PGChrome，尚未执行。它只证明静态本树public类型接缝，不证明未知finalartifact。后续实际runtime需最终tuple、exact caller/native proxy边界与资源预算独审绑定；本次不生成gate。

源码自查找到并在本实现处理：public Node fetch绕proxy、session秘密进入raw、beforeheaders故障重发、fallback旧tuple、completed/verify事件伪形状、关闭期upstream未收尾。public runner验证复用实际verifyText+runnerEventSchema，不新造报告codec。代理buffer与JSON raw有上限；未知创建/marker不DROP，首错与cleanup分开记录。原30assets审计只归引用不复制资源。
