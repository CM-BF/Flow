# SVC04 方法与质量

2026-10-06 09:41:35 UTC：Node24/ESM/Vite静态预览与POSIX owned process。按find-skills本地优先复用已实际读取的/Users/citrine/.agents/skills/find-skills、codebase-design、clean-code（sickn33固定bdacd76）、tdd及brainstorming；不重装。新stack与既有SVC03一致，read现web-artifact/static-web/preview/maintenance/process实际链与Vite config/直接测试。

先深模块小接口：artifact负责bytes，release负责CAS/保留，preview负责本机身份/锁/进程；不复制maintenance drain。计划受现派工授权，无额外用户审批。当前仅文档，未运行build/test/provider，未读取私人配置值或操作用户服务。

## 2026-10-06 09:57 UTC 首工作段

域模块拥有单一release指针、精确资产集合、结构化兼容记录；preview只组合私有配置/同operation锁/owned Web生命周期，旧完整维护入口在停止后台之前校验保留Web组合。未引依赖或调度器。8/8模块与旧直接消费者已过；bootstrap、发布竞争及真实HTTP四项兼容正例还未完成，不交付为已验收。发现并修复descriptor属性顺序误判、release文件消失时误回legacy、同version不同metadata/版本倒退缓存问题。保留3个artifact/192MiB/32组合证据，无自动GC；可信声明非任意后台语义证明。
