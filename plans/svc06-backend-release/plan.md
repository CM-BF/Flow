# SVC06 固定后台发布产物

创建：2026-10-06 12:43:33 UTC。子task；所属唯一大task [FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md) / REQ-19。co-lead Execution Lead。当前 owner assignment_review 持claim v7，仅own plan/evidence；共享产品已停写交回；真实固定产物构建/import已审并main，后继真实宿主/checkout不可读仍未验，个人服务不在当前操作范围。

用户结果：中心与runner运行源码、依赖及Node执行身份固定；正常开发checkout前进和依赖安装不改变已运行release，不再为现有服务切换或冻结main。复用已有单安装operation锁、drain/active0/hold/refresh/resume和Web独立发布，不建第二部署状态权威。

## 当前事实与边界

SVC05 fixed362受控更新于12:41:29 closed，v15 accepting，保留会话/两Web产物/指针/凭据；0operator query。该批准不证明本片实现。preview.mjs runService目前以config.repository为cwd执行TS，维护target核该checkout；本次detached362与server zod链接缺失体现交付耦合，未观测混版事故。主线恢复aeb后已加载进程维持362；现node_modules保持，不在本片准备中重启/安装个人环境。

## 小模块与Interface候选

| 职责 | 输入/输出及所有权 | 边界 |
| --- | --- | --- |
| backend artifact prepare | 固定Git SHA、受信构建策略→content-addressed descriptor | 独立staging，源码/解析依赖/Node ABI与入口清单有界；不含私有config、用户文件、凭据；不运行任意包脚本 |
| backend artifact verify | descriptor及产物根→已核启动入口 | 哈希/普通文件/受限内部symlink；拒绝外部node_modules/store/runtime源码路径；缺件必须在drain前失败 |
| existing host launch | 已核descriptor+既有private运行配置→owned process记录 | cwd落release；环境沿旧allowlist；snapshot身份与安装repo身份分开，复用原nonce/PGID/退出观测 |
| retention | 当前/保留descriptor+字节/数量上限→候选清理清单 | 不删除运行/unknown持有release；显式回退仅源码兼容路径，绝不DB自动回滚 |

首候选是固定源码快照加私有依赖集合，依赖由已审lock离线frozen解析并复制进产物，workspace链接全部解析在release内部；也可选择现有工具支持的编译/部署产物，但须先证明TSX/动态SDK可用、无外部绝对链接、无需生产借用全局工具。不得仅hash lock就称依赖集合固定。布局/预算/包生命周期为实现前小设计决策，不能静默把候选当已验证。复用SVC03/04 artifact校验、原子落盘和生命周期中实际共用概念，若前后端产物语义不同保持小独立实现。遵循[全项目模块规则](../../AGENTS.md#modular-design)。

## 验收

零provider自有环境：固定真实server/runner入口与锁依赖产物成功运行；开发checkout/source及其node_modules改变后，既有release入口/延迟依赖读取身份不变。缺件、损坏、外链在停服务前拒绝并旧服务继续；staging失败/发布ACK未知按既有恢复语义处理。真实PG升级/旧数据、runner身份、维护审计和Web独立指针保持。保留/清理有界、运行与unknown不能误删；相同descriptor重放不能另启服务。必要直接消费者覆盖现personal-preview/maintenance与Web兼容导入，不重复无关业务全集。

真实个人切换不在本片当前授权内；固定实现/组合证据独审后另以既有窗口执行，不能自动重启用户服务/刷新tab/提交模型。TUI与工程并行，后端发布不新增客户端串行门禁。

## TODO

- [x] **SVC06-01** 记录唯一用户结果、现证据与模块边界，独立plan/evidence领取。
- [x] **SVC06-02** 在可用worker安全点固定最小实现scope/依赖产物策略与直接消费者后take。
- [ ] **SVC06-03** 实现产物准备、校验及现host启动接线，证明开发checkout独立性。
- [ ] **SVC06-04** 自有环境局部兼容/失败/保留检查与独立review，受控main接收。
- [ ] **SVC06-05** 后续明确窗口下真实个人发布及固定身份/数据/网页保留验收。

## 已收到的固定工具研究（GO只读输入）

固定pnpm9.15.4的 [deploy源码](https://raw.githubusercontent.com/pnpm/pnpm/v9.15.4/releasing/plugin-commands-deploy/src/deploy.ts) 106–117由GO只读核到关闭frozenLockfile/preferFrozenLockfile且一次选择一个package；不能假设deploy --prod等同本片完整冻结产物。mainaeb的tsx是根devDependency，真实server/runner TS入口与跨包相对SQL迁移路径需要保留。首候选保留所需布局与真实依赖闭包，解析/SQL资源必须在产物目录内；不能省略loader/资源，也不为打包先重构全库imports。此为来源标明的研究输入，尚无本片安装或执行证据。

实施 Interface 与资源界限：[interface.md](../../docs/evidence/svc06/interface.md)。artifact bootstrap 只接已有独立 Web pointer 且全部 retained 的固定后台兼容报告已验证；旧 legacy 未显式选择 artifact 不改变。Python/clonefile 仅构建期；Node和非system dylib固定身份为宿主前置。源码范围遵守9literal claim。

已接收保护切片固定 `6d276baee6d3fbf14eb4b638a9ad773ffcec988d`，实际范围与 8 个分轮行为观察见 [README](../../docs/evidence/svc06/README.md)。SVC06-03/04 不因小片已有代码而完成：完整 fixed artifact/运行/开发依赖隔离性仍未验。narrowed seed 只读统计不自动降低 ≥2.5 GiB 的完整构建门槛；恢复条件由本 co-lead 按实际资源协调，不扩大删除路径。

## 运行依赖最小后继（2026-10-06 14:41 UTC）

[固定闭包方案](../../docs/evidence/svc06/runtime-closure-followup.md)仅改变后继私有构建策略：原锁来源保持，安装视图显式纳入根tsx，选择五workspace生产/可选与peer闭包，私有窄seed由固定pnpm生成内部布局。实际产品未修改；GO只读256/683统计不当安装正例/physical峰值。

已审6d276保护小片与185e交付已由Lead独立接收至main cbd3dd95，不依赖fullartifact；SVC06-03完整独立运行与SVC06-04正例仍open。资源≥2.5GiB且共享收尾≥1GiB不变，下一实际验证先小fixture再一次真实离线产物/随机PG入口，未经新资源准入不启动。

## 主线接收记录（2026-10-06 14:54 UTC）

已审有界保护/legacy兼容切片为 delivered；main `cbd3dd95754be96bf7eeed534fb4c7fcce8a16a8` 已含14个相同实现文件与交付185e。观察 main/origin `d679444c4bed52bbd53d38f4944f914b30fbbd92`，祖先/文件核验见 [main-receipt.json](../../docs/evidence/svc06/main-receipt.json)。此为限定接收，不扩独立review、不复跑、不完成 SVC06-03/04/05；完整依赖构建/固定host和个人窗口仍按原后继条件执行。

## 已实现的最小闭包准备（2026-10-06 15:16 UTC）

新[纯Interface](../../docs/evidence/svc06/closure-interface.md)固定于 `87dc292ae2dc8c1357f074ec7bddd41de20108d8`，仅选择/安装投影/CAFS索引身份与去重；正式builder、parser与实际安装仍未接。原锁/12直接输入无变。7个小用例通过，真实固定lock选择256/683；不把它视为physical收益或完整产物。SVC06-03/04/05继续open；本片独审待安排，不改旧个人服务。

2026-10-06 15:20 UTC：新87dc纯模块已独立批准并进入integration，来源与范围见[review](review.md)。不完成03/04/05，后继接线/安装仍受原资源条件约束。

2026-10-06 15:26 UTC：纯87dc片段已通过等价提交进入main，见[closure-main-receipt](../../docs/evidence/svc06/closure-main-receipt.json)。这是本纯模块delivered，非完整产物完成；03/04/05与资源条件保持。

## 2026-10-07 02:53:50 UTC：正式构建接线局部结果

原SVC06-03/04内正式parser/builder已固定 `b21890799fe11b8f1937e4b08382c997877f6d53`，私有yaml2.9.0真实消费及6新模块+1直接消费者7 distinct通过，原失败保持；详见[结果](../../docs/evidence/svc06/parser-builder-checks.md)。本片源码停写待独审。下一完整构建需独立固定整体一致Git target、真实closure/物理峰值/合计窗口，≥2.5GiB与保1GiB不变；不得以本历史owner树的旧workspace manifests混合新main锁当完整运行输入。03/04/05仍open。

2026-10-07 02:58:16 UTC：上述正式parser/builder片由native独立限定批准，7源/43绑定与7不同原检查核清；受控接收待Lead。本任务03/04完整运行后继仍open，05个人操作未授权。

## 2026-10-07 03:07:14 UTC：宿主工具闭包后继

原b218七源已main `a2e7803161ffb7e2158eaf3c13531448d2a777b0`。既有三角色共用artifact root，新增固定tsx/Vite来源表，避免完整Web workspace安装；4源target `2affec4cc7a899082cbf48fce5bbd0f77293676c` 局部8 distinct通过，[Interface](../../docs/evidence/svc06/host-tools-interface.md)与[结果](../../docs/evidence/svc06/host-tools-checks.md)。独审待Lead。完整产物需该窄片接收后的固定一致main，当前仅纯选择271snapshots/7importers；真实cache/install/SQL/SDK/Web宿主启动与隔离仍open，不用af51历史树充当host正例；03/04/05不勾完成。

2026-10-07 03:10:25 UTC：host-tools target2aff已由Execution Lead唯一限定批准，51绑定与原检查/清理核实。本片integration；完整artifact仍先准备固定一致main与有界执行入口，03/04/05未完成。

## 2026-10-07 03:22:06 UTC：根级数据库驱动闭包

宿主工具2aff已main8c80a7105cf442783e83184a14e34c8da08ebe16。实际根tools静态pg导入新增同表来源与投影，target `893324703fe35c3b9fca1dbfbec96bdd6b4405fa`；[3项局部结果](../../docs/evidence/svc06/root-pg-checks.md)不代替真实安装。完整产物必须消费含修复的一致main，03/04/05保持open。

## 2026-10-07 03:30:05 UTC：真实产物首次执行准备

rootpg已main3230，原局部批准不扩。唯一[执行入口](../../docs/evidence/svc06/artifact-first-run/README.md)固定main `3230becf07b804479ec4dc7ef02fcaff58cc3858`，原prepare/verify/OPS14负责隔离安装与停止。新更严格fresh门槛与500ms观测边界已写明，不运行个人服务/PG或启动provider；完整artifact实际结果与真正host隔离仍分别待验，03/04/05继续open。

2026-10-07首次真实fixed3230产物构建与内部解析已过，限定结果见[RESULT](../../docs/evidence/svc06/artifact-first-run/RESULT.md)。原开发树未改/未隔绝，真实宿主生命周期与后续个人部署仍未验，不整体完成03/04/05。

## 2026-10-07 03:52:51 UTC：固定产物实际host后继

[最小方案与预算](../../docs/evidence/svc06/artifact-host-smoke/PROPOSAL.md)已形成固定源码；复用e5产物与真实d629静态dist，不重建、不伪造3230兼容报告。单次实际拒读本机机制检查已过，host/PG未执行。先验三个零任务owned角色的真实启动/静态字节/延迟导入及独立收尾，完整refresh/resume/旧数据与App兼容仍后继；SVC06-03/04/05不因此勾完。
