# WPF-QUEUE00 技能与质量

2026-10-06 04:44 UTC。按find-skills识别TypeScript public projection校验/直接行为测试，本地技能充分，不联网重复安装。读取find-skills、clean-code、codebase-design、assistant-ui、webapp-testing；assistant-ui/API没有变更，沿用本地固定0.15.23/core0.3.22语义，不挂默认queue adapter（运行中普通send可能默认steer）。本片不改UI/样式，不新增浏览器测试基建。

固定来源：clean-code为sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；assistant-ui为139674dc888ee076982b6726e8e6f5d0fe0b5f67。路径均/Users/citrine/.agents/skills/<skill>/SKILL.md。

- find-skills SHA256 c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f
- clean-code SHA256 3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317
- codebase-design SHA256 2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2
- assistant-ui SHA256 20bd24ab58c8d281b329e1df34655c8a6dc0cd56d8a087aff252b37025c6937c
- webapp-testing SHA256 51b7349e77ec63b7744a6f63647e7566a0b4d2e301121cc10e8c2113af6556a2

首段clean-code：能力读取与实际发送支持应分开；现有深projection接口足以测试，无需新抽象。发现原错误提示将queue true后台归因成connection不支持，计划仅改为本Web版本未提供。保留所有其它strict校验；先补失败测试，再落两行产品修复。
