# SVC05H01 固定候选与执行接口

本片仅固定源码和准备方案。候选 `b29807979a5589678a61d3fb84781950cf366396`，基线 `362af3bac77541e5a60979326bcf4d4b8c947915`。无依赖安装、源码 import、类型检查、测试、PG 实验、Chrome 或个人操作。

## 唯一行为差异

两源码逐字接收 cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd 已审 blob，未整合该大提交。store.ts 增三行：templateVersion=2 时执行输入 digest 保留，材料投影 `unknown/metadata-unavailable`，材料 revision digest 为 null；不把 knowledge-only 子集冒称包含附件的完整清单。v1 knowledge 保持原值。reportEvents 事务/fence/去重、owner 鉴权、按需 frozen context 正文读取不变，无迁移和重写历史行。

## 最小执行输入

```text
backend.path = /Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility
backend.sourceTarget = b29807979a5589678a61d3fb84781950cf366396
backend.head / tree = 执行窗口实采冻结的 clean 候选 HEAD / Git tree（可能有仅本片 metadata 后继）
base = 362af3bac77541e5a60979326bcf4d4b8c947915
lock SHA256 = 0e6a99c258aa1f2333efc4cb83412875840c028e7a6d75f4735afbf9c5f8a20e
App artifact/manifest = d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88
App source = 5069586a9f17332de526e101eca3a4250cbc8d91
```

Web RELEASE03 owner 继续使用原权威树/累计 runs 账本；已经消费 3874 / 180000 ms，观察剩余 176126 ms。不能新树清零、覆盖旧失败、把新 tuple 报成旧 362 通过。A 先验真实附件-only / 混合 history；B 只有 A 通过、剩余预算及资源许可才用现有真实静态 App artifact，记录其 artifact/source 身份、当前后台 HEAD/tree、两脚本 hash、实际公开请求及清理结果。只在 B 完整通过后导入新 tuple 的 compatibility report；本片不生成报告或兼容 ID。

Web driver 已独立改为显式 `BackendInput {path,head,tree}` + runtime factory 导入，local client/contracts/tools 保持固定 362。这些输入与候选相同，不能把候选 server 指向别的树。15:36 前只读其新 `verifyBackend` 发现 diff guard 仍要求只变一个 store.ts；需由 Web owner 窄允许本候选的第二个**精确测试 blob**及本片 metadata 目录，产品仍仅 store.ts 三行。两源码须逐一比对 cde blob/hash；全其他 apps/packages/tools/锁文件与 362 相同。不得放宽成任意已 dirty 工作树或只检查提交消息。

## 依赖复用（尚未挂链接）

已逐个读取原 Web 依赖声明的 16 个第三方 package.json：实际路径在 web-attachment-production/node_modules/.pnpm，版本/原声明 hash 均同。Node24、pnpm9.15.4 保持；没有 import 包或写 donor。完整列表见 source-bindings.json。候选尚无 node_modules，不能声称已经能解析启动。后续获授权时只挂精确已存在的第三方入口，@flow/contracts 必须指候选自己的 packages/contracts；不借全局 npm、不安装整 workspace、不改原锁、不复制其他 feature 源。

新 attachment-history.test.ts 还需固定 Vitest4.0.18 测试入口，当前 16 包复用清单不含 Vitest；其实际可解析入口需 Lead 另核，当前不为此安装。RELEASE03 现 tsx 路径可直接用于它原有 A/B 脚本，不要求提前运行这份 Vitest 文件。

## 必要直接消费者与门槛

1. 精确已审四测试：两种 v2，v1 knowledge + restart，batch rollback/纠正/重放；覆盖 auth/no-store/固定全文仍可读取。**本候选未运行**，不能继承另一个 source 组合的 green；由 Lead 结合剩余预算选局部确认，避免重复不相关领域。
2. RELEASE03 A 两公开 HTTP/PG 情景是原失败的必要复验；新 A 通过也不代表 B。
3. B 复用现真实 App，按原 compatibility 检查读/send/recover/cap；不重构建 App、不用 fixture 壳冒充它，不改变个人 Web pointer / retained artifacts / tab。

现授权仅准备。历史 A 启动门槛为 1 GiB + 32 MiB，B 为 1 GiB + 128 MiB；实际执行需 fresh 资源和单次窗口，cleanup 已占 gate 内 20s。Provision 的 1,094,492,160 B 观察低于 A 启动门槛，非实时空间或预留保证。不得先启动再借 cleanup 保留额。

## Source 范围

claim 四 literal：apps/server/src/context-transparency/store.ts；apps/server/src/context-transparency/attachment-history.test.ts；plans/svc05-history-compatibility；docs/evidence/svc05-history-compatibility。Web driver/依赖链接/服务操作不在此 claim。
