# WPF-MESSAGESETTINGS02 · 下一条消息快速设置

状态：in-progress。创建/更新：2026-10-06 22:03:41 UTC。唯一 owner：w01_owner / gpt-6-astra；co-lead：Web /root。直接父任务：[WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md) / TODO-11。

## 目标与已批准范围

在现有受控 Picker 内提供模型、思考、力度、速度筛选及紧凑摘要；只有当前授权 profile 已声明的完整组合可以暂选，明确“应用”后才提交给宿主。筛选不会改变受控草稿，不构造笛卡尔积、默认/最近组合或自动省略。工程身份放详情，requested 不冒 observed。

唯一生产路径为 ExecutionProfilePicker.tsx；同范围三 test/fixture/browser 文件及本计划/证据。catalog、selection、公共 codec、App/Thread/Recovery/queue、依赖只读。旧 ExecutionProfilePicker 保原行为。不新增 store、registry 或第二套授权。

## Interface 与所有权

宿主持有唯一 draft value 和 required opaque ownership token。每次真实同步 onChange 必须核 expected token 与当前宿主 ownership、当前 view/connection/edit authority，再用现有公共 capture 验当前 catalog/capability/full tuple，compare→validate→write 无 await。旧闭包或相同 tuple 不能代表新授权，省略同样核 ownership 和可编辑 authority。

Picker 每次打开建立独立私有存活标记；关闭、取消、详情导航、卸载、成功提交同步撤销旧 Apply/omit。token 改变使当前候选失效，必须重新打开。UI 撤销不替代宿主 CAS。暂存过滤/候选是弹窗私有数据，不是第二份草稿。

生产宿主尚无消费；fixture 用真实同型同步 CAS 验受控接口，不冒 App/Send/Queue/Recovery 联通。

## TODO

- [x] MSGQUICK-01：核准确 worktree、base、live claim，建立唯一三件套与本地技能记录。
- [x] MSGQUICK-02：快速选择、合法 tuple 投影与 ownership/opening 双层失效实现。
- [x] MSGQUICK-03：新增直接/fixture/browser 回归源码与精确只读依赖验证提案。
- [ ] MSGQUICK-04：获准后运行必要检查，固定实现/manifest、独立审查。
- [ ] MSGQUICK-05：正式主线接收并收口；TODO-11 真实宿主接线另列后继。

## 验收与限制

覆盖 same-tuple 新稿、props lag/旧 callback、换 view、权限撤销、同 token 关闭/详情/unmount/成功后重入；Apply/omit 都不得覆盖新草稿。分页漏旧选、刷新失败、能力过期保 C；A 已发送/B 已排样本不可变；空筛选可退出；大目录只展开当前授权 profile ≤32 组合；390 双主题/180 model/键盘/焦点保持。

当前源码fe6固定；首次c1因固定输入缺失失败保留，Lead供给后c2 strict+26direct实际通过并被root接收。累计5119/余24881。browser/PG/Chrome/构建未运行，旧37/4不继承；实际浏览器仍独立窗口，不安装或扩大sparse。模块/性能遵循[根规则](../../AGENTS.md#modular-design)。

## 历史 MSGQUICK-04 可移植验证准备 2026-10-06 23:18:53 UTC

在原证据范围准备专用relative配置与标准Node→TypeScript/Vitest入口，独立接收外层真实退出和cleanup回执；不新增workflow、安装器或通用supervisor。本机资源不足期间仅源码准备，不把文档启用当远程授权。候选与fe6产品分开固定；实际26direct/6browser仍未运行。

2026-10-06 23:21:55 UTC：dc67可移植验证准备已由root/peer限定静态通过，0blocking；MSGQUICK-04继续开放，types/direct/browser均NOT_RUN，本机资源/准入与remote未启用边界不变。原fe6与c1/b1未改。

## 首次 c1 实际检查 2026-10-07 02:28:12 UTC

MSGQUICK-04 保持开放：strict exit2，direct未运行，已完成自身清理并归还窗口。缺失固定source由原provision owner处理；[失败证据](../../docs/evidence/wpf-message-settings-quick-controls/c1-first-20261007/README.md)与实际outer exit/terminal/独审逐字保留，下一次不继承旧gate，累计1875/剩28125ms。

后续供给事实 2026-10-07 02:29:30 UTC：原Lead已仅物化固定HEAD缺件，2388B/hash匹配、347既有产品输入不变；[原件](../../docs/evidence/wpf-message-settings-quick-controls/c1-first-20261007/source-provision-receipt.json)。本次失败不改判，direct/browser仍未运行；后继仅可准备剩余28125ms包，不自动重试。

## 当前有限检查已接收

2026-10-07 03:14:34 UTC：c2 strict0+单文件26/26direct0，外层exit/seal/cleanup真实一致，root独审接受；[原件](../../docs/evidence/wpf-message-settings-quick-controls/c2-actual-20261007/README.md)。MSGQUICK-04仍需browser，MSGQUICK-05尚未main；没有继承旧Settings01或同段其他任务结果。
