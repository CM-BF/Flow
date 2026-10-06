# Workspace panels 验证

2026-10-06 02:14 UTC，组件候选基于 `d54e9983f60bfd63fa5df290cb51c1f5c5659af1`；本目录提交包含随后兼容性/布局修复。独立 review 尚未执行，W01 最终 review 必须绑定集成后的具体提交。

独立组件 fixture URL：`http://127.0.0.1:58077/preview.html`（Vite 动态端口，进程仅本 owner 管理）。此地址明确显示 Component fixture，不是真实中心联调。W01 owner 接入产品后负责完整回归与 dashboard 状态同步。

验证命令（独立树根；`FLOW_WEB_TOOLING_DIR` 使用 W01 已安装依赖，不改其文件）：

```sh
export FLOW_WEB_TOOLING_DIR=/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web/apps/web
/opt/homebrew/opt/node@24/bin/node docs/evidence/w01/workspace-panels/typecheck.mjs
/opt/homebrew/opt/node@24/bin/node "$FLOW_WEB_TOOLING_DIR/node_modules/vite/bin/vite.js" --config docs/evidence/w01/workspace-panels/vite.config.mjs
FLOW_WORKSPACE_PREVIEW_URL=http://127.0.0.1:58077 /opt/homebrew/opt/node@24/bin/node docs/evidence/w01/workspace-panels/browser-checks.mjs
git diff --check
```

结果：组件 TypeScript 0 diagnostics；Chrome headless 浏览器 12 组行为通过，0 page errors；diff whitespace 通过。结果 JSON：`browser-results.json`。

浏览器覆盖：FileTree 单 tabstop、方向/Home/End/Space；详情首次激活才请求；内容转义与产物版本/任务验证；tabs 箭头只移焦点、Enter 激活；关闭焦点转邻 tab；明确错误/重试；终端只读/暂停追尾/恢复追尾；clipboard 拒绝/成功反馈；双主题与减少动画；A→B→A 布局恢复及相同 referenceId 的 props 数据隔离；390px 窄屏不超宽；无任务状态清除当前引用 tabs。

截图：`light-files.png`、`dark-files.png`、`light-terminal.png`、`dark-terminal.png`、`light-artifact.png`、`light-narrow.png`、`dark-narrow.png`。截图经视觉查看；修正了窄屏 tab 图标挤压以及底部复制提示出现后追尾高度变化的问题。

## Clean-code 实际记录

| 时间 UTC | 范围 | 发现和修复 | 限制 |
| --- | --- | --- | --- |
| 02:08 | 首段实现/上游组件 | 保留官方组合结构；将 tabs、显示内容、官方源分别集中；没有引入第二套业务状态或虚拟PTY。明确共享依赖由W01写入。 | 首候选需浏览器验证 |
| 02:12 | 浏览器真实故障与审查反馈 | 找到 ansi-to-react 6.2.6 CommonJS default 在 Vite8 返回 namespace object，导致 TerminalContent 崩溃；加局部兼容适配。W01 owner 已确认其实际app同样复现。 | 只对实际发布包的两种导出形式适配 |
| 02:14 | 交付前布局/可访问性 | 缓存每task纯布局，移除每个close图标额外tabstop（Delete可关闭），controlled activeTab同步单焦点入口；已选引用分组变化时展开其真实group；复制失败显式反馈，ResizeObserver仅在追尾时保持底部。 | 父级提供的details必须属于当前task；组件不保存detail副本 |

未验证：实际中心 HTTP/SSE 与该新版完整 shell 集成、真正 PTY、任意工作区文件系统、Safari/Firefox、真实屏幕阅读器。无可调用 PTY/fs 契约，不将只读组件测试声称为这两项后端能力。fixture 的 clipboard 成功/失败为浏览器API显式模拟。

授权写入范围以外无修改；没有 merge main。部署、依赖根 lock 与正式集成仍由原 Execution Lead / W01 owner 处理。
