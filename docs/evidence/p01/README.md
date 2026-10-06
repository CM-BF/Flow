# P01 SDK阶段证据

2026-10-06 02:25 UTC，assignment_review / gpt-6-astra。本阶段实现A2A 1.0.0双向官方SDK HTTP与Flow入站持久bridge、MCP 2026-07-28 client基础能力。完整P01仍有[后续必做项](../../../plans/p01-protocols/plan.md)，本报告不代表外部agent已进入中心调度。

## 实际检查

- Node24.20.0 / pnpm9.15.4 / macOS arm64；[机器、SDK、规范和源码哈希](manifest.json)。
- [frozen install输出](install.log)：Lead的direct core清理提交已接入，仅去掉未使用的直接importer，传递SDK版本保持。
- [typecheck输出](typecheck.log)：通过。
- [原始测试JSON](tests.json)、[日志](tests.log)：6文件17项全部通过。所有HTTP使用动态loopback端口，PG仅flow_p01；无模型/云调用。
- A2A客户端对独立官方DefaultRequestHandler（其中InMemoryTaskStore仅peer测试夹具）；Flow bridge则由独立官方ClientFactory通过真实HTTP、真实PG验证。没有把测试内存存储说成生产持久性。
- 覆盖ACK丢失只发一次、0.3/跨origin拒绝、终态与GET/订阅窗口、中心+bridge重启后的显式command去重、messageId不默认去重、输入决策、观察退出和实际取消区别、产物版本/成功与失败verification独立、ListTasks有界分页/精确count/包含时间边界/过滤cursor、shutdown不取消、无效historyLength受理前拒绝。最后一项[修复前失败记录](history-validation-red.log)保留。
- MCP官方2.3.1 server真实HTTP验证server/discover及逐请求2026协议、tools/resources/prompts、isError与协议错误、host工具授权、form input_required及不透明requestState。另用规范固定HTTP fixture验证Tasks拒绝、取消仅关闭请求流、未知/大响应失败。双造mock不是唯一互操作证据。

## 复跑

测试会删除专用flow_p01的flow/pgboss schema；只有该测试库空闲时执行。PostgreSQL位于127.0.0.1:55432，本机测试账号和数据库沿项目独立夹具，不读取其他owner数据库。

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm install --frozen-lockfile
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run packages/protocols/test
```

对原始证据复跑请把JSON输出到/tmp独立路径；不要覆盖本次记录。最终commit由[review target](../../../plans/p01-protocols/review.md)绑定；manifest逐文件固定实际被测实现，避免metadata HEAD变化误解为重测。

## 限制

独立review未执行；未跑负载、跨机/真实TLS部署、认证登录流程、云或模型。只支持矩阵内JSONRPC A2A及现代Streamable HTTP MCP；任务历史有界，流重连以权威快照恢复，不承诺lossless历史。MCP Tasks未支持且不advertise，取消不代表远端副作用停止。出站durable binding、runner接入、中心持久人工等待和预算尚未实现。其余官方依据、精确能力与降级见[设计](../../architecture/p01-protocols.md)；技能和实际clean-code记录见[质量记录](quality.md)。
