# WPF-CONNECTION01 独立review

状态：APPROVED；Reviewer astra_ultra_execution_lead / ExecutionLead（独立于作者 native_center_owner）；2026-10-06 13:21:44 UTC

Review target commit: 582f41f1957709982750f5de5306738e064960ce

Base: 280289008a5a3779e4e5e6453181b96062ed9514。Observed delivery: b8617c767938a2941184231e5ed7f154aeaba888 clean。

独立review通读7源/22用例及直接store/028/auth precedence/CSRF/Origin/SSE循环/preClose，71 bindings fixed/working bytes/hash一致，39保护输入对base零差。已读原分轮22不同检查、最后2 direct、types0、7随机库正常removed与2自有Node exit0证据；reviewer未重跑/0provider，无P1/P2。作者仅转录此结论，完整回执见[独审记录](../../docs/evidence/wpf-connection-session/independent-review.json)。

批准范围：中心领域与可选stream port；不包括共享factory挂载、Web真实Cookie旅程、个人部署。HTTPS仅header策略验证，**不证明当前HTTP createServer的反向代理/TLS部署可用**；先接loopback，未改trustProxy或放宽Forwarded。早期失败、测试计数误记、旧HTTP drain deadline限制仍保留。实际边界见[部署说明](../../docs/evidence/wpf-connection-session/deployment-boundary.md)。

源码停止；main 84005a260dfcb668cd38b09c21564d0754a0f513 已受控接收，七固定源逐hash一致，见 [main receipt](../../docs/evidence/wpf-connection-session/main-receipt.json)。本次metadata后释放原claim。新增metadata不改已审target/原manifest/原始输出。验收时核7固定产品hash与必要共享组合，不重复领域22。空模板不能当approval；本结论来自上述独立审查。

## Late Logout 后继

历史交审时NOT_STARTED；现最终结论见下。独审只核新3source及4selected/focused types实际证据，原22不重跑，旧582f批准不扩展。新Interface见late-logout/interface.md；不批准个人部署或Web全矩阵。

### 待本次独审：66caee46341c91db71a3590bfcd288396b30567a

3产品diff（生产仅撤销后不删除Cookie；fixture响应门；真实竞态及精确DB清理记录）与main62e9只读observeConnections输入；4/4（1新3重叠）和两focusedtypes0。读late-logout/RESULT.md、inputs.json、三轮supervision与PG marker/connection/drop记录，0重跑。当时NOT_STARTED，不升级原582f批准；现接收以以下独立结论/回执为准。

### 2026-10-07T11:46:00.003450+00:00 唯一限定批准/main收口

assignment_review独立审查source66caee46/delivery92e568，APPROVED_SOURCE_AND_LIMITED_DIRECT_VALIDATION，P1/P2=0。[原样I02报告](../../docs/evidence/wpf-connection-session/late-logout/independent-review-intake.json)含完整三源delta、43fixed/current+12显式源+14runtime及62e9 observer核验，4/4与两types0/3组收尾/专库normalDROP原件；reviewer未重跑。main7272151bb1e3e59e08937dca44949dcdeb42f009已精确接收44路径，作者[逐字核对](../../docs/evidence/wpf-connection-session/late-logout/main-receipt.json)成立，无新测试。批准限旧1..28 fixture直接验证，未宣称35迁移/浏览器矩阵/个人部署；固定7d1/source6c不自动含修复。全部五scope在本次metadata提交推送后停止写入并正式release。
