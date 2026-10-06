# Claude message settings core — source checkpoint

权威 [plan](../../../plans/wpf-mature-02-message-settings-core/plan.md) / [status](../../../plans/wpf-mature-02-message-settings-core/status.md) / [review](../../../plans/wpf-mature-02-message-settings-core/review.md)。Owner status_read/gpt-6-astra；co-lead mika；所属大task [WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md)。

唯一 WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core`，branch `codex/claude-message-settings-core`；base `70cc4e852365e974cefde30bfad75c7d233985c6`。Lead provision receipt 已保存为 [provision.json](provision.json)；领取 [claim-receipt.json](claim-receipt.json) 在任何项目写入之前 COMMITTED。

## 本次范围

两个新 contract/test 文件，没有 shared index export 或产品接线。五个入口是 request schema、choices schema、canonical JSON、可信组合判断、ACK 精确 matcher。只有 zod 依赖；输入/输出是数据，未知/不支持/身份不符明确分开。完整内容进入未来原命令幂等 digest，不建立第二状态、settingsRevision 或第二 hash。

not-requested 仅描述未发送 effort 请求，不承诺 native session 清除旧值/default。policy allow 不是 provider/账户资格；未来 caller 必须验证来源，bridge 必须拒绝不能确定的 resume 行为。当前没有 observed 内容，因为未运行 SDK；旧 requested/effective 与 digest 文件均未改。

## 检查与资源

初始 source checkpoint 4e7b7f968a2160a60989b3b6343506ae8fb5ef6a 写测试与实现后尚未验证；没有伪造 baseline red。资源准入满足后实际 Vitest5/5（6ms）与局部strict0，见 checks.json/原始log及exit。0 PG、0 provider/SDK、0 target；检查没有扩大产品范围。

fresh df 1,043,349,504B < 1GiB；执行门槛至少 1GiB+32MiB = 1,107,296,256B。依赖未安装，也没有 node_modules symlink。evidence 内显式 Vitest 配置仅 alias 固定 zod/Vitest 包，test root 始终本 WT；局部 tsconfig 继承现 strict/ES2023/noUnchecked 基线，只include两源。配置方式获 root 批准，两项执行前fresh分别达到1,118,162,944 / 1,118,031,872B；自有cache已清。

只读定位现有依赖：main `node_modules/.pnpm/zod@4.6.5/node_modules/zod`；Vitest 4.0.18、TypeScript 5.9.3、@types/node 24.19.1 均已有。不会把 root 产品源码 alias 为本树被测对象，不改共享 git/sparse/lock 或安装。

## 登记请求

taskId `WPF-MATURE-02-CORE`，planDir `plans/wpf-mature-02-message-settings-core`，worktree `claude-message-settings-core`，owner `status_read`，branch `codex/claude-message-settings-core`。待 Lead 登记；不声称当前 dashboard 已聚合。父计划/共享入口后继由各 owner 合法 scope 接线，本片不抢占。
