# ENG01I 两个公开宿主旅程（NOT_RUN）

固定来源：产品 source c3d29e4a（完整SHA见最终manifest）；主线输入 c0e0263dc01b9527293318a644f964bd048e2a86，G/F/H实际组合；无生产启动入口或concrete authority。权威运行入口 `python3 docs/evidence/eng01i/pg/run.py <window-id>`，明确共享窗口后仅环境绑定同window和既有本机测试PG管理员URL（不记录凭据）。exclusive run目录与durable reservation防止复投。只选 `public native host PG journey`：**2 selected /18 unselected**，不跑原27/61/105矩阵。

两例：公共profile→任务→真实runRunner/outbox→固定完整native收据/verification成功；中心已commit artifact后故意丢ACK，原bytes/key重传、公开正文不变、重启新adapter实例仍1attempt/1writer/1event，lease/admission保留且verification pending。后者不是未知外部writer停止证明；额外清理知识只来自测试实际启动的固定Node JSONL peer。

一个随机marker专库；HTTP端口0，最多2任务/2 runner注册、1活动runRunner（第二例顺序重启）。子peer均同自有Vitest进程组，0provider/真实SDK/个人服务。使用实际createServer全部30 SQL闭包与runtime，无手工缩减migration。260源/SQL/元数据、10直接安装包入口静态核缺件0；import-only已成功，具体动态数组012/013/017/019逐项纳入。既有package installed payload只读；没有安装/依赖复制。

候选预算：fresh≥1207959552B；单一monotonic总截止先扣准备/hash/fsync时间，spawn前work=min(120s,remaining−30s)，不足1s零child拒绝；cleanupUntil同一截止映射，OPS14 owned-group TERM .5s + KILL观察2s，独立parent150s硬退出覆盖reservation与最后fsync。测试每例15s/startup和afterAll30s不冒总墙钟。stdout+stderr hard1MiB，fixture checkpoint累计512KiB，每条32KiB，总原始+receipt≤2MiB；private runtime8MiB，PG/WAL另观察，保1GiB。资源在有限协议checkpoint与最后cleanup前实采，明确不是OS硬磁盘配额。

先fsync随机DB名/marker reservation及父目录，再CREATE与marker/OID确认。源码/依赖/preflight hash启动前逐一核；未知拒绝。cleanup先durable checkpoint，确认runtime停止/peer关闭，app/pool关闭；连接LIMIT33、超过32/查询错/≤3s期限（零也核）均KEEP。再核OID/marker→normal DROP，禁FORCE；最终confirmed absent才删除exact dev/ino私有scratch。startup未settled、资源超限或任何cleanup unknown保留DB/tmp/证据，无自动重跑/新窗口。父监督硬期限触发只记unknown，不能当清理成功。

此次尚无共享窗口/无PG执行。验收只能证明注入authority的宿主组合；真实>=Sol writer、实际权限强制与完整停止、独立业务接受仍后继。
