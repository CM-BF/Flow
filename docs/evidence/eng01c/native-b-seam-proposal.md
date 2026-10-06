# Native writer B 收敛提案（只读，未领取）

来源：ENG01C已审1fd70c28、main53ce2ec2c95b489aa7a2a2eaa49849821af00c16；本次读取runtime execute、R05普通Codex adapter/descriptor/launch、R06 types、现checker/workspace与Mika权威状态。0provider/0app-server/0诊断/0生产改动。大task仍ENG-001，不新增第二状态。

## 先落两个可独立验证的 seam

1. **宿主真实只读身份**：`HarnessContext`新增可选只读 `executionIdentity?: Readonly<{taskId, attemptId, ownerVersion, runnerId}>`。runtime只从已claim的assignment一次构造并Object.freeze；没有token、URL、可写journal或控制器引用，不复制assignment状态。旧手写fixture context可省略；要求真实身份的新native writer在缺失时dispatch前拒绝，绝不从目录hash、task prompt或自造UUID补齐。身份本身不是授权，操作仍需原assertOwnership，emit仍由原outbox绑定真实ownership。最小literal：`packages/contracts/src/runner.ts`、`apps/runner/src/runtime.ts`、`apps/runner/src/execution-identity.test.ts`（新）。验证实际host两attempt/并发分别给正确身份、冻结不能改、旧provider/无身份legacy路径不变；只需局部PG或原host受控peer，独立于server runners.ts，后者留S01P04。

2. **一个普通native turn生命周期**：把现codex/adapter.ts私有collectFinal移到codex/turn.ts，输入只为固定profile、受信transport factory、prompt/cwd、signal、assertOwnership，输出仍是已识别ordinary final；旧ordinary adapter负责既有session/final/text artifact/verification映射。新工程writer可消费同一final，但不调用旧adapter.run，避免普通flow.text与engineering双verification。一个receive pump/一次initialize owner/同ID绑定/deny面/close/unknown规则全部复用；不是增加SDK循环。R06、projection、wire、evidence、policy均不因提取改语义。

第二seam先保持行为的最小literal：`apps/runner/src/native-harness/codex/adapter.ts`、`apps/runner/src/native-harness/codex/turn.ts`（新）、`apps/runner/src/native-harness.test.ts`（直接消费者）。现descriptor提供harness/adapterVersion/publicProfile/ports事实，不能作为工具许可；R05D launch仍要求显式factory，没有默认executable。Mika真实recipe/自然通知诊断不是本片可替代的输入。

这两步是立即可做的0模型准备，不依赖新的工程profile/v2或runners SQL，也不改变ENG01C已审writer lease-only合同。新增host身份透传到工程writer时再窄amend `apps/runner/src/engineering/writer.ts`、`adapter.ts`、`writer.test.ts` 三文件，不能在提取生命周期时隐式扩权。

## 首模型工程旅程的两个明确选项

**推荐有限 `host-applied-calculator-v1` 模式作为首片候选**：原生模型只提出calculator.mjs源码，Flow host核定来源后进行唯一受管文件写入；公共事实明确“native生成代码 / host应用”，不能称SDK文件工具已可用。给模型的材料是host读得的固定base calculator文本及工程要求，native cwd是其独立受限目录，不授予worktree/checker路径。继续复用ordinary无工具策略和同一final来源身份；模型配置/版本/实际资格未知不填已确认。只有原生请求已结算、实际模型资格达到>=Sol且来源证据符合固定规则、权限/后台副作用前置已验，host才应用输出。

输出有限严格DTO，例如 `{protocol:'flow.calculator-edit.v1',source:string}`，只包含一个固定文件的内容、不接受路径/命令/diff驱动/测试/期望结果。host在写入前验证内容，随后按ENG01C方式等待自己唯一writeFile完成再报stopped。返回unknown/异常/失联时不应用、不checker、不释放；不能在后台继续等待后另行静默应用。真实factory仍未可用，因此当前只可做JSONL peer→host受管Git写入→现PG验证，不运行真实provider。

**原生文件工具直接写入**：更接近日用任意工程，但必须固定workspace-write策略和工具/子进程全生命周期，确认模型身份在首次写入前合格，证明background writer停止，且隔离checker/凭据/网络。现transport CloseReport只有直接child且remoteEffects=unknown；turn completed、interrupt ACK、exit alone都不能证明该方案结束。因该缺口不能把B1 ordinary策略放宽成新工具白名单然后宣称可用。若首验收明确要求SDK自身文件工具，应保留本方案为待验目标，不能拿host-applied替代验收。

## 关闭checker stdout伪造的最小可验方案

上述推荐模式仅calculator-v1，可在任何被测执行之前强制有限源码语法，避免引入通用sandbox：完整文件只允许两个指定纯函数export，参数固定a/b、函数体只允许a与b的一次算术运算；允许错误运算符使正常checker仍能判失败，但禁止import/require/属性访问/字符串/调用/循环/赋值/额外语句、process/console/动态eval及不可见字符。只接受确定的ASCII语法和小字节上限（候选2KiB）；不把任意JS正则扫关键字当验证。解析器须全输入消费，输出固定AST/已验证源码标记。

先校验，再由host应用该唯一文件；执行前再读实际文件，与获准源码digest及完整snapshot绑定，其他文件/模式/索引不得偏离允许内容集。随后可以保留现受信Node checker：待测模块语法只允许无副作用算术，无法预印JSON/exit/启动后台或改baseline。该保证只针对有限grammar与受管host应用，仍是同UID协作假设，不声称抵御外部同UID攻击者；实际native进程不得取得worktree写权的前置控制仍需Mika固定证明。这样不靠事后diff或baseline0400证明安全。

另一可行但更大方案是隔离被测代码并由host独占断言与报告，外部进程只返回被测值，不接触expectedChecks/合格JSON。任意JS和后台生命周期仍需真实隔离/完整停止，不能仅换stdout字段。首calculator片建议有限语法/执行前独立审查，独立actor在任何被测执行前可审核生成diff；运行后再对固定artifact作最终接受/拒绝。mechanical passed永不替代独立语义接受。

有限模式新增候选literal：`apps/runner/src/engineering/calculator-source.ts`、`calculator-source.test.ts`、`apps/runner/src/native-harness/codex/engineering-writer.ts`、`engineering-writer.test.ts`。它们依赖上述两个固定seam，不改Mika/R06、不占runners.ts。配置/持久setup/v2 receipt/中心purpose仍归后继C，不偷偷复用fixture profile承认真实模型调用。公开模式必须显式新版本并记录code producer与file writer不同actor；旧readonly、fixture v1 hash与目录保持。

## 定向验收和取舍

- identity：真实claimed task/attempt/runner/ownerVersion精确，旧context省略可兼容；新writer缺失/伪造受理证据fail-before-dispatch，context不能给自己添加授权。
- lifecycle：原ordinary直接消费者保持，unknown/no-final/错ID/工具items/late通知/close-unconfirmed不应用代码；原生实际通知矩阵依赖Mika，peer成功不冒称conformance。
- 源码：合格语法的正确/错误运算分别pass/fail；预打印合格JSON+process.exit、constructor/属性调用、import、unicode逃逸、额外函数/后台写入、file替换等必须执行前拒绝，验证checker调用数为0。最大2KiB和full-consumption界限可测。
- 产物：同一受管合成repo、唯一文件写入、host已停→固定before→checker→固定after、原outbox与最新artifact绑定；未知不能另claim或在恢复时重新调用provider。模型的final只当代码候选，不当停止/验证证据。
- 真实调用前：模型>=Sol来源、可能reroute政策、factory/权限/副作用边界、单次预算必须明确；无法在允许应用前证明资格时不应用源码。当前全未执行。首模型旅程完成仍不能宣称任意JS工程/SDK文件工具/第二harness完整可用。

方案比直接native工具写改少一个不受控文件/后台进程面；代价是首片明确限calculator纯函数和host应用，日用任意工程能力仍开放。若co-lead选择直接工具路径，先保留identity+lifecycle两个小片，等待固定能力后再启写，不扩大本A范围。遵循已用codebase-design/clean-code方法：三个实际所有者不混合，不增加通用注册表、agent loop或第二验收权威。
