# TUI01F 首 Interface

`createInteractionController({ ..., taskControl?: Pick<FlowClient, 'cancel'> })` 可选端口。新 command `{type:'cancel', taskId:UUID}`，slash `/cancel <displayed-task-id>`。缺端口 => UNSUPPORTED_TASK_CONTROL，不 dispatch。

新持久 `kind:'task-cancel'` 与既有 version:1/connectionId/key 共用 journal；另保存 conversationId/turnId/taskId/input:{}。新请求必须指当前显示的已观察任务；恢复使用保存身份，不重新选择最新任务。FlowClient.cancel(taskId,key,signal) 已发布，固定 body='{}'；中心当前只有 task 范围，无 attempt CAS。回执必须匹配 taskId+有效状态，受理后从中心读取当前事实，不以旧 receipt 覆盖新状态。

只新增 task-control 意图/派发校验，宿主保留单 mutation/epoch/store 和草稿。取消不清草稿；退出只断开观察。没有隐式 queue pause、取消队列项、工具权限、provider 或任务正文读取。

当前 source-only；后续实际资源验收请复用 design-input.json 的 1 个受控 fixture 生命周期及真实 PTY/App 区别。用例准备不声称 red/green。

## 固定源码 044ab84db42606fb1757903258078e3dfbab9545

当前显示定义：conversation 为 observation 指定 turn（无 observation 时为最后一轮）；queue 为页面 currentTurn；help/list/profile 不得发新取消。Ink 始终在对应标题显示 taskId，正文/活动面板不会隐去目标身份。新入口失败前不写 journal；恢复绕过重新挑选，使用已保存 taskId。

回执允许固定中心真正返回的五种状态：cancel_requested/cancelled/succeeded/failed/uncertain；queued/running/waiting 或错误 id/缺 id 视为 unknown，保留原 intent。无 attempt CAS、无隐式 pause、无自动重试。类型和行为尚未运行验证。
