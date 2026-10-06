# WPF-D01 Dashboard 协作需求与来源登记

更新：2026-10-06 03:19 UTC。唯一计划/status owner：d01_owner / gpt-6-astra ultra。父计划：[WPF-001](../plan.md)。固定文档基线 `d444608ab6c796c731e44e51a892868bf39bec2a`；本计划始终只做协作登记，没有第二个dashboard实现。

## 唯一实施边界

紧凑中性工作台和高层语义由主线D03实现；D04负责PostgreSQL分配账本与领取展示。4320服务由原Lead单写管理，我方不停止、重启、改代码或另派dashboard owner。用户U09新增架构tab同样由主线承接，具体任务ID/目标SHA待其回传。

我方负责提交用户需求与canonical status来源，核对领取/来源是否真实呈现。手填进度只在各唯一status，JSON/网页派生；assignment账本只记owner/lead/scope/claim/handoff，不复制TODO/check/review。分支实现、检查、独立审查和main集成分开，缺失/过时/失败标未知，不猜百分比或ETA。

## 已落实的来源方案

管理准备nested计划中的P01/M02/I01/PERF均已受控转交独立平级canonical planDir，旧三件套改只读stub。因此没有为注册而放宽nested路径限制，也没有第二手填status。五源及路径见[集成清单](../../../docs/evidence/web-platform/integration-checklist.md)。root于03:12:04.035Z实核五源human字段完整、PERF claim匹配、unregisteredAssignments空。管理者03:17:14.324Z专项比对main8c57的17原ID与实际30源，全部保留，见[核验摘要](../../../docs/evidence/web-platform/dashboard-source-verification.json)。

D04领取详情已经root实际CUA验证ID/version/lead/worker/scope/branch/时间，M02v2移出三文件→I01v1取得的committed receipts也已实读存证。领取数不是agent数；零literal重叠不代表功能逻辑绝无重复。

## 新架构tab协作验收

父U09原话为“把产品Web UI打开留着可随时看，且工程dashboard增架构tab”，由原Goal Owner逐字转交。主线唯一owner建立该tab，提供canonical计划、实际可访问入口和检查/审查目标；本计划仅确认链接与需求覆盖，不自行定义第二架构事实源或代写其实现。收到交付后只读验入口与来源，若未实现保持pending。

## TODO

- [x] **WPF-D01-01** 将紧凑视觉/高层语义需求及管理来源清单交主线D03，确认唯一owner边界。
- [x] **WPF-D01-02** 只读确认17原来源保留，新增WPF来源正确且当前未知项诚实显示。
- [x] **WPF-D01-03** 完成子计划唯一来源方案：独立平级canonical注册、旧nested转stub，不放宽路径校验；记录实际入口与验收边界。
- [ ] **WPF-D01-04** 将U09架构tab需求关联主线canonical计划，并在交付后只读确认可访问入口与来源。

## 未验证与来源

工程dashboard实现行为、双主题/窄屏/键盘、安全测试和发布review均由其主线owner负责；本协作检查不冒充重新运行那些测试。root部署后发现详情用户决定仍读旧章节导致NONE显示未知，已交原dashboard owner；我方不写app.js，不因此撤销领取功能验证。详情见[研究台账](../../../docs/evidence/web-platform/research.md)。
