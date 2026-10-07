> 当前续接（2026-10-07）：R2 的7d1迁入、Web-only宿主替换、三真实报告导入与205B策略已实际完成并限定独审，后台仍af51。本文原六步为历史准备，已完成四阶段不可重放。后续唯一固定调用与新namespace见[剩余维护入口](maintenance-continuation.md)，实际bootstrap/refresh/checkpoint/resume仍NOT_RUN。

# SVC06 固定诊断产物的个人受控更新候选

唯一新 runtime source：`6c0fdcda8858aac33489c48c1948e902dd6a3d7e`（Lead 固定 `codex/svc06-diagnostics-runtime`）。父为 b2b；仅已独审 source3cb 的 preview/直接专测/new diagnostics/专测四文件变化，其余 Git blob 均相同。不是 moving main。旧 c2c 与 b2b r1 失败/清理及所有原始证据不变。

## 当前一次执行清单（2026-10-07，只读准备，尚未操作）

[单份现场准备记录](personal-readonly-preparation.json)的实际观察为12:00:11.436546–12:00:12.053698 UTC；supplement与固定输入随后有各自时间。原claim3346 v9双metadata仍active。个人安装`727db807-5997-45cf-ace2-b5d1fd06f1eb`仍af51/accepting v18，无DB maintenance operation；center78240/runner99312/Web22704均owned running、两个原端口归属匹配。backendArtifact为空，独立Webhost为c7b/422，d629/v3与三retained保持，browser-session文件缺失/default-off、operation.lock不存在。五私有文件hash与SVC08 r3逐字同，未复制token/配置正文。现在5个task、0unfinished/0uncertain；r3当时4个task，这不是可回滚或阻止用户工作的理由，新的真实基线以本次只读摘要为准。

Web唯一来源为`web-release-compatibility` clean `c06fa79c931998eb03a9d04d441681767fd796bf`：[C3 actual](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-release-compatibility/docs/evidence/wpf-release01/fixed-origin/caller-c3-actual/README.md)。3App实际PASS/已归还由其原记录证明，首次读取时独审PENDING；现已接[Web唯一独审](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/release-c3-actual-admission-20261007/root-c3-actual-compatibility-review.json)，11:59:06.606725 UTC `APPROVED_FIXED_ARTIFACT_ACTUAL_COMPATIBILITY_AND_COMPLETE_RETURN`，10,867B/SHA69e9f809…，不是本owner代批。对固定Git和当前15份报告原件的7,065B逐hash核同，3报告均为format2、source6c及context81a8abe；12 checks各有同tuple和true observations。报告目录分别为该canonical下`raw/fixture/retained-461a`（ab8d9229…）、`retained-caa1`（16544b18…）、`retained-d629`（eb6e8f89…），完整ID/hash/路径在单份记录。原生旧App为Bearer，Cookie/CSRF另有真实页面补证；6c未含后继lateLogout窄修，本次不扩大该race验收。

| 顺序 | 一次实际入口与固定条件 | 必须持久的检查点与停止条件 |
| --- | --- | --- |
| 0 复核/预约 | Lead核本fixed候选、Web唯一actual独审与实际共享窗口后，fresh重核claim/安装根/五文件/三个owned组/维护与未完任务/精确来源及空间；新独占0700 run身份，本次准备不创建。 | root当前36 Git+8显式输入均同6c，4aliases/Node/Python/OPS14同原固定，15包978文件6,609,996B同7d1 manifest；当前whole artifact payload未重验，实际迁入必须完整verify。只冻结此准确闭包，不切moving main或全局冻结源码。 |
| 1 迁入7d1 | 复用SVC08既有`procedure.mjs:migrateOnce`与原clone/verify/`renameExclusive`方法，在现withPreviewLock→withStoreLock下执行一次。新目标`~/.flow-personal/backend-artifacts/7d1…`当前不存在；不调用旧caller整入口（其webHost=null历史前置不适用于现c7b）。 | 原c7b保留；先0600/fsync intent，固定source根/devino+manifest，再完整inventory verify、受控copy、目标verify、no-replace发布与checkpoint。迁入是store动作，绝不预填backendArtifact/maintenance。失败stage KEEP，不自动重放成功阶段。 |
| 2 legacy Webhost替换 | 策略仍缺失；同6c公开`inspectPreviewWebHostSource`→`replacePreviewWebHost`（或其严格web replace-host CLI），fresh request包含新UUID、expectedVersion3、actual backendaf51、原current compatibilityId、pointer/旧Web record/destination host source digest和webHostArtifact7d1。 | 旧c7b是合法先前webHost，不将其视为空；生产helper自行保留后台/runner/state保护部分。一次有journal的TERM/launch，ready后确认af51/v18、d629/v3/retained、config/profile/token摘要不变。未知停止，不重试或回滚，不刷新用户tab。 |
| 3 报告/私有策略 | 只在C3 actual独审通过后，用同6c公开`importPreviewCompatibility`导入上述3目录（原内部withPreviewLock）；不重写pointer。核全部新context可find/verify后，在同原private lock、原文件仍absent时0600 exclusive写入原SVC09 schema的browser-session策略并fsync。 | fixed installationId；cookieOrigin/trustedOrigins=`http://127.0.0.1:61228`，authEpoch=`svc09-b2b-20261007`，context81a8abe。先记录无凭据策略bytes/hash/identity，prepare/runService双重pin。任何tuple/旧host能力不符在drain前停止；不依外部env启用。 |
| 4 首次bootstrap | `node --import tsx`使用已匹配root `/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/maintenance-host.mjs`既有直接入口（action bootstrap、directory真实安装、target6c、backendId7d1），或同模块公开`maintainPreview`同参。 | 原maintenance文件保留历史摘要；仅原FSM创建新真实operation/backendArtifact并drain，不伪造state、不走CLI旧runtime选择。读取返回和op确认后才下一步。[首次采用实证](../legacy-first-bootstrap/RESULT.md)5checks已main62e9，三idle角色只证入口/FSM，真实三roles由r2另证。 |
| 5 同op refresh/保留/显式resume | 从迁入7d1/root/tools/personal-preview/maintenance-host.mjs既有入口执行同operation的status/refresh(target6c)/resume；复用原hold/stop/start/FSM及固定Node、产物内tsx/pg解析。 | drain等当前工作自然结束；不能取消任务/清journal/复投query。refresh确实停止Web→runner→center并启动center→runner→Web，保runner身份/token与d629指针/3retained、旧业务数据。ready-paused先持久新旧身份/迁移27→35/配置与业务摘要；只有同op正确、保留门禁确认才显式resume。合法后台变化单列，不要求全库hash机械相等。未知保暂停与原件，不自动重启/换key。 |

迁入规划新增512MiB（包含367,041,727逻辑B产物、metadata/策略/报告/私有输出；raw总2MiB），stage→destination为同份原子rename，不把CoW当零物理成本；fresh取原2.5GiB与总并发规划+live1GiB较严格者。准备时实际free21,930,897,408B不是未来准入。migration120s、Web replacement28s、报告/策略30s；维护仍原总15min deadline（含轮询、hold、refresh和resume），每调用消耗同一剩余期限。复用原OPS14 childPidOnly/.0TERM/2reap，detached角色不由父监督猜杀；失败保存primary/cleanup、未知停止，不以deadline自动resume。正式阶段预算/资源记录在同一run，不另造许可与manifest链。

个人现backend store仅c7b，导入7d1后2项达到现正式2artifacts/2GiB边界；现三Web资产合计4,538,660B。当前7份compatibility报告/35文件11,882B，3份导入后10报告/50文件18,947B，低于正式32报告；不删原件/旧artifact。192MiB/4Web项是正式集中策略，第四App仍独立owner/CAS/报告验收，不由本次后台更新顺带发布。本段只采已知文件metadata/报告与只读DB摘要，0HTTP/复制产物/个人写/服务变更/query。新请求固定字段、11文件host source digest及205B非秘密policy候选bytes/hash已并入同一记录，operationId尚未创建；须迁入后由生产inspect再核。真实执行仍等本清单独审与明确窗口，且所有fresh gate必须临执行重做。12:01:55 Lead消息确认X01 cleanup-only仍exclusive，当前不得进入个人操作。

> 以下保留10:53–10:59方案形成过程；其中“未fresh/缺报告/未验首次入口”等为当时边界，当前事实以上表及单份记录为准。

## 构建小差异

沿前次 build-once 方法，builder九模块、Node24、pnpm9.15.4、私有yaml2.9.0入口以及OPS14不变。新目录 `build-once` 与新随机私有根 `flow-svc06-diagnostics-artifact-*`；旧 actual-first/outer不复用。entry仅根前缀变化，supervise仅Python module别名变化；新增runtime-proof只从新产物内部import诊断模块、核64KiB常量及export，不打开诊断文件/进程/服务。

源归档998 files /7,834,095 logical B；72关键固定输入含33 SQL。14 package/lock/workspace声明与b2b字节一致，仍7 importers /271 snapshots，root tsx+pg、显式Vite host工具。fresh仅271旧选择索引2,252,500B逐hash核同；未扫描/哈希10,648 payload，实际selected clone核原件+目标hash。旧3mode观察不改，不冒cache全部完整或物理峰值。

总新增规划2,317,352,960B，包括stage/install→final同份1GiB、seed512MiB、archive32MiB、私有pnpm HOME/cache128MiB、metadata余量512MiB、raw2MiB。另live1GiB和协调512MiB；fresh最低3,927,965,696B，仍严于原2.5GiB。实际并发超协调余量则加严，不降gate。work420s+.5TERM+2reap，clone/install各180s，outer capture1MiB/总raw2MiB。原500ms filesystem sample不是原子峰值或硬预留。

## 已完成的隔离宿主差异（历史准备边界）

该历史准备现已由[固定产物结果](RESULT.md)和[r2隔离结果](../diagnostics-host-bootstrap/RESULT.md)闭合；新artifact和独立namespace实际验证完成，不能重用已消费r1/r2。原准备顺序为：复用原真实维护/owned process及独立cleanup入口；选择新artifact为实际center/runner/Web代码，af51旧代表数据流程仍必要，不另造SDK/模型启动或绕过ready。

首先只进入原默认宿主启动检查；若再次失败，按本run nonce读取新阶段JSON、受控父首错、原数字exit事实，并仅在私有诊断中检查每role最早64KiB stderr。公开结果只bytes/hash/truncated/EOF/受控code/role/phase；不把raw输出、argv/env/凭据写进公开证据。不能从缺阶段推出child未启动，配置load前仍可能unknown。原ready10秒不增、不用注入替换真实spawn。成功才继续原packet尚未到达的迁移/策略检查；失败按原独立cleanup证明work组终态、detached nonce身份、marker/OID/有限零连接后normal DROP，unknown KEEP。该隔离入口及实际结果现已分别独审；本段保留原准备语义，不是可执行个人操作。

真实三retained App报告仍由Web owner对**新6c实际后台source+normalized publicOrigin/policy digest**生成；b2b、旧af51/v1或手工loader fixture不能冒此组合兼容。未来个人顺序仍legacy先新Webhost→三retained完整v2新tuple→新backend+policy→第四App显式CAS，原身份/后台/指针/tabs不动，当前无个人窗口。

## 10:53 固定输入与当时缺件（历史准备）

本段方案对齐开始时间：`2026-10-07T10:53:26.485603+00:00`（owner实际开始编辑本候选；任务总开工仍UNKNOWN）。个人安装本段**未fresh读取**，以下旧状态全部为原封存历史参照；本候选不是已就绪的个人运行包。

- 新唯一产物：`7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920`，source `6c0fdcda8858aac33489c48c1948e902dd6a3d7e`，真实Flow sourceRepository。[descriptor](build-once/actual-first/result-descriptor.json)、[构建限定独审](result-independent-review.json)固定，367,041,727逻辑B（含manifest），不能据CoW推为物理零成本。复用现产物，不重build/install。
- [r2结果独审](../diagnostics-host-bootstrap/result-independent-review.json)限定证实自有af51旧27迁移→新35、真实三role refresh/resume、default-off→显式策略、代表旧业务列/指针/config/profile保留、cookie/CSRF/logout。main/origin `6571056455be3e4289f162041746420246ac2db4` 已接同范围结果。合成loader报告绝不进入个人材料，也不替代三真实App。
- 历史个人参考仍af51、accepting/v18、Web d629/v3、独立c7b宿主，三retained为461a/caa1/d629。[SVC08实际采用](/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-web-connection-lifecycle/docs/evidence/svc08/flow-host-artifact/personal-adoption/attempt-03/RESULT.md)引用权威 personal-web-connection-lifecycle 原封存记录；读取失败不当空白状态。实际操作前精确采样installationId、marker、源/已选artifact、三组完整owned身份、全部retained/指针/兼容报告、配置/profile/令牌摘要及维护/工作状态；不输出凭据、不用历史值重基准。
- **执行前缺件：** Web原owner为461a/caa1/d629各提供真实App format2报告+read/send/recover/negotiation四份原件，每份绑定**source6c + 本artifact tuple + 下述公开context**。此处本artifact tuple指相应Web artifact descriptor，不是后台7d1 descriptor。b2b、af51/v1、不同origin/策略或synthetic材料均不能替代。原历史v1只支持legacy路径。
- 公开候选配置保持已约定值：cookieOrigin/publicOrigin=`http://127.0.0.1:61228`，trustedOrigins仅该项，authEpoch=`svc09-b2b-20261007`；normalized context为format1，policySha256=`81a8abe98d6541c34d07b15611e773f9bd4b53f8c6785bbaaab6e3dd03b3d638`。authEpoch字符串是固定非秘密标识，不是source；本候选expectedBackendHead改为6c。旧[b2b公开配置文件](../update-b2b-candidate/proposed-public-context.json)作为历史不改写，不直接拿其backendHead作新报告输入。公开入口若需变更，先明确新tuple并由Web重绑，不靠同source放行。

## 原工具操作序列的依据（当前顺序以上表为准，个人仍未执行）

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

因此无须仅为main总SHA不同切换checkout；执行前仍需对这条准确源码/SQL闭包与Node、tsx、pg、zod的解析来源/实际依赖做fresh固定，短freeze只保护这些输入。此次未重核全部第三方传递payload和Node images，也未import，不能冒完整入口运行证明；若届时有差异/无法闭合，保持一次受控root6c源码窗口候选，不现在切换。当时未覆盖的首次直接消费者，现已由[原首次采用结果](../legacy-first-bootstrap/RESULT.md)及[main回执](../legacy-first-bootstrap/main-receipt.json)限定闭合：artifact入口先拒绝、root合法创建、artifact同op重读/audit恰1、state不变。此单例为3owned idle角色，不替代r2真实三roles或本次个人fresh执行；不预填新backend。

合法首次bootstrap已经持久7d1 operation后，可直接复用上述固定产物函数或该文件原命令入口执行同op refresh(target=6c)/resume，无需开发main提供维护代码。输入必须绑定迁入后7d1 descriptor/manifest/inventory与实际root身份、sourceRepository等于真实Flow、完整6c维护依赖及产物内pg/tsx/Node解析、私有config/marker/runner身份、原operation/version和真实Webhost/report/context。`maintenance-host.mjs:67–69、105–106`在有backendArtifact时验证产物，只有无产物才调用currentSource查开发Git；原withPreviewLock、marker/runner校验、pool finally、hold/nonce停止与维护FSM照常运行。此后半段资格及root首入口源码相等不是个人fresh gates或执行授权；三真实App报告仍缺，当前0import/PG/个人读取。

本次只读核的固定源码均为6c：`tools/personal-preview/{cli.mjs,maintenance-host.mjs,preview.mjs,browser-session-configuration.mjs,web-release.mjs,backend-release/host.mjs}`；同一具体维护实现已由r2真实消费。SVC08 caller旧请求/namespace已消费，仅复用方法，必须另固定7d1实际输入；不原样重放c7b request，也不新造部署/监督框架。原个人完整更新授权与执行窗口/独立审查仍分开：目前缺三真实报告、fresh个人基线及新一次操作身份，**0个人读写/PG/Chrome/provider/query**。此文不启动任何阶段。

本段clean-code/文档复核：只复用原迁入/工具/维护/锁，状态所有者仍为原private state和中心维护行；没有新增第二FSM、runner逻辑或执行包装器。9个引用均可解析，git diff格式检查通过；status人读字段未变，沿用上一文档段已记录的parse errors/human missing为空结果，不声称本次重新运行parser。历史开工UNKNOWN保留。0工程检查。


### e4cd P2 窄修：本次可调用迁入装配（个人仍未执行）

原 e4cd 审查 `REQUEST_CHANGES/P2` 永久保留：旧 `caller.mjs:migrate()` 是私有函数并要求 `webHost===null`；`procedure.mjs:migrateOnce` 仅有 ports，不能将这两个引用当成当前 c7b 安装的可执行入口。现仅新增 [migration-adapter.mjs](migration-adapter.mjs) 将真实生产 `withPreviewLock → withStoreLock`、原 `migrateOnce`、固定 `clone-artifact.py`、`import-d629.mjs:renameExclusive`、完整 source/stage/destination verifier 和 fsync 装配起来。无生产文件改变、无第二 FSM。

唯一命令入口是本目录 `migration-supervise.py --execute-fixed-import`，由固定 Python3.13 运行；[migration-inputs.json](migration-inputs.json) 固定新 namespace `/private/tmp/flow-svc06-personal-update-20261007-r1` 和独占外层文件。当前 **NOT_RUN**。外层只调用现 OPS14 `NEW_CHILD_SESSION(120,.5,2,128KiB)`；复制与 rename 的子进程同组，无嵌套 detached copy，无现服务 stop。组停止/EOF 判断完成后才持久外层 report；deadline/partial result/forced exit/rename unknown 不得继续下一 phase，保留锁、stage 或已发布产物的实际状态，不假称强杀也会执行 finally。正常路径原双锁 finally 正常释放。

53 只读 runtime pins = 原44入口 + 原3运行工具 + procedure、file-readers、clone-driver、rename-module、其实际 `/usr/bin/python3` + artifact 内 file-only clone primitive。每项含 exact realpath/dev/ino/uid/nlink/bytes/SHA；原44的 Git 前像仍6c，未把后来的 main 全树作为源。15包/978文件/6,609,996逻辑B及4alias继续引用已审首次采用输入和7d1原 manifest，执行时按有限库存 hash 核，不复制一套大manifest。Node标准库/系统libc按原系统运行时边界；不是任意系统依赖的全盘证明。3模块新绑定、运行输入与9例原raw见[唯一迁入 manifest](migration-manifest.json)。

实际守卫明确要求五私有文件仍self/0600/nlink1/相同dev-ino/hash、原root身份、af51 source/null backend、精确已settled c7b host/null pending、三个owned记录/运行身份/两监听，以及生产marker与只读runner accepting/v18/op-null。策略文件仍缺失。已有c7b完整验证、store仅c7b和候选7d1；严格原2artifact/2GiB保留、每artifact1GiB。新副本367,041,727逻辑B，无外部symlink/复制回退；512MiB新增预算包含2MiB原始记录，≥2.5GiB fresh/live1GiB不降，实际并发仍在开窗前叠加。clone的regular allocated统计只是已分配块口径，非APFS物理独占或可回收保证；目录元数据/采样间峰值不冒零成本，空间余量不是硬预留。

迁入 intent/store intent/checkpoint/result 独占0600/fsync。已存在精确7d1仅verify并记录，不clone；不一致即停止。阶段前后五文件、原source/host/owned身份保持；只读runner校验无业务DML、不要求零任务、不drain，用户业务并发不能用回滚凑一致。迁入成功后仍必须 fresh request/CAS 才能换Web host，不能由此入口自动执行后续动作。个人真实执行必须经 Lead 的实际窗口和修复独审，不复用SVC08旧namespace。

局部原9个纯接口用例 9/9，103ms；增量独审发现只读 Pool 未设search_path，已限定 `flow.runners` 并补真实Pool port直接用例1/1、103ms（原9不重跑）。合计10different/206ms，两owned组 absent/双EOF，两空exact scratch已removed；Python supervisor仅AST语法检查。测试覆盖精确c7b/拒绝错误身份、第二槽保留、双锁与真实procedure排序、已存在不重复制、copy/rename unknown停止、前后保护拒绝、primary/secondary以及marker失败不打开store。未实际复制7d1、未触个人/PG/HTTP/build/App/provider。C3真实三App已审证据现由 main `e0295747200d7f0616779a712fdfd06691c3708f` 接收；原两层失败、旧unknown及真实个人未部署的界限不变。

原30ce只读查询P2作为静态finding保留；没有真实PG失败或个人动作。最终source `5c29e13a5d251e4fb6b99d7d1277ace85dee24dc`，新直接例覆盖SQL/参数、max1和connect/statement/query超时、成功/行不匹配/query失败/关闭也失败时primary保留；仅本实际I/O port新增可测试接缝，不改原流程顺序。


### 续接准备P2收口（固定0107后继）

原[独审](continuation-first-independent-review.json)指出本地idle门缺失；[剩余维护入口](maintenance-continuation.md)现复用严格v1原reader+已存证namespace/全历史哈希，在同drain/active0前后确认后才允许refresh。独立外层900秒从operator启动前覆盖bindings/持久化；内层独立session缺回执仍UNKNOWN/KEEP，绝不由外层absent猜三角色已停。原R2四阶段、原失败与原件全部冻结；本次只是零个人I/O准备修正，真实新窗口尚未运行。

### 当前剩余维护：R3读取修正后

R2迁入/Web-host/三报告/策略已经实际完成，不重放。R3只读兼容观察遇旧format1 reader，已独审为失败忠实性；其completed[]不代表没有个人只读。当前仅用原facts可选reader端口复用固定现代解码器，旧af51/null报告与6c/C3配置独立判断；新r4只准备剩余维护，须新独审和实际窗口。见[端口差量及保留原红](compatibility-reader-repair/README.md)，原实际R2/R3与所有输入原件冻结。
