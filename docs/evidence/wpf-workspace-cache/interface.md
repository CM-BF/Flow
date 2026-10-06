# WORKSPACECACHE01 Interface

App保留唯一views/drafts/profileSelections/panelTabs。新workspace-retention只是纯保护/准入策略，不存第二Map、不发命令/不调度。每connection最多32个conversation驻留（含初始draft/open/closed-protected）；closed-clean零缓存，legacy task/全history/feed未纳入。满额在新身份/URL/layout变动之前拒绝新view；已有view可重开，保留聊天入口能找到尚无conversation ID的draft。

保护：任意未发送文本（空白也保）、未提交profile/project、knowledge selected、全部outbox及未dismiss queue收据（含rejected/accepted）、steering本地entry/风险。已锁定会话已有profile/project不算新选择。附件后继保护来自实际binding items任意state、pending submission/capture与journal unknown，不镜像registry。未知保护状态拒绝回收。显式steering离开流程保留，自动缓存回收不冒充用户discard。

App关闭无保护conversation，先失效membership/迟到closure，再释放session既有knowledge binding订阅、投影读/命令终结与同key全部alias/草稿/profile/panel元数据；不取消中心任务。closed-protected只停读、清可丢正文、保view/key/选择/收据，同页原key恢复；reload不在本片。session保护查询不得分配binding，release只有唯一App决策后调用。

read-cache工具只管理现投影的LRU/UTF8字节，不另造网络或事实源。reply最多2总记录/2MiB正文，queue最多4总记录/64KiB正文（loading/error也占记录）；每类每view一个body flight，两个visible pane最多4个正文flight；body必须先验证string再计bytes，reply公开上限1MiB、queue16000bytes，不截断。无无限evicted tombstones，展开项absence显式重读，不自动GET。命中touch，关闭清零；隐藏/离线中止读取并使旧success/digest/catch/finally失效，finally检查flight身份。历史分页同读代际；command/outbox生命周期分离。

32conversation投影正文缓存预算66MiB是UTF8 body计量，不是heap/全进程边界；metadata/turn/history、runtime/stream自有状态、generic task/workspace、feed未声称有界。禁止从DOM消失或少一次HTTP推JS回收；直接验证owned binding unsubscribe/closed controller无late写，再用真实App测DOM/HTTP/draft/receipt现象。

直接验收：32满额保稿/route不变及已有view重开；所有保护原因；session订阅释放；history/detail/crypto迟到success/reject/finally；两类LRU容量与错误记录/显式重读；真实App反复关闭clean、保护draft/knowledge/receipt及原key、双pane隔离。沿现HTTPfixture独立动态端口、累计90秒含至少10秒清理/8MiB，超预算如实partial，不重复旧8项大套。
