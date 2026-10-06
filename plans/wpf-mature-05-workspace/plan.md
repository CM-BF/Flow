# WPF-MATURE-05 Arc式组合标签与独立pane

| 字段 | 内容 |
| --- | --- |
| 大task ID | WPF-MATURE-05 |
| 状态 | in-progress；完整验收未完成 |
| co-lead | Web /root（执行管理 d01_owner） |
| 优先级 | P2 |
| 唯一来源 | 本目录plan/status/review，管理worktree合法claim v3；不另填聚合进度 |
| 用户来源 | [成熟度原话与六项分工](../../docs/evidence/web-platform/mature-task-handoff.md)；原WPF REQ仅追溯，不形成第三层 |
| 收益 | 一个顶层标签代表一组并排pane，让真实对话与文件/产物能在同一工作组独立操作且可恢复布局。 |
| 边界 | 本计划定义完整用户结果；具体实现须独立worktree、fresh精确scope take和固定独审，计划目录领取不授产品写权 |
| 依赖 | 保留当前CONTEXTI独占App/Thread窗口；复用workspace-state，先核持久布局接口与真实view身份，不改会话历史。 |

## 已有能力与gap

现有聊天split/group和原生hidden可见性已用于真实流/活动接线；这不等价于Arc组合标签。旧TaskThread fixture不是此项验收。

尚缺：组内pane数组、组合标签图标/选中容器、独立焦点/滚动/草稿、比例/交换/合回/布局恢复，窄屏退化与有界3+pane后继。

中性轻质外壳、低对比紧凑sidebar、分组小图标短行高；圆角选中容器内多个图标表示pane组合；嵌入式并排panel各有圆角细边框/轻阴影/窄gutter/精简header，活动pane靠明确边界而非大块高饱和背景。玻璃集中shell/sidebar/浮层，正文保持稳定不透明可读。控件紧凑而正文适度留白，避免满屏大卡片。 参考图实际有3pane；不把首期A与B验收等于数据模型仅支持2。

## 稳定TODO与完整验收

- [ ] **WPF-MATURE-05-01** 固定组与pane模型：顶层tab/group包含任意有界pane数组，不写死两栏；首验A与B，最大pane数在实现前明确。
- [ ] **WPF-MATURE-05-02** 接真实conversation双pane：同顶层tab显示A与B，独立焦点/滚动/未发草稿/上下文，不靠全局focused授权其他pane。
- [ ] **WPF-MATURE-05-03** 提供布局操作与恢复：比例调整、交换、合回与恢复；关闭视图不cancel，split/merge只改布局不拼接history。
- [ ] **WPF-MATURE-05-04** 兼容内容种类与窄屏：模型可容chat/文件/产物；首个两栏旅程与3+后继分明，390键盘可达且不强迫外部内容同色。
- [ ] **WPF-MATURE-05-05** 固定真实交互验收：实际App双会话及内容pane交互/刷新恢复/关闭重开证据，主题和比例/焦点测试；没有实现的3+明确开放。

## 验证与交付规则

每个实际子task直接链接本大task稳定ID及co-lead；进度只维护其唯一status。仅完整TODO验收通过、证据环境/固定源码明确并完成受控主线集成后才可将本大taskDone；当前所有大task验收仍开放。普通片段ready/review/merge/claim不向GO发送，内部worker通信保留，需GO解决的整任务独立blocker仅一次。新scope依D04查重/原子领取，本计划不授权重启个人服务、刷新用户tab或新增provider调用。验证按影响范围，不为文档重复产品测试。

## 固定研究输入

见[固定b1c2源码与官方接口研究](../../docs/evidence/web-platform/mature-task-handoff.md)：现有split硬限两个group，尚无组合pane模型；现theme tokens可复用。可聚焦splitter键盘/ARIA需实际验证，不透明fallback不可只靠支持有限的media query。研究未构成实现或产品验收。
