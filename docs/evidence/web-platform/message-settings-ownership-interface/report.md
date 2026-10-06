# TODO-11：受控快速设置的草稿写入边界（只读提案）

固定 main `c8e2e9e56af4c3dd2975253e9e374f9ec3e09e05`；NOT_IMPLEMENTED / NOT_TAKEN / NOT_RUN。已交付270c组件不重写、不阻释放。复用原研究与peer三条件，五个固定源hash见 audit.json。

**推荐 required opaque draft token + 同步受控 CAS 回调；key/remount仅用于撤销旧界面。** 不增加草稿store、全局registry、授权协议或序列化token。

| 方案 | 可保证 | 不能单独保证 |
| --- | --- | --- |
| host key/remount / prop变化关闭弹窗 | 丢弃旧局部筛选，减少误操作 | 旧已排队callback、host已开始same-tuple新稿但React props尚未更新，仍可能写错稿 |
| 必填token仅在组件与props比较 | 拦截已渲染的身份变化 | 旧render闭包看不到最新host身份/授权；不是提交原子检查 |
| 必填token随受控回调返回host同步核验 | 在真正写入点拒绝陈旧归属；同tuple新稿也可区分 | 正确mint/rotate、live authority及Recovery交错仍须真实host接线验收 |

最小建议保持 `value` 为唯一C、私有候选只属于打开的Dialog。现 `onChange` 变为同步条件提交（类型名仅示意，非新公共DTO）：

```ts
draftOwnership: object; // 不透明、不可复用身份；无凭据，无持久化
onChange(next, expectedOwnership):
  { kind: "applied" } | { kind: "stale" } |
  { kind: "unavailable"; reason: string };
```

打开时保存 token 与规范化controlled C基线，不保存第二份权威草稿。Apply先用最新可见目录/context运行原capture，随后把opening token与完整next传给宿主。**host回调必须访问当前唯一draft owner，而非信任该render闭包**：同步比较expected token、当前view/connection/draft归属，再核当前live authority/exact profile/完整tuple，然后原子写C并推进revision；整个compare→validate→write不得await。旧callback即使组件已卸载也只得到stale，不写、不清候选对应之外的新稿。暂不可验证返回unavailable，保C与局部候选并说明原因；成功后才关闭。已有host窄guard若提供相同原子语义，直接适配它，无需第二CAS实现。

token来自现有owner的不可复用draft/settings revision或lease；next-draft、同tuple外部重设/Recovery恢复、真实view或connection更换、授权撤销/重建必须换代。连接恢复后不能复用撤销前token。对仅目录追加无关profile不机械换代：按当前合法域重验即可。若宿主现有完整草稿lease对text/intent/material编辑也换代，可沿用其更保守语义，不另造镜像revision；具体绑定需读正式接手host。组件可即时disable/标“草稿已更新，请重新打开”，但即使effect尚未执行，host guard也阻止写。**显式omit走完全相同ownership guard**；capture(undefined)原本直接返回，不能借它绕过身份核验。新token下主动omit可按宿主纯文本政策允许；权限丢失不得自动omit。

仅当前授权profile的≤32声明tuple投影为模型/思考力度/速度筛选。私有筛选不调用onChange；无匹配保留可见选择和键盘清筛选出口，不选最近/首项。pagination缺目标、refresh失败/撤cap保旧C；补页后重新核完整identity，不能仅看model。唯一匹配仍需Explicit Apply。A已发送/B队列由原receipt owner只读展示，永远不传给此编辑回调。requested不冒observed。

## 最小候选与交权

组件/同型fixture可先决定接口和投影，候选仅以下4个literal（NOT_TAKEN，旧8范围已释放；后续须新独立树/fresh claim，own plan/evidence由manager正式派工绑定）：
- `apps/web/src/execution-profiles/ExecutionProfilePicker.tsx`
- `apps/web/test/message-settings.test.ts`
- `apps/web/test/message-settings.fixture.tsx`
- `apps/web/test/message-settings.browser.ts`

现公共catalog/selection codec可复用，暂不列修改；若必须改纯helper先给具体必要scope。真实消费者窗口至少核 `apps/web/src/App.tsx` 与 `apps/web/src/conversations/ConversationThread.tsx` 的唯一draft/session authority；后续Send/Queue冻结需各自projection/outbox/queue owner合法交权，Recovery需其固定新输入/接口，不能复制moving恢复实现。固定c8e App:238/370/955仍是旧profileSelection，Thread:11/56–58/163/186/208仍用旧Picker与创建profile；没有现成message-settings写owner可假称已具备。token leaf接口批准不等于这几个host已接通。

## TODO-11必要后继验收（本轮均未运行）

1. 暂存Y后host把C改Z、same-tuple新稿、同profile切pane、旧callback在unmount后执行：Apply与omit均stale/0写；正常同token提交只改原C一次，A/B字节不变。
2. host已换代但props仍旧、授权撤销再恢复、Recovery异步完成或提交接管→next-draft：以真实host条件提交函数核compare/write，同稿ABA也拒；不得仅mock callback接受来自组件的token。
3. 不相关分页可重验候选；refresh删tuple/401/cap未知禁止Apply且保C；两条不相容声明tuple形成筛选空集，键盘可清局部筛选退出。390双主题/长model/focus与details导航按新target验证。

源依据：Picker:89–100受控props无ownership；129 omit直接onChange、133选择只capture；selection:140–159验证tuple但不识别稿代际，undefined提前返回。以上是未来staged-controls接口约束，非已交270c即时radio的新bug。本轮只有固定git show与/tmp文本；旧37/direct与4/browser不作为新接口证据，无运行/资源采样。
