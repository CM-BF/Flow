# WPF-CONNECTION01 中心连接会话固定交付

本片实现独立 ConnectionSession 模块和现 SSE 单循环的授权接缝；固定的自有 Fastify/HTTP/PG fixture 已验证，**生产 createServer 还没有挂载 Cookie 模块**。共享 factory/client/export 由 ExecutionLead 接收。0provider，不访问个人61227/61228；无浏览器 UI 或跨站 Cookie 可用性声明。

## 检查与原始输出

Node24.20.0 / pnpm9.15.4 / Vitest4.0.18；本 WT `pnpm install --offline --frozen-lockfile --package-import-method=hardlink` 成功（9.1秒、581本地复用、0下载），无 manifest/lock 改动，无大复制。测试命令均为根 `pnpm exec vitest run apps/server/src/browser-session/session.test.ts --no-cache --configLoader runner`，选例轮次增加 `-t`，实际匹配见 raw。类型命令 `pnpm exec tsc --noEmit`。工具实际 exit/chunk/selected 在 [tool-receipts.json](tool-receipts.json)；empty types stdout 不冒充过程回执。

| 原始stdout | selected / 通过 / 未选 | 事实 |
| --- | --- | --- |
| pg-first.stdout | 0 / 0 / 0 | 初次 collection 缺server未声明的@flow/client链接，改为固定相对源码输入；0DB |
| pg-second.stdout | 18 / 18 / 0 | 首轮身份/绝对期限/32并发/Origin/CSRF/runner/SSE/旧公开Bearer |
| pg-increment.stdout | 3 / 1 / 18 | HTTPS策略通过；Node fetch未发送自定义Host导致错误用例失败，关闭竞态测试/清理hook超时 |
| pg-increment-fixed.stdout | 5 / 3 / 16 | raw HTTP纠正Host检查；expiry测试双clock_timestamp的微秒差违反8h约束，关闭测试keepalive造成退出超时 |
| pg-increment-final.stdout | 6 / 6 / 15 | 用同一now固定时间，owned raw HTTP不留keepalive；关闭前置竞态503，3种已开SSE失效均闭合 |
| pg-restart.stdout | 1 / 1 / 21 | 两个真实自有Node中心进程正常exit0，原Cookie、随机身份和绝对expiry保留 |
| pg-consumers.stdout | 2 / 2 / 20 | 最后stream更改后再核发布前撤销，以及未改createServer+FlowClient旧Bearer/二参stream |

共 **22个不同用例至少一次通过**，轮次有重复，不能相加当不同用例。root types 首次通过，初测缺client import exit2已保留；增量后通过，新增进程测试 nullable pipe 类型 exit2已保留，最后 types-fixed exit0。nullable标注只反映显式stdio pipe，不改行为；未为此重跑用例。没有全库/工程/模型重复运行。

## 清理与资源口径

各 `*-cleanup.json` 保存专用随机数据库名字、创建后独占marker核对、正常DROP后不存在的证据；共7个自有数据库均正常移除。失败轮次仍完整清理。真实restart两个自有Node pid29155/29680 exit0、输出0B。没有kill他人服务、读取凭据或修改共享库。

SSE授权真实检查样本：logout/expiry/rotation各4次，流关闭且任务仍running；250ms循环复用现single-flight和backpressure，不声明吞吐提升。首轮 `pg-second-cleanup.json` 的 `authChecks:0` 是测试计数器放在optional callback参数内的计数失误，**不是0鉴权**；增量已把counter移到每次port调用并定向核对，原raw不覆盖。初始读被preClose超越时返回503且不创建observer。旧createServer消费者输出过一次HTTP drain deadline诊断；测试成功与DB正常清理并不消除这一已有有界shutdown事实，不宣称全部连接自然drain。

migration028在1..27真实基线上重复应用，固定旧tasks行全字段不变，versions1..28；不改既有DDL。会话hash-only、32并发上限、8h固定期限、只在startup/connect/logout清理；GET不写身份或session。HTTP loopback SameSiteStrict 与HTTPS cookieheader策略分开验证；HTTPS用直接可信port而非TLS/browser旅程。Cookie没有端口隔离，绑定避免误用不抵御同hostname恶意co-host。

## 审查范围

固定7源及直接输入逐文件bytes/SHA见 fixed-manifest.json。原始验证分轮发生在开发过程中；没有伪造中间source SHA。后续改动只涉及SSE closing guard和对应测试/fixture计数、单时刻expiry测试、真实进程测试。独立review核原raw与最终源/这些直接消费者，不需重跑22。公开部署、Web恢复和真实浏览器Cookie兼容仍由后继实际组合验收。
