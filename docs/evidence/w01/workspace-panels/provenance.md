# Workspace panels 来源与实施记录

Owner: workspace_panels_owner，派工模型 gpt-6-astra / ultra。独立 worktree `web-workspace-panels`，branch `codex/web-workspace-panels`，起点 `b04df95821a55384c55c833e94405daaf35af8ad`。只写 `apps/web/src/components/workspace/**` 和本证据目录；W01 owner 维护唯一 `plans/w01-web/status.md`，本文件不是第二份任务状态源。

## 官方组件

直接复制 Vercel AI Elements 固定 commit `6a9d5b1822ffb10bba4bd97175f01edd7d8651cd`：

| 文件 | 原始路径 | 下载原始 SHA-256 |
| --- | --- | --- |
| `ai-elements/terminal.tsx` | `packages/elements/src/terminal.tsx` | `04b9b534925054cfe67fdc3bc212eb7261b4912e6e970c4844a195907d3a9a93` |
| `ai-elements/file-tree.tsx` | `packages/elements/src/file-tree.tsx` | `9b6946171369d224d5d10df686c3c18ce7608aa4a4792744fc5c313499cec0cb` |

来源：[Terminal](https://github.com/vercel/ai-elements/blob/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/packages/elements/src/terminal.tsx)、[FileTree](https://github.com/vercel/ai-elements/blob/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/packages/elements/src/file-tree.tsx)。当前[Terminal 文档](https://elements.ai-sdk.dev/components/terminal)与[FileTree 文档](https://elements.ai-sdk.dev/components/file-tree)已核对。

原始源码 Copyright 2023 Vercel, Inc.，Apache License 2.0；见本目录 `LICENSE-ai-elements.txt`。复制后的实际更改：相对 UI imports、主题 tokens 代替硬编码黑底、复制按钮可访问名/重复计时器清理、减少动画、FileTree treeitem 语义/单 tabstop/方向键/Home/End/Space 默认行为。保留官方 composable components 和上下文结构，不以自制 div 冒充组件。

依赖统一由 W01 owner 增加：`ansi-to-react@6.2.6`（React 19 peer、内置类型，BSD-3-Clause），以及官方 shadcn Button/Collapsible、cn、Tailwind 4。此分支不修改 manifests 或 root lock。

## 数据接口与限制

`WorkspacePanels` 接收 `TaskSnapshot|null`、detail cache、onLoadDetail、connection 和可选受控 tab。详情打开才请求；箭头键仅移动 tab 焦点，Enter/Space 激活。关闭 detail tab 是本地视图操作，不取消任务。每 task.id 隔离视图状态。

Terminal 显示真实中心 `TimelineEntry.kind=text` 文本，名称为 Task output、标明 read-only。它不是 stdout 分类或 PTY。FileTree 仅显示中心返回的 id/title 引用，已加载后按 Detail.kind 分类，不从标题猜磁盘路径。缺少 PTY session/create/input/resize/stream/close 和 workspace list/read/path metadata 公共接口；未扩展 shared contracts。产物显示中心返回版本和任务级 verification，不把任务验证冒充单文件独立验证。

## 技能发现与使用

按本地 `find-skills` 方法识别 React 展示/组件/可访问性任务，本地已有匹配技能，未重复联网安装：

- `/Users/citrine/.agents/skills/ai-elements/SKILL.md` 与 `references/{terminal,file-tree}.md`，来源固定 `6a9d5b1`：使用真实官方复合组件与 callbacks。
- `/Users/citrine/.agents/skills/assistant-ui/SKILL.md`，来源固定 `139674dc888ee076982b6726e8e6f5d0fe0b5f67`：核对 llms.txt；遵守中心投影，不引入独立聊天业务状态。
- `/Users/citrine/.agents/skills/clean-code/SKILL.md`，指定源 sickn33/agentic-awesome-skills@`bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`：分离 tab 布局、数据展示、上游组件；错误显式展示。
- 本地 `codebase-design`、`vercel-react-best-practices`、`frontend-design`、`webapp-testing`：一个 props seam 接入投影；只有活动内容挂载；按用户紧凑中性工作区设计；浏览器验证键盘/主题/窄屏。
- 本地 `brainstorming`：本次是用户明确指定并授权的现有工作区重做；已把紧凑 tab、真实官方组件与数据边界发给管理者/W01，不重复要求设计批准。

## 验证方法

`preview.html` / `preview.tsx` 是明确标记的组件 fixture，不是真实中心联调。以 `FLOW_WEB_TOOLING_DIR` 指向 W01 的 `apps/web` 运行 `typecheck.mjs` / `vite.config.mjs`，只读借用其已安装依赖与 ui/cn；不会运行 install 或修改其他 owner 文件。经管理者允许，本树已忽略的 node_modules 目录中临时 symlink 指向 W01 packages；Vite cache 写本树 ignored node_modules。

完整行为检查、截图与 clean-code 结果见 [validation.md](validation.md)。独立组件审查与准确提交绑定见 [review.md](review.md)。
