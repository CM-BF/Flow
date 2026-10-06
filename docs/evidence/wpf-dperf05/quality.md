# WPF-DPERF05 quality

## 2026-10-06 18:57:40 UTC — source-only clean-code 安全点

本地技能固定 hash 见 skills.json；已批准设计与正式四范围领取复用，不重复安装/要求用户许可。

- 命名与职责：一个 private parseUtcUpdate 只解析字段中的第一个日期候选；parseStatus 仍拥有 errors，未分出空壳框架。
- 实際修复：旧 regex 跳过高精度/+00:00；直接 toISOString 可抛无效日期；Date 正常化会接受非法日期回卷；先找完整合法时间可误用后面 main 同步。现在明确精度/zone/日期/首候选并有限返回。
- 早年/午夜：setUTCFullYear 保留 0000–0099；日期先验再作 24:00 rollover，fraction 非零即拒绝，不因截断到零就误通过。
- 测试职责：56 个静态行为 case，参数矩阵覆盖真实示例/坏值，未复制 aggregate 老化公式。新 test 不带旧 fixture，也没有计时器/磁盘写/服务/PG。
- 静态检查：git diff --check exit0；源码只原 status.mjs 与新专测。行为、真正 aggregate、部署均 NOT_RUN。
- 局限：数值加连字符的首候选规则是保守输入政策；复杂非标准日期语法不支持。未知不改成当前。独立审查待固定源码。
