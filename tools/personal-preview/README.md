# 个人常驻预览

这个本地入口复用现有 center、native runner 和产品 Vite Web。没有预热、示例提交或自动模型调用。依赖 Node24.20+、项目已安装的依赖、本机 PostgreSQL，以及 macOS/POSIX 的 `ps`、`lsof`、`git`；当前实测 macOS，不声明 Windows 支持。

## 使用

先由操作方在当前终端安全提供 `FLOW_PREVIEW_ADMIN_URL`，指向本机 `127.0.0.1` 的 `postgres` 管理库；账户需要创建数据库权限。不要把连接串作为命令参数、写入Git或发到聊天中。首次目录必须不存在，父目录已存在且在所有Git工作树之外；入口创建0700目录及0600配置。

```sh
node tools/personal-preview/cli.mjs start --directory "$HOME/.flow-personal"
node tools/personal-preview/cli.mjs status --directory "$HOME/.flow-personal"
node tools/personal-preview/cli.mjs stop --directory "$HOME/.flow-personal"
```

返回新 `webUrl` 与 `center.url`，不输出owner/runner token。使用产品Web的连接表单；owner token只在本机私有 `credentialsFile` 的 `ownerToken` 字段，由操作方读取并输入。它不在URL、前端构建变量或工具输出里。不要替换原fixture或工程dashboard地址。

初次随机创建 `flow_preview_<随机值>` 数据库和持有标记；已存在库必须与本目录installation ID/实际路径一致，不接管其他数据。后续无须再次提供管理连接，它保存在0600文件里。启动器不读取或复制SDK登录文件，native SDK在用户真正提交任务后使用自己的合法认证来源。

停止保留数据库、任务/对话、native工作目录与配置。重新启动先核数据库和runner凭据身份。若存在 queued/running/waiting/cancel_requested/uncertain 等非终态任务，先返回 `PENDING_WORK_REQUIRES_CONFIRMATION`；操作方核对这些历史工作后，才可显式执行：

```sh
node tools/personal-preview/cli.mjs start --directory "$HOME/.flow-personal" --confirm-pending
```

这仅允许原有合法队列继续；不解除uncertain、不改变owner fence、不重派任务、不证明外部副作用已停止。没有安全依据时保留停止状态并走中心核对命令。

## 固定配置与状态

默认 `claude-sonnet-5-5`，每query最多2 turns、$0.20、60秒，tools为空、不读取材料、请求thinking disabled。是配置限制，不是整个Flow或账户总预算保证；SDK实际报告和未知事实仍按CHAT02区分。配置文件被扩大或改变时拒绝启动，不偷偷升级权限。变更配置/runner身份属于后续显式管理工作。

`configured`与已发布`profile`表示已配置；`provider: not-probed`始终明确没有探测provider。`processes`只描述本工具持有的进程身份，`center.reachable`在核对监听进程组之后检查；`work.lastTaskSucceededAt`/`lastHeartbeatAt`是数据库已记录事实，不是当前在线承诺。`sourceAtStart`记录实际启动源码HEAD和当时dirty布尔值，不随每次status刷新伪装成最新部署。

## 持有、失败与停止

CLI结束后服务仍在独占进程组运行。每次停止前核PID、开始时间、完整命令、随机启动标记及PGID；仅向匹配的组发送TERM。每组最多等5秒，无SIGKILL、无扫端口杀进程。超时或身份不明返回unknown，保留记录供核对；进程退出不等于业务成功或外部副作用撤回。

启动健康检查还核监听者PGID，防已占用端口被误认为自己的center/Web。发送owner凭据前重新核对center监听归属。私有child入口要求当前state中的PID/nonce匹配，不能作为绕过start检查的另一启动命令。

每个角色从系统允许清单建立环境，不继承任意Flow/DB变量：仅center获得专库连接与owner token，仅runner获得自己的token/明确provider认证环境，Web只获得center地址。外层服务wrapper同样先过滤；凭据保存在0600文件中，不使用命令参数。runner内部传给SDK的环境是另一个产品边界，须消费相应adapter隔离修复后再启动用户服务。

原始子进程stdout/stderr全部丢弃；只保留有界的三个exit事实文件和state，不把未知内容或凭据写进日志。启动过程失败会尝试停止已确认身份的自有组，未知状态保留。操作锁没有超时抢占；若CLI崩溃留下operation.lock或首建数据库/标记未完成，须人工核对持有记录，不自动清锁、接管库或删除数据。本工具是同机合作管理，不是OS强隔离，也不管理脱离记录进程组的外部副作用。

## 本片段验证

```sh
node --test tools/personal-preview/environment.test.mjs tools/personal-preview/process.test.mjs tools/personal-preview/preview.test.mjs
```

测试仅随机专库、动态端口和独占临时目录，先核持有标记再清理。真实复用server/main、runner/main和Vite；8个公开行为检查包含CLI退出后服务保留、配置发布、0任务启动、角色环境隔离、私密输出、pending确认、数据库身份、端口冲突、错误PID身份与TERM超时。唯一排队fixture故意不被Claude-only runner领取，0模型/0云。此验证不替代真实聊天、浏览器验收或用户常驻部署。


## 安全更新（SVC02）

这是显式可信本机维护入口，复用当前0600配置和专库持有标记。不会启动第二个中心或scheduler，也不会探测provider。先执行：

```sh
node tools/personal-preview/cli.mjs maintenance bootstrap --directory "$HOME/.flow-personal"
node tools/personal-preview/cli.mjs maintenance status --directory "$HOME/.flow-personal"
```

bootstrap以短事务安装016保护旧中心的attempt INSERT，并持久停止接新任务。正在执行的任务、心跳和事件继续；等待中的人工决策需要照常解决。uncertain占用不会因过期自动清除。返回计数只是观察，不能当作停止许可。

在固定、干净且已经审查的main版本上执行（替换明确的40位提交）：

```sh
node tools/personal-preview/cli.mjs maintenance refresh --directory "$HOME/.flow-personal" --target <40位已审提交>
```

若仍有active attempt，返回等待当前任务；没有active时，同runner行锁内取得持久maintenance hold，然后退出PG事务。整个本机更新保持operation.lock，但不跨服务启动持PG锁，避免与新中心迁移死锁。HTTP owner不能解除maintenance；只有本机显式恢复入口会在验证新进程后开放接收。更新按自有PID/命令/启动时间/PGID停止并重新启动，保留数据库、身份、工作目录、配置、端口和网页地址。不会自动回退到旧源码或自动恢复队列；失败保持暂停/unknown。重复已成功的refresh不再次重启进程。

新服务就绪后仍暂停，需要明确执行：

```sh
node tools/personal-preview/cli.mjs maintenance resume --directory "$HOME/.flow-personal"
```

该命令会允许已有合法queued任务继续，可能启动模型，因此必须由操作方明确选择执行；本功能测试只有fixture任务，生产部署与恢复窗口另行确认。每次恢复带CAS/幂等和中心不可变审计，重复同一次确认不会再创建审计。启动器的普通start/stop保留原有语义；普通start不会解除维护gate。

状态措辞为停止接新任务/等待当前任务/可更新/恢复接收；这些状态不声称旧任务已取消或外部副作用已撤销。私有maintenance.json只保存本机操作ID、幂等key与版本，不存新凭据。丢失或未知操作记录拒绝自动接管，须先核对。

## Fixed Web artifact (SVC03)

The launcher now builds a static Web artifact before starting services. `maintenance refresh --target <full SHA>` prepares and verifies that artifact **before stopping any owned process**. A failed build or artifact check leaves the old processes alone; an existing maintenance hold remains paused. Start/refresh require an exact clean source checkout. Build has a 90-second limit and uses installed dependencies only, a system-only environment, `VITE_FLOW_FIXTURE=false`, and no `.env` loading. It never reads the private service configuration to build the page.

Artifacts are kept under the installation's private `web-artifacts/<manifest SHA256>/` directory. The manifest records source SHA/tree, lock digest, Node/Vite versions, and every served file's byte count and SHA256. Limits are 4,096 files, 32 MiB per file and 64 MiB total. Temporary stages publish by same-directory rename; a prior artifact is neither overwritten nor removed on failure. This is a trusted frozen-worktree build, not a hermetic or reproducibility guarantee. Same-user filesystem mutation remains possible; startup and status detect changed files rather than treating the host as a security sandbox.

The Web child uses Vite's **local preview** with a fixed artifact root, no source config or env loading, no dev server or HMR, loopback binding and a strict original port. `/api` keeps its same-origin proxy to the original loopback center; authorization and SSE stay in the existing request flow. Web receives no DB, owner, runner or provider credentials. This remains a personal local preview, not an internet production server.

`status` reports `sourceAtStart` for the backend separately from `webArtifact` (`sourceHead`, `artifactId`, `manifestDigest`, integrity `state`, and serving identity). The no-store `/__flow_preview_identity` endpoint contains those artifact identifiers and, when SVC04 is bootstrapped, its release policy/version. Legacy running dev servers report unknown until an explicitly approved maintenance refresh; merely invoking status does not restart them.

Publishing a new artifact never reloads a user's tab automatically. SVC04 below provides Web-only publication/rollback with explicit compatibility; backend changes still use the maintenance procedure. No automatic fallback, DB rollback, or automatic resume is provided. Current services and ports must only be changed in a separately approved maintenance window.


## 独立更新网页（SVC04）

`web bootstrap`只升级Web进程为可切换固定产物的宿主，可能短暂断开网页观察；center、runner、活动任务、原端口/DB/凭据不动。之后publish/rollback只修改原子版本指针，三个进程都不重启，也不主动reload旧页面。不要为Web发布运行`maintenance bootstrap/refresh`。

先固定Web源码提交，在原私有安装目录中构建（32位小写十六进制release ID在构建之前选择，不能用构建后的digest作为base）：

```sh
node tools/personal-preview/cli.mjs web prepare --directory "$HOME/.flow-personal" --target <40位Web源码提交> --release-id <32位releaseID>
node tools/personal-preview/cli.mjs web import-compatibility --directory "$HOME/.flow-personal" --report-directory <已核对报告的绝对目录>
node tools/personal-preview/cli.mjs web bootstrap --directory "$HOME/.flow-personal" --request <0600请求JSON>
node tools/personal-preview/cli.mjs web publish --directory "$HOME/.flow-personal" --request <0600请求JSON>
node tools/personal-preview/cli.mjs web rollback --directory "$HOME/.flow-personal" --request <0600请求JSON>
```

请求字段为`expectedVersion`、`expectedBackendHead`、`compatibilityId`；publish/rollback另需完整`artifact`（artifactId/sourceHead/manifestDigest）。bootstrap首次version为0，后续用status中的releaseVersion；expectedBackendHead必须是实际运行后台的sourceAtStart.head，不是目前Git HEAD。新的Web源码可与后台不同。bootstrap确认失败须先读status核自有Web进程；显式同版本重试只恢复Web，不重置任务。发布确认丢失后指针可能已提交，应读status再决定，不能更换版本盲发。个人安装是否操作由已授权的具体步骤决定，本片测试从未操作它。

兼容记录不是一句自由文字或全量源码相等比较。报告目录包含`report.json`与四个固定检查文件`read.json/send.json/recover.json/negotiation.json`。report严格包含：

- `format:1`、`policy:"flow-web-api-v1"`、真实`backendHead`、完整`artifact`。
- `checks`四字段为相应原始JSON的SHA256。
- 每个检查文件严格包含`format:1`、`check`名称、相同backendHead/artifactId、`observations`；read要求ownerAuthenticated/conversationBound/taskBound，send要求acceptedTurnBound/requestedProfilePreserved，recover要求sameKey/sameBody/sameTurn，negotiation要求legacyReadable/streamHeaderHandled/profileHeaderHandled，全部必须true。

导入核每个文件的实际bytes/hash和结构，生成不可变compatibilityId；这是可信本机测试执行者的具体组合声明，不是启动器自动运行兼容测试或证明任意后端语义。必须来自针对该真实Web产物/后台组合的有界验证；本片的合成Web证据不能拿来给生产Web签发记录。缺项、失败、未知组合或证据变更均拒绝；源码中无关加法变化不会单独拒绝。不得把token/连接串放入报告。每文件4KiB、共32个记录；无自动清理。

`web-release.json`是当前/保留集合的唯一权威，带递增version；所有命令复用原`operation.lock`，并发只能一方取得锁/正确版本。新资产带`/__flow_releases/<releaseID>/`命名空间，旧v1资产只按manifest中的精确地址保留；同legacy URL异bytes或重复namespace冲突拒绝。未知资产/越界地址404，损坏元数据503。最多3个保留产物、合计192MiB；新命名空间构建在已有3个完整缓存产物时也拒绝，不静默删除unpublished/旧页面资源。回退只选已保留且兼容的产物，预算满则暂停新发布；本片没有prune命令。后继人工清理需明确旧页面已关闭，不能靠TTL或无请求推断。

每个静态请求核精确文件大小/hash，无目录浏览；宿主最多64连接/4个同时缓冲资产响应，另有32个FIFO等待位、每个最多5秒；等待时不读文件，每文件仍32MiB。队列满/超时503，断连及时移除。API与SSE继续代理原中心，不受资产读取计数限制。现有页面在发布/回退后仍能读取保留chunk；不承诺无限页面寿命，也不自动迁移浏览器草稿。后台整体更新若已有release集合，必须先为每个保留Web产物提供与新后台组合的报告，未知则在停止进程前拒绝；不会默默重建Web覆盖其独立source身份。

本轮用自有随机PG、真实中心/stdio独占确定性runner及编译后合成Web consumer验证：Web初始化/并发发布/回退、端口冲突后的unknown与显式恢复期间，后台进程身份和原attempt不变，两个任务最终成功；0SDK/provider。另验证旧/新chunk、SSE跨发布、路径/损坏/预算与构建环境。它不替代真实产品Web浏览器验收、生产组合兼容报告或个人部署。

## 固定后台产物（SVC06，Mac 构建）

显式 `backend prepare --directory <private-install> --target <full-commit> --offline-store <pnpm-v3-cache> --pnpm-cli <installed-pnpm-9.15.4/bin/pnpm.cjs>` 仅准备，不停止服务。输出 `flow.backend-artifact.v1` descriptor；Git object与完整锁依赖复制到私有产物，tsx和SQL保持布局。不使用开发目录链接/外部hardlink，安装offline/frozen且禁止scripts/npmrc隐式配置。

准备需要 macOS arm64、Node24、系统Python clonefile与至少2.5GiB空闲（检查不是预留），clone失败绝不普通复制回退。每产物≤1GiB/100000entries，最多2产物/2GiB；满额拒绝，工具不删除运行/未知旧产物。Node及非system动态库固定hash但不打包OS，版本漂移拒绝启动。

先独立验证 retained Web compatibility，再 `maintenance bootstrap --directory <install> --backend-artifact <id>` 将选择绑定原维护操作；随后原 `refresh --target <full-commit>` 与显式 `resume`。源码与依赖全部从验证产物加载，config.repository仍是安装身份，不必detach开发HEAD。未选artifact的legacy行为保持。准备/校验失败保留旧PID，hold以后任何失败不自动resume/rollback；关闭进程不表示任务已停止。

stage outcome先持久保存才清理；若发布后验证/清理/回执失败，已知artifact可能存在，结果为unknown。可以重核同ID/同source恢复，不能凭异常断言未发布。不承诺断电durability、空间预留或对恶意同uid写入的OS隔离。本片真实个人发布仍需另给窗口。


## 单独替换 Web 宿主

`web replace-host --directory /absolute/private/state --request /absolute/private/request.json` 只替换已记录的 Web 宿主，要求明确允许短暂断开连接；不更新后台、runner、页面产物或保留版本指针。请求为 owned 0600 文件，严格包含 `operationId`（UUID）、`expectedVersion`、`expectedBackendHead`、`compatibilityId`、`expectedWebRecordSha256`、`expectedPointerSha256`、`expectedHostSourceDigest`、`allowConnectionInterruption: true`。不接受脚本路径、argv、env 或任意目标版本。

可信本地调用者可通过 `inspectPreviewWebHostSource({directory})` 只读获取 host 文件集合摘要。摘要明确标记 `legacy-repository` 或 `backend-artifact`；它不冻结源码目录，也不证明未来 lazy import 不受 checkout 变化影响。legacy 部署仍需固定源窗口与动态读取边界证据，不能只凭“已 import”关闭窗口。这个摘要独立于 backend `state.source` 和 Web artifact identity。

一次操作在原 operation.lock 内先持久记录，再停止/启动 Web；所有权或结果未知时停止，不重试。相同 operationId+同请求只观察保存结果，改变请求拒绝；未结算旧操作阻止新 ID 绕行。最多保存32项16KiB操作记录，不自动淘汰。新 Web pending record与成功后的 `state.webHost` 独立来源记录也持久写入；不会改 backend source/center/runner/config/release pointer。

健康旧 `web bootstrap` 的 alreadyReady 行为保持。新命令不会自动执行于安装或发布；实际个人切换须先固定工具来源与一次运行边界。现阶段仅自有文件与注入进程端口的0PG验证，不宣称已部署、长期稳定或旧页面无连接中断。retained3退役仍未实现。

显式选择Web固定宿主时，replace-host请求可另带 `webHostArtifact`：严格四字段 `policy/artifactId/manifestDigest/sourceHead`，复用现有 `flow.backend-artifact.v1`，不接收任意路径或安装参数。`inspectPreviewWebHostSource({directory, webHostArtifact})`读取同一候选；完整验证仍核内容/Node身份和 `sourceRepository === config.repository`，不是摘要替代验证。

选择先写独立 `pendingWebHost`，再停止/启动；仅 `internal-service web` 能从该产物根加载。center、runner、maintenance仍使用原来源，不能从Web descriptor获得授权；不会设置 `state.backendArtifact`。成功保存 `state.webHost.artifact`并清pending，未知则保留，旧bootstrap/publish/rollback同时核pending和同一未结算journal，最终state已保存但回执未知也不能绕过。后续Web启动复用已选来源，旧不带选择的配置默认不变。

既有e5产物来自backend-release worktree，不能改manifest把它当个人Flow仓库产物。本次局部注入只证明角色选择/持久顺序/错误传播；合法个人来源的新固定产物、实际marker/服务及旧后台lazy读取边界仍待独立验证，不能把默认路径用例通过当已部署。
