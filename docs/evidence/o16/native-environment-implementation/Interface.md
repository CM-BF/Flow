# O16-06 私有环境与唯一 planner 入口

本片沿 FLOW-001 / O16、原55c4 v1三个范围，普通adapter及f5a产品不变。GO本轮已明确同账户同scope的正常native认证与必要默认钥匙串刷新，首段仅1 planner query、`claude-sonnet-5-5`、4 turns、SDK申明0.20USD、90秒。此处是实现和注入检查；真实source/env/goal/profile与一次材料仍由Lead固定后排期，尚未运行SDK进程/query/PG。旧O08/O10、旧O16失败/KEEP不复用。

| Module / 接口 | 输入、责任与不变量 | 生命周期 / 失败 |
| --- | --- | --- |
| native-environment / 默认policy | 固定SDK0.3.290 package/library和native2.1.290精确文件；绑定source、真实工作树、phase/native/home/config/tmp的uid/mode/dev/ino，最后query覆写显式env和binary | regular NOFOLLOW fd流式hash、前后stat/named identity；准备前不存在才mkdir。任何变化拒绝；本Module不spawn/auth/query/删除 |
| permit / v2 | sourceDigest、environmentDigest、worktree、精确model和phase limits必须匹配受信operator的新材料；只有已验证对象可消费 | 原同approval/phase/task/slot独占耐久reservation；JSON不是身份或GO授权证明，不接受authenticated布尔。v1仅历史纯合同，不能开native；本片native只plan，children拒绝 |
| operator / driver | 原150秒监督/phase namespace，先材料核对再分配；driver的SDK JS import使用自有HOME/config/tmp，不继承debug/credential环境 | 控制目录全部计入原2MiB原始/证据合计，worker运行目录计入原8MiB；原watchdog/资源/STOP不复制，unknown不重投 |
| phase-host / worker | 私有目录及runtime再次核对，实际worker先验证再import SDK/原adapter；runner令牌只在私有config和host中，SDK env不含它 | 原runner唯一loop和IPC不变；不是新executor。worker启动/报表/停止仍原事实，直属close不冒全部逃逸进程退出 |
| query-run | 原唯一iterator、hooks、abort与close，最后一刻核实际私有环境、cwd、不可恢复选项、consumeSlot | persistSession:false；拒resume/continue/store/fork；取消后不进query，已消费槽保留。实际adapter直测发现首错被取消竞态改成AbortError，改abort(error)及安全firstFailure保原原因 |

环境完整名单由recipe/源码唯一维护：HOME、CLAUDE_CONFIG_DIR、TMPDIR、CLAUDE_TMPDIR均自有；`CLAUDE_SECURESTORAGE_CONFIG_DIR=''`使用已安装原生代码的默认service namespace，USER为当前OS公开用户名。PATH固定系统目录；关闭自动更新/非必要遥测；不传API key/auth token/base URL、代理、cert、debug或个人config。未读、复制、导出任何凭据；不调用login/setup/token/logout，不更换账户。私有HOME若无法取得该既有认证，真实入口只失败并保留unknown，不回退另一个账户、API计费、环境或第二query。

**共享钥匙串可能被SDK正常刷新；不计入自有8MiB，不能声称总系统零写。** `persistSession:false`不是全局禁写。SDK/native其它已知配置、cache/debug/temp受上述路径和测量约束；本实验不是OS写沙箱，无法承诺任何任意managed组件/逃逸写入已被原子覆盖。原[公开来源与固定字节](../native-stages/native-environment-inputs.json)和一次CLI状态仅为准备输入，不冒SDK实际认证成功/模型资格/无fallback保证。普通adapter全保持原样。

planner复用现有graph MCP mount、既有host PreToolUse及中心授权：scope为1proposal、0application、2nodes、1edge、完整inputProposal协议。工具仍公开graph_read/graph_command，中心拒绝apply；不另造仅同名假工具。实际adapter→query装饰器直接例验证该组合可进入注入边界，不要求旧apply>0。仍需真实plan产出经中心audit证实1次propose/0apply，保原proposal/inputs/profile/source/usage，0child。成功关闭已登记workers/center/pools并核连接后才发15分钟pause；过期只拒绝/保留，不自动清理。真实proposal之后的确认/children需要新的独立预算与源码输入，本片不继承旧children候选上限。

## 局部事实与限制

[validation.json](validation.json)保留5轮：实际12(10绿2红)、3绿、1红、3绿、1绿；15不同=12新+3受影响旧。Node第二至五轮各多报两个空匹配文件为pass，均不计测试。两fixture红是缺既有host hook；第三轮真实adapter首错传播红按上述最小修复后通过。既有16/26不重跑，0PG/auth/SDK进程/provider/浏览器。只import既有SDK JavaScript以构造真实MCP/adapter，不调用SDK query。

5个OPS14 group最终absent/双EOF/无signals，pre-reap unknown历史不改；5个exact scratch在checkpoint后removed。child累计8730ms，原stdout/stderr7207B；fixture在检查结束后已由用例清空，测得0B不是过程峰值。总段180s/16MiBtmp/2MiBraw。原5run raw与运行前source hashes保留，差异源码[variants](source-variants.json)明确重建后逐hash对原reservation，不伪装当时已存副本。

应用本地find-skills/codebase-design/clean-code/brainstorming既有方法：环境唯一Module、运行状态仍原owner、权限与观察分开、首错和cleanup不互相覆盖；无新依赖/认证代理/调度器。2026-10-07本段安全点复查命名、失败和重复，测试专注实际影响；没有给普通adapter增加任何特例。

封包静态修正：metadata driver的私有TMPDIR在原始证据树内；native planner通过原privateCenter的显式temporaryParent `/private/tmp`分配另外的随机runtime，避免私有8MiB被证据2MiB重复计量或深度界提前拒绝。仅分配函数抽出为直接可测接缝，DB/归属/正常清理不改；新增实际0PG小目录例验证dev/ino/0700及与driver TMP分离，再正常移除。rehearsal仍原tmpdir默认。
