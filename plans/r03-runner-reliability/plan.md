# R03 Runner 有界可靠性

编号：R03。创建/更新：2026-10-06。状态：in-progress。Owner：assignment_review / gpt-6-astra。父需求：[FLOW-001](../flow-001-architecture/plan.md)。

目标：修复 generic runner 对中心墙钟的依赖、初次 claim 起点过晚，以及本地初始化失败的退出边界。只交可独立验证的租期/存储清理片段；中心 ownership fence 仍权威，不扩大并发、outbox 索引、FS/PTY。

## TODO

- [x] R03-01 固定 claim 剩余租期合同、兼容和单调时钟规则。
- [ ] R03-02 公开 runRunner/HTTP 红绿验证 ±5分钟时钟偏差、claim/heartbeat 延迟与晚回包不复活。
- [ ] R03-03 明确本地存储失败退出，验证无持续心跳和退出清理；检查直接消费者。
- [ ] R03-04 固定证据、clean-code、独立 review 与交付。
- [ ] R03-05 后续 BR-01 实际执行位置/只读版本化FS/process logs/PTY，以及 S01 多runner（独立范围，本段不实现）。

## 方案与范围

[设计](../../docs/architecture/r03-runtime.md)。授权具体文件见 status claim。0 模型/0 云；动态本地HTTP端口、临时目录；如需真实中心字段检查使用独立 flow_r03 数据库。普通接口选择已授权，不重复请求许可。

answer() 20ms轮询作为后续可测候选，不在本段改动；完整 runner 需求不因本片段通过而完成。
