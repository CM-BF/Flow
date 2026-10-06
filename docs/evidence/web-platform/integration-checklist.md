# Web 平台跨 owner 集成清单

2026-10-06 02:15 UTC；这是路径、接口及待集成项登记，进度事实以各唯一status为准。原Execution Lead单独负责集成main、根lock、总索引与4320；我方不修改这些文件/服务。

## Dashboard来源增量

保留主线最新17来源；只追加以下父管理源（没有第二手填进度）：

```json
{
  "id": "WPF-001",
  "title": "Web 平台持续执行",
  "role": "工程协作",
  "worktree": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management",
  "branch": "codex/web-platform-management",
  "planDir": "plans/web-platform",
  "evidenceDir": "docs/evidence/web-platform"
}
```

子项WPF-P01、WPF-D01、WPF-PERF01当前权威status分别在`plans/web-platform/{plugin-system,dashboard-followup,performance-cycle}/status.md`。当前registry只允许一级planDir，暂不声称可聚合nested路径；Lead可先登记父项并做受限下钻，若扩展路径必须补白名单、穿越/绝对/编码/realpath测试并维持唯一来源。源注册后只读核对原17源仍在、WPF-001 owner/TODO/source/live HEAD/dirty正确且无解析警告；子项未登记明确标记。

D03由主线单owner实现紧凑中性视觉及高层语义，包含当前阶段/当前工作/下一交付/真正决策、历史下钻、实现review与metadata区分、已集成main与旧SHA区分、过滤“无”。我方WPF-D01只协作登记需求与来源，不派重复实现、不切换4320。

## 当前实现边界与版本

| Owner | Worktree / branch | 独占写入 | 依赖与交接 |
| --- | --- | --- | --- |
| w01_owner | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web` / `codex/m1-web` | apps/web、plans/w01-web、docs/evidence/w01；workspace子目录在panels提交合入前不并发改 | 官方Thread基于已装assistant-ui0.15.23兼容registry；registry全部精确依赖版本以该树package.json及证据为准。根lock只按原handoff临时安装例外，交patch后恢复，由Lead统一集成 |
| workspace_panels_owner | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-panels` / `codex/web-workspace-panels` | apps/web/src/components/workspace、docs/evidence/w01/workspace-panels | 固定AI Elements源码6a9d5b1822ffb10bba4bd97175f01edd7d8651cd，Apache2.0；ansi-to-react6.2.6与W01统一管理；组件SHA交W01显式cherry-pick复验 |
| d01_owner | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management` / `codex/web-platform-management` | plans/web-platform、docs/evidence/web-platform | 纯管理文档，无生产依赖；固定base d444608ab6c796c731e44e51a892868bf39bec2a |

## 共享能力需求（不在当前W01伪造）

- 现冻结契约仅TimelineEntry text/reference与Detail kind/content/mediaType；无真实PTY会话、stdin/stdout通道、文件目录list/read或可信path。当前UI明确任务输出/任务产物，未来能力由Lead统一contracts/client及权限边界后消费。
- 主线M02提供跨任务工作记录/决策接口SHA与例子后，由W01明确消费接缝；不在Web另造中心命令。
- WPF-P01是X01 Web插件host子项；请求Lead对齐能力ID/权限作用域/API版本/第三方隔离/配置与完整npm生命周期。原P01协议计划不改名、不抢共享接口。
- 原Lead更新plans/README总索引和派工交接，登记WPF-001及三个子计划关系。只有实际实施owner转移时受控修改权威来源，不能任意树的陈旧status覆盖owner。

## 验证与交付门槛

当前新代码先测本模块及直接依赖；共享接口变化才测链路，metadata只核对内容/链接/ID/diff。W01仍须真实新任务/拒绝失败草稿/迟到受理关闭、双task观察、split/merge、详情隔离/懒读、显式cancel和keyboard/主题/窄屏；fixture与真实中心严格分开。最终回传完整SHA、dirty、启动URL、检查scope、双主题截图、官方来源/技能/clean-code、未验证及reviewtarget，不把候选commit当approval。
