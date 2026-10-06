# WPF-I01 技能与 clean-code

2026-10-06 03:00 UTC。文档初始化与固定源接缝检查，owner workspace_panels_owner / gpt-6-astra ultra。按 find-skills 方法识别 TypeScript/React host bridge、官方 Thread scope、局部状态生命周期与产品浏览器验收；本地已匹配，使用本 session 已读技能，并重新读取本段相关规则。未重复安装、未联网更新。

| Skill | 本地路径 / 固定来源或本次 SKILL SHA256 | 本段实际应用 |
| --- | --- | --- |
| find-skills | /Users/citrine/.agents/skills/find-skills/SKILL.md / c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f | 本地优先，匹配 React/生命周期/测试，无缺口不搜索安装 |
| codebase-design | /Users/citrine/.agents/skills/codebase-design/SKILL.md / 2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2 | 窄 plugin-integration interface 封装资源核验/epoch/store，App 仅组合，不再堆 bridge 分支 |
| clean-code | /Users/citrine/.agents/skills/clean-code/SKILL.md；sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；SHA256 3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317 | 单一状态归属、错误显式传播、未支持能力明确失败；不以属性标记替代功能 |
| assistant-ui | /Users/citrine/.agents/skills/assistant-ui/SKILL.md；assistant-ui/skills@139674dc888ee076982b6726e8e6f5d0fe0b5f67；SHA256 20bd24ab58c8d281b329e1df34655c8a6dc0cd56d8a087aff252b37025c6937c | 官方 Thread 保留；真实 message runtime scope 放 ActionBar，外部 TaskProjection 仍是任务事实源 |
| ai-elements | /Users/citrine/.agents/skills/ai-elements/SKILL.md；vercel/ai-elements@6a9d5b1822ffb10bba4bd97175f01edd7d8651cd；SHA256 6e1697f6728f131cfbbb6b53543438921ce11faafcc4d5e0cc361b1643324e71 | 沿用已审 Terminal/FileTree，不冒充 PTY/任意 fs；不改未领取来源文件 |
| vercel-react-best-practices | /Users/citrine/.agents/skills/vercel-react-best-practices/SKILL.md / 71ed7794962fa6e803ee83030517b5b93a9f70fbfeb431ec4535c5480a8d8355 | 窄稳定订阅、连接生命周期、惰性激活、不因 context 对象变化重挂局部状态 |
| webapp-testing | /Users/citrine/.agents/skills/webapp-testing/SKILL.md / 51b7349e77ec63b7744a6f63647e7566a0b4d2e301121cc10e8c2113af6556a2 | 规划实际 DOM/键盘/双主题检查；优先既有本树 Node Playwright 与动态端口，持续 SSE 不用 networkidle 作为就绪条件 |

## Clean-code 安全停点

03:00 UTC：核验领取、唯一 source、TODO 稳定 IDs 与依赖事实。实际发现：旧 App 的 chat.message.actions 位于 task 状态条、sidebar.item.actions 位于整 nav、composer 标记在 Input；接缝方案把它们放回真实局部对象。PH-R4 已交 P01 修复，I01 不重复写 host。明确主题/原生 tabs/草稿单一 authority，避免副本和随意新协议。此段未改实现，尚不能声称错误隔离或性能验证通过。

文档检查：本目录及 plan 三件套本地链接、receipt JSON、scope 与稳定 TODO 对应、Git diff whitespace 检查；产品类型/单元/浏览器/真实中心均未执行。后续每工作段、约 30 分钟安全停点、交付与合入前重新记录实际发现，不建后台定时任务。

03:04 UTC 文档 clean-code：再次核 live I01 claim v1 active 与本树 clean，补清同 host 局部缓存与跨 connection lifetime 的不同归属。实际消除方案歧义：只换 host prop 不够，必须卸载整棵 plugin view（含 hidden visited）并同步失效旧 ports。上游 P01 只读复验与本 I01 产品验收分开；本段只查文档链接/diff，不以 P01 测试替代 I01 检查。
