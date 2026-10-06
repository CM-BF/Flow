# CHAT05P01 Interface v1

Host可选`HarnessContext.activityBodies`只有`protocol`和`publish({activity,content})`。已确证支持新协议的受控固定center组合才由host提供；正式runtime不能仅凭route存在、新runner自报或版本猜测启用。port缺省时现有mapper与旧prefix行为保持。该层不改变工具权限。

完整公开SDK材料UTF8 bytes与旧activity prefix必须同源；输入工具/结果才走本port，hidden/redacted thinking不进入新spool。SDK object的JSON表示不是原网络编码。8MiB/body，16MiB/attempt，256材料；单64KiB chunk，批<=8，页<=4，原2MiB/50events与1MiBdetail保持。

Outbox在原tail/barrier内先将完整bytes及固定ownership/eventID/sequence计划持久化，再发原报告端点的`native-activity-body` open/chunk/seal事件；整个body只一条串行在途。调用ACK之前不能推进下个原生材料/final。恢复只重放原封存事件，不重启模型、不新建任务或改变attempt/fence；未知保原件。fsync/rename/ACK任一点失败边界须局部证明。

中心`saveNativeActivityBody`使用原reportEvents锁与TX，绑定已有immutable activity/session/attempt，按index/offset收immutable chunks；seal验证总bytes和full digest一次，避免每chunk重复全前缀。`assertNativeActivityBodiesFinalizable`覆盖ordinary及active-steering共同applyEvent路径，final/成功completed不能越过未sealed材料；失败/取消后可读取interrupted，不接纳新tail。

授权GET `/api/tasks/:taskId/native-activities/:activityId/body`只返回descriptor；其`/chunks?afterIndex&limit`仅按固定identity分页返回base64 bytes。展开前无正文，旧activity refs继续轻量；缺新body记录标legacy而非可追回。body complete只指完整材料，不等tool成功。legacy detail保持原样，不扩通用对象/附件生命周期。

共享接线：本owner写contracts/runner.ts union+port、events.ts窄dispatch和033；runtime.ts绑定、server/index迁移/mount、client/exports由Lead与S01P07协调。此首合同后实现仍需独审与局部证据，PG尚未运行。
