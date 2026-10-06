# 技能与 clean-code

2026-10-06 11:03:55 UTC：沿本地优先find-skills，已读brainstorming（采用现成已获批设计，不重复审批）、assistant-ui、codebase-design、clean-code、webapp-testing，并采用vercel-react-best-practices外部store稳定snapshot原则；固定本地hash见[skills](skills.json)。无安装新skill。assistant-ui官方llms/attachment文档已在前置研究读取，实际接口以已装0.15.23/core0.3.22为准。clean-code本地来源沿sickn33/agentic-awesome-skills固定全局基线。

开工clean-code：Controller负责绑定与状态；recovery负责有限持久元信息；adapter只翻译官方attachment生命周期；Picker只展示与触发。避免复制公共schema/ACK/HTTP、无第二权限/registry。此时仅计划，无产品检查；已核独立tree/branch/base/clean与liveclaim。后继每段/约30min/交付复核错误收敛、generation、cache与真实行为。
