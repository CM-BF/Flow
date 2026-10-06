# 先更新后台，再切换网页（准备，未执行）

三份准确的 af51 兼容报告现已具备：两份旧页面由 R01 实际 App 验收及 Execution Lead 独审通过，新 d629 由 RELEASE03 A12/B3 与 Root 独审通过。个人安装仍是后台 362、runner accepting/v15、caa1/v2；下列顺序尚未执行，也不复用旧恢复或隔离验证窗口。唯一 owner 为 assignment_review，固定输入与完整 ID 见 [proposal.json](proposal.json)、[input-bindings.json](input-bindings.json)。本次仅读固定源码、报告和已保存事实，0 新个人探针/PG/浏览器/provider。

## 固定版本与入口

后台目标 `af51c621696230fbced12227670f014ca73bd8a1`，基线 `362af3bac77541e5a60979326bcf4d4b8c947915`。唯一生产差异为 context-transparency/store.ts 的三行 templateVersion2 历史材料投影；另一个变更是已审测试。tools、lock、依赖声明、SQL 均同362，不新增迁移，预期仍1..27。

所有 host 命令使用 `/opt/homebrew/opt/node@24/bin/node` 及原仓库 `/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/cli.mjs`，cwd 为该原仓库，私有目录 `/Users/citrine/.flow-personal`。Lead 唯一把该工作目录临时固定为 clean af51（保留 main/origin refs），操作期冻结直到检查点和收尾完成；不能在本候选树直接运行 host，也不能拿 moving main 冒充 af51。

工具复用固定 af51 的 preview / maintenance-host / process / web-release / web-artifact / static-web / environment 八个模块；全同362，未新造部署工具。Node24.20.0、tsx4.23.15、pg8.23.1 等已保存解析记录只是来源；执行前须在原 Flow 分别从 root/server/runner/Web 实际解析并核已固定 manifest/entry，包括 SDK0.3.290、Vite8.3.2、workspace aliases、SQL资源。H/R01 donor links 不证明个人原目录可启动；缺件在任何 drain/stop 前停止，由依赖 owner 处理，不临时安装/换 donor。

## 三个组合

| 产物 | 网页源码 | af51 报告 ID | 报告原始来源 |
| --- | --- | --- | --- |
| 旧461a9732… | b1c2e398… | adc587ad334d… | R01 f74eca53 的 runs/retained-af51-20261006-1952/retained-0 |
| 当前caa1e938… | 8d8ab520… | e87ffda1ee15… | 同次 retained-1 |
| 新d629631d… | 5069586a… | 599a5b170693… | 本 evidence/release-preparation/candidate-compatibility |

每组均含原 report/read/send/recover/negotiation 五文件，41项输入绑定记录完整绝对路径/hash/ref。旧 pointer 的历史 backendHead=b1c 及报告继续原样；后台更新后 current 仍 caa1/v2，host 使用新 af51 报告验证 retained，静态 reader 仍可读取原历史 pointer。新 Web publish 才生成 af51/d629/v3 的 pointer，并保留全部三个产物及对应 af51 报告。固定上限3产物/192MiB；本组合30文件、4,538,660逻辑字节，不是物理峰值或空间预留。不能改旧报告内的 backendHead。

## 待窗口准许的单次步骤

1. **Fresh 与预约。** 用现有 bounded 观察方法核原700根/600配置、marker、token摘要与正式runner身份、三owned group/监听、operation.lock、source/依赖、全部runner部署及全库未完/uncertain/队列。保存新 wx+fsync reservation、当前版本/操作ID及原始before；本方案引用19:45保存的64表/4成功任务，不能据此判断未来空闲。用户新工作保留，不取消、不改输入；活动自然完成，未知不stop。
2. **停服前材料准备。** 对三个固定目录各执行一次既有 `web import-compatibility --directory /Users/citrine/.flow-personal --report-directory <proposal中的准确目录>`，核返回 ID；不修改/替换历史报告。执行已审 `artifact-transfer/import-d629.mjs --execute-reviewed-d629` 一次：仅10文件、1,588,311B，原host锁/marker，目标不存在，stage校验/fsync→RENAME_EXCL→复核。每步结果立即持久；失败保留已导入报告/stage/可能已rename目标，停止，不删旧产物或自动再搬。此时 pointer 必须仍 caa1/v2。该脚本已有1GiB+16MiB门槛；整窗口另按Lead资源门槛，不视为物理预留。
3. **后台阶段。** 一次 `maintenance bootstrap --directory ...` 建立原工具的持久operation/key并drain；有工作时只等待自然排空。在全库未完/uncertain为零、身份/源仍匹配时，一次 `maintenance refresh --directory ... --target af51c621696230fbced12227670f014ca73bd8a1`。它先hold、查两retained报告，再依次stop Web→runner→center并重启三角色，保留原runner身份，不是center-only更新。操作预算沿既有SVC05建议drain起15分钟；到期/未知不强杀或自动回退，保留安全状态交Lead，不声称该CLI自带全程硬期限。
4. **后台检查点与恢复接收。** ready-paused后先持久化source/三owned ready/旧数据/身份/原pointer及准确允许变动检查点，再按新窗口明确授权一次 `maintenance resume --directory ...`。v15→16→17→18只是无并发时预期，必须以实际CAS回执为准；不改参追赶版本。refresh/resume失败留暂停/unknown，不进入Web切换。resume后用户原队列可自然派发，operator仍0主动模型任务；不能因此要求用户数据继续冻结。
5. **独立Web阶段。** 后台确认af51、resume收尾保存后，核当前pointer仍v2/caa1，保存0600 request（[proposal.json](proposal.json)中精确四字段）与checkpoint。一次 `web publish --directory ... --request <已固定私有request>`；既有host核身份/三报告/全部资产后原子pointer提交，预期v3/d629，三个产物均保留。不重启backend/runner、不reload用户tab。正文/草稿不通过operator另发请求。
6. **收尾。** 保存CLI exit/stdout/stderr、实际pointer与owned/source/数据摘要、每阶段允许变化、锁状态；再通知Lead源窗口可关闭。绝不凭进程存在当provider成功。原TSX运行仍依赖开发checkout；Lead恢复main不等immutable runtime保证，后续动态import/重启风险如实保留（SVC06后继）。

## 保留与失败判定

从已审观察方法复用原始全表摘要；明确新增的maintenance audit与本runner的 maintenance_state/version/operation_id/updated_at 四列合法变化，保留旧audit行逐值。后台queue scan可改变 conversations.queue_checked_at：采样时同时保留原始整行摘要与明确去除此列的旧字段摘要，不能事后删字段凑绿。迁移1..27正文/时间、配置/profile/token摘要、原ID、用户内容、固定输入和产物不应因更新改写。新用户工作需单独按真实任务因果说明，不借操作白名单吞掉其它差异；发现不明变动停后继。原center-recovery facts脚本写死362、全表相等规则只适合同版本恢复，**不能不加区分直接作为本次af51验收器**；复用其查询/摘要方法，保留范围依本段。

每条命令执行前记录稳定参数/hash，之后先保存真实回执；一次结果未知先读现state/operation/pointer，不自动重发、更换key或rollback。artifact rename已发生后失败可能已有目标；Web pointer提交后identity失败为 committed-unknown，不能声称旧页面仍current。锁由既有host管理，不手工删除未知lock、不向非owned进程发信号。发布后先持久checkpoint才做任何可选清理；本计划不删除任何retained资产，不清私有DB。

当前准备没有生成执行许可。后续由Lead核本固定提案、原始兼容批准及新source/运行窗口，明确哪些准备/后台/resume/Web步骤获准。旧报告和原两次R01失败永久保留。

## 质量复核

2026-10-06：沿本地 find-skills / codebase-design / clean-code 已用方法，检查责任、稳定参数、错误未知、锁/资源所有权。选择原有受管CLI+已审单产物搬运，不复制状态机；本次只加文档与固定输入绑定，无测试/安装/服务动作。
