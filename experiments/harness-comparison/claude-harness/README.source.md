# Claude Harness 本机 Docker 对照：停在认证 preflight

最终结果见 `harness-result.json`。本轮已完成本地 Docker、端口连接参数与官方 bridge bootstrap，官方 native subscription resolver 随后报 `OAuth access token refresh failed with status 400.`。**模型调用 0 次，没有任务、工具调用、usage、模型实际版本或续接成功结果。** 不能把它记作模型任务失败，也不能据此判定此路线不可行。

## 环境与版本

- Docker context `orbstack`，本机 Unix socket；没有云 sandbox。
- 基础镜像 `claude-code-sandbox:latest`，ID `sha256:6b2f91a1d8ab9fd521f9c86b0b1b51fdab29d3deaca7cf2801aed950ed3e0c47`，用户 developer，Node v22.22.1。原镜像未修改。
- 临时派生镜像 `flow-claude-eval-pnpm:10.32.1`，ID `sha256:6577a8e135c60c8c1c84fadb6f032ea0a10e7f4836510c24f4105de01e555403`，只补 pinned pnpm。
- `@ai-sdk/harness@1.0.139`、`@ai-sdk/harness-claude-code@1.0.143`；host 共享安装仅被导入，没有修改。
- bridge 自带 Claude Agent SDK **0.3.281** 和 Claude Code **2.1.281**；并不使用 native 对照组的 SDK 0.3.290。后续比较要控制或明确说明此差异。
- 社区 `ai-sdk-sandbox-docker@0.1.2` 的 npm repository 指向 `https://github.com/BrianHung/ai-sdk-harness`，本轮访问 404；发布源码已展开并检查于 `package/`。这是社区组件，不是 Vercel 官方 Docker adapter。

## 接线与检查

`run-harness.mjs` 使用已检查的社区 Docker adapter，显式 localhost `port` 与 `portEndpoint`，调用官方 `template.prepare`。当前社区 adapter 缺 `getPortEndpoint`，但官方 Claude adapter 支持上述 basic sandbox 配置，因此不构成根本 API 不兼容。Docker 发布到 127.0.0.1；不挂载整个 HOME；没有复制用户凭据到文件，也没有手动登录/刷新。

模型配置为 sonnet、仅 read、maxTurns 3、thinking disabled、每轮 90 秒。容器内 CLAUDE_CONFIG_DIR 为独立空目录，HOME 未修改，skills 为空，不挂载本机插件目录。read fixture 与同会话续接 prompt 已写入脚本，但未到达执行阶段。

首次尝试使用 pnpm10.15.1：官方 bridge 的 allowBuilds 设置需要 pnpm >=10.26.0，旧版本跳过 Claude native postinstall，导致 CLI --version 失败。证据在 `attempt-1-bootstrap-failure.json`。修正为10.32.1后，容器创建167ms，官方 template.prepare **12848ms**，随后进入认证阶段并得到400；证据在 `attempt-2-native-refresh-400.json`。镜像准备和 bootstrap 耗时单独记录，不当作纯 adapter 开销。

环境变量仅检查存在性：ANTHROPIC_API_KEY、ANTHROPIC_AUTH_TOKEN、CLAUDE_CODE_OAUTH_TOKEN、CLAUDE_CONFIG_DIR 均不存在。脚本移除这些非存在的凭据变量未改变认证路径；保留环境重跑不会提供不同路径，因此没有再次触发同一刷新。只读源码显示 adapter 优先 credential JSON、再回退 Keychain；没有为了排查而打开用户凭据，无法确认 native SDK 与 adapter 选择相同凭据，也不能断言400根因。

所有本轮临时容器及 bridge 已 destroy；本轮派生的 pnpm10.15.1 与10.32.1临时 image 也已删除，原有基础镜像保留，可按 Dockerfile 重建。原有容器、原有镜像、Flow 文件及共享 node_modules 未修改。

## 复现

在本目录运行 `docker build --pull=false -t flow-claude-eval-pnpm:10.32.1 .` 可重建环境。`node run-harness.mjs` 会启动真实已授权对照，并尝试本机已有登录；在认证路径问题查明前不建议机械重复。脚本不记录 credential 值，输出是经过筛选的结果 JSON。

原始无认证 preflight 记录保留在 `preflight-result.json`，已被后续实际 bootstrap/认证检查补充。Dockerfile、脚本、发布包源码与脱敏结果都在本独立临时目录。
