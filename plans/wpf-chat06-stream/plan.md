# WPF-CHAT06S01 增量正文模块

创建/更新2026-10-06；completed（本模块）；owner workspace_panels_owner / gpt-6-astra ultra。基线fa9a8288341d4f2bd8160e03fe9173dafa2de1a6，完整已审main含domain/client/mount，无额外共享输入。[来源](../../docs/evidence/wpf-chat06-stream/input-provenance.json)、[领取](../../docs/evidence/wpf-chat06-stream/take-receipt.json)。

目标：在独立模块中读取已协商patch-v1正文，严格校验并增量累计；与现有官方Thread兼容的纯消息适配。不是实际App接线或provider首token验收。七scope仅三个新conversation-stream源文件、两个同名直接测试、本计划及独占证据。App/Thread/旧投影/shared/依赖/服务不写。

- [x] WPF-CHAT06S01-01 固定来源、技能、领取与接口。
- [x] WPF-CHAT06S01-02 身份/UTF8/digest/修订与预算累计器。
- [x] WPF-CHAT06S01-03 有界代际读取、明确final结算与单通道messages适配。
- [x] WPF-CHAT06S01-04 有意义直接测试/类型检查、独立review、聚合与交Lead。

已确认方案：[Interface](../../docs/evidence/wpf-chat06-stream/interface.md)。private bound ports接受明确task/turn连接身份，metadata先确认current attempt，patch cursor为最后runner sequence而不是+1；空terminal patch仍处理。每patch≤8KiB、attempt≤1MiB、最多256blocks/4096patches，严格revision/fromBytes/prefixDigest；错误不得污染已显示状态。无全文轮询/通用detail回退。hidden/offline/换连接中止并代际隔离；分页串行、单flight、有界drain/退避，不给每消息另开SSE。

只GET conversation显式patch-v1协商，CREATE及幂等replay保持false；本模块不自行构造client或发header。未opt-in/能力false零stream读取。final settlement必须task/attempt/session/final及完整replace/retain分区匹配；配齐已验证canonical final才原子替换，unavailable保留全部，不按文本/末块猜关联。block-complete不等于Flow任务成功，失败/取消保留中断状态。

测试通过公开seam运行实际累计器/投影，验证乱序/重复/缺口、UTF8/限额、空terminal、身份错/跨连接迟到、final/settlement前后次序、保留工具前历史、无假成功与旧cap0请求。0模型/DB，不操作已有服务；UI接线须ActivityI范围交回后另take，pending不冒称完成。架构影响为新只读增量投影模块，target交Lead/D06后继固定快照队列。

2026-10-06 07:27 UTC：固定3ac11已获独立APPROVED，直接验证/源码来源及聚合入口完成。main集成待Lead；实际App消费仍独立后继，不在本模块完成项内。
