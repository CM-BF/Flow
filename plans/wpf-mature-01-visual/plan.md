# WPF-MATURE-01 成熟聊天视觉与材质

| 字段 | 内容 |
| --- | --- |
| 大task ID | WPF-MATURE-01 |
| 状态 | in-progress；完整验收未完成 |
| co-lead | Web /root（执行管理 d01_owner） |
| 优先级 | P1 |
| 唯一来源 | 本目录plan/status/review，管理worktree合法claim v3；不另填聚合进度 |
| 用户来源 | [成熟度原话与六项分工](../../docs/evidence/web-platform/mature-task-handoff.md)；原WPF REQ仅追溯，不形成第三层 |
| 收益 | 让真实聊天界面在信息密度、层级与材质上接近成熟工作台，并在长内容和错误场景保持清晰。 |
| 边界 | 本计划定义完整用户结果；具体实现须独立worktree、fresh精确scope take和固定独审，计划目录领取不授产品写权 |
| 依赖 | 复用现有主题/官方Thread/布局接缝；与STEIRI当前App/Thread/types/validation写权错峰。没有新的产品文件claim前仅规划。 |

## 已有能力与gap

CHATREAD01已审527176c且main d7e，减少稳定配置常驻高度并修弹窗下钻焦点；它不代表成熟材质系统完成。P01、主题与官方Thread已有基础。

VISUAL01固定a8b/交付f708已独审并main4391接收，owner558895d收口且35e5 v3释放：实际App内建浅深材质与显式opaque、长文/代码表格/错误/活动/stream/390已有限验证，主线已接而个人产物发布归SVC04另计。尚缺外部插件统一材质token合同、组件完整消费与插件reload生命周期，以及整体状态矩阵验收；不能把builtin四主题当完整可扩展主题系统。

中性轻质外壳、低对比紧凑sidebar、分组小图标短行高；圆角选中容器内多个图标表示pane组合；嵌入式并排panel各有圆角细边框/轻阴影/窄gutter/精简header，活动pane靠明确边界而非大块高饱和背景。玻璃集中shell/sidebar/浮层，正文保持稳定不透明可读。控件紧凑而正文适度留白，避免满屏大卡片。

## 稳定TODO与完整验收

- [ ] **WPF-MATURE-01-01** 设计tokens和状态矩阵：圆角层级、轻阴影、透明度/blur、字体/间距/消息宽度写清；浅深同语义、正文可读。单一typed catalogue统一允许名称/有限值域/映射/default，颜色兼容；具体限制见[固定研究](../../docs/evidence/web-platform/mature-theme-presentation-research.md)。
- [ ] **WPF-MATURE-01-02** 交付真实App shell与常用控件：导航、输入、选中pane、弹层、气泡实际接通扩展tokens，移除阻断根token的局部硬值；真实外部主题材质/禁用清理及已安装、禁用、缺失插件三种reload验收，不以builtin切换或静态mock代替。
- [ ] **WPF-MATURE-01-03** 覆盖内容与异常场景：实际空态、长正文、代码/表格、streaming、tool/thinking展开、错误截图；不遮行动错误或unknown。
- [ ] **WPF-MATURE-01-04** 完成可访问性与降级：390px与桌面、键盘焦点/IME、reduced-motion、不支持/禁用backdrop-filter时不透明可读fallback。
- [ ] **WPF-MATURE-01-05** 固定交付及独审对照：实际App前后图与交互证据，源码绑定固定target，局部审查后受控main集成。

## 验证与交付规则

每个实际子task直接链接本大task稳定ID及co-lead；进度只维护其唯一status。仅完整TODO验收通过、证据环境/固定源码明确并完成受控主线集成后才可将本大taskDone；当前所有大task验收仍开放。普通片段ready/review/merge/claim不向GO发送，内部worker通信保留，需GO解决的整任务独立blocker仅一次。新scope依D04查重/原子领取，本计划不授权重启个人服务、刷新用户tab或新增provider调用。验证按影响范围，不为文档重复产品测试。

## 固定研究输入

见[固定b1c2源码与官方接口研究](../../docs/evidence/web-platform/mature-task-handoff.md)：现有split硬限两个group，尚无组合pane模型；现theme tokens可复用。可聚焦splitter键盘/ARIA需实际验证，不透明fallback不可只靠支持有限的media query。研究未构成实现或产品验收。

现01/02的逐项源码、官方三来源、静态推断/未browser复现边界与后继验收集中见[主题与呈现研究](../../docs/evidence/web-platform/mature-theme-presentation-research.md)。本轮只绑定已有TODO，不扩VISUAL已冻结九scope。
