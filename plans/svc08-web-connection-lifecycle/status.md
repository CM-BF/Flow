# SVC08 状态

| 字段 | 记录 |
| --- | --- |
| 任务 | SVC08 |
| 所属大task | [FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md) |
| co-lead | Execution Lead |
| Owner / model | native_center_owner / gpt-6-astra |
| 更新时间 | 2026-10-07 04:05:58 UTC |
| 任务开工时间 | 2026-10-07T03:03:21.259Z |
| 任务完成时间 | NOT_COMPLETED |
| 任务时间来源 | 本owner以当次fresh ledger时间记录只读界定段已实际开始；03:06:09.781Z take后进入实施，见take-receipt；本片限定验收由独审+main已接收满足，完成时为owner逐hash确认main回执的实际UTC 2026-10-07T03:17:28.292Z；原修复片段于该时完成。部署候选后继实际开始2026-10-07T03:29:12.051Z（fresh ledger观察+owner当次只读开工），新take03:29:21.929Z后只写docs；个人部署/根因未完成 |
| 阶段 | M2 |
| 优先级 | 1 |
| 本片段交付阶段 | review |
| 当前产出 | 同锁替换模块已进入主线；Web独立固定来源选择已完成局部验证，中心和runner来源保持不变，正在交独立审查。 |
| 下一可用交付 | 审查Web专用来源选择；之后仍需合法个人来源产物和真实运行验证，个人服务尚未切换。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-web-connection-lifecycle |
| Branch | codex/personal-web-connection-lifecycle |
| Base | a2e7803161ffb7e2158eaf3c13531448d2a777b0；本片四产品preimage固定0967607a9a9c2435282ca7fbba23b6e96df096c4，两只读叶子input-only26d1be6c |
| Head | bad019d9691499bed69ae46b6c5d23944709cfe3；后续仅自身证据和metadata |
| 工作树dirty状态 | 仅自身证据与metadata；最终交付核clean |
| 工作分支状态 | review；同锁替换局部实现已固定待独审 |
| 实现目标 | bad019d9691499bed69ae46b6c5d23944709cfe3 |
| 实现范围 | tools/personal-preview/preview.mjs, tools/personal-preview/preview.test.mjs, tools/personal-preview/backend-release/host.mjs, tools/personal-preview/README.md |
| Claim | ba1ff3b2-d830-4acf-b84f-be8df92c9c95 v3 active；03:57:24.093Z仅增加host.mjs，原四产品+自身plan/evidence保持；原f578产品claim已released |
| Review | NOT_STARTED 当前Web-only selector；前片52d3独立APPROVED_LIMITED_SAME_LOCK_WEB_HOST_REPLACEMENT并main2f18，原ad77/086批准各自保持，[唯一review](review.md) |
| 检查状态 | 当前9不同=5新+4旧直接，8/8→3/3→3/3，2282ms/raw6422B/三组absent双EOF；0PG/Chrome/provider/真实artifact/服务。原52d3十不同/原红保留，[本片运行](../../docs/evidence/svc08/web-host-selection/run.json) |
| 已集成 main 状态 | 当前bad019 selector NOT_INTEGRATED；前片52d3四产品INTEGRATED 2f18dfe92f795e566f7779d67ebea2f556254e2a，[原样独审与逐hash回执](../../docs/evidence/svc08/replace-host/main-receipt.json)；历史086/main158保持 |
| 架构影响 | 候选serviceRuntime仅为Web选择独立artifact，pendingWebHost与同journal先行；后台artifact/身份与原授权保持。main仍是前片同锁模块；Execution Lead在selector接收后同步受管宿主基线；无新产物格式/发布FSM/监督器 |
| 看板 | Lead确认main8c已登记SVC08 source184；实际新registry载入待ACCESS安全点，不冒已载入 |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| SVC08-01 | completed | native_center_owner | [Interface](../../docs/evidence/svc08/interface.md)、[take](../../docs/evidence/svc08/take-receipt.json) |
| SVC08-02 | completed | native_center_owner | [分轮运行](../../docs/evidence/svc08/run.json)原失败/收尾保持 |
| SVC08-03 | completed | native_center_owner | 086ba13d；修后1/1，[原证据及边界](../../docs/evidence/svc08/README.md) |
| SVC08-04 | completed | native_center_owner | 独立批准+固定main接收；原测试未重跑 |
| SVC08-05 | completed | native_center_owner | [部署候选](../../docs/evidence/svc08/deployment-candidate/candidate.md) / [retained3](../../docs/evidence/svc08/deployment-candidate/retained-three.md)，文档已独审，0个人执行 |
| SVC08-06 | completed | native_center_owner | 52d3独立限定批准、main2f18逐字接收，10不同分轮原证据保持 |
| SVC08-07 | in-progress | native_center_owner | Web-only selector bad019，9不同分轮局部通过，待唯一独审/main |
| SVC08-08 | pending | native_center_owner | 合法Flow来源真实宿主artifact、个人部署/后续观察未完成；retained3仍设计后继 |

## 等待记录

| ID | 开始UTC | 结束UTC | 类别 | 原因与解除条件 | 来源 |
| --- | --- | --- | --- | --- | --- |
| SVC08-W01 | 2026-10-07T03:13:31.000Z | 2026-10-07T03:15:08.399Z | 审查 | 固定输入交唯一独审，已获限定批准 | independent-review.json |
| SVC08-W02 | 2026-10-07T03:15:08.399Z | 2026-10-07T03:17:28.292Z | 其他 | main回执已逐hash确认；本片完成 | main-receipt.json |
| SVC08-W03 | 2026-10-07T03:38:17.937Z | 2026-10-07T03:39:37.692Z | 审查 | 新部署文档已获限定批准 | replace-host/candidate-independent-review.json |

03:11:26.520536Z修复轮监督报告已完成，本队local已归还；0新测试/个人操作。

## 后继准备范围

原docs后继开始03:29:12.051Z；历史修复片段实际完成03:17:28.292Z与main158保持。文档独审已收，03:40:29.530Z取得四产品写权后实施；03:48:05.206Z至03:51:16.825Z进行了三轮局部验证，原红和清理保留。03:53:28.447Z仅读取个人两份metadata的repository/source/artifact存在性与文件hash，没有输出凭据/正文、没有服务探测或操作。实际部署与退役仍NOT_RUN。

2026-10-07T03:40:29.530Z：原SVC06已停写移出四路径，fresh amend v2成功后实施；两只读依赖受控输入26d1be6c，无领域编辑。当前局部0PG验证准备，实际个人部署仍NOT_RUN。

本片作者固定交付准备时间：2026-10-07T03:54:21.236915+00:00（实际证据封包时钟，不冒独审/main/个人部署时间）。当前实现source固定52d3，claim v2保留待审。原root cause及长期稳定性仍未知。

2026-10-07T03:57:24.093Z：v3成功amend后实际开始Web-only selector实施。新局部从first-reservation记录的实际开工至04:04:03.717Z最后结果；三轮累计2282ms，独审/主线/个人部署时间不得用此替代。已于该安全点实际归还本队local，后续仅封包。个人固定源仍需独立artifact，不把e5的backend-release来源改称Flow。
