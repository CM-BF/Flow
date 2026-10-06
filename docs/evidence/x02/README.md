# X02 注册中心交付证据

2026-10-06。独立worktree `plugin-registry` / `codex/plugin-registry`，base edee6b1c5d74c2ee46ec98bab2844579db6a00c4。本目录是本片段证据，唯一进度在 [status](../../../plans/x02-plugin-registry/status.md)。

已实现 [公共合同](interface.md) 的全部7个路由；接线接口 migratePlugins/registerPluginRoutes。测试通过真实center owner hook+真实临时PG+动态HTTP端口接入，生产共享index尚由主Lead接线。registered/unavailable始终明确：包名称/精确semver/digest/许可都是operator声明，没有下载、实际完整性验证或第三方执行。

## 真实检查

Node24.20.0 / pnpm9.15.4 / Vitest4.0.18；固定依赖离线安装且ignore-scripts，无新依赖/lock改动。

`pnpm exec vitest run apps/server/src/plugins/plugins.test.ts --no-cache --configLoader runner`：17 selected / 17 passed，1.25s（test942ms），[原始输出](boundaries-green.txt)。测试每次创建 `flow_x02_<pid>_<uuid>`，不存在才CREATE，独占动态HTTP，finally只删除自己创建库，无用户文件/既有服务操作，0模型/0云。功能检查约03:36–03:43 UTC执行，其中少量与Web正式性能窗口同机并行；本报告不提供性能SLO结论。

覆盖注册默认无grant/不可执行、精确声明、版本不可改、选版显式清空config/grant、固定历史revision、配置boolean/integer/enum及原型属性、旧revision/双事务CAS、注册唯一scope并发、同key原结果重报/异输入冲突、中心重启同receipt/operation、owner/runner鉴权、project scope与外scope游标、unknown major/秘密字段/未声明权限拒绝、UTF8请求32768/响应65536字节和页40/审计页2、9种直接SQL历史修改拒绝。配置拒绝不回显合成秘密marker，未声明内容不前进revision。

[typecheck](implementation-typecheck.txt)通过；`git diff --check`通过。先前[注册red](registration-red.txt)→[green](registration-green.txt)、[commands red](commands-red.txt)→[green](commands-green.txt)、[versions red](versions-red.txt)→[green](versions-green.txt)保留。边界首跑[14/15](boundaries-first.txt)发现数字prerelease前导零未拒绝，修为精确semver后含新增integer/enum与并发注册17/17；未删断言或跳测。

## 限制与后继

- operation succeeded仅PG注册事务提交；拒绝命令返回HTTP错误，不生成一个假装受理成功的operation。只存输入摘要和before/after revision，原命令reason纳入digest但不持久/回显全文；无故障包加载操作可恢复声明。
- 公开配置schema不是完整JSON Schema；没有自由文本或secret引用入口，普通元数据均属operator提交的公开声明，系统不能识别误放在名称/许可等公开字段中的任意秘密。
- grant是本scope中声明能力子集的注册事实，不是执行授权凭证。无active task/session binding、resolver/loader、enable/disable/remove、第三方隔离或实际Web/CLI旅程。
- 版本/operation列表和安装列表有界，但分页不是跨请求冻结快照；版本及安装按ID，operations按afterRevision。mutation replay返回原snapshot；当前状态另GET。
- trigger保护正常SQL操作的不可变历史，不声称DB超级用户无法改schema。

待独立review与主Lead共享接线/集成。架构变化由D05/主Lead基于最终已审并集成target登记，不能在main图显示分支实现已上线。
