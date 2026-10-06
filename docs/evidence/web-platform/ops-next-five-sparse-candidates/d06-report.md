# OPS 四树 sparse 候选只读筛查

本报告仅按 root 改派后的四树，不扩名单。结论：**三树已有 sparse，排除；仅 dashboard-architecture-runtime 可交 Lead 作 exact-file 后续核查**。不是执行许可，也没有生成可删清单或空间收益估计。fresh D04/旧 owner 停写由 manager 核；本段只读 Git/本地固定证据。

| worktree（父目录 /Users/citrine/Projects/AgentHarness/Flow-worktrees） | 分支 | 固定 HEAD | 观察与结论 |
| --- | --- | --- | --- |
| web-message-reuse | codex/web-message-reuse | 9cea63212b13c624fde53981721aee116d0caeed | clean；worktree sparse=true/cone=false；655行规则、654 evidence 索引 S；已处理排除 |
| dashboard-proof-performance | codex/dashboard-proof-performance | 08bd0a71494f54809f4c4a2fa5b9718285103ea3 | clean；sparse=true/cone=false；311行规则、310 S；已处理排除 |
| web-context-receipts | codex/web-context-receipts | 66695c6579189644ae6399dcaca80cc04487a178 | clean；sparse=true/cone=false；732行规则、731 S；已处理排除 |
| dashboard-architecture-runtime | codex/dashboard-architecture-runtime | 6d05ec467581e85d21d5532fd29a2bebd1411b41 | clean；无自身 config.worktree / info/sparse-checkout、worktree core sparse 未设置、evidence S=0；仅此树为未处理候选 |

每树真实 gitdir 均为 Flow/.git/worktrees/<同名>；config/规则 hash 与精确路径在 audit.json。共有 extensions.worktreeConfig=true，但前三树必须用 `git config --worktree --get` 才准确读到本树 true/false；没有改任何配置或索引。旧被替换名单只做先前轻读，不加入候选，不继续查 PROFILEUX。

## 唯一候选的 owner 与必须保留 closure

权威 `plans/d06-architecture-refresh/status.md` 明确 d01_owner、delivered/main-integrated、固定图源 aeb、五执行源码6570、main cde6646接收；plan 末段记录原四scope已6cad v2释放及一次窄 metadata纠正。status 留历史active字段不当作本次仍 active；当前写权/释放仍以 manager fresh ledger 为准，不由本报告授权。

- **完整 `docs/evidence/d06/` KEEP**：固定树182个 tracked 文件，16个 .mjs。独立 `d06-own-evidence-keep.json` 列全182 path/Git blob/current type；没有缺失文件。包括根/current/context/stream/runtime/snapshot-aeb 历史截图、原失败、review、source binding、全部 preview/browser/source-audit.mjs，不能只保最新子目录或仅JSON。
- **所有源码/测试/脚本/rules/plans/deps/node_modules KEEP**。五源码清单在 snapshot-aeb/candidate.json：architecture-data.js、architecture.test.mjs，以及 snapshot-aeb 三个 .mjs。其只读依赖 renderer JS/CSS、public app/styles、server、package.json/lock 也 KEEP。
- `snapshot-aeb/preview.mjs:1–2,7–16` 实际导入 execution-dashboard/server.mjs、human.mjs，提供静态 renderer 与显式空 snapshot；这些源码及递归导入所属 source/deps 一律保留。历史根 preview 还导入 registry，不能用“新preview空snapshot”推断所有历史入口无 source/登记依赖。
- `snapshot-aeb/browser-check.mjs` 实际消费 @playwright/test、同目录preview、五源 current bytes、Git HEAD/status，并写 own证据。完整 node_modules 与包闭包 KEEP；未遍历 symlink/package 全树，不声称 donor可删。所有已知 donor/未知路径按 KEEP。
- `snapshot-aeb/source-audit.mjs` 以 `git show baseline.commit:path` 读取106个固定来源；其中包括 `docs/evidence/svc04/interface.md` 和工程计划。**svc04/interface.md 也保守 KEEP**；Git对象存在不等于允许剥离 provenance。完整 Git common objects/worktree元数据不在本次候选排除范围。
- 额外强制 KEEP：whole `docs/evidence/chat06p01/`、w01可执行preview及其upstream/provenance闭包、所有 `.gitattributes`、所有d06 .mjs。尚未具体分类的文件也 KEEP，Lead不能从“非own”直接推可排除。

## 已知预览证据，非当前进程保证

仅读取旧 raw：snapshot-aeb 在2026-10-06 12:46:45.312Z记录 http://127.0.0.1:58373/，9034.4225ms、browser/preview cleanup均fulfilled。另旧证据分别记录runtime49510、context58394、stream50039、current58207、根55247。它们是历史测试地址；本次没有查询端口/进程，**不声称当前已停或可停**。预览入口与证据整体KEEP，因此不需以停止服务换取候选。PROFILEUX旧preview单独显式KEEP，未继续核查。

没有发现需把这唯一候选整树移除、停服务或移动node_modules的依据。后续只能由Lead在manager核权后，对非执行且不在上述closure的具体证据文件逐项决定；本报告不给整目录sparse规则，不保证未知/未来consumer没有依赖。

## 方法与限制

按已有本地 find-skills/clean-code 方法复用已装版本：分清“已处理排除/待核候选/必须KEEP”，closure证据优先、未知保留，不把逻辑文件大小当物理释放。没有安装技能，没有du/free/lsof、服务API、个人页/凭据、测试、PG、Chrome、symlink全盘扫描；仅四指定树的Git轻核、唯一候选own目录清单与有限固定内容。Recovery source/prepared candidate 原样。Lead是唯一后续 Git/sparse 操作者。
