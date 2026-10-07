# SVC09A 固定组合产物准备

状态：READY_FOR_PREPARATION_REVIEW，实际 build/install/import/PG/host/provider 均 NOT_RUN。本候选只生成供后继隔离宿主使用的新产物；不是双槽旅程通过或个人激活许可。

## 来源与复用

产物来源为 Flow 仓库的固定 `098b0d51512dfaa04c30ca7cbe103684720fe29f`，tree `f9f149a4dda976dad500545df1b26f825ac5b59d`。它是 `04da8069` 加 [15 个已审路径](../source-composition.json)，不是整个当前 main。Lead 已创建并 push 唯一 source-only assembly；本 worker 不改 assembly/main/shared Git config。builder 的 repository 参数仍为 `/Users/citrine/Projects/AgentHarness/Flow`，通过 Git 对象读取固定 target，不改变 checkout，也不把 worktree 来源改名成个人来源。

执行工具与产物 source 分开：复用 SVC06B 已审 `runFixedArtifact` 可调用入口、原 SVC06 builder/parser/cache closure 以及 OPS14；本薄入口只组装固定输入。原 builder 的 count2 在本次全新空 store 的一个产物上有效；产物中的 count4/1GiB 单件/2GiB 合计工具字节来自已审203ec，15 项全部在 build 后逐值核对。无需给 assembly 或他人树新增 YAML alias，不复制/安装 donor，不复制 builder 或监督实现。

[inputs.json](inputs.json) 仅存原 40316B input 的精确来源、3 个原方法、已固定组合表和 lateLogout 输入的引用。组装时先核全部原 bytes/hash，原 17 个 builder/安装入口不变；72 个原 source 中9项由组合表精确替代、63项继承，另加3 lateLogout 和15组合项，去重后81项。所有33 SQL、271 snapshots、7 importers、lock/manifests/cache 选择沿原 input，未重新复制清单或 hash 整个缓存。实际 builder 仍逐项核原缓存/克隆 payload，不以历史准备代替执行核验。归档投影1000文件/7,897,181逻辑B，不代表磁盘峰值。

## 唯一实际入口与停止语义

准备独审和实际 heavy 窗口就绪后，在本 WT 运行一次：

```text
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/opt/python@3.13/bin/python3.13 docs/evidence/svc09/message-settings-activation/host-integration/build/supervise.py --execute-fixed-build
```

调用前 fresh 核原 claim v4、固定 caller/输入/17 inherited runtime、098b Git/source、namespace 与实际共享资源。`outer-report.json` 以0600 wx独占，`actual-first` 必须不存在；新私有根仅用 `/private/tmp/flow-svc09a-artifact-`，不存在旧 cd27/7d1 或个人目录操作。任一已消费/unknown 不覆盖、不换名重放。`preparation.json` 绑定 caller/输入/局部原件；原样保留首次失败。

OPS14 一个 NEW_CHILD_SESSION 管理 Node/build/clone/pnpm/proof；420s work +0.5s TERM +2s reap，取消与进程组观察沿原实现。构建内部 archive/clone/install/proof各原期限不放宽。进程停止决策先于外层 fsync；422.5s是监督工作与收尾额度，不声称文件系统持久化具备额外硬中断保证。外层 exit0 仍须 raw report.exit_code0、无 first_failure、owned_state absent 与双 EOF；不能将历史 EPERM observation 直接当 absent，不能以顶层退出代替全部已归属组事实。

## 资源与输出

继承新增预算2,317,352,960B：安装/最终单件≤1GiB（同卷 stage→final rename）、seed≤512MiB、private pnpm home/cache≤128MiB、source archive≤32MiB、metadata≤512MiB、raw≤2MiB。最低 fresh≥3,927,965,696B，并取原 builder 2.5GiB 门槛和执行时真实全部并发/保留资源所需 floor 的最大值；原1GiB live reserve与可用空间下降采样门不降。500ms采样不证明物理峰值，缓存文件/其他 writer 的变化不能归因本工作。

外层 capture≤1MiB，原 build record/import 输出与最终 raw 总2MiB门保留。失败/unknown按原 caller保留本次stage/root/locks与原件，不自动清理或重试；成功也 KEEP 完整artifact/root及构建原件供下一独审/隔离宿主，KEEP不是运行组仍活。后续不得把这个builder副作用预算与 host fixture 预算相混。

## 已做和未做

`local-01` 是唯一新准备检查：2个不同断言组（严格argv先拒绝；真实固定输入加载/15替代去重及原界限），Python AST另通过；66ms/204B、组absent/双EOF、空scratch同身份removed。没有导入 builder/SDK/native，0install/build/PG/HTTP/provider/个人读取；它只证明装配与参数，不证明实际产物。

真实执行将复用原 runtime-proof：只在新产物内部加载已安装模块并验证来源/选择，0factory/runner/native binary/provider；SDK模块导入与真实SDK query分开。结果应给实际 descriptor/manifest hash、81源/33SQL/271闭包断言和原raw，以及所有owned进程的收尾。新settings槽实际注册、目录、mixed claim和维护仍待下一隔离host消费者，不能从本build成功升格；用户Web/TUI/实际provider/个人激活仍开放。

本工作段应用既有find-skills/codebase-design/clean-code记录：只复用稳定可调用入口，改动限定输入覆盖和命名空间，状态/失败/资源权威不复制。小局部结束复核无新增通用包装器或第二生命周期。
