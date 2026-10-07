# SVC06B 浏览器恢复所需固定后台

状态：in-progress。所属唯一大task [FLOW-001 / REQ-19](../../../plan-status-review/plans/flow-001-architecture/plan.md)，co-lead Execution Lead，owner assignment_review。沿原SVC06固定产物方法推进，不创建第二发布系统或调度器。

## 用户结果与范围

在当前已恢复的7d1/source6c之后，为Recovery网页准备带已审晚到Logout修复的固定后台。仅在6c组合原审66ca/main7272的三个browser-session文件及专测所需一个只读cleanup Module；唯一生产行为是精确撤销旧session后不发送删除Cookie，防止晚响应抹去新连接。旧session/流仍失效，现任务不取消。固定依赖、SQL迁移和其它产品不变。

已运行7d1和全部旧R1–R4/held资源与原件保留。本片不操作个人目录/服务/DB/用户tab，不调用模型、不安装/升级依赖。新artifact ID只能由真实构建产生，与source SHA分开记录；不得重标旧7d1。

## Interface 与复用

| Module | 固定输入与产出 | 界限 |
| --- | --- | --- |
| 来源组合 | 6c基线+66ca三leaf/cleanup支持→独立04da候选 | 原239前像及main7272后像逐blob一致，不纳moving main |
| 既有backend builder | 固定候选Git、原lock/精确cache/pnpm→新content-addressed artifact | offline/frozen/copy/ignore scripts，旧420s监督与空间界限不降低 |
| 构建调用入口 | 已审prepare/verify+内部解析proof→独立结果 | 复用OPS14与原入口小参数接缝；不复制安装器或状态机 |
| Web兼容 | 新backend descriptor/source+旧三retained及原Web owner固定的新网页 | 由原Web owner做真实App/cookie场景；旧C3/6c不当新组合通过 |

## 验收与TODO

- [x] **SVC06B-01** 独立树/claim、精确前后像和来源组合固定，唯一status登记。
- [x] **SVC06B-02** 固定可执行build proposal、实际依赖/资源边界及必要零副作用入口检查，独立review。
- [x] **SVC06B-03** 取得真实共享窗口后一次新artifact构建/校验/内部加载，保存独立结果与unknown，禁止自动重放。
- [ ] **SVC06B-04** 将准确descriptor/source交Web原owner完成三retained与新网页组合证据，受控接收；补齐有限backend保留工具及受管更新候选，个人发布须后续单独固定门禁与窗口。

- [ ] **SVC06B-05** 集中backend count≤4/总2GiB/单项1GiB策略，prepare最大预留与verified import实际字节分判；直接消费者及独审，不改已审cd27。

原entry普通local累计≤120s、scratch16MiB/raw2MiB、同时≤4自有child；当前0PG/Chrome/provider/个人服务。完整构建已一次完成并归还，后继完整构建仍需原420+.5+2与fresh>=2.5GiB及所有并发/保留总预算中更严格者、live1GiB、raw2MiB保持。无资源holder不等于自动许可构建。

原4个选中PG/2focused types不重跑；本片来源组合不能代替新artifact或真实cookie兼容。旧source支持Module只有独立函数无导入；专测.js解析至受审.ts，保持原字节。架构只固定发布source组合，生产Interface无新增；后继图由Lead按新artifact实际身份登记。

[单份来源记录](../../docs/evidence/svc06/browser-recovery/source.json)；[status](status.md)；[review](review.md)。

后继有限retention工具已于2026-10-07T14:44:35.053Z原子amend；仅三exact产品+own两目录，局部另授≤60s/8MiBtmp/1MiBraw，0PG/build/个人/provider。原browser/support/build-entry停写交回。[受管更新候选](../../docs/evidence/svc06/browser-recovery/managed-update-candidate.md)分别列manifest兼容、工具政策、迁入装配缺件和实际运行门禁。
