# D04 自有 worktree 生命周期 · 固定源窄审

结论：**CHANGES_REQUESTED_SCOPED_SOURCE_ONLY**，1项 P2；未运行 Node/import/test/合成Git/PG/页面/服务/空间或进程检查。固定 target `310e0eed725fb3a3d8ef1be959e7058f51b2f17e`，base `1caac8c4856fed6de59d3f7467885563a187a758`。三源码全文与差异均从Git对象读；实际HEAD=target，branch正确，owner自己的plan/evidence正在修改，未读其moving内容为结论。完整sourcehash见audit.json。

## P2：初始化成功后的两次读取失败会绕过所有权清理

`owned-worktrees.mjs:66–67` 的 `git rev-parse HEAD`（helper设5s timeout）与 `.git` realpath在53–65初始化try/catch之后。到这里已取得临时root、完成git init/commit，但尚未返回owner。任一调用失败，例如rev-parse真实命令超时/启动失败或.git读取权限/IO错误，会直接reject；此时 `coordination.test.mjs:28` 的 createOwnedWorktrees也在该测试34行try之前，pure helper `withOwner:23`同样在其try前，因此调用者无owner可cleanup。根目录/仓库必被保留而没有cleanup receipt；不是正常“未知identity保留并报错”的有意合同，而是没有进入清理代码。

相同更早窗口见47–48：mkdtemp已创建后realpath/lstat若失败也在try之外。无需制造一般依赖注入框架：保存mkdtemp原始自有路径，把后续canonicalization/identity/git init/initialHead/commonDirectory初始化放入同一try/catch；已知仍是自有root时清理，identity无法确认时返回/抛带明确剩余路径的清理错误，始终保原error为cause/首项。两phase初始化不应在owner返回之前遗失清理责任。当前5pureGit用例只覆盖owner已成功返回后的add hook错误，没有覆盖这个窗口；可补最小可控初始化失败回归，继续用真实小Git fixture，不运行coordPG。

该项为可从控制流确认的源缺口；**没有执行故障注入/实验，不能称已实跑复现**。

## 已核正确的具体范围

- helper 47把已创建tmp canonicalize，22–31解析NUL分隔porcelain，98按exact canonical身份匹配；旧字符串prefix问题消除。记录registeredPath用于正式remove，没有全仓prune/历史清理。
- add83–92校验唯一字面名/branch/path，88–89在add/switch之前登记intent；post-checkout失败时partial注册仍可被remove。正式成功后记录gitdir，cleanup核root dev/ino/common path、worktree head/branch/gitdir。
- remove108只single-force；锁定tree错误保留，130–133捕获后继续其它own树。remove之后重查注册、branch OID/是否被用，再branch-D并确认消失；不再吞分支删除错误。
- cleanup136–143若有非ownworktree/其它branch/根哨兵便保留root；仅全own登记消失且没有错误后rm。纯Git sentinel用例102–128核其HEAD/branch/content保持，finally只清自己的sentinel。
- coordination119–126让pool.end、owned.cleanup、DROP、admin.end分别收集错误，原body failure作为AggregateError首项/cause；不因第一个cleanup抛错就跳过后续。原DROP FORCE策略未改，本审不对旧DB生命周期授新安全结论。

## 原业务断言与可执行纯Git入口

coordination所有4个test定义、所有assert调用保持；仅peers返回branch/worktree替代重复名称拼接、request文件放inputs、synthetic repo替代Flow真实repo与finally清理。仍通过原CLI真实子进程取take，仍有PG原子冲突/稳定key replay/changed request/范围冲突/CAS版本/handoff占用/旧owner/陈旧不可抢/readonly reviewer/audit，以及真实fixture snapshot未注册claim可见且不当进度源。未降低skip策略（无adminUrl仍skip）、20s timeout或剩余unknown/blackhole断言。

新 `node --test apps/execution-dashboard/test/owned-worktrees.test.mjs` 是直接消费真实helper的5个pureGit用例：五树正常、symlink/空格别名、真实post-checkout在注册后失败、锁定own不阻后续、非ownsentinel保留。仅Node内置模块，无pg/server/ledger imports。此命令只是未来已授权小窗口入口，**本审没有运行**；不能宣称正常/别名/失败都PASS，也不能把pureGit当PG/CLI行为重跑。测试自己的git wrapper继承环境，因此未来监督入口仍应过滤外部GIT_DIR/GIT_WORK_TREE等污染；这不改变本fixture有意设置的local hooks。

## 方法/限制

沿已有本地 find-skills、codebase-design、clean-code版本，复用已审设计报告 `/private/tmp/d04-owned-worktrees-review-33lgp8jw/report.md`。本次实际应用：Interface承诺的所有权覆盖从创建到返回前后的全部失败段；纯Git测试消费同一helper，不mock cleanup自证；错误聚合保原cause；未要求新包/通用框架。未查看用户服务/个人目录/凭据，未写项目或Git配置。Quick新窗口到达应优先交还此只读安全点，不占运行槽。
