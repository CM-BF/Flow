# SVC06：隔离宿主首次发布fixture修正

继承[已审诊断宿主Interface](../diagnostics-host-policy/Interface.md)、source6cd/4a6。原r1已消费，失败与cleanup原件保持；固定artifact仍7d1/source6c，不重构建/import。唯一旅程行为delta是初始化release时`expectedVersion:0, action:'publish'`→`action:'bootstrap'`；复用真实产品报告校验、指针版本/CAS与后续维护顺序，不修改产品或放宽保护。

新独立namespace `/private/tmp/flow-svc06-diagnostics-host-policy-20261007-r2`。entry/supervise/startup-observer从6cd逐字复用，journey仅该一词改变，terminal/clone不变；514原输入不复制源码，inputs元数据仅新namespace、journey路径/hash替换，其余逐值同。实测前fresh原所有绑定/claim/15connection/2.5GiB与并发、namespace未用。

预算继续180work+30cleanup/.5TERM+2reap，私有规划676MiB/raw2MiB/live1GiB。0provider/个人，唯一fixture task在runner前取消；仅专库/动态loopback。work writer absent+nonce角色stopped+marker/OID/有限零连接后normalDROP，未知KEEP。上一轮没有bootstrap指针，因此不能拿其成功前三roles当整条旅程通过；新轮不得复用旧专库或成功阶段。

一个0PG tiny直接消费者用例：真实固定产物的planWebRelease/importWebCompatibility，用自有合成manifest与四报告原件证明空pointer/publish拒绝、缺实际报告bootstrap拒绝、完整报告bootstrap成功、保存后旧version重放拒绝/后续publish按CAS成功。它仅为loader合同，不是真实App兼容材料。10s/1MiB小目录，OPS14；不重跑3observer/19diagnostics/旧build。
