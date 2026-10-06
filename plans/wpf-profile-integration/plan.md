# WPF-PROFILEI01 — 聊天执行选项接线

创建/更新：2026-10-06 05:00 UTC。状态：in-progress。唯一owner：workspace_panels_owner / gpt-6-astra ultra。

目标：在已审官方Thread的新会话composer实际使用PROFILE01选择器，让用户选择整份已发布执行配置；CREATE提交即锁，原key/pin/requested在未知回执恢复中不变，下一草稿独立。保持Arc紧凑侧栏/左右面板/现主题与插件入口，不做自由模型/effort/thinking/access组合，不实现队列UI。

固定base：698ffcd94ae073b23bcc67f6665fb19f707a93e4，含PROFILE模块4f1985769564eafad9218570411d5ce1114b4ec0/metadata e7303b9aa4d666d6d694a1a60659db71431e43dc、QUEUE00读取兼容、CHAT04公共输入。范围为[正式receipt](../../docs/evidence/wpf-profile-integration/take-receipt.json)的10literal；模块本体、officialThread、CSS、shared、根依赖不修改。

App每connection私有bound执行目录reader和catalog，stable View.key保存每草稿的whole-profile选择；显式refresh加载目录，切中心dispose。新configured创建前同步验证目录loaded/nonstale且完整ref仍已加载；legacy明确无pin兼容。旧会话只显示其creation，不补后来的pin。DirectoryProfile不等于可提交Selection，必须调用configuredSelection；goal-tools/unknown禁选且合法邻项保留。

onNew校验完成后freezeConversationCreation→outbox再次schema.parse后深冻ref/requested；未知CREATE必须锁receipt-pending，不因目录陈旧阻止原请求重试；CREATE已知成功后首turn失败仍锁created。所有ACK与后续快照核完整creation身份，错pin/missing/unexpected pin在bind/首turn前保留unknown，不能静默接受或改变选项。保持已有迟到受理焦点、草稿身份和观察者生命周期。

## TODO

- [x] WPF-PROFILEI01-01 固定输入/claim/技能/唯一三件套。
- [ ] WPF-PROFILEI01-02 App与官方Thread接入已审选择器，冻结请求/原键恢复/ACK身份验证。
- [ ] WPF-PROFILEI01-03 模块直接回归与真实App HTTP fixture局部旅程、双主题390/键盘/连接隔离。
- [ ] WPF-PROFILEI01-04 固定实现、独立review、看板聚合与Lead交付；main集成另记。

验收含双runner相同model仍区分、完整分页/stale和目录消失不改选择、unknown绕目录原键恢复、CREATE成功turn失败不解锁、错pin无turn、legacy无pin、切pane草稿/焦点、center同ID隔离、goal-tools/unknown禁选、0额外模型/DB。尽早给独立fixture预览，旧49922/55049/63743/59473/D06/SVC不动。每工作段clean-code，metadata不触发全库重测。
