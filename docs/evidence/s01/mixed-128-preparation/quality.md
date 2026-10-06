# S01 128 准备质量记录

2026-10-06 12:23:11 UTC，status_read / gpt-6-astra。find-skills本地优先；来源及本地hash见skills.json。clean-code复用用户指定sickn33/agentic-awesome-skills固定bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，未再安装；codebase-design应用于原driver的真实profile变化seam。

设计/代码职责：保留原mixed入口，固定RunContract集中128规模、deadline/计数/字节；小ObservationArchive隐藏compact证据预付和硬界限，driver/tests真实消费同一Interface；request-error只返回有限分类且不复制/修改原error对象。没有新调度器、数据库trigger、公共log或产品pool改动。原legacy/after-drain值保留，旧代码在固定Git重现，当前source变化不冒称旧manifest=WT。

检查并修正：原16/2cases/52…59.9秒常量均改为明确profile输入；session gate与终态active_task_id语义分开；运行后的全库计数不能只看成功claim。观察计数/大小/预算异常在append前拒绝，未知计数不PASS；child error保留throw原对象且只公开status/枚举class/operation/已知task-attempt身份及stop时标。新profile限制每adapter最多12次窗口emit，结束必须实际等足6s，不以早timer标记当区间。

Mika预读提出CLI送达与窗口内DB样本两处已修：stdout timer/error/callback检查180秒与32KiB reserve；DB按IPC界定的parent时间内query始末筛选，跨界排除、至少2样本跨度4s且所有有效样本一致。新增纯反例覆盖缺样、中途lease=false/owner漂移、只有barrier/窗外ACK、短ACK跨度、ACK ordinal/fence/accepted/session/全库129th attempt，以及observation UTF8预付/溢出。

最终40不同纯checks（旧24+新16）/strict0；首次4red和初次strict2均保留，不合计重复运行。工程验证不启动center/runner、PG/HTTP容量或provider；少量Git只读进程用于固定历史输入，不能写成全OS零子进程。尚无实际128成功或资源清理声明，待独立fixed-target review和唯一窗口。
