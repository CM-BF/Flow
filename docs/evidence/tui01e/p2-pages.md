# TUI01E P2：翻页与在途轮询

修复target `22f0e2c2b702112aa1a5d1b36874b56165cd267e`，基于原实现 `d4478653918144377696ce83ace128fcf4213961`；原manifest/README/raw保持历史不变，以本增量和唯一status表达当前修复状态。独立复审待进行，作者未自签批准。

Execution Lead发现：同connection epoch中旧after=0轮询已在途，显式next(after=20)先完成后，旧页仍可覆盖新页，令queueAfter/nextCursor错位。state.busy只能阻新轮询，挡不住已开始的读取。

公开controller用例先真实3红：旧页成功回包替换新页、旧页失败使新页断开、旧轮询等待conversation metadata时在翻页期间又启动旧页读取。红 stdout 保留 `p2-pages-red.txt`（3failed、9未选）。无私有函数测试，无PG/provider。

修复只给本地页选择一个递增版本，不新增FSM/调度器。显式queue选择在开始读取前推进版本；poll在conversation metadata读取之前捕获版本。queue读取提交结果和传播失败前同时核connection epoch与页选择版本；过时响应/错误均忽略。较早poll还未发queue请求时已经换页则不发旧页请求。只有成功的新页改变queueAfter；真实当前读取失败照旧报告，不吞新错误。中心queueRevision、命令body/key、ACK、journal、任务权威与UI逻辑未改。

验证仅新queue模块12/12（9原+3新增，446ms）及root noEmit exit0；`p2-types.txt`成功stdout为空，相邻exit JSON来自同shell进程返回码，exec session40727完成exit0。原PG/PTY/旧28直接消费者未重跑。相较原41仅新增3项，即历史分轮44个不同检查，不说一次44/44。原DB/PTY清理事实沿原raw，当前3例仅公共port与受控fake timer，dispose恢复时钟。

增量manifest绑定2修改源、9保留源、原manifest及6新原始输出；原21inputs+25raw+3derived+claim hash重新核对无变化。保留浏览器/provider未验及其他原边界。
