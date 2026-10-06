# SVC04 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 10:16:43 UTC |
| 任务层级 | 子task |
| 所属大task | [FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md) |
| co-lead | Execution Lead / astra_ultra_execution_lead |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | runner_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-artifact-release |
| Branch | codex/web-artifact-release |
| 工作基线 / HEAD | 4391bbf9f1785212d098ef6aa1c01a0320a003d3 / a2386f0575a961e5bf52fb9a8b152d587d94dc73 |
| 工作树dirty状态 | 实现已提交并推送；仅交付metadata收口 |
| 工作分支状态 | in-progress |
| 检查状态 | PASSED a2386f0575a961e5bf52fb9a8b152d587d94dc73；15个不同Node行为 + 5阶段真实Chrome观察；JS语法通过，详见manifest |
| 已集成main状态 / HEAD | 本片未集成；观察基线4391bbf9f1785212d098ef6aa1c01a0320a003d3 |
| 实现目标 | a2386f0575a961e5bf52fb9a8b152d587d94dc73 |
| 实现范围 | tools/personal-preview/README.md, tools/personal-preview/cli.mjs, tools/personal-preview/preview.mjs, tools/personal-preview/preview.test.mjs, tools/personal-preview/static-web.mjs, tools/personal-preview/web-artifact.mjs, tools/personal-preview/web-artifact.test.mjs, tools/personal-preview/web-release.mjs, tools/personal-preview/web-release.test.mjs, docs/evidence/svc04/browser-fixture.mjs |
| 阶段 | M2 |
| 本片段交付阶段 | review |
| 优先级 | 1 |
| 当前产出 | 独立更新网页时后台任务持续，旧页面仍可加载保留资源。 |
| 下一可用交付 | 独立审查后接入主线，个人安装切换另行验证。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |
| 领取 | 7c13c1bb-6d94-424d-bfdc-d83406ff73c4 v1；[receipt](../../docs/evidence/svc04/claim-receipt.json) |
| 架构影响 | Web release指针、精确资产与有界等待；兼容记录绑定实际组合，center/runner生命周期不变。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| SVC04-01 | completed | runner_owner | [Interface](../../docs/evidence/svc04/interface.md)，12literal已领 |
| SVC04-02 | completed | runner_owner | 固定命名空间/版本CAS/精确资源/保留预算/结构化组合声明；[manifest](../../docs/evidence/svc04/manifest.json) |
| SVC04-03 | completed | runner_owner | 15不同Node行为；真实PG后台任务持续；Chrome5阶段/58个JS请求全200，首次503保留 |
| SVC04-04 | in-progress | runner_owner / Lead | 实现固定、证据绑定；独立review NOT_STARTED，main未集成 |
| SVC04-05 | pending | Lead / operator | 不在本轮执行个人部署 |

[交付证据](../../docs/evidence/svc04/README.md)与[manifest](../../docs/evidence/svc04/manifest.json)为本分支事实。初次Chrome冷启动4个JS请求503；有界4 active/32 waiting修复后，发布及回退后的旧tab延迟资源均可读取。原始red保留；未保存PNG不称有截图文件。

限制：兼容声明仅对实际测试的合成Web/backend组合有效；个人安装/产品Web兼容与首次切换后继单独验证。保留最多3产物/192MiB，无自动TTL/删除；unknown需显式核对。未验证断电、公网生产、OS不可变或provider。个人服务/用户tab无操作，0provider；本轮所有自有fixture进程和随机库正常清理。

预审读取竞态已在最终实现修复：版本读取进入同一串行观察段；准入覆盖读取和响应，取消不提前释放仍在读的工作。新增1例有确定性red→green；最终2/2含原HTTP例重叠，未重跑PG/浏览器。独立review仍未开始/未批准。
