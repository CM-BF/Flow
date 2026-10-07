# D04 自有测试 Git 生命周期

当前三源固定见[source manifest](source-manifest.json)，原树base1caac8；五scope新领取，无产品ledger/server/CLI变更。

`createOwnedWorktrees(parent?)` 创建canonical独占临时根、一个最小合成仓库与inputs目录；`add(name, branch)` 在Git add/switch前登记intent，返回exact worktree/branch；`cleanup()` 逐项正式remove、核登记消失、核branch目标再删，并返回errors/rootRemoved/remainingOwned。只有无剩余登记、未知branch或根entry才可删除根。单force遇locked会失败，不双force、不prune、不扫历史；后续项仍清理。调用者只往inputs写本次请求。

原coordination测试仍执行同一PG/CLI/snapshot业务断言，但FLOW_COORDINATION_REPO指向合成仓库，不再复制真实Flow五个HEAD。pool关闭、Git清理、DB DROP/admin关闭各阶段独立收集错误，保原异常为cause/第一项。数据库授权、生产数据与原断言不改。

独立pureGit文件只导入Node builtins与真实helper：5个静态用例覆盖正常五树、自有symlink别名/空格、真实post-checkout部分成功失败、locked失败与继续、外部哨兵/预存branch。没有import旧coordination.test的pg/server入口。测试源码不等运行证据，未来必须固定审查+局部槽/资源准入；本次无Node、合成Git、PG、HTTP、Chrome或空间采样。

官方规则参考：[git-worktree](https://git-scm.com/docs/git-worktree)的porcelain -z与locked remove。这里仅沿parent已核的具体依据，不将文档当实际行为验证。
