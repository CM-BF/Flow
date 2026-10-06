# SVC04 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 10:55:04 UTC；main源码接收仍41315b |
| 任务层级 | 子task |
| 所属大task | [FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md) |
| co-lead | Execution Lead / astra_ultra_execution_lead |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | runner_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-artifact-release |
| Branch | codex/web-artifact-release |
| 工作基线 / HEAD | 4391bbf9f1785212d098ef6aa1c01a0320a003d3 / a2386f0575a961e5bf52fb9a8b152d587d94dc73 |
| 工作树dirty状态 | 实现已提交并推送；仅批准metadata收口 |
| 工作分支状态 | in-progress |
| 检查状态 | PASSED a2386f0575a961e5bf52fb9a8b152d587d94dc73；15个不同Node行为 + 5阶段真实Chrome观察；JS语法通过，详见manifest |
| 已集成main状态 / HEAD | 已集成 41315b033deb0b1953484359b686c0b228997367；实现祖先/范围零diff核对，个人服务未变 |
| 实现目标 | a2386f0575a961e5bf52fb9a8b152d587d94dc73 |
| 实现范围 | tools/personal-preview/README.md, tools/personal-preview/cli.mjs, tools/personal-preview/preview.mjs, tools/personal-preview/preview.test.mjs, tools/personal-preview/static-web.mjs, tools/personal-preview/web-artifact.mjs, tools/personal-preview/web-artifact.test.mjs, tools/personal-preview/web-release.mjs, tools/personal-preview/web-release.test.mjs, docs/evidence/svc04/browser-fixture.mjs |
| 阶段 | M2 |
| 本片段交付阶段 | delivered |
| 优先级 | 1 |
| 当前产出 | 个人网页已独立更新，后台与执行器持续运行，旧页面资源仍保留。 |
| 下一可用交付 | 本片段已交付。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，APPROVED a2386f0575a961e5bf52fb9a8b152d587d94dc73 |
| 领取 | 7c13c1bb-6d94-424d-bfdc-d83406ff73c4 v2；仅plan/evidence，tools已停写移出；[receipt](../../docs/evidence/svc04/main-amend-receipt.json) |
| 架构影响 | Web release指针、精确资产与有界等待；兼容记录绑定实际组合，center/runner生命周期不变。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| SVC04-01 | completed | runner_owner | [Interface](../../docs/evidence/svc04/interface.md)，12literal已领 |
| SVC04-02 | completed | runner_owner | 固定命名空间/版本CAS/精确资源/保留预算/结构化组合声明；[manifest](../../docs/evidence/svc04/manifest.json) |
| SVC04-03 | completed | runner_owner | 15不同Node行为；真实PG后台任务持续；Chrome5阶段/58个JS请求全200，首次503保留 |
| SVC04-04 | completed | runner_owner / Lead | Execution Lead独立APPROVED并进入main；[receipt](../../docs/evidence/svc04/main-receipt.json) |
| SVC04-05 | completed | runner_owner / Lead | [实际发布](../../docs/evidence/svc04/personal-release.md)，Web v2，后台不变 |

[交付证据](../../docs/evidence/svc04/README.md)与[manifest](../../docs/evidence/svc04/manifest.json)为本分支事实。初次Chrome冷启动4个JS请求503；有界4 active/32 waiting修复后，发布及回退后的旧tab延迟资源均可读取。原始red保留；未保存PNG不称有截图文件。

限制：兼容声明仅对实际测试的合成Web/backend组合有效；个人安装/产品Web兼容与首次切换后继单独验证。保留最多3产物/192MiB，无自动TTL/删除；unknown需显式核对。未验证断电、公网生产、OS不可变或provider。个人服务/用户tab无操作，0provider；本轮所有自有fixture进程和随机库正常清理。

预审读取竞态已在最终实现修复：版本读取进入同一串行观察段；准入覆盖读取和响应，取消不提前释放仍在读的工作。新增1例有确定性red→green；最终2/2含原HTTP例重叠，未重跑PG/浏览器。Execution Lead独立只读复审APPROVED，无未解决P1/P2；未重跑检查。源码已停写，main已接收；仅保留计划/证据范围供下一实际兼容候选，工具源码停写移出。

下一实际交付明确为当前产品Web artifact与个人已运行b1c2e39837c2208e6fc2c59a80e16797f26448b5 backend的0provider读取/发送/恢复/协商兼容证据及可看发布候选。合成fixture声明不能签该真实组合。本次未读取或操作个人服务，未发布/回退网页；实际窗口另行安排。

## 实际个人发布

2026-10-06 10:55:04 UTC：经co-lead转达GO完整Web-only授权，已完成真实bootstrap→publish，详见[发布证据](../../docs/evidence/svc04/personal-release.md)。旧文中“个人未部署”是原实现检查的历史范围，不代表现态。当前source8d8网页artifact caa1，后台b1c/maintenance accepting v12/4成功task；0模型/用户tab reload。工具实现a238未改，不扩大其独审；RELEASE01兼容证据另以7805批准固定输入为依据。发布操作结束，不再采样服务。
