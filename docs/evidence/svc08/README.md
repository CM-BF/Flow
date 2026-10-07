# SVC08 — 上游截断后关闭对应下游

固定产品目标 `086ba13dc0b284d04dbc3753c66471bf6012328a`，base `a2e7803161ffb7e2158eaf3c13531448d2a777b0`。旧 static-web 与个人 af51 输入逐字相同；本片仅隔离真实 HTTP loopback，没有操作个人端口或保留版本。

原实现中，client 已读到上游首帧 13B 后，FIN / RST 两项在 300ms 观察结束时仍各有 1 个 frontend 连接，上游为 0；正常结束为 0/0。Vite 的普通 pipe 未把这两个 upstream 截断事件结算到 downstream。修复使用既有公开 proxy configure 接缝，监听 upstream `aborted` / `error` 并销毁对应 downstream；客户端看到截断而非正常 EOF。原 proxy 匹配、Authorization / Origin 透传、`ws:false`、64 cap 和静态资产逻辑不变。

唯一入口：`python3 -B docs/evidence/svc08/run-local.py original` / `fixed`，独占输出名，复用固定 OPS14。两次均 1 selected；原红 0/1，修复后 1/1。**1 个不同测试**，每轮含正常完成、FIN、RST 三个场景及末次 identity，共 8 请求；不能写成一次 3/3 或 2 个不同测试。监督报告累计 1449ms；两轮原记录合计 11175B（其中 stdout 1146B +207B / stderr 0），均小于批准边界。

`run.json` 统一列出固定来源、实际工具退出码、原输出、时间/字节口径和清理。两轮均双 EOF、最后 owned_state absent、两服务停止、各自目录 dev/ino 核对后正常移除。修复轮清理前私有文件 279B；原红没有测私有文件字节，仅有固定生成配方，不能补称实测峰值。临时的 pre-reap EPERM 观察保留，未改成 absent；使用 supervisor 最后状态。

原红的 `outcome.terminal` 是活对象，fixture 自己 destroy request 后会成为 aborted；它**不是清理前已结束**的证据。旧 `settledWithin300ms=false` 与清理前 1 个连接的计数保持原样；修复后的 test 另把 terminal 固定在 `beforeOwnCleanup`。原红/绿 raw 均未改写。

限界：300ms 是有限观察，不是无限泄漏证明；小合成 artifact 不构建 App，也不验证旧保留版本切换。旧 133 次 churn 证据覆盖的是客户端断开，不能替代本次上游截断；本次不证明个人两次 64 CLOSED 的实际根因或长期稳定性。旧 `static-web.test.mjs` 包含 full build，本次不跑；新 direct consumer覆盖受影响的正常 SSE、透传、identity 与 cap。0 PG / Chrome / provider / install / build / 个人服务动作。

[固定绑定](fixed-manifest.json)列 2 个产品源 +1 个 evidence-only OPS14 caller，18 个 base 保护输入、16 个原证据及 3 个安装好的 Vite runtime 文件。ignored alias 仅指向已核 Vite 8.3.2；未改 donor、lock 或 manifest。技能与安全点结构复核见 [quality](quality.json)。独立限定 review 已通过，main `15847da4b4aa00d42bd3e25b9bf88ea046bb19a8` 已接收；见 independent-review.json / main-receipt.json。个人部署/根因仍未证明。
