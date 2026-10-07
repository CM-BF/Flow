# OPS-001-11：已交付工作树的收尾候选

本次为 **准备清单，未授权或执行回收**。唯一当前状态在 [OPS status](../../plans/ops-001-status-review/status.md)，本记录不成为第二资源账本。观察截至 2026-10-07 02:10 UTC；文档、Git 元数据和有界进程/打开文件核对由 assignment_review 只读完成，Lead 补充既有 donor 事实及 fresh 协调账本。没有安装、产品检查、PG、服务操作、依赖内容扫描、删除或稀疏化。

本轮 GO 已有完整目录测量：Flow-worktrees 72,157,508 KiB（约 73.89 GB），183 棵树、157 棵有依赖，Flow 主仓约 1.04 GB。本记录复用该结果，不重复扫描。du 分配块、逻辑字节、同次 hardlink 去重和 APFS clone 的实际回收量不同；不能把目录合计或空间上涨归因于本次工作。空间恢复后，已准备工程验证仍优先，本清单不占共享运行窗口。

## 三棵固定候选与明确保留条件

三树均在本轮观察中 clean；完整 HEAD 与实际远端 feature 分支一致，没有未推送提交。源码接收依据分别核固定 main receipt 与对应源 blob；当前 main 后续演进不要求退回旧 blob。可见进程参数路径及打开文件查询没有命中，但未枚举所有外部依赖链接/未来懒加载使用，不能据此证明“无消费者”。

| 工作树 / 原 owner | 固定 HEAD / 接收依据 | fresh claim 与消费者 | 本轮结论 / 下一有限动作 |
| --- | --- | --- | --- |
| `browser-connection-session` / native_center_owner | `239b6a818d5c0380842aa61120bf308bb9846df3`；7 源逐 blob 同接收 main `84005a260dfcb668cd38b09c21564d0754a0f513`。产品 `582f41f1957709982750f5de5306738e064960ce` 非 main 祖先是精确源码接收方式，不是未集成。 | `035119fd-69cb-48c0-b2c9-1d9de30fb0a4` v2 RELEASED；受限三树源码/配置绝对路径查询无互引，但外部或冻结 donor 消费者未核全。 | **仅可准备依赖退役，当前 KEEP**。先由原 owner 确认实际/冻结消费者和需要保留的运行入口，再核当前依赖可从固定本地来源精确恢复；两项未闭不操作。 |
| `tui-queue-controls` / assignment_review | `e5c47893b5973571ac02d55bd7b510952d59c06f`；11 源同 main `d4a2e0a7f255a2c68b99c7aafbc006c7bc3b3b50`，产品 `22f0e2c2b702112aa1a5d1b36874b56165cd267e` 祖先成立。 | `625e77c6-303a-40f2-a665-706b6df986b9` v2 RELEASED。OPS 2026-10-06 14:22 已明确其 node_modules 为 COST 的第三方依赖来源；这项实际 donor 关系尚无解除证据。 | **KEEP**。须由 COST 消费者 owner 明确迁移/解除固定来源，再考虑恢复闭包。无 openfile 不替代消费者解除，不影响 COST 原候选。 |
| `native-harness-host` / assignment_review | `8a148c5f4288d3f3075bf4bde78504b5214c87f3`；7 源同 main `9d6bd45a`，产品祖先成立。 | `3f2622a4-0a55-4122-8522-7f4ed388d875` v2 **ACTIVE**，仅持 `plans/r05-native-harness-host`、`docs/evidence/r05`；源码交回不等于整树释放。根 node_modules 已不存在；server/runner/web 残留直接失效链接分别 6/1/14 条。 | **KEEP**。当前无根依赖大目录可再次退役；不清失效链接、不隐式释放文档 claim。由原 owner 在已有合法文档范围收口后再评估用途。 |

协调账本在 02:08 及落文前只读核对保持以上状态。无当前 preview 命中只代表这次受限观察；历史启动/日志须由原 owner 保留，不能推断未观察的客户端或预览无人使用。

## 唯一状态与不可丢材料的去向

**本轮不迁移 authority 或证据**。以下原树仍是 registry 的唯一来源；main 中的发布副本不自动取代它。各树根、`.git`、分支、固定 Git 对象/远端、完整自己的 plan/status/review 与原始证据继续保持。

| 原树唯一入口 | 完整自有证据（原位置保留） | 已有恢复线索及限制 |
| --- | --- | --- |
| [WPF-CONNECTION01 status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/browser-connection-session/plans/wpf-connection-session/status.md) | `docs/evidence/wpf-connection-session/`，尤其 `main-receipt.json`、`fixed-manifest.json`、`README.md`、`install.stdout`、`tool-receipts.json`；保留专测/fixture 与原失败、清理记录。 | 历史 581 包离线复用/hardlink 安装；不能证明当前 CAS 完整、属性/生成布局可还原或启动闭包可用。 |
| [TUI01E status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-queue-controls/plans/tui01e-queue-controls/status.md) | `docs/evidence/tui01e/`，尤其 `main-receipt.json`、`manifest.json`、`protected-inputs.json`、`install.txt`、`install-confirmed.txt`、`install-exit.json`、`install-wrapper-note.json`；保留真实 PTY fixture 和原 red/green。 | 历史离线安装确认；当前 COST donor 关系与完整恢复证明均未解除，全部依赖保持。 |
| [R05 status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/native-harness-host/plans/r05-native-harness-host/status.md) | `docs/evidence/r05/`，尤其 `main-receipt.json`、`manifest.json`、`preservation.json`、`install.txt`、`docs-amend-receipt.json` 与 `README.md`；文档 claim 仍有效。 | 历史 540 包离线复用，不追认当前 runtime-ready；先前根依赖清理的真实回收量仍按旧 OPS 记录。 |

三树共同保留根 `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`，固定 pnpm 9.15.4 的版本线索，以及所有现有源码、测试、规则、plans、自有 raw、生成/被改材料、运行输入、ignored/untracked 文件。锁文件存在和“可以重装”不是删除许可。独有原始材料若没有可验证固定归档来源，始终保留；不能用只保存摘要或 main receipt 代替原文。

## 后续新片段交付时的有限收尾接口

以下直接补充现 OPS-001-11，不新设平台、清理脚本或重复状态源。完成产品接收时，owner 在自己的 status 写清四种不同事实：**产品已集成、当前运行是否需要该树、证据唯一来源、可退役资源的精确范围**；不能把 delivered 自动解释成可删。

1. **交付与写权**：固定实现/独审/接收 commit 或精确 blob 清单；说明 dirty、untracked、未推送 commit 和必要保留内容。作者停写后按现账本释放或明确交接；有效 claim 和 unknown 不回收。
2. **消费者与预览**：由原 owner 和已识别消费者确认运行、冻结验收输入、donor/链接、动态入口；保留用途、启动方法、固定源和有限日志。明确保留的预览与个人服务不动；暂时无 PID/openfile 不能消除未来读取依赖。失效链接单独归属，不当可删证明。
3. **状态与证据**：默认继续使用原 WT 的唯一 status 和完整自有证据。若未来确需迁移，先在一个确定、持久的目标保存原字节和链接闭包并核 hash；由合法 owner 协调 registry 单次切换，验证新入口可读和既有 proof 仍绑定固定 Git 后才退役旧副本。不得同时登记两份 authority，也不得先删树再补入口。本轮没有这种迁移。
4. **派生依赖与恢复**：仅对具体范围区分包 payload、生成/被改文件、缓存、布局/链接与平台属性；核本机固定可恢复来源及真实运行资源闭包，缺项保持。复用既有单树恢复方法，样本成功不冒充全树恢复；不联网安装/升级来假定原版本可还原。独有证据不是派生依赖。
5. **执行另行绑定**：候选通过不继承旧 sparse、cache 或单树依赖操作许可。后续若授权操作，唯一 operator fresh 核范围/身份/claim/消费者与恢复依据，持久记录允许变化的本树配置和禁止变化的其他树/共享配置；不删 WT/分支/Git 对象/用户资料。未知保留，不重做历史不明操作来凑绿。
6. **结束与重新使用**：记录精确变化、保留 hash/来源仍可读、实际卷前后观察及限制，不按 du 许诺收益。退役依赖后显式标记 NOT_RUNTIME_READY，未来执行先按固定恢复方式还原、核实际入口并重新准入。明确保留解除条件，避免每次交付永久新增安装和 fixture 服务。

本地方法复用已读 find-skills、codebase-design、clean-code：证据权威、服务生命周期、依赖恢复和 Git 操作各自负责；不把它们合成第二资源调度器。本次仅文档、链接与事实核对，实际工程验证按原 ready 队列继续，0 新运行预算。
