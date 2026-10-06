# B01 执行记录

- 2026-10-06：初次 `Node24 tsc -p experiments/bounded-reads/tsconfig.json --noEmit` exit 2，6 个同类错误：randomUUID 默认参数推导为 UUID template literal，真实 runner token 为 string。仅修复测量 request 的 token 参数显式 string；未修改产品代码。此失败保留，不记通过。

- 2026-10-06T03:35Z：修后局部 TypeScript 检查 exit0。初轮 `PATH=/opt/homebrew/opt/node@24/bin:$PATH node --import tsx experiments/bounded-reads/probe.ts ../../docs/evidence/b01/initial-results.json` 实际额外带不存在的可选 env-file，Node提示后继续，未加载任何env；测量15.395秒/exit0/23命名检查/47,496,585响应字节，全临时资源清理。`initial-results.json` 为原始结果不覆盖。无Vitest选择，本轮是23个执行过的HTTP/SQL断言组，不把它们称为Vitest通过数。
