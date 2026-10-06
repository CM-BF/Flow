# 固定506窄屏导航 / 草稿与焦点验收补充

只读研究，挂现有 MATURE01/05/06，不新建执行层或claim。当前兼容PASS保持，封存截图/生产artifact不改。本报告不是当前main或个人部署观察，不是浏览器/辅助技术合规认证。

## 已核源码事实

- `apps/web/src/App.tsx:385`：sidebar只在首次mount按innerWidth>800决定默认值；未见resize/matchMedia同步。`styles.css:535`的800px断点把侧栏从flex布局改为fixed覆盖，故desktop→390时仍打开的导航可以覆盖原chat。fresh390首载与desktop缩窄是不同状态，不应只测其一。
- `App.tsx:723`：Chats是原生button，Enter/Space已有浏览器原生行为。`IconButton`只用active CSS类，没有为导航暴露aria-expanded；aside也无可供aria-controls引用的id。不能把通用active都改aria-expanded，只给实际disclosure控制接状态。
- `App.tsx:779`：Hide chat list直接setSidebar(false)，使当前aside和内部触发按钮卸载；未见该路径的焦点回交。`select:453`/`newChat:440`在窄屏也隐藏aside，目标焦点同样需明确。对比`closePanel:526`已有独立workspace按钮回焦策略，可复用方法但不能把chat导航焦点错误回到workspace。
- `App.tsx:374`：drafts Map和views属于Workspace，main是aside的稳定sibling；sidebar开关与CSS断点本身不清drafts，也不重建ChatPane key。这是保留草稿的源码依据，不等输入、selection range、attachment chips或异步回执全部实测保留。
- `styles.css`已有focus-visible ring、100dvh、flex min-width/min-height和reduced-motion规则。当前fixed叠层不包含main inert/focus trap，App无导航Escape处理；它不是已实现的modal drawer。不能仅为看起来像drawer就加aria-modal而继续允许后台焦点。

## 最小后继方向（设计候选）

导航显隐及焦点由一个小Interface负责，保持现Workspace draft/selectedView owner。为Chats暴露expanded和稳定控制目标。明确两种不同关闭原因：Hide/Escape在焦点仍位于导航内时回到存活的Chats按钮；选择聊天/新建则去已可见的目标tab或经产品确认的composer，不能重置正文/选择/材料，不能抢走已移到别处的焦点。

窄屏可以沿非模态disclosure实现：用户需要在聊天继续工作时可从当前位置关闭遮挡、保持焦点，或离开导航时收起。若选择真正modal，则完整支持初始焦点、约束Tab、Escape、恢复与后台不可操作；不能只加role。优先选择覆盖现交互的小策略，不增加第二布局状态源或通用框架。sidebar.header/sidebar.item.actions/sidebar.footer和最左插件贡献仍可发现；不要用CSS隐藏未知插件的必须动作来换紧凑。

## 明确未来实测矩阵

1. fresh390与desktop→390分别验证。关闭导航后，长消息/代码、编辑和Send/Queue、按需详情可用且焦点可见；打开导航和右侧tabs的叠层各自验收。
2. 输入中文含IME、保留selection/caret、选择两附件/knowledge并含下一draft；390↔desktop再切回，原view/key/material顺序不变，宽度变化0额外submit/cancel。未确认回执原key/body也不受显隐影响。
3. 仅键盘开启导航、遍历搜索/聊天/插件项、Hide或Escape以及选择聊天；检查focus目标存在、expanded读出、不会停在卸载元素或被完全遮住。真实模态与非模态的预期先选定再测，不混两套断言。
4. 浅深主题、减少动画、放大文字/200% zoom；不以静态截图代替可操作旅程。先做最小受影响fixture，再在正确源绑定的实际App验证，不重跑当前RELEASE绿矩阵。

## 来源与边界

本地技能：find-skills、web-design-guidelines（Vercel1.0.0）、clean-code、codebase-design。2026-10-06重新读取官方指南，仅使用与本段相关规则：可见焦点、语义按钮、避免覆盖焦点和保留输入状态；未据此套用所有网站式导航/破坏确认建议。

- [WAI Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)：按钮的展开状态需要可读；aria-controls可选。本报告选择稳定关联是实现建议，不把可选项误写成规范强制。
- [WAI Focus Not Obscured Minimum](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)：至少部分可见；用户主动打开内容有可在不移动焦点情况下关闭的例外。单截图无法判定实际键盘失败，需运行矩阵。
- [Vercel官方接口指南](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)：按官方当前版本复核上述界面原则。

Clean-code：焦点/显隐状态应有单一owner，接受关闭原因以保正确目标，不在每个按钮散落setSidebar与document查询；行为与draft owner分开，先小型内部接缝，不新增外部plugin权限。本段0项目写、import/type/test/HTTP/Chrome/PG/free采样；未发现足以改变现兼容批准的新运行反例。
