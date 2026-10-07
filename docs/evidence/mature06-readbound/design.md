# Fixed-source design and byte accounting

基线d022c800，界限研究固定63768046。真实JSON默认紧凑serializer的保守字段和：id128 UTF16→quoted770B、digest66B、ISOdate27字符、PG integer10位；reference5324B，settlement19763B（两数组合计256），metadata100=554123B/default20=128123B、patch8=442760B、block=6296793B。字段独立max有不可同时达到的组合，是上界不是精确可达最大。正文6倍转义由合法非NUL控制字符产生。

任意JSON可含无限空白，未知服务器/代理/body额外字段没有天然有限界限。错误4KiB是接收策略，超限仍返回原HTTP status的通用FlowApiError，不反射未读取body，abort必须传播。fetch body是解压后字节；首chunk、parts.join/JSON.parse副本与GC不受硬heap配额保证。Content-Length不可信且不是解压计量，不据此放行。

实际源码证据：contracts/tasks.ts:15；assistant-stream.ts:12–39/56–125；runner.ts:41/50/75；server assistant-stream/index.ts:18–34，queries.ts:15–59，store.ts:16–48，settlement.ts:43–47；migration022 JSONB无等价长度限制，不含DB篡改保证。

采用本地 /Users/citrine/.agents/skills/{find-skills,brainstorming,codebase-design,clean-code}/SKILL.md。bounded分级，既有研究方案获Mika明确实现授权，无额外审批；clean-code固定sickn33@bdacd76，检查单一职责、旧领域上限、认证transport保持、无新重试。官方工具版本沿根package：Node24/pnpm9.15.4/Vitest4.0.18/TypeScript5.9.3。无安装。
