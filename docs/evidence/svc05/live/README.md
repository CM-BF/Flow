# SVC05 实际单次更新回执

窗口 go-svc05-current-release-once，operator assignment_review。实际固定后台362af3bac77541e5a60979326bcf4d4b8c947915，原准备dc8独审，main准备接收aeb不与runtime混同。

12:40:10.620 drain v13 → hold v14 → refresh → 12:40:57.934完整checkpoint fsync → fresh同operation → 一次resume v15 →12:41:13.752已核accepting。63.132秒，小于15分钟。最终[receipt](receipt.json)，operation a92a167b-c891-4a93-a4e5-d64cf29ce55a。三个旧owned组均stopped，新owned组/原端口健康。没有SIGKILL、rollback、用户tab刷新、自发query或改用户请求。

原有4成功任务、1已promoted队列、0未完attempt；会话2c507833-67fe-4d10-acf5-6c97eedd05bb及其原字段仍保留。60旧flow表逐旧字段行摘要保留；MD5只作本地变更检测，不作为真实性签名。开始即排除conversations.queue_checked_at，未保留其原值、不得声称该列逐值相等。runners四维护字段state/version/operation_id/updated_at预先排除并由本operation的drain/hold/resume审计与版本单独验证。其余旧字段保留，包括原迁移1..24时间、profile/身份/正文摘要。025新增assistant native_source_identity全NULL，026新增context attachments全[]；新增4表只有attachment_namespace的1行，其余空，027上下文历史为空。详情见[preservation](preservation.json)。未新增回填，不用列交集隐藏旧列变化。

config.json、claude.json字节及原native工作目录inode/5文件digest相同。Web release pointer文件逐字相同（v2/caa1/source8d8），两retained完整artifact核验；只导入已审run-5的两个兼容报告，不发布候选362 Web、不加载用户tab。

首次[preflight](preflight.json)保留server zod未链接；停止前由Lead按固定362 lock offline/frozen/ignore-scripts修复，无lock/source变更、0下载。tw-animate-css为CSS exports，单独读取固定manifest和CSS文件确认，不能用require失败冒称依赖缺失。新before-drain/gates通过后才开始排空。

[原源码固定](source-window.json)由Lead暂detach原config.repository，不改变main ref/个人配置；resume与证据完成后[恢复main](source-restored.json)。runtime仍启动时362，Web固定8d8产物。此过程无watch/HMR；已载入模块不会随checkout刷新，SDK随后子进程仍依赖固定已装0.3.290文件，因此未改node_modules；不承诺未来任意安装/重启保持此source。

原实验manifest、raw和review不改。本目录是操作事实与只读观测脚本，不新增部署权威/产品实现；已有维护工具持有锁/身份/FSM。原实验独审不冒称独立重跑本次用户安装；所有实际动作与失败均单独记录。没有真实provider验收、ATTACHI02或完整布局认证。
