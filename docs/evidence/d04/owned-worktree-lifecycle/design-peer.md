# D04 owned worktree 清理方案只读审查

固定 main `d0573c7dcf6b051a007b44e84cba4ff74fda247d`；原WT HEAD `1caac8c4856fed6de59d3f7467885563a187a758` / codex/dashboard-coordination / clean，coordination.test.mjs 两提交字节相等。短名 d057 同时命中一 commit 与 blob，本段已解析 commit 完整值，未依赖 moving main。原 status Owner=Execution Lead。没有 fresh claim、项目写、Node/import、Git 合成实验、DB/服务/空间/进程采样；Quick 继续 HOLD，无重运行窗口。

## 结论

Root 三文件私有 helper + pure Git test + 原调用点方案足够，不需包/框架。需要在实现中补清楚以下三点，避免只修 realpath 后仍漏清理。

1. **登记创建意图须早于 Git await，记录 partial creation。** 原29行 mkdtemp未realpath；38–42行 worktrees 数组在 try 内且成功 add 后才push，cleanup未消费它。helper应先 canonicalize独占temporary root与repository common-dir，并在每个 add 前登记唯一 expected子路径/branch（确认该path/ref原本不存在）；成功后补正式worktree gitdir/branch/OID身份。add或switch可能改了登记后报错/中断，不能只追踪“已返回成功”项。失败后对这些已登记intent做精确git登记读取；身份不能确认则保留root并报错，不能按全仓prefix猜归属。不存在目标时不能依赖目标realpath；初始已realpath的parent+固定child名是预先记录的canonical位置。
2. **remove确认和branch确认分别进行，错误不吞。** 原117–119行通过字符串temporary前缀筛全repo登记，在/var与/private/var别名下漏选；branch-D错误全吞。新helper只处理本次记录的exact identities，保留原registered path来调用正式git worktree remove，随后重新读取登记确认该identity消失，再处理自己实际创建的exact branch。预存branch绝不接管；分支已移到未知OID/被非自有worktree使用时保留并报告。不要git worktree prune、扫prefix删除或无条件删除五个名称。每一项失败记录后继续后续owned项；最终有任何cleanup错误都不得PASS。root只有在own登记确实消失、没有未解决身份时才rm，不能用rm伪造Git清理完成。
3. **cleanup不能被更早pool.end或另一个cleanup错误短路，不能覆盖业务异常。** 原116行pool.end抛错会跳过所有Git清理；117/118或DROP抛错也会阻后续步骤；finally异常会掩盖原始断言/创建错误。最窄接线让pool关闭、owned-Git cleanup、原DB/admin关闭、允许时root删除各阶段均有独立错误收集；原error留作cause/首项并附cleanup errors，无原error才单独抛cleanup AggregateError。这里不改数据库授权、DROP策略、账本逻辑或测试断言，更不为验证此补丁运行真实PG。root删除必须由helper清理结果明确许可；如果存在未归属目录/哨兵则留存并报出，而非recursive rm吞掉。

## 最小写范围建议（仍NOT_TAKEN）

- `apps/execution-dashboard/test/owned-worktrees.mjs`：仅Node/Git，私有creation/identity/cleanup职责；不import ledger/server/fixture，不做DB或全仓历史清理。
- `apps/execution-dashboard/test/owned-worktrees.test.mjs`：仅消费真实helper，临时小合成Git repo；不import coordination.test.mjs。后者顶层pg/server依赖使test-name filter不能代替纯Git入口。
- `apps/execution-dashboard/test/coordination.test.mjs`：29/38–46及branch消费处/115–123最窄接线，保五树、handoff、switch-detach与原业务断言。以helper返回身份生成后续payload，别复制一份branch命名算法。
- 必要记录沿原 `plans/d04-coordination/{plan,status,review}.md` 与原 `docs/evidence/d04/` 的此次精确子目录，由manager按原owner领取；不另起大task。helper新path必须在fresh claim明确，当前不写。

建议 Interface 尽量小：private owner对象管理 canonical root + repository；`add(name, branch)` 返回{worktree,branch}；`cleanup()` 返回逐owned结果/错误及是否允许删除root，调用者统一保原error。内部跟踪 creation intent/created ref/正式gitdir，不暴露额外全局registry或通用Git调度。

## 必要有界行为验收（本段全部NOT_RUN）

- 正常：新临时repo、同真实helper创建/切branch/清理，前后own worktree登记与refs差集为空；保一个非自有sentinel worktree/branch及文件内容/HEAD不变。
- 别名：用自有symlink模拟tmp别名（跨平台），在mac可读取实际realpath差异；alias入参→Git canonical listing→cleanup，不能跳过这个case。路径包含空格可同case覆盖，Git机器可读 `--porcelain -z` 避免引号/换行解析误归属。无全仓prefix/prune。
- 中途失败：同helper已创建第一/若干树后真实Git操作失败；保证已登记/已建branch均被回收，原始错误仍可识别。另用自有locked worktree制造正式remove失败：后续own项仍清理，失败项/根保留且cleanup失败被报告；test finally仅解锁自己的树并用同helper收尾。预存同名branch/非自有sentinel不删除。
- 若需证明pool.end失败仍调用ownedcleanup，用原调用点静态审/最小受控错误路径即可，不能为了此片开启coordPG或全dashboard。后续唯一建议入口为 `node --test apps/execution-dashboard/test/owned-worktrees.test.mjs`（仍需固定源/合法scope与小运行准入），不运行旧coordination全文件。

已复用本地 find-skills/codebase-design/clean-code：沿真实Interface测试、定位生命周期所有权、失败完整保真、不给历史资源增加清理权限。源码评审结论不是合成repo实跑结果。
