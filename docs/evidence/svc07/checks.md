# SVC07 首片检查

源码目标：`e28c4ed0a30ec2800eeca2ca5c444c0081c38165`。Node 24.20.0、pnpm 9.15.4、Vitest 4.0.18、TypeScript 5.9.3；既有依赖固定入口见 [供给回执](dependency-links.json)。

| 检查 | 实际选择 / 结果 | 时间与证据 |
| --- | --- | --- |
| 原实现首红 | 1文件 / 15例；11失败、4通过，exit1 | 20:06:49.749761–20:06:50.176188 UTC；外层monotonic0.425885s；[raw](red.log) / [回执](red.json) |
| 最小修复后fake | 同1文件 / 15例全部通过，exit0 | 20:07:39.032500–20:07:39.489946 UTC；外层monotonic0.456988s；[raw](green.log) / [回执](green.json) |
| 局部types | 明确include数据库模块与该test，exit0，无输出 | 20:07:39.491017–20:07:40.098520 UTC；外层monotonic0.607362s；[raw](types.log) / [回执](types.json) |

绿色fake及types记录同一源码SHA256 `277ab00876c0b904168b4d3f1b2dc2b3221761bb27cb0a8b5e2618e7aa0f5653`，同一test SHA256 `637a66bb880013be2aec0b7056974846f5b81fa10c93fd9d2d541dc32cda36df`；首次反例未为通过而改变。Vitest自身133ms与外部wall口径不同。0跳过、0重试业务、0PG/Chrome/native/provider。

采用已有根Vitest配置，局部wrapper仅指定本scope cache与单worker；`--configLoader runner`不写根配置bundle，`--no-cache`禁用结果cache。Node自行创建了owned TMPDIR编译cache 1,357,788B，父进程退出后核路径身份并移除，见 [cleanup](cleanup.json)。未将release动作称为真实socket关闭；未独立证明测试进程树每个后代已消失。实际fake不建网络/数据库/持久业务fixture。

## 已覆盖与未验证

覆盖健康结果/只读BEGIN、获取失败、checkout callback后立即fatal、pending回调期间重复fatal后等回调收束、active-query失败、下一独立连接成功、COMMIT拒绝加ROLLBACK成功/失败仍保未知、ACK已成功同turnerror、HttpError及null/undefined原值、清理异常、BEGIN拒绝、release同步交接下一borrower。

首片通过受控EventEmitter/Pool fake验证公开transaction Interface，不证明真实PostgreSQL断连或HTTP存活。业务重试/持久恢复仍由原业务Interface拥有。真实直接消费者窗口候选：server.test.ts 的 concurrent claims/command retries、accepted commands across restart；执行前重新核完整源码/动态SQL与专库输入，当前未运行。固定source已由Mika独立审查APPROVED/0 P1/P2，见[review](../../../plans/svc07-transaction-recovery/review.md)；main接收与架构图更新未完成。

## Clean-code 安全停点

2026-10-06 20:09 UTC，范围为上述固定源码2文件和本片证据。检查命名、连接所有权、Interface、错误/清理优先级、重复与复杂度：保留原公开函数、无新状态权威或全局handler，回调只调用一次；独立布尔failed保留null/undefined，注释说明COMMIT与同步handoff原因。没有为行数拆分无复用helper。15反例围绕可观察生命周期，未修改业务断言来通过。后续20:10收到固定source独审APPROVED；未解决：真实直接消费者和集成，按status继续。
