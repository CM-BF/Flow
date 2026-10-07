# 首次固定产物：执行入口准备

当前 NOT_RUN，固定一致main为 `3230becf07b804479ec4dc7ef02fcaff58cc3858`，包括已独审root pg8933247与SVC08。等待本执行入口唯一独立审查及共享重窗口，非新的普通实现审批。`inputs.json.ready` 和全固定bindings均在实际工作前拒绝漂移。目录中 `actual-first` 必须不存在，不能换目录名掩盖未知结果或自动重试。

## 单一入口与责任

将使用已安装 Python3.13 的 `-B supervise.py`。仅复用固定OPS14 NEW_CHILD_SESSION：420秒工作、0.5秒TERM、2秒reap；entry及git/tar/clone/pnpm/Node证明子进程全在同一owned组，未创建detached服务。原clone/install各180秒不增。外层持久化前已结束监督，原Report交由工具输出保存；关键reservation/自有root identity/构建记录/result在entry内独占写入并fsync，受同一截止约束。没有嵌套监督组或可逃逸安装组。

entry只调用既有prepareBackendArtifact与verifyBackendArtifact，真实离线frozen、ignore-scripts、copy安装保持，私有HOME/cache/store/配置由原builder负责。原stage发布前checkpoint及失败保留规则不变；entry不清理未知stage/lock、不停止个人服务、不改开发checkout。成功后也保留一个自有产物及其700根，供后继真实host/隔离验收，不将其提前删除。原store最多2产物/2GiB及单artifact1GiB/100k条目继续有效，本次新root仅一个产物。

导入证明通过新产物自身tsx加载，只检查导出函数，绝不调用createServer/runRunner/SDK query/preview/maintainPreview。入口包含真实server、runner、backend host、preview、maintenance-host、Vite/SDK，root pg路径必须在artifact内部。SDK darwin-arm64本机执行文件仅stat/version，不执行。30个SQL按固定Git bytes/hash核存在；不称迁移已运行或数据库/宿主生命周期已通过。完整inventory负责内部symlink、nlink与内容身份，Node和非system dylib由原verify核。开发checkout没有隐藏/改动，本次仅内部解析证据，实际开发树不可用时的行为仍后继。

## 空间、输出与失败

准入取原2.5GiB和新增预算+1GiB中较严格者。预算同时计：artifact/root文件及manifest最多1GiB；selected seed给512MiB allowance（观测逻辑354,552,778B，不能当physical）；source archive32MiB；安装HOME/cache128MiB；目录/文件系统metadata512MiB；raw2MiB。发布仅rename root，不再整份复制；最终artifact与selected seed在stage清理前仍同时存在。该预算不计APFS clone节省，非文件系统预留或quota。500ms实际卷free观察、结束前末采核live≥1GiB以及fresh-to-current下降不超新增预算；其他writer也影响观察，采样不是原子峰值，不能保证任何瞬间绝不跨线。

OPS14实际capture上限1MiB，使用1MiB而非不被模块支持的2MiB参数；总raw预算2MiB另含构建record/导入输出/最终结果。entry拒绝复制>256KiB的record，并保留其原位置；末采合并原record、证据副本和import输出，并额外预留完整1MiB外层capture与64KiB最终metadata；原builder安装输出上限/JSON展开仍可能在末采前越过raw观察阈值，这时只能报告失败/unknown，不能宣称硬磁盘上限。产物和依赖总空间由前述更保守预算覆盖。所有原始失败保留，不因无法获得绿结果再跑。

| 场景 | 停止与保留 |
| --- | --- |
| 输入hash、版本、source或fresh资源不符 | 仅独占reservation/失败result；不开始prepare |
| clone/install/verify/import失败 | 原checkpoint优先；保留最早错误、独立记录持久化错误、stdout/stderr；不改参数重跑 |
| 420秒/输出超限/资源观察unknown | OPS14终止本组；子进程/EOF/资源unknown如实保留；不得靠结果写盘延缓停止 |
| 发布或清理中断 | 不删artifact/root/stage/lock；原published/failed记录决定后续只读恢复 |
| 成功 | Report exit0/无first failure/全EOF/group absent + entry结果与产物验证共同成立；留产物，不称完整SVC06通过 |

## 原cache观察及限制

`cache-stdout.txt` 是固定8c的唯一只读观察：271index/10,648选中文件；其中3个源CAFS executable mode与index不同导致额外metadata检查exit1。`cache-mismatch-details.json` 保留其regular/bytes/实际0755与声明0644，nlink2。已审clone真实合同按内容完整性与稳定身份检查源，不要求源mode或nlink1；clone目标必须nlink1。因此保留这3条观察，不把它们当缺cache，也不重跑为绿。全内容hash仍由真实clone执行时验证，本次原观察未验证完整内容，更没有安装/物理收益证明。

新root pg本已在server闭包内，固定8c锁纯选择仍271snapshot。新main271个选中package key/cache index path已逐项对照旧观察完全相同，固定锁hash不变；原3条mode观察保留，不再读取全部缓存payload。所有旧raw与source保持，准备入口独立审查不扩大此前有限批准。

唯一未来运行命令：`/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/svc06/artifact-first-run/supervise.py`，cwd本权威backend-release树。外层Report先由工具原始输出保留，随后在同scope正常归档，禁止预先重定向到尚未创建的actual-first子目录。实际SDK0.3.290已装metadata只读核：sdk.mjs同目录package.json、原SDK锚可resolve darwin-arm64/package.json，claude为regular executable 233260816B；见sdk-layout-observation.json，无SDK import/执行。
