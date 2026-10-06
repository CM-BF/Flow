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

本段仅 source+metadata；types/direct/browser/HTTP/PG/Chrome/构建均 NOT_RUN，旧37/4不继承。验证预算与依赖待 fixed 后独立准入；不安装或扩大 sparse。模块/性能遵循[根规则](../../AGENTS.md#modular-design)。
