# SVC06 diagnostics host r2：隔离策略旅程通过，待独立结果审查

固定准备source `ea6bd5852c2754f4179bb6da467caf8d6d67a368` / delivery `94e12b5d56c808bc4145c18356549799da973ca6`；artifact `7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920` / runtime source `6c0fdcda8858aac33489c48c1948e902dd6a3d7e`。本轮只修初始bootstrap、用独立r2 namespace，原r1/c2c失败与raw不变，不重build/import。准备独审[原件](independent-review.json)，本结果尚待独立审查。

实际入口10:41:59.689858Z，work内部10:42:10.794Z→10:44:34.806Z；监督work155073ms/exit0，cleanup10:44:34.916Z→10:44:35.358Z、监督540ms/exit0，外层10:44:35.378972Z结束。155613ms是两监督段之和，不冒完整墙钟。两owned组48905/48849最终absent/双EOF/无signals、无primary/secondary。外层stdout解析与各持久结果逐值相同；[work原件副本](actual-r2/work-result.json)、[cleanup](actual-r2/cleanup-result.json)、[outer](host-policy-outer.json)。

本轮实际通过：af51原27迁移的自有取消turn代表数据，关闭旧factory后新7d1 factory迁移至35；默认策略off；非法配置及缺v2报告分别在任何drain前拒绝，原三服务身份/maintenance保持；完整synthetic v2 loader材料后，原maintenance bootstrap→refresh→resume版本0→1→2→3，旧三角色全部stopped、新三nonce不同且ready/running；经过cookie连接、旧会话读取、缺CSRF logout403、带CSRF logout与注销后未认证，Web identity绑定实际backend/context。原业务列摘要、release pointer/config/profile字节与空任务检查最终通过。

仅一个自有fixture任务，runner前已取消，0provider调用。合成v1/v2材料仅检查报告加载合同，明确 `SYNTHETIC_LOADER_CONTRACT_ONLY_NOT_APP_COMPATIBILITY`；不代表三真实App、浏览器渲染、个人历史或个人部署通过。个人61227/61228与用户tab完全未操作。旧runner首因仍UNKNOWN，本次ready不更改旧失败解释。

独立cleanup消费本run持久work-terminal absent，按原nonce helper确认两代6组stopped；marker/OID1288209、有限连接观察[]后normalDROP remaining[]/failures[]，不使用FORCE。两代center/runner退出0，Web均为显式stop观察exit1，不能写全部服务exit0。六份私有stderr0B、完整、摘要匹配；work时的未退出观察和外层初EPERM unknown原样保留。自己的artifact副本、private run和诊断保留，旧unknown资源不动；实际结束已通知Lead归还共享窗口，无后继probe。

资源口径：fresh22,659,051,520B≥2.5GiB+60MiB保守local；最大配置连接15，fresh集群保守可用93，非实测峰值。CoW副本367,041,727logicalB / 401,969,152allocatedB；clone无fallback，卷free变化-7,995,392B不作为独占物理占用。work287个非原子样本minimumFree22,687,494,144B，maximumPrivate3,610,464B；cleanup末采3,628,141B，DB最大已采12,942,359B。原raw复制/outer/invocation合计53,622B<2MiB，私有stderr0B；artifact manifest属固定产物而非raw。50私有原件绑定与15逐字副本见[result-analysis](result-analysis.json)，凭据config仅绑定hash/身份，不公开正文。
