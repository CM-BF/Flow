# 刷新自然焦点窄修复 / 未复验

固定source `a952ae81fefd3a82c9dfe42067048bcf2702d1c3`，基于已消费b1的0bc。只改组件两个只读刷新按钮为现Registry/Paging同型 `aria-disabled` 加pending guard，保焦点且pending不重复读；不触启停命令或UNKNOWN identity。原键盘旅程在focus/Enter之前确认enabled，之后等待真实decoded count+1与pending解除，再保原toBeFocused。没有末尾focus、增加timeout、select/value替代或删六组断言。安装记录刷新采用同一guard；此次原六组不冒独立安装记录键盘覆盖。

[五源与准备hash](source-manifest.json)。source fixed，NOT_RETESTED；原strict/direct不重跑、不继承给改过组件。[首失败独审](../browser-b1-actual/root-failure-review.json)接受FAILED/完整return，不接受功能通过。原18raw/两个已消费目录不改。

后继 `/private/tmp/prm-b2` 是同caller的新revision，parent仅加精确prior失败/terminal/outerexit/cleanup/EOF/保守账校验；worker逐字不变，权限/cleanup/计量cap与六组均不变。原60,000ms已用12,385ms，剩47,615ms包含15,000mscleanup，不另给新60s、不借direct信用。完整旧包与outer共37文件525,259B计入8MiB；新packet+raw+256KiBouter reserve也计入。

差量仅留自有TMP：[parent diff](/private/tmp/prm-b2/parent.diff)、[source diff](/private/tmp/prm-b2/source.diff)、[manifest](/private/tmp/prm-b2/manifest.json)。未授下一Chrome，source/native delta等root一次聚焦审；无gate/free/import/tests或第二运行。最终clean metadata HEAD常规回绑TMP，不递归metadata提交。
