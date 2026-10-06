# Final projection promotion — R05C handoff

WPF-MATURE-02实验writer仍为chatui01_owner/co-lead mika；当前final.mjs及final.test.mjs冻结。Mika同意R05C native_center_owner在其codex-native-adapter独立worktree、正式领取的 `apps/runner/src/native-harness/codex` 内只读提升这一算法。本回执不移交实验scope，不更改R05C状态或文件。

固定来源：`0d0524c3439363d1fe60aad63f62817ba51fa2a5:experiments/codex-app-server-conformance/final.mjs`，SHA-256 `01fd832745a81b4e098d63c3a97aadd8c38942b33c73132c0de78fd7c6b6a5ad`。本owner已再核当前文件与该Git对象逐字相同。固定相关测试路径：`experiments/codex-app-server-conformance/final.test.mjs`（15项final场景）与 `experiments/codex-app-server-conformance/catalog.test.mjs`（12项目录场景）；现有[manifest](conformance-manifest.json)绑定两文件、全部27项raw及来源。不重跑本次无行为变更的测试。

输入为 `createOrdinaryFinalProjection({threadId,turnId})` 与其 `accept({method,params})`；由adapter先用自身accepted native receipt绑定thread/turn，再从唯一R06 receive路由已解码item/completed及turn/completed。输出只表示这两个事件的证据投影：pending、unknown/unsupported、failed、interrupted，或completed + typed final与actualExecution=unknown。completed不是Flow task成功、provider授权或access:none证明。

必须继承的语义：

- 同thread + turn身份、item id有界且保留原始ID；不截断，不拿Flow conversation ID代替native identity。
- item完成与turn完成分开；唯一明确agentMessage final_answer + turn completed/error=null才形成候选。phase=null未知；commentary/tool/delta/interrupt ACK/error通知不能代替final/成功。
- async delivery、非空questions不能冒充普通终文；多个final不能取最后项。failed/interrupted与unknown分别保留。
- itemsView summary/notLoaded不代表全集；full view必须与已观察的completed item一致，并检查phase/其他final/复杂消息分支。
- 重复item/terminal必须一致；terminal后迟到item和错误身份使该投影无效。投影只面向连续观测，不宣称resume/replay/reconnect成立。
- 128 UTF8字节native ID、1MiB内容、64 completed items/2MiB累计、2MiB decoded notification等现有本地界限保留或由正式合同显式收紧。wire JSON frame限制另算，不能静默截断。
- sourceMessageId/messageId为Flow确定性编码，原始native身份可复算；实际model/effort/tier/tools不能从requested或ThreadStart配置回填。R05的host终态、权限、验证和取消责任仍在宿主。

提升范围只含final投影，不复制transport、catalog或controls。本owner暂不写不存在的生产import。待R05C生产单一Module有正式JS/TS入口、固定target和独立approval后，本owner将实验final.mjs改为消费它的薄入口，删除实验算法副本，并把27项作为直接消费者重新验证；不得长期维护两个实现。入口形状由R05C正式合同提供后再定。


生产错误边界：实验使用node:assert，AssertionError可能持有actual/expected（含native IDs/正文）。R05C不得把原始AssertionError或远端params/body写入detail/log/UI。可保留throw后投影失效语义，但host必须归一为固定reason/code并回报unknown/unsupported，不暴露rawactual/expected；若改专用错误，由实际消费者验证。此项是生产提升约束，不是现已审纯实验发生泄漏的结论。
