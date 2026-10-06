# WPF-D01 Dashboard 协作需求与来源登记

创建/更新：2026-10-06。状态：`accepted`（方向已授权，实施排队）；唯一计划/status owner：d01_owner / gpt-6-astra ultra。父计划：[WPF-001](../plan.md)。固定基线 `d444608ab6c796c731e44e51a892868bf39bec2a`；当前文档在 `codex/web-platform-management`，不代表实现已开工。

## 唯一实施边界

此计划是协作登记，不是第二个dashboard实现。主线已登记D03并确认由其Execution Lead下一槽独占实现：紧凑中性工作台、高层只显示当前阶段/当前工作/下一交付/真正决策，历史资料下钻，实现review与metadata区分，main集成与旧SHA区分，过滤“无”决策。当前4320由主线单写管理，17来源；我方不得停止/重启/覆盖，也不另派dashboard视觉owner。原D01已交付只是历史，不用旧9源覆盖17源。

我方交付管理task的唯一status来源清单、用户视觉需求和只读核验。D03保留原全部17来源、来源/更新时间/live HEAD/dirty、未知/缺失/解析失败/过期、路径/realpath及HTML转义等现有保障；不计算无依据百分比或ETA。所有手填事实仍在各唯一status，JSON/网页只派生。

## 来源注册方案

首批登记 WPF-001：worktree `web-platform-management`，branch `codex/web-platform-management`，planDir `plans/web-platform`，evidenceDir `docs/evidence/web-platform`。详细字段见[集成清单](../../../docs/evidence/web-platform/integration-checklist.md)。本管理树中的子计划各自有status，但当前registry安全规则只支持一级planDir，不能无测试直接放宽。

先由Lead注册父管理task，子计划通过受限下钻展示；如要分别聚合子计划，Lead须受控支持明确允许的nested planDir并补路径穿越/绝对路径/编码/realpath测试，或后续授权迁移并更新唯一来源。未确认前不谎报已聚合。

## 验收与风险

实际dashboard JSON读取 WPF-001 的owner/TODO/status/source/live HEAD且不覆盖旧17源；只读验证无解析告警、来源路径正确，review/branch/main分别呈现。子计划未注册必须标待登记。主线D03负责双主题/窄屏/键盘截图和实现检查，我方只核对交接与需求追溯，不重复冒充其测试。

## TODO

- [ ] **WPF-D01-01** 将紧凑视觉/高层语义需求及WPF-001来源清单交主线D03，确认唯一owner边界。
- [ ] **WPF-D01-02** Lead登记后只读确认17原来源保留、WPF-001源正确且未知项诚实显示。
- [ ] **WPF-D01-03** 核验子计划下钻或受控nested注册方案，记录D03真实验收入口与未验证项。

## 来源与变更

需求见父计划U00～U07及稳定REQ表；工程研究/官方出处见[研究台账](../../../docs/evidence/web-platform/research.md)。2026-10-06首版：建立独立验收与唯一status/review；未实施事项保持pending。
