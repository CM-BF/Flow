# C02-04：已确认发布后的持久 Codex 加载

本片只承担四个已领取生产/测试文件的小接线，沿原 Interface 和 Mika 已授权设计实施（bounded brainstorming）。旧 R2 8501/f100 结果、原 manifests/raw 保持固定 Git；本阶段不追加旧 R2 尾账。

`loadPublishedCodexRunnerConfiguration({codexManifestFile, claudeManifestFile?, baseUrl, token, signal?, codeHome, createTransport})` 是启动方调用的 Interface。混选在文件/网络前拒绝；同一已有16KiB读取器读取严格 profile；`publishPersistentCodexLaunch` 要求 host-owned opt-in，复用 `publishNativeExecutionProfile` 对参考和完整配置做 ACK 验证，然后以该 ACK 的 runnerId/configDigest 创建不透明 storage，复用 configure 和 guard。返回 descriptor、guarded adapters、confirmed reference，main 以后不再二次 publish。

codeHome 和 factory 仅来自受信代码参数，函数入口捕获所选值；它们不在 task/profile JSON。Storage 复用 dev/ino/owner/private-mode 检查，每次 factory 前再核；任务 profile pin 和 executionIdentity 复用原 guard/storage fencing。未知/坏 ACK 拒绝而不重试，取消在 ACK 后仍阻止构造。host 持有根生命周期，loader 不创建、清空或删除它。不加默认 factory、auth fallback、状态机或监督器。

直接行为验证跨该 Interface：strict/mixed 拒绝；ACK前无storage绑定；ACK缺失/runner格式错/digest错/config错/丢响应；两次真实注入 factory 同 codeHome 而 attempt cwd 分开；不同 pin/runner 和根替换零 factory；旧fixture/Claude/ephemeral Codex加载保留。两文件全组含既有1次mkfifo子进程，监督组收束；0真实native/SDK query/PG/provider，fetch为内存Response。原R2 6/6不重跑。

未交付：main.ts/main-concurrency.test.ts 尚未领取，固定 production R06 factory（必须实际将受信 codeHome 映射到 CODEX_HOME）和持续根工程生命周期随后接入。真实global remoteControl/status/changed严格分类、合法分片/stream+公开thinking、真实native和conversations/Web/TUI仍为原C02-04/05验收，不由本片替代。图更新由 Lead 在集成点绑定本次 source；当前仅计划接线。
