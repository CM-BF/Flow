# 当前安装迁入与维护入口

本片固定可调用的参数装配和两个只读依赖接缝；不是个人执行实例。`current-update-template.json` 的 `ready=false`、现场身份为 null，新 namespace 未创建。Web8dfb正式四App报告及独审已接收，20文件/9420B与04da/context81a8一致；准确来源集中于managed-update-inputs.json formalFourAppIntake。没有读取个人安装、PG、HTTP或服务；旧迁入/维护/退休原件不重放。

## 责任与调用

| 入口 | 唯一职责 / 依赖 |
| --- | --- |
| `current-import.mjs` | 将已冻结的7324 current-migration Module装配成一次调用；独占自有run、真实dev/ino、既有迁入双锁/完整verify/fsync/no-replace保持 |
| `current-maintenance.mjs` | 12个固定phase调用与保留门；公开maintenance模块持有操作FSM；没有第二调度器、退休或repair动作 |
| `current-operator.py` | 固定Node/loader/cwd/参数、runtime pins和私有输入身份；复用原OPS14与maintenance executor，不复制监督循环 |
| `runner-files.mjs`可选port | `validateAdmission(bytes)`仅替换admission判定，默认strict-v1不变；原完整有界inventory、双读、原子rename观察和unknown语义不变 |
| `history-projection.mjs`可选port | `{Pool,loadPreviewConfiguration,assertPreviewMarker}`显式绑定选定产物；未提供时保持旧默认。查询/旧列/事务/字节界限不变 |

未来在独审、正式报告与fresh现场冻结之后，准确调用为固定Python + 本树 `current-operator.py --execute-fixed-import <0600绝对instance路径> <SHA256> <唯一window>`；迁入完成、三个新报告通过既有公开导入接口安装并复核后，使用同入口 `--execute-fixed-maintenance <instance路径> <SHA256> <同次已协调window>`。三个retained报告通过本树固定 `--execute-fixed-retained-reports` 导入；具体来源/IDs已绑定。本次新增 Web 两段入口见下节，模板仍因现场输入缺失而未ready。

两次动作的exclusive outer路径、迁入instance路径/digest、run目录、全部current源pins随同一审定实例明确。迁入120s+.5TERM+2reap；maintenance独立900s+2reap，不因fsync/phase推进重新计时。旧executor逐phase用childPidOnly，外层只约束operator，不能据外层absent推断个人detached三组已停；缺内层终态继续unknown。阶段记录wx0600/fsync，失败KEEP无自动重试、rollback、删journal、bootstrap复投。实际服务只能由固定公开模块操作。

## 真正的解析闭包

`current-entry-readonly.json`固定33个已有源码/方法/runtime身份，以及facts旧树的14个pg生产依赖包和14个实际alias。138个文件共469,685B，复用cd27固定manifest中的对应inventory逐文件校验，不再复制包payload/hash全集。新入口源和本次两个port由最终manifest绑定，实际调用还要求其完整identity pins。Node/Python/OPS14与原clone/no-replace来源保持。

**facts没有全部迁到产物中。** 调用c51旧`center-recovery-af51/facts.mjs`只注入现代`findWebCompatibility`。它的`process.mjs`、`readWebRelease`、`verifyWebArtifact`、environment以及`createRequire(old-history/package.json)('pg')`仍来自原personal-history树；本记录明确绑定这些路径和pg实际解析到web-attachment-production的既有安装。固定子环境不提供`NODE_PG_FORCE_NATIVE`，不访问pg.native；ps/lsof/git沿原固定PATH使用本机系统工具，不宣称OS动态库也封装在artifact内。

相对地，history的Pool/config/marker以及configured报告校验、公开maintenance均取完整verify后的选定产物。bootstrap之前用已安装7d1，refresh及全部后继观察用cd27；cwd与tsx loader同所选root。源manifest与现配置repository仍真实Flow，Webhost仍7d1。旧facts的af51报告查找只是保留历史release pointer观察；实际兼容门始终明确04da backend source + normalized context81a8 + 三个正式报告IDs，不拿旧af51/C3或Webhost source替代。

## 新维护的停止条件

- 原六个私有文件及三owned记录先fresh冻结。新run/operation与旧held、R1–R4不同，不提前写state.backendArtifact。
- bootstrap合法生成新operation；operation阶段读同op/version/target，要求active0/uncertain0和两次相同完整namespace观察。v2必须精确四字段、绑定实际runner、合法opportunity UUID、空assignments；未知字段/旧inFlight/pending投递或body spool均停止，不能以空assignments忽略其他材料。
- 本薄调用没有等待任务的轮询循环。若drain后尚有工作或发生无法解释的历史变化，按记录停止在原维护状态，留待受控处置；不会为求绿取消或清空用户任务。
- refresh走原真实三角色生命周期。ready-paused checkpoint要求旧三组（尤其旧center）确停，原旧列/行保留、SQL migrations零变化、只有drain+hold两audit增量。checkpoint持久后同op再确认才能显式resume。
- final分别记录服务启动、accepting/CAS和`actualClaimRecovery=UNKNOWN`。自然用户工作在resume后可发生；不制造任务、手工claim或模型query。

## 字节预算是已有占用后的余额

原executor仍将其`personal-actual-r2/`全部42个归档文件计入同一个2,097,152B检查，固定fd9来源逐字核同，合计**119,396B**。这不是新的空2MiB。现有393,216B capture/观察reserve保持；新maintenance run在reserve前最多1,977,756B、之后1,584,540B。每phase仍64KiB，旧raw路径集合或hash变化会在执行前拒绝，执行循环仍按真实当前总量扣减。迁入外层/本次报告/诊断等总量还须由最终实例及当时团队完整预算纳入；当前不把模板当现场准入。

新产物总逻辑367,045,616B；512MiB新增规划、最低2.5GiB与届时团队floor取大、live1GiB保持。CoW实际独占physical未知；无build/install。真实报告已齐；现场绑定/实际窗口尚缺，当前只交付此准备片。

## 后台三报告与新网页第四报告分段

1. 后台instance A保持原12phase/三retained合同。固定operator依次接受 `--execute-fixed-import`、`--execute-fixed-retained-reports`、`--execute-fixed-maintenance`；每次均为 `<0600绝对plan路径> <SHA256> <window>`。三个报告调用当前7d1公开 `importPreviewCompatibility`，不重写policy；后台refresh后仍d629/v3。原迁入capture原先误传2MiB，现为OPS14允许的1MiB，整体raw预算仍2MiB；真实OPS14纯校验同时证明旧2MiB参数拒绝。
2. A的 `final.json` 必须真实 `resumed-confirmed`、target04da、accepting同op结束。之后在原获准现场段只读取得新六文件dev/ino/bytes/hash、三owned记录摘要及完整v3 release，绑定到新的Web instance B；不能沿用更新前A的state/maintenance/PID。B引用A的final.json原bytes/hash，固定同cd27后台、原7d1 Webhost、现配置/marker/端口、三retained完整descriptor与namespace。独立可审的B private0600 JSON由既有现场参数冻结方法持久；原A bytes不改。复制A的非变化参数形成Web阶段plan时仅填 `webPublication.transferInput`、三个actions的输出目录/outer与transferOuter，仍由固定新plan digest调用，不即席写JS/改变维护源。
3. `--execute-fixed-web-import` 调用 `current-web-transfer.mjs`。固定779来源与manifest10files/1700569B/1651B、releaseId均核；复用现preview操作锁、完整Web verifier、原migrateOnce和macOS排他rename。Web store没有独立backend prepare锁，本阶段与所有既有Web变更共用preview锁；backend迁入继续原双锁。store必须恰旧3项；真实校验后的4项总资产遵循count4/192MiB。先wx600 intent、完整stage/fsync/checkpoint，最后no-replace移动同卷，完整verify后记complete；pointer字节/六文件/三进程都保持。已有目标拒绝，不把重复导入当成功。
4. `--execute-fixed-new-report` 调用cd27公开接口导入第4份正式报告；`--execute-fixed-web-publish` 才调用公开 `publishPreviewWeb`，精确expectedVersion3/backend04da/artifact779/report071d，形成v4/current779/原三项+新项。每个动作独占一个新记录目录与wx600外层结果，现有目录拒重放。新Web不混入后台12phase的reportIds。
5. 新Web三个动作及retained导入各30s+.5TERM+2reap、各64KiB capture，复用同OPS14 NEW_CHILD_SESSION。不增加个人服务停止策略、不刷新用户tab、不发任务或模型。pub返回ready后核v4和全部descriptor、配置/policy/maintenance原hash/devino；state仅容许public工具写入webReleaseOperation。旧后台更新已发生后Web任何失败不会回滚后台；发布可在pointer提交后失败，因此unknown保留、停止后继，不重试或根据stdout猜回滚。

`current-web-transfer`只拥有artifact文件迁入；`current-web-actions`只装配已有公开报告/发布接口；operator只固定loader/cwd/argv。发布FSM/CAS/兼容/实际host identity仍由原产物模块持有。实际源码先完整verify固定cd27或7d1才动态加载；继承33readonly、138pg文件、14alias及/usr/bin/python3排他改名来源原记录，不以moving main替代。

本次直接证据：9个新微型文件夹行为、4个真实argv映射及未知动作拒绝、3个真实OPS14 Policy边界、1个Node权限沙箱导入场景。三轮619ms/raw1251B、三组absent/双EOF/无signals、三exact空scratch删除；没有PG/HTTP/个人I/O或真实payload复制。`current-web-transfer-local-01.json`等是原始输出；参数模板不是真实执行证据。

第4项Web资产含manifest为1,702,220B，正式4报告9420B；与cd27迁入合计368,757,256B逻辑新增（未含操作记录），在原512MiB规划内，physical未知仍须fresh。不把逻辑bytes当磁盘实占或准入证明。原maintenance继续扣119396B历史raw；最终现场单份输入还须将新4外层记录/迁入/各动作记录总量纳2MiB，并以当时真实已用量冻结，不声称每步重新获得空预算。
