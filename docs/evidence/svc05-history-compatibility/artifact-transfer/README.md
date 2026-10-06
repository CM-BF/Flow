# 固定 d629 搬运候选与唯一身份读取

2026-10-06 18:07 UTC。**脚本未运行、未import、未语法执行检查；没有复制到个人安装。** 此目录在既有SVC05H01 v2 plan/evidence claim内；没有新增产品入口、部署FSM或依赖。

## 新的身份事实

[identity-once.json](identity-once.json)记录18:03:58一次原生HTTP GET，0重试/redirect，2秒/4KiB界限。owned Web PID/PGID65219运行且61228监听归属匹配；读取在响应前返回`ECONNRESET`、errno=-54、syscall=read、cause=null，无status/body。这是本次具体失败，不把前两次泛化unknown倒填成同一原因，不推断页面坏或根因。已停止探测；旧wrapper丢弃子进程stdout/stderr，没有把未知日志正文作为证据。

## 固定脚本 Interface

[import-d629.mjs](import-d629.mjs)仅在显式 `--execute-reviewed-d629` 参数下执行；默认拒绝。该标志不是授权凭证，本轮仍无执行许可。所有路径、后台af51、artifact d629、source506、release3883、10个文件/1,588,311B身份固定；manifest原始bytes的SHA就是已审descriptor，不允许调用者换manifest/任意URL/路径。

将原Flow工作目录先按Lead安排固定到准确af51/clean，动态加载该源码已有`loadPreviewConfiguration`、`withPreviewLock`、`assertPreviewMarker`；不从候选WT调用load，不改config.repository、不造第二锁。现Web version2/current caa1与两个cached artifact必须仍精确匹配，已有stage或额外root条目拒绝；目标存在即拒绝，不把存在当本次成功。marker是现有只读DB校验，只在后续批准的实际窗口执行。

源根/资产目录拒绝symlink与非本机owner；文件通过O_NOFOLLOW打开，size/hash匹配才读入，固定路径只允许index.html及9个assets叶子。stage建在个人web-artifacts同一目录，0700，逐文件wx/0600写入并fsync，完整目录/manifest/file清单复核，再fsync assets/dist/stage。prepared回执先落本证据目录并fsync；最后用Mac `renamex_np(RENAME_EXCL)`原子发布，父目录fsync后再次全量核对。已有目标即使为空也不能被替换。无普通rename/copy覆盖fallback。

Node标准rename没有原子no-replace契约，因此选一次有界`/usr/bin/python3`调用系统renamex_np，2.5秒/1KiB输出；本机SDK `sys/stdio.h`确认RENAME_EXCL=0x4，`sys/attr.h`声明卷能力。Darwin或能力缺失拒绝，不改成普通rename。Python只在搬运步骤使用、不进入Flow后台runtime；实际tiny检查须先证明此调用可用，当前只有声明核对。

操作只产生新artifact，不改web-release pointer/maintenance state，不导入报告、不重启/发任务。兼容报告继续用既有CLI。完整tuple仍af51+d629；metadata新HEAD不替换它。两个旧retained af51报告由Web另行准备。

## 生命周期与未知

先确认已有两artifact和空间≥1GiB+16MiB（检查非预留，实际窗口可提高），最多新增约1.6MiB压缩静态文件及小receipt，无安装/构建/大copy。已有版本不删。每次run生成新stage/receipt，但不自动重试；重复执行前需操作者独立确认原结果。

任何失败保留stage/已发布artifact，不自动rm。reservation和prepared先持久写；rename调用开始后的publication为unknown，确认返回才记rename-confirmed。fsync、后验或最终receipt失败均不声称未发布，保留目标ID用于只读核对。目录和文件同步不冒硬断电/恶意同UID隔离保证；既有operation.lock是合作互斥。脚本不清个人旧stage/产物/用户页面。

## 待批的 tiny 文件验证方案（0PG）

单独/tmp随机目录，预先保存dev/ino；10个tiny文件合计≤1KiB，预计全部raw/temp≤128KiB，≤15秒。只import脚本的file-only seam，**不调用transferD629/固定宿主tools/marker**；不触个人根。拟6个定向检查：

1. 10文件正确树size/hash通过，完整stage→RENAME_EXCL→目标后验，源仍同bytes。
2. 错hash或短文件拒绝，未发布。
3. 源叶子symlink、assets目录symlink分别拒绝。
4. 超出清单文件拒绝，不复制隐含资源。
5. 目标已存在（含空目录）时RENAME_EXCL拒绝，原目标dev/ino/内容及stage均保留。
6. 正常纯文件落盘后的目录/文件同步完成；先保存结果再按已记录dev/ino清理自有tiny目录，异常保留。

这只验证文件操作与排他rename，不证明真实marker/lock/发布权限或个人搬运已完成；真实操作仍须独立审查、fresh源/依赖/身份及显式窗口。未启动检查、PG、browser、provider或个人操作。

应用find-skills→本地clean-code/codebase-design：选择一个固定目标的procedural脚本，持有与状态复用原host，文件校验和原子提交在小私有seam；不把缺import命令长期当障碍，不扩通用artifact平台。技能与本机头文件摘要见manifest。
