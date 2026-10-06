# C02 public task API validation — NOT_OPEN

实现413420a，测试/生命周期固定3ccae21a。6个用例经真实公开task HTTP、原runRunner及两个独立注入transport验收，0真实Codex/SDK/provider。外部只运行一个固定Vitest进程组，无通用参数平台，工作输入/claim/20link/输出absence/resource失败立即停止。当前仅源码准备；最终focused strict于21:41:58 UTC实际exit0，且外部单worker记录入口未审，PG_PREPARATION_NOT_APPROVED，不能自动启动。

覆盖：旧native-v1在LIMIT前排除host-owned（含sentinel/cursor/旧digest）；旧resume明确unsupported；原runner/pin/session/fence；两次执行读取同一host-owned文件与typed final；SSE observer断开不停止runner。注入storage证明不替代真实native恢复、生产loader、新目录或完整conversation/Web/TUI。

拟单次入口：固定Node24，主树既有Vitest4绝对入口，`run --config docs/evidence/mature02c02/vitest.pg.config.mjs --configLoader native --reporter=verbose`。精确选择唯一 `apps/server/src/codex-continuity.test.ts`，1worker/不安装；禁止默认全库。执行前必须得到独立共享PG窗口、fresh claim/HEAD/输入hash/资源准入及全新输出namespace。当前资源HOLD不重采等待授权。

资源提案（尚未执行）：fresh free≥1GiB+128MiB；工作60s+fixture清理最多50s+外部最多10s，完整case内finally等待runner.done、afterAll、外部worker和stdio实际退出都受同一外部120s总限，内层共享绝对workUntil/cleanupUntil。单个随机专库、动态127.0.0.1 listener、≤256收到的HTTP请求、≤8任务；连接配置上界14=admin1+fixture2+server8+pg-boss3，不冒称实际同时峰值。DB末次完整logical样本≤64MiB（非硬配额/未观测峰值未知），自有TMP/cache/持久fixture总≤32MiB，stdout/stderr raw≤32KiB，四个有限fixture收据各≤8KiB，人工准备/结果证据另≤128KiB。源码输入文件不计新增运行数据，均已有定量manifest；不触碰其他数据库/缓存/个人配置。

执行环境仅由外部窗口显式提供 `FLOW_C02_PG_WINDOW=reviewed`、approved local `FLOW_C02_PG_ADMIN_URL`（只消费、不打印）、`FLOW_C02_PG_RECEIPT`独立路径和两个绝对UTC毫秒deadline；NODE_DISABLE_COMPILE_CACHE=1、独占TMP/cache、移除NODE_OPTIONS/NODE_COMPILE_CACHE。不沿用未确认的旧连接/进程/输出。

生命周期复用已审SVC07/ClaimCenterFixture方法而未import他人测试：CREATE前wx/fsync随机reservation，CREATE ACK后OID+随机comment才获得DB身份；DROP前重核身份且0连接。未知CREATE、startup/close/runner未知均KEEP已知资源，绝不按名字或强制终止他人连接清理。start/close仅同一promise；beforeTurn全部失败分支释放；主失败与cleanup分开。超时不重试，外部worker/stdio结束、精确root身份、DB身份/conn0/DROP/absence、raw计量必须独立收据完整才可claim cleanup成功。

直接输入：`pg-source-manifest.json`（291固定供给含30SQL+本片新增依赖）。专属类型配置已静态检查该PG源码（exit0），不执行它。原pure53日志/定向7、旧consumer65/66与修后8记录不重跑；首组退出码UNKNOWN纠正保留。

外部验收必须读取真实selected=6、passed=6、进程退出码、全部raw与最终fixture收据；adminError/poolError/cleanupErrors任何非空均失败。最终收据不声称自身写入已确认；监督者另核其O_NOFOLLOW身份/hash/完整JSON，与stdout安全事实比对。当前 `execute-pg-once.py` 已按既有S01有界subprocess方法实现。独审发现receipt资格、末尾阶段时钟与external遗漏三P2，已窄修待固定复核：未获严格receipt资格保根；每个read/sample/delete/save阶段核同一剩余时间；Node/Vitest流hash在spawn前。尚未执行该外部运行收据，不能仅凭测试源码或清理字段打开窗口。

最终文件仅before-final-receipt阶段快照，stdout独立delivery报告写ACK与末时钟，真实工具退出另由调用方记录。4096项/depth8的自有临时目录仅进程组/stdio结束并receipt确认后完整采样；不能冒称活动写删峰值或硬磁盘配额。
