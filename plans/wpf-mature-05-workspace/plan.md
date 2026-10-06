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
| 依赖 | CONTEXTI已main并释放，STEIRI01已main并释放，布局与插件入口后继仍须fresh精确交权，不能借旧free观察写入；复用workspace-state，先核持久布局接口与真实view身份，不改会话历史。 |

## 已有能力与gap

现有聊天split/group和原生hidden可见性已用于真实流/活动接线；这不等价于Arc组合标签。旧TaskThread fixture不是此项验收。

尚缺：组内pane数组、组合标签图标/选中容器、独立焦点/滚动/草稿、比例/交换/合回/布局恢复，窄屏退化与有界3+pane后继。

中性轻质外壳、低对比紧凑sidebar、分组小图标短行高；圆角选中容器内多个图标表示pane组合；嵌入式并排panel各有圆角细边框/轻阴影/窄gutter/精简header，活动pane靠明确边界而非大块高饱和背景。玻璃集中shell/sidebar/浮层，正文保持稳定不透明可读。控件紧凑而正文适度留白，避免满屏大卡片。 参考图实际有3pane；不把首期A与B验收等于数据模型仅支持2。

## 稳定TODO与完整验收

- [ ] **WPF-MATURE-05-01** 固定组与pane模型：顶层tab/group包含任意有界pane数组，不写死两栏；首验A与B，最大pane数在实现前明确。
- [ ] **WPF-MATURE-05-02** 接真实conversation双pane：同顶层tab显示A与B，独立焦点/滚动/未发草稿/上下文，不靠全局focused授权其他pane；真实ConversationList扩展用conversation/view上下文，不借旧task slot冒覆盖。
- [ ] **WPF-MATURE-05-03** 提供布局操作与恢复：比例调整、交换、合回与恢复；关闭视图不cancel，split/merge只改布局不拼接history；组合pane菜单复用P01 registry并核sample贡献/禁用及跨连接身份。
- [ ] **WPF-MATURE-05-04** 兼容内容种类与窄屏：模型可容chat/文件/产物；首个两栏旅程与3+后继分明，390键盘可达且不强迫外部内容同色。
- [ ] **WPF-MATURE-05-05** 固定真实交互验收：实际App双会话及内容pane交互/刷新恢复/关闭重开证据，主题和比例/焦点测试；大量反复开关后DOM/缓存/订阅有界，区分visible/hidden/closed-clean/closed-protected，草稿/附件/unknown不可静默丢失，满额保护时拒新开，重开恢复且不cancel后台任务；实际0模型测DOM/effects读取/切换输入时延及未确认恢复，Activity不是内存上限；另核overview/feed同时服务sidebar的观察与命令生命周期，按visible overview/聊天隐藏overview/pagehidden区分请求，不能仅离开overview就全停；后继裁剪必须保raw稀疏cursor/watermark、阅读anchor/hasEarlier/可重取和单一轻摘要来源，不用DOM推算CPU/heap；关联MATURE06-04，没有实现的3+明确开放。

## 验证与交付规则

每个实际子task直接链接本大task稳定ID及co-lead；进度只维护其唯一status。仅完整TODO验收通过、证据环境/固定源码明确并完成受控主线集成后才可将本大taskDone；当前所有大task验收仍开放。普通片段ready/review/merge/claim不向GO发送，内部worker通信保留，需GO解决的整任务独立blocker仅一次。新scope依D04查重/原子领取，本计划不授权重启个人服务、刷新用户tab或新增provider调用。验证按影响范围，不为文档重复产品测试。

## 固定研究输入

见[固定b1c2源码与官方接口研究](../../docs/evidence/web-platform/mature-task-handoff.md)：现有split硬限两个group，尚无组合pane模型；现theme tokens可复用。可聚焦splitter键盘/ARIA需实际验证，不透明fallback不可只靠支持有限的media query。研究未构成实现或产品验收。

### 组结构和预算后继验证（root 09:12固定main77c只读）

现App tabs.map在groups.map内，跨group移动即使View.key同也可能remount，未来A|B合并/交换/resize需实际验证composer草稿、scroll、知识/附件选择、unknown receipt；不能只测纯reducer。持久仅版本化有界结构/相对比例/view refs，不存token；reload身份另核，未知ID占位不后台遍历conversation。现stream连接预算最多2读取lease、8cachedturn/4MiB（pane4turn/2MiB），3+pane须测公平前进/隐藏释放，不能解开UI上限就声称全部实时，A|B不需改host。原slot手动focus/Enter激活避免方向键触发批量按需读。React官方preserving-and-resetting-state支持tree位置推断，本轮无实测失败；来源https://react.dev/learn/preserving-and-resetting-state 与https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ 。

实际插件入口覆盖见[root固定main80ba只读研究](../../docs/evidence/web-platform/conversation-plugin-coverage-research.md)，沿REQ22–23/WPF-001-05；未browser复现或实施，不扩大STEIRI写权。

规模验收补充（GO/root固定0b0源码观察，未browser复现）：大量反复开关后DOM/读缓存/订阅有明确上限，草稿/附件选择/unknown receipt不丢；关视图不cancel、重开恢复固定会话。visible/hidden/closed-clean/closed-protected生命周期和受保护满额拒新开见[既有研究](../../docs/evidence/web-platform/conversation-plugin-coverage-research.md)，关联MATURE06-04；不把stream/activity已有预算当整个workspace已有限，不新增大task或提前占App。
