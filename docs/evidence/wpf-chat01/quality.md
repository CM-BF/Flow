# WPF-CHAT01 技能与clean-code

2026-10-06 03:36 UTC，gpt-6-astra ultra。按find-skills识别React/assistant-ui ExternalStoreRuntime/Typed conversation projection/outbox幂等与Playwright；本地已有匹配，优先使用，没有重复安装。已读assistant-ui及architecture引用、codebase-design、clean-code、webapp-testing，沿用同session已读React性能技能。runtime sibling未本地安装，不安装无关包；以本地已安装core0.3.22/react0.15.23实际源码和[官方索引](https://www.assistant-ui.com/llms.txt)补核API（03:36读取）。

| Skill | 本地来源 | SKILL SHA256 |
| --- | --- | --- |
| find-skills | /Users/citrine/.agents/skills/find-skills/SKILL.md | c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f |
| assistant-ui | /Users/citrine/.agents/skills/assistant-ui/SKILL.md | 20bd24ab58c8d281b329e1df34655c8a6dc0cd56d8a087aff252b37025c6937c |
| codebase-design | /Users/citrine/.agents/skills/codebase-design/SKILL.md | 2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2 |
| clean-code | /Users/citrine/.agents/skills/clean-code/SKILL.md | 3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317 |
| vercel-react-best-practices | /Users/citrine/.agents/skills/vercel-react-best-practices/SKILL.md | 71ed7794962fa6e803ee83030517b5b93a9f70fbfeb431ec4535c5480a8d8355 |
| webapp-testing | /Users/citrine/.agents/skills/webapp-testing/SKILL.md | 51b7349e77ec63b7744a6f63647e7566a0b4d2e301121cc10e8c2113af6556a2 |

clean-code固定安装来源sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；assistant-ui固定来源139674dc888ee076982b6726e8e6f5d0fe0b5f67，与前批一致不重装。代码设计应用：projection封装公共读取/cursor/刷新，outbox封装冻结identity/payload/ACK未知，消息转换只读权威typed回复；不把网络分支堆App，不造第二HTTP client。React使用稳定快照与窄订阅；运行中暂停观察独立于command lifecycle；浏览器验收采用已有Node Playwright基础设施、动态端口，SSE不用networkidle，fixture与真实模型分开。

03:36 UTC首段clean-code：明确旧TaskThread是单任务适配，持续聊天新模块而非把所有timeline伪映正文；发现官方运行中默认steer与草稿异步恢复限制，设计独立outbox避免覆盖新输入。共享输入冲突只报Lead，未越scope编辑。当前只写计划/证据，无产品检查结论。后续每段/约30分钟安全点/交付记录实际发现与修复。
