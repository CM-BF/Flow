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

当前源码fe6固定；首次c1因固定输入缺失失败保留，Lead供给后c2 strict+26direct实际通过并被root接收。strict/direct累计5119/余24881。b1首组失败、b2因监督计量中断、b3再次原生选框值失败且诊断已捕获，均无完成组/PNG；browser按外层保守累计30625/余29375，实际进程资源均已归还。PG/构建未运行，旧37/4不继承；未自动重试、不安装或扩大sparse。模块/性能遵循[根规则](../../AGENTS.md#modular-design)。

## 历史 MSGQUICK-04 可移植验证准备 2026-10-06 23:18:53 UTC

在原证据范围准备专用relative配置与标准Node→TypeScript/Vitest入口，独立接收外层真实退出和cleanup回执；不新增workflow、安装器或通用supervisor。本机资源不足期间仅源码准备，不把文档启用当远程授权。候选与fe6产品分开固定；实际26direct/6browser仍未运行。

2026-10-06 23:21:55 UTC：dc67可移植验证准备已由root/peer限定静态通过，0blocking；MSGQUICK-04继续开放，types/direct/browser均NOT_RUN，本机资源/准入与remote未启用边界不变。原fe6与c1/b1未改。

## 首次 c1 实际检查 2026-10-07 02:28:12 UTC

MSGQUICK-04 保持开放：strict exit2，direct未运行，已完成自身清理并归还窗口。缺失固定source由原provision owner处理；[失败证据](../../docs/evidence/wpf-message-settings-quick-controls/c1-first-20261007/README.md)与实际outer exit/terminal/独审逐字保留，下一次不继承旧gate，累计1875/剩28125ms。

后续供给事实 2026-10-07 02:29:30 UTC：原Lead已仅物化固定HEAD缺件，2388B/hash匹配、347既有产品输入不变；[原件](../../docs/evidence/wpf-message-settings-quick-controls/c1-first-20261007/source-provision-receipt.json)。本次失败不改判，direct/browser仍未运行；后继仅可准备剩余28125ms包，不自动重试。

## 当前有限检查已接收

2026-10-07 03:14:34 UTC：c2 strict0+单文件26/26direct0，外层exit/seal/cleanup真实一致，root独审接受；[原件](../../docs/evidence/wpf-message-settings-quick-controls/c2-actual-20261007/README.md)。MSGQUICK-04仍需browser，MSGQUICK-05尚未main；没有继承旧Settings01或同段其他任务结果。

## 首次实际浏览器失败与清理

2026-10-07 04:26:38 UTC：唯一b1执行outerexit1，模型select键盘值断言失败；0/6完成组、0/2PNG，无页面异常记录。[原件与界限](../../docs/evidence/wpf-message-settings-quick-controls/b1-first-browser-20261007/README.md)。fixture/context、两个child groups/parent/scratch均清理；外层保守耗时12326、余47674，原parent/terminal早计数保留。MSGQUICK-04保持开放，源码fe6不变，不把actual FAILED写成未运行或改判通过。当前只metadata封存，下一步待独立归因/合法后继，不自动续跑。

## b2实际中断与监督计量后继

2026-10-07 04:48:10 UTC：[b2独审原件](../../docs/evidence/wpf-message-settings-quick-controls/b2-browser-20261007/README.md)接受FAILED与owned清理，正常HTTP/context close字段缺失。MSGQUICK-04继续开放；父非原子scratch差分计量已源码确认，后继仅TMP准备exact-subtree排除，不提升原8MiB或修改产品/六场景/两PNG。累计18468/余41532，无自动第三次。

## 计量修正小检查 2026-10-07 05:10:24 UTC

MSGQUICK-04继续开放：[b3实际helper五项检查](../../docs/evidence/wpf-message-settings-quick-controls/b3-accounting-20261007/README.md)单次exit0/47.222083ms，own临时目录清理。root已审最小计量源码，真实browser仍待后继精确准入；不重跑strict26、不追加浏览器预算，不把helper通过作六组/两PNG通过。

## b3实际浏览器后续 2026-10-07 05:26:24 UTC

MSGQUICK-04仍开放：[第三次实际失败及完整诊断](../../docs/evidence/wpf-message-settings-quick-controls/b3-browser-20261007/README.md)，actualexit1/0组/0PNG。仅保真实证据、正常关闭/owned清理和30625/29375保守账；不改原断言或重试，根因待只读核实。

## MSGQUICK-04 新有限定位段 2026-10-07 05:47:03 UTC

[明确新授权及诊断接口](../../docs/evidence/wpf-message-settings-quick-controls/native-control-segment-20261007/README.md)。旧三轮60s封套原样闭合；新增≤90s实际、每次≤45s含15s清理，原retained8MiB与scratch64MiB不变。先独审最小诊断delta，保持原六组与产品不动；按plain B实际native选值决定是否进入modal B。当前只source准备，未运行。后续同边界定位→修复→相关验证可在段内连续进行，未知cleanup/授权范围变化停止针对审查；不新增泛化runner或任务。

## Native-control首轮与同段窄修 2026-10-07 06:16:41 UTC

[完整原件与root独审](../../docs/evidence/wpf-message-settings-quick-controls/native-control-first-20261007/README.md)：outer实际exit1，FAILED/INCONCLUSIVE；plain A按键前中文role定位计数0，0/6组/0PNG，B/modal未执行。全部EOF/0drop，fixture/context关闭，parent56904/worker57021/Chrome56911与scratch absent。root只接收失败与清理，不作产品批准。

parent11178/late11182/outer11221.448166994378ms原样；保守本次11222，新段余78778；旧30625/未用29375封闭不追加credit。初始响应缺charset是源码候选原因，不冒原生键盘根因已证。后继诊断源 `521a38395c4b9a38613937c83ce44215afc70280` 仅HTTP UTF-8/预键公开label/count/首异常保留，原六组与三源不变；[新源与准备](../../docs/evidence/wpf-message-settings-quick-controls/native-control-followup-preparation/README.md)。当前第二次未运行，SVC08窗口归还后才fresh准入；任务完成仍NOT_COMPLETED。
