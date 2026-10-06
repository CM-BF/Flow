# R05B 实施证据

B1仅中心普通task/final。来源输入为R05文档8a148c5f4288d3f3075bf4bde78504b5214c87f3与Mika固定schema/interface b88016914c1e880669db7cb39b73f19980489a2e；本机Codex0.154.0。无app-server/auth/provider运行。

技能发现：按find-skills先检查本地，选用 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、`codebase-design/SKILL.md`、`clean-code/SKILL.md`；brainstorming用于已有授权架构片的职责/取舍核查，用户授权普通实现不重复审批。clean-code来源沿[全局固定基线](../../quality/skills.md)：sickn33/agentic-awesome-skills bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，文件SHA256 3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317，不重复安装。

实际方法：把中心来源/身份规则收敛到小静态Module；通过严格schema和事务Interface测试，旧Claude codec作为稳定兼容面。无任意string注册、第二调度器、额外runtime loop。

| 时间 | 检查范围 | 发现/处理 | 未解决 |
| --- | --- | --- | --- |
| 2026-10-06 09:08 UTC | 初始设计/读取 | runner schema的extend与会话settings是实际消费者接缝；已纳入精确范围。默认目录需SQL前置Claude过滤 | 实现/测试/独审未完成 |

依赖bootstrap：Node v24.20.0 / pnpm9.15.4，独立WT执行`pnpm install --offline --frozen-lockfile`退出0，540本地复用、0下载，manifest/lock无改动。本WT的workspace解析不指向main合同。

2026-10-06 09:13 UTC：首接口与中心代码完成，4个显式文件共11/11（contracts assistant/profile/harnesses与server native policy），tsc退出0。此时PG迁移与旧消费者未验，shared server mount尚未接入。clean-code复核：身份规则只由静态policy维护；Claude保既有有效会话与identity语义，来源版本统一静态识别，Codex另新增精确profile绑定；profile目录在SQL前置过滤；已用source窄化旧会话测试，原断言保留。

## 固定实现检查

Node24.20.0 / pnpm9.15.4 / Vitest4.0.18；真实PG16.13。以下均为显式选择，15个文件136个不同检查首次完成，随后补充直接preview消费者21项，合计16文件157个不同检查；早期重复运行不累计为新增数量。

| 命令（均在本WT以Node24的PATH） | 实际结果 | 范围 |
| --- | --- | --- |
| `pnpm exec vitest run packages/contracts/src/contracts.test.ts packages/contracts/src/assistant.test.ts packages/contracts/src/execution-profiles.test.ts packages/contracts/src/harnesses.test.ts apps/server/src/native-harness-policy.test.ts` | 5文件13/13，0.73s | 严格合同/旧canonical/身份与usage |
| `FLOW_R05B_EVIDENCE=docs/evidence/r05b/pg-results.json pnpm exec vitest run apps/server/src/assistant/native-harness.test.ts` | 1文件11/11，8.60s | 真实1..24→25旧数据升级/事务/namespace/目录/字节 |
| `pnpm exec vitest run apps/runner/src/claude.test.ts apps/runner/src/execution-profiles.test.ts apps/runner/src/native-harness.test.ts apps/runner/src/configuration.test.ts packages/client/src/execution-profiles.test.ts` | 5文件66/66，3.47s | Claude产出与配置/pin/启动直接消费者 |
| `pnpm exec vitest run apps/server/src/assistant/assistant.test.ts apps/server/src/execution-profiles/execution-profiles.test.ts apps/server/src/execution-profiles/steering-admission.test.ts apps/server/src/conversations/conversations.test.ts` | 4文件46/46，35.59s | 真实中心升级启动、ACK/lease/失败、旧会话和profile协商 |
| `pnpm exec vitest run apps/server/src/assistant/preview.test.ts` | 1文件21/21，2.01s | 原正文lazy/detail、Unicode、篡改和settings投影 |
| `pnpm exec tsc --noEmit` / `git diff --check` | exit0 | 全workspace类型与patch格式，不冒称全库行为测试 |

旧中心组合使用F01授权固定输入5365acb8b9bde4889f83715aa650bc6aed155c9b（本树cherry-pick f01a2d6a840dd372bf4a98b39946b8af7727866f）：仅`apps/server/src/index.ts`两行，在024之后、任何worker/scheduler/scan之前调用025。R05B没有手工修改该共享路径。

PG测试使用独立随机数据库和系统动态端口，正常关闭自己server/pool后DROP自己DB，`pg-results.json.databaseRemoved=true`。旧assistant既有消费者的固定flow_chat02仍由原advisory保护，不停止其他服务。

[字节与升级样本](pg-results.json)：实际旧final/profile/detail rows的升级前后摘要相等；1MiB正文的轻列表725B、正文预览4000B。单机单样本，未做吞吐/容量或整体更快推断。025增加session evidence局部索引，使final admission无需扫描无关artifact/detail正文；每次最多读取2条session记录判定唯一来源。25号升级耗时只是此空闲小库记录，不代表生产迁移时限。

## Clean-code / 结构复核（2026-10-06 09:20 UTC）

- 保持Claude codec/ID，新增有限严格Codex分支；native Source Policy单处承担来源认可与身份复算，写入和读回共用。不创建string注册框架或第二调度器。
- requested、observedThreadConfiguration、actualExecution分层，actual仅unknown/null；access:none不声称原生无工具。没有USD/maxTurns假限。
- 新写final对Claude v2与Codex固定版本均核单一session event。旧v1 artifact会话fallback保持，未改变lease/outbox/terminal语义。
- 发现native-source读回复算可能把损坏身份变成旧会话500；已把identity/settings错误统一为409并由会话投影转invalid-result，原preview测试21/21保护。不吞其他运行错误。
- 发现新增session证据查询原无索引；025纳入精确task/attempt且kind=session的部分索引。正常cleanup与JSON/UTF-8上限明确。
- 剩余边界：仅PG/注入协议验证；没有真实Codex app-server/provider/auth、生产无工具保证、Codex会话或Web目录opt-in。共享client/public exports及native descriptor下一消费片由Lead管理。

最终settings损坏补充：显式 `pnpm exec vitest run apps/server/src/assistant/native-harness.test.ts -t 'rejects unknown sources'` 选择1/11，1通过、10未选择，3.37s；不是11通过，也不重复累计到157。preview原fixture会写B03固定证据路径，本次运行生成文件已保留至R05B的preview-cleanup/resource.json，并把本树B03两文件恢复到已知测试前HEAD（此前clean），不提交其他owner证据。
