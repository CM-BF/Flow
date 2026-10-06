# CHAT06P01 固定正文的 patch 存储成本

编号：CHAT06P01；创建/更新：2026-10-06；状态：in-progress；共同阶段：M2。

目标是用一个极小、可重复的本地实验定位生成中正文每次提交的重复读取与 SHA-256 成本，为 CHAT06-07 后继提供依据。Goal Owner 已授权方法与入口准备；真实 PG 测量须另取得窗口，本片不修改产品。

## 已确认范围与方法

唯一 owner chat06p01_owner / gpt-6-astra，lead Mika。权威 worktree 为 assistant-stream-cost-probe，分支 codex/assistant-stream-cost-probe，固定已审 main fa9a8288341d4f2bd8160e03fe9173dafa2de1a6。只写 experiments/assistant-stream-cost、docs/evidence/chat06p01、plans/chat06-stream-cost；不修改 CHAT06、公共入口、锁文件或全局索引。Mika 独立技术 review，Goal Owner 产品范围验收，Execution Lead 登记与集成。

完整方法与待申请预算见[实验合同](../../experiments/assistant-stream-cost/README.md)。以单一、精确 32768 UTF-8 bytes Unicode 正文，在一个 stream/block 中按 4/16/64 个 patch 提交；总正文、任务参数、session流程不变，仅分片数不同。每 patch 一个真实 runner HTTP report 请求，session/收尾/读取校验移出计量区。没有 SDK 或模型进程。

静态源码在每个新 patch 中调用 readPrefix 的 string_agg，再 sha256(prefix + text)。固定总正文 B、等长 N 片的预测旧前缀读取 B(N−1)/2，完整前缀哈希 B(N+1)/2；这是源码计数预期，不是实测。固定 B 时随 N 线性变化；所谓累积二次增长需要另一个固定片长且正文随 N 增长的实验，本片不作该结论。

## TODO

- [x] CHAT06P01-01 固定基线、合法claim、Unicode/计量方法与最小预算，交 SOURCE_READY。
- [ ] CHAT06P01-02 准备纯数据生成/度量入口及必要纯单测、noEmit，绑定源码与失败证据。
- [ ] CHAT06P01-03 Mika只读审入口并取得明确窗口后，执行一次三任务PG/HTTP短测；未获窗口不运行。
- [ ] CHAT06P01-04 复核输入/前缀/查询/提交延迟/持久化字节与完整性，交限定结论及局部候选。
- [ ] CHAT06P01-05 Mika独审、Goal Owner接收、Lead main接收；保留claim至明确停写。

## 验收与限制

纯生成器通过既定 Interface 保证最终正文完全一致、patch均为完整Unicode、offset/revision/hash正确；实测将保留每请求SQL分类和实际返回前缀字节、SHA输入分类、HTTP请求/完整ACK字节与时延、COMMIT SQL时延、逐patch原样样本及 source前后hash。与最终按需owner正文/patch重建和持久行计数交叉验证。当前无PG结果，不借用旧CHAT06 72项或B02测量作为本片通过。

若观察器无法隔离request/background或不能完整恢复原函数，停止并保留失败；不得估算填充测量字段。所有可能的后续产品优化都须另协调scope和完整性回归。架构：只增加实验消费者，无产品接口/DB/FSM变更，不需产品图更新。

## 依赖与风险

入口复用本WT已审源码、Node24/pnpm9.15.4/Vitest4.0.18及已安装依赖，不追moving main。后台scheduler/scan仍可能有查询，必须按request context单列。计量本身增加CPU/JSON编码成本，延迟仅为带观察器本地样本；不称PG wire、物理WAL、CPU优化收益、provider容量或SLO。3组不构成冷热重复矩阵；顺序/首连接状态按事实记录，不能反复测取优。

变更记录：2026-10-06 初始化已授权有界方法；运行窗口尚未申请。
