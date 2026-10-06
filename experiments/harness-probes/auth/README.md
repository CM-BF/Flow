# E01 可丢弃认证探针

固定 `@ai-sdk/harness-claude-code` **1.0.143** 和 `@ai-sdk/harness` **1.0.139**。这是合成诊断，不是 Flow 认证实现或完整 Harness 验收。0 模型、0 云、0 真实 OAuth refresh / Keychain；不读取共享登录，不重设 HOME。

## 复跑

Node 24.20+，仅 Node 内置模块，不需安装整个 harness 或修改依赖：

```sh
node experiments/harness-probes/auth/run.mjs /tmp/e01-auth-rerun.json
```

输出必须是新路径，`wx` 防止覆盖既有证据。启动器按场景创建独占临时目录和子进程；常规场景最多3秒，挂起场景700ms触发 SIGTERM，300ms后仍不退出才 SIGKILL。父进程清理临时目录。9个场景为短样本，耗时不能作性能/SLO或执行 agent 容量结论。

## 来源与调用链

[provenance.json](provenance.json)记录实际安装版本、每份源码 SHA256 与原路径；[upstream/](upstream/) 原文复制，无函数修改，分别保留上游 Apache-2.0 LICENSE。来源仓库为 Vercel `vercel/ai`，具体 npm 版本与逐文件 hash 固定；没有把未知发布 commit 编造成版本来源。

| 层 | 行为与范围 |
| --- | --- |
| claude-code-harness.ts `doStart`，839/870–872行 | 实际读取完整启动调用点；直接 await `resolveClaudeCodeAuthentication({auth:settings.auth})`，未传 startOpts.abortSignal。仅静态检查、hash登记，不执行harness启动 |
| claude-code-subscription.ts `resolveClaudeCodeAuthentication` | 显式环境/直接凭据先判断；需要 native subscription 时 await readSubscription；本探针执行该helper |
| `readClaudeCodeSubscription` / `readClaudeCredentialStore` | 先读有效凭据文件；仅默认配置目录+darwin可回落Keychain；到期则刷新并写回读取来源 |
| harness `oauth-access-token.ts` | 默认提前300000ms刷新；调用fetch，无signal/timeout参数或single-flight锁 |
| `writeClaudeCredentialFile` | mkdir→write同PID临时路径→chmod600→rename；源代码原样执行，真正文件操作只落入合成根目录 |

## 注入与保真边界

`runtime.mjs` 用 Node VM modules 与类型擦除加载原 TS 源码。Node VM 是便利的注入机制，**不是对恶意源码的安全沙箱**。源码已读并固定 hash；上游动态导入/未知依赖被拒绝。

- 文件I/O是真实临时文件操作，但只开放readFile/mkdir/writeFile/chmod/rename，检查路径在本次临时根；不提供外部命令。合成目录里不创建symlink。
- `process` 仅提供当前测试PID、linux默认平台及合成USER；helper调用显式给临时home与darwin分支。`homedir()`、默认settings文件读取、默认network fetch、API key helper与非测试命令均抛错。宿主HOME没有重设。
- Keychain read/write是内存替身，`/usr/bin/security`永不执行；fake fetch只构造本地Response，URL被用于断言，未发请求。provider-utils仅以JSON.parse/isRecord替身处理已知纯合成JSON；不覆盖上游安全JSON解析器的恶意输入行为。
- Date.now固定为1800000000000，精确观察到期阈值；耗时使用宿主performance.now。
- `rotate-once` 先让2/16个调用都提交旧refresh，再令第一个响应200并轮换，其他400；这是明确假设的服务端策略，不是对Claude真实刷新政策的断言。
- `shared-temp` 令所有fake refresh成功，并在真实writeFile后与chmod后各加一个屏障，使操作落入共享tmp路径竞争窗口；这是受控交错，不是自然发生率或负载benchmark。
- `unbounded-refresh` 的fake fetch永不完成。调用者30ms取消；150ms记录是否settled，然后由父看门狗结束进程。`injected-timeout/cancel` 是在fake fetch显式注入的调用者策略，不能算上游已有取消支持。

源文件校验失败、子进程失败或观察不符合探针断言会使run返回非零；JSON `result:passed` 仅表示探针完成并核对预期观察，**不表示上游并发/取消可靠性通过**。上游结果见 [证据](../../../docs/evidence/e01/README.md)。Paseo、真正Keychain刷新、跨PID锁、实际网络、真实provider政策、模型、整个doStart与Flow系统集成均未测。
