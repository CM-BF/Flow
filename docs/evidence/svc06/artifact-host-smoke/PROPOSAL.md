# 固定产物的最小宿主与checkout不可读验证

这是 SVC06-03/04 的下一片准备，尚未运行PG/宿主。复用已获限定独审的 `e5fed419b73beb733ff78d958192813c6ac6ecc7887c1c408d9e5f7b31a552b2`（source `3230becf07b804479ec4dc7ef02fcaff58cc3858`），不重建/安装/改产物。原运行根 `/private/tmp/flow-svc06-fixed-artifact-c52Zw6`，dev16777234/ino123378549；保留原build/stage/manifest，所有运行状态放自有目录并显式记录归属。

## 唯一Interface与真实覆盖

复用产物 `backendRuntime`、`loadPreviewConfiguration`、`spawnOwnedProcess`→实际CLI `internal-service`、`inspectOwnedProcess`/`ownsListener`/`stopOwnedProcess`；仅本片fixture建立专库marker、私有配置、空runner注册和可验证Web静态输入。不改生产生命周期或维护状态机。先中心真实migration/health，再实际runner/main配置发布且0任务，最后Web真实static-web/Vite启动、identity/静态字节/health代理。此为三角色host smoke，不是App浏览器兼容、fixture任务执行或完整maintenance refresh/resume/replay验收；03/04这些剩余项继续open。

manifest.sourceRepository严格等于原构建树，不能改config.repository指向替代目录来冒原e5的隔离。候选用本机 `/usr/bin/sandbox-exec` 仅限制自有验证进程及后代对原 `/Users/citrine/Projects/AgentHarness/Flow` 与 `Flow-worktrees` 的文件读取；对应realpath和`/System/Volumes/Data`别名全部列为负probe。harness复制至自有tmp，Node/系统库和e5仍允许。启动前先证明实际负probe返回拒绝、tmp正例可读且子进程继承；若机制不可用/读成功/错误未知，STOP且不建库。不称这是通用安全沙箱，不改原树权限/目录/依赖，绝不触个人服务。再在相同限制下证明完整真实宿主和延迟依赖读取仍来自产物。

最窄可写范围仅 `docs/evidence/svc06/artifact-host-smoke` 与原plan/status/review，现claim v6已涵盖；preview/cli/test/README四共享literal已交回。预计入口 `entry.mjs`（单旅程与checkpoint）、`supervise.py`（复用OPS14）、`isolation-check.mjs`（本机机制局部直接检查），不复用旧pending-host草稿的开发目录改写/隐藏操作。

## 输入与开跑前缺口

- Node/OPS14/产物descriptor仍绑定本次构建原证据；所有角色从e5启动，拒绝其他checkout运行源。启动环境私有HOME/TMPDIR，不继承provider认证，0provider/0task；只允许自有loopback和PG。
- Web只消费已有固定真实dist的精确文件副本（待固定其只读root/descriptor和总bytes），不build、不造App壳。旧af51兼容报告不改标签成3230，也不绕过公开publish/maintenance的报告要求：本片仅internal-service静态宿主行为，无发布承诺。若没有可绑定的独立Web输入，三角色部分不运行，不以二角色冒充。
- 原artifact根不迁移、不改manifest；临时安装config.directory与该artifact store的实际root一致。运行新增私有文件逐项登记/0600，artifact本身保持。不能直接使用普通start，因为它会准备Web源码/build；不伪造兼容报告令维护路径通过。

## 预算与失败保持

先局部无PG机制检查：一次≤10s，tmp≤128KiB/raw≤128KiB，fresh≥1GiB+8MiB。仅本机文件拒读/继承/正例，失败原件保留，不自动退到较弱证明。机制成立后才固定实际PG入口供独审与共享重窗口。

拟实际段：一专用随机`flow_preview_<24hex>`数据库/两个动态端口/至多三个owned角色；120s工作+30s收尾，原2.5GiB门槛保留并取新增预算+1GiB余量更严格者；新增临时64MiB、raw2MiB，PG/WAL另计且实采live≥1GiB。无浏览器/模型/个人操作。开始即持久root dev/ino/marker/各onSpawn记录；先checkpoint再清理；每个角色只由既有身份helper确认后TERM，未知不得KILL/自动重启。outer超时时也必须由仍存活的收尾owner核这三个detached组，不能把主child退出当全组结束。全部确认absent及≤3s有界连接观察零后才正常DROP并核不存在；任一错误、晚零、inode不符、checkpoint失败均KEEP。保留e5 artifact，原失败/root/stage不删除。

技能复核：沿本地find-skills方法复用codebase-design/clean-code/brainstorming（`/Users/citrine/.agents/skills`）；本片bounded设计仅复用真实宿主Interface，拒绝额外发布FSM。当前只是源码读与方案，未执行此旅程。
