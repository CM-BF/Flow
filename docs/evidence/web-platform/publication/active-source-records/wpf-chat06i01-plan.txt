# WPF-CHAT06I01 聊天增量正文接入

2026-10-06 07:50 UTC；in-progress；owner workspace_panels_owner / gpt-6-astra ultra。基线 `6426b44cd32d10216141af13ecfa83b8879025fb` 已含ActivityI ba341、S01 3ac、PERF03 f909。独立13scope见[原领取](../../docs/evidence/wpf-chat06-stream-integration/take-receipt.json)与[已批准设计](../../docs/evidence/wpf-chat06-stream-integration/accepted-proposal.json)。不修改S01三模块、legacy messages/projection、官方Thread/shared/根依赖。

目标：在现有官方Thread单runtime中展示真实公共patch-v1增量正文；独立可信Web扩展授权与生命周期，final/草稿/执行状态分开。0模型/DB，HTTPfixture与真实provider验收分开。

- [x] WPF-CHAT06I01-01 固定输入、技能、领取与宿主接口。
- [ ] WPF-CHAT06I01-02 私有bound读端口、P01独立权限、有限缓存与读取资格。
- [ ] WPF-CHAT06I01-03 实际Thread消息/状态/动作会员接入，保留发送、草稿、profile与queue。
- [ ] WPF-CHAT06I01-04 局部直接/HTTP浏览器/双主题与窄屏证据、独审和交集成。

每view最多4turn/2MiB、connection8turn/4MiB UTF8 draft缓存（非JS堆承诺），每可见pane一个读lease/两split最多2个flight。只current active和已观察待final settlement有限dirty集合，实际宿主更新/用户Retry才再次入队，队列处理完静默，不能loading=false互相轮回。不对每个historical turn发请求；LRU淘汰非活跃draft历史、canonical保留，明确非lossless缓存。

App保持client/token私有，connection/view/conversation/turn/task+真实user anchor会员绑定。独立flow.assistant-stream/task.assistant-stream.read经P01既有checkView+当前资源+active核；关闭activity不等于关闭stream。draft动作会员来自实际已验证消息snapshot，不解析opaque ID。hidden/offline/close/revoke/换连接gate+abort/late隔离；稳定快照和有效输入compare防循环。

GET conversation显式patch-v1，CREATE稳定false。未协商/false/disabled零stream读；只用已有按需finalContent，不自动detail/fullblock。单官方runtime+stable converter，typed canonical无patch/disabled历史fallback也保complete/unknown，global任务running门禁不改；临时/暂停/中断/截断可见，块结束不称任务成功。

验收：真实App patch→final retain/replace/unavailable、错误/重连/迟到、profile/queue/独立新draft、两split与身份、权限撤销、缓存有界与静默、390浅深/键盘/reduced-motion。架构影响为App私有stream host与P01新窄capability；固定target交Lead/D06后继快照，不越权改图。
