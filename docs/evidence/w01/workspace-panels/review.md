# Workspace panels 独立审查

| 字段 | 记录 |
| --- | --- |
| 结论 | APPROVED（仅以下 target 和 scope） |
| 记录时间 | 2026-10-06 02:19 UTC |
| Reviewer | root 协调者，只读独立审查；由 d01_owner 执行管理者正式回传结论，本 owner 转录 |
| Base | `b04df95821a55384c55c833e94405daaf35af8ad` |
| Final target | `46a1dbd60aa57a464d67e5ac3d39cb2673706c36` |
| 行为复审 target | `48069afb53b44dfebae3b83226bc749e7a979385` |
| 范围 | `apps/web/src/components/workspace/**` 与独立组件 fixture/证据 |
| 最终 blocking | 无 |

## 已执行的独立检查

root 读取完整组件源码和固定来源，独立运行 typecheck：0 diagnostics；通过真实 CUA 操作组件 fixture。首次 FileTree Enter 打开 report 后焦点在新活动 tab、请求计数1；Delete 关闭后焦点落相邻 Terminal；Files 中缓存 Space 重开后焦点回 report tab，请求计数仍1。抽查 dark Terminal 与 390px light 窄屏截图。

`48069af` → `46a1dbd` root 追加只读 diff 核验：只有2个文件4行 `data-extension-slot` 属性，无接口、行为、样式改变，工作树 clean。行为复审结论连同此明确 diff 核验绑定最终 target。owner 的13组 Chrome fixture回归与截图另见 [validation.md](validation.md)，不冒充 root 重跑了完整13组。

## Finding 与修复

| ID | 严重性 | 原 target / 复现 | 修复 | 复审 |
| --- | --- | --- | --- | --- |
| WP-R1 | P2 / blocking | `a2be896405304111379d72e9b22e46f8e47a11a4`：Files 中聚焦 Verification results，Enter打开详情后懒读+1，但原tree卸载使焦点落AXWebArea/body | `48069afb53b44dfebae3b83226bc749e7a979385`：记录待聚焦tab，挂载后layout effect聚焦；首次与缓存打开均有浏览器断言 | CLOSED；root 首次Enter/缓存Space/Delete邻项 CUA复核通过 |

## 明确限制

本 approval 不覆盖 W01 整体新 shell、真实中心联调、PTY、任意文件系统、已实现 plugin host。4个 DOM 标记只是后续扩展接缝。引用内容来自当前 task 的 props，组件不缓存第二套业务事实。

本记录随后的 metadata 提交不是新的 implementation review target；W01 cherry-pick 后需在自己的唯一 status/review 中保留实现来源和整体审查绑定。没有 merge main，没有推断 main 已集成。
