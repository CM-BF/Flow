# R04 中心有界停止

2026-10-06，R04独立候选分支已局部验证，尚未合入main。已有HTTP/资源生命周期的有界修复，不新增依赖或调度系统。

`createServer({ shutdownGraceMs? })` 增加唯一可选参数：安全整数1..10000毫秒，默认1000；生产main固定使用默认值，无新环境变量/API。Fastify仍保留默认idle策略。

1. `app.close()`先由Fastify标记closing并关闭route admission。最先注册的preClose立即调用本Node server.close停止新TCP，再安排HTTP drain deadline；其它原有preClose继续关闭SSE并等其查询。
2. 已在执行的回复在onSend加Connection:close，让完成请求自然退出keepalive；关闭阶段新HTTP由Fastify拒绝503，若连接先关闭则客户端无ACK。本任务实际两种顺序都观察到，新任务均未受理。
3. 到HTTP期限仍有连接，调用本server.closeAllConnections并输出固定脱敏unknown诊断。Node close事件清理timer；没有残留时不等整个期限。Fastify后续自己的server.close重复调用兼容；未listen/inject-only关闭亦验证。
4. 原onClose按既有逻辑停sweep、pg-boss和pool。已checkout的数据库事务不因socket关闭被取消，pool.end等待其归还；本次持锁后释放实验显示提交可以发生在ACK丢失之后，重启按原幂等键读回同一任务。
5. 生产main收到SIGTERM/SIGINT只启动一次close。20秒最终timer用于cleanup挂起的异常停止：非零退出并明确forced/unknown，不称graceful。cleanup失败记录非零状态且保留最终timer，以免剩余资源继续挂起；只有成功close才清timer/移除信号handlers。

限界：库调用app.close只限制HTTP drain，不为调用者强退进程；20秒最终保险仅生产main。timer需要Node事件循环可运行；没有证明CPU死锁/OS故障可由JS解决。关闭中心不代表runner停止，失联与attempt状态仍由原租约/恢复机制决定；不得凭连接断开判断业务成功/失败。直接断连接、丢ACK、异常进程退出都必须查询权威状态或用同幂等键核对，不盲目重发新命令。

验收seams是公开main进程+真实HTTP+独立真实PG，以及createServer inject-only。故障注入只在测试自建随机数据库持锁；不修改业务记录。9项检查分两次固定源码运行（8个常规、1个真实20秒deadline），0模型；具体证据见[报告](../evidence/r04/report.md)。

官方依据与固定运行时：Fastify5.12.5源码fastify.js 384–428显示preClose先于内部server.close/onClose；[forceCloseConnections说明](https://fastify.dev/docs/latest/Reference/Server/#forcecloseconnections)解释idle默认与true不检查请求完成。Node24.20.0实际运行；[Node24 closeAllConnections](https://nodejs.org/docs/latest-v24.x/api/http.html#servercloseallconnections)定义强制关闭HTTP连接，并建议在停止接入后调用。[Fastify hooks](https://fastify.dev/docs/latest/Reference/Hooks/#preclose)用于接入既有生命周期。不是增加第三方broker或全局socket管理。
