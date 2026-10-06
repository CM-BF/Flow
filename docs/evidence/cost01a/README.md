# COST01A — 有界任务用量解释

Module 已获独立只读 APPROVED，待main/公共接线。它读取原账本，未改 UsageTotals 数值定义或现有存量行，也未调用 provider。共享 factory/client/各端呈现尚未接入。

## 已实现

`GET /api/tasks/:id/usage-readout` 返回现有 `legacy` 和新的分项解释。Claude 权威 samples 的 input 表示未缓存输入；cache-read/cache-write 分开列出，不能把旧 `inputTokens` 误叫“全部输入”。其它来源保持 `source-defined`，特别是 Codex informational 不能套 Claude 相加口径或变权威。

基线规则只有一处：`usage.ts/projectUsageContribution` 由原写入与新读取实际调用。写入仍只使用 input/output/cost 三项；costKind unknown 仍在原位置将费用设 null。读口对缓存按每个 stream 的严格前序求差，可跨 task；new-session 必须真无前序且非 resume，明确 sample 基线必须恰为前序，旧 ID、缺失、下降均不补零。负差不当作回收费用。范围/版本重置未由当前事件明示时也不能猜测。

只读 tasks 的 id/usage/harness/resume 标记及 usage_samples 数值对象。不会读取 prompt、session details、助手正文或工具内容来补 SDK 版本。现有账本未存 producerVersion，所以一律 null，coverage=unverified；source 名称/当前源码/模型名都不冒充历史版本或阶段证据。0.3.290 reference 仅文档背景。

`UsageQuantity.value` 仅在已读贡献全知且读取完整时有值；`knownSubtotal` 是已知部分，缺测时不能当任务总量。安全数值范围溢出时小计也为 null。费用按记录分类，SDK 估价不是订阅账单，`providerActualUsd` 也只是账本的声明分类，本模块没有外部账单核对。

## 有界读取与真实性

- 单次至多 1000 samples + 1 判界；最多输出 32 source/model/accounting 组。`sourcesOmitted` 仅已读前缀内组数；越界部分的来源与费用未知。
- 一次批 SQL/LATERAL 严格前序查询，无每条网络 N+1。最多两个 SELECT，RR 事务只覆盖本次读取。
- 不是查询容量/SLO：task 的 authoritative 部分已有部分索引，包含 informational 的 task 查询可能扫描更多数据库行，仍受 host statement_timeout；本片限制返回/Node处理数量，没有宣称数据库扫描工作恒定。
- 大 payload 案例响应 1,887 B；1001 条记录/40来源案例只读1000条、返回32来源，响应 29,229 B。这是合成数据未压缩 JSON 字节，不是 token 或通用负载性能结论。
- 固定页面上限是首片降级：超过时保持完整旧 legacy，新的完整值一律 null，已知前缀明确标注；不悄悄截断成“全部”。

## 检查与原始证据

Node24 / Vitest4.0.18 / TypeScript5.9.3。`checks-red.txt` 真实 2/2 缺路由失败 → `checks-first-green.txt` 2/2 → `checks-matrix.txt` 8/8 → `checks-final.txt` 9/9。最终9项覆盖授权、无额外query、重放不重计、未知/负差/严格前序、跨task resume与中心重启、缺缓存/零错误样本、来源隔离、1000/32界限和unsafe整数、旧fixture口径。四次独立随机数据库均在对应 `*/cleanup.json` 中 remaining=[]。

`producer-checks.txt` 是未改 Claude adapter 的5项直接消费者（26未选择），注入 SDK、0模型：稳定ID/resume unknown、success形状error不当零、turn-limit、未知价格、stream累计基线。共 **14个不同检查，分轮执行**，不是一次14/14。`typecheck-delivery.txt` 无stdout，配套 `typecheck-delivery-exit.json` 是执行包装器当次捕获的 exit0，不补造编译输出。

复跑（需 Node24、现存固定依赖及足够≥1GiB共享余量；不自动安装）：

```sh
FLOW_COST01A_EVIDENCE_DIR=/tmp/flow-cost01a-check PATH=/opt/homebrew/opt/node@24/bin:$PATH node node_modules/vitest/vitest.mjs run apps/server/src/usage-readout/readout.test.ts --no-cache --configLoader runner
PATH=/opt/homebrew/opt/node@24/bin:$PATH node node_modules/typescript/bin/tsc --noEmit
```

## 原始历史与官方对照

`source-facts.json` 只提取已存数值和源文件 hash，不复制 prompt/凭据。O08：旧 input/output=1217/838；另有 cache-read10771/cache-write5059。O10：旧1403/272；另有2298/2600。R02 first/resume 本身是累计快照，resume明确unknown基线，不合计成新增消费；control独立session也不混入。

2026-10-06 读取固定 `@anthropic-ai/claude-agent-sdk@0.3.290/sdk.d.ts:1432–1456,5683–5693`（hash见source-facts），另对照当日[官方cost-tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking)。当前官方说明 modelUsage 覆盖 query pipeline，result.usage 限主循环；续接会带历史累计，费用是估价。固定声明还明确 pipeline 外 helper 排除、错误可零值、fork/resume/clear 生命周期。网页可能后续变化，实际口径以固定生产者和已存样本为准。

## 边界与后继

未验证/未实现：Web/TUI/CLI呈现、共享 factory/client、实际 Codex权威用量、辅助调用外部补计、阶段归因、全局预算、真实模型重复实验、真实订阅账单。原来的 SDK 版本/attempt未随每条sample持久关联，不能在轻读时编造或读取正文猜补。COST-001仍 open。
