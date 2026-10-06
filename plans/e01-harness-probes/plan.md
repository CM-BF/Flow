# E01 上游 Harness 合成验证

2026-10-06。首 auth 片段状态：completed（作者观察/检查）；独立 review 待执行。Owner：runner_owner / gpt-6-astra。此为已授权、可丢弃的 auth spike；不改产品，不作选型完成声明。

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
