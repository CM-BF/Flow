# Workspace lifecycle baseline Interface

唯一新增Module是实验fixture与浏览器runner。fixture复用startContextPreview返回的真实App HTTP服务、现chats/tasks/details集合和失ACK控制；只新增受限合成conversation及观测器，不改变产品行为。浏览器只能走公开UI及HTTP记录，禁止访问React私有fiber/store。

每档8/16/32累计打开；可见pane≤2。采样document与每tabpanel DOM数量、hidden状态、active SSE、按路径/会话的GET起止和挂起计数。切换时允许旧请求完成，但隐藏/关闭不应产生新任务读取。会话目录/workspace背景读单列，不混per-pane读。观察窗口2.2秒跨过现2秒调度，首次reply/knowledge正文0；细节只显式点击。

closed-clean与closed-protected是样本分类，不是已实现回收状态。后者覆盖未发新稿、未送knowledge、Send未知和Queue未知原key/body。关闭/重开后经实际UI核恢复，不自动cancel。DOM变少不证明对象/heap减少；CDP heap/projection私有cache/未可靠测的交互延迟均unknown。

实验预算自启动fixture之前到cleanup完成≤90秒，80秒截止交互/采样，预留10秒cleanup。≤8MiB全部原始报告；少量稳定viewport截图，无trace/video/heap快照。未完成三档或保护场景写partial/准确原因，不自动延长。finally关闭自己的browser、Vite与动态HTTP，既有服务不动。

## 固定结果与下一最小回收建议（只读设计，未实现）

c450 App.closeNow 对 conversation 仅 setVisible(false)，保留 views/drafts；真正连接dispose会清outbox。报告观察到关闭pane卸载但late detail完成后重开仍可用，不能把DOM移除当JS回收。下一候选应先把“渲染/观察租约”与“受保护会话状态”分清，复用现宿主唯一Map与projection，不造第二registry：

| 边界 | 现owner/事实 | 最小后继方向 |
| --- | --- | --- |
| pane render | App groups/tabs映射；hidden仍挂DOM | 按可见/最近使用挂载有界UI，snapshot/draft保留在现owner；焦点/两pane仍由App |
| observation | projection.setVisible与task observers已有暂停 | 保留暂停不等cancel；detach不dispose未决command |
| protected payload | 当前draft/knowledge/Send/Queue原key正文由现Map/outbox持有 | eligibility显式只读检查；unknown/sending或未发送材料不得静默淘汰；满额须告知并保稿 |
| unprotected cache | details/history留projection，晚detail可在closed时完成 | 独立可丢cache/flight生命周期，关后迟到不再写已淘汰cache；重开可按需读，不重新生成命令key |
| overview摘要 | 现workspace供sidebar，start未接pageVisible | 分离摘要需求/可视feed与命令生命周期，避免stop清pending；page-hidden实测另片 |

不是批准的新API或生产优化；literal后继范围须重新fresh take。优先有证据的App视图挂载与projection详情cache边界，保留既有Task/Queue/Stream/P01权威。不猜新的默认heap上限；先定义可观测计数与保护理由，再小片验收。累计访问并关闭32、late history页、native page-hidden仍未测，不因当前32打开样本推论。
