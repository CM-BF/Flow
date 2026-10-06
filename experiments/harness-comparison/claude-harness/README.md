# Claude Harness 本机 Docker 对照归档

**最终状态：本机容器与官方 bridge 准备成功，`createSession` 在官方 native subscription resolver 刷新时返回 HTTP 400，模型调用 0 次。** 没有模型任务、工具执行、token usage 或同会话续接的实测结果；不能据此推断路线不可行或 adapter 性能开销。

## 读哪些记录

| 文件 | 含义 |
| --- | --- |
| `harness-result.json` | 最终脱敏结果；与 attempt-2 内容相同。 |
| `attempt-2-native-refresh-400.json` | 补齐环境后，bootstrap 成功、认证刷新 400 的结果。 |
| `attempt-1-bootstrap-failure.json` | pnpm 10.15.1 未支持官方 allowBuilds 配置，CLI native binary 安装未完成。 |
| `preflight-result.json` | 最早尚未补 pnpm 的历史预检；其中 0 凭据读取仅描述该阶段，不能作为最终全过程记录。 |
| `README.source.md` / `provenance.source.json` | 原临时目录中的说明与来源记录，逐字节保留。 |
| `archive-manifest.json` / `SHA256SUMS` | 原始文件名、归档文件名及哈希映射；本归档的校验信息。 |

pnpm 修正为 10.32.1 后，容器创建 167 ms，官方 template.prepare 12,848 ms。官方 bridge 使用 Claude Agent SDK **0.3.281**、Claude Code **2.1.281**；host 原生对照组 SDK 是 **0.3.290**，不是相同 runtime。未把容器构建与 bootstrap 计作纯 adapter 开销。

凭据相关环境变量只检查存在性，均不存在。官方 adapter 进行了一次既有本机登录读取和自动刷新，刷新返回 400；没有手动登录、再次刷新、输出 credential 值或将凭据复制到归档。源码中“先读 credential JSON，再回退 Keychain”是代码观察，不是失败根因证明，也不能证明它与原生 SDK 选了同一凭据。

## 这是实际脚本快照，不是已验证 runner

`run-harness.mjs` 与 `Dockerfile` 保留了执行时内容，没有为归档重写。脚本仍含原临时目录 `/tmp/flow-harness-eval.iq7BzZ/` 的绝对 import，并导入 `./package/dist/index.js`。**执行没有到达模型阶段，`result.fullStream` 及其后结果字段访问、事件提取、续接和该阶段清理路径均未经过实际运行验证；不能把此脚本当可靠 runner。** 后续执行前应先核对当前固定版本 API 并修正这些调用。

归档未复制 node_modules、credential 文件、展开的第三方包或 tarball。`package.json` / `package-lock.json` 是原独立目录快照，只锁定 get-port，**不是整套对照的完整依赖锁**。若要复现，需要：

1. 在独立环境还原来源文件中记录的准确 npm 版本，替换脚本的原临时 import 路径；不要只运行此目录的 npm ci 就认为依赖完整。
2. 重新获取 `ai-sdk-sandbox-docker@0.1.2` 的 npm 发布包，校验 `archive-manifest.json` 中记录的 SHA-512 integrity / SHA-256，再展开到合适位置或修改 import；它是社区包，npm 指向的 GitHub 仓库在原检查时返回 404。
3. 校验并还原下述本地基础镜像，检查脚本 API 后再准备容器。现有登录是否还能工作取决于运行时认证状态；本归档没有凭据。

当前 Docker 接线使用 localhost 发布端口、显式 `port` / `portEndpoint` 与官方 `template.prepare`。社区包没有 getPortEndpoint，但官方 basic sandbox 入口支持显式 endpoint。没有挂载用户 HOME，也没有使用云 sandbox。

## 镜像与复现限制

实际 Dockerfile 基于本机 `claude-code-sandbox:latest`，只增加 pinned pnpm 10.32.1。**`:latest` 是可变本地标签，Dockerfile 本身不能保证重建同一环境。** 原镜像没有 RepoDigest，此 ID 不是可据以从公共 registry 拉取的已验证 digest。

- 原基础 image ID：`sha256:6b2f91a1d8ab9fd521f9c86b0b1b51fdab29d3deaca7cf2801aed950ed3e0c47`。
- 实测派生 image ID：`sha256:6577a8e135c60c8c1c84fadb6f032ea0a10e7f4836510c24f4105de01e555403`。
- 原基础镜像用户 developer，Node v22.22.1。需另行保有同一基础镜像，或将不同基础环境作为新试验记录。

本轮临时容器、bridge 和 pnpm10.15.1 / 10.32.1两版派生 image 均已删除。原有基础镜像和容器未修改。

## 哈希说明

`provenance.source.json` 内的 filesSha256 使用原始文件名：其中 README.md 对应本归档的 **README.source.md**，不是本页；tarball 哈希保留为来源证据，但 tarball 没有归档。原说明里“没有修改 Flow”的陈述描述归档前的试验阶段；本次唯一项目变更是此子目录的证据归档。

`archive-manifest.json` 显式区分原始哈希与归档哈希，所有源快照复制时均核对一致。`SHA256SUMS` 校验本目录其余所有文件（不包含它自身）。归档过程未安装依赖、调用模型或重试认证。
