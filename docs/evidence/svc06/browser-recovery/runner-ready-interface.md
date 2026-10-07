# 当前 child 初始化证据

本片相对 main57ab 的7个 authored 源/专测；固定04da恢复补丁另列为静态候选。新增证明仅为本次 child 已越过本地初始化 guard，不能证明中心 accepting、实际领取、SDK模型成功或恢复部署完成。

| Module | Interface/所有者 | 不变量与失败 |
| --- | --- | --- |
| runtime → main | 既有 onNotice 增加 runtime-initialized/runnerId；main 仅转父进程建立的 IPC | 先 identity/bind、outbox/final recovery、unresolved/capacity、显式body/plugin guard和 durable opportunity；每次 runRunner 最多一次；callback抛错不改变原primary/请求；不增加claim。protocol分支没有正证据，保持unknown。 |
| service wrapper → startup diagnostics | observeStartupChild(child, diagnostic, {runnerId}) | 私有IPC只接受首个exact三字段帧；实际child.pid取本父handle，runnerId必须预期身份。错身份/额外字段/畸形/缺失不产生positive。一次后disconnect，无持续IPC队列。stderr仍只原64KiB drain，不解析SDK文本。 |
| diagnostics → waitReady | readRunnerInitialization(directory, recordKey, record, runnerId) | 同nonce/recordKey/wrapperPID、真实childPID与runnerId，0700目录、0600/nlink1/4096B文件、nofollow及FD/命名路径一致。只child-running与匹配receipt；退出/旧receipt/不可确认失败。owner running + 本次positive + 原profile全需满足，10秒原期限不变。 |

持久化所有阶段串行；初始化先建立0B私有 `.initializing`，在JSON/fsync/rename/目录sync完成后才以最后unlink发布。任何写入或sync失败留下marker，读口拒绝已经rename却未确认的正记录。崩溃可能留下marker，保守unknown；它不负责信号或服务清理。原numeric exit/primary不被观察失败覆盖。

本次没有自然响应扩展：固定claim在maintenance下也会返回empty；unavailable指旧receipt不可执行。不能从两者推维护状态。恢复验收分为本child初始化、同operation显式resume/存活、实际领取三层；无自然assignment及原中心receipt/本地持久身份链时 `actualClaim=NO_ASSIGNMENT_OBSERVED`，不主动发任务/query。

## 固定恢复组合

[静态候选](runner-ready-04da-candidate.json)及其patch仅将已审单launch复用与本片必要代码移到04da。5路径、无moving-main plugin/slot/package/SQL输入，不改旧cd27/7d1。不能直接将本工作树整blob作为恢复产物。还需合入native独审的 held-target rebind/Webhost target 最小差量，固定单一新artifact。

新artifact需按原builder完整构建/导入，再由原Web owner给新source/context的4页正式兼容。个人恢复前还必须通过新artifact真实公开entry的隔离默认三角色cold startup（动态端口/专库、该boot runner正证据、Web identity、task/attempt0及完整自有收尾，0provider）。可复用已有SVC09A setup/cleanup/OPS14，不能使用2515+shadow controller或旧7d1结果代替。实际维护仍同op23，经受审rebind明确新backend+新Webhost，未知停；不重放bootstrap/旧迁入/退休，不动用户tab。

## 检查与结构复核

直接证据见 [runner-ready-result.json](runner-ready-result.json)：25 distinct 最终绿（18新、7受影响）；focused types0。原缺声明别名/type解析红及main专测未隔离非目标protocol模块的导入红保留，仅修调用装配后定向复测。不存在PG、监听、SDK/provider或个人I/O。8个监督组均absent/双EOF，无signals；5派生cache KEEP，不能写全tmp已清。

find-skills/本地clean-code/codebase-design方法沿原工作段复用，无安装；本片复核单一职责、一个初始化事件/一个私有记录、原生命周期/错误归属、不增调度器/请求和有界IO。初始化标记用于失败关闭，未制造第二运行状态机。后继组合/冷启动/兼容/个人恢复未执行。
