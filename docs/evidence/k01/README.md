# K01 手动文本来源、固定引用与有界词法检索

已实现 project 范围的手动文本来源：原文不可变版本与原回执重放，旧引用仍返回旧原文，并附同快照 currentVersion/isCurrent。搜索只读当前版本，短摘要与按需原文片段分离。实现 target ea0c4cba1792dbb498487fb5b6ae47393340b77e；canonical [manifest](manifest.json) 绑定9实现/测试/harness文件与原始证据。Mika 独立技术 review 待定；之后由 Goal Owner 验收接收产品范围。

31 个不同用例通过：matrix-first 首轮28绿中的27个保留，原条件式CAS回执断言被无条件赢家回执断言替换并定向1绿，容量夹具修后1绿，新增Unicode/排序边界2绿。初轮1/2用例与后续矩阵重叠，不重复累计。最终 noEmit exit0。命令、实际UTC和exit均在 *-result.json，空stdout不是独立成功依据。首轮原条件断言保留于 c4c68a3，产品6文件从首行为实现 b14516d 至最终 target 字节一致。

真实 HTTP 使用固定本 WT createServer、实际 owner/runner preHandler 和项目存储，独立 pool 在 listen 前显式 migrate/register。未替代生产自动挂载/shared client 验收。最后 fixture 加 hasRoute 避免未来生产重复注册；本 base 仍走手工注册，自动分支未声称已验证。owner当前拥有全部personal projects；本片project隔离是真实数据过滤，不是新增多租户ACL。

## 可复核结果

- create/publish CAS并发、同key并发只一次、响应body故意丢弃后原receipt重放、版本推进后publication原receipt不变。ACK实验是在响应头到达后不解码/保存body，并非TCP任意中断穷举。
- 同digest仍是不同版本；restart后引用可读；注入chunk插入故障后version/head/receipt全回滚；移除故障后原key重试成功；版本UPDATE/DELETE被PG拒绝。
- 错digest、外project、缺版本、UTF8半个码点/空中间范围拒绝；CRLF、反斜杠、组合字符、emoji精确保留；NUL/孤立surrogate/超UTF8字节拒绝。全文256KiB混合Unicode实际分块完整、重叠>=256B、严格推进且<=69块。
- project128来源与source16版本并发门禁、项目64MiB保留原文门禁；最后两HTTP写者只一方成功。容量夹具已构造255真实immutable versions及17595合法chunks，随后两个256KiB并发请求使保留原文恰好67108864B；旧引用不删除。
- 搜索每source仅最佳chunk，project/current head在同只读RR快照SQL先限制。stable literal/rank/source/ordinal排序、metadata分页与旧版本/外project排除成立。
- 控制字符最坏JSON转义：原chunk4096B，摘要512B，实际返回13 hits、47664 HTTP UTF8B、hasMore=true。没有总数估计；完整chunk只resolve，search全响应按JSON.stringify UTF8实算<=49152B。

固定12项词法样本见 [matrix-first-samples.json](matrix-first-samples.json)。simple FTS-only在中文两字、连续中文、camelCase子串、路径子串、版本数字、语法字符、emoji及256B跨chunk literal这8项漏检，literal并集补到12/12。underscore与%/_/反斜杠组合样本FTS也命中；它们的literal字面匹配仍分别断言。多词非连续与大小写词例由FTS命中。此小集合不能推成通用召回率或语义质量。

查询用 plainto_tsquery('simple',q)，不把输入当tsquery语法；literal用strpos，不把%/_/反斜杠当通配。literal摘要围绕匹配且完整含<=256B查询；FTS摘要可只有chunk头，已验证匹配词晚于摘要时resolve仍含词。多词分散在不同chunk时可能漏检，测试明确保留该限制，score非语义概率。

12查询每项只有1次实测（约3–4ms，具体原始值见样本），受共享主机/功能fixture影响；不是性能分布、SLO、CPU或容量结论。当前最多128×256KiB原文扫描，literal仍扫描当前chunks；GIN生成列不是本OR查询必走索引的保证。

## 容量与边界

正文<=262144B；来源<=128/project；版本<=16/source；保留原文<=67108864B/project。写入先锁既有project行，再source，再作用域命令锁；容量聚合和version/chunk/head更新处于同事务，不改project.revision。chunks最多69/version且每块<=4096B，重叠至多259B：每次起点至少推进3834B，全部保留版本的衍生原文总量保守上限为 rawBytes +259×floor(rawBytes/3834)，在64MiB原文上限内约68.33MiB（另有行/index/tsvector开销，本片不声称限制总PG物理磁盘）。空版本有一个空chunk。标题固定，仅发布正文；无删除/隐式清旧引用。

引用范围独立<=4096B，metadata列表最多50项且无正文。搜索excerpt<=512B、20项上限还受48KiB实际JSON预算；raw字节不是JSON字节。源版本内容authority；chunks是可重建投影，本片未开放重建管理接口。

## 失败与资源

保留 source-red/search-red 的预期501失败；source-green首次直接从server import未声明zod，0tests，已移schema至contracts；不计通过。matrix-first容量seed高重复词使chunks生成FTS在10s statement_timeout失败，事务回滚且库正常DROP；capacity-fixed用合法换行原文隔离容量，不降低64MiB/并发断言，不证明最重FTS成本。typecheck-first因复用旧node_modules缺本基线MCP SDK/zod失败，补已有安装精确版本符号链接后通过，未改lock或安装包。

所有实际启动的8个临时库均正常关闭/等连接0/普通DROP，*-cleanup.json的remaining=[]；不使用FORCE、不停止他人服务。额外只读PG版本采样见environment.json。原日志不改写，diff-check只排除原log末尾空行。0模型/0云/无SDK任务执行。未运行旧固定DB套件。

## 接收边界

本片不接runner/MCP/URL文件抓取/embedding，不声称源更新自动使全部下游摘要失效。REQ-10完整授权一致的hybrid/vector矩阵开放，后续CTX/O05仅共享KnowledgeCitation协议，实际grant/选择/消费需另行验收。共享export/client/生产migrate/register和架构knowledge模块/3表接线由Execution Lead负责；Mika独立审技术，Goal Owner验收接收产品范围，无重复全量测试要求。
