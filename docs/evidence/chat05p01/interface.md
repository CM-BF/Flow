# CHAT05P01 Interface v1

Host可选`HarnessContext.activityBodies`只有`protocol`和`publish({activity,content})`。已确证支持新协议的受控固定center组合才由host提供；正式runtime不能仅凭route存在、新runner自报或版本猜测启用。port缺省时现有mapper与旧prefix行为保持。该层不改变工具权限。

完整公开SDK材料UTF8 bytes与旧activity prefix必须同源；输入工具/结果才走本port，hidden/redacted thinking不进入新spool。SDK object的JSON表示不是原网络编码。8MiB/body，16MiB/attempt，256材料；单64KiB chunk，批<=8，页<=4，原2MiB/50events与1MiBdetail保持。

Outbox在原tail/barrier内先将完整bytes及固定ownership/eventID/sequence计划持久化，再发原报告端点的`native-activity-body` open/chunk/seal事件；整个body只一条串行在途。调用ACK之前不能推进下个原生材料/final。恢复只重放原封存事件，不重启模型、不新建任务或改变attempt/fence；未知保原件。fsync/rename/ACK任一点失败边界须局部证明。

中心`saveNativeActivityBody`使用原reportEvents锁与TX，绑定已有immutable activity/session/attempt，按index/offset收immutable chunks；seal验证总bytes和full digest一次，避免每chunk重复全前缀。`assertNativeActivityBodiesFinalizable`覆盖ordinary及active-steering共同applyEvent路径，final/成功completed不能越过未sealed材料；失败/取消后可读取interrupted，不接纳新tail。

授权GET `/api/tasks/:taskId/native-activities/:activityId/body`只返回descriptor；其`/chunks?afterIndex&limit`仅按固定identity分页返回base64 bytes。展开前无正文，旧activity refs继续轻量；缺新body记录标legacy而非可追回。body complete只指完整材料，不等tool成功。legacy detail保持原样，不扩通用对象/附件生命周期。

共享接线：本owner写contracts/runner.ts union+port、events.ts窄dispatch和033；runtime.ts绑定、server/index迁移/mount、client/exports由Lead与S01P07协调。此首合同后实现仍需独审与局部证据，PG尚未运行。

## 聚合容量与恢复限制

8MiB/body、16MiB/attempt、256材料是单attempt公开原文字节约束，不是runner总内存或磁盘上限。并发16的256MiB原文不含SDK已经分配的帧、Buffer/JSON/base64、manifest、未ACK历史。ACK后原文可释放，但manifest/ack仍保留；启动恢复遍历历史attempt及材料。spool扫描每attempt最多256个有界manifest，未给无限历史attempt数量提供整体扫描保证。

高并发正式开通须由S01 admission/outbox后继验证runner聚合在途与保留字节、历史扫描开销，以及空间不足停止新admission但保留恢复/心跳的规则。只有中心确认且符合保留策略才回收；unknown不能因超时被丢弃。本片不扩12scope实现上述全宿主政策，缺少明确host port仍为旧协议。

读口`legacy`表示没有本协议保存的完整材料，不能把旧prefix当可追回尾部。`receiving`表示尚未封存；`interrupted`保留已收到块但完整性未完成；仅`complete`代表完整字节与固定hash校验成功，仍不代表工具成功/任务成功。
