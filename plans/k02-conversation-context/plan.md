# K02 对话冻结知识上下文

创建/更新：2026-10-06 05:41:41 UTC；状态in-progress。Goal Owner已批准设计；单一owner b01_bounded_reads / gpt-6-astra ultra，lead Mika。K01已经交付并release，禁止回旧WT写入。

- [ ] K02-01 固定DTO/018/migrate-register接口与私有claim薄接缝，交Lead接线。
- [ ] K02-02 同TX冻结来源、编译有界输入、发送/入队/两种提升重用与公开metadata。
- [ ] K02-03 claim私有投影及受控reconciliation两种retry保留context并重编译输入。
- [ ] K02-04 真实PG/HTTP/注入query验证、受控旧消费者组合、Mika独立技术review。
- [ ] K02-05 main接收；生产挂载/client/CLI/Web接线由各scope owner验证。
- [ ] K02-06 后继REQ-10 hybrid/vector与授权下游/失效验收保持开放。

新conversation可选不可变projectId；无project旧conversation纯文本不变。turn/enqueue可选knowledge引用至多4条、不重复exactref、每条<=4096B、合计<=8192UTF8B；K01 PoolClient内单SQL批量校核同project/确切version/digest/字节边界/currentVersion，不自开pool事务。来源冻结一次，promotion/显式resume只重用，不追新版本。旧CAS/profile/session/FIFO/pause/resume门禁保持。

两份不可变authority：contextDigest仅有序citation+精确text；executionInputDigest覆盖userText/templateVersion/中心executionPrompt（包含必要冻结时metadata）。公开task.submission.prompt、气泡、queue原text一直是用户原文；编译prompt仅冻结输入表和runner私有claim副本。通过task非空FK引用实现缺record/损坏fail closed，无context保持旧值，不新建runnerendpoint/知识grant。已有adapter可追加material路径，因此digest不等于全部SDK输入。

中心executionPrompt<=16000 UTF16 code units且<=49152 UTF8B；enqueue即编译校验，超限整单拒绝无残留不截断。owner按需GET conversation/context详情<=8KiB原文、实际JSON<=65536B；列表仅metadata，详情归属必须匹配conversation。source更新不改变冻结原文，不承诺native会遗忘历史。

retryReconciled在既有stop-confirmation审计门禁后，同TX沿用原context，以现recoverySubmission输出（含revised-work或no-side-effects和恢复证据）重新编译/校验/算新execution digest；不能拒绝此已批准能力、不能盲拷旧compiled、不能丢引用或自动resume。

锁序保留conversation→task及runner→task；claim仅按task FK读immutable context/input，不锁project/conversation。K01批量reader无source/project新写锁；命令事务中只读材料使用一条bounded SQL取得同snapshot事实。

测试seam：实际createServer+018显式fixture后注册模块；旧consumer回归待F01受控生产挂载组合，不把fixture称生产。唯一临时DB/动态端口、正常close/drop，0模型/云；可以注入已有Claude query而不修改runner产品。先真实红用例→最小实现，所有失败/实际选择数留证据。Node24/pnpm9.15.4/Vitest4.0.18/noEmit，不跑固定flow_c01等旧库。执行与共享架构由Lead接收fixedtarget后同步。
