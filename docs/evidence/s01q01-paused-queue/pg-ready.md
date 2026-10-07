# S01Q01：两例暂停队列验证候选

SOURCE_PREPARATION_APPROVED；**实际 PG：CLOSED / NOT_RUN**。唯一进度事实源为 [status](../../../plans/s01q01-paused-queue/status.md)，本页只给运行接线，不创建另一状态权威。

固定实现 `103232eeab0f861e1ab87f496e9b9f0f1c068965`；独审 packet `347209c15748e9c008c9472fad57aa59e5a9591d`；db_transaction_owner 2026-10-07T20:37:05Z APPROVED，原唯一 P2 CLOSED。完整输入复用 [runtime-inputs.json](runtime-inputs.json)，SHA256 `834873779db710e402bd4a1807a4801d1118378720312dedfc2dce994b500381`，不修改该原件。

未来 execution HEAD：`<FUTURE_GRANTED_EXACT_PACKET_40SHA>`。本次最终 commit 后向 lead 交付 literal 40SHA；新实际 permit/admission 必须固定该 clean packet HEAD，不能沿用 source SHA 或旧 CLOSED permit 的 head，也不为自引用再改本页。

## 一次运行入口

cwd `/Users/citrine/Projects/AgentHarness/Flow-worktrees/queue-paused-scan`。

```text
/opt/homebrew/bin/python3.13 -I -B /Users/citrine/Projects/AgentHarness/Flow-worktrees/queue-paused-scan/docs/evidence/s01q01-paused-queue/entry.py --permit /tmp/flow-s01q01-<window>-permit.json
```

window 是新授权的 32 位小写 hex；相邻 `/tmp/flow-s01q01-<window>-permit-admission.json` 是同一次外部准入事实，两者必须在 Git 树外。任何 actual permit/admission/`pg-run-<window>` 均未创建；已存 [closed-permit.json](closed-permit.json) 保持 CLOSED/过期/reviewed=false，不能启动。

固定选择（仅两例，不运行旧全套）：

1. `skips more than a default batch of paused queues without rotating them and scans again after explicit resume`
2. `keeps pause CAS authoritative when a candidate scan races promotion`

## 资源与期限

- 140 秒同一 origin：70 work（含加载/CREATE）、至110 cleanup、至120 child结果、至130 OPS14 stop、至140父receipt；这是监督/阶段门禁，不是硬OS完成保证。
- 配置连接24：admin1 + fixtureSQL10 + fixtureBoss2 + factoryBusiness8 + factoryBoss3。两例不启第二center；若选择旧双center另13，本候选不允许。automaticQueueScan=false仍有lease/dispatch/pg-boss背景。
- local8MiB包含raw2MiB，TMP4MiB/1024项，总目录2048项、清理前有界采样及256KiB父回执预留；超额/未知KEEP。不是运行峰值/硬配额证明。
- DB安全点128MiB阈值，另128MiB WAL规划储备；后者非WAL实测，前者非峰值。候选新增储备264MiB（128+128+8），未来经理完整sum还需其它实际growth/共享余量及**一次**全局reserve，不复用旧floor或重复加reserve。
- HTTP最多256次，每响应256KiB、总2MiB；错误停止新work、保持首错，资源关闭与验收失败分别记录。

## 新实际许可必须满足

新唯一经理window/OPEN；fresh≤60秒精确claim `a8a3b2d7-1bde-438a-9fbf-f81e1c791350` v1 ACTIVE、task/worktree/branch/四scope；future packet HEAD且clean，caller再核本地Git；manager fullresource terms与floor一致并freshfree足够；运行输入284绑定/36aliases不变。外部准入是合作事实，不是任意字符串自授权。文件与namespace独占，未知即停止，无自动重试。

私有 `FLOW_S01Q01_TEST_ADMIN` 仅由已有合法本地测试fixture固定Git表达式来源按授权私下供给；具体来源见原 [runtime-inputs.json](runtime-inputs.json) privateInput 与固定 b79121e 测试闭包。仅loopback/postgres、禁止query/fragment，不能用协调数据库。本文不读取、不输出值/URL/hash，也不新增凭据来源。

CREATE intent/ACK+OID/owner/marker和持久回执；所有owner/活动连接及身份明确后才普通DROP，UNKNOWN KEEP。TMP首删前和每项复核目录/非symlink/canonical/devino；无强删、外部signal、重试或旧KEEP操作。当前15pure与历史fixture/types只是准备证据；真实两例、DB/HTTP/140秒关闭仍待新窗口。
