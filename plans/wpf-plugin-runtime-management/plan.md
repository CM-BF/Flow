# WPF-PLUGIN-RUNTIME01：中心插件启停模块

状态：in-progress；创建/更新：2026-10-07T10:51:19.274Z。这是 [X01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-enable-binding/plans/x01-plugin-management/plan.md) 原 X01-06 的有界模块子片（Mika正式确认，root核canonical），WPF-001-05仅保管理追溯，co-lead Web/root，唯一 owner w01_owner / Astra Ultra。

## 目标与范围

展示中心插件 desiredEnabled、bindingAllowed、原因与精确安装身份，并允许显式启用/停用。首片复用已主线发布的公共 client ACK codec；config/grants 只读，Browser extensions 保持独立。七范围见 [领取原件](../../docs/evidence/wpf-plugin-runtime-management/take-receipt.json)。App、session.ts、插件注入权限、服务器/共享契约/依赖不改。

当前高级入口由 operator 手输 exact runner UUID；中心复核 runner、维护态、固定 store 与 API1，不自动注册或探测宿主。这是临时高级路径，最终日用候选应按授权可读名称选择、消歧同名并展示不可用/未知原因；该只读候选合同由 X01 owner 固定后接入，不能拿 executionProfiles 代替宿主证明。

## Module / Interface

`runtime-command.ts` 仅持有一个 session 的一个未决启停命令与订阅快照；公开 client 负责 schema/ACK。冻结 key/body 和 command authority 由宿主创建的 controller 持有，lazy 组件关闭、折叠、切详情不销毁它。失效 session 同步 revoke，晚响应不能写入新 session。组件只读取窄 reader/controller 接口，不接 PluginContext。

新命令 typed 4xx 可明确拒绝并保稿；已 UNKNOWN 的 retryOriginal 得到 409/其它非原 ACK 仍保 UNKNOWN、原 key/body 和独立重试诊断。GET 不触发 POST、不解除 UNKNOWN；读失败与写结果未知不同。提交先同步 single-flight，codec/preflight 失败不是已发送 UNKNOWN。无自动重试、自动 rebase、通用 outbox 或第二 authority。

fixture 在 lazy view 之外真实持有 controller，原 readonly 旅程保留。此处完成不表示真实 App 接线，App/session 写权仍属 Recovery 后继交接。

## TODO

- [x] WPF-PLUGIN-RUNTIME01-01：公共读取与 session command controller；明确错误/冻结/失效。
- [ ] WPF-PLUGIN-RUNTIME01-02：管理组件启停与只读身份/可用性展示；fixture 持有实际生命周期。
- [ ] WPF-PLUGIN-RUNTIME01-03：受影响直接测试、类型与浏览器入口准备/实际验证，失败保真。
- [ ] WPF-PLUGIN-RUNTIME01-04：固定源码独审与限定主线接收。

## 验收与边界

覆盖首次 enable/disable ACK、preflight、initial409、unknown→retry409→GET仍unknown→原ACK、重复点击、close/collapse重挂、晚session、exact输入不变。浏览器仅模块 fixture，可读性/键盘/390双主题，未获实际窗口前 NOT_RUN。单文件 direct/noEmit 提案先给准确依赖/预算，0PG/Chrome 本源码段。不执行现历史浏览器自动 DB 入口。

固定 base b67530bb025162629895d11482b5505d4a885c91，已含 shared client 9f5d。当前20ac及6544源码限定独审已完成，strict0已接受；direct15 JSON仅部分证据/父FAILED，旧任务证据不继承。技能见 evidence/skills.json；clean-code 检查命名、单一 authority、错误/取消、重复和必要场景，记录实际发现。

## 历史：2026-10-07T11:03:07.706Z 源码安全点

实现 `f0ed0b3e208d84dd0aa420f5ae944cbee0c5dcc9` 的 controller、可选窄管理port、真实client fixture及direct/browser断言已提交。旧自动执行DB入口改为显式legacy导出，保原旅程主体；新检查入口是独立有界HTTP fixture。所有运行 NOT_RUN；[验证提案](../../docs/evidence/wpf-plugin-runtime-management/validation-proposal.md) 明确依赖尚未执行、11展开与5browser边界。

## 历史：30秒验证停点

当前实现6544：同revision GET新鲜度源修与公共子模块直接消费。strict已通过；实际direct JSON 15/15，但父输出/child退出记录不完整，保FAILED而不称整段绿。30s段含延迟补清理保守30082ms，超82ms/无剩余额度；无第四跑。浏览器六组和生产App接线仍未验。七范围停止写入，claim保留。

## 历史：r4调用器修正准备

沿[已接受设计](../../docs/evidence/wpf-plugin-runtime-management/direct-only-r4/caller-repair-peer.md)修复启动raw余量、互斥分区及清理异常后继续收尾。原产品不动，新direct-only候选20s含5cleanup未运行；完整输入/命令/保留上限见[r4准备](../../docs/evidence/wpf-plugin-runtime-management/direct-only-r4/preparation-summary.json)。不重跑strict、不接后继HOST/ACK新界面。源码准备待独审后由manager安排一次有限段；旧30s封账不继承信用。

## 当前 direct-only 实际结果

复用源6544，独立r4真实父/子exit0及15例完整结果通过，882/20000ms新段关闭，全部owned清理和原件见[actual](../../docs/evidence/wpf-plugin-runtime-management/direct-only-r4-actual/README.md)。原30秒失败未改；既有strict不重跑。本次直接回归与完整归还已获root独立接受；下一步是管理组件浏览器交互，生产App接线及HOST新合同消费仍分别后继。全部七scope在本次封存后STOP，claim保留。

## 模块浏览器准备（当前 source-only）

[固定入口与验收提案](../../docs/evidence/wpf-plugin-runtime-management/browser-preparation/README.md)沿原六组/两390图，不调用legacy双PG、不引入production App session或新HOST DTO。当前只准备，旧strict/direct15不能当浏览器通过。后继日用候选资料以root固定de547公共接口研究为输入：绑定snapshot revision/version，空页可next/cursor409显式重启，同名按exact runner/store/API消歧；读取失败不造writeUNKNOWN、候选刷新不改冻结key/body。尚未在本slice实现。
