# D03 工程进度的人类视图

创建 / 更新：2026-10-06。状态：in-progress。Owner：runner_owner / gpt-6-astra。

目标：首屏说明当前阶段、正在推进的最多三件事、下一可用交付与真实用户决定；工程证据保留在详情。唯一事实源仍是各 owner status，不推测历史段落、不调用模型。

## 已确认设计

字段由 Execution Lead 同意：阶段、优先级（1–9）、当前产出、下一可用交付、当前阻塞（NONE / ACTIVE:）、需用户决定（NONE / REQUIRED:）、实现目标（完整 SHA）、实现范围（逗号分隔 repo 相对 literal 路径）。UNKNOWN/缺失不是阻塞或决定。旧源摘要待补。审查目标与 metadata HEAD 分开，以真实范围 diff 和 main ancestry / 范围树证明核验。

视觉：紧凑中性工作台，正文系统字体（SF / PingFang），标题 24、分区 17、正文 14。浅色纸白 #ffffff、底色 #f7f7f5、正文 #252523、次要 #686864、边线 #e0e0dc；深色底 #202020、表面 #282828、正文 #eeeeeb。绿色仅表示有证据通过，橙色仅表示真实阻塞。左对齐、无营销 hero、无等大卡片、无装饰渐变。

```text
Flow / 项目进度                         主题 / 刷新
当前阶段
正在推进（最多 3 行）       下一可用交付
每项当前产出 + 详情         需要你决定 / 无需决定
当前阻塞（仅明确 ACTIVE）
摘要待补（折叠） / 已完成历史（默认折叠）
全部计划与证据（紧凑目录）
```

自审：删除旧 M1 大卡片和 engineering 原文摘要，使用实际任务句子表达进展；未知展示字段缺口，历史默认折叠。小屏改为单列，完整浅深主题，原生 dialog 与 details 提供键盘路径。

## TODO 与验收

- [x] D03-01 确认规则/技能/字段与独占范围，登记方案。
- [ ] D03-02 结构化摘要与审查/集成 proof，覆盖 missing/dirty/untracked/metadata/main ancestor。
- [ ] D03-03 紧凑人类视图及完整证据下钻，登记 19 个唯一源。
- [ ] D03-04 node tests + 真实浏览器四视图/键盘/溢出/追溯，clean-code 与交付证据。

范围：apps/execution-dashboard、此计划三文件、docs/evidence/d03。动态端口，不触碰 4320 服务。0 模型/云。全局模板和其他 owner status 由 Lead 管理。
