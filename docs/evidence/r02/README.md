# R02 证据与质量记录

Owner：runner_owner / gpt-6-astra。仅 R02 分支证据，不是主分支或系统级验收。

## 技能发现与实际应用

2026-10-06：按本地 find-skills 方法复用同 stack 已核验的发现结果（Node24/TypeScript/原生 Claude SDK）。已读 `/Users/citrine/.agents/skills/{find-skills,codebase-design,tdd,clean-code}/SKILL.md`；此前 skills.sh + skills CLI1.7.0 查 `claude agent sdk typescript`，候选 melodic-software 的 agent-sdk-development 只转介另一文档 skill，没有额外价值，未安装。codebase-design 用于把 SDK 和路径策略藏在 HarnessAdapter 后；TDD 使用已批准公开 HarnessAdapter + SDK 外部边界，不测试私有 helper；clean-code 检查生命周期、命名、错误路径、重复和职责。

固定 clean-code 来源 `sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`，本地 SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`，未重装。已批准 FLOW003/F00 与正式派工提供实现授权，brainstorming 方法不重复增加审批。

## 版本与官方依据

固定 `@anthropic-ai/claude-agent-sdk 0.3.290` 本地类型和当前官方 [permissions](https://code.claude.com/docs/en/agent-sdk/permissions)、[hooks](https://code.claude.com/docs/en/agent-sdk/hooks)、[sessions](https://code.claude.com/docs/en/agent-sdk/sessions)、[cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking) 已核对。canUseTool 不覆盖 autoallowed；所有工具用 PreToolUse gate。modelUsage 是含查询管线调用的 session 累计估算，恢复会带历史；不把 result.usage/total_cost 与 modelUsage 重复权威累计。单 prompt 取消使用 AbortController + close，native session 只承诺同 runner/host 明确 sessionId 恢复。

## 检查记录

| UTC | 范围 / 发现 | 动作 / 结果 | 剩余 |
| --- | --- | --- | --- |
| 2026-10-06 01:14 | 开工、隔离 worktree/分支、固定SDK和技能方法 | 冻结安装成功；R01并发快照修复合入，尚无 R02实现；真实 query 0/5 | 实现、模拟测试、有界真实验证、独立review |

## 真实调用预算

最多 5 次 query，每次 maxTurns<=4、maxBudgetUsd<=1、timeout<=90000ms。当前实际 0 次；任何失败也计数。原始 SDK transcript、stderr、账户/登录数据不写证据。模拟结果与真实结果分别记录；不运行旧的泄漏答案实验脚本。

## 模拟检查 — 2026-10-06 01:16 UTC

通过公开 createClaudeAdapter/HarnessAdapter 和注入 SDK 外部 seam 验证：私有快照、提示不泄露 verifier expected、只读配置、原始材料/未知路径/shell/禁工具拒绝、逐工具 ownership 拒绝、cancel/timeout 退出、已取消不启动、runtime decision 后重新 gate、恢复累计 usage unknown、重复 SDK result 样本不重复发送、success-shaped API error 不生成产物、turn-limit 保留实际可用用量。首轮 13/13 模拟测试；全分支 41/41 与类型检查通过。真实 query 仍 0/5。


## 真实证据 — 3/5 次，停止继续调用

原始结构化证据：[native-results.json](native-results.json)；手工执行器：[native.ts](../../../apps/runner/probes/native.ts)。SDK 0.3.290 / runtime 2.1.290 / Node v24.20.0，实际主模型 claude-sonnet-5-5，SDK modelUsage 也包含辅助 claude-haiku-4-5-20251001。每次上限均为 4 turns、USD1 SDK 预算、90000ms。随机值为本轮在专属 /tmp 新建的 96-bit 非秘密材料；首轮提示不含答案，verification.expected 不传 SDK。

| 调用 | 毫秒 | turns | 工具 / gate | 验证 | SDK估算USD |
| --- | --- | --- | --- | --- | --- |
| first | 7741 | 2 | 1 Read，PreToolUse实际执行1次，准许1次 | 保存产物精确等于未知随机值，flow.text1通过 | 0.0107518（新session） |
| resume | 3139 | 1 | 全工具禁用，gate0 | 不同attempt cwd下显式恢复同native session，输出同值 | 0.0158858（包含first历史） |
| control | 2652 | 1 | 全工具禁用，gate0 | 无历史新session返回UNKNOWN，没有随机值 | 0.0039970（新session） |

合计实际执行 13532ms；使用 3/5 次，剩余 2 次已明确交 Execution Lead 的 I01 完整中心/runner/CLI系统验收，本 owner 不再使用。按最新 session 累计估算加独立 control 为 USD0.0198828，不将 first 与 resume 的累计值直接相加。它不是账单，且不含 SDK 查询管线之外的 helper。保留逐 model input/output/cacheread/cachewrite/cost、sampleId、scope和 baseline；resume 上报 unknown，不能据此把历史作为本 task 新增成本。

实际 init 仍列出 cc-plugin-agents-md、cc-plugin-telemetry、cc-plugin-plugin-authoring 三个插件和 design/doctor/plugin-authoring 三个 skill；配置空 plugins/skills、关闭自动记忆和同步不等于移除组织管理资源。真正开放的模型工具仅第一轮 Read，恢复和对照均为空；实际 PreToolUse gate 已观察执行。不声称操作系统级沙箱或完全无环境资源。没有修改共享登录或打印凭据。

真实调用发生在本 R02 未提交实现工作树；随后补充了 gate 异常拒绝、人工 decision 超时、SDK拒绝数量、错误native session拒绝、普通入口manifest与回归。上述补充仅以模拟检查验证，未消耗额外真实预算；父任务必须在最终集成版本用剩余预算验证系统闭环。独立 adapter 小实验不代表中心集成已验收。

## 交付前 clean-code 与最终模拟检查 — 2026-10-06 01:23 UTC

检查命名、单一职责、Interface、异常传播、重复、无必要复杂度和行为测试。发现并修复：callback异常必须显式 deny 并 abort，不能把抛错交给 SDK 默认权限处理；人工等待必须服从 query deadline；resume返回错误session需在发引用前拒绝；未知价格不能冒充已知cost；公开入口不能要求用户编辑源码。去除测试中会被外层 rejects 掩盖的 callback 内断言，把 gate结果保存后从公开边界核对。

`pnpm check`：57/57（runner25、Claude19、manifest9、公共4）与 typecheck通过；`git diff --check`通过。权限拒绝、路径/symlink越界、cancel、ownership loss、timeout和decision异常证据来自模拟SDK seam，没有为它们启动付费调用。真实恢复证据只限同host已有session；跨机、并发容量、在途外部副作用回滚、操作系统沙箱、凭据包装器修复未验证。

普通启动见 [Runner README](../../../apps/runner/README.md)：默认fixture；仅显式设置 FLOW_CLAUDE_MATERIALS_FILE 才加载manifest启用Claude，未知字段/相对材料路径/超限配置被拒绝。清单与任务材料均不自动扫描Flow源码。

代码/模拟证据交付commit：`e4f12efbe1c2efdc4fd287dfe39a6e6949b4d1a2`。真实证据文件 SHA256：`5a5e8554ebb49535c0716e87857dcd7e71b2d5658bbb24b60ea1a7a3fafaa543`。16条本地文档链接检查通过；结构化真实记录逐项核对3次invoked/passed、turns和wall limits，未发现凭据标记。此后的记录更新不代表重复真实调用。

## 独立review与系统验证补充 — 2026-10-06 01:28 UTC

Execution Lead / gpt-6-astra对e4f12ef实现和a0336ca文档独立审查无blocking，Claude/configuration 28/28与typecheck通过。I01最终集成c08506b实际批准/取消2次通过，记录由Lead保存在integration/docs/evidence/i01/native-system.json，SHA256 `a7bb54d3b0ec9b2204846b5aaab6e50664493d5a4976299f7e46c7357ab71587`。本owner只读核对结构化结果，不自审自己的R02源码。总计5/5用完，不再调用；上文3次原始JSON不变，不能改成最终源码实测。Main未集成，环境残留资源/取消用量unknown/非OS沙箱/同host恢复限制保持。
