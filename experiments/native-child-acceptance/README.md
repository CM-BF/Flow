# O10 原生单文本 child 验收准备

默认只核本地固定源码、SDK版本、schema与readonly候选配置；不调用query/startup/auth，不建库，不读登录凭据。固定产品基线 `fc113945ff73d1a43092d0a70b51e901aa4be1e2` / Claude SDK `0.3.290`，不得借全局包或升级产品来使验收通过。

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --import tsx experiments/native-child-acceptance/driver.mjs
```

无模型演练使用新输出目录、私有随机 `flow_o10_*` 数据库、动态loopback端口与独立runner进程组，真实createServer/FlowClient/owner受理/生产adapter/runtime/outbox/verifier；仅SDK query transport注入。合成材料一个，普通configured-readonly profile一个，owner定义v1输入后固定pin/key受理一个child，无planner/grant、无额外任务或工程写改。

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --import tsx experiments/native-child-acceptance/driver.mjs \
  --rehearse --output /tmp/flow-o10-new-rehearsal
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --import tsx --test \
  experiments/native-child-acceptance/guard.test.mjs \
  experiments/native-child-acceptance/driver.test.mjs
FLOW_O10_EVIDENCE_ROOT=/tmp/flow-o10-new-rejections PATH=/opt/homebrew/opt/node@24/bin:$PATH \
  node --import tsx --test experiments/native-child-acceptance/journey.test.mjs
```

输出目录不得包含已有result；不会覆盖原始结果。默认拒绝场景文件保存在新临时results目录；指定证据目录可保留四场景结果。只删本次生成的私有运行资源，输出证据保留。

未来显式入口 `--execute --output <new-dir> --permit <new-GO-record>` **当前不得运行**。本片没有生成可用许可，预算候选1次SDK query/3turns/SDK估算USD0.10/60s尚未授权，不挪O08旧预算。GO记录必须为 `kind:flow-o10-one-shot`、`authorizedBy:Goal Owner`、新approvalId、诚实authorizationReference、固定preflight的sourceDigest/worktree、model sonnet、limits严格为config.mjs顺序的四字段，以及不超过一天的有效approvedAt/expiresAt。permit只是可信operator转录GO依据用户授权作的预算分配，不是签名或自动批准。

固定本checkout `docs/evidence/o10/attempts/o10-attempt-<approvalId>.json` 以wx+fsync先占用，再建私有资源；底层nativeQuery前再次validate并wx+fsync写`.query-started`。准备失败、结果丢失或未知一律封存不重试；移动permit/output目录不能复用。测试只有虚构身份 `/synthetic-unit-not-a-checkout/` 的schema fixture，不能授权实际checkout。此约束是合作operator流程，不防恶意删标记或复制checkout。

一个SDK query调用可包含辅助模型或多个HTTP请求。实际requested/init/modelUsage/turns/估算费用各自保存；未知/超限拒绝，不将SDK估算称账单硬上限。60s是adapter与观察器合作期限，准备、fsync、OS停顿、清理可能更久。父进程复用O08已审stopWorker：leader退出仍核本次PGID，TERM最多3s后必要时只向自有组KILL，再1s核查，只有ESRCH确认不存在；unknown保留私有DB/tmp。主动脱组的SDK子孙未被隔离，不能声称宿主全树保证。

原生query观察wrapper只转交原input并调用既有host hook，参数/loop不重造；沿O08 `recordHostDecisions` 有界保存工具名、source/server、有限ID和判定，不保存tool参数/thinking/凭据。requested仍由生产adapter配置；有效init要求仅Read、无MCP、dontAsk及已知managed3plugins/3skills名称集合准确无重复。组织配置不绕过，init声明不证明hook执行/没有副作用。

Read分层：host allow只表示准许；还必须匹配同tool-use ID的顶层原生Read调用与成功tool_result，并且返回文字含唯一合成材料。结果只保存摘要与containsSyntheticMaterial，不保存原始参数/工具正文；未知/错误/未观察不能当成功。合成演练确实通过现host gate读取snapshot，但原生SDK帧仍是注入，不能据此声称native Read已通过。

成功结果必须同profile runner/task/attempt/native session/sourceMessage、唯一execution、当前input v1、无依赖、一个typed final及同摘要artifact，机械flow.text通过，accepted仍null。结果名称仅 `mechanical-evidence-collected`（真实候选）或 `rehearsal-passed`（注入）；永远不自动accept-delivery。GO须另读实际正文对照四项业务事实作语义判断，不以措辞正则替代语义，也不为了验收器误判补模型调用。失败保留原报告与partial facts，cleanup独立判定。

实际证据见[O10报告](../../docs/evidence/o10/README.md)。本片不证明真实provider、开放式自治、工程文件写改、批量子任务、UI或个人服务部署；不修改个人安装。
