# WPF-MESSAGESETTINGS01 独立审查

**状态：UNKNOWN — 完整片段的运行验收尚未完成。**

Review target commit：1cd5cd41e47c8c101d9bb1acfdca1e870769c014。新目标仅browser fixture扫描一行；新delta与/tmp启动修复尚待独审，NOT_STARTED。Base：8d84d529a0756116bd0fc8bad969d61a6c26248e。
历史f3限定源码结论：**APPROVED_SOURCE_SCOPED_NOT_RUN**，不自动批准上述新目标。Root 于 2026-10-06T18:25:38.301159Z 完成 f3a6 复审，源码无 blocking。该结论为18:25源码审查时点；后续 strict noEmit/direct37 的限定证据已独立接受，后续浏览器入口首次执行在CDP前失败、0界面断言，不构成完整功能或 main/deployment approval。

## 已执行的源码审查与历史

Root 对初版 `ed769f929a7efe01a279ddd85c2e1e88b46839e6` 只读源码检查指出 P2：当前草稿区的连续长 requested.model 没有 min-width/overflow-wrap 保护，390px Dialog 可能横向溢出。此为源码发现，未执行浏览器，不伪称实跑红。

Owner 在 `f3a6a7ec89d5b3f789c49b0d8662401b23032ab2` 仅给既有 section 添加 minWidth:0 / overflowWrap:anywhere，并将 disabled thinking 明确显示“关闭思考”、effort 映射中文。browser 只同步“力度高”文本，原180字符 model、390几何/焦点/A-B-C验收全部保留。Root 已独立核对修复，P2 为 ADDRESSED_IN_SOURCE；真实390运行确认仍 NOT_RUN。

Root 转述 peer 对 catalog/selection/direct 源码未发现 blocking；此不是产品测试通过或完整 leaf approval。原件已逐字归档：[root](../../docs/evidence/wpf-message-settings/root-f3-source-review.json)、[peer](../../docs/evidence/wpf-message-settings/peer-ed769-source-review.md)、[peer audit](../../docs/evidence/wpf-message-settings/peer-ed769-source-audit.json)。

## 审查入口

[计划](plan.md)、[状态](status.md)、[当前六源绑定](../../docs/evidence/wpf-message-settings/source-manifest.json)、[初版绑定](../../docs/evidence/wpf-message-settings/source-manifest-initial.json)、[Interface](../../docs/evidence/wpf-message-settings/interface.md)。核公共 tuple/capability、旧目录兼容、取消代际、受控选择和 details 关闭焦点回调。当前目标一行fixture修复已固定，原f3类型/direct检查已完成；原准备已审而新启动修复待独审/准入；真实App/Send/Queue/Recovery后继。

## 已执行的运行证据独立核验

[首次 raw](../../docs/evidence/wpf-message-settings/checks-first-observation.json)绑定 f3a6/85aba：strict noEmit exit0，两 direct37/37。监督器 expected20 漏计17个参数化用例，原父 FAIL、binding/gate/raw 保留。[Root限定证据审查](../../docs/evidence/wpf-message-settings/root-direct-evidence-review.json)已核实际21+16项、六源码及原raw，接受类型/direct PASS与独立父计数错误分类；并未重跑产品。无 pending计数判断或本地重试。

## 浏览器准备限定审查

Root 于18:48:17 UTC给出[APPROVED_BROWSER_PREPARATION_SOURCE_SCOPED_NOT_RUN](../../docs/evidence/wpf-message-settings/root-browser-preparation-review.json)，peer给出[APPROVED_WORKER_SOURCE_SCOPED_NOT_RUN](../../docs/evidence/wpf-message-settings/peer-browser-worker-review.md)。最终 supervisor 删除scratch前采样且结果写后复核；[初稿 P2](../../docs/evidence/wpf-message-settings/root-browser-supervisor-initial-review.json)与[窄修差异](../../docs/evidence/wpf-message-settings/browser-preparation/final-resource-sample.diff)分别保留。完整源/依赖/准备脚本 pins 见[归档索引](../../docs/evidence/wpf-message-settings/browser-preparation-archive.json)。

以上为运行前SOURCE_SCOPED批准。随后首次入口已按独立gate执行，实际结果见下节，不能把准备批准当运行通过。完整 feature 顶层 UNKNOWN 保持，main NOT_INTEGRATED。已冻结 A/B 样本只属本地 capture，不代表实际 Send/Queue/Recovery。

## 首次浏览器入口运行（已限定独立证据审）

[原始记录](../../docs/evidence/wpf-message-settings/browser-first-observation.json)绑定 f3/f800，5197ms、父FAILED，0行为断言/截图。Chrome在CDP readiness前退出；原日志含ProcessSingleton目录失败及Crashpad写入拒绝，Vite另报自动扫描非fixture图依赖未解析。尚无产品UI行为红/绿结论。ownPGID/Chrome/fixture/scratch清理均确认、无错误，窗口已归还，未重试或扩大权限。完整feature仍UNKNOWN；strict noEmit/direct37证据及父计数FAIL各自保留。

## 当前待审的窄修

目标 `1cd5cd41e47c8c101d9bb1acfdca1e870769c014` 只将Vite optimizeDeps.entries指定为已有实际fixture。新 `/private/tmp/msgset-b2` 保留原first预算与raw，只修Mac临时目录/owned socket范围和Chrome退出证据；[源码准备](../../docs/evidence/wpf-message-settings/browser-repair-preparation/report.md)与[完整归档](../../docs/evidence/wpf-message-settings/browser-repair-preparation-archive.json)供独审。没有新gate/运行；原f3批准、37direct和5197ms失败分别绑定原目标。[Root首次证据审](../../docs/evidence/wpf-message-settings/root-first-browser-evidence-review.json)原样保留，不能将父worker code推作Chrome code。
