# ATTACH01 runtime validation

本记录是phase1之后新增的运行域，完整target与16源绑定见[runtime-candidate](runtime-candidate.json)。base f181、phase1固定6bc两个合同实现保持原字节；只有phase1测试一项按新增optional请求字段更新，旧49批准/日志不改。

最终直接检查与时间见[runtime-checks.json](runtime-checks.json)，执行时HEAD是339086加未提交源码，记录before/after hash一致；candidate仅绑定相同字节，不伪称测试执行于后来的commit。范围为29个真实PG/HTTP（资源10、context19）+41合同/旧Web真实函数mock-fetch+8旧context receipt直接消费者。根类型检查另记exit。源码diffcheck0只指实现范围，原始日志格式空白保留。

运行覆盖：

- UTF-8 fatal decode、BOM/CRLF/Unicode原bytes、名字纯显示、仅TXT、8192边界与真实digest；上传JSON局部严格解码，非法UTF8不能悄悄替换成另文件，合法U+FFFD仍可用。路由封装不改变其他JSON API。
- namespace/project/owner授权，每次读取或重放都经现owner hook；runner credential不能读owner资源，错project/digest失败关闭。能力在项目GET按026安装事实提供，CREATE回执稳定false。
- 持久upload key/完整canonical请求：失ACK、原key同body、改名冲突、lookup在并发POST未提交时404仍可随后ready、期限后GC留原receipt/unavailable且不新建。
- 真实独占中心子进程SIGKILL后，重启同DB按原key返回同resource；另PG active statement取消验证未commit无半条资源，原key随后可完成。无provider。
- 首次pin项目/资源锁后DB clock判定：显式锁屏障、资源在等待期间到期→Send410，无长sleep；并发GC/pin序列化，无半context。pin先完成后GC保留，新的key即使retained仍410，原Send/Queue keyreplay不重新验期。
- 固定knowledge先attachments后与各自请求次序，完整v2 metadata/body按需、prompt/private input digest；合计4/8192和编排预算拒绝无部分task/context/revision。50queue项一次批量metadata SQL、0资源body查询的有界记录在[runtime-final](runtime-final/runtime-bounded-reads.json)。该记录不是PG wire/heap/性能benchmark。
- 未装026的plain/knowledge v1仍可工作；装026后旧Send/enqueue receipt字节不变，omitted/[]保持v1，nonempty refs走v2。旧Web真实GET/ACK行为仍直接测试；当前schemas已不代表旧strict版本，旧拒[]的证明留在6bc/phase1报告。
- Queue重启/暂停/取消/提升保持同context，取消不unpin；授权reconciliation复制旧材料但新executionInput；授权claim经实际runner+通用fake HarnessAdapter读到精确冻结prompt。adapter仅使用既有harness名字，未调用provider SDK/query。
- 018不可变trigger未放宽；篡改资源/context被拒，测试管理性注入损坏后claim失败且ownership写入回滚；knowledge_sources审计依赖不删除。

最终3数据库的[资源1 cleanup](runtime-final/resources-cleanup.json)、[资源2 cleanup](runtime-final/context-runtime-cleanup.json)、[子中心 cleanup](runtime-final/crash-center-cleanup.json)各记录无残留。root复跑应使用README输出目录变量，不覆盖这些作者记录。

历史失败原样保留：

- runtime-resource-first.log为0test/import失败：server未声明zod，改复用已公开contract字段schema；对应runtime-first-types.log同一依赖错误，不安装额外依赖。
- runtime-context-first.log 19失败，首个是作者knowledge请求漏expectedVersion，后18个因首setup未安装026级联；runtime-context-second.log为19通过。
- runtime-combined-first.log为76断言通过但1未处理PG连接错误，**不计整轮通过**。测试直接terminate活动连接触发既有pool异常；改为cancel_backend测试事务中断，另独占子中心SIGKILL测试真正崩溃恢复。没有屏蔽异常、没有扩大改共享database.ts。
- runtime-combined-second.log与runtime-77-*是77通过阶段，未含后加JSON非法UTF8 case，不能当最终78。
- runtime-78-first-*为78直接通过但Fastify parser Buffer|string类型未收窄导致types2；新增显式Buffer门禁后最终检查，不用类型断言掩盖。

未验证/非目标：现用户中心部署、公共client/共享decoder/mount新集成、实际Web上传/恢复及多主体授权、真实provider、永久in-use回收、浏览器Send/Queue跨reload原key恢复。原所有预览/个人服务保持，不把本片当完整MATURE03完成。

## 独立审查归档

Root于2026-10-06 10:49:15UTC限定APPROVED8701；四显式路径独立78/78、12.80s，0skip/uncaught，[原日志](root-runtime-direct.log)及[哈希/三DB清零审计](root-runtime-audit.json)原样保留。独立资源记录在root-runtime-resources，作者runtime-final目录没有改写。16源码与target/current一致、19只读依赖=base、两个phase1实现=6bc；types仍作者证据。公开client/decoder/mount、App/provider不在此次批准范围。
