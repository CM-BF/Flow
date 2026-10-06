# WPF-VISUAL01 Arc式轻质外壳与材质

| 字段 | 内容 |
| --- | --- |
| 所属大task | [WPF-MATURE-01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-01-visual/plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| Owner / model | d01_owner / gpt-6-astra ultra |
| 固定基线 | 9d6bd45abdf5149bc44f1e9dc534454e7403f7d7，正式main接收；建树时现场main3d31、origin9d6，Web路径0diff，不追moving main |
| Worktree / branch | web-visual-shell / codex/web-visual-shell |
| 写权 | [35e5e5b9 v2 amend receipt](../../docs/evidence/wpf-visual01/amend-receipt.json)，九literal，新增仅plugins/builtins.ts与plugins/host.ts |
| 架构影响 | 展示tokens与builtin主题选择，不改服务/DTO/runtime；图不需新节点 |

## 设计与界限

中性轻质shell，正文保持不透明。浅shell #eceeed/正文#fff，深shell #181a1c/正文#222426；现系统字体，正文14px/约1.7行高，chrome11–12px；控件8px、composer12px、pane14px圆角，窄6pxgutter/细边框/轻两级阴影，焦点用边界。从现semantic palette派生，用户插件颜色覆盖继续有效，不新增SDK/依赖。玻璃只shell/sidebar/浮层，不把长正文/代码变成透明卡片；保守opaque底色，在支持backdrop时增强。reduced-transparency/motion、forced-colors与不支持backdrop各有安全路径。

预期显式Light opaque/Dark opaque选择复用Appearance。当前源码实证builtin manifest仅light/dark command、host.getThemes亦硬筛两ID；仅添加themes会失败。09:08 fresh无冲突并原子amend v2后扩builtin manifest/host两scope；核心主题从唯一themes定义产生白名单，原rail仍仅light/dark两按钮。插件材质radius/shadow/blur白名单仍仅颜色，是MATURE01后继，不用本片冒充完整扩展。App/Thread/validation由CONTEXTI持有，本片不碰。

## 稳定TODO

- [x] **WPF-VISUAL01-01** 固定设计/技能/基线、fresh无冲突take与唯一三件套；原7scope，现已按CAS扩至9scope。
- [x] **WPF-VISUAL01-02** 真实App shell/pane/type/material与显式opaque内建主题，保既有palette扩展和纯展示职责。
- [x] **WPF-VISUAL01-03** 自有HTTPfixture复用startStreamPreview；实际空态、长正文/代码表格、流、typed活动、错误、双主题1280/390/键盘与降级矩阵；sourcehash和真实截图。
- [ ] **WPF-VISUAL01-04** clean-code、固定target独审、正常push、主线接收/停止写入/release；本大task完整视觉仍开放。

## 验证

复用现public HTTP fixture但不改他人fixture，使用synthetic材料、0模型/DB/用户服务。局部Webtypecheck/build和自有browser，必要theme直接消费者；不为CSS写镜像测试。无变化快照/其他scope保护用Git核验，错误原log保留，metadata与产品target分别记录。普通进度只status→dashboard，只有完整大taskDone才对GO一次报告。
