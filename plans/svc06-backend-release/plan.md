# SVC06 固定后台发布产物

创建/更新：2026-10-06 12:43:33 UTC。子task；所属唯一大task [FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md) / REQ-19。co-lead Execution Lead。accepted，当前仅计划/evidence写权；实施在现TUI01D交付安全点后由可用worker接手，不抢原生ENG01H。

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
- [ ] **SVC06-02** 在可用worker安全点固定最小实现scope/依赖产物策略与直接消费者后take。
- [ ] **SVC06-03** 实现产物准备、校验及现host启动接线，证明开发checkout独立性。
- [ ] **SVC06-04** 自有环境局部兼容/失败/保留检查与独立review，受控main接收。
- [ ] **SVC06-05** 后续明确窗口下真实个人发布及固定身份/数据/网页保留验收。
