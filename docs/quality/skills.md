# M1 技能发现与质量基线

记录日期：2026-10-05。维护者：Execution Lead（Astra Ultra）。本记录是工程方法与来源记录，不是应用验收。

## 固定 clean-code 版本

- 用户指定来源：https://github.com/sickn33/agentic-awesome-skills
- 安装命令：`npx --yes skills add https://github.com/sickn33/agentic-awesome-skills --skill clean-code --global --yes`。默认 npm 临时缓存缺少 yaml，改用 `npm_config_cache=/tmp/flow-skills-npm-cache` 完成安装，未改动旧缓存。
- 来源 HEAD：`bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`；来源路径：`skills/clean-code/SKILL.md`。
- 安装路径：`/Users/citrine/.agents/skills/clean-code/SKILL.md`；SHA-256：`3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`；installer folder hash：`076ec8b233256698f9a1ecd43111dd86a2d011a1`。
- 内容已读。采用意图明确命名、单一职责、显式错误、少参数、行为测试与去除重复的方法；长度启发式服务于可读性，不制造无价值转发层。来源内的授权或提问规则不覆盖用户已授权范围与项目规则。
- 本轮不自动升级或重复安装。每个工作段完成、约 30 分钟连续开发的安全停点、feature 交付和合并前记录实际检查。

## 开工前发现

| 工作 / Stack | 发现与选择 | 实际应用 |
| --- | --- | --- |
| F00 架构、契约、TypeScript workspace | 已读本地 find-skills；优先本地 brainstorming、codebase-design；skills.sh 的 codebase-design / tdd 与本地来源一致 | 按用户已批准 FLOW-003 设计开工；用小 Interface 隐藏事务/执行细节，按真实变化放置 Seam，不新增完整工作流引擎 |
| F00 契约与后续集成测试 | 已读本地 tdd 及 tests.md / mocking.md；Node/TypeScript 搜索结果仅作补充 | 以已批准中心 API/client、runner/harness 契约和 M1 用户路径为测试 Seam；每次一个行为先失败再实现，不测试私有函数 |
| 所有工程代码 | 按指定 CLI 安装并读取 clean-code 固定版本 | 每段开发/交付/合并及约 30 分钟安全停点检查，记录发现及处理 |
| PostgreSQL / pg-boss 或 Temporal | 只读研究 agent 按 find-skills 查找并核对官方资料，结果在 F00 选择记录补充 | 比较持久受理、人工等待、取消、重启及重复投递；正式实现前固定唯一调度方案 |

本地技能位于 `/Users/citrine/.agents/skills/`。具体 feature 在自己的证据目录补充技能读取与应用，不并发编辑本文件。

## 质量检查记录

| 时间 | 范围 | 发现与处理 | 未解决项 |
| --- | --- | --- | --- |
| 2026-10-05 开工 | AGENTS、派工计划、技能基线 | 对齐正式开工授权，保留 Goal Owner / Execution Lead 分工；确认尚无应用代码，外部技能不能扩大授权 | F00 实现与技术验证待执行 |

## 指定 UI skills（安装完成，W01 实际接入待验证）

- assistant-ui：按用户指定 `npx skills add https://github.com/assistant-ui/skills --skill assistant-ui` 加 `--global --yes` 安装；来源 commit `139674dc888ee076982b6726e8e6f5d0fe0b5f67`；本地 `/Users/citrine/.agents/skills/assistant-ui/SKILL.md`，SHA-256 `20bd24ab58c8d281b329e1df34655c8a6dc0cd56d8a087aff252b37025c6937c`。已读 SKILL 与 architecture reference。选择 ExternalStoreRuntime 接收中心快照/事件并通过回调发命令，不引入第二套 authoritative messages。实施前核对官方 llms.txt 和安装版本的类型。
- ai-elements：按用户指定 `npx skills add https://github.com/vercel/ai-elements --skill ai-elements` 加 `--global --yes` 安装；来源 commit `6a9d5b1822ffb10bba4bd97175f01edd7d8651cd`；本地 `/Users/citrine/.agents/skills/ai-elements/SKILL.md`，SHA-256 `6e1697f6728f131cfbbb6b53543438921ce11faafcc4d5e0cc361b1643324e71`。已读 SKILL。只按实际依赖复用展示/工具/产物组件；不因 skill 的 Next.js/AI Gateway 示例改变已批准 Vite/自托管架构，不新增云凭据要求。
- 两项对 Codex 安装均成功；installer 对无关 PromptScript 的 global 安装提示不支持，不影响本任务。安装不等于功能实现；W01 必须记录实际组件使用、兼容性和两主题验收。

## F00 工作段检查

2026-10-06 00:50 UTC：Execution Lead 检查 contracts/client/probe；中心与runner owners独立只读复核公共Interface。已修复分页末游标与最新水位歧义、终态重报确认、批量字节上限、usage基线/唯一入账口径/成本类型、指定verifier摘要，以及SSE跨块CRLF解析。命名与职责检查通过；stream parser保留单一状态循环，未为函数长度拆出无价值转发层。

验证范围：Node24.20.0下类型检查、4个contracts/client行为测试；真实PostgreSQL16.13 + pg-boss12.37.0的事务回滚、队列进程重启、稳定ID重试和完成。人工等待、取消、失联、应用重启、UI及真实模型验收仍待C01/R01/I01/R02，不由短probe代替。
