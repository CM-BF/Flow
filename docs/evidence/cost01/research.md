# COST-001 来源记录

2026-10-06 09:18 UTC。固定本地77c420cf9ee5de0291ea93014b6ea11aead6fab5，读取claude.ts emitUsage、server usage.ts、contracts/tasks.ts UsageTotals、App.tsx用量标签。只读，0模型/0安装/0负载。实际应用本地find-skills、codebase-design、clean-code方法：明确计数语义、唯一状态所有权、小读口与有界验证，不引新通用框架。

一手资料本轮已打开：
- [Agent SDK cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking)：SDK金额是估算；streaming每turn的usage与modelUsage/总费用范围不同，累计值及resume/reset需按真实计数段处理。固定0.3.290具体行为仍要与其types/保存证据比对，不把新文档自动当安装版本保证。
- [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)：cache读写与普通input来源口径需分别固定；不同来源不能未核就相加。
- [OTel GenAI属性](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)：采用前固定规范版本与input/cache归一语义，仅出口，不是本系统持久账本。

上面是设计依据而非测量结果；Codex total/last/cached与辅助请求覆盖仍待明确，不通过目录/schema存在推断账号用量/账单。GO提供的研究与本轮读到的源码现状一致；不需要新增provider查询来证明已有字段。

## 2026-10-06 稳定资料前缀候选（GO研究输入，未测量）

本次本地只读复核固定main8d8ab520a9d43c7b9dafb22911416ee799ebf665的conversation-context/store.ts:14–17：compile把不同userText放在固定sources前。若首字不同，该body会在14-byte `User message:\n` 后分歧；这不是整个provider请求只共享14字节，也不是已测token/费用浪费。GO已核的一手来源：[OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching#how-prompt-caching-works)、[Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)，观察日期2026-10-06：完整前缀精确匹配，稳定资料优先、变化内容后置是候选编排。

COST001-02后继可在空槽做一个0模型结构toy：固定合成资料与不同任务，当前编排对稳定资料先行，比较共同前缀字节、增量资料字节、身份/顺序/引用完整性；最多100输入、总10秒含清理、证据2MiB。不启动provider/本机原生harness，不用char/4冒tokenizer。fresh多agent与同native会话resume分别记录，不把byte复用称token或账单节省。是否进入真实对照由结果及可控制的SDK输入接缝决定。

当前没有执行toy，优先级保持ENG/TUI/附件之后；本管理claim只记研究。原模板/冻结request/digest和附件v2不改。未来采用必须版本化并沿恢复/引用验收，不重写native历史，不造第二compactor。沿既有find-skills/codebase-design/clean-code方法定义小模块和有界证据。


可复用的既有真实回归输入：main的`docs/evidence/r02/native-results.json`中runs[first/resume/control]已有保存adapter usage事件。GO只读核到first Sonnet input/output/cacheRead/cacheWrite为4/142/1769/1983，resume累计为6/163/1769/3213；Haiku首轮与resume均983/11/cache0。作为COST001-02的来源/辅助覆盖/基线候选，不重启R02或读其prompt，不冒称完整原始SDK wire或完整费用来源。不能按模型名自动归为协调成本，也不能把两累计值相加；resume baseline=unknown继续保持，后续按固定sample身份及计数段验证。
