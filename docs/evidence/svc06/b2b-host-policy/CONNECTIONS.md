# 本旅程连接预算（固定 source344 / af51 → c2c）

此为已读源码的配置容量账，不是实际连接峰值测量，也不包含个人中心/协调账本/其他队现存连接。实际窗口须另叠加这些服务；不以测试自己的 `max:1` 代表全部。

| 阶段 | 同时可用连接容量（本旅程） | 来源与顺序 |
| --- | --- | --- |
| 专库创建 | 1 admin | journey.mjs:31–35；admin end 后才创建 fixture pool |
| 旧 af51 factory | 8 business + 3 pg-boss + 1 fixture = 12 | af51 index.ts:62、scheduler.ts:5；journey.mjs:39–62；旧 factory.close 完成才启动新中心 |
| c2c默认三角色启动/观察 | 8 business + 3 pg-boss + 1 fixture + 1 preview helper = 13 | b2b index.ts:75、scheduler.ts:5、preview.mjs:69–71；role marker/runner校验/status helper串行释放，不叠加多个helper |
| bootstrap / refresh / resume | 8 business + 3 pg-boss + 1 fixture + 2 maintenance + 1 preview helper = **15** | maintenance-host.mjs:117–124 的 pool在整个操作保留；marker或新role启动/status可能增加独立max1 helper |
| refresh旧新代交界 | 保守仍按15；没有两组11并存的授权路径 | maintenance-host.mjs:82–92 按Web→runner→center全部确认stopped后才start；unknown直接拒绝后继。maintenance pool2和fixture pool1跨此间隔保留 |
| 独立清理 | 1 admin + 1 marker = 2，marker end后降为1 | entry.mjs:186–202；work组absence、所有已记录detached组stopped后才开这些pool。任何unknown不凭瞬时零连接DROP |

本fixture正常成功链的配置容量最大15。runner与Web业务通过HTTP访问中心，不另建长期数据库池；各CLI wrapper仍有启动marker短连接，已纳preview helper槽。不能由容量账推断数据库总max_connections余量或实际峰值已测。

pg-boss配置确为max3传入其内部pg.Pool。已安装12.37.0的dist/db.js:40、dist/attorney.js:416与dist/index.js:221–222表明：额外LISTEN客户端存在于可选能力中，但本两个scheduler都未提供useListenNotify，默认false，不启动此独立连接。旧donor与新c2c的这三个直接实现均只读核对，无import/PG运行。

旧af51 onClose正常await boss.stop及pool.end；若close异常，journey保留primary/secondary且不会进入新center启动。后续正常refresh原stopOwnedProcess必须确认整组stopped；无法确证时停止。此账不把unknown资源解释为已回收，独立cleanup仍按原证据边界处理。
