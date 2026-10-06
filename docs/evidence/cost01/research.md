# COST-001 来源记录

2026-10-06 09:18 UTC。固定本地77c420cf9ee5de0291ea93014b6ea11aead6fab5，读取claude.ts emitUsage、server usage.ts、contracts/tasks.ts UsageTotals、App.tsx用量标签。只读，0模型/0安装/0负载。实际应用本地find-skills、codebase-design、clean-code方法：明确计数语义、唯一状态所有权、小读口与有界验证，不引新通用框架。

一手资料本轮已打开：
- [Agent SDK cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking)：SDK金额是估算；streaming每turn的usage与modelUsage/总费用范围不同，累计值及resume/reset需按真实计数段处理。固定0.3.290具体行为仍要与其types/保存证据比对，不把新文档自动当安装版本保证。
- [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)：cache读写与普通input来源口径需分别固定；不同来源不能未核就相加。
- [OTel GenAI属性](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)：采用前固定规范版本与input/cache归一语义，仅出口，不是本系统持久账本。

上面是设计依据而非测量结果；Codex total/last/cached与辅助请求覆盖仍待明确，不通过目录/schema存在推断账号用量/账单。GO提供的研究与本轮读到的源码现状一致；不需要新增provider查询来证明已有字段。
