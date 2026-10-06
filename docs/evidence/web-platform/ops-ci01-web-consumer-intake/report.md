# 现有 Web 验收与 OPS-CI01 消费边界

当前 OPS-CI01 文档候选不能解除 QuickControls 的待验项。它明示只覆盖两个 contracts 用例及一个 PG/handler 用例；这不阻塞原 OPS 小片的独立审查，也不是对该片新增缺陷。本文只给既有 MATURE02/TODO11、MSGQUICK-03/04 保存后继输入，未创建任务、领取或远程 runner。

[W01 固定消费研究](w01-report.md)与[精确 pin 审计](w01-audit.json)、[root 官方资料及结果边界研究](root-research.json)均逐字归档。CI 固定对象为 `abc7444ddb3a3724763567d1955e58b157ba51df`，文档实现 `cdd96bc759826f4e061da9cbb61b4f0881f2cbd9`；它的四个 Web 文件均不同于待验 `fe6ece131c489c79cf531a184e4cf51209f9c4a0`。后续 OPS 事实只读[原 owner status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/ops-remote-validation/plans/ops-ci01-remote-validation/status.md)，本文不追 moving HEAD 或代替该 owner 审批。

| 既有待验项 | 后继若采用远程结果，必须保留的真实消费边界 |
| --- | --- |
| MSGQUICK-03 类型与 direct | 选择同一已审不可变源；targeted strict noEmit 与实际 TSX 单文件 26 个精确测试名；真实退出、完整结果与清理。当前 CI 没有调用这些入口。 |
| MSGQUICK-04 页面 | 显式调用真实 fixture/check 两个导出函数，完整六组与浅深主题 390px 两张 PNG、真实 CSS/plugin 链；先接收同源类型/direct 证据。默认 test:browser 是旧入口/旧端口/旧证据，不能替代。 |
| 环境与留存 | macOS donor/sandbox/native Chrome 方法不能直接搬到 Ubuntu；若走远程，另固定环境、进程/网络/临时目录边界及有界结果/PNG 留存，缺报告、零测试或不完整清理不可判通过。 |

这些是未来消费接口要求；没有新远程实现或启用授权。原本地 c1/b1 仍仅静态准备获审，所有新检查 **NOT_RUN**；c1 的旧 metadata HEAD 只在下一真实准入时重绑，不为本研究循环改包。功能状态仍以[QuickControls 唯一 status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-quick-controls/plans/wpf-message-settings-quick-controls/status.md)为准；Recovery/DPERF/SVC 原队列和预算不变。

[本轮 Lead 入站](lead-incoming.json)：三处 exact .vite 共 180 个生成文件已处理；52,590,240 逻辑字节不是净物理回收。操作末 1,073,909,760 B 与随后 Lead 报告的 1,069,273,088 B 分列，后者采样时点未提供；均非本组重新取样。该后续观察仍低于原门槛，无 holder、新 gate 或追加回收候选；继续原 SVC07/C02 调度。

[当前 D04 有界核验](coordination-observation.json)仅确认原管理范围及独立 owner；源码领取不等于运行占用。[机器索引](intake.json)保存来源、映射与未验边界。此次没有项目外写权、产品运行、CI 触发、资源/进程扫描或缓存操作。
