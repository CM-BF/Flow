# 完整计划验收矩阵与滚动批次

核验时间：2026-10-06 02:05 UTC。基线 main/origin/main `e845eb069c594989117fadf380335650efef27a2`。本矩阵是 [FLOW-001](plan.md) 的要求追溯附件，不另建一份替代计划；唯一汇总状态仍在 [status](status.md)。完成定义保持原文，下面未完成项没有因 M1 通过而删减。

| ID / 原始要求 | 任务/依赖 | 验收与所需证据 | 当前事实与缺口 |
| --- | --- | --- | --- |
| REQ-01 FLOW001§1/6/12 连续多任务工作流 | M02 | 同一连续入口至少10任务，跨任务可读解释/不同待决策/原地证据，无需逐task切换；新消息不打断阅读；记录切换、重复问题、人工时间 | 现M1仅task下钻；M02已开工，未完成 |
| REQ-02 §7/8 Project/Workspace、动态计划 | G01，接M02/C02 | 项目授权边界，版本化新增/拆分/依赖更改，禁止循环，取消传播与失效决策/旧结果拒绝；故障后保留因果记录 | personal固定workspace、无依赖/版本；未完成 |
| REQ-03 §7/12 未知副作用和恢复 | C02正在执行 | 失联保留占用；实际结果核对、人工停止确认/副作用证据、不可变审计、显式新task retry；旧attempt不能复活；PG重启后审计仍在 | M1只有uncertain保护，无恢复入口；C02公共契约0046db3/中心实现中 |
| REQ-04 §5.3/12 A2A双向互操作 | P01正在执行 | 固定实际SDK/规范/对端，发现/auth/直接响应/长任务/补充输入/产物/取消；至少一侧官方SDK；重复、ACK丢失、重连/降级/大inline | 未完成；出站client不等于持久external binding，后续接runner/中心 |
| REQ-05 §5.3/12 MCP client | P01 | 固定规范、角色/transport/capability；tools/resources/prompts/elicitation权限进入业务决策；draft Tasks显式实验；runner持会话，Web关闭后继续 | 未完成；ACP依选定harness、AGUI/MCP server依真实需要，不要求所有候选 |
| REQ-06 §4/12 FLOW002-T05/T07 公平harness关键场景 | E01，接C02/插件接口 | 同底层模型/SDK版本比较原生与wrapper；Claude wrapper刷新400原因与合法来源；实际工程受控写改→测试→固定产物验证；恢复/取消/权限/资源差异记录 | Claude read-only M1与Pi小冒烟不能代替；R02 5/5预算耗尽，新模型实验须独立小预算，0模型准备可继续 |
| REQ-07 FLOW002-T08 上游模块实际复用 | E01 | 固定Hermes/T3/Paseo模块/许可证/归属，提取真正采用代码及测试、记录差异；选择不适用项给证据 | 已源码分析，尚无真实提取复用 |
| REQ-08 §9 Context原文/版本引用 | X01/context，接G01 | 目标/约束/验收/预算+固定版本引用和增量；原文可追回，来源更新使摘要/下游证据失效；按需tool schema，大结果工具侧筛选 | 现id/title只减UI传输，不等于LLM上下文减少；未完成 |
| REQ-09 §9 成本与预算账本 | E01/context，接usage registry | raw source/scope/session baseline、缓存读写unknown保留；规划/交接/解释/检索/压缩/重试/验证分类；按验收通过交付的总成本/成功率对照 | M1有累计usage去重与unknown；全分类/预算/公平成本对照未完成 |
| REQ-10 §9 KB hybrid检索 | K01，接项目权限/context | 来源导入/版本/权限/位置，FTS+vector，中文/代码标识符/精确事实/权限过滤各自质量集与引用准确性 | 未实现；不以向量能查到一次算完成 |
| REQ-11 §10 npm插件生命周期 | X01 | 版本/配置/能力/作用域，install/enable/disable/upgrade/remove；可信服务端与隔离第三方边界；真实工具/renderer/verifier示例 | 当前内建adapter seam存在；npm生命周期/隔离示例未完成 |
| REQ-12 §10 插件可替换/通用UI | X01+M02 | 客户端只触发公共命令，CLI等价；未知类型id/title+通用详情；唯一compression owner；明确状态迁移/恢复能力 | 未完成；不建设无需求插件市场 |
| REQ-13 §10 上下文插件兼容 | X01+E01 | 确认实际billion-context候选/固定版本，压缩→暂停/恢复/分叉、原文引用、附属存储与跨worker边界 | 项目身份待证据确认，未实测；名称不代表原生十亿窗口 |
| REQ-14 §8/12 多runner路由与所有权 | S01前的R03 | 独立runner能力/身份/预算路由，远端凭据归属，互斥session、失联/迟到、停机；真实一任务等决策另一任务可完成 | M1验证两runner争一task及uncertain，不等于完整能力路由；runner有效并发1 |
| REQ-15 §8.1/8.2 分层读取 | B01，接M02 | 同时按条数/块数/字节有界；超长正文/引用分页；详情范围/批量读取；权限校验；原文不静默摘要 | M1详情整项读取、events只有条数；未完整 |
| REQ-16 §8.2 缓存/快照与事件 | B01/M02 | workspace+权限+内容版本缓存，切换不清空全部，快照/订阅race与旧cursor无漏/去重；源事务乱序提交真实PG验证 | 现select清缓存；M02新全局feed不许把源bigserial当提交水位 |
| REQ-17 §8.3 交互性能 | B01+S01 | 缓存交互p95<=50ms、查询<=100ms、持久受理<=200ms作为待测初步目标；p95/p99样本量、字节、网络、数据规模/缓存并发分开报告 | LAB01/02是有界toy/诊断，不能替代产品SLO；未完成 |
| REQ-18 §8/12 超100持久会话 | S01，依赖G01/预算/恢复 | 128持久session，分别调节model/tool/DB并发；成功率/资源/连接/写量/延迟/故障；真模型负载独立预算 | 128observer/合成DOM不是agents容量；未完成 |
| REQ-19 §12/13 自托管部署和故障 | S01 | 一中心本机/远端runner部署文档、持久存储/权限/重启恢复/故障演练；浏览器/中心/runner断连承诺分开 | M1浏览器退出、queued中心重启已有证据；active/跨机恢复未完整 |
| REQ-20 §11 验证和证据链 | M02/G01/X01/S01 | 要求→产物版本→独立验证→合并版本可追溯；知识结论来源范围；不同任务可选verifier | M1 flow.text非空/contains已有；工程/知识/扩展验证未完整 |
| REQ-21 工程协作dashboard用户要求 | D03下一短项 | 结构化human摘要；首屏当前阶段/2–3项工作/下一交付/真正决策，历史折叠；细节可追溯；review实现target与metadata、main祖先关系分离 | D01/D02已展示14源；02:00用户实际页面仍工程段落+4个“无”决策，Goal Owner只读UX问题记录，非新approval |

| REQ-22 §1/5/7/11 自然语言目标到交付 | O01，接G01/M02/E01 | 目标→后台生成/修订版本化子任务与依赖→不同agents产出→独立验证循环→统一解释/用户决策→固定产物交付；复用harness，计划变更仅受限中心commands | 尚未完成；手动创建10个任务并聚合阅读只验证M02，不能替代最终编排 |

## 后续研究/实验输入（未实测）

- E01先0模型合成credential store probe：固定本地 wrapper 1.0.143 的subscription resolver文件优先于Keychain、refresh可能写回来源；检查调用链锁，临时假凭据/fake fetch测优先级/过期/并发轮换/持久化，绝不用健康检查名义刷新借用真实登录。新真实调用提交明确场景/数量/总预算给Goal Owner审定，不扩大封存R02额度，也不永久禁止全项目合法低成本实验。
- X01具体billion-context项目身份仍待确认；候选proxy/native形态和Pi包实际宿主不同，先确定包/版本/宿主，不以安装成功替代恢复/原文引用验证。
- K01先授权子集exact vector检索基线；[pgvector官方filtering](https://github.com/pgvector/pgvector#filtering)说明ANN可能因扫描后过滤不足k，先对照召回再决定ANN。

## 当前滚动调度

实际cap4：Goal Owner + Execution Lead + C02 runner_owner + P01 assignment_review；用户期望10，不重复探测/绕过。Lead公共契约/锁与M02。两worker交付即独立审查/修复/集成，释放位优先D03短项与G01动态计划；后续X01/K01/B01、R03/S01按已稳定接口并行。E01可先0模型认证/SDK/上游提取调查；需要新增真实模型时明确独立预算，不用R02额度重新试。

**持续执行**：完成→核查实际证据/验收→集成→下一ready项。阻塞→记录原因/owner/解除条件/绕行与其他独立工作。暂时无ready实现→有界研究或低成本实验，用证据改计划，不增加无意义复杂度，不降低原验收。所有feature仍各自独立worktree/status/review；此矩阵不替代owner状态。
