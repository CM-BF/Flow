# Claude summary 纯适配器证据

本片固定实现target：`PENDING_ADAPTER_TARGET`，独立review：NOT_STARTED。已审首片879c989的4源码逐文件diff为空；新实现仅`apps/runner/src/context-observations/claude-summary.ts`及`.test.ts`，claim v3 [COMMITTED receipt](sdk-amend-receipt.json)。本页记录静态来源与局部行为，不是采集/持久化事实。

小Interface为`mapClaudeContextSummary({identity, observationId, observedAt, evidenceRef, requestDetail: 'summary', response}) → ContextObservation`。host负责采样来源、冻结身份、receipt权限；adapter仅规范化数值，中心pure projection仍唯一负责freshness和remaining算术。无Query实例、计数API、时间采样、计时器、auth或持久状态，SDK仅`import type`，运行时不加载它。没有改先前公有schema。

固定0.3.290官方本地类型：Query.getContextUsage（sdk.d.ts:3036）返回SDKControlGetContextUsageResponse（3949）的camelCase字段；SDKContextUsage（3779）是不同的snake_case结构。sdk.mjs/core.mjs的方法直接返回control request的response，没有改名，见[路径/哈希/字节偏移](claude-summary-source.json)。只读源码，不调用SDK或启动provider。summary依赖上次response usage与本地估算，默认full会触发逐类token-count；本Interface拒绝full/遗漏detail，但不能替host证明传入值确由summary采集。

只读取response.model、totalTokens、rawMaxTokens、categories.length与每行kind/tokens。totalTokens保留不夹紧，source=claude-sdk-context@0.3.290、measurementMethod=sdk-summary-estimate、kind=estimate。coverage=full表示该估算针对SDK报告的整体当前窗口，不表示精确计量或逐分类完整实测。缺少必要字段、非法数字、超限行数或汇总溢出全部拒绝，不截断后宣称full。rawMaxTokens只映射compactionWindow；modelCapacity未知，不读取maxTokens猜容量。resolvedModel须由host确认并与response.model精确一致；不符拒绝，host未知则测量与类别保持unknown/空，不让raw.model回填配置。

分类按used/free/buffer/deferred汇总成固定kind ID，最多32输入行、最多4输出项；同kind加法每次核安全整数。顺序或名称改变不会改变ID。分类是无名称的分组metadata，不再标识原SDK工具行；从不把分类总和写入used，也不把free/buffer/deferred加进窗口使用量。时间与host引用复用既有有界schema，结果是detached对象；公开投影硬限65536bytes。性能界限为O(32)行、O(4)分类，无provider/全文扫描；没有做吞吐benchmark。

验证在主仓已有Node24.20.0/pnpm9.15.4/Vitest4.0.18工具下，Vitest root明确指向本worktree；临时TypeScript配置继承本worktree root严格配置，限定4个根文件（新2文件和直接projection源/测试）及它们的真实imports。固定SDK路径只作类型解析。没有安装、symlink或修改项目配置。见[配置快照](sdk-validation-config.json)。

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run --config /tmp/wpf-mature-04-sdk-vitest.config.mjs apps/runner/src/context-observations/claude-summary.test.ts apps/server/src/context-transparency/projection.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsc --noEmit -p /tmp/wpf-mature-04-sdk-tsconfig.json
```

首次为21 Adapter + 23直接projection = 44/44；补充缺失/camelCase及安全整数边界后，最终为23+23 = **46/46，2文件，0失败/0跳过**。不是把两次测试计数相加，也未重跑7项未改schema测试。两轮strict noEmit均exit0。原始日志：[first tests](sdk-first-tests.txt)、[first noEmit](sdk-first-typecheck.txt)、[final tests](sdk-final-tests.txt)、[final noEmit](sdk-final-typecheck.txt)；源码hash/退出码见[manifest](sdk-implementation-check.json)。空noEmit日志是正常成功stdout，不替代退出码。

通过真实公共projection Interface验证：estimated/derived及引用、hard capacity未知、rawMax策略窗口、zero/超限不夹紧、exact model mismatch/unknown、draft revision与冻结queue/attempt、身份/时间失效、上限/溢出/非法值拒绝；禁止读取的raw属性使用throwing getters，证明不读取memoryFiles.path、工具/技能/agent名称、grid/color、apiUsage与reserve等未允许字段。fixture是合成官方形状帧，不称真实SDK采集或模型精度验收。

clean-code/codebase-design复核于2026-10-06 09:22 UTC：单一映射函数和有界分类聚合，复用原合同验证/unknown/freshness，不造新错误框架、DB/API或隐藏状态。命名显式summary与policy，不以SDK来源升级accuracy；固定kind IDs避免私密名称派生。未解决项是生产采样生命周期、中心可信身份验证、事件幂等持久化、压缩来源和Web；沿原TODO -03/-04/-05继续，首片和本片都不能代替完整验收。
