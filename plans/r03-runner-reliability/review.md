# R03 独立审查

状态：NOT_STARTED。Base 3773db5d014a6d38d09553acd0a5fe8df900b7c4；target未提交。Owner工作树 /Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-reliability，branch codex/runner-reliability。Reviewer/model/时间：未指定。空模板不是批准。

只读审查任务：先核验规则、status、claim、实际head/dirty，再核对固定目标的租期公式、初始claim时间点、sync expiry检查、晚回包和存储故障/退出行为。只测试公开runRunner/HTTP和直接消费者，0模型，不改outbox/并发/FS/PTY。报告具体文件行、severity/blocking、复现、已执行/未执行；修复交owner。结论必须绑定SHA，不能用旧通过替代新版本。

检查、findings、作者回应和复审：全部未执行/未评估。后续填真实证据。
