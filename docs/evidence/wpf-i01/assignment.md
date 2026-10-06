# WPF-I01 领取与初始化证据

2026-10-06 03:00 UTC。唯一 writer：workspace_panels_owner；lead：external_web_d01_owner；模型 gpt-6-astra ultra。正式规则已读取主仓 `AGENTS.md` 多 Lead 章与 `docs/evidence/d04/README.md`，并读取新树 AGENTS/plans 规则。D04 是同机合作领取，不声称 OS 隔离。

1. 创建前核实目标 worktree 与分支不存在。获 root/manager 明确许可，仅从 `c526c1c889437ee39155d669921577995195c74e` 初始化 `web-plugin-integration` / `codex/web-plugin-integration`，现场 HEAD 相同且 clean；未安装/合 P01/改文件。
2. 旧 M02 owner 明确停写 App.tsx、TaskThread.tsx、WorkspacePanels.tsx 后，MainLead 原子 amend：requestId `wpf-m02-stop-three-paths-20261006`，claim `dea92c6b-3450-404c-a32c-3fd007485ac6` v2，committedAt `2026-10-06T02:58:05.940Z`。三路径已移出，旧树不恢复写。
3. MainLead I01 take：requestId `wpf-i01-plugin-integration-20261006`，claim `b6666c29-ebc5-47b2-b754-55b62687fd00` v1，writer active，committedAt `2026-10-06T02:58:06.016Z`。原始无凭据 [take receipt](take-receipt.json) 与 [M02 amend receipt](m02-amend-receipt.json) 保留。
4. 约 02:59 UTC 在主仓安全 source `/tmp/flow-coordination.env` 后，Node24 运行 `apps/execution-dashboard/src/coordination/cli.mjs list`，只读筛选三个 WPF claims；I01 v1 active、M02 v2 active、P01 v1 active，全部 `needsVerification:false`。没有输出/提交环境凭据。
5. receipt 的 11 项 literal scope 与实际新树/branch 一致；本段派发仅文档初始化。P01 e534 PH-R4 REQUEST_CHANGES 期间不合入代码、不安装、不修改 App。新工作再次 live 核验，scope 增改必须新 committed receipt。

## 精确 scope

```text
apps/web/src/App.tsx
apps/web/src/TaskThread.tsx
apps/web/src/components/assistant-ui/elements/thread.aui.tsx
apps/web/src/components/workspace/WorkspacePanels.tsx
apps/web/src/plugin-integration
apps/web/src/themes.ts
apps/web/test/plugin-integration.browser.ts
apps/web/test/plugin-integration.config.ts
apps/web/test/plugin-integration.test.ts
docs/evidence/wpf-i01
plans/wpf-i01-plugin-integration
```

排除 `apps/web/src/plugins`、plugin-host 测试、shared/backend、其他 owner 工作树。受控集成只应用已审提交，手工冲突不借 integration 绕过 scope。本段未声称占有新的实现能力或完成独立 review。
