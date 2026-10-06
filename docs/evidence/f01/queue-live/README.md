# 真实 Web 排队与同会话回复验收

2026-10-06 06:02:19–06:02:28 UTC。结果：**通过当前限定场景，2/2 SDK query预算封存**。Goal Owner已独立读取完整事实并实际查看浅色/390深色截图，接受功能结论；没有第三次调用或补跑。

产品Web固定 `3d4985fca060155435b159e0467815bf8e88b8b8`，专用Vite `127.0.0.1:50644`（测试结束已关闭）；原中心61227/runner实际加载 `fb906cb42391971a8b315dbd813f7633927d7265`。前后端分开且合同兼容，不为同SHA重启用户服务。执行caller固定 `0695bae99a20acd639b02826bf092c64040a21a1`，共用browser动作与0模型预演相同；其guard/秘密保护经assignment_review独立只读批准。

| 验收 | 保存的事实 |
| --- | --- |
| 真正运行中入队 | 06:02:20.965 Web Pause ACK；21.078 enqueue ACK，紧接只读first task仍running；队列paused+waiting |
| 明确恢复 | 第一轮succeeded且完整SDK usage已知后，06:02:24.005 Web Continue；晋升原queue item |
| 浏览器关闭独立性 | 专属Chrome PID73735于25.010 exit0；25.017真实GET第二task仍running；PG completed_at27.178。成立的是退出后继续执行，不只是重读终态 |
| 真实两轮记忆与可见正文 | 第二输入没有nonce；新专属Chrome84583聚焦可见pane的第二assistant完整文本精确等于nonce，浅色及390深色都通过并目视 |
| 持久关联 | 一个conversation、相同native session、不同turn/task/attempt；实际IDs见checks.json和turn-1/2.json |
| 资源收尾 | 两专属Chrome exit0、测试Vite关闭；原中心/runner/web保留，最终2tasks、0未完attempt、1runner；原DB和本会话保留 |

使用固定Claude SDK0.3.290、请求/实际主模型claude-sonnet-5-5，每query配置2turns/$0.20/60s；SDK query=2，底层provider请求数unknown。第一结果保守SDK成本$0.004059，第二$0.008337，合计**$0.012396**。保存的是adapter归一化modelUsage，不是原始provider wire/实际账单；第二resume baseline unknown，累加是保守上界，不冒充增量，内部Haiku用量已计入。实际查询与UI过程在首query起7.924秒完成；120秒是准入/结果观察窗口，不能将该driver称OS硬限终止器。

实际effective tools=[]、thinking=unknown，requested thinking=disabled。两轮session init仍报告3plugins与3skills；不能称零扩展、干净上下文或公平harness比较。此会话用legacy runner-default请求，实际独占runner配置固定；这次不重复证明profile-picker pin。用户资料/仓库文件未送模型、无工程文件/终端工具写。

这次真实场景使用**持久pause后显式Continue**，不将其当自动promotion的真实模型验证；自动promotion另有0模型PG证据。只验证一个简短记忆/队列场景，不关闭完整U11、steering、partial streaming、知识选择、文件、语音、复杂多任务解释或工程交付验收。早期chat-live第二轮UI NOT_PROVEN原记录保留；这份是独立新预算的新证据，不改写旧事实。

原始入口：[checks](checks.json)、[first](turn-1.json)、[second](turn-2.json)、[stdout](stdout.txt)、[保留服务](retained-services.json)、[浅色图](second-reply-light.png)、[390深色图](second-reply-dark-narrow.png)。credential扫描无匹配；password填入失败日志由caller统一脱敏。
