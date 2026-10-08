# WPF-P01 可信 Web 插件 host（X01 Web 子项）

| 字段 | 内容 |
| --- | --- |
| 计划编号 | WPF-P01 |
| 状态 | `in-progress` |
| 创建 / 最近更新 | 2026-10-06 / 2026-10-06 |
| 唯一实施 owner | w01_owner / 派发gpt-6-astra ultra |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host` / `codex/web-plugin-host` |
| 集成输入基线 | `c8900a6fdbca20e683fda6fc808c135f0569c116`：main108fddbd加已审W01最终a22ae38，再合main8c57已审M02因果修复；均无冲突 |

目标：提供独立可审查、可由M02唯一App owner挂载的受信任Web PluginHost，支持静态声明、按需激活、统一命令、typed贡献、清理与局部错误恢复。完整X01仍由原Execution Lead负责，包含第三方隔离/包生命周期/配置/后端/CLI等，本子项不越界宣称完成。

## 范围与接口

仅新增/修改 `apps/web/src/plugins/**`、`apps/web/test/plugin-host*.ts(x)`、本计划目录、`docs/evidence/wpf-p01/**`。App.tsx、TaskThread.tsx、既有workspace/**、themes.ts、公共contracts/client与rootmanifest不改。M02 owner负责App挂载与系统集成。初始化受控合并由管理者明确授权；后续变更相对集成输入基线核验独占范围。依赖安装只临时生成本树rootlock，交付恢复并保存完整patch，不软链旧client作验证。

已授权设计方向承接主管理草案和root只读研究。采用深模块：PluginHost对外register/activate/deactivate/list/execute；生命周期、ID/版本/权限/并发/回滚与清理隐藏于模块。React slots使用typed语义context，不扫描已有data属性。manifest为JSON声明，固定受信build loader不由任意URL导入；真实内置WorkspacePanels与主题适配器通过同一接口，第三sample无需核心修改新增button/tab/menu。

接口草案、能力名、host命令和M02接入桥见[interface.md](../../docs/evidence/wpf-p01/interface.md)，冻结前发管理者/M02核对。不能向插件暴露FlowClient、owner token或全局表单状态。可信同realm不是JS安全沙箱；动态授权在每次execute重核。

## TODO

- [x] **WPF-P01-01** 与X01/M02确认Web子项、接口版本、能力模型与独立实现owner。
- [x] **WPF-P01-02** 实现host、稳定贡献位置、至少两项真实内置plugins及sample扩展。
- [x] **WPF-P01-03** 验证生命周期/错误隔离/权限/清理与双主题键盘，记录生产性能变化。
- [ ] **WPF-P01-04** 独立review、提交集成清单并核对X01全栈剩余验收。

## 验收

- register不load；ID/API版本/声明非法时原子拒绝；激活按command或显式view事件懒加载；并发activate一次，execute请求不被错误去重。
- 原子激活，失败回滚；disable先拒dispatch、abort、递增generation，再逆序清理；迟到异步不能复活，一个dispose抛错不跳过剩余，订阅/observer/timer归属并实际清空。
- 命令动态权限/context复核，旧context失效；activation/event/async命令显式catch诊断，React错误边界局部捕render异常并提供retry，不产生unhandled rejection。
- immutable稳定窄snapshot/subscribe；task流更新不会广播刷新host所有插件；button/menu/快捷触发共用commandId。
- 两个真实builtin、第三sample以及真实渲染fixture：双主题、键盘、关闭焦点、disable草稿不丢、主题fallback、lazy失败重试、未知renderer安全fallback。
- 模块和直接依赖检查优先。独立模块review不等于App集成；最终需要M02 owner明确cherry-pick并验收主App接入。

## 状态与质量

本目录status是唯一手填进度事实源；主管理nested草案转为入口，由管理者写转交说明。先按find-skills本地优先发现并应用codebase-design、clean-code、React/测试技能，每工作段/约30分钟安全停点/交付前记录实际发现。实现review保持NOT_STARTED直至独立结论绑定完整SHA。跨任务README索引和dashboard注册交管理者/Lead，不越权写他人事实。

2026-10-06 06:42 UTC收口：本片段已集成固定published main a26，详细祖先与当前保留scope证明见[状态](status.md)。早期范围/未集成说明为历史；当前scope以D04实际receipt为准。文档提交后全部停写并释放旧claim，未来修复重新take。
