# WPF-ATTACHI02 review

**状态：NOT_STARTED**

Review target commit：9eec51b72c6432b5b41df52f5b8fa783eb45e65b

Base：1c4968354dabce1e6748f3301a2e6eecd33e77d4

完整候选已固定，22声明apps路径（13生产+9测试，其中既有queue test未变）。独立review须核[source manifest](../../docs/evidence/wpf-attach-i02/source-manifest.json)与实际源码、公共matcher/授权/稳定view、原key/recovery、pending hold、official prepare failure/cancel及精确自动/显式remove、fixture期限/清理。作者检查与原始边界见[README](../../docs/evidence/wpf-attach-i02/README.md)。

root提前只读预审/纯内存诊断已促成本轮修复：全局journal不再pin无关空view；mixed准备失败/取消后直接移除complete项与Input一致。原始JSON和红绿日志保留；这些不是整体固定候选批准。主线/真实provider/后继context-history producer组合未验，原五module/共享/官方Thread不改。

待独立review结论。main尚未接收，不把作者局部通过或空模板当APPROVED。

## 2026-10-06 12:49 root 技术独审进展

[原样记录](../../docs/evidence/wpf-attach-i02/root-f82-technical-review.json)：191/191（7文件）独立通过，source/claim、原模块和官方Thread零改、15轮cleanup、unknown重试同key/body核查通过。最终APPROVED尚待390px合法长文件名补验；首定向轮因采样器filechooser Promise异常未到布局，不是产品失败，也不是通过。

12:55 UTC长名风险已实际复现：合法ASCII及中文/emoji255单位名称导致双主题390px Dialog横向388→1740px；布局断言失败，键盘recovery/Escape及草稿保持通过。原产品f82未改，申请原模块UI两文件后修复；最终结论仍待root。

## 正式 finding：P2 长文件名窄屏溢出

Root确认f82 REQUEST_CHANGES：合法255字符文件名在390px使按钮横向溢出，聚焦恢复项会把视口内容移出。此前191项功能审查保持有效；仅最小AttachmentPicker/样式两文件修复及定向longnames复验待实施，需先取得原claim的26scope COMMITTED回执。

## 修复待复审 2026-10-06 12:58 UTC

正式历史：f82 REQUEST_CHANGES/P2长名溢出，191独立功能检查保留。新target 9eec51b72c6432b5b41df52f5b8fa783eb45e65b 仅2UI展示文件+定向browser脚本delta；v3明示新增写权。最终actual App longnames2项通过、浅深390几何和键盘恢复/草稿保持，Webtypes0；single-flight采样器失败保留，按实际ready串行后通过。新整体结论待root，不自动继承f82技术检查为最终APPROVED。
