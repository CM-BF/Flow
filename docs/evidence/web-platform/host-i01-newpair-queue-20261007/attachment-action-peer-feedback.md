# 附件行动作接缝：实施前的窄补充

结论：支持先做两个真实位置的 **preview-only** 插槽；下列三点应成为实现接口约束。它们是固定源码支持的设计缺口，不是本次实际复现。读取仅原7源，全部hash匹配 `9a815eca7b86791733a57b29c21a1a5cea58ec0a`；未读controller/adapter/App/ConnectionSession的新源码，未运行、未改项目。

1. **草稿行展示与执行应共用同一成员投影，不能只在点击时补校验。** `AttachmentPicker.tsx:30,34–38` 仍枚举 `input.getSnapshot().items`；`plugin-integration/attachments.tsx:168–177` 明确该库存含held/inTransit，current returned/restored项优先。若只往现有每行放slot，会把held A显示为“当前B稿”，然后要么错误授权，要么展示永远拒绝的按钮。由binding给宿主行提供 `recoveryDraft()` 所用的同一投影（保有序pending/unknown，不把ready当membership），并按目标种类决定preview是否可用；不可复制过滤规则、排除所有held或从journal目录推当前稿。项目page行则独立核完整reference，不借draft成员身份。最小反例：held A/current B、已返还A优先、未验证项、移除后迟到preview不能重新显示为当前成员。

2. **公开connection/view/project不是完整的授权世代。** session `id` 是实例UUID（`session.ts:61–64`），现 `AttachmentView` 无principal/generation（`attachments.tsx:21–30`）；`sync():128–131` 只在readable/writable从true变false时换lease。若同实例同project在两次观察间换principal/auth generation且最终权限仍true，旧请求仍可能通过现有前后检查。新命令必须捕获宿主私有authority stamp并订阅其即时撤权；插件context只带公开身份，不能自行声明有效generation。需同时校验精确binding/projection实例，不能只重新find同viewId而接受替换对象。I01可复用“私有live key/订阅→撤旧lease”的模式，但其centerRuntime controller既非附件authority，也不能靠Settings卸载来清附件。七源中没有足够接口证明live stamp来源已存在，后继须先读真实App/ConnectionSession边界再决定最小接线；不得把 `updateActions` 在React重渲染时刷新当即时撤权保证。

3. **取消必须覆盖实际提交点；一次外层after-await检查不足。** `host.ts:359–367,414–420` 的command.signal来自插件session，覆盖卸载，未独立覆盖上述auth世代/成员变化；`attachments.tsx:147–153` 已合并binding lease，但没有本次row target成员/调用lease。报告要求核controller signal入口正确：还应核cache-hit返回及cache/UI写入之前的guard，不能只让HTTP完成后host返回失败。不要另建缓存；复用现有input的真实提交边界，是否已有signal/guard API本次未知。将来add/remove更严格：`react.tsx:271–275` 的composer.add/remove可以在await返回前已改稿，之后再throw不能撤回副作用；同view下A→B的新稿ownership也不在拟context中。第一片明确不授composer修改；后继修改命令须在同步实际mutation之前验证宿主捕获的“本次目的稿”lease，await后不得用旧ID清新稿或rollback B。现seven-source未读完整MSG私有port，不假定其方法名或直接把ComposerRuntime交插件。

## 最窄后继领取依赖

先preview-only：原7个literal中需要实施的 `plugins/{types.ts,validation.ts,host.ts}`、`attachments/AttachmentPicker.tsx`、`plugin-integration/{attachments.tsx,session.ts,react.tsx}`，加既有host/integration定向测试及原任务records；fresh逐literal核权，I01 session/react须明确停写并原子交权。`attachments/controller.ts` 先只读核HTTP/cache提交接缝，确需修改再精确追加该文件与其既有行为测试，不笼统领取整个attachments目录。若live auth stamp在当前私有AppActions不能取得，先读 `App.tsx` 与实际ConnectionSession所属路径，确认后仅追加必要生产literal；这不是已授App写权。

现有root方案中的严格context/完整ref/声明+宿主授权、preview与composer.write分离、真实两消费者验收继续保留，不再扩功能。恢复行、草稿add/remove及journal操作不借preview片自动开放。只读研究不替代实现或browser结果。

来源：[root固定报告](/private/tmp/root-attachment-action-seam-20261007/report.md) SHA `5ee8cb4bf12efaf8a9e2b4b58ad86a6c05f11bce6c51a24f11c4c56f9a344381`；七源清单 SHA `9a51c2aaf159e937d98ac2fdb9bbd1210eb4fa65d053b80f0a8c082ff4845ba7`。沿既有clean-code/codebase-design：一个成员权威、一个授权生命周期、私有端口；没有新增store/FSM/扫描器或未读API假设。
