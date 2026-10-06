# PERF03 消息对象复用

固定实现：f909d32f5fcff5b0ac6408dc96e8630bfeffae4e；base：30b97cbf3665c4ef7a314a6a8b59394ae68781af。分支codex/web-message-reuse。只改消息转换函数内部WeakMap与两份专用检查；未改Thread、App、conversation projection、stream、shared或依赖。独立review尚未开始；主线未集成。

## 行为与边界

现projection保留未变化turn对象，但刷新会产生新turns数组。现在同一不可变turn对象复用其user/assistant消息；新turn对象仍产生新消息，哪怕ID/revision/text相同。输出数组仍是每次新建且按输入排序；并未消除O(n)遍历。输入turn和返回消息均按既有只读快照约定使用，不支持原地修改。弱缓存不按ID索引，不存client、port、projection或草稿；不同连接新对象不复用。

正文、truncated data标记、message ID与日期不变；telemetry/outbox草稿仍不进入assistant正文。运行status由既有core处理，因此尾assistant自动status变化仍允许必要转换。只谈对象identity/converter调用，不是React渲染、用户延迟或retained heap测量。

## 检查来源

[原实现红测](red-tests.log)8项中4失败/4通过；加缓存后[局部与直接消费者](module-tests.log)85通过（新增8+现projection77）。随后仅fixture类型literal/可选读取修正，保留[typecheck首次失败](typecheck-initial.log)，[最终8项](final-message-tests.log)与[Web typecheck](typecheck.log)通过。既有77已通过且未修改，不称最后一次又执行85。

生产函数在检查后只把注释改成明确的不可变使用前提，运行字节逻辑未变化。三固定文件hash见[source-manifest.json](source-manifest.json)。实际core小计数07:30:09.368Z运行于固定f909并exit0，原始[reuse-probe.json](reuse-probe.json)含base/current/probe/core来源SHA256，当前与target逐一相同。纯消息缓存不改UI，不新截图或启动浏览器/服务。

## 小计数结果

100轮/200条消息，实际ConversationProjection+安装core，纯内存合成响应。两侧首次warmup均200次convertMessage调用。

| 场景 | 基线消息对象复用 / convertMessage调用 | 当前消息对象复用 / convertMessage调用 |
| --- | --- | --- |
| 未变化refresh，每次（3次） | 0 / 200 | 200 / 0 |
| 末轮同revision正文改变 | 0 / 200 | 198 / 2 |
| 同一messages输入，running开启 | 不采对象数 / 1 | 不采对象数 / 1 |
| 同一messages输入，running结束 | 不采对象数 / 1 | 不采对象数 / 1 |

两侧snapshot5/page5/detail0，下一草稿均保留；正文改变确实进入runtime输出。这里的0只指传入的convertMessage回调调用，core仍遍历数组/更新repository，不能称全部转换工作或渲染为0。没有forced GC/heap/真实App延迟测量；WeakMap也不构成无泄漏实证。基线同样使用本片基线代码经固定git show读取，没有另造简化旧算法。

## 复现

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm install --frozen-lockfile --ignore-scripts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/web/test/conversation-messages.test.ts apps/web/test/conversation-projection.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-message-reuse.probe.ts
```

最后命令只在内存中跑100turn/200messages固定样本，baseline由git show固定base原messages.ts经TypeScript擦除类型后加载；candidate为本树模块。实际安装core内部入口仅用于这份测试/探针，固定0.3.22且版本不符失败，生产不依赖internal。无网络/模型/产品DB；不统计耗时。

[质量](quality.md) · [status](../../../plans/wpf-perf03-message-reuse/status.md) · [review](../../../plans/wpf-perf03-message-reuse/review.md)。新source已由ExecutionLead于07:27:49Z在4320的87源采样观察到首canonical8f2959 live/issues=[]；这是Lead来源、旧时点，不冒称本人采样或当前target已部署。
