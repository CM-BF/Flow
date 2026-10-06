# R04 生产中心停机证据

固定实现：**dc1d02fcb7e3edbf99921275d81412768bf08424**；base **2b2fe6e02c79f1b8ccfab9409adc2c336c5d350e**。owner assignment_review / gpt-6-astra，codex/center-shutdown。Node24.20.0、pnpm9.15.4、Vitest4.0.18、Fastify5.12.5、pg-boss12.37.0；依赖按现有lock frozen安装，无manifest/lock变更，0模型/认证网络/云调用。

生产行为：默认1秒HTTP drain；先停TCP接入，关闭阶段回复Connection:close。期限后只断本HTTP残留连接；SSE和既有scheduler/pool清理继续。main最多启动一次关闭，清理卡住时20秒后异常非零退出，日志明确unknown。设计/边界见[生命周期](../../architecture/r04-center-shutdown.md)。

## 真实失败与修复

[red-main](red-main.txt)来自未修改生产源码的独立main子进程、随机专用真实PG和HTTP：留下未传完JSON body的 `/api/runner/claim` socket，数据库无活动查询，SIGTERM后3502ms仍未退出。测试才对自己child做SIGKILL清理。这是确定性的残留HTTP连接窗口，不冒称逐指令复刻CHAT02先前偶发abort时序。最初路径定位错误发生在main加载前，保留[setup-path-failure](setup-path-failure.txt)，不当行为红证据。

最小hook修复后的[green-connection](green-connection.txt)约1029ms退出。扩展实际客户端abort时，fixture最初漏发公开接口要求的{}，因此未进入DB锁等待；原[progress-checks](progress-checks.txt)失败保留，修正fixture与client一致，不弱化断言。后续[progress-eight](progress-eight.txt)发现：正常在途事务ACK返回后keepalive仍等到强断期限；新增关闭期onSend Connection:close，[green-drain](green-drain.txt)约145ms自然退出，无deadline诊断。

## 固定源码最终检查

同一固定源码分两次执行，不宣称一次9/9整suite：常规8/8（选8、1个长deadline用例未选），真实20秒保险1/1（选1、其余8未选），唯一用例共9/9；最后typecheck通过。未重跑CHAT02或全库。

| 场景 | 真实结果 |
| --- | --- |
| 未完成claim body/live socket，DB无活动query | SIGTERM 1031ms，code0；明确HTTP deadline/unknown日志 |
| 正常SIGINT及已受理任务重启 | 24ms自然退出，重启GET仍queued、同幂等键replayed=true；再SIGTERM 20ms，无force日志 |
| 长SSE+残留claim+重复SIGTERM/SIGINT | 1031ms，code0；SSE结束，只一次HTTP deadline日志 |
| 实际fetch abort的claim，已进入DB行锁等待 | 释放测试锁后清理；本次1036ms退出。socket取消未代替事务结束判断 |
| 事务超过HTTP grace后才结束，ACK丢失 | fetch无ACK；进程仍存活等DB。释放锁后1236ms完成关闭；重启原key返回replayed=true、同task queued |
| 新TCP与同连接pipeline新命令 | 新TCP拒绝；中间运行实际503，最终运行先关闭连接无ACK；重启公开GET确认新task未受理 |
| 从未listen / inject-only与重复app.close | 健康HTTP注入200，两次close成功，无强杀 |
| 在途事务在grace内完成 | 150ms自然退出，成功ACK、无deadline诊断 |
| scheduler SQL被专库表锁阻塞 | 20009ms强制进程退出code1；日志forced/unknown，不含连接串；不宣称资源优雅清理成功 |

原始最终stdout：[final-eight](final-eight.txt)、[hard-deadline](hard-deadline.txt)、[final-typecheck](final-typecheck.txt)。源码和全部失败/通过日志SHA256见[manifest](manifest.json)。

复跑（仓库root、Node24）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/shutdown/main.test.ts --no-cache --configLoader runner
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
```

测试仅创建随机 `flow_r04_<uuid>` DB和动态127.0.0.1端口；生产main真实child，不注入假server。自建DB锁仅用于受控故障，不直接修改业务事实；业务恢复断言走公开HTTP。afterAll只处理记录的child/socket和本DB，DROP没有FORCE。04:06 UTC实际核剩余R04数据库=[]、本任务main子进程无残留；4320/49922未操作。

## 限制与交接

连接断开不是事务回滚，退出码0表示中心资源关闭成功，不表示runner停止或业务结果成功。20秒是异常进程保险，未完成命令结果必须查询/同key核对；不自动重发新命令。SDK/模型、浏览器、OS/event-loop死锁不在范围。createServer库调用只处理HTTP grace，不会代替宿主强退进程；main才拥有20秒保险。

已安装Fastify源码与[官方forceCloseConnections](https://fastify.dev/docs/latest/Reference/Server/#forcecloseconnections)及[Node HTTP关闭说明](https://nodejs.org/docs/latest-v24.x/api/http.html#servercloseallconnections)核对，保持默认idle，并未改为无等待的forceCloseConnections=true。

04:06 UTC main观察HEAD 8f1481df880cf5077e1ddb9a8f302fe700a7ece8，R04尚未集成。源码/index已停写等待独审/Lead受控挂载；claim保留审查修复权，不修改其它owner状态。架构影响是HTTP→scheduler/pool生命周期，Lead在接收后更新固定dashboard架构基线。
