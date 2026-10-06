# Workspace lifecycle baseline Interface

唯一新增Module是实验fixture与浏览器runner。fixture复用startContextPreview返回的真实App HTTP服务、现chats/tasks/details集合和失ACK控制；只新增受限合成conversation及观测器，不改变产品行为。浏览器只能走公开UI及HTTP记录，禁止访问React私有fiber/store。

每档8/16/32累计打开；可见pane≤2。采样document与每tabpanel DOM数量、hidden状态、active SSE、按路径/会话的GET起止和挂起计数。切换时允许旧请求完成，但隐藏/关闭不应产生新任务读取。会话目录/workspace背景读单列，不混per-pane读。观察窗口2.2秒跨过现2秒调度，首次reply/knowledge正文0；细节只显式点击。

closed-clean与closed-protected是样本分类，不是已实现回收状态。后者覆盖未发新稿、未送knowledge、Send未知和Queue未知原key/body。关闭/重开后经实际UI核恢复，不自动cancel。DOM变少不证明对象/heap减少；CDP heap/projection私有cache/未可靠测的交互延迟均unknown。

实验预算自启动fixture之前到cleanup完成≤90秒，80秒截止交互/采样，预留10秒cleanup。≤8MiB全部原始报告；少量稳定viewport截图，无trace/video/heap快照。未完成三档或保护场景写partial/准确原因，不自动延长。finally关闭自己的browser、Vite与动态HTTP，既有服务不动。
