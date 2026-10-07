# SVC06 诊断宿主 r2：首次 bootstrap 修正

固定source `ea6bd5852c2754f4179bb6da467caf8d6d67a368`；[Interface](Interface.md)、[逐字差量](delta.json)、[局部结果](local-summary.json)。原r1 [失败/正常清理结果](../diagnostics-host-policy/RESULT.md)已获[唯一限定独审](../diagnostics-host-policy/result-independent-review.json)：APPROVED_LIMITED_FAILED_HOST_RESULT_ACCOUNTING；不是完整host通过，旧runner首因仍UNKNOWN。

唯一旅程语义改动：首次空release pointer用 `action: 'bootstrap'`，保持 `expectedVersion: 0`、原报告校验、原后续CAS和维护流程。entry/supervise/startup-observer逐字同6cd；terminal/clone不变。inputs仅新r2目录、journey固定路径/hash替换，513原输入逐值继承，514总数不变；artifact7d1/source6c、af51旧factory/d629、4aliases、3readonly runtimes及预算保持。没有重读或复制全部514来源。

0PG直接例使用固定真实产物web-release模块、自有tiny目录和明确NON_PRODUCTION_LOADER_FIXTURE材料：空pointer publish拒绝；空报告库bootstrap拒绝；完整四报告后bootstrap计划成功且未写pointer；commit后旧version重放拒绝；后续publish按version1产生version2计划，旧pointer仍1。仅loader/CAS合同，不是实际App兼容报告，绝不用于个人。

第一次syntax0、行为原红（fixture没有建立空report目录，得到ENOENT）；只补该自有目录，再选同一行为1/1。1个不同行为用例、2次选中、syntax一次；caller两轮180+199=379ms，raw2456B，三owned组最终absent/双EOF/无signals，两个exact scratch正常removed；初EPERM unknown观察原样保留。预算10s/1MiB，目录高峰未采样，不宣称实测峰值。原失败raw没有改写，没有重跑已绿build/import/observer3/diagnostics19。

下一实际入口仍 `supervise.py`（固定manifest后使用）；新namespace `/private/tmp/flow-svc06-diagnostics-host-policy-20261007-r2` 尚NOT_RUN。执行前fresh核完整固定输入、claim、新namespace、2.5GiB和并发、live1GiB、最大配置15连接及集群余量；180s work+30s cleanup/.5TERM+2reap/676MiB规划/2MiBraw。只自有专库/动态loopback；0provider/个人。缺失或unknown不自动重试，work writer absent证据+nonce组停止+marker/OID/有界零连接后才normalDROP，否则KEEP。实际窗口由Lead协调，不继承r1消费许可。

Clean-code复核：复用已审driver与真实领域guard；无新监督循环/状态机，差量集中在fixture调用；首错/cleanup独立，历史原件不变。此片仅准备及一个直接合同检查，后续真实host/策略/三App与个人边界保持。
