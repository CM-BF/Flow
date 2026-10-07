# Stage C：27 原 case 的独立 PG/HTTP 验收准备

状态：PREPARATION_REVIEW_PENDING；实际 PG NOT_OPEN。此页取代旧静态“21组”估算，旧 collect 末尾 owner 计数 FAIL/原 raw 原样保留。名单复用 `enable-binding-stage-c-analysis.json` 的真实27项：runtime10、registry17；不重复 collect、A17 或 B九入口检查。

## 入口与职责

`enable-binding-pg-once.py --admission <absolute-file> --sha256 <64hex>` 是本片薄调用方；只消费固定 OPS14 `supervise(Launch, Policy)`，不复制进程组监督/TERM/KILL循环。主入口需要 co-lead 明确 `X01_STAGE_C_PG` OPEN，claim完整v8身份/17scope、当前clean HEAD、新32hex window、manifest SHA和≤60s的ledgerObservedAt，以及非负pairedBytes。收据是同机协调事实，不是密码学授权。新namespace仅 `enable-binding-stage-c-run-r1`，存在即拒绝，旧StageA/C局部结果不复用。

创建RUN之前核固定源、直接闭包/动态SQL、已供给依赖和工具、资源；随后受监督git确认完整dirty/untracked及精确branch/HEAD。实际Vitest前同PID写wx0600/noFollow的launch checkpoint并fsync/父目录fsync，再exec固定Node24/Vitest4。任何未知不开始后继；PG启动最迟为共同原点+15s。唯一Vitest worker串行跑两原文件，不改27业务断言、不断言新生产mount或真实runner/npm能力。

`PluginDatabaseFixture`只拥有本次随机专库/精确receipt目录，封装共同deadline/HTTP计数和数据库身份。第二suite创建前检查已出现的另一suite结果已收束；上一suite缺receipt或cleanup未知则零CREATE。应用重启先close旧listener，所有listener均记录关闭。startup promise未settled时不把一次超时当启动停止；afterAll等待到共同cleanup期限，未知则保留，不强删。

## 拟议 PG 窗口预算（尚未授实际运行）

- 单调外层总180s：原点起work110s、共同cleanup至170s、最终10s。每HTTP≤8s且夹到共同work期限；分页每次request都扣计数并查截止。3个lease反例原1s租约/4s有界DB锁屏障保持，正常工作估计明显低于110s，但当前没有本片PG时长事实。
- 2串行随机数据库，理论峰连接runtime17、registry15（server10 + fixture4/3 + admin1，runtime额外boss2）；4个动态loopback listener顺序启停。不是数据库连接实测峰值。fixture自己的query/statement timeout仍保留；cleanup必须同OID/owner/marker、所有owner/pool关闭、0conn、ordinary DROP ACK、absence、admin关闭，不force、不终止他人连接。
- HTTP实际发起计数上限416，按suite固定分区256+160；包括拒绝/失败请求。原有限注册/循环输入及两分页给足余量，未知循环会被共同时间/计数截断。每响应流128KiB、各suite累计4MiB；只量响应body，不称TCP/HTTP完整wire字节。无第二共享计数文件或产品状态机。
- 自有TMP32MiB/4096项，结束时有限、不follow symlink的采样；不声称全时硬峰值。已知closed进程、双/合并EOF、匹配launch与两完整DB收据后才可同dev/ino清理；特殊节点、身份/过程/账目未知则KEEP。启动线1GiB reserve+32MiB TMP+1MiB raw+同时运行者完整声明。
- raw总1MiB：stdout/stderr capture256KiB，Vitest JSON128KiB，8个suite收据各16KiB，preflight32KiB；其余留给reservation/checkpoint/最终report/独立工具wall、CLI8KiB和后续人工结果。持久副本实际求和，未保留stream tail另加，不把同一已保留流再加两次。完整总量未知则不能声称within预算。输出fsync最后尾段不冒充OPS14硬期限保证，外部 `/usr/bin/time -p`/真实tool exit需另保存。
- 0真实native/SDK/provider、0安装/浏览器。PG资源与实际holder解除后才可授OPEN，普通local通过不开放PG。

## 本次必要局部检查

2026-10-07T04:20:49.147387Z–04:20:51.540101Z，两child：受影响消费者strict exit0；caller5个资格/identity/大小/截止/替换清理反例全过。原27未执行、未重collect。单记录 `enable-binding-pg-preparation-local.json`：内部2.392676s/raw844B，两group final absent/EOF，两个own TMP精确身份清理absent。工具wait不是完整wholewall；当前external wholewall UNKNOWN。本次只证明类型与有限caller门禁，不能代替真实PG资源生命周期。

## 质量与边界

沿既有本地find-skills→codebase-design/clean-code，固定来源复用不安装。资源状态由唯一fixture/OPS14拥有，入口只绑定/核验并保未知；27断言与产品实现ade4不变。对同一beforeAll失败、晚startup、未确认CREATE/DROP、checkpoint损坏、输出截断，结果均保守UNKNOWN/KEEP。所有旧red、StageA HOLD、StageC旧21计数FAIL保持。完整X01仍缺production claim/runtime资格/真实有用npm bundle与公开端到端旅程。
