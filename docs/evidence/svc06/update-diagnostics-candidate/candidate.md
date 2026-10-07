# SVC06 固定诊断产物的个人受控更新候选

唯一新 runtime source：`6c0fdcda8858aac33489c48c1948e902dd6a3d7e`（Lead 固定 `codex/svc06-diagnostics-runtime`）。父为 b2b；仅已独审 source3cb 的 preview/直接专测/new diagnostics/专测四文件变化，其余 Git blob 均相同。不是 moving main。旧 c2c 与 b2b r1 失败/清理及所有原始证据不变。

## 构建小差异

沿前次 build-once 方法，builder九模块、Node24、pnpm9.15.4、私有yaml2.9.0入口以及OPS14不变。新目录 `build-once` 与新随机私有根 `flow-svc06-diagnostics-artifact-*`；旧 actual-first/outer不复用。entry仅根前缀变化，supervise仅Python module别名变化；新增runtime-proof只从新产物内部import诊断模块、核64KiB常量及export，不打开诊断文件/进程/服务。

源归档998 files /7,834,095 logical B；72关键固定输入含33 SQL。14 package/lock/workspace声明与b2b字节一致，仍7 importers /271 snapshots，root tsx+pg、显式Vite host工具。fresh仅271旧选择索引2,252,500B逐hash核同；未扫描/哈希10,648 payload，实际selected clone核原件+目标hash。旧3mode观察不改，不冒cache全部完整或物理峰值。

总新增规划2,317,352,960B，包括stage/install→final同份1GiB、seed512MiB、archive32MiB、私有pnpm HOME/cache128MiB、metadata余量512MiB、raw2MiB。另live1GiB和协调512MiB；fresh最低3,927,965,696B，仍严于原2.5GiB。实际并发超协调余量则加严，不降gate。work420s+.5TERM+2reap，clone/install各180s，outer capture1MiB/总raw2MiB。原500ms filesystem sample不是原子峰值或硬预留。

## 已完成的隔离宿主差异（历史准备边界）

该历史准备现已由[固定产物结果](RESULT.md)和[r2隔离结果](../diagnostics-host-bootstrap/RESULT.md)闭合；新artifact和独立namespace实际验证完成，不能重用已消费r1/r2。原准备顺序为：复用原真实维护/owned process及独立cleanup入口；选择新artifact为实际center/runner/Web代码，af51旧代表数据流程仍必要，不另造SDK/模型启动或绕过ready。

首先只进入原默认宿主启动检查；若再次失败，按本run nonce读取新阶段JSON、受控父首错、原数字exit事实，并仅在私有诊断中检查每role最早64KiB stderr。公开结果只bytes/hash/truncated/EOF/受控code/role/phase；不把raw输出、argv/env/凭据写进公开证据。不能从缺阶段推出child未启动，配置load前仍可能unknown。原ready10秒不增、不用注入替换真实spawn。成功才继续原packet尚未到达的迁移/策略检查；失败按原独立cleanup证明work组终态、detached nonce身份、marker/OID/有限零连接后normal DROP，unknown KEEP。该隔离入口及实际结果现已分别独审；本段保留原准备语义，不是可执行个人操作。

真实三retained App报告仍由Web owner对**新6c实际后台source+normalized publicOrigin/policy digest**生成；b2b、旧af51/v1或手工loader fixture不能冒此组合兼容。未来个人顺序仍legacy先新Webhost→三retained完整v2新tuple→新backend+policy→第四App显式CAS，原身份/后台/指针/tabs不动，当前无个人窗口。

## 当前固定输入与执行前缺件

本段方案对齐开始时间：`2026-10-07T10:53:26.485603+00:00`（owner实际开始编辑本候选；任务总开工仍UNKNOWN）。个人安装本段**未fresh读取**，以下旧状态全部为原封存历史参照；本候选不是已就绪的个人运行包。

- 新唯一产物：`7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920`，source `6c0fdcda8858aac33489c48c1948e902dd6a3d7e`，真实Flow sourceRepository。[descriptor](build-once/actual-first/result-descriptor.json)、[构建限定独审](result-independent-review.json)固定，367,041,727逻辑B（含manifest），不能据CoW推为物理零成本。复用现产物，不重build/install。
- [r2结果独审](../diagnostics-host-bootstrap/result-independent-review.json)限定证实自有af51旧27迁移→新35、真实三role refresh/resume、default-off→显式策略、代表旧业务列/指针/config/profile保留、cookie/CSRF/logout。main/origin `6571056455be3e4289f162041746420246ac2db4` 已接同范围结果。合成loader报告绝不进入个人材料，也不替代三真实App。
- 历史个人参考仍af51、accepting/v18、Web d629/v3、独立c7b宿主，三retained为461a/caa1/d629。[SVC08实际采用](/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-web-connection-lifecycle/docs/evidence/svc08/flow-host-artifact/personal-adoption/attempt-03/RESULT.md)引用权威 personal-web-connection-lifecycle 原封存记录；读取失败不当空白状态。实际操作前精确采样installationId、marker、源/已选artifact、三组完整owned身份、全部retained/指针/兼容报告、配置/profile/令牌摘要及维护/工作状态；不输出凭据、不用历史值重基准。
- **执行前缺件：** Web原owner为461a/caa1/d629各提供真实App format2报告+read/send/recover/negotiation四份原件，每份绑定**source6c + 本artifact tuple + 下述公开context**。此处本artifact tuple指相应Web artifact descriptor，不是后台7d1 descriptor。b2b、af51/v1、不同origin/策略或synthetic材料均不能替代。原历史v1只支持legacy路径。
- 公开候选配置保持已约定值：cookieOrigin/publicOrigin=`http://127.0.0.1:61228`，trustedOrigins仅该项，authEpoch=`svc09-b2b-20261007`；normalized context为format1，policySha256=`81a8abe98d6541c34d07b15611e773f9bd4b53f8c6785bbaaab6e3dd03b3d638`。authEpoch字符串是固定非秘密标识，不是source；本候选expectedBackendHead改为6c。旧[b2b公开配置文件](../update-b2b-candidate/proposed-public-context.json)作为历史不改写，不直接拿其backendHead作新报告输入。公开入口若需变更，先明确新tuple并由Web重绑，不靠同source放行。

## 原工具的最小操作序列（未执行）

| 阶段 | 复用入口与明确输入 | 成功检查点 / 停止边界 |
| --- | --- | --- |
| 固定入口与迁入 | 原SVC08 personal-adoption的迁入procedure、固定clone/no-replace原子发布接口和OPS14；新7d1 descriptor、新独占身份。复用withPreviewLock与withStoreLock，先私有0600/fsync intent与原件备份，再验证源manifest/完整inventory、同卷受控复制、目标verify。 | 只导入固定artifact，不改backendArtifact或Web指针。按实际空间给出copy/stage同时存在预算和原≥2.5GiB/live1GiB；部分/unknown保留stage与intent，不伪称finally会永久持锁，不重跑已成功迁入。已有checkpoint须精确核后续接。 |
| legacy先换Web宿主 | 固定6c工具闭包的`web replace-host`，新request精确oldWeb owned身份/源/版本，目标7d1；策略必须仍缺失/default-off。 | 后台/runner保持历史参照af51/v18，d629/v3/三retained与config/token/原tabs保持；新Web代码取7d1，实际backend兼容仍取af51，不把Webhost source当后台source。旧c7b能力不据文件名猜；失败/unknown止于本phase，无后台drain。 |
| 材料与配置前置 | 三真实v2报告齐后，沿固定6c`web import-compatibility`导入到现store，不重写旧指针的发布证明。受信私有browser-session文件绑定fresh installationId、0600/nofollow/固定字节/hash；prepare与runService复核，外部env不能绕白名单。 | 旧pointer只决定current/retained集合；load显式以expectedBackendHead=6c与expectedContext找每个新报告。任何缺件/错误tuple/旧host能力未知必须在任何drain/stop前拒绝。原公开策略缺失off、非法存在拒绝不变。 |
| 同一维护operation bootstrap/drain→hold→refresh | 原`maintenance-host.mjs`维护FSM：bootstrap带`backendId=7d1`先prepare再持久op/drain；等当前工作自然完成，全部active/uncertain/pending及journal/outbox/finalproposal明确；refresh在同op按版本hold，target=6c，进入ready-paused。 | **refresh实际停止Web→runner→center，启动center→runner→Web**；两后台采用7d1，已先采用的新Webhost仍7d1，Web发布指针不变。不取消用户任务、不清journal、不复投query。unknown或新工作按原门槛停止/保持；从drain起原总15min及每步剩余预算需落未来薄调用输入，不借新循环扩大。 |
| 保留checkpoint→显式resume | ready-paused下保存完整新旧owned身份、source/descriptor、真实migration、原业务列/历史/身份/配置/profile/令牌摘要和原pointer/retained对照；新表、schema、维护行/audit和正常queue心跳等允许差异预先逐项声明。随后仅同op执行一次原resume。 | 不要求全库hash无任何合法变化；用户并发变化只能有据解释或unknown，绝不DML回滚/取消工作凑绿。六组新旧状态与维护版本、就绪身份/策略context均确认后才resume；未知保留暂停与证据，不自动恢复或换key。 |
| 第四App独立发布 | Webowner提供实际App descriptor与本新backend/context报告后，原`web publish`独立expectedVersion CAS；所有旧三项继续保留。 | 集中4items/192MiB资产/32reports正式策略；fresh全store计数/bytes、各报告原件与新tuple门槛分别核。旧三项历史4,538,660声明B仅规划，全部历史report数量仍UNKNOWN。不得TTL/pagehide自动退役、提高上限或把后台成功当第四页已发布。 |

### 首次维护入口资格复核（2026-10-07 10:59:21 UTC，仅固定源码与原件）

已有公开入口是安装内 `backend-artifacts/7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920/root/tools/personal-preview/maintenance-host.mjs` 的 `maintainPreview({ directory, action, target, backendId })`；该文件也已有直接命令入口，不需要新增wrapper。**固定6c尚不能凭已迁入7d1或仅Web宿主采用7d1，从此产物入口完成个人首次bootstrap。** `maintenance-host.mjs:113–115` 先调用 `loadPreviewConfiguration`，早于bootstrap读取 `backendId`；`preview.mjs:55–60` 的默认serviceRole为null，转到 `backend-release/host.mjs:42–60`，只接受真实config.repository模块根，或已由state.backendArtifact/maintenance.backendArtifact选择并完整验证的模块根。只在serviceRole='web'时才读取独立webHost。故历史af51后台、仅Webhost升级7d1且无真实7d1维护operation时，直接加载新产物会先拒绝CONFIGURATION_IDENTITY_MISMATCH；不得改config.repository、预填backendArtifact/maintenance或冒Web角色绕过。

r2确实直接载入该函数，但[固定journey](../diagnostics-host-bootstrap/journey.mjs):26已在新建自有安装初始化state.backendArtifact=7d1，:94又以7d1启动三roles，然后:124/:146/:149/:159才调用status/bootstrap/refresh/resume。已保存[work-result](../diagnostics-host-bootstrap/actual-r2/work-result.json)证明这一路径通过，不覆盖个人首次采用的上述身份差异。`cli.mjs:38–43`选择maintenanceRuntime并核资格后才spawn，`backend-release/host.mjs:62–65`仍按现operation/state选择，不能仅运行新CLI就认为实际runtime已升级。

**最小首入口候选是现root的公开函数，不是CLI转派。** 对实际config.repository仍为真实Flow的安装，直接从 `/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/maintenance-host.mjs` 调用 `maintainPreview({ directory, action: 'bootstrap', backendId: '7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920' })`；或复用该同文件已有直接命令入口，不新造执行包装器。此时load通过真实repository身份，bootstrap内部backendById/backendRuntime验证迁入产物后，按原prepare/marker/runner/lock/FSM持久operation再drain，不经过CLI的旧runtime选择，也不调用currentSource。现root clean HEAD `70644fc8415019252b34e830a49fc1cf0420f7c8` 的30个静态相对模块，加016迁移SQL、root package/tsconfig、server与contracts package共35项/214,145B，已对固定6c、该main Git与工作树逐字核同；非type外部静态导入仅pg/zod。按实际符号链接和package exports核到root pg8.23.1、tsx4.23.15、contracts zod4.6.5，7个package/入口文件均与已封7d1 manifest库存hash相同；build-only yaml是未调用的惰性import。

因此无须仅为main总SHA不同切换checkout；执行前仍需对这条准确源码/SQL闭包与Node、tsx、pg、zod的解析来源/实际依赖做fresh固定，短freeze只保护这些输入。此次未重核全部第三方传递payload和Node images，也未import，不能冒完整入口运行证明；若届时有差异/无法闭合，保持一次受控root6c源码窗口候选，不现在切换。未覆盖的直接消费者是“真实旧backend身份、只迁入新产物且Webhost已合法采用7d1→root公开bootstrap→原operation新artifact→产物refresh/resume”；后继最小隔离验证需保存首次前后state/operation和拒绝路径，不预填新backend状态、不将r2结果扩作其通过证据，本读段不执行。

合法首次bootstrap已经持久7d1 operation后，可直接复用上述固定产物函数或该文件原命令入口执行同op refresh(target=6c)/resume，无需开发main提供维护代码。输入必须绑定迁入后7d1 descriptor/manifest/inventory与实际root身份、sourceRepository等于真实Flow、完整6c维护依赖及产物内pg/tsx/Node解析、私有config/marker/runner身份、原operation/version和真实Webhost/report/context。`maintenance-host.mjs:67–69、105–106`在有backendArtifact时验证产物，只有无产物才调用currentSource查开发Git；原withPreviewLock、marker/runner校验、pool finally、hold/nonce停止与维护FSM照常运行。此后半段资格及root首入口源码相等不是个人fresh gates或执行授权；三真实App报告仍缺，当前0import/PG/个人读取。

本次只读核的固定源码均为6c：`tools/personal-preview/{cli.mjs,maintenance-host.mjs,preview.mjs,browser-session-configuration.mjs,web-release.mjs,backend-release/host.mjs}`；同一具体维护实现已由r2真实消费。SVC08 caller旧请求/namespace已消费，仅复用方法，必须另固定7d1实际输入；不原样重放c7b request，也不新造部署/监督框架。原个人完整更新授权与执行窗口/独立审查仍分开：目前缺三真实报告、fresh个人基线及新一次操作身份，**0个人读写/PG/Chrome/provider/query**。此文不启动任何阶段。

本段clean-code/文档复核：只复用原迁入/工具/维护/锁，状态所有者仍为原private state和中心维护行；没有新增第二FSM、runner逻辑或执行包装器。9个引用均可解析，git diff格式检查通过；status人读字段未变，沿用上一文档段已记录的parse errors/human missing为空结果，不声称本次重新运行parser。历史开工UNKNOWN保留。0工程检查。
