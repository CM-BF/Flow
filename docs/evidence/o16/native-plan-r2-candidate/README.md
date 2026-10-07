# O16 新首段候选：私有声明策略修复后

**新 GO 预算已授，仅候选/一次材料固定；实际运行窗口仍待 Lead。** 旧 `native-plan-20261007-1018` 已实际进入一次 SDK，初始化拒绝、采样首因 UNKNOWN、没有 usage/result 因而费用 UNKNOWN；原 raw/FAIL/KEEP 均保持，不用这份候选续投或清理旧资源。

固定行为源 `ff266d1ddc3adf3f89012095b4ff446367c3fb7e`；[独审原件](../native-observation-repair/independent-review.json)限定批准零模型差量及7个新不同直接例，不是原生规划通过。新 sourceDigest `f963b8439686449a96446b8c4454301d88d029183a95ac839eb570fb60d74d3b`，原 environmentDigest `4111341d2a26aac0b95c72deb2c571415b0d893ffad23d81d0fbaaaf8e518659`。只读 sourceIdentity 核322文件/39alias；SDK0.3.290/native2.1.290沿原3固定文件，[字节绑定](runtime-binding.json)重新只读比对通过，没有执行SDK、native版本命令、认证或provider。289产品输入仍f5a，当前main不是另一未绑定的产品来源。

[具体候选](candidate.json)给唯一既有 operator --plan 入口；proposed run `native-plan-20261007-r2` / approvalId `O16-GO-PLANNER-R2-20261007` 的运行、operator及once路径在本次只读核对时不存在。未创建运行/operator目录或once reservation。GO已新授 `O16-GO-PLANNER-R2-20261007`；唯一permit位于 `../native-plan-20261007-r2/permit.json`，有效至 `2026-10-07T11:11:31.796604Z`，实际启动仍待Lead另给holder事实/startBefore与fresh准入。若到期未起仅记录NOT_RUN并协调，不自动改期/重试。candidate.json不是v2 permit，不从candidate自授权。

候选只有1 planner：`claude-sonnet-5-5` / 最多4 turn / SDK声明 $0.20 / query90s；1 proposal、0 apply、最多2 nodes/1 edge、0 child。纸鸢goal/constraints/acceptance/material、公开profile参数见[fixed-inputs](fixed-inputs.json)，来自当前固定config；原 graph_read/graph_command 两工具、dontAsk、MCP sdk来源、permission/运行版/模型/重复/冲突检查不变。私有recipe严格2 plugin/2 skill；旧O10历史3/3不作为全环境权限。未来声明仍可能不匹配，不能因为名单修改称实际问题已全部解决。

总资源不扩：120s work+30s cleanup / 独立150s；stdout/stderr/阶段记录合计2MiB，真实随机private runtime8MiB，live1GiB。候选fresh保守最小1,405,091,840B，包含原1GiB+128MiB、两其它local各30MiB与PG128MiB；实际开启时还须按当时其它holder真实合计，不能套用旧空闲/旧磁盘快照。PG本片12连接（8business+3boss+1admin）另留16管理余量，待许可后单次fresh核max/reserved/current；本准备未查询实验PG容量或目标库，只有协调账本只读核claim。driver-private HOME/config/tmp按阶段证据2MiB口径，和随机runtime分开；PG/WAL单列。复用现OPS14/watchdog/计量，不新增监督器。

SDK使用现有同账户同scope正常native认证，默认Keychain必要刷新可能更新共享认证；此副作用单列，不包含private8MiB，不能承诺总系统零写。不读/复制/导出凭据，不login/setup/newtoken、不切API key或账户。私有HOME/config/tmp、persistSession:false和禁止resume/store保持；认证来源缺失/不成立即fail closed，不换环境探测。历史CLI公开status只能说明当时CLI登录状态，不证明当前SDK路由或实际模型资格。

新诊断可区分：SDK入口计数是否实际留下；private声明的固定policy与规范化init；测量的stage、受控code和触发约束；durable resources是否缺失/错源/目录身份不符；最早失败与独立cleanup/checkpoint unknown。缺worker或资源仍unknown，不造0。计量不是原子快照，deadline只证明该观察未按时完成，不一定给出底层系统根因；这些字段不会修复或反证上一轮未保存的测量首因。

成功须保完整proposal/inputs/profile/source/audit/usage及1次SDK事实；所有已登记自有进程/server/pools/目标连接结束后，才创建以实际关闭时刻起算的15min pause。暂停期不保本片活进程等待；到期拒继续并保留，不自动删。SDKclose/组absent不是所有逃逸writer撤销证明。失败保存主因和cleanup、unknown KEEP，不自动再试。owner取得真实proposal后才讨论确认与children的新预算；独立接受、恢复compaction和完整native语义仍开放。

旧实际SDK入口1次；若本次实际进入SDK累计才为2，旧费用仍UNKNOWN，不折0，不获第三次许可。本段只归档批准与固定候选/未消费permit；7例/旧15/16/26不重跑，旧库/tmp不访问。输入引用原immutable manifest和Git ref，不再复制全部源或历史raw。
