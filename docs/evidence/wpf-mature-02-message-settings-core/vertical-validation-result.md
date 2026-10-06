# Claude 逐消息设置：固定纵向验证

source **ea276572c3c99fb8400808a93efc69ce530d55a4**（生产checkpoint92f，ea仅fixture cleanup/独立分页修正）。原base70cc，最后PG执行HEAD **f8cfc7f0b5e99ae5cc1181218e07ccb10dc57a53**。所有34源Git=WT/hash一致；本交付只封存验证和状态，不改生产。

## 已执行结果

| 检查 | 实际结果 | 边界 |
| --- | --- | --- |
| 三contract文件 | 16/16、exit0 | 16:21:52结束，原首leaf5不重计 |
| 合同局部strict | exit0、931.641ms | 三明示entry及传递类型 |
| 注入Claude adapter单文件 | 5/5、exit0 | 16:26:31结束，使用注入query、没有原生SDK目标/provider |
| focused strict | exit0、2227.619ms | 五明示entry及传递类型，非整仓typecheck |
| 专库PG/HTTP单文件 | **8/8、0skip、exit0** | 17:09:02.288→17:09:09.485 UTC，外壳7195.547ms |

共 **29 distinct =16合同+5注入+8专库**，分次执行，不是单轮29。两strict0另列，不算行为项。

## PG实际覆盖与资源

本次CORE-PG-RETRY-20261006-1707 fresh free1,257,181,184B≥1,207,959,552B，claim v3/236input bindings/旧清理通过。仅一随机自有数据库、loopback动态HTTP端口，实际14tasks/11attempts/116HTTP；原8组全部执行。覆盖pre032不存在→旧行→32/二次迁移、SQL shape/null/immutable、旧reader过滤与分页、send/queue幂等冻结/自动手动promotion、legacy不可用pin和空unpause、typed final整批回滚/context model、retry保持与再鉴权拒绝。它们是本fixture断言覆盖，不等于额外旧全库回归。

专库`flow_message_settings_e768fe5964df4d76b685195129f171ad`：app/boss/pool/admin均closed=true，查询本库连接0，普通DROP后exact absent=true，errors=[]。owned Vitest进程已退出；自有cache139B/空TMPDIR已删除，combined peak observed2,555,455B<32MiB；原stdout/stderr3291B，fixture receipt616B。结束free1,247,244,288B只作观察。窗口已归还；无FORCE/他人服务操作/provider。

## 失败与未运行历史保留

首次16:52实际PG：beforeAll缺012动态SQL，1failed suite、8skipped、0case断言，1legacy task/0attempt/0HTTP，原库正常清理。4SQL动态URL闭包遗漏如实保存，Lead补012/013/017/019，未改生产或原raw。

16:58新窗口：fresh不足固定floor，NOT_RUN；0测试/产品PG/DB/HTTP，直接归还。随后17:07为独立明确授权窗口，不是自动重试或降低门槛。两次先前记录原字节均冻结。

## 尚未覆盖

F01生产factory的032挂载、shared export/client ACK/header及Web/TUI控件/深冻/恢复仍由对应owner接线；本专库先由自有helper迁移32，不能替代production mount证明。scheduler readiness由测试SQL显式控制，native模型/provider调用为0。配置choices是profile policy允许集合，不证明任何账户/模型资格；observed仅注入init或合成fenced事件，不证明真实fast生效/effort复位。当前等待固定组合独审，未批准整体用户交付、未集成main；原首leaf批准仅历史。
