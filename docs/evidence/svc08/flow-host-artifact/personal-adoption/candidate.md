# SVC08 — c7b 迁入和仅 Web 宿主采用

这是同一 SVC08 的精确候选，尚未执行个人读取、迁入或替换。实际 c7b 构建及单 Web 隔离宿主结果已分别独审；保留原三阶段：产物成立 → 隔离宿主成立 → 个人受管采用。本阶段不升级 af51 后台/runner，不改变 d629/v3 或三个保留产物，不操作用户 tab。

## 唯一输入与调用位置

[inputs.json](inputs.json) 固定 Flow422 来源 c7b、原根/manifest dev/ino、clone helper、Node24.20.0、OPS14、16 个 root 工具 Module 字节和 pg8.23.1 / tsx4.23.15 的实际解析入口。16 文件在发布 main e30 与当前 Flow 字节均等于 422；此为准备观察，执行前仍须 Lead 冻结/重核。原 c7b 和本轮隔离副本不重建、不重装、不改写。

首次 operator 必须使用 **原 Flow/tools/personal-preview/cli.mjs**：普通 `load → assertInstallationSource` 不因仅有 `state.webHost.artifact` 而授权 artifact CLI；不得伪改 `backendArtifact` 使检查通过。无需把 root checkout 切回 af51；短冻结原 repository 中这组已 main 的精确工具输入即可。成功后真实 Web 子进程才从个人目录内 c7b 启动，后台仍使用原 af51 运行身份。

固定 CLI 为 `Node <Flow>/tools/personal-preview/cli.mjs web replace-host --directory /Users/citrine/.flow-personal --request <新0600请求>`。请求文件严格九字段（由可信CLI添加directory后十字段），含新 UUID、v3、af51、599a5b… compatibility、fresh Web record/pointer SHA、显式中断现有 Web 连接许可和 c7b descriptor。候选 host digest 已按固定 Module 的八文件顺序及原 JSON 编码计算为 `0d450e173fa0c1f3f83fbe77f165d2578a2affedbd0fb6931d62be222389d855`；正式调用仍用 `inspectPreviewWebHostSource` 核同。模板中的 null 不是有效请求，必须在新窗口锁内采集后一次固定，不从旧运行抄 nonce/hash，不遇到冲突后改参重放。

## 两个有分别结果的动作

**1. 迁入只改变 artifact store。** 创建新的同卷私有 0700 staging installation 和持久意图，先完整验证原 c7b。沿原 `withPreviewLock → withStoreLock` 同序持锁，核个人 root/store 身份、安装 marker、目标不存在、没有未知 stage/操作；维持既有最多 2 artifacts / 2 GiB retained 上限，绝不借迁入绕过。使用已审 `clone-artifact.py` 参数化到新 staging（包含同格式 backend-artifacts/id），只调用原 file-only CoW，无 fallback/外部链接/安装。原 verifier 逐 manifest 复验，固定所有目标文件与目录身份，fsync 文件及父目录后写完整校验 checkpoint；同卷 no-replace atomic rename 该完整 artifact 目录到个人 store，再 fsync/原 verifier。需要的调用层只组合这些现有 Module，不新增通用 packager/import 产品入口。

目标若在本次意图前已存在，只完整验证相同 descriptor/所有 bytes 后记录“已存在且同一”，不能覆盖。已创建 staging 的错误/timeout/rename ACK 未知保留所有路径与原意图；原两锁在finally正常释放，只有中断未走finally时才可能残留，不手工修改锁，后续仅读身份/旧新 manifest 判阶段，不自动执行第二次或删旧目录。迁入成功只表示材料可用；本次独立结果不包含重启。原个人 config/state/pointer/进程不能被此步骤写改。

**2. fresh 后独立 replace-host。** 第一动作持久收口并释放其已持锁后，重新确认完整现场与下面保留表，再生成新操作 request/reservation。原 CLI 自取同一 `operation.lock`；marker、af51 center/runner 的 owned/listener、v3/pointer/Web-record CAS、全部三个 retained 及其 af51 reports、候选 host source、既有 settled journals 都先验证。原 journal `reserved` 已 fsync 后才单次停止旧 Web；原 stop 仅 TERM、未知立即停。原 `pendingWebHost` 和 spawn nonce 真实落盘；新 Web 从 c7b 启动，原 readiness 和保护集合验证后写 `ready`。不调用 start/refresh/resume/bootstrap/publish/rollback，不修改维护状态或任务。

原 CLI 的同 operationId replay 只观察既有 ready/unknown，不能再次启动；本次默认也不自动 replay。超时、new Web readiness 未确认、持久化失败或任何保护差异都留下 pending/journal，不回滚 DB、不强停后台、不新建第二 request。接收 stdout 之前或 EOF 不完整均保留 unknown，不能用进程消失推定业务成功。

## fresh 保护表与事后一次检查

| 保护对象 | 判定 |
| --- | --- |
| 身份与源码 | 原 root/store dev/ino/mode/uid、marker、原仓库配置、Node 和列明 root 工具闭包/解析入口准确；操作锁未知即停 |
| 后台与 runner | 实际原 af51 source/backendArtifact、center/runner record、PID/PGID/startedAt/nonce/cwd/listener相同；v18 maintenance accepting/op=null 与 marker/read-only工作事实核准，不把02:45旧事实当当前 |
| 数据/配置 | config/token、claude/profile、maintenance原字节、业务任务/历史/队列/附件只读摘要分别保存；沿原facts仅排除queue_checked_at，其他变化未归因则UNKNOWN_CONCURRENT_CHANGE，不暂停或要求任务归零、不覆盖或回滚 |
| Web 发布 | pointer原字节、d629/v3、461a/caa1/d629三 descriptor、manifest/全部文件/compatibilityIds均保持；不删除/退役保留产物 |
| 允许变更 | 一份新 c7b store、独立私有迁入记录、state.processes.web、pendingWebHost→webHost、同UUID Web journal、原匹配nonce的web-exit和操作记录；其他字段不得变 |

事后先持久 CLI 原始输出与监督结果，再一次有界核新 owned Web/原组 stopped、保护集合及所有 retained。仅一次 identity + `/` + 每个 retained 的一个既有小 asset（≤5 GET、单次≤1.5s、单body≤1MiB/合计≤2MiB），路径从各固定 manifest 与原 `loadReleaseAssets` 规则导出：format2 `/__flow_releases/<releaseId>/`，format1 原根 assets；不要求旧 format1 index 路由存在。无需 Chrome、API query 或刷新 tab。静态 namespace 检查不证明所有旧 tab 状态或模型可用性。

## 预算与停止

fresh请求观察另20s+.5TERM+2reap，仅只读及私有请求写入。迁入候选：OPS14 NEW_CHILD_SESSION，120s work +0.5s TERM +2s reap；CoW 子进程同组。替换候选：OPS14 childPidOnly，28s +0 TERM +2s reap，只监督 operator，绝不向 detached 个人服务组升级信号。事后只读≤20s。两动作串行，分别持久意图/结果；完整监督/持久化 wall 原样记录。执行使用共享窗口，不趁他组运行开操作。

fresh≥2.5GiB 且满足 578MiB 规划+1GiB余量，live≥1GiB；artifact逻辑366,318,536 B，额外非artifact≤64MiB、raw≤2MiB。原三份 artifact（原c7b、隔离副本、新迁入副本）同时存在，CoW allocated/卷差值不冒独占物理成本。全部 retained/backups 计入合计；不足立即停，不删除证据腾门槛。

当前剩余实现仅是本 docs scope 的薄 procedural migration/串接调用与监督参数固定，以及临执行的私有 fresh facts/request；须交一次独审再执行。本候选无个人 probe、PG、复制或服务动作。沿已安装 brainstorming 的 bounded 设计及 codebase-design / clean-code 方法，复用原 Module 和错误状态，不引入新部署 FSM。

## 固定可执行准备 Interface

`supervise.py migrate|request|replace|post` 四个顺序入口，各自exclusive外层原件；后继要求前一监督exit0/EOF完整/组absent。迁入通过不自动启动替换，request不自动调用CLI。替换监督直接指CLI PID，避免再嵌一层子进程逃逸；detached Web仍仅由原工具管理。个人执行尚NOT_RUN。`procedure.mjs`是一次流程和纯保留判断，`caller.mjs`组合原facts/locks/verifier/CoW/exclusive rename，测试只注入自有临时材料及无副作用ports。

原事实Module会使用只读REPEATABLE READ事务取得marker、runner身份及有界hash摘要；绝无业务DML、drain/暂停、零任务前置或额外阻用户锁。非Web身份/配置差异仍保守停止；正常用户工作的摘要变化与Web替换结果分列，不能据此覆盖、回滚或自动重试。root只冻结16工具字节和已解析依赖，不冻结其他feature实现。

迁入和request额外拒绝已有webHost（已知基线为legacy selection）；post则必须恰为本operation/c7b。一次固定namespace防原运行重入，request须在60s内进入CLI，否则停且不能改参重基准。readonly prepare request 20s单独计入总观察段；并不暂停任何任务。既有facts中queue_checked_at仅影响raw摘要，保护摘要忽略该一项；其他表变化列unknown，无根因猜测。

## 首次入口失败后的只读运行身份修正

原attempt-01三件raw与旧manifest保持；系统`/usr/bin/python3`的固定字节正确，但uid0/nlink78被私有文件规则提前拒绝。新file-readers Module分开`privateBytes`与`runtimeBytes`：前者仍self/nlink1，后者必须有manifest显式uid/nlink/dev/ino/realpath/size/hash全套pin，二者均nofollow/nonblock/regular/有界读取且读后身份不变。没有按路径特许、没有安装/换解释器。Python外层使用同一显式pin规则。下一固定namespace为inputs中的独立r2；旧namespace不可复用，新运行仍需独审/窗口，当前未创建。
