# 附件材料历史投影修复

2026-10-06 12:27:06 UTC。Mika已批准最小合同；实现前精确范围v10，固定main7cb已受控同步为daf66fc。

公共v2允许sources=[]且attachments非空；history DTO当前只表示完整知识citation列表。新增v2保守分支返回materials unknown/metadata-unavailable与materialRevisionDigest=null，同时保留真实executionInputDigest和历史SDK事件；mixed v2也不以知识子集称全量。v1分支/公有DTO/存量history读回不变。不新增attachment材料DTO，不放宽empty known，不丢原context附件，不禁采样。

源码仅apps/server/src/context-transparency/store.ts、新attachment-history.test.ts。真实createServer/动态HTTP/public schemas/上传与会话冻结/runner reportEvents/唯一正式026+027，随机专库；0SDK/provider。先attachment-only单项red，再4个组合检查：completion/GET/replay、mixed unknown与权限、v1 restart、后续无效事件导致整批rollback且无孤儿detail，再原batch重放。直接DTO及store确定性行为按显式路径验证；旧PG9不重复。

本地find-skills、brainstorming复用已授权短设计；codebase-design让表达能力判断留在frozenMaterials，不向调用方加状态机；clean-code按固定sickn33 bdacd76检查命名、资源finally、异常不吞、未知与已知分离。无新增依赖/个人服务修改。首producer eccb与原manifest/raw不改；04完整current/cut/SDK/Web验收仍开放。

2026-10-06 12:28:34 UTC：生产最小3行guard完成；attachment-only真实red1（3未选）→green4/4；直接17/17，既有9PG明确未运行不累计；合计21不同。strict首轮exit0、保留完整根选项。两轮专库分别记录0连接/remaining[]/errors[]后DROP，无自有活runtime、未重跑provider。最终clean-code复核：责任仍在单一frozenMaterials，错误/ownership路径未catch、旧数据schema不放宽，测试通过真实工厂/授权client/唯一迁移/磁盘外PG事务接口，不mock store。完整材料表示能力仍unknown；没有全产品SDK端到端结论。
