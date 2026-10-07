# 原完整恢复验收：Queue后最小次序候选（只读）

固定344f12cc9407a1cce8d17e2d9371cf8d0fb9a4b5；归RECOVERY01-03/05和原MATURE06，不新task/claim。Queue enqueue selected已通过，不冒promotion/Steer/全feature。下面仅候选，0新增运行，不自动扩大本段资源。

**下一最小用户结果：另一公开消费者取消任务后，已打开的App任务页通过真实SSE出现取消时间线，无刷新/无任务正文预取。** 优先于第二中心，因为能复用同一个markedDB/center/Chrome、0runner/model/provider。

- fixture.ts342–345已有原center+public FlowClient，automaticQueueScan=false；359–364只暴露URL/公开seed与fault/session控制。可仅在该原fixture新增限定自己seed task的`cancelTask`操作，内部调用现公开client.cancel(taskId,key)，不直写task表/IDB。client/index.ts500–501为真实POST；server/commands.ts21–29 queued且无current_attempt时会追加公开timeline "Cancelled before execution." 并cancelled，能在0provider下产生新事件。
- 保持观察页原TaskWorkspace。App305–354已有真实取消入口，但直接在观察页点击会把POST响应经projection.cancel347–353更新summary，不能据status变化证明SSE。因此本候选用fixture作为另一公开HTTP消费者明确执行取消，观察App页只接收；准确限定为跨消费者观察，不冒本页Cancel UI链已验。
- TaskProjection217–233调用client.watch、applyPage200–214合并新entries；client550–572消费真实fetch SSE，取消后释放reader。与conversation projection173–193轮询不同：本例必须断言**新的取消timeline entry及cursor**，不能只等conversation状态/HTTP200。
- 原fixture306是SSE透传。最小观测增量可在这个准确upstream/downstream连接上旁路收集最多4个完整公开frame、总≤64KiB，记录path/taskId/cursor/byte digest，chunk边界重组和超限应明确fail，close/abort移除listener；不更改帧、不预造事件、不打开第二假SSE。Browser在既有Task页stream建立后标baseline cursor，取消后同时核真实新frame和App新entry，窗口内无该task snapshot/events REST刷新；任务列表summary即使刷新也不能生成timeline entry。若真实UI必须重新select/页面失焦导致REST补读，该尝试不能称SSEdelivery，先收窄前提再做，不删因果断言。
- 精确候选写范围只有原`test/conversation-recovery.fixture.ts`和`.browser.ts`及own records。TaskProjection/client/server仅只读，产品端若显出缺陷须另报精确scope。新增有界SSE观测listener生命周期需针对review；原parent/DB lease/权限/资源上限不变。原scope内selector可增cookieRead+sseDelivery独立组；不重跑full7，selected绿不等fullfeature。

随后次序：
1. **完整draft profile+knowledge恢复**：原App/Thread authority已有保存字段；需从public catalog/knowledge资源建立合法真实reference，再检查reload/auth-loss/恢复不POST、exactprofile/digest与orderedrefs及下一稿。现fixture只seed project/twoattachments/conversation，无ready executionprofile或knowledge版本；不能手写IDB/强制enabled代替公开前提。先只在原fixture核可复用公开注册/资源命令，缺真实前提明说。
2. **Steer真实HTTP unknown恢复**：control.ts44–54/63–75要求当前合法attempt/ownerVersion/nativeSessionId/revision，queued task不能冒ready。可研究现公开registerRunner/claim/protocolPrepare/Bind/report（client520–545）构造0provider协议fixture，但那只是明确的synthetic runner protocol，不是native执行或模型。需核真实admission与lease/撤销清理后再定单组；当前Queue入队不能代Steer或promotion。
3. **第二center/principal保稿隔离**：当前fixture342只一center、cookieOrigin/authEpoch，expireSessions362全表。仅第二BrowserContext不隔离服务端principal/session；不得拿它冒二center。真正二center需要两个独立公开center/可信identity及受控存储/退出观测，现单lease/onecenter资源声明不足以保证，属于需明确生命周期/资源边界的后继设计，不能暗开第二DB/server。

所有proposal仍受原150s实际计费、新剩79842ms约束，不承诺一次补完。当前证据接近原3MiB启动线；下次必须按实际retained小成本核，引用旧manifest避免重复，不删除旧失败或静默提高门槛；不足则一次说明所需输出边界调整。

固定只读source pins：

```json
[
  {
    "path": "apps/web/test/conversation-recovery.fixture.ts",
    "sha256": "c24ebd04196994b0e51a4fa39bcecff2828ebbe59da567bb7b9c29fac3ee100f"
  },
  {
    "path": "apps/web/src/projection.ts",
    "sha256": "5d515fc8318f6eae0401c7e37ebd4ce34b8edecc65ef3f091d4e9133af1eceb7"
  },
  {
    "path": "apps/web/src/App.tsx",
    "sha256": "7b891f3bd01e2f8a014c0be0079f4e4c2e892df60f753d5508ec855f6290c4d9"
  },
  {
    "path": "apps/web/src/conversations/projection.ts",
    "sha256": "ec28ad81b4961b288bda739b1bd768f9b757739546fc12c5c7a6de517b693fce"
  },
  {
    "path": "packages/client/src/index.ts",
    "sha256": "c6bb0e580513ab6cf913f72d2c1c85c16f8d03e5ebe1ea20c631122df9a00483"
  },
  {
    "path": "apps/server/src/commands.ts",
    "sha256": "8657b4cc49b7fa25866af69a1303eada074d0f993072837affd8a90f92a144d7"
  },
  {
    "path": "apps/web/src/conversation-steering/control.ts",
    "sha256": "5cf411df4d8bb3298ae71132d6225f1d512f6b6c8e7ccbd79bb8ddf768a60f58"
  }
]
```
