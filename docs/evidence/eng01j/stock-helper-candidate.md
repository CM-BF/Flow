# ENG01J 后继：stock FS helper 最小零query兼容事实

状态：PREPARATION_ONLY / NOT_RUN。现5产品已main bf8b5f1d5f554b3195b04b150821d8262a4daef1，保持冻结。本候选只需自有evidence中的薄exec入口与运行记录，不先改生产policy/host/R06/C02，也不新建exec-server分叉。

## 真实入口与已读证据

固定现机binary及包版本沿[只读兼容输入](native-helper-compatibility.md)：0.154.0-darwin-arm64 / 222655232B / SHA2564f85982624b3898c8991cb80c0981b2aa71070e3537046c9a95950318a95afcc。本次未运行binary，包括help/版本。上游以下是公开源码中的**内部helper参数**，不是承诺稳定的用户CLI API；当前binary仍需实际验证该route。

- [arg0/src/lib.rs:107](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/arg0/src/lib.rs#L107)，SHA25621fcc89e42d209244a78f9296d5d59e13865359fcb19932c8832eb708c5b4b76：argv1 `--codex-run-as-fs-helper`直接进入helper，位于load_dotenv/普通CLI配置之前。
- [fs_helper_main.rs](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/exec-server/src/fs_helper_main.rs)，SHA256feca100953e8cb151371eaada589fccc67fab59a3efd33058691b09013d0a7f8：current-thread Tokio，读取一行JSON、执行一次请求、输出一行JSON后exit。错误payload并不必然导致进程非零，因此必须核payload+文件事实。
- [fs_helper.rs](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/exec-server/src/fs_helper.rs)，SHA25610e6ec33660e2c2f044e8e5e3504e73809e195e48d1e7bb873763dee29b4eb6e：`operation: fs/writeFile`使用真实DirectFileSystem；helper本身不再施加第二层sandbox，正常调用由fs_sandbox的SandboxManager先设置OS限制。所以本候选必须外部先施加明确Seatbelt，不直接裸跑helper。
- [协议FsWriteFileParams:502](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/exec-server-protocol/src/protocol.rs#L502)，SHA256774e9f3813c7ad056d14578341173c5037fce0a19f52f6481de4f0f9091ca929：path是file URI，dataBase64、followSymlinks、sandbox是明确字段。

## 两项串行实际调用候选

一个host独占scratch，0700；两个预先存在且独占的regular文件calculator.mjs和baseline.txt、初始字节0。仅同一既有calculator.mjs可写，baseline只读。每项一个stdin JSON，最长1KiB；第一项内容为：

```json
{"operation":"fs/writeFile","params":{"path":"file:///private/tmp/<own>/calculator.mjs","dataBase64":"WA==","followSymlinks":false,"sandbox":null}}
```

`sandbox:null`是上游内部helper wire形状，不是申请关闭sandbox；OS policy在进程exec之前已生效。第二项仅将path换成同scratch/baseline.txt。两次均`/usr/bin/sandbox-exec -p <固定完整policy> <固定codex> --codex-run-as-fs-helper`，没有app-server、模型、auth、catalog或provider。

**入口不复制监督。** 复用原OPS14 newChildSession及capture。薄Python exec-only shim将host持久的只读request文件以NOFOLLOW打开并dup到stdin，然后关闭额外FD、execve固定sandbox-exec；同PID/组交给已审supervisor。不spawn嵌套Popen、不另做poll/timeout循环。stdout/stderr仍由OPS14收集。stdio请求FD只能读，不能给helper继承可写越界FD。环境只给自有HOME/TMPDIR/CODEX_HOME和固定最小PATH/LANG，私有配置/账号路径不读。

第一项必须完整JSON `status:ok`且`payload.operation:fs/writeFile`、response={}，target确为X、baseline保持0；第二项必须error且baseline保持0，target仍X。不能仅用exit0判写入成功/拒绝。两个进程都要实际EOF、退出和最终owned状态；未知/首失败保存原始安全摘要与资源，不加grant、不换binary、不自动再试。

**隔离能力边界。** 先尝试完全现有J策略，保deny-fork/网络/其它exec，没有network-all。真实Rust runtime是否需要额外必需操作尚未知，失败只记录具体边界，不能照抄全量上游policy。这个初始exec的stock helper可能独立可跑，不代表app-server中派生helper的路径已可跑；后者必需fork/exec闭包与完整writer域仍另验。本候选不触碰上游sandbox开关；直接helper也不是完整apply_patch模型旅程，更不是native工程验收。

## 预算与停止

候选总≤10s，最多2个串行helper（每项work3s/TERM0.2s/KILL0.3s）；整段含准备需统一截止，不以两项各10s相加。总raw≤64KiB（每项32KiB），自有scratch≤1MiB，原fresh≥1107296256B不降。无PG/Chrome/provider/install/个人服务；运行前需明确本组local实际归还。先固定输入/状态与reservation，再运行，结果耐久后仅exact dev/ino scratch且组absent/双EOF才能正常清理。方案未实现任何新运行入口、未占用local。

## 后续完整停止证据仍开放

如果两项通过，仅更新stock helper启动/文件操作事实；不给G revoked。下一步再沿准确selected原生route评估既有可信终止域或完整获授helper集合。进程树轮询、leader close、group absent均不能单独证明没有逃逸/受托writer。原R06继续为唯一stdio/child owner；不先建设第二executor。模型≥Sol/no-fallback与受限provider网络仍单列，目录实际可用不等资格。
