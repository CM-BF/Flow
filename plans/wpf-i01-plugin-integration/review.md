# WPF-I01 独立审查入口

**状态：NOT_STARTED**

Review target commit：UNKNOWN。

Base：`c526c1c889437ee39155d669921577995195c74e`（已审 M02 实现加 metadata）；P01 修复 target `6ce3ba0a41d51f26cd6fbceddfbb2f80e4931bd6` 仍待整体批准。当前只有文档，无 I01 实现提交。

## 范围与验收

审查主 App 对可信 Web host 的真实挂载；精确实现 scope 见 [status](status.md)，方案与验收见 [plan](plan.md)。重点：bridge 不泄露 client/token；局部 task/message/reference 身份；同 ID 不同中心的旧闭包隔离；真正消息 ActionBar；主题 token/fallback；禁用贡献/监听/面板焦点；A→B→A/贡献切换布局保留；懒读与 8 chat/双 split 观察预算。X01 全栈、第三方隔离、PTY/任意 fs 不在此结论范围。

## 检查、发现与限制

已执行：仅 Git/正式领取/文档与固定 M02 源码接缝核对，见 [assignment](../../docs/evidence/wpf-i01/assignment.md)、[seams](../../docs/evidence/wpf-i01/seams.md)、[quality](../../docs/evidence/wpf-i01/quality.md)。未执行：I01 类型/行为/浏览器/真实中心检查、独立 review。尚无 I01 findings 不代表通过；依赖 P01 PH-R4 为上游待修问题。

## 可复制只读审查任务

先核实际 worktree、branch、live claim version/state、base、完整 target 与 dirty。只读固定 target，核 P01 和 M02 输入已各自批准，不能用 dirty 代码代替提交。审阅上述行为并针对变化运行直接消费者检查，区分 HTTP fixture 与真实中心、作者与独立证据。每个 finding 给 severity、trigger、文件位置、blocking 与复验条件；修改交唯一 owner。最终结论绑定完整 SHA，metadata 新 HEAD 不自动扩大行为 approval；原 Lead 负责 main 集成。

作者回应/修复提交/复审：尚无 I01 实现审查。

追加验收：同 host 的缓存保留与换 host/connection epoch 的清理分别验证。新中心复用 task/reference ID 时，active/hidden visited views 的 tabs/tree/cache 必须重新初始化；旧 bound commands、迟到 activation/command 不得作用新连接，plugin context 不包含 token/client 或未经授权源数据。P01 PH-R4 fixture 复验不替代此 I01 真实挂载检查。
