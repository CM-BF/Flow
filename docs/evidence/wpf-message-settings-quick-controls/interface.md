# 当前受控 Interface

`draftOwnership: symbol` 与 `editable: boolean` 必填；宿主为 draft/view/connection/permission lineage 产生全新非序列化 Symbol，任何新稿（包括相同 tuple）、换 view/connection、authority 撤销/恢复都不得复用旧 ownership。token 仅身份，不是授权。受控 value 是已应用 C，local filters/pending 是弹窗 Y。

`onChange(value, expectedOwnership)` 必须同步返回 applied/stale/unavailable/unknown；真正 compare→public codec→write 无 await。现 `commitMessageSettingsChange` 接 fresh getter，由宿主当场读其 current ownership 与 editable；defined 值再用未改公共 capture 检 capability/current profile/full tuple。undefined 仍核身份/editable，可在缺逐条能力的可编辑草稿中明确移除请求；不虚造 capability。Getter/write 只能由可信宿主绑定，不把旧 render closure 当 live authority。write 不应异步；若写后 listener 抛错，UI显示结果未知并禁止该 opening 重试，不宣称草稿没变。

`beginMessageSettingsEdit` 是组件实际使用的临时 opening seam，持 baseline+expected owner，生命周期独立于宿主 draft。关闭/取消/unmount/成功提交/详情导航都会同步撤销，Apply 在调用宿主前先单次消费；旧 details callback 也被同 opening 身份与 active 双重拦截。authority/value/token 变化失效，不能为保 UX 候选跨代际复活。目录 append 不等于换 authority；刷新期间不可 Apply defined，当前 C 不清。候选被新目录删除需重选。

仅 authorized profile 的 <=32 声明组合参与 facets/results，无全目录 flatMap、Cartesian、默认或最近匹配。四轴独立，零匹配给可达清筛选，不改变其他轴/C。当前和待应用摘要分别命名，trigger 名称包含完整 requested 摘要。技术身份在details，实际 observed未知。既有 details(navigate)/close-focus 行为复用；同 visible pane 新draft后可正常Escape回当前trigger，hidden/disabled/卸载不强行抢旧焦点。

唯一真实 consumer 是 fixture：单一 ref authority + render observation，fresh catalog getter/public capture；A/B冻结样本独立，故意 lag props 验 onChange 的真正 CAS。直接用例针对同实际 helper，不等于mounted完整App；browser尚未运行。App/Thread/P01/Recovery/Queue 接线需要后继合法scope，本片不能替其 grant/epoch/持久恢复。
