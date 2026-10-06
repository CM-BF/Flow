# WPF-DPERF05 quality

## 2026-10-06 18:57:40 UTC — source-only clean-code 安全点

本地技能固定 hash 见 skills.json；已批准设计与正式四范围领取复用，不重复安装/要求用户许可。

- 命名与职责：一个 private parseUtcUpdate 只解析字段中的第一个日期候选；parseStatus 仍拥有 errors，未分出空壳框架。
- 实際修复：旧 regex 跳过高精度/+00:00；直接 toISOString 可抛无效日期；Date 正常化会接受非法日期回卷；先找完整合法时间可误用后面 main 同步。现在明确精度/zone/日期/首候选并有限返回。
- 早年/午夜：setUTCFullYear 保留 0000–0099；日期先验再作 24:00 rollover，fraction 非零即拒绝，不因截断到零就误通过。
- 测试职责：56 个静态行为 case，参数矩阵覆盖真实示例/坏值，未复制 aggregate 老化公式。新 test 不带旧 fixture，也没有计时器/磁盘写/服务/PG。
- 静态检查：git diff --check exit0；源码只原 status.mjs 与新专测。行为、真正 aggregate、部署均 NOT_RUN。
- 局限：数值加连字符的首候选规则是保守输入政策；复杂非标准日期语法不支持。未知不改成当前。独立审查待固定源码。

## 2026-10-06 19:02:04 UTC — 676b source P2 修复安全点

原56未运行，旧 candidate-676b.json 与 source-only-checks.json 保留。静态审查发现旧“首数字-”边界不够：缺日期或 slash 日期时仍会从 main 同步救活；合法任务号又被当作日期。最小修复仅在原 private parser 先切 primary/main 记录，再用独立 year-prefix 避免任务号。日期、zone、精度和 errors authority 不变，无额外公共接口/依赖。

新增6个未运行行为 case：4个缺失/斜杠/反引号/英文 main sync；2个含任务 ID 的合法说明前缀。当前静态62 case，0产品执行，修复尚待独立复审。主段边界是明示的 main 同步/main sync，不声称解析任意自然语言记录。

## 2026-10-06 19:16:26 UTC — source冻结后交付安全点

c8d两源码及4只读helpers与run/gate hash逐项相同，未为检查改源。实际62行为覆盖UTC精度/非法日期/主段和main同步/任务号/其他字段；旧676问题和未运行56永久保留。监督tail修复将reap与删除分开、group未知保留scratch、清理后实际配额/时间失败不绿，原runner与delta归档。只归档证据与事实，不机械拆分parser，也不重复运行通过测试。真实aggregate/部署仍未验；各模块职责不变。

Root62证据独审原文已同段归档，0blocking；本片source/runtime批准与主线/部署事实分开，未重跑、未修饰raw。
