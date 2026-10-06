# B01 assistant task head 固定证据

第三reader只改assistant-stream/queries.ts的首次任务读取：file-private TaskHead与固定current_attempt_id/status/updated_at三列SQL。原404 code/message、同client/RR包装、current-attempt cursor绑定、state/blocks/settlement和limit+1不变。首片c96六source/config、raw/manifest均冻结；其17readonly里的assistant queries在本片合法变化，旧manifest仍绑定c96 Git原输入，不冒称当前WT仍全相同。

主样本是实际公共POST合法Unicode prompt，15999 UTF-16字符/37331 UTF-8字节。无attempt同任务旧loadTask解码行37899B→新三字段87B，SELECT仍1；active普通4SELECT、after5SELECT、final4SELECT均保留。active测量记录的220B、final308B是head+state两条task查询的合计，不冒充仅head字节。Node解码后rows再序列化的UTF8量不等于PGwire/TOAST/磁盘/CPU；新SQL不请求submission，不外推物理I/O或SLO。HTTP原本不含prompt，另验证输出等价；18实际HTTP请求有计数，无轮询频率/请求数优化声明。

5个不同真实PG/HTTP测试全通过：无attempt投影/公开输出；active blocks分页limit+1和末页；不同task及同task历史attempt cursor拒绝/401/403/404；无新stream的failed/cancelled/uncertain+ISO日期映射；真实合成final/completed持久后final-available/settlement/显式正文与snapshot原prompt读取。历史attempt ownerVersion0和terminal状态切换是明确SQL合成fixture，不声称实际恢复生命周期；注册/claim/session/stream/final/completed经真实HTTP，帧由本测试构造，0SDK/模型/provider/runner runtime调用。未运行原stream.test.ts内无关SDK/runtime案例或任何共享库fixture。

参考的旧直接消费行为：assistant-stream/stream.test.ts的durable root text、cross-task owner-only、interrupted状态、no-tool final settlement；packages/client/src/assistant-stream-production.test.ts的真实公开GET、正文按需、401/403与隐藏references。新测试通过本片私有专库覆盖受改readInterface的必要语义，旧patch写入/digest/replay/restart实现没改，不重复全套。

red bb5b13a0f27cfe59ca27b0bec4e2146cdc32b546：1选中失败（明确仍解码submission），1task、2503.681375ms fixture、库closed/absent。green 2026-10-06 11:54:06.207402至11:54:08.863884 UTC：5/5通过、2tasks、fixture1409.167834ms含初始化清理、121382B decoded+HTTP、3078B报告，库closed/absent。strict原receipt exit0，两个直接root+imports、继承root全部选项，不是root-wide。

新片合计3tasks/3912.849209ms fixture/197430B decoded+HTTP；连首片累计10tasks/8186.435709ms/733075B，5个独占库均已确认清理。每prompt≤1MiB、合计≤32tasks、32MiB/60s边界满足；数据计量与证据另加保守1MiB预留见manifest。不把旧8项重复算入本片5项。主机背景负载/observer开销记录在final-receipt，未比较延迟或容量。新target须独审，首片批准不延伸到本片。
