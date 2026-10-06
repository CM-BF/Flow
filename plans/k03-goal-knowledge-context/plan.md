# K03 节点知识上下文

创建/更新：2026-10-06 06:06:18 UTC；状态in-progress。Goal Owner已批准设计，owner b01_bounded_reads / gpt-6-astra ultra，lead Mika。基于已审K02分支a6c9b09a8a4d4020a497341d3fb6deed16b08d02，不是main基线；main3d4985f的O06组合由Lead后续受控集成。

- [ ] K03-01 固定goal专用合同与freeze/compile/freshness/private-input窄接口。
- [ ] K03-02 define同TX冻结、owner详情、source版本失效沿真实依赖链传播。
- [ ] K03-03 取得执行/migration/claim/recovery接缝，完成私有编译与受控恢复。
- [ ] K03-04 真实PG/HTTP/原consumer安全组合及Mika独立技术review。
- [ ] K03-05 GO产品验收与main接收，生产mount/client/CLI由各owner接线。
- [ ] K03-06 后继hybrid/vector、A2A知识配送及更广授权保持开放。

owner按goal/node/inputVersion固定有序KnowledgeCitation至多4条、每条4096B、总8192UTF8B，无重复exactref。原goal不变，缺省与[]在领域入口归一化，不能因空字段产生新版本。goal专用context/input authority独立持久化；引用复用K01协议与已审K02 PoolClient bounded reader，不嵌套pool事务。原文CRLF/Unicode精确、digest/byte边界校核。

source head一次有界metadata读取；版本变化即stale（即便digest相同，主动引用旧版本也stale）。currentDeliveries沿现真实dependsOn递归，不按projectRevision全盘失效；独立C保持，历史输入/已接受binding仍在但current=false。stale阻新execute/accept，运行中固定字节不改、不自动运行。define/execute/accept沿project→task，发布source同project锁；读取RR同快照。

公共input/history/task/初始SSE只有原业务文字和引用metadata；private编译包含完整固定知识与实际artifact依赖，16000 UTF16和49152UTF8B整单上限，不能截断。claim仅授权事务内覆盖私有副本；task独立immutable FK声明goal input，不能缺失/损坏/双conversation+goal绑定后裸降级。C02只复制同context、以recoverySubmission重新编译/新digest，不新建或替换goal_execution、不恢复deliveryCurrent、不隐式native resume。

runner define-input仅保留现owner有序refs，增删换序拒绝；knowledge-bearing execute首片owner-only。校核在commandInTransaction新命令分支内，旧ACK重放不被当前refs变动误拒；原无refs行为保留。runner input读取不返回冻结正文，不把旧节点grant扩成knowledge grant。

当前8scope允许合同、纯helper和新module/tests；goals/commands.ts、021、runners.ts/runner.ts、reconciliation.ts未授权前不写。共享hook未接明确未交付，不能fixture注入替代生产。新detail走goal-context register，无需改goals/index则交还。所有新测试唯一DB/动态端口正常关闭DROP、0模型/云；旧consumer安全副本保留bodies/hash，不能触flow_o01/flow_c02。

直接消费者还包括O03/O06 migration tests：无knowledge输入不得无条件join021表或增加source查询，不吞缺表错误；生产入口必须在请求前迁移021。新metadata仅对实际有refs的input/execution有界读取。保留旧阶段migration测试原断言，在实际组合点明确是否升级迁移fixture。
