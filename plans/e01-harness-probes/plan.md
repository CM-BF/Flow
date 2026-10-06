# E01 上游 Harness 合成验证

2026-10-06。两片段状态：completed（作者观察/检查）；auth 与 Paseo 均独立方法 review 通过。Owner：runner_owner / gpt-6-astra。此为已授权、可丢弃的 spike；不改产品，不作选型完成声明。

## 范围与方案

固定 @ai-sdk/harness-claude-code 1.0.143 / @ai-sdk/harness 1.0.139 的 auth 源码、完整调用链与 Apache-2.0 来源。复制最小上游模块原文并记 SHA256；独立 VM 链接器注入临时文件根、合成 Keychain、fake fetch 和固定时钟，默认网络/真实 HOME/命令执行均不进入。

通过 readClaudeCodeSubscription / resolveClaudeCodeAuthentication 公共 helper seam，观察文件优先级、5分钟阈值、同 PID 2/16 并发过期、受控轮换响应与临时写路径交错，以及挂住刷新后调用者取消/外部看门狗的退出。隔离试验只修改输入与 I/O 注入，不改上游函数；原行为与注入差异分开报告。每例有父进程超时、强制退出与临时目录清理，不跑长 benchmark。

0 模型 / 0 云 / 0 真实 refresh；不读取真实凭据或重置 HOME，不碰共享登录、不修改根 lock/产品代码。Paseo RPC 可作为后续独立小片段，不能拖延首 auth 交付。

## TODO

- [x] E01-01 固定版本、许可、hash、调用链和安全注入 seam。
- [x] E01-02 运行有限合成场景，保存真实观察与原始 JSON，不预设上游结果。
- [x] E01-03 记录复跑命令、注入差异、限制与 clean-code 检查，固定 target 交独立 review。

交付 target 8e232a0c2f52fd08565c2d377215c9d3a8904641；9场景完成，发现受控并发刷新与同PID tmp竞争、取消未传递。结果与输入差异见 [证据](../../docs/evidence/e01/README.md)。这是诊断交付，不是生产改造。

写范围仅 experiments/harness-probes/、plans/e01-harness-probes/、docs/evidence/e01/；D04 claim 4c525d50-50a4-4bf4-83be-4f978b601b1d version1，已核验 active。

## 第二有界片段

- [x] E01-04 Paseo固定7a30305503c600bc46ea2a94a6750eac5cede278、Apache-2.0 的公开JSONL decoder/RPC seam：真实合成Node子进程中文/emoji跨字节chunk、2MiB无newline、退出pending和合成stderr marker，保存结果/限制。0模型/云；不实现产品修复，不改auth源码与原始JSON。已有本地固定source可直接复用，单次进程组看门狗3秒，避免研究拖延首片段。

第二实现 target db2f2d0f6c2b0db3cab454d6cfe617b4671196b1，约0.214秒合成运行，记录Unicode跨字节损坏、2MiB行保留、退出pending拒绝、stderr8192字符尾部仍含合成marker。此探针已另获 Goal Owner 独立只读方法 review APPROVED db2f2d0，未重跑；采用前须修 streaming UTF8 / byte bound / redaction。

## 下一片段：先提案，不先调用

- [x] E01-05 核对固定 SDK0.3.290 与 wrapper1.0.143 的真实差异，交付并按 Goal Owner 审定收敛 [工程能力/stock兼容性提案](native-wrapper-proposal.md)：最多2次query/USD2仍仅待执行预算，先0模型预检，明确版本/认证/模型门槛与产物。
- [ ] E01-06 Goal Owner已允许有界0模型兼容/参数预检；真实调用未批准。先原生工程能力、后stock兼容性，不为公平重造harness；真实模型/认证/新预算明确后才可调用，失败不得补次。

旧adapted-wrapper对齐方案已被取代；stock的版本/设置/工具/认证差异记录为选型事实。仅实际最小adapter必需补丁可另提，不把多项改造变体当stock。旧 R02/I01 5/5 封存，当前真实 query 仍0。
