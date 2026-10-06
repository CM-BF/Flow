# WPF-CONTEXT01 知识上下文选择模块

2026-10-06；in-progress。原 U11 / REQ42 的独立模块片，方案已由 root/manager 批准。

让用户搜索项目知识、明确选择不可变版本引用并按需展开正文；本片不接入 Send/Queue。固定基线 b54de1dbb08e3ccc7d33a27295a318f2799e76ae。唯一 writer w01_owner / gpt-6-astra ultra。父入口为 [Web 平台管理](../../../web-platform-management/plans/web-platform/plan.md)。

公开 Interface 在 [interface](../../docs/evidence/wpf-context01/interface.md)。只有固定 project/view/connection 的宿主窄 search/resolve port，不暴露 client/token；host readiness 可更新但绑定不可变。hide/offline/revoke/dispose 阻止新读并使迟到失效。引用深冻结、保序，最多4项、locator总计8192 UTF8 bytes。搜索最大256 UTF8 bytes/20 hits，短excerpt与whole citation分开；明确展开才resolve≤4096。中心执行输入总预算拒绝仍保留draft/refs，模块不注入prompt。

预算：只保留最近一次搜索的20hits；最多4选中引用；正文LRU最多8项/32768 UTF8 bytes；同一时刻1搜索+2正文请求，无隐式排队或分页，每请求15秒本地deadline可释放占位，不依赖port遵守abort。显式重试；取消生命周期后无自动重读。UI紧凑原生checkbox/button/details，不自造Dialog/focus体系、URL状态或虚拟化。现有公共契约、App/Thread/会话/Queue/薄reader保持只读。

- [x] WPF-CONTEXT01-01：独立选择/请求生命周期与紧凑组件。
- [x] WPF-CONTEXT01-02：局部模块与HTTP fixture、390双主题键盘/减动画验证。
- [x] WPF-CONTEXT01-03：固定提交独立review与main交接。
- [ ] WPF-CONTEXT01-04：后继正式Send/Queue引用传递、ACK核验与实际App接线（另领，不属本片）。

原始[领取](../../docs/evidence/wpf-context01/take-receipt.json)、[状态](status.md)、[审查](review.md)、[质量](../../docs/evidence/wpf-context01/quality.md)。本片架构影响是新增前端选择模块，P01宿主接线与图更新由Lead在实际集成时协调。
