# TUI01F-03 源码交付（NOT_RUN）

固定 target `da673b81c4390c2e811d1582d68a9899180d55d2`；3新文件共 30,577 逻辑字节，旧9源对已审a1f保持不变。本轮未执行import/typecheck/tests/HTTP/PG/PTY/browser/provider，没有安装或修改依赖。闭包source-only由Lead恢复；其回执归档，未当作运行依赖可用证明。

- fixture Module 隐藏一个随机库、production factory、一个现有runRunner与有限屏障；不复制任务/取消/会话状态机。合成session明确为fixture，复用中心原follow-up规则。
- journey含两个有序场景，同一A/B/C生命周期。A中心完整200回执写入证据后才丢一次ACK；重开journal零发送，B由第二公开client受理后，recover仍同A路径/key/空body。B由实际Ink PTY输入取消；C须在退出后仍running，再显式释放fixture屏障至succeeded。
- Python只操作新PTY，TUI与其子进程留在Node创建的独立PGID；Node无论leader是否已退出均核整个组，单停止promise，TERM3s→KILL1s，仅ESRCH代表消失。未知保留数据库/tmp，不声称防止任意进程脱组。
- 只允许proxy GET与已知A/B cancel POST；最多三次POST=两个不同取消+A原key重报。不经proxy创建轮次，使用显式owner第二client。
- PTY阶段中断传给后继受理callback，避免超时后继续创建C。成功/失败PTY捕获单独sync后进入完整checkpoint引用；先停止自有资源、采集中心事实并确认checkpoint持久写入，才DROP自己的随机库/rm自己的tmp。checkpoint失败仍停止/关闭，保留不可恢复资源。失败或选不完整两个场景不输出passed。

候选运行入口（**未授权执行、未执行**）：给一个不存在的绝对 `FLOW_TUI01F_EVIDENCE_DIR`，仅选 `apps/tui/src/task-controls/journey.test.ts` 两项；只选第二项会明确缺少B，不能替造新生命周期。既有本机PG连接仅用于随机库；可选 `FLOW_TEST_DATABASE_URL` 必须是loopback/postgres，不输出其值。实际资源门禁由Lead另定，原32MiB提议不是实测峰值。

当前静态上限：3轮/2不同cancel/1原key重报；proxy请求16KiB/响应512KiB，PTY原始128KiB，子进程总输出2MiB；单次PTY26s及独立停止宽限。不是完整PG旅程硬总期限，也不是空间预留。完整依赖解析、迁移、HTTP、PTY raw-mode/CJK/resize及cleanup均待实际授权局部运行。

技能与clean-code：2026-10-06 16:25 UTC 沿本地find-skills优先复用codebase-design/clean-code，已实际重读；Module按资源寿命与两真实消费者收敛，接口显式state owner/unknown/清理顺序。静态复核修正了snapshot attempt字段、超时后callback取消、失败PTY证据保存与不完整旅程误绿；这些是源码检查，不是红绿测试。生产9源未改；未引入新依赖/第二FSM。后续独立审查只可给source-precheck，不能提前称03通过。
