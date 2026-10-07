# CHAT05P01：固定三项 PG 入口（NOT_RUN）

本入口只验原完整正文领域的三项实际数据库/HTTP 场景；产品源码沿 40af，唯一新 test-only delta 是原 fixture 的证据路径、资源观察和清理身份。没有重跑原 28 项、类型复验、provider 或生产挂载。当前仅准备，实际运行需 Lead 明确接入唯一共享 PG 窗口。

## Interface 与固定输入

- `run.py` 只配置并调用固定 OPS14 `supervise`，不复制监督循环。固定 Python 3.13.3、Node 24.20.0、Vitest 4.0.18；全部路径/字节/hash与21条现有alias见 `inputs.json`。原20条包metadata之外显式纳入已批准的pg-boss类型补给，没有新增link/install。
- 原209源码、31动态URL/SQL（含033、012/013与017/019固定数组）及3个workspace包入口逐字核对。生产40af保持；只有fixture是本次增量。第三方实际ESM解析入口以只读 `import.meta.resolve` 定位，未import；manifest核验不是所有包内部动态资源或实际可运行证明。
- 唯一新 `pg-run-01` 必须不存在，0700 root/tmp、exclusive reservation先持久，fixture JSONL为0600/exclusive/fsync。对应固定config只收 `apps/server/src/native-activity-body/body.test.ts`，预期3/3且0未选；当前 NOT_RUN。
- 一随机标记专库、一个实际createServer及其动态loopback listener，关闭/重开原center一次。显式033及reader routes在fixture挂载；不能声称production factory/runtime已开通完整正文。
- 三个synthetic task/attempt，经公开register/submit/claim/events与授权reader；没有runRunner/native/provider/浏览器。旧prefix仍不伪造可追回正文。

## 仅这三个原用例

1. `recovers >2MiB input after an admitted lost ACK and restart, then pages all input/result bytes with no eager body`
2. `rejects conflicting chunks atomically, blocks successful finalization, and retains incomplete material after cancellation`
3. `keeps legacy prefixes honest and reruns migration without rewriting old activity detail`

原三行为断言/正文来源/同批重报不变；第一页/SSE轻引用与实际HTTP分页分开。原闭包固定在旧base，不用当前main覆盖共享输入；main对齐仍需独立集成。

## 预算与清理

fresh门取 **1 GiB +96 MiB PG allowance +16 MiB临时 +2 MiB原件 =1,193,279,488 B**。原90s命令上限不加长，包含正常afterAll；OPS14仅对本次newChildSession作0.5s TERM/2s reap，监督段最多92.5s。输入核对最多10s的检查点预算；文件持久化完成时间如实记录，不能把整个Python进程说成硬92.5s期限。没有后台清理owner、额外自动PG重试或deadline后DROP。

fixture每次HTTP受理前/清理前实读卷free，低于1GiB即拒绝后续工作/保留；不是OS磁盘配额。固定两份大正文及序列保证有界工作量，临时文件在工作/HTTP/pool关闭后作500ms/1024项/no-symlink稳定观察，上限16MiB；外层最后核cache/tmp。上述是有限采样，不是连续峰值或物理预留。专库size上限96MiB在DROP前检查；WAL与共享PG其它写入不能由pg_database_size归属，仍计实际卷free，不能说96MiB是硬WAL配额。

正常路径：关闭app/listener与pool→原OID+marker一致→数据库size/卷free/临时界→最多3s观察pg_stat_activity(pid/state，LIMIT33，每轮query_timeout≤剩余且晚零拒绝)→先行fsync checkpoint→普通DROP→remaining=[]→原目录dev/ino重核→先行checkpoint→正常删除专属fixture临时目录→admin关闭→cleaned记录。外层要求exit0/owned组absent/双EOF、3选中全过和完整cleaned才能PASSED；Vitest失败和cleanup错误分开保留。未知时不FORCE、不终止别的session、不删专库或未知目录。超时停止进程组不等于专库已清；最终数据库/fixture事实缺失就UNKNOWN_RETAIN。

`pg-run-01`本身、raw、cache及任何未确认目录保留，当前无删除动作。捕获stdout/stderr总≤1MiB；fixture JSONL≤256KiB、Vitest JSON≤512KiB，原件合计≤2MiB（保留64KiB结果空间）。输出/采样异常不覆盖原监督失败。

## 运行交接

只在Lead交共享窗口后先fresh账本/原bindings/free与namespace不存在。使用 `inputs.json` 固定Python执行此处 `run.py`，只给既有 `FLOW_CHAT05P01_PG_WINDOW=authorized`。fixture沿已有固定本地PG入口，禁止打印连接值。入口不调用个人安装、Docker、provider、模型、用户tab或其他任务。

本次准备已做：固定源码/SQL/包metadata与解析路径读取、Python AST解析、文件差异与status解析。0产品import/测试/types/PG。最初metadata脚本把workspace包当有version，KeyError后停止，修为workspace manifest hash归属核；未改任何包/fixture运行结果。此准备错误与实际测试失败不是同一层。

技能与结构复核：复用本地find-skills方法，读取clean-code/codebase-design/brainstorming；这是已授权既有三场景的有界入口，无新平台。新职责仅运行输入固定/证据接缝，生命周期仍原fixture与OPS14。错误failclosed、正常DROP前持久化、产品生产模块与原行为断言不扩。新增fixture代码及入口尚待独立源审；旧源/局部批准不能自动覆盖它。
