# Activity readability skills and quality

2026-10-06 09:33:43 UTC：实读本树AGENTS/plans规则、现NativeActivity/Tool/原HTTPbrowser与其Interface；先find-skills领域匹配，已有本地技能优先，无安装。

- /Users/citrine/.agents/skills/find-skills/SKILL.md: SHA256 `c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f`
- /Users/citrine/.agents/skills/codebase-design/SKILL.md: SHA256 `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2`
- /Users/citrine/.agents/skills/clean-code/SKILL.md: SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`
- /Users/citrine/.agents/skills/assistant-ui/SKILL.md: SHA256 `20bd24ab58c8d281b329e1df34655c8a6dc0cd56d8a087aff252b37025c6937c`
- /Users/citrine/.agents/skills/ai-elements/SKILL.md: SHA256 `6e1697f6728f131cfbbb6b53543438921ce11faafcc4d5e0cc361b1643324e71`
- /Users/citrine/.agents/skills/webapp-testing/SKILL.md: SHA256 `51b7349e77ec63b7744a6f63647e7566a0b4d2e301121cc10e8c2113af6556a2`

本地clean-code固定安装来源sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。应用：保留projection唯一业务状态、现props/interface，显示助手同文件且无需新框架；已有官方Reasoning及AI Elements Tool适配来源不变，只做合法真实状态的显示文字。测试复用现HTTPfixture与全部生命周期断言，不复制另一套client/registry。节点来源见现只读docs/evidence/wpf-activity-i01/interface.md。定段/约30分钟与交付清码，记录真实发现。

2026-10-06 09:40 UTC 工作段清码：显示职责保持NativeActivity/Tool，无新增状态/网络/权限分支。发现已读基线直接test将整个footer slot等同单个activity插件，新增stream panel使旧断言失败；先记录15/16原失败，经root同意与管理v2精确amend后仅按pluginId过滤，仍精确检查本模块button/menu/panel，未删lazy/cache/lifecycle断言。browser首轮source路径错.ts（实际.tsx），后跨中心fixture缺公开X-Flow-Assistant-Stream预检header导致GET失败；保留两轮原log/JSON，修正来源路径与独立HTTPfixtureCORS，不改公共client/App。增加offline前已加载Activity等待，避免从未完成加载态误测离线恢复。

2026-10-06 09:42 UTC 交付清码：逐读两生产文件及两个专测差异。保NativeBody单一正文显示职责、NativeActivity只订阅/触发、Tool只展示公开状态；不抽象第二status映射。原生details使用键盘语义且每pane自有DOM状态，无新Focus/Effect。移除单页无效pager不改变实际分页方法；错误/未知/恢复不藏在About或Content details。两theme截图已实际目视：浅色desktop及浅深390无溢出/重复采样，焦点可见。typecheck/build/direct16及dev13/prod12完成；source四hash一致，未改shared/依赖/旧evidence/App。此前测试与fixture发现已修，未解决项只后继整体外层readability与真实环境验收，不声称本片完成MATURE06。
