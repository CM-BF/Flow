# Web 平台只读研究与执行转化台账

2026-10-06；研究者root及d01_owner，实际修改由各唯一实现owner执行。这里是研究证据，不是第二手填进度源；进度见对应status。需求原文与来源轮次保留在主管理plan。

| 研究 ID | 发现 / 来源 | 已作取舍及交给谁 | 验证要求 |
| --- | --- | --- | --- |
| RS01 Thread真实性 | [官方Thread](https://www.assistant-ui.com/elements/thread)、[CLI/registry](https://www.assistant-ui.com/docs/installation)、[ExternalStoreRuntime](https://www.assistant-ui.com/docs/runtimes/custom/external-store)；本地assistant-ui技能明确elements为复制源码。GitHub main `64277e2781ac0b65eb34b45bf0fad1f371e7b2d7` 的 `packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx` SHA256 `9a59232333b78c579f5fa30799bfc431ba7b35929750de44c7c40410d1d66ac3` | W01采用实际registry与0.15.23兼容源码，保留JSON/hash/许可和最小diff；不得以旧TimelineMessage整slot替代完整官方Thread | Root/Viewport/Messages/Footer/Scroll/Composer/ActionBar；新任务受理失败保草稿；不支持edit/reload/followup不假启用 |
| RS02 Arc与视图生命周期 | [Arc Split View](https://resources.arc.net/hc/en-us/articles/19335393146775-Split-View-View-Multiple-Tabs-at-Once)、[React状态位置与key](https://react.dev/learn/preserving-and-resetting-state) | W01 split/merge仅组织视图；同task单projection；stable key与草稿放稳定owner | A/B同时流更新、合并再分屏、关闭不cancel、任务命令不串ID、草稿不丢 |
| RS03 Tabs/splitter | [ARIA Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)、[Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) | panels采用单tabstop/手动激活；W01若提供可调divider需键盘和值语义；splitter指南自身尚有review限制，不夸大认证 | 左右/Home/End、Enter触发懒读取、关闭后邻项焦点；divider方向键/aria值/controls |
| RS04 Terminal/FileTree能力与源码缺口 | [Terminal](https://elements.ai-sdk.dev/components/terminal)、[FileTree](https://elements.ai-sdk.dev/components/file-tree)；固定官方commit `6a9d5b1822ffb10bba4bd97175f01edd7d8651cd`，`packages/elements/src/{terminal,file-tree}.tsx`；[Treeview](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) | Terminal不是PTY，默认黑色/强制追尾/pulse/复制无默认aria名；FileTree缺完整roving/Arrow/aria。panels保留source并做必要修正、记录diff。现契约无path/stdout channel | 命名任务输出/产物引用；token浅深、reduced-motion、上滚暂停追尾、复制失败反馈；tree单tabstop/Arrow/Home/End/selected/expanded/Space阻滚 |
| RS05 统一插件Host | [VS Code Contributions](https://code.visualstudio.com/api/references/contribution-points)、[Activation Events](https://code.visualstudio.com/api/references/activation-events)、[JupyterLab扩展](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html) | WPF-P01先建窄host和稳定位置；button引用commandId；内置terminal/files/theme等真实plugins验证。W01本轮只留位置不堆完整框架 | ID冲突/API版本、激活回滚、disable清理、调用时权限上下文复核、error isolation、按需加载/重试、sample无核心改动加button/tab/menu |
| RS06 性能证据 | [React Profiler](https://react.dev/reference/react/Profiler)、[INP](https://web.dev/articles/inp)、[Vite async chunks](https://vite.dev/guide/features.html#async-chunk-loading-optimization) | WPF-PERF01固定机器/build/fixture；原W01 CSS12.50kB/gzip3.23，mainJS329.14/gzip100.65，assistant-ui284.85/gzip83.60为历史基线，不能套到新增Thread；不为bundle指标盲删官方组件 | 冷启动/首次交互、tab/splitmerge、观察请求数、详情0/1/cache、close清理、长历史DOM/滚动；中位/p95需足够样本；synthetic不是模型容量；lazy error/retry/离线不崩 |
| RS07 与原工程对齐 | 只读固定基线FLOW-001 §10及full-plan-matrix：X01含REQ11/12/13插件全栈范围；原P01是协议；M02公共基础由原Lead负责 | WPF-P01是X01的Web host/UI扩展子项，完整plugin还需全栈生命周期/配置/能力作用域/隔离/CLI等价/tool-renderer-verifier/fallback/压缩归属；不重定义M02共享命令 | 原Lead明确跨计划owner及接口、统一能力命名/权限模型、Web可替换与后端真实能力分别验收 |

## 技能与clean-code

执行管理者本地优先沿用已读 find-skills、codebase-design、clean-code；只读UI研究另读 assistant-ui/SKILL.md及references/architecture.md、packages.md，并核对官方llms.txt。elements sibling本地缺失，没有安装无关技能。clean-code固定来源 `sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`。

本段管理文档应用：逐条需求稳定ID、原话/转述明确，owner事实与跨任务管理拆开；发现P01/D02/D03编号已占用并使用WPF前缀；插件Web子项与X01总范围区分；避免把两个panels接口或ansi-to-react3/6版本同时宣布为既定。根只读研究由owner记入其实现quality证据；本文保留来源与取舍。


## 进行中审读转化（不是正式SHA approval）

- root核对实际registry thread.json：官方thread.aui.tsx内容SHA256 `64cb85b4076644dd319325b319264ec8e998e619a97c19e0f001d3fa5a03a016`，官方832行、本地833行；完整结构保留，变化为import、Flow插入点、composer显隐/文案、cancelOnEscape=false及受理中按钮禁用。实际来源符合要求，最终样式/接入行为仍需验证。
- W01：样式未接通的开发截图不可当验收；pending submit时close后迟到受理不得访问已删除view、重开tab或留下ghost observer；动态标题与render中网络副作用交owner修正，用延迟HTTPfixture验收。
- panels：A/B/A右tab/tree/追尾UI状态按task缓存，受控tab焦点同步、关闭按钮键盘策略、同referenceID跨task隔离与已选引用重分类可见交owner处理。实际修复/检查记录由实现owner写，管理者不将建议标为通过。
- 原Lead最新确认4320为17来源，D03独占全部dashboard后续；管理计划据此撤销我方重复实现排队，仅交来源登记。验证采用模块+直接依赖优先，metadata不重跑全库。

## 首版文档检查与clean-code停点

2026-10-06 02:15 UTC：检查14份Markdown的本地链接均可解析；四份plan的稳定TODO与status逐项一一对应，无重复；git diff --check通过（暂存后再次检查新增文件）。仅文档修改，不运行全库工程测试。clean-code复核命名/职责/接口/事实边界，实际修正P01编号冲突、D03重复owner、14→17来源、原话空格及表格断行；未来实现/性能/注册均保留未验证。
