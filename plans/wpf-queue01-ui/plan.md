# WPF-QUEUE01 — 聊天排队与暂停继续

创建：2026-10-06 05:20 UTC；更新：2026-10-06 05:40 UTC，本片已独审通过待集成，F01后继pending。唯一owner workspace_panels_owner / gpt-6-astra ultra。

目标：保持官方Thread和草稿体验，在现公共queue接口上实现显式排队、等待列表、按需完整内容、暂停、继续和独立取消。固定base14c61b4062f8040ba6c7239860929366e5bd3fc1包含已审CHAT04/client、PROFILEI01和PROFILEUX；不增加公共协议、不把展示组件当执行器。

范围严格为[take receipt](../../docs/evidence/wpf-queue01/take-receipt.json)13literal。App、旧conversation outbox、execution-profile模块、shared、根依赖不写。旧CHAT v5已移出官方Thread；PROFILEI01全部released。

深模块：queue/commands拥有冻结命令与独立receipt，queue/projection拥有等待页/当前task/paused动态读取，ConversationQueue组合官方AI Elements展示与真实公共动作；ConversationProjection只管理它的conversation/连接/可见生命周期。Same queueRevision不等于所有事实不变，read currentTurn/blocked每次照权威GET更新；ACK是受理历史，不代替当前GET。不本地promote，不自动按新revision换key重发。

显式暂停完成或重放后必须fresh GET当前paused/currentTurn，取消执行独立确认且单独task cancel receipt；旧pause ACK中的task不能作为取消目标。发送/队列命令/暂停receipt unknown与下一草稿独立，重试保持原payload/key。409仅刷新。旧capfalse零queue请求与禁用说明；无默认assistant-ui queue adapter，不把isRunning伪造false。官方Input可选onKeyDown遵IME/ShiftEnter/defaultPrevented，运行中显式queue普通Enter通过form.requestSubmit与按钮同路；官方Send/Root默认也禁止running，因此只对显式queue增加可选submit入口走公开composer.send({startRun:false})，不触发client-tool abort；steer快捷键明确不支持。

## TODO

- [x] WPF-QUEUE01-01 核固定输入/activeclaim、本地技能、唯一计划与来源。
- [x] WPF-QUEUE01-02 queue命令/分页投影与公开接口局部行为检查。
- [x] WPF-QUEUE01-03 官方Thread输入接缝与AI Elements队列展示/控制，HTTP fixture实际App双主题/390/键盘。
- [x] WPF-QUEUE01-04 固定目标、独立review、聚合与Lead交付，main事实另记。
- [ ] WPF-QUEUE01-F01 后继另领：无凭据稳定连接namespace与有界receipt journal，原key跨reload/换连接恢复和storage failure准入策略。本片只保留同页面receipt，不因警告文案视为完成。

验收：false/true、按钮/Enter/IME/ShiftEnter/steer一致；未知命令重试原key与新draft；staleACK不回退、同revision动态更新、分页去重/refresh、detail0→1→cache；pause旧receipt→GET最新task→显式cancel两receipt；offline/timeout/隐藏observer与command分离、跨center迟到隔离；主题/390/焦点。0模型/真实DB，旧服务全部保留，独立动态端口。clean-code每段/交付，metadata不重跑全库。

候选309ec0e37bc92cc0f91d8f3bfd8f9e9f6519432c已通过作者51局部/11开发+11生产HTTPfixture检查，见[验证](../../docs/evidence/wpf-queue01/validation.md)。各报告保留当时文档HEAD+dirty，通过源hash绑定固定target；不将作者检查等同独立批准。

2026-10-06 05:40:36 UTC：root固定309ec0e限定APPROVED，独立51 direct及实际CUA局部行为，完整[review](review.md)。本片作者交付与审查完成，main集成待Lead；F01仍pending，不因本片通过勾选后继。
