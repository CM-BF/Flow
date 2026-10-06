# 下一批五棵旧树：限定候选与保留输入

**结论：五棵树的原领取均已释放、当前 clean 且未启用 sparse，可交 Execution Lead 做精确文件核查。不是整树或整目录 sparse 批准。**

[root 独立限定复审](root-five-review.json)已接收五候选与 KEEP，未授权本组 Git 操作。

从已有候选/来源中仅查八棵；web-message-reuse、dashboard-proof-performance、web-context-receipts 已启用 sparse，直接排除。原先已处理四树、两 readability 树、所有明确 donor/活跃预览树及 source-only 稀疏树均不重复列入。

| 候选树 / 原 owner | 固定 HEAD | 全 KEEP 的 own 证据 |
| --- | --- | --- |
| dashboard-architecture-runtime / d01_owner | `6d05ec467581e85d21d5532fd29a2bebd1411b41` | `docs/evidence/d06` |
| web-workspace-lifecycle-baseline / workspace_panels_owner | `12e4f3f4ca8bba8b109eb1efa03a4e50fd0fcc50` | `docs/evidence/wpf-workspace-lifecycle-baseline` |
| web-attachment-input-preview / w01_owner | `2b0a33e6ed00673bc66545577abce0d02148a19a` | `docs/evidence/wpf-attach-i01` |
| attachment-resources / workspace_panels_owner | `c6989b894aa4e9103472279e697d129b28cce5ff` | `docs/evidence/wpf-attach01` |
| web-shared-ack-consumer / w01_owner | `8301991ad698410478bfbfa1c2443cc1bad37a27` | `docs/evidence/wpf-ack01` |

所有路径均在 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/`，分支均为 `codex/<树名>`。

## 权属与精确观察

[fresh D04 原件](fresh-ledger.json)：2026-10-06T21:40:24.865Z，五棵原 claim 全部 RELEASED，八棵无未释放 claim；管理原632a v3/6范围 active、无重叠。旧 status 的 active 历史字段不覆盖 ledger。
[固定 Git 观察](eight-git-observation.json)记录完整 HEAD、branch、clean 和 sparse 配置。未启用只表示本次配置，不声称历史从未处理；Lead 最终操作前仍需核自己的操作记录与现状。

## 已知消费者与 KEEP

[四树原 owner 报告](four-owner-report.md)核实际 fixture / consumer 与 own 输出目录；[D06 报告](d06-report.md)核独立 preview/browser/source-audit 链，[D06 182 个 own 文件索引](d06-own-evidence-keep.json)含16个 .mjs，全部 KEEP。D06 的 `docs/evidence/svc04/interface.md` 固定来源也 KEEP。
[root 当前准备输入独立核验](root-known-consumers.json)：Recovery124、DPERF47、Settings167去重直接声明路径（本次口径），lexical/realpath对八树零命中。只保护这批 sealed 输入，不是全局/所有动态/未来 gate 或其他 Lead 的消费者保证。

- 全部 source/tests/scripts/rules/plans/config/deps/node_modules、ignored/untracked、各树整个 own evidence 均 KEEP。
- 本提案整个 w01、chat06p01、d06 都 KEEP；包含 preview、upstream、provenance、所有 .mjs 和 .gitattributes。
- input-preview61261 与所有其他运行或历史预览、其执行闭包与未知具体路径 KEEP；没有探测或停止它们。
- attachment-production / CONTEXTI 明确 donor 从名单排除。

四树 `d01`、`i01`、`wpf-perf01` 非 own 历史目录的同 tree 对象只形成进一步筛选池。**仍须 Lead 逐 exact file 核 fixed/current/main 身份与引用；有脚本、输入或未知读取的具体路径保留。** D06 也仅提交候选树与 KEEP，未给整目录排除清单。

## 操作与资源边界

[最新 Lead 资源回执](lead-resource-intake.json)：两 readability 已窄 sparse；第二树配置归因不明保留 APPLIED_PENDING_VERIFY 历史，不改配置或重做。Lead 两 native 树短配置窗口已明确归还；重运行窗未开放。
本组本批零 sparse/config/provision/分支写入、零服务/进程/个人预览检查、零 free/du、零测试/PG/Chrome。逻辑字节或同 blob 不能保证物理回收；只 Lead 操作，不能由本报告推 runtime gate 已满足。

机器明细、所有 released claim 与原件 hash 见 [candidate-index.json](candidate-index.json)。
