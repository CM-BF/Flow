# K01 固定 Interface

contracts 源：packages/contracts/src/knowledge.ts；server seam：migrateKnowledge(pool) 在项目 migration4 后运行；registerKnowledgeRoutes(app,pool) 在 ready/listen 前、实际 center owner preHandler 作用域内运行。当前 route stub501，以下合同供 Lead 接 export/client/mount，行为验证尚未完成。

统一前缀 /api/projects/:projectId/knowledge；owner允许、runner403，个人owner目前有全部project访问权，project过滤不是多租户ACL。

| Method/path | Input | Success |
| --- | --- | --- |
| POST /sources | KnowledgeCreation + Idempotency-Key | 201 KnowledgeAccepted |
| GET /sources | after UUID?, limit1..50 default20 | KnowledgeSourceList，仅metadata |
| GET /sources/:sourceId | — | KnowledgeVersionSnapshot，当前版本metadata |
| POST /sources/:sourceId/versions | KnowledgePublication + Idempotency-Key | 201 KnowledgeAccepted |
| GET /sources/:sourceId/versions/:version | version1..16 | KnowledgeVersionSnapshot，旧版本保留 |
| GET /search | q<=256UTF8B，limit1..20 default20 | KnowledgeSearchResult |
| POST /resolve | {citation:KnowledgeCitation} | KnowledgeResolved |

create expectedVersion=0，publish expectedVersion 当前版本；同digest仍新增版本。重放原receipt，不更新成最新head。GET显示最新事实。错key输入409 idempotency_conflict；CAS409 knowledge_version_conflict；容量409 knowledge_capacity；缺项目/跨project来源404；digest409 knowledge_digest_mismatch；UTF8范围400 knowledge_invalid_locator；输入400 invalid_knowledge_request。

引用严格指定project/source/version/contentDigest和[byteStart,byteEnd)，端点必须完整UTF8；resolve最大4096原文字节。搜索每来源仅最佳chunk；hit.citation定位完整chunk，excerpt.locator在同版本/digest下只定位excerpt.text。literal摘要完整包含query；FTS摘要为chunk头部，不保证包含全部词。短摘要<=512UTF8B，搜索实际 JSON.stringify UTF8 <=49152B，limit/预算截断 hasMore=true，未知总数不返回。检索当前版本，同快照包含isCurrent事实；引用旧版本不替换为新版。

simple FTS OR literal，plainto_tsquery避免查询语法、strpos避免%/_/反斜杠通配。排序literal优先、rank降序、sourceId/ordinal升序；rank不是语义置信。跨chunk多词无等价保证。完整REQ-10 hybrid/vector/下游授权与失效仍开放。
