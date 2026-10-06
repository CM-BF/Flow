# MESSAGESETTINGS01 独立主线接收预审

**可独立接收受控组件，不需要等 Recovery/App 后继。** 本次固定观察 main/origin=`a9f3aab4d636edc187ce508c60d060f4fb8be832`；原 owner `3b945339151abd29e213ff37774ea7d6c5aee93f` clean，固定六源 target `270cfdfa2bcbd04ef62a6ad3ecbc22358db32d67`，base `8d84d529a0756116bd0fc8bad969d61a6c26248e`。这是只读接收预审，尚未 merge/build，main 只能由 Execution Lead 写。

## 最小源码组合

按序接收以下四个纯源码/测试提交；它们全部只触六个获审文件，不含额外产品路径：

1. `ed769f929a7efe01a279ddd85c2e1e88b46839e6`：三生产文件与三专测/fixture/browser 初实现。
2. `f3a6a7ec89d5b3f789c49b0d8662401b23032ab2`：长模型断行与中文标签窄修、相应 browser 文本。
3. `1cd5cd41e47c8c101d9bb1acfdca1e870769c014`：Vite 只扫描实际 fixture。
4. `270cfdfa2bcbd04ef62a6ad3ecbc22358db32d67`：唯一具名 group/count/visible 定位窄修。

不能只取最后270c而漏前面实现。也可由 Lead 在其合法集成路径受控接收最终六源；最终必须逐字匹配 audit 的六 SHA-256。`plans/wpf-message-settings` / `docs/evidence/wpf-message-settings` 的权威终态与原件来自 owner3b945，按原接收流程保留，不能用新绿覆盖旧失败。本文不执行 cherry-pick、merge、checkout 或项目写入。

## 固定 main 冲突与依赖

- 六目标路径 main 相对8d84 **零差异**：三旧生产文件仍为基线字节，三新增 message-settings test/fixture/browser 在 main 仍不存在。故没有已知双方改同文件的内容冲突；这不是实际 merge 执行结果。
- 直接既有消费者 `App.tsx`、`ConversationThread.tsx`、`conversations/projection.ts`、原 `execution-profiles.test.ts` 以及 Button/Dialog/现CSS、Web依赖/lock 与基线逐字一致。PROFILEC02 的 `configuredSelection(input: Immutable<DirectoryProfile>)` 修复仍保留。
- 公共 `claude-turn-settings.ts` / `execution-profiles.ts` codec、settings choices与会话 capability 已在固定 main；client实际 `claudeMessageSettingsProfiles(options={}, signal?)` 在 index:385–390，仍 public schema parse + 显式协议 header，没有缺方法。client index 的唯一额外差异是 GoalPlanConfirmation import/confirmGoalPlan 方法；contracts index只追加对应export，均不改本leaf导入/接口。
- 不新增依赖或升级runtime，不需要借 Recovery/private 未主线模块。旧 ExecutionProfilePicker export/props 继续由现 Thread 消费；新 MessageSettingsPicker 为独立受控 value/onChange，catalog复用一个分页生命周期，纯 capture 消费公共 codec。

## 已有证据（不重跑）

全部路径均绑定 owner3b945，下述入口及完整哈希列于 audit.json：

- `docs/evidence/wpf-message-settings/root-direct-evidence-review.json`：f3/实际85aba strict noEmit exit0；execution-profiles21 + message-settings16 = **37/37 PASS**。父 expected20 漏参数化17而 FAIL，原raw与该计数错误分类保留，不假改父PASS。三生产文件与两个直接输入在最终270c保持；后两提交仅browser。
- `docs/evidence/wpf-message-settings/root-browser-b5-runtime-review.json`：target270c/actual0925，**4/4 browser checks**、浅/深390截图、180字符模型、键盘/Escape、details关闭/回焦、独立双pane、A/B/current detached快照、cap撤销/刷新/分页/空目录保值；pageErrors=[]，双group/scratch清理完整。独立 verdict APPROVED_SCOPED_CONTROLLED_PICKER_BROWSER_EVIDENCE，0blocking；原件SHA `5e940da0e7b766a99639cf51ab93a3108f80ed6276aa23c6f8619d81fbefcdfc`。
- 原始索引：`checks-first-observation.json` 与 `browser-fourth-observation.json`；原raw在相邻 `checks-first/` 与 `browser-fourth/`（具体file/hash以索引为准）。新b5耗8267ms、browser累计28876ms是历史事实，不是本次新运行。
- `plans/wpf-message-settings/review.md` 为唯一APPROVED接收入口；root-f3、peer-ed769、root-270c分别保存对应源码审查范围。

## 明确后继

固定 main App:369仍只创建旧 executionProfiles catalog；Thread:56–58仍只挂旧 ExecutionProfilePicker，源码检索没有新 MessageSettingsPicker/createMessageSettingsCatalog/captureMessageSettings 生产调用。此正是本leaf交付边界，不构成等待另一未完成task的接收前置。

实际 App/P01宿主、同步提交捕获与 Send/outbox/Queue、Recovery保存/恢复/读回仍后继；成熟模型/思考力度/速度快速筛选与 Apply UI仍原MATURE02 TODO11开放。fixture A/B/current快照不冒真实Send/Queue成功，requested不冒observed/provider。主线接收也不等于个人预览部署/整个MATURE02 Done。

方法：复用本地find-skills/clean-code/webapp-testing既有记录；只git固定对象/diff/hash/文本读取。本次0产品检查/PG/Chrome/free/服务探测，Settings8与DPERF9保持停写。若Lead接收时main进一步变化，只由其在合法集成点核实际delta，不将本报告指向moving main。
