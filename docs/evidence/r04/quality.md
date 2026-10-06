# R04 方法与质量记录

2026-10-06 03:59 UTC：Node24/TypeScript/Fastify/PG生产生命周期。按find-skills本地优先，实际读/复用 /Users/citrine/.agents/skills/{find-skills,codebase-design,tdd,clean-code,brainstorming}/SKILL.md；匹配当前stack，不安装新技能。clean-code固定sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。bounded方案与公开main/HTTP/PG seam已由派工明确授权，不重复审批。方法：先真实独立child失败，再最小生命周期实现，保留原始stdout；seam不测私有计时器细节。只修生产停机，不将test fixture强关叫生产修复。

开工核clean/base/branch后atomic take成功；初次list输出过滤器错误（未写项目），take原子确认后再次list核对本claim与F01 v6停写/index已移出，才开始本文件写入。receipt /tmp/flow-r04-claim-receipt.json。专用资源/0模型，已读官方Fastify/Node说明并将与固定安装源码对照。

2026-10-06 04:05 UTC：首test因cwd多上一层在SDK载入前失败，保存setup-path-failure，不作为行为红证据。修正fixture定位后red-main复现未完成claim body/live socket，DB活动查询为空、SIGTERM超3.5s；green-connection约1.03s清理退出。实际客户端abort用例最初少发{}被接口400拒绝，未达到锁等待；补与公开client相同正文，不改断言。8场景正常drain用例发现ACK已回但keepalive仍阻塞；增加关闭期onSend Connection:close，局部green-drain约145ms自然退出。以上均保留原stdout，不将首失败称功能通过。

本段clean-code：关闭HTTP与main最终故障保险分责；无全局socket表/第三方依赖，复用Node/Fastify生命周期；错误日志固定脱敏，不含SQL/凭据，明确unknown。强断连接不取消DB事务，持锁后释放+重启公开幂等读取证据已通过。关闭失败分支保留20s deadline，避免cleanup reject后清timer留下活资源。尚待最终组合与独审；0模型。

2026-10-06 04:06 UTC交付clean-code：检查命名、hook调用顺序、timer/信号监听清理、错误日志/未知语义、test资源生命周期。生产只一新增shutdown模块，不追踪全局socket或复制scheduler；本次4个源码文件已冻结。固定源码最终8+1/tsc通过，无同源码反复全库；首红、fixture错误与中间红均保留。尚未独审/合main，remainingDB=[]、无自有main进程。source/原stdout哈希与相对链接将在metadata提交前验证。
