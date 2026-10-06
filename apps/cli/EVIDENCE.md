# L01 implementation evidence

Owner: Execution Lead / gpt-6-astra. Worktree `m1-cli`, branch `codex/m1-cli`, base `eacee76fa7f1b6cc46b06b57ae68458637be4a26`. This is branch evidence, not main integration.

## Skills and clean-code

Task/stack: Node 24 TypeScript CLI, thin public FlowClient, HTTP/SSE behavior checks. Before implementation used local find-skills, reviewed relevant local codebase-design/tdd (including public-interface testing) and clean-code; CLI search found no necessary additional installation. Reused the fixed skills baseline, with no repeated installation. Applied a small runCli Interface with injected IO, a separate observation lifecycle module, real loopback HTTP tests, bounded text/reference output, explicit error and exit semantics.

2026-10-06 01:09 UTC: work-segment and delivery clean-code review covered names, command dispatch, watch cleanup, idempotency keys, deadline propagation and terminal state distinctions. Added AbortSignal to client.show so an observation deadline includes initial retrieval. Added delivered-cursor reconnect and terminal-page drainage tests; increased short timeout test to 200ms. No known blocker found in self-review; independent review pending.

## Validation

Node 24.20.0 / pnpm 9.15.4. `pnpm check` passed TypeScript and 15 tests: 11 CLI public HTTP tests and 4 shared contract/client tests. Scenarios include caller idempotency, cancel-requested distinction, explicit durable decision/conflict, all terminal exit classes, NDJSON, watch timeout without cancel, initial snapshot timeout, reconnect from delivered cursor and draining final pages. HTTP tests use dynamic loopback ports and no model/database.

Not yet checked: actual PostgreSQL center/runner/CLI integration, browser close/reconnect, real native harness. No claim of complete M1 or remote CI. See [usage](README.md); independent target is the implementation commit recorded in [status](../../plans/l01-cli/status.md).

2026-10-06 01:14 UTC: 独立review确认原实现无blocking，提出普通命令SIGINT/SIGTERM被统一handler吞掉的P2。修复为入口保留OS默认中断行为，程序化watch仍支持AbortSignal；新增真实CLI进程挂起show时SIGINT退出测试。pnpm check通过16/16（12 CLI + 4公共）和typecheck。修复等待复审。
