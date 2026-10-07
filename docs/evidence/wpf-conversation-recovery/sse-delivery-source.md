# 真实SSE入App：最小候选（NOT_RUN）

固定d68b6bc722fb3d65dd79d34cdbc1c91ac22354e5；仅原fixture/browser，17其他源同344f。原full7与其他journey断言不变；新有限选择仅cookieRead+sseDelivery，Gate→Init→worker→parent沿原固定映射。源/12定向检查入口见[sse-delivery-checkpoint](sse-delivery-checkpoint.json)。当前12/12纯观察器与Web noEmit exit0，实际6283.637ms；0HTTP/PG/Chrome/provider。原件[sse-local/manifest.json](sse-local/manifest.json)。

## Interface与因果

fixture.seedSseTask通过原public FlowClient提交唯一queued fixture任务，不注册runner、不执行provider；观察器只为此ID武装。观察页从公开路由打开task，完成唯一初始snapshot并建立cookie-only原stream、显示Live后记录初始cursor。fixture.cancelSseTask作为第二公开HTTP消费者发真实cancel；不将POST响应交给观察App。必须同一stream记录cancelled且新cursor/取消entry，并在App看到新的“Cancelled before execution.”，期间既无task snapshot/events REST补读，也无浏览器业务POST。不用conversation轮询或HTTP200握手代替交付；cursor来自真实frame，页面验证可见timeline，不虚称DOM公开了cursor。

RecoverySseObserver是同原pipe后的旁路data listener；不暂停/恢复/读ahead/改写/截断转发。累计输入≤64KiB、最多4个完整frame（第五个触发明确失败），decoded pending+帧摘要有独立64KiB逻辑上限；fatal UTF8 decoder跨chunk，CR/LF/CRLF跨界解析。只保存task/cursor/status/entry/text和数据digest，不复制整个公开EventPage/新HTTP DTO。summary写入前核预算；结束时不完整UTF8/frame明确失败、释放pending。输入digest是原字节，dataSha是规范SSE data字段UTF8，不冒原frame字节hash。

end/close/error/abort/显式stop移除自身listener；原proxy error/pipe生命周期不变，错误保存在trace并进入fixture cleanup失败。成功组在App确见新entry后显式stop；fixture.close再次幂等收尾。第二stream不能替代原stream证据。最多8条相关REST请求观测；报错或前置失败仍该selection FAIL，无catch继续。记录body丢失旧场景完全不改。

## 定向验证与资源

12项纯流源码检查直接import实际observer（fixture顶层仅built-ins/type；未调用start），覆盖逐字节中文/emoji与CRLF、真实pipe/背压原bytes、mixednewline/comment、非法/不完整UTF8、partialframe/坏JSON/wrongtask/第五帧/输入超限、abort/第二连接及close。本次12/12实际通过（0skip），受影响Web noEmit exit0；两个owned Node组均absent、临时目录已移除，原始日志/监督脚本保留。此为纯流行为与类型，不冒浏览器通过；没有重复旧50/119。

root一次明确将total retained 8→9MiB、保5MiB单run预留（启动线3→4MiB），组合freshfloor相应+1MiB为4054056960B。保64MiB scratch、新段70158已用/79842剩、single≤60s含15s清理；旧raw/失败/90k封套不动，引用旧17pin不重印。当前未拿sharedPG，不建env/gate/预约；listener生命周期已获root限定聚焦源审0blocking，见[sse-delivery-root-review.json](sse-delivery-root-review.json)。profileknowledge/Steer/二center等完整验收继续开放。
