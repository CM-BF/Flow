# WPF-MESSAGESETTINGS01 独立审查

**状态：CHANGES_REQUESTED**

Review target commit：f3a6a7ec89d5b3f789c49b0d8662401b23032ab2。Base：8d84d529a0756116bd0fc8bad969d61a6c26248e。
当前修复候选尚待独立复审；产品检查均 NOT_RUN。本页不构成最终 approval。

## 已执行的源码审查与历史

Root 对初版 `ed769f929a7efe01a279ddd85c2e1e88b46839e6` 只读源码检查指出 P2：当前草稿区的连续长 requested.model 没有 min-width/overflow-wrap 保护，390px Dialog 可能横向溢出。此为源码发现，未执行浏览器，不伪称实跑红。

Owner 在 `f3a6a7ec89d5b3f789c49b0d8662401b23032ab2` 仅给既有 section 添加 minWidth:0 / overflowWrap:anywhere，并将 disabled thinking 明确显示“关闭思考”、effort 映射中文。browser 只同步“力度高”文本，原180字符 model、390几何/焦点/A-B-C验收全部保留。修复事实待 reviewer 独立核对，未自行关闭 P2。

Root 转述 peer 对 catalog/selection/direct 源码未发现 blocking；此不是产品测试通过或完整 leaf approval。完整原报告收到后原样归档。

## 审查入口

[计划](plan.md)、[状态](status.md)、[当前六源绑定](../../docs/evidence/wpf-message-settings/source-manifest.json)、[初版绑定](../../docs/evidence/wpf-message-settings/source-manifest-initial.json)、[Interface](../../docs/evidence/wpf-message-settings/interface.md)。核公共 tuple/capability、旧目录兼容、取消代际、受控选择和 details 关闭焦点回调。当前实现/专测固定，等待复审及检查准入；真实App/Send/Queue/Recovery后继。
