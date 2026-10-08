# S01-06 stock initialize/close 资源基线设计

状态：DESIGN_REVIEW_APPROVED（仅方法设计）；实现、sampler、native actual 均 NOT_IMPLEMENTED / NOT_OPEN。所属 FLOW-001 / 原 S01-06，owner status_read，co-lead mika。128 同步 burst / 6s / 4s ACK 完整验收仍优先且仍失败，本设计不改其负载、断言或已审诊断候选，不新建大task。

## 问题与可证明范围

拟测固定 stock app-server 仅 initialize/initialized 后保持空闲再关闭时，1→2→4 同时存活实例的准备、就绪、空闲资源和关闭成本。最多4个同时存活、7个累计native实例，一个coordinator。0 thread/start、thread/resume、turn、model/catalogue、tool调用、provider、PG、Chrome、个人HOME/认证配置或 auth status 查询。模型/prompt字段如固定宿主构造仍需要，只作为未发送的fixture输入，不证明模型资格。原128 fixture是8个runRunner共享一个OS runner进程，不能称128 native agents。

## 固定来源与历史失败

只读来源为 ENG01L 固定 commit `81499e616384282a1592881b7542cc844e8eb9d5`，路径 `docs/evidence/eng01l/stock-initialize/{README.md,RESULT.md,driver.ts,run.py,inputs.json}`；本段实读前三项，不声称已核后两项输入闭包。原产品 `574a2e31b8eb583a0d44a1a3eafd739784963681`、caller `36c16c749842c726aefadfd1c22e08bc056c35a6`。不复制其run-once，不重跑已消费入口。

原N1 ready/initialized及native close成立；outer exit1 / FAIL / cleanupUNKNOWN同时保留。后来exact 113项/2,823,900B末样本超过旧1MiB，只证明当时超限，不倒填原cleanup异常原因或连续峰值。2026-10-07T08:09:55.319Z独立授权exact cleanup成功，不能把原run改PASS。nativeWriteAccess原来及本候选均UNKNOWN，未证明OS写禁止/撤销。原S01单A FAIL、inner processClosed=false/UNKNOWN_RETAIN与后active RETURN、两个KEEP分列，不访问KEEP或借新预算清理。

## 复用与唯一新增Seam

| Module | Interface / 状态所有者 | 复用、错误与释放 |
| --- | --- | --- |
| 已有 trusted tool host | prepareTrustedToolHost → createTransport；每实例独立fixture binding/workspace/runtime/CODEX_HOME | 复用原R06 ready、closed、snapshot(pid)、host close/drain；不复制adapter/授权/监督器；不发送业务请求 |
| 候选coordinator | 固定[1,2,4]级、一个绝对origin/deadline、每级全部ready后统一观察2s | 只管本次recipe，任何成员失败/UNKNOWN立即停止升级；已起成员全部走已有close，首因与cleanup次错分别留存 |
| OPS14 | 自有group、完整capture、TERM/reap与最终报告 | 原能力不扩张；exit/EOF/group/hostWrite/目录身份分别确认；业务FAIL不能被清理成功改绿 |
| 待实现数字sampler | 输入已登记coordinator/实例PID身份与有限采样时点；输出PID/PPID/PGID/start identity、同次RSS与累计CPU、coverage状态 | 唯一新窄Seam，仅属自有树；不读command、argv、env、个人进程细节；不是通用监控平台 |

R06 snapshot只有direct PID，不能据此称已覆盖Node/native/tsx-esbuild整树。personal-preview/process.mjs含命令/ambient env等服务ownership语义，不直接复用为sampler。实现前必须固定数值枚举方法、OS单位、PID重用识别及父子成员归属，证明不会采到他人树；不能可靠确认的成员/短命helper记UNKNOWN，不按0或消失=closed。未解决此项则只能保留direct PID事实，不能宣称完整资源基线或进入下一级。

## 级别、时钟与采样

各级独立私有目录，顺序N1→完整close/EOF/同identity收尾→N2→同样收尾→N4；禁止未知后换新root继续。每级prepare、每个spawn→ready、全部ready、共同2s观察、close请求→closed/EOF分开计时。prepare不是spawn，ready不是thread可用或模型运行。启动点由真实checkpoint记录，UTC只供关联；耗时/CPU区间使用同coordinator monotonic origin，不跨进程直接相减 performance.now。

候选在共同2s观察内每250ms采一次（含两端最多9次），另有限级前/后与close样本；全run最多64次数字采样、每次最多32个已归属成员、每行编码≤256B，采样原件≤524,288B，包含于下述2MiB raw/采样总额。超过成员数/行长/次数、读取权限/I/O、身份变化或数值不完整均记UNKNOWN并停止升级，不截掉成员后冒完整。具体方法/字段编码和时间精度仍待实现与纯反例确认，当前无sampler代码/验证。

每次枚举不是原子快照，必须记录sample start/end及成员读取时刻；“同次RSS和”只代表该有限采样区间，含共享页重复计数，不是独占物理内存。整树CPU仅可对同一PID+start identity的同区间累计CPU做差，给区间长度；首次出现/提前退出/漏样无双端点时该部分UNKNOWN。不同时间的maxRSS不可相加，Node memoryUsage/resourceUsage不可代整树。采样间峰值、未见短命进程和系统瞬态UNKNOWN；额外报告sampler/coordinator开销与覆盖率，不声称扣除了该开销。

## 候选预算与停止门禁（不是实际授权）

候选whole70s = 输入/预检10s + 3级×18s + 最终持久化6s。每级18s拟分ready≤10s、共同观察2s、stop/reap3s、记录/目录清理3s。所有prepare/transport timeout/close/采样/持久化必须受同一绝对origin剩余约束，不重置每级全额；若现transport默认时限不能安全服从此预算，先修合法准备或HOLD，不靠外层超时宣称已收束。到时停止新spawn/新测量，走已预算close/reap；未确认则KEEP并报告，不启动后级、不自动retry。

候选新增64MiB：四个live私有目录各8MiB=32MiB；源码/输入/index/Git准备≤8MiB；全部raw/数字采样≤2MiB；余22MiB含已完成级尚待删除的残留、records及清理余量，不另叠加。旧2.8MiB末样本只支持否定继承1MiB，不证明8MiB足够或64MiB峰值。每级正常收尾后才可复用容量；任何UNKNOWN须保留资源并停止，不能借下一实例配额。逻辑字节预算不是RSS/虚拟内存/磁盘物理峰值硬cap；RAM准入与最新完整磁盘sum必须由未来manager另核，旧KEEP和全局一次reserve不撤不重算成空闲。

启动前须固定产品/stock binary/R06/host/OPS14/loader链及实际动态依赖，明确包含Node/native/任何tsx-esbuild辅助进程和采样命令进程；消除helper需另有准确编译绑定，当前不擅称无helper。独立scope/源码和纯验证闭包、确切输出namespace不存在、有效claim、完整floor与运行窗口缺一则NOT_OPEN。无未来实际nonce/输出目录/TMP已创建。

## 验收与下一交付

先在合法scope内做实现及必要纯反例：同一deadline、N级失败不升级、PID重用/漏样UNKNOWN、2s同期CPU口径、字节溢出、取消/延迟EOF/收尾保留。随后独立源码/输入review与明确native窗口才可测量。单级通过要求全部ready、请求计数保持零业务调用、采样覆盖明确、全部closed/EOF/hostWrite settled及原子身份清理事实；未知不能改PASS。结果只能回答固定宿主/固定环境下的初始化与空闲资源基线，单次各N不是稳定统计，不能推模型吞吐、100/128真实agent容量、ACK改善、SLO或native写权限撤销。

下一实现候选最小scope：`experiments/runner-capacity/native-initialize`与`docs/evidence/s01/native-initialize`，尚未amend/领取；不得借现mixed目录或ENG scope写新recipe。当前只写原已领四metadata，不授sampler/initialize/auth查询或工程child。128 ACK完整诊断继续优先；本候选独立排期，不取代它。

## 本metadata段预算、来源与质量

实际START 2026-10-08T01:14:06Z，截止01:24:06Z。D01 canonical `docs/evidence/web-platform/resource-window-current.json` 的 `MikaS01IdleInitializeDesignMetadata=4,194,304B`，登记2026-10-08T01:12:03.554Z；本段读到future floor13,226,344,448B，fresh free14,619,779,072B，只供此次metadata，非未来native准入。fresh claim508f9c85-a27c-4382-bfe9-caca43be4b0e v3 ACTIVE/exact6于01:14:19.006Z，身份/WT/branch一致。

基数：index781,567B；三plan文件132,825B；七ancestor tree17,118B。本次4MiB包含index副本≤1MiB、四metadata总量≤192KiB、新Gitobjects≤512KiB、Git临时≤1MiB、余1,376,256B，不加第二reserve。不复制raw/ENG源码；实际增长与最终Git见唯一status。管理parser仅校字段，不算工程验证；设计已由b01_bounded_reads对固定756856900491b8b293e739090dc165f89de4f9e9只读批准，0 P1/P2；不得继承为源码或运行批准。

技能：沿本地find-skills/brainstorming的有界问题澄清，采用已授权设计方向，无安装/网络发现；codebase-design聚焦既有host/transport/OPS14与唯一数字sampler Seam；clean-code检查单一状态权威、错误命名、失败与清理分离、无第二监督器。固定clean-code来自sickn33既有baseline，文件SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`；本段复读实际本地版本，未更新。实际检查范围只有四文档、链接/预算加法/历史边界，0工程/native/auth status/PG/KEEP读取。

## 独立设计审查

b01_bounded_reads于2026-10-08T01:17:01.958Z给出DESIGN_REVIEW_APPROVED / 0 P1/P2，固定target `756856900491b8b293e739090dc165f89de4f9e9`；当时四metadata143,580B，设计9,153B/SHA256 `3dc92c10e1fb99e6d78a1c1bdf4ce99b0edde9e36464a90f8f2bf406942c0b3c`，逐Git=WT。原消息更高精度时间01:17:01.958820Z保为来源，本status时间按毫秒契约记录。审者核已有ENG81499 initialize/close语义、阶段预算、资源未知和ACK优先，0写/import/工程/native/PG/KEEP。数字枚举/单位/身份、期限适配、真实字节门禁和完整动态输入均仍实施前条件。当前仅归档该审查，不改设计方法，不授新运行。
