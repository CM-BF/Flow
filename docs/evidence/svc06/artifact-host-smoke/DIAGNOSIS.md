# 本次首个中心身份捕获失败：限定只读定位

原work/cleanup失败与UNKNOWN不改。04:06:36的外部只读身份观察发现pending PID/PGID73345仍在，nonce与产物路径吻合；组成员73345/73878/73879，动态中心端口55573由73878监听，55574无人监听。没有center-exit.json；不能把监督组absent解释为中心已退出。

04:07:04只读查询专库flow_preview_5104378c400a8a3a11597418：OID1206953存在、3条idle连接（含pgboss），没有读取query正文。未终止会话、未DROP或改库。身份记录只保存command摘要和匹配结果，无完整命令/凭据。

精确原profile下执行/bin/ps读取该PID，exit71且stderr为execvp Operation not permitted。第一次诊断cwd在开发树，不足以独立归因；随后明确用原允许的worker cwd及原PATH/HOME/TMPDIR重复该只读命令，仍同错误。两个原件均保留。固定process.mjs的identity捕获该执行错误并返回null，spawnOwnedProcess因无法完成记录而失败；实际center保持运行。这确认的是拒读机制与生命周期观察的接缝不兼容，不是中心退出、缺包或三角色宿主通过。

原生产spawnOwnedProcess与runService均stdio ignore，没有保存实际center stderr；不能还原未记录内容，也不将新的ps stderr冒为原center stderr。最小后继设计需保留真实服务的开发路径拒读，同时让受信身份观察在限制之外执行；不能只放开源码访问或断言成功。当前不改源码、不重跑。

本次资源保持：现有e5、private run与DB/中心组KEEP，runner/Web未启动。原cleanup检查点不存在，未发生不可恢复清理。唯一Lead收到具体资源和候选收尾边界，后续停止/清理须按明确授权、原nonce身份helper和持久检查点实施，不能直接重跑失败旅程。
