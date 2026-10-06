# O01 首个纵向片段交付

实现 target：`a4e1348bc514d9c32cadc5239df22111a12e9faf`。独立分支 `codex/goal-orchestration`，base `8c27fed78e812474070ed946218abbfaf81da77c`。目标是持久命令受理、实际输入/依赖版本和受限工具；O01 整体仍 open。

2026-10-06 03:18–03:20 UTC：公开真实 PostgreSQL/HTTP 9 项 + 纯工具 2 项，**11/11**（14.94s），固定 target typecheck 通过。采用生产 `createServer` 内置 goals 挂载（Lead d814，本树 a101）；测试的旧未挂载 fallback 条件此版本为 false。diamond 使用两个独立 `apps/runner/src/main.ts` fixture 进程，测试进程与 runner PID 分开保存在 JSON。无模型/云调用。

| 验证 | 实际结果 |
| --- | --- |
| 原始 goal / 权限 / 幂等 / 重启 | 原文含首尾空白保留；owner-only；幂等重报相同结果，改内容冲突；重启事实不变 |
| 输入和原子受理 | 跨项目节点、旧输入版本、缺依赖拒绝；同事务写 task/wake/execution；双授权只有一份 task |
| Diamond | A v1 通过后 B/C 独立执行；运行中改 B goal/constraints/acceptance，旧 B 不可接受，C 仍有效；无关项目 revision 不失效；替换 A 后 B/C 待重核 |
| 实际执行输入 | runner 的 task prompt 包含固定原始 goal、B v2 实际输入、精确 A v1 产物引用与内容；旧产物仍可查询 |
| 失败/恢复 | 失败及 verification failed 不可接受；明确 previousExecutionId 才可再次授权；uncertain 跨中心重启不重派、不自动重跑 |
| 轻读/上限 | 一节点原始字段 7,000 ASCII 字符 + 实际输入字段 7,000 字符样本，snapshot **7,996 bytes**；无重复 input/依赖内容，完整输入按需读。合法字段序列化后超过 16,000 字符的 prompt 明确拒绝，不截断、不受理 |
| 历史/回滚 | immutable 历史 UPDATE/DELETE/TRUNCATE 由数据库 trigger 拒绝（本测试实际 DELETE）；注入执行存储失败后 task/binding/解释不提交，同 key 可安全重试 |
| 既有 submit | 原 202 受理、幂等冲突、未知 resume-session 校验保持 |
| 受限工具 | host 固定 goal；完整 input read 与命令受 node/action allowlist 限制；未知字段、越权节点/动作、非法版本在 transport 前拒绝 |
| no-op 因果解释 | Root P2 先红后绿：A no-op 返回自身原始 input/accepted binding 的持久解释，B 插入其他事实也不影响；不写新解释 |

字节数字仅是上述固定 ASCII 样本，不是所有 200 节点的测量或吞吐/SLO。图上限复用 G01 200 节点/2,000 edges；当前内部一致性查询有界但仍读取当前 input。历史 execution 查询 limit≤100，解释轻读最近50条。`read({})` 有意允许整个固定 goal 的轻量概览，**不是逐节点元数据隔离**；allowlist 限完整输入与修改。

## 证据和复跑

- [源码/原始 JSON hash、环境与清理](manifest.json)
- [11/11 stdout](production-tests.txt)、[typecheck](typecheck.txt)
- [diamond 实际输入和版本](final/diamond.json)、[uncertain 重启](final/uncertain.json)、[轻读与上限](final/bounded-read.json)、[no-op provenance](final/noop-provenance.json)
- [最初入口红测](initial-red.txt)、[工具红测](tools-red.txt)、[P2 红测](provenance-red.txt)、[P2 修复后局部](provenance-green.txt)

在此 worktree：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm install --frozen-lockfile
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/goals/goals.test.ts apps/runner/src/goal-tools/goal-tools.test.ts
```

专用 `flow_o01`：测试先取得独占 advisory lock；已存在数据库则拒绝开始，不清除未知数据。自建后由 afterAll 关闭 server/runner/pool，删除自身库与临时资料。动态端口，不碰 4320。需要另存原始 JSON 时设 `FLOW_O01_EVIDENCE_DIR` 为新的临时目录；写入使用 exclusive flag，禁止覆写本次原证据。

## 审查与限制

Goal Owner / gpt-6-astra 于 2026-10-06 03:20 UTC 对固定 a4e1348 只读 **APPROVED**，P2 CLOSED：已读完整实现、迁移、测试和4份原始 facts；reviewer 未重跑，author 检查如上。此批准只覆盖本首段。

未实现/未验证：原生 Claude tool 挂载、自然语言拆分/规划推理、语义验收、完整统一解释、自动依赖重执行与取消传播、真实模型或外部副作用预算。原文 acceptance 被保存并进入实际输入；现有 nonempty/contains verifier 只验证指定规则，不能证明自然语言验收。SDK 0.3.290 的 tool/createSdkMcpServer 仅核验本地类型能力，未调用 query 或模型。后续由 Lead 依 E01 harness/预算和独立 claim 安排，不把本片段当完整目标完成。
